import assert from "node:assert/strict";
import test from "node:test";
import type { AgentConversationStorage } from "../../../features/agent/conversations";
import {
  applyTripDraftClarificationResponse,
  getCurrentTripDraftContinuation,
  saveTripDraftContinuation,
  type TripDraftContinuation,
} from "../../../features/agent/trip-draft-continuation";

function createContinuation(
  overrides: Partial<TripDraftContinuation> = {},
): TripDraftContinuation {
  return {
    accountId: "account-a",
    clarificationId: "clarification-days-1",
    conversationId: "conversation-a",
    expiresAt: "2026-08-29T09:00:00.000Z",
    originalInput: "帮我规划去苏州的旅行",
    question: "想安排几天？",
    requestedField: "dayCount",
    responseContract: { kind: "day_count", maximum: 14, minimum: 1 },
    semantics: {
      cities: ["苏州"],
      companions: [],
      confidence: 0.9,
      dateExpression: null,
      dateResolution: { kind: "none" },
      destination: "苏州",
      missingFields: ["dayCount"],
      preferences: [],
      resolvedDateRange: null,
      semanticTitle: "苏州之行",
    },
    status: "active",
    turnId: "turn-a",
    turnReference: {
      referenceTime: "2026-08-29T08:00:00.000Z",
      timeZone: "Asia/Shanghai",
    },
    ...overrides,
  };
}

function createMemoryStorage(): AgentConversationStorage {
  const values = new Map<string, string>();
  return {
    getItem: async (key) => values.get(key) ?? null,
    removeItem: async (key) => {
      values.delete(key);
    },
    setItem: async (key, value) => {
      values.set(key, value);
    },
  };
}

test("typed dayCount resumes the paused semantics without creating free text", () => {
  const result = applyTripDraftClarificationResponse(
    createContinuation(),
    {
      clarificationId: "clarification-days-1",
      value: { dayCount: 4, kind: "day_count" },
    },
    "2026-08-29T08:10:00.000Z",
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.originalInput, "帮我规划去苏州的旅行");
  assert.equal(result.data.semantics.dayCount, 4);
  assert.deepEqual(result.data.semantics.missingFields, []);
});

test("continuation rejects mismatched, out-of-range, completed and expired submissions", () => {
  const cases = [
    {
      continuation: createContinuation(),
      input: {
        clarificationId: "wrong-id",
        value: { dayCount: 3 as number, kind: "day_count" as const },
      },
      now: "2026-08-29T08:10:00.000Z",
    },
    {
      continuation: createContinuation(),
      input: {
        clarificationId: "clarification-days-1",
        value: { dayCount: 15 as number, kind: "day_count" as const },
      },
      now: "2026-08-29T08:10:00.000Z",
    },
    {
      continuation: createContinuation({ status: "completed" }),
      input: {
        clarificationId: "clarification-days-1",
        value: { dayCount: 3 as number, kind: "day_count" as const },
      },
      now: "2026-08-29T08:10:00.000Z",
    },
    {
      continuation: createContinuation(),
      input: {
        clarificationId: "clarification-days-1",
        value: { dayCount: 3 as number, kind: "day_count" as const },
      },
      now: "2026-08-29T10:00:00.000Z",
    },
  ];

  for (const fixture of cases) {
    assert.equal(
      applyTripDraftClarificationResponse(
        fixture.continuation,
        fixture.input,
        fixture.now,
      ).ok,
      false,
    );
  }
});

test("typed destination preserves the remaining day-count clarification", () => {
  const result = applyTripDraftClarificationResponse(
    createContinuation({
      requestedField: "destination",
      responseContract: {
        kind: "destination_text",
        maximumLength: 120,
        minimumLength: 1,
      },
      semantics: {
        cities: [],
        companions: [],
        confidence: 0.55,
        dateExpression: null,
        dateResolution: { kind: "none" },
        missingFields: ["destination", "dayCount"],
        preferences: [],
        resolvedDateRange: null,
      },
    }),
    {
      clarificationId: "clarification-days-1",
      value: { destination: "Tokyo", kind: "destination_text" },
    },
    "2026-08-29T08:10:00.000Z",
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.semantics.destination, "Tokyo");
  assert.deepEqual(result.data.semantics.missingFields, ["dayCount"]);
});

test("current continuation survives reload and recovers an expired resume lease", async () => {
  const storage = createMemoryStorage();
  await saveTripDraftContinuation(
    createContinuation({
      resumeLeaseExpiresAt: "2026-08-29T08:05:00.000Z",
      status: "resuming",
    }),
    storage,
  );

  const recovered = await getCurrentTripDraftContinuation(
    "account-a",
    "conversation-a",
    "2026-08-29T08:06:00.000Z",
    storage,
  );

  assert.equal(recovered?.status, "active");
  assert.equal(recovered?.question, "想安排几天？");
  assert.equal(recovered?.resumeLeaseExpiresAt, undefined);
});
