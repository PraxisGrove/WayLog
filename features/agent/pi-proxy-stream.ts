import type { WayLogPiAgentOptions } from "./pi-runtime";

type StreamFn = WayLogPiAgentOptions["streamFn"];
type PiModel = Parameters<StreamFn>[0];
type PiContext = Parameters<StreamFn>[1];
type AssistantMessageEventStream = Awaited<ReturnType<StreamFn>>;
type AssistantMessage = Awaited<
  ReturnType<AssistantMessageEventStream["result"]>
>;
type AssistantMessageEvent =
  AssistantMessageEventStream extends AsyncIterable<infer Event>
    ? Event
    : never;
type Usage = AssistantMessage["usage"];

const PROXY_SCHEMA_VERSION = 1 as const;
const MAX_PROXY_MESSAGES = 24;
const MAX_PROXY_TEXT_LENGTH = 4_000;
const MAX_PROXY_CONTENT_INDEX = 63;
const MAX_PROXY_EVENT_STRING_LENGTH = 16_000;
const MAX_PROXY_TOOL_ARGUMENTS_LENGTH = 16_000;
const PROXY_FAILURE_PREFIX = "__WAYLOG_PROXY_FAILURE__:";
const PI_PROXY_PUBLIC_FAILURE_KINDS = [
  "app_version_unsupported",
  "configuration_unavailable",
  "model_profile_disabled",
  "protocol_unsupported",
  "quota_exceeded",
  "runtime_disabled",
  "skill_disabled",
] as const;

export type PiProxyPublicFailure = {
  kind: (typeof PI_PROXY_PUBLIC_FAILURE_KINDS)[number];
  message: string;
  retryable: boolean;
};

export type PiProxyPhase =
  | "itinerary_edit"
  | "route_selector"
  | "trip_draft"
  | "waylog_qa";

export type PiProxyStreamConfig = {
  accessToken: string;
  anonKey?: string;
  appVersion?: string;
  fetcher?: typeof fetch;
  phase: PiProxyPhase;
  promptVersion: string;
  url: string;
};

type PiProxyEvent =
  | { schemaVersion: 1; type: "start" }
  | {
      contentIndex: number;
      schemaVersion: 1;
      type: "text_start";
    }
  | {
      contentIndex: number;
      delta: string;
      schemaVersion: 1;
      type: "text_delta";
    }
  | {
      contentIndex: number;
      schemaVersion: 1;
      type: "text_end";
    }
  | {
      contentIndex: number;
      id: string;
      schemaVersion: 1;
      toolName: string;
      type: "toolcall_start";
    }
  | {
      contentIndex: number;
      delta: string;
      schemaVersion: 1;
      type: "toolcall_delta";
    }
  | {
      contentIndex: number;
      schemaVersion: 1;
      toolCall: {
        arguments: Record<string, unknown>;
        id: string;
        name: string;
        type: "toolCall";
      };
      type: "toolcall_end";
    }
  | {
      reason: "length" | "stop" | "toolUse";
      schemaVersion: 1;
      type: "done";
      usage: Partial<Usage>;
    }
  | {
      errorMessage?: string;
      reason: "aborted" | "error";
      schemaVersion: 1;
      type: "error";
      usage?: Partial<Usage>;
    };

export function createPiProxyStreamFn(config: PiProxyStreamConfig): StreamFn {
  const accessToken = config.accessToken.trim();
  const promptVersion = config.promptVersion.trim();

  if (!accessToken || !promptVersion || !config.url.trim()) {
    throw new Error("Pi proxy requires accessToken, promptVersion and url.");
  }

  return async (model, context, options) => {
    const { EventStream } = await import("@earendil-works/pi-ai/react-native");
    const stream = new EventStream<AssistantMessageEvent, AssistantMessage>(
      (event) => event.type === "done" || event.type === "error",
      (event) => {
        if (event.type === "done") return event.message;
        if (event.type === "error" && "error" in event) {
          return event.error as AssistantMessage;
        }
        throw new Error("Pi proxy stream ended without a final message.");
      },
    );

    void pumpProxyStream(stream, model, context, config, options?.signal);
    return stream;
  };
}

async function pumpProxyStream(
  stream: {
    end: () => void;
    push: (event: AssistantMessageEvent) => void;
  },
  model: PiModel,
  context: PiContext,
  config: PiProxyStreamConfig,
  signal?: AbortSignal,
): Promise<void> {
  const partial = createEmptyAssistantMessage(model);

  try {
    const response = await (config.fetcher ?? fetch)(config.url, {
      body: JSON.stringify({
        context: createBoundedProxyContext(context),
        modelProfile: model.id,
        phase: config.phase,
        promptVersion: config.promptVersion,
        schemaVersion: PROXY_SCHEMA_VERSION,
      }),
      headers: {
        Accept: "text/event-stream",
        ...(config.anonKey ? { apikey: config.anonKey } : {}),
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
        "X-WayLog-Agent-Protocol-Version": String(PROXY_SCHEMA_VERSION),
        "X-WayLog-App-Version": config.appVersion?.trim() || "0",
      },
      method: "POST",
      signal,
    });

    if (!response.ok) {
      const failure = await readProxyPublicError(response);
      throw new Error(
        failure
          ? `${PROXY_FAILURE_PREFIX}${JSON.stringify(failure)}`
          : `LLM Proxy 请求失败（HTTP ${response.status}）`,
      );
    }

    if (!response.headers.get("content-type")?.includes("text/event-stream")) {
      throw new Error("LLM Proxy 未返回 SSE 响应");
    }

    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error("当前运行环境不支持读取 LLM Proxy SSE");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;
      buffer += decoder
        .decode(value, { stream: true })
        .replaceAll("\r\n", "\n");
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const event = parseProxyFrame(frame);

        if (event) {
          stream.push(applyProxyEvent(event, partial));
        }
      }
    }

    if (buffer.trim()) {
      throw new Error("LLM Proxy SSE 在事件完成前中断");
    }
  } catch (error) {
    const reason = signal?.aborted ? "aborted" : "error";
    partial.stopReason = reason;
    partial.errorMessage =
      error instanceof Error ? error.message : "LLM Proxy 请求中断";
    stream.push({
      error: partial,
      reason,
      type: "error",
    } as AssistantMessageEvent);
  } finally {
    stream.end();
  }
}

async function readProxyPublicError(
  response: Response,
): Promise<PiProxyPublicFailure | undefined> {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return undefined;
  }
  const value: unknown = await response.json().catch(() => undefined);
  if (!isRecord(value) || !isRecord(value.error)) return undefined;
  return parsePublicFailureValue(value.error);
}

export function parsePiProxyPublicFailure(
  value: unknown,
): PiProxyPublicFailure | undefined {
  if (typeof value !== "string" || !value.startsWith(PROXY_FAILURE_PREFIX)) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(
      value.slice(PROXY_FAILURE_PREFIX.length),
    );
    return parsePublicFailureValue(parsed);
  } catch {
    return undefined;
  }
}

function parsePublicFailureValue(
  value: unknown,
): PiProxyPublicFailure | undefined {
  if (!isRecord(value)) return undefined;
  const kind = value.kind;
  const message = typeof value.message === "string" ? value.message.trim() : "";
  if (
    !PI_PROXY_PUBLIC_FAILURE_KINDS.includes(
      kind as PiProxyPublicFailure["kind"],
    ) ||
    !message ||
    message.length > 500 ||
    typeof value.retryable !== "boolean"
  ) {
    return undefined;
  }
  return {
    kind: kind as PiProxyPublicFailure["kind"],
    message,
    retryable: value.retryable,
  };
}

function createBoundedProxyContext(context: PiContext) {
  return {
    messages: context.messages.slice(-MAX_PROXY_MESSAGES).map((message) => {
      if (message.role === "user") {
        return {
          content:
            typeof message.content === "string"
              ? message.content.slice(0, MAX_PROXY_TEXT_LENGTH)
              : message.content
                  .flatMap((item) => (item.type === "text" ? [item.text] : []))
                  .join("\n")
                  .slice(0, MAX_PROXY_TEXT_LENGTH),
          role: "user" as const,
        };
      }

      if (message.role === "toolResult") {
        return {
          content: message.content.flatMap((item) =>
            item.type === "text"
              ? [
                  {
                    text: item.text.slice(0, MAX_PROXY_TEXT_LENGTH),
                    type: "text",
                  },
                ]
              : [],
          ),
          isError: message.isError,
          role: "toolResult" as const,
          toolCallId: message.toolCallId,
          toolName: message.toolName,
        };
      }

      return {
        content: message.content.filter((item) => item.type !== "thinking"),
        role: "assistant" as const,
      };
    }),
    tools: context.tools?.map((tool) => ({
      description: tool.description,
      name: tool.name,
      parameters: tool.parameters,
    })),
  };
}

function parseProxyFrame(frame: string): PiProxyEvent | undefined {
  const data = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");

  if (!data) return undefined;
  const value: unknown = JSON.parse(data);

  if (!isRecord(value) || value.schemaVersion !== PROXY_SCHEMA_VERSION) {
    throw new Error("LLM Proxy 返回了不兼容的事件版本");
  }

  if (
    value.type !== "start" &&
    value.type !== "text_start" &&
    value.type !== "text_delta" &&
    value.type !== "text_end" &&
    value.type !== "toolcall_start" &&
    value.type !== "toolcall_delta" &&
    value.type !== "toolcall_end" &&
    value.type !== "done" &&
    value.type !== "error"
  ) {
    throw new Error(`LLM Proxy 事件类型不受支持：${String(value.type)}`);
  }

  switch (value.type) {
    case "start":
      return { schemaVersion: PROXY_SCHEMA_VERSION, type: "start" };
    case "text_start":
    case "text_end":
      return {
        contentIndex: parseProxyContentIndex(value.contentIndex),
        schemaVersion: PROXY_SCHEMA_VERSION,
        type: value.type,
      };
    case "text_delta":
    case "toolcall_delta":
      return {
        contentIndex: parseProxyContentIndex(value.contentIndex),
        delta: parseProxyString(value.delta, "delta"),
        schemaVersion: PROXY_SCHEMA_VERSION,
        type: value.type,
      };
    case "toolcall_start":
      return {
        contentIndex: parseProxyContentIndex(value.contentIndex),
        id: parseProxyString(value.id, "tool call id"),
        schemaVersion: PROXY_SCHEMA_VERSION,
        toolName: parseProxyString(value.toolName, "tool name"),
        type: "toolcall_start",
      };
    case "toolcall_end":
      return {
        contentIndex: parseProxyContentIndex(value.contentIndex),
        schemaVersion: PROXY_SCHEMA_VERSION,
        toolCall: parseProxyToolCall(value.toolCall),
        type: "toolcall_end",
      };
    case "done":
      if (
        value.reason !== "length" &&
        value.reason !== "stop" &&
        value.reason !== "toolUse"
      ) {
        throw new Error("LLM Proxy done 事件包含无效的 reason");
      }

      return {
        reason: value.reason,
        schemaVersion: PROXY_SCHEMA_VERSION,
        type: "done",
        usage: parseProxyUsage(value.usage),
      };
    case "error":
      if (value.reason !== "aborted" && value.reason !== "error") {
        throw new Error("LLM Proxy error 事件包含无效的 reason");
      }

      return {
        errorMessage:
          value.errorMessage === undefined
            ? undefined
            : parseProxyString(value.errorMessage, "error message"),
        reason: value.reason,
        schemaVersion: PROXY_SCHEMA_VERSION,
        type: "error",
        usage:
          value.usage === undefined ? undefined : parseProxyUsage(value.usage),
      };
  }
}

function parseProxyContentIndex(value: unknown): number {
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_PROXY_CONTENT_INDEX
  ) {
    return value;
  }

  throw new Error("LLM Proxy 事件包含无效的 contentIndex");
}

function parseProxyString(value: unknown, field: string): string {
  if (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_PROXY_EVENT_STRING_LENGTH
  ) {
    return value;
  }

  throw new Error(`LLM Proxy 事件包含无效的 ${field}`);
}

function parseProxyToolCall(
  value: unknown,
): Extract<PiProxyEvent, { type: "toolcall_end" }>["toolCall"] {
  if (
    !isRecord(value) ||
    value.type !== "toolCall" ||
    !isRecord(value.arguments) ||
    JSON.stringify(value.arguments).length > MAX_PROXY_TOOL_ARGUMENTS_LENGTH
  ) {
    throw new Error("LLM Proxy toolcall_end 包含无效的 toolCall");
  }

  return {
    arguments: value.arguments,
    id: parseProxyString(value.id, "tool call id"),
    name: parseProxyString(value.name, "tool name"),
    type: "toolCall",
  };
}

function parseProxyUsage(value: unknown): Partial<Usage> {
  if (!isRecord(value)) {
    throw new Error("LLM Proxy 事件包含无效的 usage");
  }

  const usage: Partial<Usage> = {};

  for (const key of [
    "cacheRead",
    "cacheWrite",
    "input",
    "output",
    "totalTokens",
  ] as const) {
    const fieldValue = value[key];

    if (fieldValue === undefined) continue;
    if (
      typeof fieldValue !== "number" ||
      !Number.isFinite(fieldValue) ||
      fieldValue < 0
    ) {
      throw new Error(`LLM Proxy usage.${key} 必须是有限非负数`);
    }

    usage[key] = fieldValue;
  }

  return usage;
}

function applyProxyEvent(
  event: PiProxyEvent,
  partial: AssistantMessage,
): AssistantMessageEvent {
  switch (event.type) {
    case "start":
      return { partial, type: "start" };
    case "text_start":
      partial.content[event.contentIndex] = { text: "", type: "text" };
      return { contentIndex: event.contentIndex, partial, type: "text_start" };
    case "text_delta": {
      const content = partial.content[event.contentIndex];
      if (content?.type !== "text") {
        throw new Error("LLM Proxy text_delta 缺少 text_start");
      }
      content.text += event.delta;
      return {
        contentIndex: event.contentIndex,
        delta: event.delta,
        partial,
        type: "text_delta",
      };
    }
    case "text_end": {
      const content = partial.content[event.contentIndex];
      if (content?.type !== "text") {
        throw new Error("LLM Proxy text_end 缺少文本内容");
      }
      return {
        content: content.text,
        contentIndex: event.contentIndex,
        partial,
        type: "text_end",
      };
    }
    case "toolcall_start":
      partial.content[event.contentIndex] = {
        arguments: {},
        id: event.id,
        name: event.toolName,
        type: "toolCall",
      };
      return {
        contentIndex: event.contentIndex,
        partial,
        type: "toolcall_start",
      };
    case "toolcall_delta":
      return {
        contentIndex: event.contentIndex,
        delta: event.delta,
        partial,
        type: "toolcall_delta",
      };
    case "toolcall_end":
      partial.content[event.contentIndex] = event.toolCall;
      return {
        contentIndex: event.contentIndex,
        partial,
        toolCall: event.toolCall,
        type: "toolcall_end",
      };
    case "done":
      partial.stopReason = event.reason;
      partial.usage = normalizeUsage(event.usage);
      return { message: partial, reason: event.reason, type: "done" };
    case "error":
      partial.stopReason = event.reason;
      partial.errorMessage = event.errorMessage;
      partial.usage = normalizeUsage(event.usage);
      return {
        error: partial,
        reason: event.reason,
        type: "error",
      } as AssistantMessageEvent;
  }
}

function createEmptyAssistantMessage(model: PiModel): AssistantMessage {
  return {
    api: model.api,
    content: [],
    model: model.id,
    provider: model.provider,
    role: "assistant",
    stopReason: "pending",
    timestamp: Date.now(),
    usage: normalizeUsage(),
  };
}

function normalizeUsage(value: Partial<Usage> = {}): Usage {
  const input = readNonNegativeNumber(value.input);
  const output = readNonNegativeNumber(value.output);
  const cacheRead = readNonNegativeNumber(value.cacheRead);
  const cacheWrite = readNonNegativeNumber(value.cacheWrite);

  return {
    cacheRead,
    cacheWrite,
    cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0 },
    input,
    output,
    totalTokens: readNonNegativeNumber(value.totalTokens) || input + output,
  };
}

function readNonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
