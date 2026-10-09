export const AGENT_FAILURE_KINDS = [
  "authentication",
  "quota",
  "network",
  "timeout",
  "cancelled",
  "protocol",
  "model",
  "tool",
  "schema",
  "skill_unavailable",
  "runtime_disabled",
  "internal",
] as const;

export type AgentFailureKind = (typeof AGENT_FAILURE_KINDS)[number];

export type AgentFailure = {
  code?: string;
  kind: AgentFailureKind;
  message: string;
  retryable: boolean;
};

type AgentFailurePolicy = Pick<AgentFailure, "message" | "retryable">;

const AGENT_FAILURE_POLICIES: Record<AgentFailureKind, AgentFailurePolicy> = {
  authentication: { message: "登录状态已失效，请重新登录。", retryable: false },
  quota: { message: "今天的旅行助手额度已用完。", retryable: false },
  network: { message: "网络连接失败，原消息已保留，请重试。", retryable: true },
  timeout: { message: "本次处理超时，原消息已保留，请重试。", retryable: true },
  cancelled: { message: "本次处理已取消。", retryable: false },
  protocol: { message: "旅行助手版本暂不兼容，请更新应用。", retryable: false },
  model: {
    message: "模型暂时无法完成请求，原消息已保留，请重试。",
    retryable: true,
  },
  tool: {
    message: "旅行工具暂时不可用，原消息已保留，请重试。",
    retryable: true,
  },
  schema: {
    message: "结果未通过可靠性校验，原消息已保留，请重试。",
    retryable: true,
  },
  skill_unavailable: { message: "这项旅行能力当前不可用。", retryable: false },
  runtime_disabled: { message: "旅行助手当前已停用。", retryable: false },
  internal: {
    message: "旅行助手暂时无法完成请求，原消息已保留，请重试。",
    retryable: true,
  },
};

export function createAgentFailure(
  kind: AgentFailureKind,
  options: { code?: string; message?: string; retryable?: boolean } = {},
): AgentFailure {
  const policy = AGENT_FAILURE_POLICIES[kind];
  return {
    code: normalizeOptionalString(options.code),
    kind,
    message: normalizeOptionalString(options.message) ?? policy.message,
    retryable: options.retryable ?? policy.retryable,
  };
}

export function isAgentFailure(value: unknown): value is AgentFailure {
  if (!isRecord(value) || !isAgentFailureKind(value.kind)) return false;
  return (
    typeof value.retryable === "boolean" &&
    typeof value.message === "string" &&
    value.message.trim().length > 0
  );
}

export class AgentRuntimeFailure extends Error {
  readonly failure: AgentFailure;

  constructor(failure: AgentFailure) {
    super(failure.message);
    this.name = "AgentRuntimeFailure";
    this.failure = failure;
  }
}

export type AgentRuntimeAttemptIdentity = {
  accountId: string;
  attemptId: string;
  conversationId: string;
  turnId: string;
};

export type AgentRuntimeAttemptHandle = {
  complete: () => void;
  identity: AgentRuntimeAttemptIdentity;
  registerAbort: (abort: () => void) => () => void;
  throwIfCancelled: () => void;
};

type ActiveAgentRuntimeAttempt = AgentRuntimeAttemptIdentity & {
  abortHandlers: Set<() => void>;
  cancelled: boolean;
  token: symbol;
};

let activeAttempt: ActiveAgentRuntimeAttempt | undefined;

export function beginAgentRuntimeAttempt(
  identity: AgentRuntimeAttemptIdentity,
): AgentRuntimeAttemptHandle {
  const normalized = normalizeIdentity(identity);
  if (activeAttempt) {
    throw new AgentRuntimeFailure(
      createAgentFailure("internal", {
        code: "ACTIVE_TURN_EXISTS",
        message: "已有回合正在运行，请先取消或等待它完成。",
      }),
    );
  }

  const token = Symbol(normalized.attemptId);
  const attempt: ActiveAgentRuntimeAttempt = {
    ...normalized,
    abortHandlers: new Set(),
    cancelled: false,
    token,
  };
  activeAttempt = attempt;

  return {
    complete: () => {
      if (activeAttempt?.token === token) activeAttempt = undefined;
      attempt.abortHandlers.clear();
    },
    identity: normalized,
    registerAbort: (abort) => {
      if (attempt.cancelled) {
        safelyAbort(abort);
        return () => {};
      }
      attempt.abortHandlers.add(abort);
      return () => attempt.abortHandlers.delete(abort);
    },
    throwIfCancelled: () => {
      if (attempt.cancelled) {
        throw new AgentRuntimeFailure(createAgentFailure("cancelled"));
      }
    },
  };
}

export function getActiveAgentRuntimeAttempt():
  | AgentRuntimeAttemptIdentity
  | undefined {
  if (!activeAttempt) return undefined;
  const { accountId, attemptId, conversationId, turnId } = activeAttempt;
  return { accountId, attemptId, conversationId, turnId };
}

export function cancelActiveAgentTurn(input: {
  accountId: string;
  turnId?: string;
}): boolean {
  const accountId = input.accountId.trim();
  const turnId = input.turnId?.trim();
  if (
    !activeAttempt ||
    activeAttempt.accountId !== accountId ||
    (turnId && activeAttempt.turnId !== turnId)
  ) {
    return false;
  }

  cancelAttempt(activeAttempt);
  return true;
}

export function clearAgentRuntimeForAccount(accountId: string): boolean {
  const normalizedAccountId = accountId.trim();
  if (!activeAttempt || activeAttempt.accountId !== normalizedAccountId) {
    return false;
  }

  const attempt = activeAttempt;
  cancelAttempt(attempt);
  if (activeAttempt?.token === attempt.token) activeAttempt = undefined;
  return true;
}

function cancelAttempt(attempt: ActiveAgentRuntimeAttempt): void {
  if (attempt.cancelled) return;
  attempt.cancelled = true;
  for (const abort of attempt.abortHandlers) safelyAbort(abort);
  attempt.abortHandlers.clear();
}

function safelyAbort(abort: () => void): void {
  try {
    abort();
  } catch {
    // 取消是尽力而为；运行态仍以 cancelled 为准。
  }
}

function normalizeIdentity(
  identity: AgentRuntimeAttemptIdentity,
): AgentRuntimeAttemptIdentity {
  const normalized = {
    accountId: identity.accountId.trim(),
    attemptId: identity.attemptId.trim(),
    conversationId: identity.conversationId.trim(),
    turnId: identity.turnId.trim(),
  };
  if (Object.values(normalized).some((value) => !value)) {
    throw new Error("Agent runtime attempt identity is invalid.");
  }
  return normalized;
}

function isAgentFailureKind(value: unknown): value is AgentFailureKind {
  return (
    typeof value === "string" &&
    (AGENT_FAILURE_KINDS as readonly string[]).includes(value)
  );
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
