import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";
import { CorosClientInfo, CorosProvider } from "./coros.provider.ts";
import { Client } from "@modelcontextprotocol/sdk/client";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth";

const URL_MCP = "https://mcpus.coros.com/mcp";
export const CLIENT_ID = "COROS-CONNECT";

export class CorosConnect {
  isTerminal: boolean;
  client: Client | null = null;
  transport: StreamableHTTPClientTransport | null = null;
  provider: CorosProvider;
  store: CorosClientInfo = {
    clientInfo: null,
    tokens: null,
    tokensEnc: null,
    codeVerifierEnc: null,
    oauthState: null,
  };

  constructor(provider: CorosProvider, isTerminal?: boolean) {
    this.provider = provider;
    this.isTerminal = !!isTerminal;
  }

  async login(): Promise<URL> {
    try {
      await this.checkConnect();
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) throw error;
    } finally {
      await this.close();
    }
    this.log("coros - login");

    const url = this.provider.authorizationUrl;
    if (!url)
      throw new Error(
        "COROS did not ask for authorization; it may already be connected.",
      );

    this.log("Authorize URL:", url.href);
    return url;
  }

  async verifyLoginCode(code: string) {
    this.log("coros - verifyLoginCode");
    const transport = new StreamableHTTPClientTransport(new URL(URL_MCP), {
      authProvider: this.provider,
    });
    try {
      await transport.finishAuth(code);
    } finally {
      await transport.close().catch(() => {});
    }
  }

  get result() {
    this.log("coros - result");
    return {
      store: this.store,
    };
  }

  private async checkConnect() {
    this.log("coros - checkConnect");
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
    this.log("coros - close");
    await this.client?.close().catch(() => {});
    this.client = null;
    this.transport = null;
  }

  private log(...messages: any[]) {
    if (this.isTerminal) console.log(...messages);
  }
}
