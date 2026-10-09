import { type ReliableAgentTripDraft, parseAgentTripDraft } from "./trip-draft";
import {
  type TripDraftRequiredField,
  type TripDraftSemantics,
  type TripDraftTurnReference,
  parseTripDraftSemantics,
} from "./trip-draft-semantics";

export type TripDraftClarificationResponseContract =
  | { kind: "day_count"; maximum: 14; minimum: 1 }
  | { kind: "destination_text"; maximumLength: 120; minimumLength: 1 };

export type TripDraftClarificationCandidate = {
  question: string;
  requestedField: TripDraftRequiredField;
  responseContract: TripDraftClarificationResponseContract;
};

export type TripDraftSkillTermination =
  | {
      clarification: TripDraftClarificationCandidate;
      kind: "clarification";
      semantics: TripDraftSemantics;
    }
  | {
      draft: ReliableAgentTripDraft;
      kind: "trip_draft";
      semantics: TripDraftSemantics;
    };

export type TripDraftSkillTerminationParseResult =
  | { data: TripDraftSkillTermination; ok: true }
  | { error: string; ok: false };

export function parseTripDraftSkillTermination(
  value: unknown,
  turnReference: TripDraftTurnReference,
): TripDraftSkillTerminationParseResult {
  if (!isRecord(value)) return invalid("Trip Draft 终止结果必须是对象。");

  const semanticsResult = parseTripDraftSemantics(
    value.semantics,
    turnReference,
  );
  if (!semanticsResult.ok) return semanticsResult;

  if (value.kind === "clarification") {
    if (!hasOnlyKeys(value, ["clarification", "kind", "semantics"])) {
      return invalid("TripDraft 与 Clarification 必须互斥。");
    }
    const clarification = parseClarification(value.clarification);
    if (!clarification) return invalid("Clarification 合同无效。");
    if (
      semanticsResult.data.missingFields.length === 0 ||
      !semanticsResult.data.missingFields.includes(clarification.requestedField)
    ) {
      return invalid("Clarification 请求字段与缺失字段不一致。");
    }
    return {
      data: {
        clarification,
        kind: "clarification",
        semantics: semanticsResult.data,
      },
      ok: true,
    };
  }

  if (value.kind !== "trip_draft") {
    return invalid("Trip Draft 终止结果 kind 不受支持。");
  }
  if (!hasOnlyKeys(value, ["draft", "kind", "semantics"])) {
    return invalid("TripDraft 与 Clarification 必须互斥。");
  }
  if (
    semanticsResult.data.missingFields.length > 0 ||
    !semanticsResult.data.destination ||
    !semanticsResult.data.dayCount ||
    !semanticsResult.data.semanticTitle
  ) {
    return invalid("缺少必要行程语义时不能生成 TripDraft。");
  }
  const draft = parseReliableTripDraft(value.draft);
  if (!draft) return invalid("TripDraft 合同无效。");
  if (
    draft.destination !== semanticsResult.data.destination ||
    draft.dayCount !== semanticsResult.data.dayCount ||
    draft.days.length !== semanticsResult.data.dayCount
  ) {
    return invalid("TripDraft 与已验证行程语义不一致。");
  }

  return {
    data: {
      draft: {
        ...draft,
        cities: semanticsResult.data.cities,
        companions: semanticsResult.data.companions,
        confidence: semanticsResult.data.confidence,
        dateExpression: semanticsResult.data.dateExpression,
        endDate: semanticsResult.data.resolvedDateRange?.endDate,
        missingFields: [],
        preferences: semanticsResult.data.preferences,
        resolvedDateRange: semanticsResult.data.resolvedDateRange,
        semanticTitle: semanticsResult.data.semanticTitle,
        startDate: semanticsResult.data.resolvedDateRange?.startDate,
        title: semanticsResult.data.semanticTitle,
      },
      kind: "trip_draft",
      semantics: semanticsResult.data,
    },
    ok: true,
  };
}

function parseReliableTripDraft(value: unknown) {
  if (
    !isRecord(value) ||
    !Array.isArray(value.assumptions) ||
    !value.assumptions.every((item) => typeof item === "string") ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every((item) => typeof item === "string") ||
    typeof value.dayCount !== "number" ||
    !Number.isInteger(value.dayCount) ||
    value.dayCount < 1 ||
    value.dayCount > 14 ||
    !readString(value.destination) ||
    !readString(value.draftId) ||
    !readString(value.title) ||
    !readString(value.createdAt) ||
    !readString(value.updatedAt) ||
    !Array.isArray(value.days) ||
    value.days.length !== value.dayCount ||
    !value.days.every(isReliableDraftDay)
  ) {
    return undefined;
  }
  return parseAgentTripDraft(value);
}

function isReliableDraftDay(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.dayIndex === "number" &&
    Number.isInteger(value.dayIndex) &&
    value.dayIndex >= 1 &&
    value.dayIndex <= 14 &&
    Boolean(readString(value.title)) &&
    Array.isArray(value.items) &&
    value.items.every(
      (item) =>
        isRecord(item) &&
        Boolean(readString(item.title)) &&
        Boolean(readString(item.provider)) &&
        Boolean(readString(item.providerPlaceId)),
    )
  );
}

function parseClarification(
  value: unknown,
): TripDraftClarificationCandidate | undefined {
  if (!isRecord(value)) return undefined;
  const question = readString(value.question);
  const requestedField = value.requestedField;
  const responseContract = value.responseContract;
  if (
    !question ||
    (requestedField !== "destination" && requestedField !== "dayCount") ||
    !isRecord(responseContract)
  ) {
    return undefined;
  }

  if (
    requestedField === "dayCount" &&
    responseContract.kind === "day_count" &&
    responseContract.minimum === 1 &&
    responseContract.maximum === 14
  ) {
    return {
      question,
      requestedField,
      responseContract: { kind: "day_count", maximum: 14, minimum: 1 },
    };
  }
  if (
    requestedField === "destination" &&
    responseContract.kind === "destination_text" &&
    responseContract.minimumLength === 1 &&
    responseContract.maximumLength === 120
  ) {
    return {
      question,
      requestedField,
      responseContract: {
        kind: "destination_text",
        maximumLength: 120,
        minimumLength: 1,
      },
    };
  }
  return undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(error: string): TripDraftSkillTerminationParseResult {
  return { error, ok: false };
}
