export type AgentTelemetryToolStatus = "completed" | "failed" | "requested";

export type AgentRuntimeTelemetryEvent = {
  appVersion?: string;
  attemptId?: string;
  conversationId?: string;
  durationMs?: number;
  escalationReason?: string;
  escalatedFrom?: string;
  failureKind?: string;
  inputTokens?: number;
  model?: string;
  modelProfile?: string;
  operationCount?: number;
  outputTokens?: number;
  phase?: string;
  promptVersion?: string;
  provider?: string;
  status?: "failed" | "succeeded";
  toolEvents?: Array<{ name: string; status: AgentTelemetryToolStatus }>;
  totalTokens?: number;
  turnId?: string;
  userId?: string;
};

const MAX_IDENTIFIER_LENGTH = 200;
const MAX_TOOL_EVENTS = 16;
const SAFE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const APP_VERSION_PATTERN = /^\d+(?:[.-]\d+)*$/;
const PHASES = [
  "route_selector",
  "waylog_qa",
  "trip_draft",
  "itinerary_edit",
] as const;
const MODEL_PROFILES = ["balanced", "quality", "router"] as const;
const FAILURE_KINDS = [
  "app_version_unsupported",
  "configuration_unavailable",
  "model_failure",
  "model_profile_disabled",
  "protocol_unsupported",
  "quota_exceeded",
  "runtime_disabled",
  "schema_failure",
  "skill_disabled",
] as const;
const TOOL_NAMES = [
  "poi.search",
  "route.estimate",
  "weather.get",
  "web.search",
] as const;

/**
 * 遥测出口只从白名单字段重新构造对象；调用方附带的消息、Trip、JWT、
 * thinking、工具 payload 或 URL 都不会被透传。
 */
export function createAgentRuntimeTelemetryEvent(
  input: unknown,
): AgentRuntimeTelemetryEvent {
  const value = isRecord(input) ? input : {};
  const event: AgentRuntimeTelemetryEvent = {};
  copyValidatedString(event, "appVersion", value.appVersion, isAppVersion);
  copyValidatedString(event, "attemptId", value.attemptId, isSafeCode);
  copyValidatedString(event, "conversationId", value.conversationId, isSafeCode);
  copyNumber(event, "durationMs", value.durationMs);
  copyValidatedString(
    event,
    "escalationReason",
    value.escalationReason,
    isSafeCode,
  );
  copyValidatedString(event, "escalatedFrom", value.escalatedFrom, isSafeCode);
  copyValidatedString(event, "failureKind", value.failureKind, (text) =>
    FAILURE_KINDS.includes(text as (typeof FAILURE_KINDS)[number]),
  );
  copyNumber(event, "inputTokens", value.inputTokens);
  copyValidatedString(event, "model", value.model, isSafeCode);
  copyValidatedString(event, "modelProfile", value.modelProfile, (text) =>
    MODEL_PROFILES.includes(text as (typeof MODEL_PROFILES)[number]),
  );
  copyNumber(event, "operationCount", value.operationCount);
  copyNumber(event, "outputTokens", value.outputTokens);
  copyValidatedString(event, "phase", value.phase, (text) =>
    PHASES.includes(text as (typeof PHASES)[number]),
  );
  copyValidatedString(event, "promptVersion", value.promptVersion, isSafeCode);
  copyValidatedString(event, "provider", value.provider, isSafeCode);
  if (value.status === "failed" || value.status === "succeeded") {
    event.status = value.status;
  }
  copyNumber(event, "totalTokens", value.totalTokens);
  copyValidatedString(event, "turnId", value.turnId, isSafeCode);
  copyValidatedString(event, "userId", value.userId, (text) =>
    UUID_PATTERN.test(text),
  );

  const toolEvents = readToolEvents(value.toolEvents);
  if (toolEvents) event.toolEvents = toolEvents;

  return event;
}

export function summarizeAgentProxyActivity(events: unknown[]): {
  operationCount: number;
  toolEvents: Array<{ name: string; status: AgentTelemetryToolStatus }>;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
} {
  const toolEvents: Array<{
    name: string;
    status: AgentTelemetryToolStatus;
  }> = [];
  let operationCount = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;

  for (const event of events) {
    if (!isRecord(event)) continue;

    if (event.type === "toolcall_end" && isRecord(event.toolCall)) {
      const name = readString(event.toolCall.name);
      if (name && !name.startsWith("waylog_")) {
        toolEvents.push({ name, status: "requested" });
      }
      if (
        name === "waylog_trip_edit_proposal" &&
        isRecord(event.toolCall.arguments) &&
        isRecord(event.toolCall.arguments.proposal) &&
        Array.isArray(event.toolCall.arguments.proposal.operations)
      ) {
        operationCount = Math.min(
          event.toolCall.arguments.proposal.operations.length,
          100,
        );
      }
    }

    if (event.type === "done" && isRecord(event.usage)) {
      inputTokens = readNonNegativeNumber(event.usage.input);
      outputTokens = readNonNegativeNumber(event.usage.output);
      totalTokens = readNonNegativeNumber(event.usage.totalTokens);
    }
  }

  return {
    operationCount,
    toolEvents: toolEvents.slice(0, MAX_TOOL_EVENTS),
    usage: { inputTokens, outputTokens, totalTokens },
  };
}

export function summarizeAgentProxyToolResults(
  messages: unknown[],
): Array<{ name: string; status: AgentTelemetryToolStatus }> {
  return messages
    .flatMap((message) => {
      if (!isRecord(message) || message.role !== "toolResult") return [];
      const name = readString(message.toolName);
      if (!name || name.startsWith("waylog_")) return [];
      return [
        {
          name,
          status:
            message.isError === true
              ? ("failed" as const)
              : ("completed" as const),
        },
      ];
    })
    .slice(0, MAX_TOOL_EVENTS);
}

function readToolEvents(
  value: unknown,
): Array<{ name: string; status: AgentTelemetryToolStatus }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value.slice(0, MAX_TOOL_EVENTS).flatMap((item) => {
    if (!isRecord(item)) return [];
    const name = readString(item.name);
    const status = item.status;
    return name &&
      TOOL_NAMES.includes(name as (typeof TOOL_NAMES)[number]) &&
      isToolStatus(status)
      ? [{ name, status }]
      : [];
  });
  return result.length > 0 ? result : undefined;
}

function isToolStatus(value: unknown): value is AgentTelemetryToolStatus {
  return value === "completed" || value === "failed" || value === "requested";
}

function copyValidatedString(
  target: AgentRuntimeTelemetryEvent,
  key: keyof AgentRuntimeTelemetryEvent,
  value: unknown,
  validate: (text: string) => boolean,
) {
  const text = readString(value);
  if (text && validate(text)) Object.assign(target, { [key]: text });
}

function copyNumber(
  target: AgentRuntimeTelemetryEvent,
  key: keyof AgentRuntimeTelemetryEvent,
  value: unknown,
) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    Object.assign(target, { [key]: value });
  }
}

function readString(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text && text.length <= MAX_IDENTIFIER_LENGTH ? text : undefined;
}

function isAppVersion(value: string): boolean {
  return APP_VERSION_PATTERN.test(value);
}

function isSafeCode(value: string): boolean {
  return SAFE_CODE_PATTERN.test(value) && !JWT_PATTERN.test(value);
}

function readNonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
