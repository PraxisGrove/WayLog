export type AgentToolId =
  | "poi.search"
  | "route.estimate"
  | "time.now"
  | "weather.get"
  | "web.search";

export type AgentToolRisk = "high" | "low" | "medium";

export type AgentToolStatus = "error" | "success";

export type AgentToolAudit = {
  durationMs?: number;
  finishedAt: string;
  source?: string;
  startedAt: string;
};

export type AgentToolSuccess<TData> = {
  audit: AgentToolAudit;
  data: TData;
  status: "success";
  toolId: AgentToolId;
};

export type AgentToolErrorCode =
  | "INVALID_TOOL_INPUT"
  | "TOOL_FAILED"
  | "TOOL_NOT_FOUND"
  | "TOOL_UNAVAILABLE";

export type AgentToolFailure = {
  audit: AgentToolAudit;
  error: {
    code: AgentToolErrorCode;
    message: string;
  };
  status: "error";
  toolId: AgentToolId;
};

export type AgentToolResult<TData> = AgentToolSuccess<TData> | AgentToolFailure;

export type AgentToolRunContext<TDeps = unknown> = {
  clock?: () => Date;
  deps?: TDeps;
  locale?: string;
  timeZone?: string;
};

export type AgentToolDefinition<
  TInput = unknown,
  TData = unknown,
  TDeps = unknown,
> = {
  description: string;
  id: AgentToolId;
  inputSchema: Record<string, unknown>;
  readOnly: boolean;
  risk: AgentToolRisk;
  run: (
    input: TInput,
    context?: AgentToolRunContext<TDeps>,
  ) => Promise<AgentToolResult<TData>> | AgentToolResult<TData>;
};

export function createAgentToolSuccess<TData>(
  toolId: AgentToolId,
  data: TData,
  audit: AgentToolAudit,
): AgentToolSuccess<TData> {
  return {
    audit,
    data,
    status: "success",
    toolId,
  };
}

export function createAgentToolFailure(
  toolId: AgentToolId,
  code: AgentToolErrorCode,
  message: string,
  audit: AgentToolAudit,
): AgentToolFailure {
  return {
    audit,
    error: {
      code,
      message,
    },
    status: "error",
    toolId,
  };
}

export function createAgentToolAudit(
  startedAt: Date,
  finishedAt: Date,
  source?: string,
): AgentToolAudit {
  return {
    durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    finishedAt: finishedAt.toISOString(),
    source,
    startedAt: startedAt.toISOString(),
  };
}

export function getAgentToolClock(context?: AgentToolRunContext): () => Date {
  return context?.clock ?? (() => new Date());
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
