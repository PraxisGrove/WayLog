export const AGENT_RUNTIME_PROTOCOL_VERSION = 1 as const;

export type AgentModelProfile = "balanced" | "quality" | "router";

export type AgentRuntimeConfig = {
  allowedModelProfiles: AgentModelProfile[];
  configVersion: number;
  dailyLimit: number;
  disabledSkillIds: string[];
  enabled: boolean;
  minimumAppVersion: string;
  minuteLimit: number;
  modelProfiles: Partial<Record<AgentModelProfile, string>>;
  protocolVersion: number;
  telemetryEnabled: boolean;
};

export type AgentUnavailableCode =
  | "app_version_unsupported"
  | "configuration_unavailable"
  | "model_profile_disabled"
  | "protocol_unsupported"
  | "runtime_disabled"
  | "skill_disabled";

export type AgentRuntimeAvailability =
  | {
      available: true;
      code: "available";
      message: string;
      retryable: false;
    }
  | {
      available: false;
      code: AgentUnavailableCode;
      message: string;
      retryable: boolean;
    };

const MODEL_PROFILES: AgentModelProfile[] = ["balanced", "quality", "router"];
const MAX_CONFIG_VERSION = Number.MAX_SAFE_INTEGER;
const MAX_LIMIT = 10_000;
const MAX_LIST_LENGTH = 64;
const MAX_STRING_LENGTH = 200;

export function parseAgentRuntimeConfig(
  value: unknown,
): { data: AgentRuntimeConfig; ok: true } | { error: string; ok: false } {
  if (!isRecord(value)) {
    return { error: "Agent runtime config must be an object.", ok: false };
  }

  const allowedModelProfiles = readModelProfiles(value.allowedModelProfiles);
  const configVersion = readPositiveInteger(
    value.configVersion,
    MAX_CONFIG_VERSION,
  );
  const dailyLimit = readPositiveInteger(value.dailyLimit, MAX_LIMIT);
  const disabledSkillIds = readStringList(value.disabledSkillIds);
  const minimumAppVersion = readBoundedString(value.minimumAppVersion);
  const minuteLimit = readPositiveInteger(value.minuteLimit, MAX_LIMIT);
  const modelProfiles = readModelProfileMap(value.modelProfiles);
  const protocolVersion = readPositiveInteger(value.protocolVersion, 1_000);

  if (
    typeof value.enabled !== "boolean" ||
    typeof value.telemetryEnabled !== "boolean" ||
    !allowedModelProfiles ||
    configVersion === undefined ||
    dailyLimit === undefined ||
    !disabledSkillIds ||
    !minimumAppVersion ||
    minuteLimit === undefined ||
    !modelProfiles ||
    !allowedModelProfiles.every((profile) => Boolean(modelProfiles[profile])) ||
    protocolVersion === undefined
  ) {
    return { error: "Agent runtime config is invalid.", ok: false };
  }

  return {
    data: {
      allowedModelProfiles,
      configVersion,
      dailyLimit,
      disabledSkillIds,
      enabled: value.enabled,
      minimumAppVersion,
      minuteLimit,
      modelProfiles,
      protocolVersion,
      telemetryEnabled: value.telemetryEnabled,
    },
    ok: true,
  };
}

export function evaluateAgentRuntimeAvailability(
  config: AgentRuntimeConfig,
  input: {
    appVersion: string;
    modelProfile?: string;
    protocolVersion: number;
    skillId?: string;
  },
): AgentRuntimeAvailability {
  if (!config.enabled) {
    return unavailable("runtime_disabled", "旅行助手当前暂停服务。", false);
  }

  if (input.protocolVersion !== config.protocolVersion) {
    return unavailable(
      "protocol_unsupported",
      "当前版本与旅行助手服务不兼容，请更新 App。",
      false,
    );
  }

  if (compareVersion(input.appVersion, config.minimumAppVersion) < 0) {
    return unavailable(
      "app_version_unsupported",
      "当前 App 版本过低，请更新后使用旅行助手。",
      false,
    );
  }

  if (input.skillId && config.disabledSkillIds.includes(input.skillId)) {
    return unavailable("skill_disabled", "这项旅行助手能力暂时停用。", false);
  }

  if (
    input.modelProfile &&
    !config.allowedModelProfiles.includes(
      input.modelProfile as AgentModelProfile,
    )
  ) {
    return unavailable(
      "model_profile_disabled",
      "当前模型档位暂时不可用。",
      false,
    );
  }

  return {
    available: true,
    code: "available",
    message: "旅行助手可用。",
    retryable: false,
  };
}

export function resolveAgentRuntimeModel(
  config: AgentRuntimeConfig,
  modelProfile: AgentModelProfile,
): string | undefined {
  return config.modelProfiles[modelProfile]?.trim() || undefined;
}

export function compareVersion(left: string, right: string): number {
  const leftParts = readVersionParts(left);
  const rightParts = readVersionParts(right);

  if (!leftParts || !rightParts) return -1;

  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  return 0;
}

function unavailable(
  code: AgentUnavailableCode,
  message: string,
  retryable: boolean,
): AgentRuntimeAvailability {
  return { available: false, code, message, retryable };
}

function readVersionParts(value: string): number[] | undefined {
  const text = value.trim();
  if (
    !text ||
    text.length > MAX_STRING_LENGTH ||
    !/^\d+(?:[.-]\d+)*$/.test(text)
  ) {
    return undefined;
  }
  return text.split(/[.-]/).map(Number);
}

function readModelProfiles(value: unknown): AgentModelProfile[] | undefined {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MODEL_PROFILES.length
  ) {
    return undefined;
  }
  if (
    !value.every((item) => MODEL_PROFILES.includes(item as AgentModelProfile))
  ) {
    return undefined;
  }
  return [...new Set(value)] as AgentModelProfile[];
}

function readModelProfileMap(
  value: unknown,
): Partial<Record<AgentModelProfile, string>> | undefined {
  if (!isRecord(value)) return undefined;
  const result: Partial<Record<AgentModelProfile, string>> = {};
  for (const [key, rawModel] of Object.entries(value)) {
    if (!MODEL_PROFILES.includes(key as AgentModelProfile)) return undefined;
    const model = readBoundedString(rawModel);
    if (!model) return undefined;
    result[key as AgentModelProfile] = model;
  }
  return result;
}

function readStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_LIST_LENGTH) return undefined;
  const values = value.map(readBoundedString);
  return values.every((item): item is string => Boolean(item))
    ? [...new Set(values as string[])]
    : undefined;
}

function readBoundedString(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text && text.length <= MAX_STRING_LENGTH ? text : undefined;
}

function readPositiveInteger(
  value: unknown,
  maximum: number,
): number | undefined {
  return Number.isInteger(value) &&
    Number(value) > 0 &&
    Number(value) <= maximum
    ? Number(value)
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
