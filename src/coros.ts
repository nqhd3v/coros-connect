import { Client } from "@modelcontextprotocol/sdk/client";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";
import { CLIENT_ID, URL_MCP } from "./constants.ts";
import { CorosClientInfo, CorosProvider } from "./coros.provider.ts";

export type CorosCredentials = Pick<CorosClientInfo, "clientInfo" | "tokens">;

export type CorosConnectOptions = {
  redirect: string;
  credentials?: Partial<CorosCredentials>;
  onCredentials?: (credentials: CorosCredentials) => Promise<void> | void;
};

export class CorosConnect {
  client: Client | null = null;
  transport: StreamableHTTPClientTransport | null = null;
  provider: CorosProvider;
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
        if ("clientInfo" in data || "tokens" in data) {
          await this.onCredentials?.({
            clientInfo: this.store.clientInfo,
            tokens: this.store.tokens,
          });
        }
      },
    });
  }

  async login(): Promise<URL> {
    this.provider.authorizationUrl = null;
    try {
      await this.checkConnect();
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) throw error;
    } finally {
      await this.close();
    }

    const url = this.provider.authorizationUrl;
    if (!url)
      throw new Error(
        "COROS did not ask for authorization; it may already be connected.",
      );

    return url;
  }

  async verifyLoginCode(code: string) {
    const transport = new StreamableHTTPClientTransport(new URL(URL_MCP), {
      authProvider: this.provider,
    });
    try {
      await transport.finishAuth(code);
    } finally {
      await transport.close().catch(() => {});
    }
  }

  async connect(): Promise<Client> {
    try {
      await this.checkConnect();
    } catch (error) {
      await this.close();
      throw error;
    }
    return this.client!;
  }

  private async checkConnect() {
    this.transport = new StreamableHTTPClientTransport(new URL(URL_MCP), {
      authProvider: this.provider,
    });
    this.client = new Client(
      { name: CLIENT_ID, version: "1.0.0" },
      { capabilities: {} },
    );
    await this.client.connect(this.transport);
  }

  async close(): Promise<void> {
    await this.client?.close().catch(() => {});
    await this.transport?.close().catch(() => {});
    this.client = null;
    this.transport = null;
  }
}
