import assert from "node:assert/strict";
import test from "node:test";

import {
  type AgentTripDraft,
  type TripCreateApplyDeps,
  applyConfirmedTripCreate,
  createTripCreateRequest,
  setAgentLocalStorageAdapterForTests,
} from "../../../features/agent";
import type { Trip } from "../../../features/trips";

function createVerifiedDraft(
  overrides: Partial<AgentTripDraft> = {},
): AgentTripDraft {
  return {
    assumptions: [],
    createdAt: "2026-08-30T08:00:00.000Z",
    dayCount: 1,
    days: [
      {
        dayIndex: 1,
        items: [
          {
            latitude: 25.0389,
            longitude: 102.7183,
            placeName: "翠湖公园",
            provider: "amap",
            providerPlaceId: "B0FFG9XYZ1",
            title: "翠湖公园",
          },
        ],
        title: "昆明初见",
      },
    ],
    destination: "云南",
    draftId: "draft-yunnan",
    missingFields: [],
    source: "local_v1",
    title: "云南三日漫游",
    updatedAt: "2026-08-30T08:10:00.000Z",
    warnings: [],
    ...overrides,
  };
}

function createStoredTrip(id: string): Trip {
  const now = "2026-08-30T08:11:00.000Z";
  return {
    checklistItems: [],
    createdAt: now,
    currency: "CNY",
    days: [],
    destination: "云南",
    expenses: [],
    id,
    importSources: [],
    lodgings: [],
    memos: [],
    places: [],
    status: "计划中",
    title: "云南三日漫游",
    transports: [],
    updatedAt: now,
  };
}

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: async (key: string) => values.get(key) ?? null,
    removeItem: async (key: string) => {
      values.delete(key);
    },
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

test("confirmed apply persists locally, marks dirty, records a receipt, then schedules sync", async () => {
  const draft = createVerifiedDraft();
  const firstRequest = createTripCreateRequest({
    confirmation: { kind: "explicit_create" },
    conversationId: "conversation-1",
    draft,
    turnId: "turn-1",
  });
  const repeatedRequest = createTripCreateRequest({
    confirmation: { kind: "explicit_create" },
    conversationId: "conversation-1",
    draft,
    turnId: "turn-1",
  });
  const effects: string[] = [];

  assert.equal(firstRequest.ok, true);
  assert.equal(repeatedRequest.ok, true);
  if (!firstRequest.ok || !repeatedRequest.ok) return;
  assert.equal(
    firstRequest.data.createOperationId,
    repeatedRequest.data.createOperationId,
  );
  assert.equal(
    firstRequest.data.draftRevision,
    repeatedRequest.data.draftRevision,
  );
  assert.match(firstRequest.data.draftRevision, /^rev-[a-f0-9]{64}$/);

  const result = await applyConfirmedTripCreate(firstRequest.data, {
    findReceipt: async () => undefined,
    findTripById: async () => null,
    loadDraft: async () => draft,
    markTripDirty: async () => {
      effects.push("dirty");
    },
    persistTripLocally: async (_input, tripId) => {
      effects.push("local");
      assert.equal(tripId, `trip-agent-${firstRequest.data.createOperationId}`);
      return createStoredTrip(tripId);
    },
    recordReceipt: async (receipt) => {
      effects.push("receipt");
      return receipt;
    },
    rollbackLocalTrip: async () => {
      effects.push("rollback");
    },
    scheduleCloudSync: () => {
      effects.push("sync");
    },
  });

  assert.equal(result.status, "applied");
  assert.deepEqual(effects, ["local", "dirty", "receipt", "sync"]);
  if (result.status !== "applied") return;
  assert.equal(
    result.receipt.createOperationId,
    firstRequest.data.createOperationId,
  );
  assert.equal(result.trip.id, result.receipt.tripId);
});

test("TripCreateRequest requires an explicit create event", () => {
  const result = createTripCreateRequest({
    conversationId: "conversation-1",
    draft: createVerifiedDraft(),
    turnId: "turn-1",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "CONFIRMATION_REQUIRED");
});

test("TripCreateRequest rejects draft identifiers that cannot produce a safe stable Trip identity", () => {
  for (const draftId of ["draft:unsafe", `draft-${"x".repeat(80)}`]) {
    const result = createTripCreateRequest({
      confirmation: { kind: "explicit_create" },
      conversationId: "conversation-1",
      draft: createVerifiedDraft({ draftId }),
      turnId: "turn-1",
    });

    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.equal(result.error.code, "INVALID_DRAFT");
  }
});

test("TripCreateRequest rejects malformed day structure instead of normalizing it", () => {
  const result = createTripCreateRequest({
    confirmation: { kind: "explicit_create" },
    conversationId: "conversation-1",
    draft: createVerifiedDraft({ dayCount: 3 }),
    turnId: "turn-1",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "INVALID_DRAFT");
});

test("TripCreateRequest rejects a draft with unresolved or unknown missing fields", () => {
  for (const missingFields of [["dayCount"], ["unknown"]]) {
    const result = createTripCreateRequest({
      confirmation: { kind: "explicit_create" },
      conversationId: "conversation-1",
      draft: {
        ...createVerifiedDraft(),
        missingFields,
      } as unknown as AgentTripDraft,
      turnId: "turn-1",
    });

    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.equal(result.error.code, "INVALID_DRAFT");
  }
});

test("confirmed apply rejects a changed draft and unverified POI before writes", async () => {
  const draft = createVerifiedDraft();
  const request = createTripCreateRequest({
    confirmation: { kind: "explicit_create" },
    conversationId: "conversation-1",
    draft,
    turnId: "turn-1",
  });
  assert.equal(request.ok, true);
  if (!request.ok) return;
  let writes = 0;
  const deps: Omit<TripCreateApplyDeps, "loadDraft"> = {
    findReceipt: async () => undefined,
    findTripById: async () => null,
    markTripDirty: async () => undefined,
    persistTripLocally: async () => {
      writes += 1;
      return createStoredTrip("trip-unexpected");
    },
    recordReceipt: async (receipt) => receipt,
    rollbackLocalTrip: async () => undefined,
    scheduleCloudSync: () => undefined,
  };

  const changedResult = await applyConfirmedTripCreate(request.data, {
    ...deps,
    loadDraft: async () => ({ ...draft, title: "被修改的标题" }),
    recordReceipt: async (receipt) => receipt,
  });
  const unverifiedDraft = createVerifiedDraft({
    days: [
      {
        dayIndex: 1,
        items: [
          {
            provider: "amap",
            title: "不存在的地点",
          },
        ],
        title: "第一天",
      },
    ],
  });
  const unverifiedRequest = createTripCreateRequest({
    confirmation: { kind: "explicit_create" },
    conversationId: "conversation-1",
    draft: unverifiedDraft,
    turnId: "turn-1",
  });
  assert.equal(unverifiedRequest.ok, true);
  if (!unverifiedRequest.ok) return;
  const unverifiedResult = await applyConfirmedTripCreate(
    unverifiedRequest.data,
    {
      ...deps,
      loadDraft: async () => unverifiedDraft,
      recordReceipt: async (receipt) => receipt,
    },
  );

  assert.equal(changedResult.status, "rejected");
  assert.equal(unverifiedResult.status, "rejected");
  assert.equal(writes, 0);
});

test("confirmed apply rejects a missing TripDraft before any write", async () => {
  const draft = createVerifiedDraft();
  const request = createTripCreateRequest({
    confirmation: { kind: "explicit_create" },
    conversationId: "conversation-1",
    draft,
    turnId: "turn-1",
  });
  assert.equal(request.ok, true);
  if (!request.ok) return;

  const result = await applyConfirmedTripCreate(request.data, {
    findReceipt: async () => undefined,
    findTripById: async () => null,
    loadDraft: async () => undefined,
    markTripDirty: async () => {
      throw new Error("must not write");
    },
    persistTripLocally: async () => {
      throw new Error("must not write");
    },
    recordReceipt: async () => {
      throw new Error("must not write");
    },
    rollbackLocalTrip: async () => {
      throw new Error("must not write");
    },
    scheduleCloudSync: () => {
      throw new Error("must not write");
    },
  });

  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") return;
  assert.equal(result.error.code, "DRAFT_NOT_FOUND");
});

test("duplicate confirmation returns the prior receipt without another write", async () => {
  const draft = createVerifiedDraft();
  const request = createTripCreateRequest({
    confirmation: { kind: "explicit_create" },
    conversationId: "conversation-1",
    draft,
    turnId: "turn-1",
  });
  assert.equal(request.ok, true);
  if (!request.ok) return;
  const trip = createStoredTrip("trip-existing");
  const receipt = {
    appliedAt: "2026-08-30T08:11:00.000Z",
    conversationId: request.data.conversationId,
    createOperationId: request.data.createOperationId,
    draftId: request.data.draftId,
    draftRevision: request.data.draftRevision,
    tripId: trip.id,
    turnId: request.data.turnId,
  };

  const result = await applyConfirmedTripCreate(request.data, {
    findReceipt: async () => receipt,
    findTripById: async () => trip,
    loadDraft: async () => {
      throw new Error(
        "duplicate confirmation must not require the deleted draft",
      );
    },
    markTripDirty: async () => {
      throw new Error("must not mark duplicate dirty");
    },
    persistTripLocally: async () => {
      throw new Error("must not create duplicate");
    },
    recordReceipt: async () => {
      throw new Error("must not record duplicate");
    },
    rollbackLocalTrip: async () => {
      throw new Error("must not rollback duplicate");
    },
    scheduleCloudSync: () => {
      throw new Error("must not sync duplicate");
    },
  });

  assert.equal(result.status, "duplicate");
});

test("a receipt whose Trip is missing returns a recoverable failure", async () => {
  const draft = createVerifiedDraft();
  const request = createTripCreateRequest({
    confirmation: { kind: "explicit_create" },
    conversationId: "conversation-1",
    draft,
    turnId: "turn-1",
  });
  assert.equal(request.ok, true);
  if (!request.ok) return;

  const result = await applyConfirmedTripCreate(request.data, {
    findReceipt: async () => ({
      appliedAt: "2026-08-30T08:11:00.000Z",
      conversationId: request.data.conversationId,
      createOperationId: request.data.createOperationId,
      draftId: request.data.draftId,
      draftRevision: request.data.draftRevision,
      tripId: "trip-missing",
      turnId: request.data.turnId,
    }),
    findTripById: async () => null,
    loadDraft: async () => {
      throw new Error("receipt lookup must finish before draft lookup");
    },
    markTripDirty: async () => undefined,
    persistTripLocally: async () => {
      throw new Error("must not recreate a missing receipt target");
    },
    recordReceipt: async (receipt) => receipt,
    rollbackLocalTrip: async () => undefined,
    scheduleCloudSync: () => undefined,
  });

  assert.equal(result.status, "failed");
  if (result.status !== "failed") return;
  assert.equal(result.error.code, "DUPLICATE_RECEIPT_MISSING_TRIP");
});

test("duplicate lookup rejects a tampered create operation identity", async () => {
  const draft = createVerifiedDraft();
  const request = createTripCreateRequest({
    confirmation: { kind: "explicit_create" },
    conversationId: "conversation-1",
    draft,
    turnId: "turn-1",
  });
  assert.equal(request.ok, true);
  if (!request.ok) return;

  const trip = createStoredTrip("trip-existing");
  const result = await applyConfirmedTripCreate(
    { ...request.data, createOperationId: "trip-create:tampered:rev-1" },
    {
      findReceipt: async (createOperationId) => ({
        appliedAt: "2026-08-30T08:11:00.000Z",
        conversationId: request.data.conversationId,
        createOperationId,
        draftId: request.data.draftId,
        draftRevision: request.data.draftRevision,
        tripId: trip.id,
        turnId: request.data.turnId,
      }),
      findTripById: async () => trip,
      loadDraft: async () => draft,
      markTripDirty: async () => undefined,
      persistTripLocally: async () => trip,
      recordReceipt: async (receipt) => receipt,
      rollbackLocalTrip: async () => undefined,
      scheduleCloudSync: () => undefined,
    },
  );

  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") return;
  assert.equal(result.error.code, "DRAFT_CHANGED");
});

test("default receipt storage makes a confirmed create idempotent after its draft is deleted", async () => {
  const draft = createVerifiedDraft();
  const request = createTripCreateRequest({
    confirmation: { kind: "explicit_create" },
    conversationId: "conversation-1",
    draft,
    turnId: "turn-1",
  });
  assert.equal(request.ok, true);
  if (!request.ok) return;

  setAgentLocalStorageAdapterForTests(createMemoryStorage());
  let storedTrip: Trip | null = null;
  let writes = 0;

  try {
    const firstResult = await applyConfirmedTripCreate(request.data, {
      findTripById: async () => storedTrip,
      loadDraft: async () => draft,
      markTripDirty: async () => undefined,
      persistTripLocally: async (_input, tripId) => {
        writes += 1;
        storedTrip = createStoredTrip(tripId);
        return storedTrip;
      },
      rollbackLocalTrip: async () => undefined,
      scheduleCloudSync: () => undefined,
    });
    assert.equal(firstResult.status, "applied");

    const duplicateResult = await applyConfirmedTripCreate(request.data, {
      findTripById: async () => storedTrip,
      loadDraft: async () => {
        throw new Error("the successful create already deleted its draft");
      },
      markTripDirty: async () => undefined,
      persistTripLocally: async () => {
        throw new Error("duplicate confirmation must not create another Trip");
      },
      rollbackLocalTrip: async () => undefined,
      scheduleCloudSync: () => undefined,
    });

    assert.equal(duplicateResult.status, "duplicate");
    assert.equal(writes, 1);
    if (duplicateResult.status !== "duplicate") return;
    assert.equal(duplicateResult.receipt.conversationId, "conversation-1");
    assert.equal(duplicateResult.receipt.turnId, "turn-1");
  } finally {
    setAgentLocalStorageAdapterForTests(null);
  }
});

test("a post-persist failure rolls back the local Trip and never schedules sync", async () => {
  const draft = createVerifiedDraft();
  const request = createTripCreateRequest({
    confirmation: { kind: "explicit_create" },
    conversationId: "conversation-1",
    draft,
    turnId: "turn-1",
  });
  assert.equal(request.ok, true);
  if (!request.ok) return;
  const effects: string[] = [];

  const result = await applyConfirmedTripCreate(request.data, {
    findReceipt: async () => undefined,
    findTripById: async () => null,
    loadDraft: async () => draft,
    markTripDirty: async () => {
      effects.push("dirty");
    },
    persistTripLocally: async (_input, tripId) => {
      effects.push("local");
      return createStoredTrip(tripId);
    },
    recordReceipt: async () => {
      effects.push("receipt-failed");
      throw new Error("receipt unavailable");
    },
    rollbackLocalTrip: async () => {
      effects.push("rollback");
    },
    scheduleCloudSync: () => effects.push("sync"),
  });

  assert.equal(result.status, "failed");
  assert.deepEqual(effects, ["local", "dirty", "receipt-failed", "rollback"]);
});

test("an unowned Trip ID collision never reuses or rolls back the existing Trip", async () => {
  const draft = createVerifiedDraft();
  const request = createTripCreateRequest({
    confirmation: { kind: "explicit_create" },
    conversationId: "conversation-1",
    draft,
    turnId: "turn-1",
  });
  assert.equal(request.ok, true);
  if (!request.ok) return;
  const existingTrip = createStoredTrip(
    `trip-agent-${request.data.createOperationId}`,
  );
  let writes = 0;
  let rollbacks = 0;

  const result = await applyConfirmedTripCreate(request.data, {
    findReceipt: async () => undefined,
    findTripById: async () => existingTrip,
    loadDraft: async () => draft,
    markTripDirty: async () => undefined,
    persistTripLocally: async () => {
      writes += 1;
      return existingTrip;
    },
    recordReceipt: async (receipt) => receipt,
    rollbackLocalTrip: async () => {
      rollbacks += 1;
    },
    scheduleCloudSync: () => undefined,
  });

  assert.equal(result.status, "failed");
  if (result.status !== "failed") return;
  assert.equal(result.error.code, "TRIP_ID_CONFLICT");
  assert.equal(writes, 0);
  assert.equal(rollbacks, 0);
});

test("a failed compensation is surfaced instead of claiming an ordinary write failure", async () => {
  const draft = createVerifiedDraft();
  const request = createTripCreateRequest({
    confirmation: { kind: "explicit_create" },
    conversationId: "conversation-1",
    draft,
    turnId: "turn-1",
  });
  assert.equal(request.ok, true);
  if (!request.ok) return;

  const result = await applyConfirmedTripCreate(request.data, {
    findReceipt: async () => undefined,
    findTripById: async () => null,
    loadDraft: async () => draft,
    markTripDirty: async () => undefined,
    persistTripLocally: async (_input, tripId) => createStoredTrip(tripId),
    recordReceipt: async () => {
      throw new Error("receipt unavailable");
    },
    rollbackLocalTrip: async () => {
      throw new Error("rollback unavailable");
    },
    scheduleCloudSync: () => undefined,
  });

  assert.equal(result.status, "failed");
  if (result.status !== "failed") return;
  assert.equal(result.error.code, "ROLLBACK_FAILED");
  assert.match(result.error.message, /rollback unavailable/);
});

test("a durable pending create resumes after receipt and compensation both fail", async () => {
  const draft = createVerifiedDraft();
  const request = createTripCreateRequest({
    confirmation: { kind: "explicit_create" },
    conversationId: "conversation-1",
    draft,
    turnId: "turn-1",
  });
  assert.equal(request.ok, true);
  if (!request.ok) return;

  const values = new Map<string, string>();
  let rejectReceipt = true;
  setAgentLocalStorageAdapterForTests({
    getItem: async (key) => values.get(key) ?? null,
    removeItem: async (key) => {
      values.delete(key);
    },
    setItem: async (key, value) => {
      if (rejectReceipt && key.includes("trip-create-receipt")) {
        throw new Error("receipt unavailable");
      }
      values.set(key, value);
    },
  });
  let storedTrip: Trip | null = null;
  let writes = 0;

  try {
    const firstResult = await applyConfirmedTripCreate(request.data, {
      findTripById: async () => storedTrip,
      loadDraft: async () => draft,
      markTripDirty: async () => undefined,
      persistTripLocally: async (_input, tripId) => {
        writes += 1;
        storedTrip = createStoredTrip(tripId);
        return storedTrip;
      },
      rollbackLocalTrip: async () => {
        throw new Error("rollback unavailable");
      },
      scheduleCloudSync: () => undefined,
    });
    assert.equal(firstResult.status, "failed");
    if (firstResult.status !== "failed") return;
    assert.equal(firstResult.error.code, "ROLLBACK_FAILED");

    rejectReceipt = false;
    const recoveredResult = await applyConfirmedTripCreate(request.data, {
      findTripById: async () => storedTrip,
      loadDraft: async () => draft,
      markTripDirty: async () => undefined,
      persistTripLocally: async () => {
        writes += 1;
        throw new Error("pending Trip must be resumed, not recreated");
      },
      rollbackLocalTrip: async () => undefined,
      scheduleCloudSync: () => undefined,
    });

    assert.equal(recoveredResult.status, "applied");
    assert.equal(writes, 1);
  } finally {
    setAgentLocalStorageAdapterForTests(null);
  }
});

test("concurrent duplicate confirmations create exactly one local Trip", async () => {
  const draft = createVerifiedDraft();
  const request = createTripCreateRequest({
    confirmation: { kind: "explicit_create" },
    conversationId: "conversation-1",
    draft,
    turnId: "turn-1",
  });
  assert.equal(request.ok, true);
  if (!request.ok) return;

  let storedTrip: Trip | null = null;
  let receipt:
    | Awaited<ReturnType<TripCreateApplyDeps["findReceipt"]>>
    | undefined;
  let writes = 0;
  let releaseWrites: (() => void) | undefined;
  const writesMayFinish = new Promise<void>((resolve) => {
    releaseWrites = resolve;
  });

  const apply = () =>
    applyConfirmedTripCreate(request.data, {
      findReceipt: async () => receipt,
      findTripById: async () => storedTrip,
      loadDraft: async () => draft,
      markTripDirty: async () => undefined,
      persistTripLocally: async (_input, tripId) => {
        writes += 1;
        await writesMayFinish;
        storedTrip ??= createStoredTrip(tripId);
        return storedTrip;
      },
      recordReceipt: async (nextReceipt) => {
        receipt = nextReceipt;
        return nextReceipt;
      },
      rollbackLocalTrip: async () => undefined,
      scheduleCloudSync: () => undefined,
    });

  const resultsPromise = Promise.all([apply(), apply()]);
  releaseWrites?.();
  const results = await resultsPromise;
  assert.deepEqual(results.map((result) => result.status).sort(), [
    "applied",
    "duplicate",
  ]);
  assert.equal(writes, 1);
});
