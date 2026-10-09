import { getAgentLocalStorage } from "./agent-local-storage";
import type { AgentConversationStorage } from "./conversations";
import { isDayCount } from "./day-count-selection";
import {
  parseTripDraftSemantics,
  type TripDraftRequiredField,
  type TripDraftSemantics,
  type TripDraftTurnReference,
} from "./trip-draft-semantics";
import type { TripDraftClarificationResponseContract } from "./trip-draft-skill-result";

const CONTINUATION_KEY_PREFIX = "waylog.agent.trip-draft-continuation.v1.";
const CURRENT_CONTINUATION_KEY_PREFIX =
  "waylog.agent.trip-draft-continuation-current.v1.";
const RESUME_LEASE_DURATION_MS = 2 * 60 * 1_000;

export type TripDraftContinuationStatus =
  | "active"
  | "resuming"
  | "completed"
  | "expired";

export type TripDraftContinuation = {
  accountId: string;
  clarificationId: string;
  conversationId: string;
  expiresAt: string;
  originalInput: string;
  question: string;
  requestedField: TripDraftRequiredField;
  resumeLeaseExpiresAt?: string;
  responseContract: TripDraftClarificationResponseContract;
  semantics: TripDraftSemantics;
  status: TripDraftContinuationStatus;
  turnId: string;
  turnReference: TripDraftTurnReference;
};

export type TripDraftClarificationResponse = {
  clarificationId: string;
  value:
    | { dayCount: number; kind: "day_count" }
    | { destination: string; kind: "destination_text" };
};

export type TripDraftContinuationResult =
  | {
      data: {
        originalInput: string;
        semantics: TripDraftSemantics;
        turnReference: TripDraftTurnReference;
      };
      ok: true;
    }
  | { error: string; ok: false };

export function applyTripDraftClarificationResponse(
  continuation: TripDraftContinuation,
  response: TripDraftClarificationResponse,
  now: string,
): TripDraftContinuationResult {
  if (response.clarificationId !== continuation.clarificationId) {
    return invalid("clarificationId 不匹配。");
  }
  if (continuation.status !== "active") {
    return invalid("该澄清已经提交或失效。");
  }
  if (
    !isValidInstant(now) ||
    !isValidInstant(continuation.expiresAt) ||
    Date.parse(now) >= Date.parse(continuation.expiresAt)
  ) {
    return invalid("该澄清已经过期。");
  }

  const { resolvedDateRange: _derivedDateRange, ...verifiedSemantics } =
    continuation.semantics;
  const candidate = {
    ...verifiedSemantics,
    missingFields: continuation.semantics.missingFields.filter(
      (field) => field !== continuation.requestedField,
    ),
  };

  if (
    continuation.requestedField === "dayCount" &&
    continuation.responseContract.kind === "day_count" &&
    response.value.kind === "day_count" &&
    isDayCount(response.value.dayCount)
  ) {
    candidate.dayCount = response.value.dayCount;
  } else if (
    continuation.requestedField === "destination" &&
    continuation.responseContract.kind === "destination_text" &&
    response.value.kind === "destination_text" &&
    response.value.destination.trim().length >=
      continuation.responseContract.minimumLength &&
    response.value.destination.trim().length <=
      continuation.responseContract.maximumLength
  ) {
    candidate.destination = response.value.destination.trim();
  } else {
    return invalid("澄清回答不符合类型化回答合同。");
  }

  const parsed = parseTripDraftSemantics(candidate, continuation.turnReference);
  if (!parsed.ok) return invalid(parsed.error);

  return {
    data: {
      originalInput: continuation.originalInput,
      semantics: parsed.data,
      turnReference: continuation.turnReference,
    },
    ok: true,
  };
}

export async function saveTripDraftContinuation(
  continuation: TripDraftContinuation,
  storage: AgentConversationStorage,
): Promise<void> {
  await storage.setItem(
    getTripDraftContinuationKey(
      continuation.accountId,
      continuation.clarificationId,
    ),
    JSON.stringify(continuation),
  );
  const currentKey = getCurrentTripDraftContinuationKey(
    continuation.accountId,
    continuation.conversationId,
  );
  if (continuation.status === "active" || continuation.status === "resuming") {
    await storage.setItem(currentKey, continuation.clarificationId);
  } else if (storage.removeItem) {
    await storage.removeItem(currentKey);
  } else {
    await storage.setItem(currentKey, "");
  }
}

export async function getCurrentTripDraftContinuation(
  accountId: string,
  conversationId: string,
  now: string,
  storage: AgentConversationStorage = getAgentLocalStorage(),
): Promise<TripDraftContinuation | undefined> {
  const clarificationId = await storage.getItem(
    getCurrentTripDraftContinuationKey(accountId, conversationId),
  );
  if (!clarificationId) return undefined;
  const continuation = await getTripDraftContinuation(
    accountId,
    clarificationId,
    storage,
  );
  if (!continuation || continuation.conversationId !== conversationId) {
    return undefined;
  }
  if (
    !isValidInstant(now) ||
    Date.parse(now) >= Date.parse(continuation.expiresAt)
  ) {
    await saveTripDraftContinuation(
      { ...continuation, resumeLeaseExpiresAt: undefined, status: "expired" },
      storage,
    );
    return undefined;
  }
  if (
    continuation.status === "resuming" &&
    continuation.resumeLeaseExpiresAt &&
    Date.parse(now) >= Date.parse(continuation.resumeLeaseExpiresAt)
  ) {
    const recovered = {
      ...continuation,
      resumeLeaseExpiresAt: undefined,
      status: "active" as const,
    };
    await saveTripDraftContinuation(recovered, storage);
    return recovered;
  }
  return continuation.status === "active" || continuation.status === "resuming"
    ? continuation
    : undefined;
}

export async function claimTripDraftContinuation(
  continuation: TripDraftContinuation,
  now: string,
  storage: AgentConversationStorage,
): Promise<TripDraftContinuation> {
  if (continuation.status !== "active" || !isValidInstant(now)) {
    throw new Error("该澄清已经提交或失效。");
  }
  const claimed = {
    ...continuation,
    resumeLeaseExpiresAt: new Date(
      Date.parse(now) + RESUME_LEASE_DURATION_MS,
    ).toISOString(),
    status: "resuming" as const,
  };
  await saveTripDraftContinuation(claimed, storage);
  return claimed;
}

export async function releaseTripDraftContinuation(
  continuation: TripDraftContinuation,
  storage: AgentConversationStorage,
): Promise<void> {
  await saveTripDraftContinuation(
    { ...continuation, resumeLeaseExpiresAt: undefined, status: "active" },
    storage,
  );
}

export async function getTripDraftContinuation(
  accountId: string,
  clarificationId: string,
  storage: AgentConversationStorage,
): Promise<TripDraftContinuation | undefined> {
  const raw = await storage.getItem(
    getTripDraftContinuationKey(accountId, clarificationId),
  );
  if (!raw) return undefined;

  try {
    return parseTripDraftContinuation(JSON.parse(raw), accountId);
  } catch {
    return undefined;
  }
}

export async function completeTripDraftContinuation(
  continuation: TripDraftContinuation,
  storage: AgentConversationStorage,
): Promise<void> {
  await saveTripDraftContinuation(
    { ...continuation, resumeLeaseExpiresAt: undefined, status: "completed" },
    storage,
  );
}

function parseTripDraftContinuation(
  value: unknown,
  accountId: string,
): TripDraftContinuation | undefined {
  if (!isRecord(value) || value.accountId !== accountId) return undefined;
  const clarificationId = readString(value.clarificationId);
  const conversationId = readString(value.conversationId);
  const expiresAt = readString(value.expiresAt);
  const originalInput = readString(value.originalInput);
  const question = readString(value.question);
  const turnId = readString(value.turnId);
  const requestedField = value.requestedField;
  const status = value.status;
  const turnReference = value.turnReference;
  if (
    !clarificationId ||
    !conversationId ||
    !expiresAt ||
    !originalInput ||
    !question ||
    !turnId ||
    (requestedField !== "destination" && requestedField !== "dayCount") ||
    (status !== "active" &&
      status !== "resuming" &&
      status !== "completed" &&
      status !== "expired") ||
    !isRecord(turnReference)
  ) {
    return undefined;
  }
  const referenceTime = readString(turnReference.referenceTime);
  const timeZone = readString(turnReference.timeZone);
  if (!referenceTime || !timeZone) return undefined;
  const parsedSemantics = parseTripDraftSemantics(value.semantics, {
    referenceTime,
    timeZone,
  });
  if (!parsedSemantics.ok) return undefined;
  const responseContract = parseResponseContract(
    value.responseContract,
    requestedField,
  );
  if (!responseContract) return undefined;
  const resumeLeaseExpiresAt = readString(value.resumeLeaseExpiresAt);
  if (
    status === "resuming" &&
    (!resumeLeaseExpiresAt || !isValidInstant(resumeLeaseExpiresAt))
  ) {
    return undefined;
  }

  return {
    accountId,
    clarificationId,
    conversationId,
    expiresAt,
    originalInput,
    question,
    requestedField,
    resumeLeaseExpiresAt,
    responseContract,
    semantics: parsedSemantics.data,
    status,
    turnId,
    turnReference: { referenceTime, timeZone },
  };
}

function getCurrentTripDraftContinuationKey(
  accountId: string,
  conversationId: string,
): string {
  return `${CURRENT_CONTINUATION_KEY_PREFIX}${encodeURIComponent(accountId)}.${encodeURIComponent(conversationId)}`;
}

function parseResponseContract(
  value: unknown,
  requestedField: TripDraftRequiredField,
): TripDraftClarificationResponseContract | undefined {
  if (!isRecord(value)) return undefined;
  if (
    requestedField === "dayCount" &&
    value.kind === "day_count" &&
    value.minimum === 1 &&
    value.maximum === 14
  ) {
    return { kind: "day_count", maximum: 14, minimum: 1 };
  }
  if (
    requestedField === "destination" &&
    value.kind === "destination_text" &&
    value.minimumLength === 1 &&
    value.maximumLength === 120
  ) {
    return { kind: "destination_text", maximumLength: 120, minimumLength: 1 };
  }
  return undefined;
}

function getTripDraftContinuationKey(
  accountId: string,
  clarificationId: string,
): string {
  return `${CONTINUATION_KEY_PREFIX}${encodeURIComponent(accountId)}.${encodeURIComponent(clarificationId)}`;
}

function isValidInstant(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(error: string): TripDraftContinuationResult {
  return { error, ok: false };
}
