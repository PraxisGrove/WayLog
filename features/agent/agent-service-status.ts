export const AGENT_SERVICE_STATUS_SCHEMA_VERSION = 1 as const;

export type AgentServiceAvailabilityCode =
  | "app_version_unsupported"
  | "available"
  | "configuration_unavailable"
  | "model_profile_disabled"
  | "protocol_unsupported"
  | "runtime_disabled"
  | "skill_disabled";

export type AgentServiceStatus = {
  availability: {
    available: boolean;
    code: AgentServiceAvailabilityCode;
    message: string;
    retryable: boolean;
  };
  configVersion: number;
  quota: {
    limit: number;
    remaining: number;
    resetAt?: string;
    used: number;
  };
  schemaVersion: typeof AGENT_SERVICE_STATUS_SCHEMA_VERSION;
  usage: {
    durationMs: number;
    escalations: number;
    modelCalls: number;
    modelProfile?: string;
    toolCalls: number;
  };
};

export type AgentServiceStatusRequest = {
  accountId: string;
  requestId: number;
};

export function createAgentServiceStatusRequestGate() {
  let requestId = 0;
  let activeAccountId: string | undefined;

  return {
    begin(accountId: string): AgentServiceStatusRequest {
      requestId += 1;
      activeAccountId = accountId;
      return { accountId, requestId };
    },
    invalidate(): void {
      requestId += 1;
      activeAccountId = undefined;
    },
    isCurrent(request: AgentServiceStatusRequest): boolean {
      return (
        request.requestId === requestId && request.accountId === activeAccountId
      );
    },
  };
}

const AVAILABILITY_CODES: AgentServiceAvailabilityCode[] = [
  "app_version_unsupported",
  "available",
  "configuration_unavailable",
  "model_profile_disabled",
  "protocol_unsupported",
  "runtime_disabled",
  "skill_disabled",
];

export function parseAgentServiceStatus(
  value: unknown,
): AgentServiceStatus | undefined {
  if (
    !isRecord(value) ||
    value.schemaVersion !== AGENT_SERVICE_STATUS_SCHEMA_VERSION ||
    !isRecord(value.availability) ||
    !isRecord(value.quota) ||
    !isRecord(value.usage)
  ) {
    return undefined;
  }

  const code = value.availability.code;
  const message = readString(value.availability.message);
  const configVersion = readNonNegativeInteger(value.configVersion);
  const limit = readNonNegativeInteger(value.quota.limit);
  const remaining = readNonNegativeInteger(value.quota.remaining);
  const used = readNonNegativeInteger(value.quota.used);
  const durationMs = readNonNegativeInteger(value.usage.durationMs);
  const escalations = readNonNegativeInteger(value.usage.escalations);
  const modelCalls = readNonNegativeInteger(value.usage.modelCalls);
  const toolCalls = readNonNegativeInteger(value.usage.toolCalls);

  if (
    typeof value.availability.available !== "boolean" ||
    typeof value.availability.retryable !== "boolean" ||
    !AVAILABILITY_CODES.includes(code as AgentServiceAvailabilityCode) ||
    !message ||
    configVersion === undefined ||
    limit === undefined ||
    remaining === undefined ||
    used === undefined ||
    durationMs === undefined ||
    escalations === undefined ||
    modelCalls === undefined ||
    toolCalls === undefined
  ) {
    return undefined;
  }

  const resetAt = readIsoDate(value.quota.resetAt);
  const modelProfile = readString(value.usage.modelProfile);

  return {
    availability: {
      available: value.availability.available,
      code: code as AgentServiceAvailabilityCode,
      message,
      retryable: value.availability.retryable,
    },
    configVersion,
    quota: { limit, remaining, resetAt, used },
    schemaVersion: AGENT_SERVICE_STATUS_SCHEMA_VERSION,
    usage: { durationMs, escalations, modelCalls, modelProfile, toolCalls },
  };
}

export async function requestAgentServiceStatus(input: {
  accessToken: string;
  anonKey?: string;
  appVersion: string;
  fetcher?: typeof fetch;
  url: string;
}): Promise<AgentServiceStatus> {
  const response = await (input.fetcher ?? fetch)(input.url, {
    headers: {
      ...(input.anonKey ? { apikey: input.anonKey } : {}),
      Authorization: `Bearer ${input.accessToken.trim()}`,
      "X-WayLog-Agent-Protocol-Version": String(
        AGENT_SERVICE_STATUS_SCHEMA_VERSION,
      ),
      "X-WayLog-App-Version": input.appVersion.trim(),
    },
    method: "GET",
  });

  const status = parseAgentServiceStatus(
    await response.json().catch(() => undefined),
  );
  if (!status) {
    throw new Error("无法读取旅行助手状态，请稍后重试。");
  }
  return status;
}

function readNonNegativeInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) >= 0
    ? Number(value)
    : undefined;
}

function readString(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text && text.length <= 500 ? text : undefined;
}

function readIsoDate(value: unknown): string | undefined {
  const text = readString(value);
  return text && Number.isFinite(new Date(text).getTime()) ? text : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
