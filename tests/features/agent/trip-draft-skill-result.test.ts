import assert from "node:assert/strict";
import test from "node:test";

import { parseTripDraftSkillTermination } from "../../../features/agent/trip-draft-skill-result";

const turnReference = {
  referenceTime: "2026-08-29T08:00:00.000Z",
  timeZone: "Asia/Shanghai",
};

test("trip.draft returns a typed day-count clarification when dayCount is missing", () => {
  const result = parseTripDraftSkillTermination(
    {
      clarification: {
        question: "这次想玩几天？",
        requestedField: "dayCount",
        responseContract: { kind: "day_count", maximum: 14, minimum: 1 },
      },
      kind: "clarification",
      semantics: {
        cities: ["苏州"],
        companions: ["父母"],
        confidence: 0.84,
        dateExpression: null,
        dateResolution: { kind: "none" },
        destination: "苏州",
        missingFields: ["dayCount"],
        preferences: ["少走路"],
        semanticTitle: "苏州慢游",
      },
    },
    turnReference,
  );

  assert.equal(result.ok, true);
  if (!result.ok || result.data.kind !== "clarification") return;
  assert.equal(result.data.clarification.requestedField, "dayCount");
  assert.deepEqual(result.data.clarification.responseContract, {
    kind: "day_count",
    maximum: 14,
    minimum: 1,
  });
  assert.deepEqual(result.data.semantics.companions, ["父母"]);
  assert.deepEqual(result.data.semantics.preferences, ["少走路"]);
});

test("trip.draft termination rejects mixed Draft and Clarification payloads", () => {
  const result = parseTripDraftSkillTermination(
    {
      clarification: {
        question: "几天？",
        requestedField: "dayCount",
        responseContract: { kind: "day_count", maximum: 14, minimum: 1 },
      },
      draft: {},
      kind: "clarification",
      semantics: {
        cities: [],
        companions: [],
        confidence: 0.5,
        dateExpression: null,
        dateResolution: { kind: "none" },
        destination: "苏州",
        missingFields: ["dayCount"],
        preferences: [],
      },
    },
    turnReference,
  );

  assert.equal(result.ok, false);
});

test("trip.draft can clarify destination first when both required fields are unresolved", () => {
  const result = parseTripDraftSkillTermination(
    {
      clarification: {
        question: "你想去哪个城市或地区？",
        requestedField: "destination",
        responseContract: {
          kind: "destination_text",
          maximumLength: 120,
          minimumLength: 1,
        },
      },
      kind: "clarification",
      semantics: {
        cities: [],
        companions: [],
        confidence: 0.35,
        dateExpression: null,
        dateResolution: { kind: "none" },
        missingFields: ["destination", "dayCount"],
        preferences: [],
      },
    },
    turnReference,
  );

  assert.equal(result.ok, true);
  if (!result.ok || result.data.kind !== "clarification") return;
  assert.equal(result.data.clarification.requestedField, "destination");
});

test("trip.draft rejects a draft that relies on parser defaults", () => {
  const result = parseTripDraftSkillTermination(
    {
      draft: {
        assumptions: [],
        createdAt: "2026-08-29T08:00:00.000Z",
        days: [{ dayIndex: 1, items: [], title: "第一天" }],
        destination: "杭州",
        draftId: "draft-missing-day-count",
        title: "杭州一日游",
        updatedAt: "2026-08-29T08:00:00.000Z",
        warnings: [],
      },
      kind: "trip_draft",
      semantics: {
        cities: ["杭州"],
        companions: [],
        confidence: 0.9,
        dateExpression: null,
        dateResolution: { kind: "none" },
        dayCount: 1,
        destination: "杭州",
        missingFields: [],
        preferences: [],
        semanticTitle: "杭州一日游",
      },
    },
    turnReference,
  );

  assert.equal(result.ok, false);
});
