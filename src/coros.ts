import { Client } from "@modelcontextprotocol/sdk/client";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CLIENT_ID, CLIENT_VERSION, URL_MCP } from "./constants.ts";
import { CorosProvider } from "./coros.provider.ts";
import {
  CorosClientInfo,
  CorosConnectOptions,
  CorosDailyHealthResult,
  CorosDevicesResult,
  CorosRecoveryStatusResult,
  CorosTool,
  CorosToolResult,
  CorosTrainingScheduleResult,
  CorosUserInfoResult,
} from "./types.ts";
import {
  getTextContent,
  parseDailyHealthData,
  parseDevices,
  parseRecoveryStatus,
  parseTrainingSchedule,
  parseUserInfo,
} from "./helper.ts";

// COROS tool name -> method that calls and parses it
const AVAILABLE_TOOL_HANDLERS = {
  queryUserInfo: "getUserInfo",
  queryDevices: "getDevices",
  queryDailyHealthData: "getDailyHealthData",
  queryTrainingSchedule: "getTrainingSchedule",
  queryRecoveryStatus: "getRecoveryStatus",
} as const satisfies Record<string, keyof CorosConnect>;
type AvailableTool = keyof typeof AVAILABLE_TOOL_HANDLERS;

export class CorosConnect {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private provider: CorosProvider;
  private store: CorosClientInfo = {
    clientInfo: null,
    tokens: null,
    codeVerifier: null,
    oauthState: null,
  };
  private onCredentials: CorosConnectOptions["onCredentials"];

  constructor({ redirect, credentials, onCredentials }: CorosConnectOptions) {
    this.onCredentials = onCredentials;
    this.store = { ...this.store, ...credentials };
    this.provider = new CorosProvider({
      redirect,
      getter: (field) => this.store[field],
      setter: async (data) => {
        this.store = { ...this.store, ...data };
        if (
          "clientInfo" in data ||
          "tokens" in data ||
          "codeVerifier" in data
        ) {
          await this.onCredentials?.({
            clientInfo: this.store.clientInfo,
            tokens: this.store.tokens,
            codeVerifier: this.store.codeVerifier,
          });
        }
      },
    });
  }

  /**
   * Call this function to get Authorization URL.
   * Uses its own connection, so an active one from `connect` stays open.
   * @returns {URL} Authorization URL.
   */
  public async login(): Promise<URL> {
    this.provider.authorizationUrl = null;
    const { client, transport } = this.createClient();
    try {
      await client.connect(transport);
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) throw error;
    } finally {
      await client.close().catch(() => {});
      await transport.close().catch(() => {});
    }

    const url = this.provider.authorizationUrl;
    if (!url)
      throw new Error(
        "COROS did not ask for authorization; it may already be connected.",
      );

    return url;
  }

  /**
   * After call login, COROS will redirect back to `redirect` you set,
   * with `code` in search params, call this func with that code to verify.
   * @param {String} code Verify code returns by COROS.
   */
  public async verifyLoginCode(code: string) {
    const transport = new StreamableHTTPClientTransport(new URL(URL_MCP), {
      authProvider: this.provider,
    });
    try {
      await transport.finishAuth(code);
    } finally {
      await transport.close().catch(() => {});
    }
  }

  /**
   * Call this to refresh token when you already logged-in
   */
  public async connect(): Promise<Client> {
    try {
      await this.close();
      await this.checkConnect();
    } catch (error) {
      await this.close();
      throw error;
    }
    return this.client!;
  }

  private createClient() {
    const transport = new StreamableHTTPClientTransport(new URL(URL_MCP), {
      authProvider: this.provider,
    });
    const client = new Client(
      { name: CLIENT_ID, version: CLIENT_VERSION },
      { capabilities: {} },
    );
    return { client, transport };
  }

  private async checkConnect() {
    const { client, transport } = this.createClient();
    this.client = client;
    this.transport = transport;
    await this.client.connect(this.transport);
  }

  public async close(): Promise<void> {
    await this.client?.close().catch(() => {});
    await this.transport?.close().catch(() => {});
    this.client = null;
    this.transport = null;
  }

  private getClient(): Client {
    if (!this.client) throw new Error("Not connected. Call connect() first.");
    return this.client;
  }

  // ============================ BASE =========================

  /**
   * Call this to get all tools supported by COROS
   */
  public async tools(): Promise<CorosTool[]> {
    const res = await this.getClient().listTools();

    return res.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }
  /**
   * Some tools current not supports by this package, so u can check
   * `inputSchema` from `tools` to call that.
   */
  public async useTool(name: string, args: Record<string, unknown>) {
    return await this.getClient().callTool({
      name,
      arguments: args,
    });
  }
  // ============================ TOOLS =========================

  // calls a COROS tool, throws on a tool error, and parses its text content
  private async queryAndParse<TParsed>(
    name: string,
    args: Record<string, unknown>,
    parse: (text: string) => TParsed | null,
  ): Promise<{ parsed: TParsed | null; originalData: CorosToolResult }> {
    const data = await this.getClient().callTool({ name, arguments: args });
    const text = getTextContent(data);
    if (data.isError) {
      throw new Error(`${name} failed: ${text ?? "unknown error"}`);
    }
    return { parsed: text ? parse(text) : null, originalData: data };
  }

  /**
   * https://github.com/coroslab/COROS-MCP/blob/main/docs/en/tools.md#querydailyhealthdata
   * @param {number} days Number of recent days, COROS defaults to 7.
   * @throws When `days` is not a positive integer, or COROS returns an error.
   */
  public async getDailyHealthData(
    days?: number,
  ): Promise<CorosDailyHealthResult> {
    if (days !== undefined && (!Number.isInteger(days) || days < 1)) {
      throw new RangeError("days must be a positive integer");
    }
    return this.queryAndParse(
      "queryDailyHealthData",
      days === undefined ? {} : { days },
      parseDailyHealthData,
    );
  }

  /**
   * https://github.com/coroslab/COROS-MCP/blob/main/docs/en/tools.md#querydevices
   */
  public async getDevices(): Promise<CorosDevicesResult> {
    return this.queryAndParse("queryDevices", {}, parseDevices);
  }

  /**
   * https://github.com/coroslab/COROS-MCP/blob/main/docs/en/tools.md#queryuserinfo
   */
  public async getUserInfo(): Promise<CorosUserInfoResult> {
    return this.queryAndParse("queryUserInfo", {}, parseUserInfo);
  }

  /**
   * https://github.com/coroslab/COROS-MCP/blob/main/docs/en/tools.md#queryrecoverystatus
   */
  public async getRecoveryStatus(): Promise<CorosRecoveryStatusResult> {
    return this.queryAndParse("queryRecoveryStatus", {}, parseRecoveryStatus);
  }

  /**
   * https://github.com/coroslab/COROS-MCP/blob/main/docs/en/tools.md#querytrainingschedule
   * Omit both dates for the current Monday-Sunday week.
   * @throws When a date is not in `yyyyMMdd` format, or COROS returns an error.
   */
  public async getTrainingSchedule(
    args: { startDate?: string; endDate?: string } = {},
  ): Promise<CorosTrainingScheduleResult> {
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined && !/^\d{8}$/.test(value)) {
        throw new RangeError(`${key} must be in yyyyMMdd format`);
      }
    }
    return this.queryAndParse(
      "queryTrainingSchedule",
      args,
      parseTrainingSchedule,
    );
  }

  get availableTools() {
    return {
      tools: Object.keys(AVAILABLE_TOOL_HANDLERS) as AvailableTool[],
      handler: AVAILABLE_TOOL_HANDLERS,
    };
  }
}
