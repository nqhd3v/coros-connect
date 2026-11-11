import { Client } from "@modelcontextprotocol/sdk/client";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";
import { CorosProvider } from "./coros.provider.ts";

const URL_MCP = "https://mcpus.coros.com/mcp";
export const CLIENT_ID = "COROS-CONNECT";

export class CorosConnect {
  isDebug: boolean;
  client: Client | null = null;
  transport: StreamableHTTPClientTransport | null = null;
  provider: CorosProvider;

  constructor(provider: CorosProvider, isDebug?: boolean) {
    this.provider = provider;
    this.isDebug = !!isDebug;
  }

  async login(): Promise<URL> {
    try {
      await this.checkConnect();
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) throw error;
    } finally {
      await this.close();
    }
    this.debug("coros - login");

    const url = this.provider.authorizationUrl;
    if (!url)
      throw new Error(
        "COROS did not ask for authorization; it may already be connected.",
      );

    this.debug("Authorize URL:", url.href);
    return url;
  }

  async verifyLoginCode(code: string) {
    this.debug("coros - verifyLoginCode");
    const transport = new StreamableHTTPClientTransport(new URL(URL_MCP), {
      authProvider: this.provider,
    });
    try {
      await transport.finishAuth(code);
    } finally {
      await transport.close().catch(() => {});
    }
  }

  private async checkConnect() {
    this.debug("coros - checkConnect");
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
    this.debug("coros - close");
    await this.client?.close().catch(() => {});
    this.client = null;
    this.transport = null;
  }

  private debug(...messages: any[]) {
    if (this.isDebug) console.log(...messages);
  }
}
