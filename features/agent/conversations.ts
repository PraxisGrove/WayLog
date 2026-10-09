import { getAgentLocalStorage } from "./agent-local-storage";
import type {
  AgentToolAudit,
  AgentToolErrorCode,
  AgentToolId,
  AgentToolResult,
} from "./tools";
import type { AgentTraceEvent } from "./trace";
import type { TripEditProposal } from "./contracts/trip-edit-proposal-contract";
import {
  type AgentFailure,
  createAgentFailure,
  getActiveAgentRuntimeAttempt,
  isAgentFailure,
} from "./runtime-lifecycle";

export const AGENT_CONVERSATION_INDEX_STORAGE_KEY =
  "waylog.agent.conversations.index.v1";
export const AGENT_CONVERSATION_STORAGE_KEY_PREFIX =
  "waylog.agent.conversation.v1.";
export const AGENT_ACCOUNT_CONVERSATION_STORAGE_KEY_PREFIX =
  "waylog.agent.account.v1.";

const MAX_AGENT_CONVERSATIONS = 20;
const MAX_AGENT_CONVERSATION_MESSAGES = 100;
const MAX_AGENT_CONVERSATION_TURNS = 80;
const MAX_AGENT_MESSAGE_TEXT_LENGTH = 2000;
const MAX_AGENT_MESSAGE_PREVIEW_LENGTH = 80;

export type AgentConversationMessageRole = "agent" | "user";

export type AgentConversationScope =
  | {
      type: "global";
    }
  | {
      tripId: string;
      tripTitle?: string;
      type: "trip";
    };

export type AgentConversationScopeInput =
  | AgentConversationScope
  | {
      tripId?: string;
      tripTitle?: string;
      type?: "global" | "trip";
    };

export type AgentConversationUsage = {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
};

export type AgentConversationTiming = {
  amapSearchMs?: number;
  llmMs?: number;
  placeSearchMs?: number;
  poiCacheMs?: number;
  poiCacheWriteMs?: number;
  poiCacheWriteQueued?: number;
  rateLimitMs?: number;
  totalMs?: number;
};

export type AgentConversationAudit = {
  mode?: string;
  model?: string;
  provider?: string;
  timing?: AgentConversationTiming;
  usage?: AgentConversationUsage;
};

export type AgentConversationDebug = {
  errorCode?: string;
  operationIds?: string[];
  proposalId?: string;
  resultType?: string;
  route?: string;
  timing?: AgentConversationTiming;
  turnId?: string;
  usage?: AgentConversationUsage;
};

export type AgentConversationToolResult = AgentToolResult<unknown>;
export type AgentConversationTraceEvent = AgentTraceEvent;

export function createAgentConversationTraceEventKey(
  event: AgentConversationTraceEvent,
  index: number,
): string {
  return `${index}-${event.kind}-${event.status}-${event.label}`;
}

export type AgentConversationOperationReceipt = {
  detail?: string;
  kind: "operation_receipt";
  title: string;
};

export type AgentConversationMessage = {
  attemptId?: string;
  audit?: AgentConversationAudit;
  createdAt: string;
  dedupeKey?: string;
  debug?: AgentConversationDebug;
  id: string;
  operationReceipt?: AgentConversationOperationReceipt;
  role: AgentConversationMessageRole;
  text: string;
  trace?: AgentConversationTraceEvent[];
  toolResults?: AgentConversationToolResult[];
  turnId?: string;
};

export type AgentConversationTurnStatus =
  | "applied"
  | "cancelled"
  | "chat"
  | "failed"
  | "place_selection"
  | "previewed"
  | "running"
  | "interrupted"
  | "requested";

export type AgentConversationAttempt = {
  createdAt: string;
  failure?: AgentFailure;
  id: string;
  status: AgentConversationTurnStatus;
  updatedAt: string;
};

export type AgentConversationRetryContext = {
  hasSelectedTrip?: boolean;
  selectedTripId?: string;
  surface?: "agent_conversation";
  timeZone?: string;
  tripDraftClarification?: {
    clarificationId: string;
    value:
      | { dayCount: number; kind: "day_count" }
      | { destination: string; kind: "destination_text" };
  };
};

export type AgentConversationTurn = {
  attemptId?: string;
  attempts?: AgentConversationAttempt[];
  createdAt: string;
  errorCode?: string;
  failure?: AgentFailure;
  id: string;
  mode?: string;
  model?: string;
  operationIds?: string[];
  proposalId?: string;
  provider?: string;
  reply?: string;
  retryContext?: AgentConversationRetryContext;
  status: AgentConversationTurnStatus;
  timing?: AgentConversationTiming;
  tripId?: string;
  tripTitle?: string;
  usage?: AgentConversationUsage;
  updatedAt: string;
  userMessage: string;
};

export type AgentConversation = {
  accountId?: string;
  createdAt: string;
  id: string;
  messages: AgentConversationMessage[];
  scope: AgentConversationScope;
  title: string;
  turns: AgentConversationTurn[];
  updatedAt: string;
};

export type AgentConversationSummary = {
  createdAt: string;
  id: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  messageCount: number;
  scope: AgentConversationScope;
  title: string;
  updatedAt: string;
};

export type AgentConversationIndex = {
  currentConversationId?: string;
  currentGlobalConversationId?: string;
  currentTripConversationIds?: Record<string, string>;
  summaries: AgentConversationSummary[];
  version: 1;
};

export type AgentConversationStorageRecord = {
  conversation: AgentConversation;
  version: 1;
};

export type AgentConversationStorage = {
  getAllKeys?: () => Promise<readonly string[]>;
  getItem: (key: string) => Promise<string | null>;
  removeItem?: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

export type AgentConversationDeps = {
  accountId?: string;
  clock?: () => string;
  ids?: {
    conversation?: () => string;
    message?: () => string;
    turn?: () => string;
  };
  scope?: AgentConversationScopeInput;
  storage?: AgentConversationStorage;
};

let agentConversationStorageAdapter: AgentConversationStorage | null = null;
const agentConversationMutationQueues = new Map<string, Promise<void>>();

export function setAgentConversationStorageAdapterForTests(
  storage: AgentConversationStorage | null,
): void {
  agentConversationStorageAdapter = storage;
}

export function getAgentConversationIndexStorageKey(
  accountId?: string,
): string {
  const normalizedAccountId = normalizeString(accountId);

  return normalizedAccountId
    ? `${AGENT_ACCOUNT_CONVERSATION_STORAGE_KEY_PREFIX}${encodeURIComponent(normalizedAccountId)}.conversations.index`
    : AGENT_CONVERSATION_INDEX_STORAGE_KEY;
}

export function getAgentConversationStorageKey(
  conversationId: string,
  accountId?: string,
): string {
  const normalizedAccountId = normalizeString(accountId);

  return normalizedAccountId
    ? `${AGENT_ACCOUNT_CONVERSATION_STORAGE_KEY_PREFIX}${encodeURIComponent(normalizedAccountId)}.conversation.${conversationId}`
    : `${AGENT_CONVERSATION_STORAGE_KEY_PREFIX}${conversationId}`;
}

export async function getAgentConversationIndex(
  deps: AgentConversationDeps = {},
): Promise<AgentConversationIndex> {
  const storage = await getAgentConversationStorage(deps);
  const rawValue = await storage.getItem(
    getAgentConversationIndexStorageKey(deps.accountId),
  );

  if (!rawValue) {
    return createEmptyAgentConversationIndex();
  }

  try {
    return normalizeAgentConversationIndex(JSON.parse(rawValue));
  } catch {
    return createEmptyAgentConversationIndex();
  }
}

export async function getCurrentAgentConversation(
  deps: AgentConversationDeps = {},
): Promise<AgentConversation | undefined> {
  const index = await getAgentConversationIndex(deps);
  const scope = normalizeAgentConversationScope(deps.scope);
  const currentConversationId = getCurrentAgentConversationIdForScope(
    index,
    scope,
  );

  if (!currentConversationId) {
    return undefined;
  }

  return getAgentConversation(currentConversationId, deps);
}

export async function getAgentConversation(
  conversationId: string,
  deps: AgentConversationDeps = {},
): Promise<AgentConversation | undefined> {
  const storage = await getAgentConversationStorage(deps);
  const rawValue = await storage.getItem(
    getAgentConversationStorageKey(conversationId, deps.accountId),
  );

  if (!rawValue) {
    return undefined;
  }

  try {
    const record = normalizeAgentConversationStorageRecord(
      JSON.parse(rawValue),
    );
    const accountId = normalizeString(deps.accountId);
    if (accountId && record?.conversation.accountId !== accountId) {
      return undefined;
    }

    return record?.conversation;
  } catch {
    return undefined;
  }
}

export async function listAgentConversationSummaries(
  input: {
    scope?: AgentConversationScopeInput;
  } = {},
  deps: AgentConversationDeps = {},
): Promise<AgentConversationSummary[]> {
  const index = await getAgentConversationIndex(deps);
  const scope = input.scope
    ? normalizeAgentConversationScope(input.scope)
    : undefined;

  return scope
    ? index.summaries.filter((summary) =>
        isSameAgentConversationScope(summary.scope, scope),
      )
    : index.summaries;
}

export async function startNewAgentConversation(
  deps: AgentConversationDeps = {},
): Promise<AgentConversation> {
  const now = getNow(deps);
  const scope = normalizeAgentConversationScope(deps.scope);
  const conversation: AgentConversation = {
    accountId: normalizeString(deps.accountId),
    createdAt: now,
    id: createConversationId(deps),
    messages: [],
    scope,
    title: getDefaultAgentConversationTitle(scope),
    turns: [],
    updatedAt: now,
  };
  const index = await getAgentConversationIndex(deps);
  const nextIndex = createNextAgentConversationIndex(index, conversation);

  await persistAgentConversation(conversation, deps);
  await persistAgentConversationIndex(nextIndex, deps);

  return conversation;
}

export async function appendAgentConversationMessage(
  input: {
    audit?: AgentConversationAudit;
    conversationId?: string;
    debug?: AgentConversationDebug;
    message?: AgentConversationMessage;
    attemptId?: string;
    dedupeKey?: string;
    role?: AgentConversationMessageRole;
    text?: string;
    trace?: AgentConversationTraceEvent[];
    toolResults?: AgentConversationToolResult[];
    turnId?: string;
  },
  deps: AgentConversationDeps = {},
): Promise<{
  conversation: AgentConversation;
  message: AgentConversationMessage;
}> {
  const conversation = await resolveWritableConversation(
    input.conversationId,
    deps,
  );
  const message =
    normalizeAgentConversationMessage(input.message) ??
    createAgentConversationMessage({
      createdAt: getNow(deps),
      id: createMessageId(deps),
      role: input.role,
      text: input.text,
      audit: input.audit,
      attemptId: input.attemptId,
      dedupeKey: input.dedupeKey,
      debug: input.debug,
      trace: input.trace,
      toolResults: input.toolResults,
      turnId: input.turnId,
    });

  if (!message) {
    throw new Error("Agent conversation message requires role and text.");
  }

  return withAgentConversationMutationQueue(
    getAgentConversationMutationKey(conversation.id, deps.accountId),
    async () => {
      const latestConversation =
        (await getAgentConversation(conversation.id, deps)) ?? conversation;
      const duplicate = latestConversation.messages.find(
        (existing) =>
          existing.id === message.id ||
          Boolean(
            message.dedupeKey && existing.dedupeKey === message.dedupeKey,
          ),
      );
      if (duplicate) {
        return { conversation: latestConversation, message: duplicate };
      }
      const nextConversation = normalizeAgentConversation({
        ...latestConversation,
        messages: [...latestConversation.messages, message].slice(
          -MAX_AGENT_CONVERSATION_MESSAGES,
        ),
        title: deriveAgentConversationTitle(latestConversation, message),
        updatedAt: message.createdAt,
      });

      await persistAgentConversationWithIndex(nextConversation, deps);

      return {
        conversation: nextConversation,
        message,
      };
    },
  );
}

export async function renameAgentConversation(
  input: {
    conversationId: string;
    title: string;
  },
  deps: AgentConversationDeps = {},
): Promise<AgentConversation | undefined> {
  const title = normalizeString(input.title);

  if (!title) {
    return undefined;
  }

  return withAgentConversationMutationQueue(
    getAgentConversationMutationKey(input.conversationId, deps.accountId),
    async () => {
      const conversation = await getAgentConversation(
        input.conversationId,
        deps,
      );

      if (!conversation) {
        return undefined;
      }

      const nextConversation = normalizeAgentConversation({
        ...conversation,
        title,
        updatedAt: getNow(deps),
      });
      const index = await getAgentConversationIndex(deps);
      const nextIndex = replaceAgentConversationIndexSummary(
        index,
        createAgentConversationSummary(nextConversation),
      );

      await persistAgentConversation(nextConversation, deps);
      await persistAgentConversationIndex(nextIndex, deps);

      return nextConversation;
    },
  );
}

export async function removeAgentConversation(
  conversationId: string,
  deps: AgentConversationDeps = {},
): Promise<AgentConversation | undefined> {
  return withAgentConversationMutationQueue(
    getAgentConversationMutationKey(conversationId, deps.accountId),
    async () => {
      const conversation = await getAgentConversation(conversationId, deps);
      const index = await getAgentConversationIndex(deps);
      const nextIndex = removeAgentConversationIndexSummary(
        index,
        conversationId,
      );
      const storage = await getAgentConversationStorage(deps);

      await persistAgentConversationIndex(nextIndex, deps);

      if (storage.removeItem) {
        await storage.removeItem(
          getAgentConversationStorageKey(conversationId, deps.accountId),
        );
      } else {
        await storage.setItem(
          getAgentConversationStorageKey(conversationId, deps.accountId),
          "",
        );
      }

      return conversation;
    },
  );
}

export async function recordAgentConversationTurn(
  input: {
    attemptId?: string;
    conversationId?: string;
    errorCode?: string;
    failure?: AgentFailure;
    mode?: string;
    model?: string;
    operationIds?: string[];
    proposal?: TripEditProposal;
    proposalId?: string;
    provider?: string;
    reply?: string;
    retryContext?: AgentConversationRetryContext;
    status: AgentConversationTurnStatus;
    timing?: AgentConversationTiming;
    tripId?: string;
    tripTitle?: string;
    turnId?: string;
    usage?: AgentConversationUsage;
    userMessage: string;
  },
  deps: AgentConversationDeps = {},
): Promise<{ conversation: AgentConversation; turn: AgentConversationTurn }> {
  const conversation = await resolveWritableConversation(
    input.conversationId,
    deps,
  );
  const now = getNow(deps);
  const operationIds =
    input.operationIds ??
    input.proposal?.operations.map((operation) => operation.operationId);
  const turn: AgentConversationTurn = normalizeAgentConversationTurn({
    attemptId: input.attemptId,
    createdAt: now,
    errorCode: input.errorCode ?? input.failure?.code,
    failure: input.failure,
    id: input.turnId ?? createTurnId(deps),
    mode: input.mode,
    model: input.model,
    operationIds,
    proposalId: input.proposalId ?? input.proposal?.proposalId,
    provider: input.provider,
    reply: input.reply,
    retryContext: input.retryContext,
    status: input.status,
    timing: input.timing,
    tripId: input.tripId ?? input.proposal?.tripId,
    tripTitle: input.tripTitle,
    usage: input.usage,
    updatedAt: now,
    userMessage: input.userMessage,
  });
  return withAgentConversationMutationQueue(
    getAgentConversationMutationKey(conversation.id, deps.accountId),
    async () => {
      const latestConversation =
        (await getAgentConversation(conversation.id, deps)) ?? conversation;
      const existingTurn = latestConversation.turns.find(
        (candidate) => candidate.id === turn.id,
      );
      const mergedTurn = mergeAgentConversationTurn(existingTurn, turn);
      const nextConversation = normalizeAgentConversation({
        ...latestConversation,
        turns: [
          ...latestConversation.turns.filter(
            (candidate) => candidate.id !== turn.id,
          ),
          mergedTurn,
        ].slice(-MAX_AGENT_CONVERSATION_TURNS),
        updatedAt: now,
      });

      await persistAgentConversationWithIndex(nextConversation, deps);

      return {
        conversation: nextConversation,
        turn: mergedTurn,
      };
    },
  );
}

export async function recoverInterruptedAgentConversationTurns(
  deps: AgentConversationDeps & { accountId: string },
): Promise<number> {
  const accountId = deps.accountId.trim();
  if (!accountId)
    throw new Error("Agent conversation recovery requires accountId.");
  const index = await getAgentConversationIndex({ ...deps, accountId });
  let recovered = 0;

  for (const summary of index.summaries) {
    await withAgentConversationMutationQueue(
      getAgentConversationMutationKey(summary.id, accountId),
      async () => {
        const conversation = await getAgentConversation(summary.id, {
          ...deps,
          accountId,
        });
        if (!conversation) return;
        const activeAttempt = getActiveAgentRuntimeAttempt();
        const turns = conversation.turns.map((turn) => {
          if (turn.status !== "running" && turn.status !== "requested") {
            return turn;
          }
          if (
            activeAttempt?.accountId === accountId &&
            activeAttempt.conversationId === conversation.id &&
            activeAttempt.turnId === turn.id &&
            activeAttempt.attemptId === turn.attemptId
          ) {
            return turn;
          }
          recovered += 1;
          const attempts = turn.attempts?.map((attempt) =>
            attempt.id === turn.attemptId && attempt.status === "running"
              ? { ...attempt, status: "interrupted" as const }
              : attempt,
          );
          return {
            ...turn,
            attempts,
            status: "interrupted" as const,
          };
        });
        if (turns.every((turn, index) => turn === conversation.turns[index]))
          return;
        await persistAgentConversation(
          normalizeAgentConversation({ ...conversation, turns }),
          { ...deps, accountId },
        );
      },
    );
  }

  return recovered;
}

async function withAgentConversationMutationQueue<T>(
  conversationId: string,
  task: () => Promise<T>,
): Promise<T> {
  const previousTail =
    agentConversationMutationQueues.get(conversationId) ?? Promise.resolve();
  let releaseCurrent!: () => void;
  const currentTail = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const nextTail = previousTail.catch(() => undefined).then(() => currentTail);

  agentConversationMutationQueues.set(conversationId, nextTail);
  await previousTail.catch(() => undefined);

  try {
    return await task();
  } finally {
    releaseCurrent();

    if (agentConversationMutationQueues.get(conversationId) === nextTail) {
      agentConversationMutationQueues.delete(conversationId);
    }
  }
}

function getAgentConversationMutationKey(
  conversationId: string,
  accountId?: string,
): string {
  return `${normalizeString(accountId) ?? "legacy"}:${conversationId}`;
}

async function resolveWritableConversation(
  conversationId: string | undefined,
  deps: AgentConversationDeps,
): Promise<AgentConversation> {
  if (conversationId) {
    const existingConversation = await getAgentConversation(
      conversationId,
      deps,
    );

    if (existingConversation) {
      return existingConversation;
    }
  }

  const currentConversation = await getCurrentAgentConversation(deps);

  if (currentConversation) {
    return currentConversation;
  }

  return startNewAgentConversation(deps);
}

async function persistAgentConversationWithIndex(
  conversation: AgentConversation,
  deps: AgentConversationDeps,
): Promise<void> {
  const index = await getAgentConversationIndex(deps);
  const nextIndex = createNextAgentConversationIndex(index, conversation);

  await persistAgentConversation(conversation, deps);
  await persistAgentConversationIndex(nextIndex, deps);
}

async function persistAgentConversation(
  conversation: AgentConversation,
  deps: AgentConversationDeps,
): Promise<void> {
  const storage = await getAgentConversationStorage(deps);
  const normalizedConversation = normalizeAgentConversation(conversation);
  const accountId = normalizeString(deps.accountId);
  if (accountId && normalizedConversation.accountId !== accountId) {
    throw new Error(
      "Agent conversation account does not match its storage partition.",
    );
  }

  await storage.setItem(
    getAgentConversationStorageKey(normalizedConversation.id, deps.accountId),
    JSON.stringify({
      conversation: normalizedConversation,
      version: 1,
    } satisfies AgentConversationStorageRecord),
  );
}

async function persistAgentConversationIndex(
  index: AgentConversationIndex,
  deps: AgentConversationDeps,
): Promise<void> {
  const storage = await getAgentConversationStorage(deps);

  await storage.setItem(
    getAgentConversationIndexStorageKey(deps.accountId),
    JSON.stringify(normalizeAgentConversationIndex(index)),
  );
}

async function getAgentConversationStorage(
  deps: AgentConversationDeps,
): Promise<AgentConversationStorage> {
  if (deps.storage) {
    return deps.storage;
  }

  if (agentConversationStorageAdapter) {
    return agentConversationStorageAdapter;
  }

  return getAgentLocalStorage();
}

function createEmptyAgentConversationIndex(): AgentConversationIndex {
  return {
    summaries: [],
    version: 1,
  };
}

function createNextAgentConversationIndex(
  index: AgentConversationIndex,
  conversation: AgentConversation,
): AgentConversationIndex {
  const summary = createAgentConversationSummary(conversation);
  const summaries = [
    summary,
    ...index.summaries.filter(
      (item) => item.id !== conversation.id && item.messageCount > 0,
    ),
  ].slice(0, MAX_AGENT_CONVERSATIONS);
  const currentTripConversationIds = {
    ...(index.currentTripConversationIds ?? {}),
  };

  if (conversation.scope.type === "trip") {
    currentTripConversationIds[conversation.scope.tripId] = conversation.id;
  }

  return normalizeAgentConversationIndex({
    currentConversationId: conversation.id,
    currentGlobalConversationId:
      conversation.scope.type === "global"
        ? conversation.id
        : index.currentGlobalConversationId,
    currentTripConversationIds,
    summaries,
    version: 1,
  });
}

function replaceAgentConversationIndexSummary(
  index: AgentConversationIndex,
  summary: AgentConversationSummary,
): AgentConversationIndex {
  return normalizeAgentConversationIndex({
    ...index,
    summaries: [
      summary,
      ...index.summaries.filter((item) => item.id !== summary.id),
    ].slice(0, MAX_AGENT_CONVERSATIONS),
    version: 1,
  });
}

function removeAgentConversationIndexSummary(
  index: AgentConversationIndex,
  conversationId: string,
): AgentConversationIndex {
  return normalizeAgentConversationIndex({
    ...index,
    summaries: index.summaries.filter(
      (summary) => summary.id !== conversationId,
    ),
    version: 1,
  });
}

function createAgentConversationSummary(
  conversation: AgentConversation,
): AgentConversationSummary {
  const lastMessage = conversation.messages.at(-1);

  return {
    createdAt: conversation.createdAt,
    id: conversation.id,
    lastMessageAt: lastMessage?.createdAt,
    lastMessagePreview: lastMessage
      ? createMessagePreview(lastMessage.text)
      : undefined,
    messageCount: conversation.messages.length,
    scope: conversation.scope,
    title: conversation.title,
    updatedAt: conversation.updatedAt,
  };
}

function createAgentConversationMessage(input: {
  attemptId?: string;
  audit?: AgentConversationAudit;
  createdAt: string;
  dedupeKey?: string;
  debug?: AgentConversationDebug;
  id: string;
  operationReceipt?: AgentConversationOperationReceipt;
  role?: AgentConversationMessageRole;
  text?: string;
  trace?: AgentConversationTraceEvent[];
  toolResults?: AgentConversationToolResult[];
  turnId?: string;
}): AgentConversationMessage | undefined {
  const role =
    input.role === "agent" || input.role === "user" ? input.role : undefined;
  const text = normalizeMessageText(input.text);

  if (!role || !text) {
    return undefined;
  }

  return {
    attemptId: normalizeString(input.attemptId),
    audit: normalizeAgentConversationAudit(input.audit),
    createdAt: input.createdAt,
    dedupeKey: normalizeString(input.dedupeKey),
    debug: normalizeAgentConversationDebug(input.debug),
    id: normalizeString(input.id) ?? createFallbackId("agent-message"),
    operationReceipt: normalizeAgentConversationOperationReceipt(
      input.operationReceipt,
    ),
    role,
    text,
    trace: normalizeAgentTraceEvents(input.trace),
    toolResults: normalizeAgentConversationToolResults(input.toolResults),
    turnId: normalizeString(input.turnId),
  };
}

function normalizeAgentConversationStorageRecord(
  value: unknown,
): AgentConversationStorageRecord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const conversation = normalizeAgentConversation(value.conversation);

  if (!conversation.id) {
    return undefined;
  }

  return {
    conversation,
    version: 1,
  };
}

function normalizeAgentConversationIndex(
  value: unknown,
): AgentConversationIndex {
  if (!isRecord(value)) {
    return createEmptyAgentConversationIndex();
  }

  const summaries = Array.isArray(value.summaries)
    ? value.summaries
        .map(normalizeAgentConversationSummary)
        .filter(
          (summary): summary is AgentConversationSummary =>
            summary !== undefined,
        )
    : [];
  const currentConversationId = normalizeString(value.currentConversationId);
  const currentGlobalConversationId = normalizeString(
    value.currentGlobalConversationId,
  );
  const nextSummaries = dedupeAgentConversationSummaries(summaries)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_AGENT_CONVERSATIONS);
  const summaryIds = new Set(nextSummaries.map((summary) => summary.id));
  const currentTripConversationIds = normalizeCurrentTripConversationIds(
    value.currentTripConversationIds,
    nextSummaries,
  );
  const nextIndex: AgentConversationIndex = {
    summaries: nextSummaries,
    version: 1,
  };
  const nextCurrentConversationId =
    currentConversationId && summaryIds.has(currentConversationId)
      ? currentConversationId
      : nextSummaries[0]?.id;
  const nextCurrentGlobalConversationId =
    currentGlobalConversationId &&
    nextSummaries.some(
      (summary) =>
        summary.id === currentGlobalConversationId &&
        summary.scope.type === "global",
    )
      ? currentGlobalConversationId
      : nextSummaries.find((summary) => summary.scope.type === "global")?.id;

  if (nextCurrentConversationId) {
    nextIndex.currentConversationId = nextCurrentConversationId;
  }

  if (nextCurrentGlobalConversationId) {
    nextIndex.currentGlobalConversationId = nextCurrentGlobalConversationId;
  }

  if (Object.keys(currentTripConversationIds).length > 0) {
    nextIndex.currentTripConversationIds = currentTripConversationIds;
  }

  return nextIndex;
}

function normalizeAgentConversation(value: unknown): AgentConversation {
  if (!isRecord(value)) {
    const now = new Date(0).toISOString();

    return {
      createdAt: now,
      id: "",
      messages: [],
      scope: { type: "global" },
      title: "新的旅行助手对话",
      turns: [],
      updatedAt: now,
    };
  }

  const id = normalizeString(value.id) ?? "";
  const messages = Array.isArray(value.messages)
    ? value.messages
        .map(normalizeAgentConversationMessage)
        .filter(
          (message): message is AgentConversationMessage =>
            message !== undefined,
        )
        .slice(-MAX_AGENT_CONVERSATION_MESSAGES)
    : [];
  const turns = Array.isArray(value.turns)
    ? value.turns
        .map(normalizeAgentConversationTurn)
        .filter((turn): turn is AgentConversationTurn => turn !== undefined)
        .slice(-MAX_AGENT_CONVERSATION_TURNS)
    : [];
  const createdAt =
    normalizeString(value.createdAt) ??
    messages[0]?.createdAt ??
    new Date(0).toISOString();
  const updatedAt =
    normalizeString(value.updatedAt) ?? messages.at(-1)?.createdAt ?? createdAt;

  return {
    accountId: normalizeString(value.accountId),
    createdAt,
    id,
    messages,
    scope: normalizeAgentConversationScope(value.scope),
    title: normalizeString(value.title) ?? deriveTitleFromMessages(messages),
    turns,
    updatedAt,
  };
}

function normalizeAgentConversationSummary(
  value: unknown,
): AgentConversationSummary | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = normalizeString(value.id);
  const createdAt = normalizeString(value.createdAt);
  const updatedAt = normalizeString(value.updatedAt);
  const title = normalizeString(value.title);

  if (!id || !createdAt || !updatedAt || !title) {
    return undefined;
  }

  return {
    createdAt,
    id,
    lastMessageAt: normalizeString(value.lastMessageAt),
    lastMessagePreview: normalizeString(value.lastMessagePreview),
    messageCount: readNonNegativeInteger(value.messageCount) ?? 0,
    scope: normalizeAgentConversationScope(value.scope),
    title,
    updatedAt,
  };
}

function normalizeAgentConversationScope(
  value: unknown,
): AgentConversationScope {
  if (!isRecord(value)) {
    return { type: "global" };
  }

  const explicitType =
    value.type === "trip" || value.type === "global" ? value.type : undefined;
  const tripId = normalizeString(value.tripId);

  if (explicitType === "trip" || tripId) {
    if (!tripId) {
      return { type: "global" };
    }

    return {
      tripId,
      tripTitle: normalizeString(value.tripTitle),
      type: "trip",
    };
  }

  return { type: "global" };
}

function getDefaultAgentConversationTitle(
  scope: AgentConversationScope,
): string {
  return scope.type === "trip" && scope.tripTitle
    ? `${scope.tripTitle} 助手对话`
    : "新的旅行助手对话";
}

function getCurrentAgentConversationIdForScope(
  index: AgentConversationIndex,
  scope: AgentConversationScope,
): string | undefined {
  if (scope.type === "trip") {
    return (
      index.currentTripConversationIds?.[scope.tripId] ??
      index.summaries.find((summary) =>
        isSameAgentConversationScope(summary.scope, scope),
      )?.id
    );
  }

  return (
    index.currentGlobalConversationId ??
    index.summaries.find((summary) => summary.scope.type === "global")?.id
  );
}

function isSameAgentConversationScope(
  left: AgentConversationScope,
  right: AgentConversationScope,
): boolean {
  if (left.type !== right.type) {
    return false;
  }

  if (left.type === "global") {
    return true;
  }

  return right.type === "trip" && left.tripId === right.tripId;
}

function normalizeCurrentTripConversationIds(
  value: unknown,
  summaries: AgentConversationSummary[],
): Record<string, string> {
  const nextIds: Record<string, string> = {};
  const summariesById = new Map(
    summaries.map((summary) => [summary.id, summary]),
  );

  if (isRecord(value)) {
    for (const [tripId, conversationId] of Object.entries(value)) {
      const normalizedTripId = normalizeString(tripId);
      const normalizedConversationId = normalizeString(conversationId);
      const summary = normalizedConversationId
        ? summariesById.get(normalizedConversationId)
        : undefined;

      if (
        normalizedTripId &&
        normalizedConversationId &&
        summary?.scope.type === "trip" &&
        summary.scope.tripId === normalizedTripId
      ) {
        nextIds[normalizedTripId] = normalizedConversationId;
      }
    }
  }

  for (const summary of summaries) {
    if (summary.scope.type === "trip" && !nextIds[summary.scope.tripId]) {
      nextIds[summary.scope.tripId] = summary.id;
    }
  }

  return nextIds;
}

function normalizeAgentConversationMessage(
  value: unknown,
): AgentConversationMessage | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return createAgentConversationMessage({
    attemptId: normalizeString(value.attemptId),
    audit: normalizeAgentConversationAudit(value.audit),
    createdAt: normalizeString(value.createdAt) ?? new Date(0).toISOString(),
    dedupeKey: normalizeString(value.dedupeKey),
    debug: normalizeAgentConversationDebug(value.debug),
    id: normalizeString(value.id) ?? createFallbackId("agent-message"),
    operationReceipt: normalizeAgentConversationOperationReceipt(
      value.operationReceipt,
    ),
    role:
      value.role === "agent" || value.role === "user" ? value.role : undefined,
    text: normalizeString(value.text),
    trace: Array.isArray(value.trace) ? value.trace : undefined,
    toolResults: Array.isArray(value.toolResults)
      ? value.toolResults
      : undefined,
    turnId: normalizeString(value.turnId),
  });
}

function normalizeAgentConversationOperationReceipt(
  value: unknown,
): AgentConversationOperationReceipt | undefined {
  if (!isRecord(value) || value.kind !== "operation_receipt") {
    return undefined;
  }

  const title = normalizeString(value.title);
  if (!title) {
    return undefined;
  }

  return {
    detail: normalizeString(value.detail),
    kind: "operation_receipt",
    title,
  };
}

function normalizeAgentConversationTurn(value: unknown): AgentConversationTurn {
  if (!isRecord(value)) {
    const now = new Date(0).toISOString();

    return {
      createdAt: now,
      id: createFallbackId("agent-turn"),
      status: "failed",
      updatedAt: now,
      userMessage: "",
    };
  }

  const createdAt =
    normalizeString(value.createdAt) ?? new Date(0).toISOString();
  const status = readAgentConversationTurnStatus(value.status) ?? "failed";

  return {
    attemptId: normalizeString(value.attemptId),
    attempts: normalizeAgentConversationAttempts(value.attempts),
    createdAt,
    errorCode: normalizeString(value.errorCode),
    failure: readAgentFailure(value.failure),
    id: normalizeString(value.id) ?? createFallbackId("agent-turn"),
    mode: normalizeString(value.mode),
    model: normalizeString(value.model),
    operationIds: normalizeStringArray(value.operationIds),
    proposalId: normalizeString(value.proposalId),
    provider: normalizeString(value.provider),
    reply: normalizeMessageText(value.reply),
    retryContext: normalizeAgentConversationRetryContext(value.retryContext),
    status,
    timing: normalizeAgentConversationTiming(value.timing),
    tripId: normalizeString(value.tripId),
    tripTitle: normalizeString(value.tripTitle),
    usage: normalizeAgentConversationUsage(value.usage),
    updatedAt: normalizeString(value.updatedAt) ?? createdAt,
    userMessage: normalizeMessageText(value.userMessage) ?? "",
  };
}

function readAgentConversationTurnStatus(
  value: unknown,
): AgentConversationTurnStatus | undefined {
  return value === "applied" ||
    value === "cancelled" ||
    value === "chat" ||
    value === "failed" ||
    value === "place_selection" ||
    value === "previewed" ||
    value === "running" ||
    value === "interrupted" ||
    value === "requested"
    ? value
    : undefined;
}

function mergeAgentConversationTurn(
  existing: AgentConversationTurn | undefined,
  next: AgentConversationTurn,
): AgentConversationTurn {
  const attemptId = next.attemptId;
  const attempts = [...(existing?.attempts ?? [])];
  if (attemptId) {
    const attempt: AgentConversationAttempt = {
      createdAt:
        attempts.find((candidate) => candidate.id === attemptId)?.createdAt ??
        next.createdAt,
      failure: next.failure,
      id: attemptId,
      status: next.status,
      updatedAt: next.updatedAt,
    };
    const existingIndex = attempts.findIndex(
      (candidate) => candidate.id === attemptId,
    );
    if (existingIndex >= 0) attempts[existingIndex] = attempt;
    else attempts.push(attempt);
  }

  return normalizeAgentConversationTurn({
    ...existing,
    ...next,
    attempts: attempts.length ? attempts : undefined,
    createdAt: existing?.createdAt ?? next.createdAt,
    retryContext: next.retryContext ?? existing?.retryContext,
    userMessage: existing?.userMessage || next.userMessage,
  });
}

function normalizeAgentConversationAttempts(
  value: unknown,
): AgentConversationAttempt[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const attempts = value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const id = normalizeString(entry.id);
    const createdAt = normalizeString(entry.createdAt);
    const updatedAt = normalizeString(entry.updatedAt);
    const status = readAgentConversationTurnStatus(entry.status);
    if (!id || !createdAt || !updatedAt || !status) return [];
    return [
      {
        createdAt,
        failure: readAgentFailure(entry.failure),
        id,
        status,
        updatedAt,
      },
    ];
  });
  return attempts.length ? attempts : undefined;
}

function normalizeAgentConversationRetryContext(
  value: unknown,
): AgentConversationRetryContext | undefined {
  if (!isRecord(value)) return undefined;
  const context: AgentConversationRetryContext = {
    hasSelectedTrip:
      typeof value.hasSelectedTrip === "boolean"
        ? value.hasSelectedTrip
        : undefined,
    selectedTripId: normalizeString(value.selectedTripId),
    surface: value.surface === "agent_conversation" ? value.surface : undefined,
    timeZone: normalizeString(value.timeZone),
    tripDraftClarification: normalizeTripDraftClarificationRetry(
      value.tripDraftClarification,
    ),
  };
  return hasDefinedValue(context) ? context : undefined;
}

function normalizeTripDraftClarificationRetry(
  value: unknown,
): AgentConversationRetryContext["tripDraftClarification"] {
  if (!isRecord(value) || !isRecord(value.value)) return undefined;
  const clarificationId = normalizeString(value.clarificationId);
  if (!clarificationId) return undefined;
  if (
    value.value.kind === "day_count" &&
    typeof value.value.dayCount === "number" &&
    Number.isInteger(value.value.dayCount) &&
    value.value.dayCount >= 1 &&
    value.value.dayCount <= 14
  ) {
    return {
      clarificationId,
      value: { dayCount: value.value.dayCount, kind: "day_count" },
    };
  }
  const destination = normalizeString(value.value.destination);
  return value.value.kind === "destination_text" && destination
    ? {
        clarificationId,
        value: { destination, kind: "destination_text" },
      }
    : undefined;
}

function readAgentFailure(value: unknown): AgentFailure | undefined {
  if (isAgentFailure(value)) return value;
  if (!isRecord(value) || typeof value.kind !== "string") return undefined;
  try {
    return createAgentFailure(value.kind as AgentFailure["kind"], {
      code: normalizeString(value.code),
      message: normalizeString(value.message),
    });
  } catch {
    return undefined;
  }
}

function deriveAgentConversationTitle(
  conversation: AgentConversation,
  message: AgentConversationMessage,
): string {
  if (conversation.messages.length > 0) {
    return conversation.title;
  }

  if (message.role === "user") {
    return createMessagePreview(message.text, 24);
  }

  return conversation.title;
}

function deriveTitleFromMessages(messages: AgentConversationMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === "user");

  return firstUserMessage
    ? createMessagePreview(firstUserMessage.text, 24)
    : "新的旅行助手对话";
}

function createMessagePreview(
  text: string,
  maxLength = MAX_AGENT_MESSAGE_PREVIEW_LENGTH,
): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}...`
    : normalized;
}

function normalizeMessageText(value: unknown): string | undefined {
  const text = normalizeString(value);

  if (!text) {
    return undefined;
  }

  return text.length > MAX_AGENT_MESSAGE_TEXT_LENGTH
    ? text.slice(0, MAX_AGENT_MESSAGE_TEXT_LENGTH)
    : text;
}

function normalizeAgentConversationAudit(
  value: unknown,
): AgentConversationAudit | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const audit: AgentConversationAudit = {};
  const mode = normalizeString(value.mode);
  const model = normalizeString(value.model);
  const provider = normalizeString(value.provider);
  const timing = normalizeAgentConversationTiming(value.timing);
  const usage = normalizeAgentConversationUsage(value.usage);

  if (mode !== undefined) {
    audit.mode = mode;
  }

  if (model !== undefined) {
    audit.model = model;
  }

  if (provider !== undefined) {
    audit.provider = provider;
  }

  if (timing !== undefined) {
    audit.timing = timing;
  }

  if (usage !== undefined) {
    audit.usage = usage;
  }

  return hasDefinedValue(audit) ? audit : undefined;
}

function normalizeAgentConversationDebug(
  value: unknown,
): AgentConversationDebug | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const debug: AgentConversationDebug = {};
  const errorCode = normalizeString(value.errorCode);
  const operationIds = normalizeStringArray(value.operationIds);
  const proposalId = normalizeString(value.proposalId);
  const resultType = normalizeString(value.resultType);
  const route = normalizeString(value.route);
  const timing = normalizeAgentConversationTiming(value.timing);
  const turnId = normalizeString(value.turnId);
  const usage = normalizeAgentConversationUsage(value.usage);

  if (errorCode !== undefined) {
    debug.errorCode = errorCode;
  }

  if (operationIds !== undefined) {
    debug.operationIds = operationIds;
  }

  if (proposalId !== undefined) {
    debug.proposalId = proposalId;
  }

  if (resultType !== undefined) {
    debug.resultType = resultType;
  }

  if (route !== undefined) {
    debug.route = route;
  }

  if (timing !== undefined) {
    debug.timing = timing;
  }

  if (turnId !== undefined) {
    debug.turnId = turnId;
  }

  if (usage !== undefined) {
    debug.usage = usage;
  }

  return hasDefinedValue(debug) ? debug : undefined;
}

function normalizeAgentConversationUsage(
  value: unknown,
): AgentConversationUsage | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const usage: AgentConversationUsage = {};
  const completionTokens = readNonNegativeInteger(
    value.completionTokens ?? value.completion_tokens,
  );
  const promptTokens = readNonNegativeInteger(
    value.promptTokens ?? value.prompt_tokens,
  );
  const totalTokens = readNonNegativeInteger(
    value.totalTokens ?? value.total_tokens,
  );

  if (completionTokens !== undefined) {
    usage.completionTokens = completionTokens;
  }

  if (promptTokens !== undefined) {
    usage.promptTokens = promptTokens;
  }

  if (totalTokens !== undefined) {
    usage.totalTokens = totalTokens;
  }

  return hasDefinedValue(usage) ? usage : undefined;
}

function normalizeAgentConversationTiming(
  value: unknown,
): AgentConversationTiming | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const timing: AgentConversationTiming = {};
  const timingEntries: [keyof AgentConversationTiming, number | undefined][] = [
    ["amapSearchMs", readNonNegativeNumber(value.amapSearchMs)],
    ["llmMs", readNonNegativeNumber(value.llmMs)],
    ["placeSearchMs", readNonNegativeNumber(value.placeSearchMs)],
    ["poiCacheMs", readNonNegativeNumber(value.poiCacheMs)],
    ["poiCacheWriteMs", readNonNegativeNumber(value.poiCacheWriteMs)],
    ["poiCacheWriteQueued", readNonNegativeNumber(value.poiCacheWriteQueued)],
    ["rateLimitMs", readNonNegativeNumber(value.rateLimitMs)],
    ["totalMs", readNonNegativeNumber(value.totalMs)],
  ];

  for (const [key, entry] of timingEntries) {
    if (entry !== undefined) {
      timing[key] = entry;
    }
  }

  return hasDefinedValue(timing) ? timing : undefined;
}

function normalizeAgentConversationToolResults(
  value: unknown,
): AgentConversationToolResult[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const results = value
    .map(normalizeAgentConversationToolResult)
    .filter(
      (result): result is AgentConversationToolResult => result !== undefined,
    );

  return results.length > 0 ? results : undefined;
}

function normalizeAgentConversationToolResult(
  value: unknown,
): AgentConversationToolResult | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const toolId = readAgentToolId(value.toolId);
  const status =
    value.status === "success" || value.status === "error"
      ? value.status
      : undefined;
  const audit = normalizeAgentToolAudit(value.audit);

  if (!toolId || !status || !audit) {
    return undefined;
  }

  if (status === "success") {
    if (!("data" in value)) {
      return undefined;
    }

    return {
      audit,
      data: value.data,
      status,
      toolId,
    };
  }

  const error = isRecord(value.error) ? value.error : undefined;
  const code = readAgentToolErrorCode(error?.code);
  const message = normalizeString(error?.message);

  if (!code || !message) {
    return undefined;
  }

  return {
    audit,
    error: {
      code,
      message,
    },
    status,
    toolId,
  };
}

function normalizeAgentTraceEvents(
  value: unknown,
): AgentConversationTraceEvent[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const events = value
    .map(normalizeAgentTraceEvent)
    .filter(
      (event): event is AgentConversationTraceEvent => event !== undefined,
    );

  return events.length > 0 ? events : undefined;
}

function normalizeAgentTraceEvent(
  value: unknown,
): AgentConversationTraceEvent | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const kind = readAgentTraceKind(value.kind);
  const label = normalizeString(value.label);
  const status = readAgentTraceStatus(kind, value.status);

  if (!kind || !label || !status) {
    return undefined;
  }

  return {
    detail: normalizeString(value.detail),
    kind,
    label,
    status,
    toolResult:
      kind === "tool"
        ? normalizeAgentConversationToolResult(value.toolResult)
        : undefined,
  } as AgentConversationTraceEvent;
}

function normalizeAgentToolAudit(value: unknown): AgentToolAudit | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const startedAt = normalizeString(value.startedAt);
  const finishedAt = normalizeString(value.finishedAt);

  if (!startedAt || !finishedAt) {
    return undefined;
  }

  return {
    durationMs: readNonNegativeNumber(value.durationMs),
    finishedAt,
    source: normalizeString(value.source),
    startedAt,
  };
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = Array.from(
    new Set(
      value
        .map(normalizeString)
        .filter((item): item is string => Boolean(item)),
    ),
  );

  return values.length > 0 ? values : undefined;
}

function readAgentToolId(value: unknown): AgentToolId | undefined {
  return value === "poi.search" ||
    value === "route.estimate" ||
    value === "web.search" ||
    value === "time.now" ||
    value === "weather.get"
    ? value
    : undefined;
}

function readAgentTraceKind(
  value: unknown,
): AgentConversationTraceEvent["kind"] | undefined {
  if (value === "classifier") {
    return "route_selector";
  }

  return value === "route_selector" ||
    value === "planner" ||
    value === "skill" ||
    value === "tool" ||
    value === "trip_context"
    ? value
    : undefined;
}

function readAgentTraceStatus(
  kind: AgentConversationTraceEvent["kind"] | undefined,
  value: unknown,
): AgentConversationTraceEvent["status"] | undefined {
  if (!kind) {
    return undefined;
  }

  if (kind === "route_selector") {
    return value === "completed" || value === "skipped" ? value : undefined;
  }

  return value === "completed" || value === "warning" ? value : undefined;
}

function readAgentToolErrorCode(
  value: unknown,
): AgentToolErrorCode | undefined {
  return value === "INVALID_TOOL_INPUT" ||
    value === "TOOL_FAILED" ||
    value === "TOOL_NOT_FOUND" ||
    value === "TOOL_UNAVAILABLE"
    ? value
    : undefined;
}

function dedupeAgentConversationSummaries(
  summaries: AgentConversationSummary[],
): AgentConversationSummary[] {
  const byId = new Map<string, AgentConversationSummary>();

  for (const summary of summaries) {
    const existing = byId.get(summary.id);

    if (!existing || summary.updatedAt > existing.updatedAt) {
      byId.set(summary.id, summary);
    }
  }

  return [...byId.values()];
}

function getNow(deps: AgentConversationDeps): string {
  return deps.clock?.() ?? new Date().toISOString();
}

function createConversationId(deps: AgentConversationDeps): string {
  return deps.ids?.conversation?.() ?? createFallbackId("agent-conversation");
}

function createMessageId(deps: AgentConversationDeps): string {
  return deps.ids?.message?.() ?? createFallbackId("agent-message");
}

function createTurnId(deps: AgentConversationDeps): string {
  return deps.ids?.turn?.() ?? createFallbackId("agent-turn");
}

function createFallbackId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readNonNegativeInteger(value: unknown): number | undefined {
  const numberValue = readNumber(value);

  return numberValue !== undefined &&
    Number.isInteger(numberValue) &&
    numberValue >= 0
    ? numberValue
    : undefined;
}

function readNonNegativeNumber(value: unknown): number | undefined {
  const numberValue = readNumber(value);

  return numberValue !== undefined && numberValue >= 0
    ? numberValue
    : undefined;
}

function readNumber(value: unknown): number | undefined {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function hasDefinedValue(value: object): boolean {
  return Object.values(value).some((entry) => entry !== undefined);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
