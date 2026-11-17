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
// device
export type CorosDeviceParsed = {
  name: string;
  bluetoothId: string;
  modelName: string;
  serialNumber: string;
  warrantyExpires: string;
};
// health data
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
// training schedule
export type CorosTraining = {
  date: string;
  unknownCode: string;
  planId: string;
  idInPlan: string;
  distance: string;
  estimatedTime: string;
  load: string;
};
// user
export type CorosUserInfo = {
  birthday: string;
  nickname: string;
  gender: string; // Male
  height: string;
  weight: string;
};
// recovery status
export type CorosRecoveryStatus = {
  recovery: string;
  level: string;
  estimatedFullRecovery: string;
};

// result
type CorosQueryResult<TParsed> = {
  parsed: TParsed | null;
  originalData: CorosToolResult;
};

export type CorosDailyHealthResult = CorosQueryResult<CorosDailyHealthParsed>;
export type CorosDevicesResult = CorosQueryResult<CorosDeviceParsed[]>;
export type CorosTrainingScheduleResult = CorosQueryResult<CorosTraining[]>;
export type CorosUserInfoResult = CorosQueryResult<CorosUserInfo>;
export type CorosRecoveryStatusResult = CorosQueryResult<CorosRecoveryStatus>;
