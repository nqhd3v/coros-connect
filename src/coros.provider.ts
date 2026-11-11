import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth";
import {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth";
import { CLIENT_ID } from "./coros.ts";

export type CorosClientInfo = {
  clientInfo: OAuthClientInformationMixed | null;
  tokens: OAuthTokens | null;
  codeVerifier: string | null;
  oauthState: string | null;
};
export type CorosProviderOptions = {
  redirect: string;
  getter?: <Field extends keyof CorosClientInfo>(
    field: Field,
  ) => Promise<CorosClientInfo[Field]> | CorosClientInfo[Field];
  setter: (payload: Partial<CorosClientInfo>) => Promise<void> | void;
};

export class CorosProvider implements OAuthClientProvider {
  authorizationUrl: URL | null = null;
  redirect: string;
  isTerminal: boolean;

  getter?: CorosProviderOptions["getter"];
  setter: CorosProviderOptions["setter"];

  constructor(
    { redirect, getter, setter }: CorosProviderOptions,
    isTerminal = false,
  ) {
    this.redirect = redirect;
    this.getter = getter;
    this.setter = setter;
    this.isTerminal = isTerminal;
  }

  private log(...messages: any[]) {
    if (this.isTerminal) console.log(...messages);
  }

  get redirectUrl(): string {
    this.log("corosClient - redirectUrl");
    return this.redirect;
  }

  get clientMetadata(): OAuthClientMetadata {
    this.log("corosClient - clientMetadata");
    return {
      client_name: CLIENT_ID,
      redirect_uris: [this.redirect],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "openid mcp.tools offline_access",
    };
  }

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    this.log("corosClient - clientInformation");
    const info = await this.getter?.("clientInfo");
    return info ?? undefined;
  }

  async saveClientInformation(
    info: OAuthClientInformationMixed,
  ): Promise<void> {
    this.log("corosClient - saveClientInformation");
    await this.setter({ clientInfo: info });
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    this.log("corosClient - tokens");
    const authTokens = await this.getter?.("tokens");
    if (!authTokens) return undefined;
    return authTokens as OAuthTokens;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    this.log("corosClient - saveTokens");
    await this.setter({
      tokens,
      // The authorization is complete; the single-use material is now dead
      // weight, and dead credentials should not sit in a database.
      codeVerifier: null,
      oauthState: null,
    });
  }

  async redirectToAuthorization(url: URL): Promise<void> {
    this.log("corosClient - redirectToAuthorization");
    this.authorizationUrl = url;
  }

  async saveCodeVerifier(verifier: string): Promise<void> {
    this.log("corosClient - saveCodeVerifier");
    await this.setter({ codeVerifier: verifier });
  }

  async codeVerifier(): Promise<string> {
    this.log("corosClient - codeVerifier");
    const codeVerifier = await this.getter?.("codeVerifier");
    if (!codeVerifier) {
      throw new Error("No authorization is in progress.");
    }
    return codeVerifier;
  }
}
