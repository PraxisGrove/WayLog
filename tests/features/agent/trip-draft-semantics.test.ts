import assert from "node:assert/strict";
import test from "node:test";

import { parseTripDraftSemantics } from "../../../features/agent/trip-draft-semantics";
import {
  canSubmitDayCountSelection,
  createDayCountSelection,
  selectDayCount,
} from "../../../features/agent/day-count-selection";

test("trip.draft resolves 下周 from the immutable turn reference", () => {
  const result = parseTripDraftSemantics(
    {
      cities: ["昆明", "大理"],
      companions: [],
      confidence: 0.96,
      dateExpression: "下周",
      dateResolution: { kind: "next_week" },
      dayCount: 3,
      destination: "云南",
      missingFields: [],
      preferences: ["轻松节奏"],
      semanticTitle: "云南风光三日行",
    },
    {
      referenceTime: "2026-08-29T08:00:00.000Z",
      timeZone: "Asia/Shanghai",
    },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.destination, "云南");
  assert.equal(result.data.dayCount, 3);
  assert.equal(result.data.dateExpression, "下周");
  assert.deepEqual(result.data.resolvedDateRange, {
    endDate: "2026-09-02",
    startDate: "2026-08-31",
  });
  assert.equal(result.data.semanticTitle, "云南风光三日行");
});

test("trip.draft rejects missing required semantics instead of defaulting them", () => {
  const result = parseTripDraftSemantics(
    {
      cities: [],
      companions: ["父母"],
      confidence: 0.72,
      dateExpression: null,
      dateResolution: { kind: "none" },
      destination: "苏州",
      missingFields: [],
      preferences: ["适合长辈", "少走路"],
      semanticTitle: "苏州慢游",
    },
    {
      referenceTime: "2026-08-29T08:00:00.000Z",
      timeZone: "Asia/Shanghai",
    },
  );

  assert.equal(result.ok, false);
});

test("trip.draft preserves English destination, implicit companions and preferences", () => {
  const result = parseTripDraftSemantics(
    {
      cities: ["Tokyo"],
      companions: ["parents"],
      confidence: 0.94,
      dateExpression: "tomorrow",
      dateResolution: { kind: "tomorrow" },
      dayCount: 4,
      destination: "Tokyo",
      missingFields: [],
      preferences: ["food", "easy walking"],
      semanticTitle: "Tokyo Family Food Escape",
    },
    {
      referenceTime: "2026-08-29T16:30:00.000Z",
      timeZone: "Asia/Shanghai",
    },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data.companions, ["parents"]);
  assert.deepEqual(result.data.preferences, ["food", "easy walking"]);
  assert.deepEqual(result.data.resolvedDateRange, {
    endDate: "2026-09-03",
    startDate: "2026-08-31",
  });
});

test("trip.draft accepts explicit missing destination and dayCount without inventing either", () => {
  const result = parseTripDraftSemantics(
    {
      cities: [],
      companions: [],
      confidence: 0.4,
      dateExpression: null,
      dateResolution: { kind: "none" },
      missingFields: ["destination", "dayCount"],
      preferences: [],
    },
    {
      referenceTime: "2026-08-29T08:00:00.000Z",
      timeZone: "Asia/Shanghai",
    },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.destination, undefined);
  assert.equal(result.data.dayCount, undefined);
  assert.equal(result.data.semanticTitle, undefined);
});

test("TripDraft semantic title rejects a captured date-destination phrase and uses only verified fallback fields", () => {
  const result = parseTripDraftSemantics(
    {
      cities: [],
      companions: [],
      confidence: 0.95,
      dateExpression: "下周",
      dateResolution: { kind: "next_week" },
      dayCount: 3,
      destination: "云南",
      missingFields: [],
      preferences: [],
      semanticTitle: "下周去云南三日游",
    },
    {
      referenceTime: "2026-08-29T08:00:00.000Z",
      timeZone: "Asia/Shanghai",
    },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.semanticTitle, "云南3日游");
});

test("day-count selection has no confirmed default and accepts only an interacted 1-14 value", () => {
  const initial = createDayCountSelection(7);
  assert.equal(initial.focusedDay, 7);
  assert.equal(initial.selectedDay, undefined);
  assert.equal(canSubmitDayCountSelection(initial), false);

  const selected = selectDayCount(initial, 14);
  assert.equal(selected.selectedDay, 14);
  assert.equal(canSubmitDayCountSelection(selected), true);
  assert.throws(() => selectDayCount(initial, 15), /1.*14/);
});
