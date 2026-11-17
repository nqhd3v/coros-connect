import type { Client } from "@modelcontextprotocol/sdk/client";
import type {
  OAuthClientInformationMixed,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

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

export type CorosCredentials = Pick<
  CorosClientInfo,
  "clientInfo" | "tokens" | "codeVerifier"
>;

export type CorosConnectOptions = {
  redirect: string;
  credentials?: Partial<CorosCredentials>;
  onCredentials?: (credentials: CorosCredentials) => Promise<void> | void;
};

// https://modelcontextprotocol.io/specification/2026-07-28/schema#tool-inputschema
export type CorosTool = {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    [key: string]: unknown;
  };
};

export type CorosToolResult = Awaited<ReturnType<Client["callTool"]>>;

// ================== PARSED =====================
export type CorosDailyHealthSummary = {
  steps: string;
  calories: string;
  exercise: string;
  stress: {
    avg: string;
  };
  sleep: {
    total: string;
    deep: string;
    light: string;
    rem: string;
    awake: string;
  };
  sleepHr: {
    avg: string;
    min: string;
    max: string;
  };
};
export type CorosDailyHealthParsedData = {
  date: string;
  summary: Partial<CorosDailyHealthSummary>;
};
export type CorosDailyHealthParsed = {
  name: string;
  summary: Record<string, string>;
  note: string;
  days: CorosDailyHealthParsedData[];
};
export type CorosDailyHealthResult = {
  parsed: CorosDailyHealthParsed | null;
  originalData: CorosToolResult;
};
