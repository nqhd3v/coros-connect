import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { CLIENT_ID } from "./constants.ts";

export type CorosClientInfo = {
  clientInfo: OAuthClientInformationMixed | null;
  tokens: OAuthTokens | null;
  codeVerifier: string | null;
  oauthState: string | null;
};
export type CorosProviderOptions = {
  redirect: string;
  getter: <Field extends keyof CorosClientInfo>(
    field: Field,
  ) => Promise<CorosClientInfo[Field]> | CorosClientInfo[Field];
  setter: (payload: Partial<CorosClientInfo>) => Promise<void> | void;
};

export class CorosProvider implements OAuthClientProvider {
  authorizationUrl: URL | null = null;
  redirect: string;

  getter: CorosProviderOptions["getter"];
  setter: CorosProviderOptions["setter"];

  constructor({ redirect, getter, setter }: CorosProviderOptions) {
    this.redirect = redirect;
    this.getter = getter;
    this.setter = setter;
  }

  get redirectUrl(): string {
    return this.redirect;
  }

  get clientMetadata(): OAuthClientMetadata {
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
    const info = await this.getter("clientInfo");
    return info ?? undefined;
  }

  async saveClientInformation(
    info: OAuthClientInformationMixed,
  ): Promise<void> {
    await this.setter({ clientInfo: info });
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const authTokens = await this.getter("tokens");
    if (!authTokens) return undefined;
    return authTokens as OAuthTokens;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await this.setter({
      tokens,
      codeVerifier: null,
      oauthState: null,
    });
  }

  async redirectToAuthorization(url: URL): Promise<void> {
    this.authorizationUrl = url;
  }

  async saveCodeVerifier(verifier: string): Promise<void> {
    await this.setter({ codeVerifier: verifier });
  }

  async codeVerifier(): Promise<string> {
    const codeVerifier = await this.getter("codeVerifier");
    if (!codeVerifier) {
      throw new Error("No authorization is in progress.");
    }
    return codeVerifier;
  }

  // Called by the SDK when the server rejects stored credentials, so dead
  // values are wiped instead of failing the same way on every connect.
  async invalidateCredentials(
    scope: "all" | "client" | "tokens" | "verifier" | "discovery",
  ): Promise<void> {
    switch (scope) {
      case "all":
        await this.setter({
          clientInfo: null,
          tokens: null,
          codeVerifier: null,
          oauthState: null,
        });
        break;
      case "client":
        await this.setter({ clientInfo: null });
        break;
      case "tokens":
        await this.setter({ tokens: null });
        break;
      case "verifier":
        await this.setter({ codeVerifier: null });
        break;
      case "discovery":
        // Discovery state is not cached.
        break;
    }
  }
}
