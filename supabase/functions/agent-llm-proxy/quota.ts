import {
  agentRateLimitTimeoutMs,
  agentTurnDailyLimit,
  agentTurnMinuteLimit,
  normalizeUrl,
  readEnv,
} from "./config.ts";
import { fetchWithTimeout } from "./http-client.ts";
type AgentQuotaError = {
  error: string;
  status: number;
};

type AgentQuotaResult = {
  allowed: boolean;
  bucket?: string;
  dailyLimit?: number;
  dailyRemaining?: number;
  dailyUsed?: number;
  minuteLimit?: number;
  minuteRemaining?: number;
  retryAfterSeconds?: number;
};

export type AgentUsageSummary = {
  dailyLimit: number;
  dailyRemaining: number;
  dailyUsed: number;
  durationMs: number;
  escalations: number;
  modelCalls: number;
  modelProfile?: string;
  resetAt?: string;
  toolCalls: number;
};

type AgentQuotaRequestOptions = {
  anonKey?: string;
  dailyLimit?: number;
  fetcher?: typeof fetch;
  minuteLimit?: number;
  supabaseUrl?: string;
  timeoutMs?: number;
};

export async function consumeAgentTurnQuota(
  authHeader: string,
  options: AgentQuotaRequestOptions = {},
): Promise<AgentQuotaResult | AgentQuotaError> {
  const supabaseUrl = normalizeUrl(
    options.supabaseUrl ?? readEnv("SUPABASE_URL"),
  );
  const anonKey = options.anonKey ?? readEnv("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) {
    return { error: "Missing Supabase rate limit configuration.", status: 500 };
  }

  const response = await requestWithTimeout(
    `${supabaseUrl}/rest/v1/rpc/consume_agent_turn_quota`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_daily_limit: options.dailyLimit ?? agentTurnDailyLimit,
        p_minute_limit: options.minuteLimit ?? agentTurnMinuteLimit,
      }),
    },
    options.timeoutMs ?? agentRateLimitTimeoutMs,
    options.fetcher,
  ).catch(() => undefined);

  if (!response) {
    return { error: "Agent 限流检查超时，请稍后重试。", status: 503 };
  }

  const payload = await response.json().catch(() => undefined);

  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.message === "string"
        ? payload.message
        : "Agent rate limit check failed.";

    return {
      error: message,
      status: response.status === 401 || response.status === 403 ? 401 : 500,
    };
  }

  if (!isRecord(payload) || typeof payload.allowed !== "boolean") {
    return {
      error: "Agent rate limit check returned invalid data.",
      status: 500,
    };
  }

  const result: AgentQuotaResult = { allowed: payload.allowed };
  assignDefined(result, "bucket", readString(payload.bucket));
  assignDefined(
    result,
    "dailyLimit",
    readNonNegativeInteger(payload.dailyLimit ?? payload.limit),
  );
  assignDefined(
    result,
    "dailyRemaining",
    readNonNegativeInteger(payload.dailyRemaining),
  );
  assignDefined(result, "dailyUsed", readNonNegativeInteger(payload.dailyUsed));
  assignDefined(
    result,
    "minuteLimit",
    readNonNegativeInteger(payload.minuteLimit),
  );
  assignDefined(
    result,
    "minuteRemaining",
    readNonNegativeInteger(payload.minuteRemaining),
  );
  assignDefined(
    result,
    "retryAfterSeconds",
    readNonNegativeInteger(payload.retryAfterSeconds),
  );
  return result;
}

export async function readAgentUsageSummary(
  authHeader: string,
  options: AgentQuotaRequestOptions = {},
): Promise<AgentUsageSummary | AgentQuotaError> {
  const supabaseUrl = normalizeUrl(
    options.supabaseUrl ?? readEnv("SUPABASE_URL"),
  );
  const anonKey = options.anonKey ?? readEnv("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return { error: "Missing Supabase usage configuration.", status: 500 };
  }

  const response = await requestWithTimeout(
    `${supabaseUrl}/rest/v1/rpc/get_agent_runtime_usage`,
    {
      body: JSON.stringify({
        p_daily_limit: options.dailyLimit ?? agentTurnDailyLimit,
      }),
      headers: {
        apikey: anonKey,
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
    options.timeoutMs ?? agentRateLimitTimeoutMs,
    options.fetcher,
  ).catch(() => undefined);

  if (!response) {
    return { error: "Agent usage check timed out.", status: 503 };
  }
  const payload = await response.json().catch(() => undefined);
  if (!response.ok || !isRecord(payload)) {
    return {
      error: "Agent usage check failed.",
      status: response.status === 401 || response.status === 403 ? 401 : 500,
    };
  }

  const summary: AgentUsageSummary = {
    dailyLimit: readNonNegativeInteger(payload.dailyLimit) ?? 0,
    dailyRemaining: readNonNegativeInteger(payload.dailyRemaining) ?? 0,
    dailyUsed: readNonNegativeInteger(payload.dailyUsed) ?? 0,
    durationMs: readNonNegativeInteger(payload.durationMs) ?? 0,
    escalations: readNonNegativeInteger(payload.escalations) ?? 0,
    modelCalls: readNonNegativeInteger(payload.modelCalls) ?? 0,
    modelProfile: readString(payload.modelProfile),
    resetAt: readIsoDate(payload.resetAt),
    toolCalls: readNonNegativeInteger(payload.toolCalls) ?? 0,
  };
  return summary;
}

export function createRateLimitMessage(quota: AgentQuotaResult): string {
  if (quota.bucket === "day") {
    return "过去 24 小时内的 Agent 使用次数已达上限，请稍后再试。";
  }

  return "Agent 请求太频繁，请稍后再试。";
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNonNegativeInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) >= 0
    ? Number(value)
    : undefined;
}

function readIsoDate(value: unknown): string | undefined {
  const text = readString(value);
  return text && Number.isFinite(new Date(text).getTime()) ? text : undefined;
}

function assignDefined<K extends keyof AgentQuotaResult>(
  target: AgentQuotaResult,
  key: K,
  value: AgentQuotaResult[K] | undefined,
) {
  if (value !== undefined) target[key] = value;
}

function requestWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetcher?: typeof fetch,
) {
  if (!fetcher) return fetchWithTimeout(url, init, timeoutMs);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetcher(url, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
