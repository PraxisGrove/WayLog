/**
 * @file trip.draft 的模型输入、互斥终止结果与 terminating tool 合同。
 * 这里描述模型可见的形状；最终信任边界仍由运行时解析器逐字段校验。
 */

import {
  parseTripDraftSemantics,
  type TripDraftSemantics,
  type TripDraftTurnReference,
} from "../../trip-draft-semantics";

export type TripDraftSkillInput = {
  kind: "waylog_trip_draft_continuation" | "waylog_trip_draft_request";
  originalInput: string;
  turnReference: TripDraftTurnReference;
  validatedSemantics?: TripDraftSemantics;
};

const semanticsSchema = {
  additionalProperties: false,
  properties: {
    cities: { items: { type: "string" }, type: "array" },
    companions: { items: { type: "string" }, type: "array" },
    confidence: { maximum: 1, minimum: 0, type: "number" },
    dateExpression: { type: ["string", "null"] },
    dateResolution: { type: "object" },
    dayCount: { maximum: 14, minimum: 1, type: ["integer", "null"] },
    destination: { type: ["string", "null"] },
    missingFields: {
      items: { enum: ["destination", "dayCount"], type: "string" },
      type: "array",
    },
    preferences: { items: { type: "string" }, type: "array" },
    semanticTitle: { type: ["string", "null"] },
  },
  required: [
    "cities",
    "companions",
    "confidence",
    "dateExpression",
    "dateResolution",
    "destination",
    "missingFields",
    "preferences",
    "semanticTitle",
  ],
  type: "object",
} as const;

const clarificationSchema = {
  additionalProperties: false,
  properties: {
    clarification: {
      additionalProperties: false,
      properties: {
        question: { maxLength: 500, minLength: 1, type: "string" },
        requestedField: {
          enum: ["destination", "dayCount"],
          type: "string",
        },
        responseContract: { type: "object" },
      },
      required: ["question", "requestedField", "responseContract"],
      type: "object",
    },
    kind: { enum: ["clarification"], type: "string" },
    semantics: semanticsSchema,
  },
  required: ["clarification", "kind", "semantics"],
  type: "object",
} as const;

const draftSchema = {
  additionalProperties: false,
  properties: {
    draft: {
      additionalProperties: true,
      properties: {
        dayCount: { maximum: 14, minimum: 1, type: "integer" },
        days: { maxItems: 14, minItems: 1, type: "array" },
        destination: { minLength: 1, type: "string" },
        draftId: { minLength: 1, type: "string" },
        title: { minLength: 1, type: "string" },
      },
      required: ["dayCount", "days", "destination", "draftId", "title"],
      type: "object",
    },
    kind: { enum: ["trip_draft"], type: "string" },
    semantics: semanticsSchema,
  },
  required: ["draft", "kind", "semantics"],
  type: "object",
} as const;

export const tripDraftSkillInputSchema = {
  additionalProperties: false,
  properties: {
    kind: {
      enum: ["waylog_trip_draft_request", "waylog_trip_draft_continuation"],
      type: "string",
    },
    originalInput: { minLength: 1, type: "string" },
    turnReference: {
      additionalProperties: false,
      properties: {
        referenceTime: { minLength: 1, type: "string" },
        timeZone: { minLength: 1, type: "string" },
      },
      required: ["referenceTime", "timeZone"],
      type: "object",
    },
    validatedSemantics: semanticsSchema,
  },
  required: ["kind", "originalInput", "turnReference"],
  type: "object",
} as const;

export function parseTripDraftSkillInput(
  value: unknown,
): { data: TripDraftSkillInput; ok: true } | { error: string; ok: false } {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "kind",
      "originalInput",
      "turnReference",
      "validatedSemantics",
    ])
  ) {
    return {
      error: "trip.draft 输入必须符合声明的 ContextBuilder 合同。",
      ok: false,
    };
  }
  if (
    value.kind !== "waylog_trip_draft_request" &&
    value.kind !== "waylog_trip_draft_continuation"
  ) {
    return { error: "trip.draft 输入 kind 不受支持。", ok: false };
  }
  const originalInput = readString(value.originalInput);
  if (!originalInput || !isRecord(value.turnReference)) {
    return { error: "trip.draft 缺少原始输入或 turn reference。", ok: false };
  }
  const referenceTime = readString(value.turnReference.referenceTime);
  const timeZone = readString(value.turnReference.timeZone);
  if (
    !referenceTime ||
    !timeZone ||
    !Number.isFinite(Date.parse(referenceTime))
  ) {
    return { error: "trip.draft turn reference 无效。", ok: false };
  }
  const turnReference = { referenceTime, timeZone };
  if (value.kind === "waylog_trip_draft_request") {
    if (value.validatedSemantics !== undefined) {
      return {
        error: "初始 trip.draft 输入不能携带 continuation 语义。",
        ok: false,
      };
    }
    return {
      data: { kind: value.kind, originalInput, turnReference },
      ok: true,
    };
  }
  const semantics = parseTripDraftSemantics(
    value.validatedSemantics,
    turnReference,
  );
  if (!semantics.ok) return semantics;
  return {
    data: {
      kind: value.kind,
      originalInput,
      turnReference,
      validatedSemantics: semantics.data,
    },
    ok: true,
  };
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export const tripDraftSkillOutputSchema = {
  anyOf: [draftSchema, clarificationSchema],
} as const;

export const tripDraftTerminatingToolParameters = {
  additionalProperties: false,
  properties: { result: tripDraftSkillOutputSchema },
  required: ["result"],
  type: "object",
} as const;
