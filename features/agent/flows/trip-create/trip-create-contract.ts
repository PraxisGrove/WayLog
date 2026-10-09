import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

import { type AgentTripDraft, parseAgentTripDraft } from "../../trip-draft";

const STABLE_TRIP_DRAFT_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;

export type TripCreateConfirmation = {
  kind: "explicit_create";
};

export type TripCreateRequest = {
  confirmation: TripCreateConfirmation;
  conversationId: string;
  createOperationId: string;
  draft: AgentTripDraft;
  draftId: string;
  draftRevision: string;
  kind: "trip_create_request";
  turnId: string;
};

export type TripCreateRequestError = {
  code: "CONFIRMATION_REQUIRED" | "INVALID_DRAFT";
  message: string;
};

export type TripCreateRequestResult =
  | { data: TripCreateRequest; ok: true }
  | { error: TripCreateRequestError; ok: false };

export function createTripCreateRequest(input: {
  confirmation?: TripCreateConfirmation;
  conversationId: string;
  draft: AgentTripDraft;
  turnId: string;
}): TripCreateRequestResult {
  if (input.confirmation?.kind !== "explicit_create") {
    return {
      error: {
        code: "CONFIRMATION_REQUIRED",
        message: "创建新行程必须由用户明确点击创建按钮确认。",
      },
      ok: false,
    };
  }

  const draft = parseConfirmedTripDraftSnapshot(input.draft);
  if (!draft) {
    return {
      error: {
        code: "INVALID_DRAFT",
        message: "TripDraft 不符合运行时契约。",
      },
      ok: false,
    };
  }
  const draftRevision = getTripDraftRevision(draft);
  const draftId = draft.draftId.trim();
  if (
    !isStableTripDraftId(draftId) ||
    !input.conversationId.trim() ||
    !input.turnId.trim()
  ) {
    return {
      error: {
        code: "INVALID_DRAFT",
        message: "TripCreateRequest 缺少稳定的草案或回合标识。",
      },
      ok: false,
    };
  }

  return {
    data: {
      confirmation: input.confirmation,
      conversationId: input.conversationId.trim(),
      createOperationId: getTripCreateOperationId(draftId, draftRevision),
      draft,
      draftId,
      draftRevision,
      kind: "trip_create_request",
      turnId: input.turnId.trim(),
    },
    ok: true,
  };
}

export function isStableTripDraftId(value: string): boolean {
  return STABLE_TRIP_DRAFT_ID_PATTERN.test(value);
}

export function getTripCreateOperationId(
  draftId: string,
  draftRevision: string,
): string {
  return `trip-create:${draftId}:${draftRevision}`;
}

export function parseConfirmedTripDraftSnapshot(
  value: unknown,
): AgentTripDraft | undefined {
  if (!isRecord(value)) return undefined;
  if (
    value.missingFields !== undefined &&
    (!Array.isArray(value.missingFields) || value.missingFields.length > 0)
  ) {
    return undefined;
  }

  const dayCount = value.dayCount;
  const days = value.days;
  if (
    !Number.isInteger(dayCount) ||
    (dayCount as number) < 1 ||
    (dayCount as number) > 14 ||
    !Array.isArray(days) ||
    days.length !== dayCount
  ) {
    return undefined;
  }

  const hasInvalidDay = days.some((day, dayIndex) => {
    if (!isRecord(day) || day.dayIndex !== dayIndex + 1) return true;
    if (!Array.isArray(day.items)) return true;

    return day.items.some(
      (item) =>
        !isRecord(item) || typeof item.title !== "string" || !item.title.trim(),
    );
  });
  if (hasInvalidDay) return undefined;

  const draft = parseAgentTripDraft(value);
  if (!draft || !isStableTripDraftId(draft.draftId)) return undefined;

  return draft;
}

export function getTripDraftRevision(draft: AgentTripDraft): string {
  const serialized = stableSerialize(draft);
  return `rev-${bytesToHex(sha256(utf8ToBytes(serialized)))}`;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
