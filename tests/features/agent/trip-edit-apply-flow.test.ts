import assert from "node:assert/strict";
import test from "node:test";
import AsyncStorageModule from "@react-native-async-storage/async-storage";

import {
  applyTripEditProposal,
  clearAppliedAgentProposalLedger,
  createAgentProposalPreview,
  createTripEditApprovalPolicy,
  getAppliedAgentOperationIds,
  setAgentLocalStorageAdapterForTests,
  type TripEditApplyReceipt,
  type TripEditProposal,
  validateTripEditProposal,
} from "../../../features/agent";
import {
  getTripById,
  saveTrips,
  updateTrip,
} from "../../../features/trips/storage";
import type { Trip } from "../../../features/trips/types";

const AsyncStorage =
  (AsyncStorageModule as { default?: typeof AsyncStorageModule }).default ??
  AsyncStorageModule;

function installWindowLocalStorage() {
  const globalWithWindow = globalThis as { window?: unknown };
  const originalWindow = globalWithWindow.window;
  const store = new Map<string, string>();
  globalWithWindow.window = {
    localStorage: {
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      removeItem: (key: string) => store.delete(key),
      setItem: (key: string, value: string) => store.set(key, value),
    },
  };
  return () => {
    if (originalWindow === undefined) delete globalWithWindow.window;
    else globalWithWindow.window = originalWindow;
  };
}

function createTrip(): Trip {
  return {
    checklistItems: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    currency: "CNY",
    days: [{ dayIndex: 1, id: "day-1", items: [], title: "第一天" }],
    destination: "杭州",
    expenses: [],
    id: "trip-hangzhou",
    importSources: [],
    lodgings: [],
    memos: [],
    places: [],
    status: "计划中",
    title: "杭州周末",
    transports: [],
    updatedAt: "2026-08-01T10:00:00.000Z",
  };
}

function createProposal(trip: Trip): TripEditProposal {
  return {
    expectedUpdatedAt: trip.updatedAt,
    operations: [
      {
        dayId: "day-1",
        metadata: {
          placeResolution: {
            address: "浙江省杭州市西湖区法云弄1号",
            confidence: "high",
            provider: "amap",
            providerPlaceId: "B0LINGYIN001",
            source: "amap",
          },
        },
        operationId: "operation-add-lingyin",
        place: {
          address: "浙江省杭州市西湖区法云弄1号",
          category: "景点",
          latitude: 30.2401,
          longitude: 120.1025,
          name: "灵隐寺",
          provider: "amap",
          providerPlaceId: "B0LINGYIN001",
        },
        tripId: trip.id,
        type: "add_place_to_day",
      },
    ],
    proposalId: "proposal-add-lingyin",
    summary: "把灵隐寺加入第一天",
    tripId: trip.id,
  };
}

function createPopulatedTrip(): Trip {
  return {
    ...createTrip(),
    days: [
      {
        dayIndex: 1,
        id: "day-1",
        items: [
          {
            id: "item-west-lake",
            placeName: "西湖",
            time: "09:00",
            title: "游览西湖",
          },
        ],
        title: "第一天",
      },
      { dayIndex: 2, id: "day-2", items: [], title: "第二天" },
    ],
  };
}

test("TripEditProposal without confirmation performs zero Trip writes", async () => {
  const trip = createTrip();
  let dirtyWrites = 0;
  let receiptWrites = 0;
  let tripWrites = 0;
  const result = await applyTripEditProposal(
    {
      conversationId: "conversation-1",
      proposal: createProposal(trip),
      turnId: "turn-1",
    },
    {
      findAppliedOperationIds: async () => new Set(),
      loadTrip: async () => trip,
      markTripDirty: async () => {
        dirtyWrites += 1;
      },
      persistTripLocally: async (nextTrip) => {
        tripWrites += 1;
        return nextTrip;
      },
      recordReceipt: async () => {
        receiptWrites += 1;
      },
      rollbackLocalMutation: async () => undefined,
      scheduleCloudSync: () => undefined,
    },
  );

  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") return;
  assert.equal(result.error.code, "APPROVAL_REQUIRED");
  assert.equal(tripWrites, 0);
  assert.equal(dirtyWrites, 0);
  assert.equal(receiptWrites, 0);
});

test("explicit confirmation applies a verified place atomically before scheduling cloud sync", async () => {
  const trip = createTrip();
  const originalTrip = structuredClone(trip);
  const steps: string[] = [];
  const result = await applyTripEditProposal(
    {
      authorization: { kind: "explicit_confirmation" },
      conversationId: "conversation-1",
      proposal: createProposal(trip),
      turnId: "turn-1",
    },
    {
      clock: () => "2026-08-01T11:00:00.000Z",
      findAppliedOperationIds: async () => new Set(),
      idGen: () => "item-lingyin",
      loadTrip: async () => trip,
      markTripDirty: async () => {
        steps.push("dirty");
      },
      persistTripLocally: async (nextTrip) => {
        steps.push("persist");
        return nextTrip;
      },
      recordReceipt: async () => {
        steps.push("receipt");
      },
      rollbackLocalMutation: async () => {
        steps.push("rollback");
      },
      scheduleCloudSync: () => {
        steps.push("sync");
      },
    },
  );

  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert.deepEqual(trip, originalTrip);
  assert.deepEqual(steps, ["persist", "dirty", "receipt", "sync"]);
  assert.equal(result.trip.days[0]?.items[0]?.id, "item-lingyin");
  assert.equal(result.trip.days[0]?.items[0]?.placeName, "灵隐寺");
  assert.equal(result.trip.updatedAt, "2026-08-01T11:00:00.000Z");
  assert.deepEqual(result.receipt.appliedOperationIds, [
    "operation-add-lingyin",
  ]);
});

test("ApplyFlow discards untrusted POI extension fields at its runtime boundary", async () => {
  const trip = createTrip();
  const proposal = structuredClone(createProposal(trip)) as unknown as {
    operations: Array<{ place: Record<string, unknown> }>;
  };
  Object.assign(proposal.operations[0]?.place ?? {}, {
    details: { phone: "10086", rating: 5 },
    externalRefs: {
      amapPoiId: "forged-amap-id",
      sourceUrl: "https://example.com/private?xsec_token=secret",
    },
    iconKey: "forged-icon",
    mapBoundary: { type: "forged-boundary" },
    osmKey: "tourism",
    osmValue: "attraction",
    photos: [{ url: "https://example.com/signed-photo" }],
    poiGroup: "forged-group",
  });

  const result = await applyTripEditProposal(
    {
      authorization: { kind: "explicit_confirmation" },
      conversationId: "conversation-untrusted-poi",
      proposal,
      turnId: "turn-untrusted-poi",
    },
    {
      clock: () => "2026-08-01T11:00:00.000Z",
      findAppliedOperationIds: async () => new Set(),
      idGen: () => "item-lingyin",
      loadTrip: async () => trip,
      markTripDirty: async () => undefined,
      persistTripLocally: async (nextTrip) => nextTrip,
      recordReceipt: async () => undefined,
      rollbackLocalMutation: async () => undefined,
      scheduleCloudSync: () => undefined,
    },
  );

  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  const savedPlace = result.trip.places[0];
  assert.equal(savedPlace?.details, undefined);
  assert.equal(savedPlace?.mapBoundary, undefined);
  assert.equal(savedPlace?.osmKey, undefined);
  assert.equal(savedPlace?.osmValue, undefined);
  assert.equal(savedPlace?.photos, undefined);
  assert.deepEqual(savedPlace?.externalRefs, { amapPoiId: "B0LINGYIN001" });
  const savedPlaceRecord = savedPlace as unknown as Record<string, unknown>;
  assert.equal(savedPlaceRecord.iconKey === "forged-icon", false);
  assert.equal(savedPlaceRecord.poiGroup === "forged-group", false);
});

test("repeated confirmation returns the persisted receipt without writing again", async () => {
  const trip = createTrip();
  const proposal = createProposal(trip);
  const receipt = {
    appliedAt: "2026-08-01T11:00:00.000Z",
    appliedOperationIds: ["operation-add-lingyin"],
    conversationId: "conversation-1",
    proposalId: proposal.proposalId,
    tripId: trip.id,
    tripUpdatedAtAfterApply: "2026-08-01T11:00:00.000Z",
    turnId: "turn-1",
  };
  let writeCount = 0;
  const result = await applyTripEditProposal(
    {
      authorization: { kind: "explicit_confirmation" },
      conversationId: "conversation-1",
      proposal,
      turnId: "turn-1",
    },
    {
      findAppliedOperationIds: async () => new Set(["operation-add-lingyin"]),
      findReceipt: async () => receipt,
      loadTrip: async () => ({
        ...trip,
        updatedAt: receipt.tripUpdatedAtAfterApply,
      }),
      markTripDirty: async () => {
        writeCount += 1;
      },
      persistTripLocally: async (nextTrip) => {
        writeCount += 1;
        return nextTrip;
      },
      recordReceipt: async () => {
        writeCount += 1;
      },
      rollbackLocalMutation: async () => {
        writeCount += 1;
      },
      scheduleCloudSync: () => {
        writeCount += 1;
      },
    },
  );

  assert.equal(result.status, "duplicate");
  if (result.status !== "duplicate") return;
  assert.deepEqual(result.receipt, receipt);
  assert.equal(writeCount, 0);
});

test("invalid parameters, missing targets, unverified POIs, and version conflicts write nothing", async () => {
  const trip = createTrip();
  const addOperation = createProposal(trip).operations[0] as Extract<
    TripEditProposal["operations"][number],
    { type: "add_place_to_day" }
  >;
  const fixtures: Array<{
    expectedCode: string;
    proposal: unknown;
  }> = [
    {
      expectedCode: "INVALID_PROPOSAL",
      proposal: null,
    },
    {
      expectedCode: "INVALID_PROPOSAL",
      proposal: {
        ...createProposal(trip),
        operations: [{ ...addOperation, operationId: "" }],
      },
    },
    {
      expectedCode: "TARGET_NOT_FOUND",
      proposal: {
        ...createProposal(trip),
        operations: [{ ...addOperation, dayId: "missing-day" }],
      },
    },
    {
      expectedCode: "UNVERIFIED_POI",
      proposal: {
        ...createProposal(trip),
        operations: [
          {
            ...addOperation,
            metadata: undefined,
          },
        ],
      },
    },
    {
      expectedCode: "UNVERIFIED_POI",
      proposal: {
        ...createProposal(trip),
        operations: [
          {
            ...addOperation,
            metadata: {
              placeResolution: {
                ...addOperation.metadata?.placeResolution,
                confidence: "low",
              },
            },
          },
        ],
      },
    },
    {
      expectedCode: "VERSION_CONFLICT",
      proposal: {
        ...createProposal(trip),
        expectedUpdatedAt: "2026-07-01T00:00:00.000Z",
      },
    },
  ];

  for (const fixture of fixtures) {
    let writes = 0;
    const result = await applyTripEditProposal(
      {
        authorization: { kind: "explicit_confirmation" },
        conversationId: "conversation-1",
        proposal: fixture.proposal,
        turnId: "turn-1",
      },
      {
        findAppliedOperationIds: async () => new Set(),
        loadTrip: async () => trip,
        markTripDirty: async () => {
          writes += 1;
        },
        persistTripLocally: async (nextTrip) => {
          writes += 1;
          return nextTrip;
        },
        recordReceipt: async () => {
          writes += 1;
        },
        rollbackLocalMutation: async () => {
          writes += 1;
        },
        scheduleCloudSync: () => {
          writes += 1;
        },
      },
    );

    assert.equal(
      "error" in result ? result.error.code : undefined,
      fixture.expectedCode,
    );
    assert.equal(writes, 0);
  }
});

test("a Trip changed after validation is rejected before the first local write", async () => {
  const trip = createTrip();
  let writes = 0;
  const result = await applyTripEditProposal(
    {
      authorization: { kind: "explicit_confirmation" },
      conversationId: "conversation-1",
      proposal: createProposal(trip),
      turnId: "turn-1",
    },
    {
      captureLocalMutation: async () => ({
        dirty: undefined,
        trip: { ...trip, updatedAt: "2026-08-01T10:30:00.000Z" },
      }),
      findAppliedOperationIds: async () => new Set(),
      loadTrip: async () => trip,
      markTripDirty: async () => {
        writes += 1;
      },
      persistTripLocally: async (nextTrip) => {
        writes += 1;
        return nextTrip;
      },
      recordReceipt: async () => {
        writes += 1;
      },
      rollbackLocalMutation: async () => {
        writes += 1;
      },
      scheduleCloudSync: () => {
        writes += 1;
      },
    },
  );

  assert.equal(result.status, "version_conflict");
  assert.equal(
    "error" in result ? result.error.code : undefined,
    "VERSION_CONFLICT",
  );
  assert.equal(writes, 0);
});

test("a missing local Trip is rejected without starting any write", async () => {
  const trip = createTrip();
  let writes = 0;
  const result = await applyTripEditProposal(
    {
      authorization: { kind: "explicit_confirmation" },
      conversationId: "conversation-1",
      proposal: createProposal(trip),
      turnId: "turn-1",
    },
    {
      findAppliedOperationIds: async () => new Set(),
      loadTrip: async () => null,
      markTripDirty: async () => {
        writes += 1;
      },
      persistTripLocally: async (nextTrip) => {
        writes += 1;
        return nextTrip;
      },
      recordReceipt: async () => {
        writes += 1;
      },
      rollbackLocalMutation: async () => {
        writes += 1;
      },
      scheduleCloudSync: () => {
        writes += 1;
      },
    },
  );

  assert.equal(result.status, "rejected");
  assert.equal(
    "error" in result ? result.error.code : undefined,
    "TRIP_NOT_FOUND",
  );
  assert.equal(writes, 0);
});

test("a receipt failure rolls back the local Trip and dirty mutation without scheduling sync", async () => {
  const trip = createTrip();
  const steps: string[] = [];
  const result = await applyTripEditProposal(
    {
      authorization: { kind: "explicit_confirmation" },
      conversationId: "conversation-1",
      proposal: createProposal(trip),
      turnId: "turn-1",
    },
    {
      clock: () => "2026-08-01T11:00:00.000Z",
      findAppliedOperationIds: async () => new Set(),
      idGen: () => "item-lingyin",
      loadTrip: async () => trip,
      markTripDirty: async () => {
        steps.push("dirty");
      },
      persistTripLocally: async (nextTrip) => {
        steps.push("persist");
        return nextTrip;
      },
      recordReceipt: async () => {
        steps.push("receipt");
        throw new Error("receipt write failed");
      },
      rollbackLocalMutation: async (originalTrip) => {
        steps.push("rollback");
        assert.deepEqual(originalTrip, trip);
      },
      scheduleCloudSync: () => {
        steps.push("sync");
      },
    },
  );

  assert.equal(result.status, "failed");
  assert.equal(
    "error" in result ? result.error.code : undefined,
    "WRITE_FAILED",
  );
  assert.deepEqual(steps, ["persist", "dirty", "receipt", "rollback"]);
});

test("enabled quick delegation can apply only the low-risk verified-place operation", async () => {
  const trip = createTrip();
  const result = await applyTripEditProposal(
    {
      authorization: { enabled: true, kind: "quick_delegate" },
      conversationId: "conversation-1",
      proposal: createProposal(trip),
      turnId: "turn-1",
    },
    {
      clock: () => "2026-08-01T11:00:00.000Z",
      findAppliedOperationIds: async () => new Set(),
      idGen: () => "item-lingyin",
      loadTrip: async () => trip,
      markTripDirty: async () => undefined,
      persistTripLocally: async (nextTrip) => nextTrip,
      recordReceipt: async () => undefined,
      rollbackLocalMutation: async () => undefined,
      scheduleCloudSync: () => undefined,
    },
  );

  assert.equal(result.status, "applied");
});

test("quick delegation applies a validated low-risk item update", async () => {
  const trip = createPopulatedTrip();
  const proposal: TripEditProposal = {
    expectedUpdatedAt: trip.updatedAt,
    operations: [
      {
        changes: { time: "10:30" },
        dayId: "day-1",
        itemId: "item-west-lake",
        operationId: "operation-update-west-lake",
        tripId: trip.id,
        type: "update_day_item",
      },
    ],
    proposalId: "proposal-update-west-lake",
    summary: "把西湖时间改到 10:30",
    tripId: trip.id,
  };

  const result = await applyTripEditProposal(
    {
      authorization: { enabled: true, kind: "quick_delegate" },
      conversationId: "conversation-update",
      proposal,
      turnId: "turn-update",
    },
    {
      clock: () => "2026-08-01T11:00:00.000Z",
      findAppliedOperationIds: async () => new Set(),
      loadTrip: async () => trip,
      markTripDirty: async () => undefined,
      persistTripLocally: async (nextTrip) => nextTrip,
      recordReceipt: async () => undefined,
      rollbackLocalMutation: async () => undefined,
      scheduleCloudSync: () => undefined,
    },
  );

  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert.equal(result.trip.days[0]?.items[0]?.time, "10:30");
});

test("move and remove operations reject ordinary confirmation and require strong confirmation", async () => {
  for (const operation of [
    {
      fromDayId: "day-1",
      itemId: "item-west-lake",
      operationId: "operation-move-west-lake",
      targetIndex: 0,
      toDayId: "day-2",
      tripId: "trip-hangzhou",
      type: "move_day_item" as const,
    },
    {
      dayId: "day-1",
      itemId: "item-west-lake",
      operationId: "operation-remove-west-lake",
      tripId: "trip-hangzhou",
      type: "remove_day_item" as const,
    },
  ]) {
    const trip = createPopulatedTrip();
    const proposal: TripEditProposal = {
      expectedUpdatedAt: trip.updatedAt,
      operations: [operation],
      proposalId: `proposal-${operation.operationId}`,
      summary: "调整西湖安排",
      tripId: trip.id,
    };
    let writes = 0;
    const deps = {
      clock: () => "2026-08-01T11:00:00.000Z",
      findAppliedOperationIds: async () => new Set<string>(),
      loadTrip: async () => trip,
      markTripDirty: async () => {
        writes += 1;
      },
      persistTripLocally: async (nextTrip: Trip) => {
        writes += 1;
        return nextTrip;
      },
      recordReceipt: async () => {
        writes += 1;
      },
      rollbackLocalMutation: async () => undefined,
      scheduleCloudSync: () => undefined,
    };

    const ordinary = await applyTripEditProposal(
      {
        authorization: { kind: "explicit_confirmation" },
        conversationId: "conversation-ordinary",
        proposal,
        turnId: "turn-ordinary",
      },
      deps,
    );
    assert.equal(ordinary.status, "rejected");
    assert.equal(
      "error" in ordinary && ordinary.error.code,
      "APPROVAL_REQUIRED",
    );
    assert.equal(writes, 0);

    const strong = await applyTripEditProposal(
      {
        authorization: { kind: "strong_confirmation" },
        conversationId: "conversation-strong",
        proposal,
        turnId: "turn-strong",
      },
      deps,
    );
    assert.equal(strong.status, "applied");
  }
});

test("multiple low-risk operations require strong confirmation and commit once", async () => {
  const trip = createPopulatedTrip();
  const proposal: TripEditProposal = {
    expectedUpdatedAt: trip.updatedAt,
    operations: [
      {
        changes: { time: "10:30" },
        dayId: "day-1",
        itemId: "item-west-lake",
        operationId: "operation-update-west-lake",
        tripId: trip.id,
        type: "update_day_item",
      },
      {
        dayId: "day-2",
        operationId: "operation-title-day-2",
        title: "灵隐寺与茶园",
        tripId: trip.id,
        type: "update_trip_day_title",
      },
    ],
    proposalId: "proposal-multiple-updates",
    summary: "更新两处行程安排",
    tripId: trip.id,
  };
  let tripWrites = 0;
  const deps = {
    clock: () => "2026-08-01T11:00:00.000Z",
    findAppliedOperationIds: async () => new Set<string>(),
    loadTrip: async () => trip,
    markTripDirty: async () => undefined,
    persistTripLocally: async (nextTrip: Trip) => {
      tripWrites += 1;
      return nextTrip;
    },
    recordReceipt: async () => undefined,
    rollbackLocalMutation: async () => undefined,
    scheduleCloudSync: () => undefined,
  };

  const delegated = await applyTripEditProposal(
    {
      authorization: { enabled: true, kind: "quick_delegate" },
      conversationId: "conversation-delegated-batch",
      proposal,
      turnId: "turn-delegated-batch",
    },
    deps,
  );
  assert.equal(delegated.status, "rejected");
  assert.equal(tripWrites, 0);

  const result = await applyTripEditProposal(
    {
      authorization: { kind: "strong_confirmation" },
      conversationId: "conversation-batch",
      proposal,
      turnId: "turn-batch",
    },
    deps,
  );

  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert.equal(tripWrites, 1);
  assert.equal(result.trip.days[0]?.items[0]?.time, "10:30");
  assert.equal(result.trip.days[1]?.title, "灵隐寺与茶园");
  assert.deepEqual(result.receipt.appliedOperationIds, [
    "operation-update-west-lake",
    "operation-title-day-2",
  ]);
});

test("an invalid operation in a batch prevents every local write", async () => {
  const trip = createPopulatedTrip();
  const proposal: TripEditProposal = {
    expectedUpdatedAt: trip.updatedAt,
    operations: [
      {
        changes: { time: "10:30" },
        dayId: "day-1",
        itemId: "item-west-lake",
        operationId: "operation-valid-update",
        tripId: trip.id,
        type: "update_day_item",
      },
      {
        dayId: "day-2",
        itemId: "missing-item",
        operationId: "operation-invalid-remove",
        tripId: trip.id,
        type: "remove_day_item",
      },
    ],
    proposalId: "proposal-invalid-batch",
    summary: "无效批量操作",
    tripId: trip.id,
  };
  let writes = 0;

  const result = await applyTripEditProposal(
    {
      authorization: { kind: "strong_confirmation" },
      conversationId: "conversation-invalid-batch",
      proposal,
      turnId: "turn-invalid-batch",
    },
    {
      findAppliedOperationIds: async () => new Set(),
      loadTrip: async () => trip,
      markTripDirty: async () => {
        writes += 1;
      },
      persistTripLocally: async (nextTrip) => {
        writes += 1;
        return nextTrip;
      },
      recordReceipt: async () => {
        writes += 1;
      },
      rollbackLocalMutation: async () => {
        writes += 1;
      },
      scheduleCloudSync: () => {
        writes += 1;
      },
    },
  );

  assert.equal(result.status, "rejected");
  assert.equal("error" in result && result.error.code, "TARGET_NOT_FOUND");
  assert.equal(writes, 0);
  assert.equal(trip.days[0]?.items[0]?.time, "09:00");
});

test("ApprovalGate derives quick-delegate policy only from Validator operation facts", () => {
  const trip = createTrip();
  const validation = validateTripEditProposal({
    proposal: createProposal(trip),
    trip,
  });

  assert.equal(validation.ok, true);
  if (!validation.ok) return;
  assert.deepEqual(validation.data.operationFacts, [
    {
      operationId: "operation-add-lingyin",
      reasonCode: "verified_poi_addition",
      risk: "low",
      type: "add_place_to_day",
    },
  ]);
  const policy = createTripEditApprovalPolicy(validation.data);
  assert.equal(policy.operations[0]?.requirement, "quick_delegate_allowed");
});

test("an already-satisfied day count stays low risk across Validator and ApprovalGate", () => {
  const trip = createPopulatedTrip();
  const proposal: TripEditProposal = {
    expectedUpdatedAt: trip.updatedAt,
    operations: [
      {
        dayCount: 2,
        operationId: "operation-keep-two-days",
        tripId: trip.id,
        type: "ensure_trip_day_count",
      },
    ],
    proposalId: "proposal-keep-two-days",
    summary: "确认行程已有两天",
    tripId: trip.id,
  };

  const validation = validateTripEditProposal({ proposal, trip });

  assert.equal(validation.ok, true);
  if (!validation.ok) return;
  assert.equal(validation.data.operationFacts[0]?.risk, "low");
  assert.equal(
    createTripEditApprovalPolicy(validation.data).operations[0]?.requirement,
    "quick_delegate_allowed",
  );
});

test("an actual day expansion stays medium risk across preview and ApprovalGate", () => {
  const trip = createTrip();
  const proposal: TripEditProposal = {
    expectedUpdatedAt: trip.updatedAt,
    operations: [
      {
        dayCount: 2,
        operationId: "operation-expand-to-two-days",
        tripId: trip.id,
        type: "ensure_trip_day_count",
      },
    ],
    proposalId: "proposal-expand-to-two-days",
    summary: "把行程补到两天",
    tripId: trip.id,
  };

  const validation = validateTripEditProposal({ proposal, trip });

  assert.equal(validation.ok, true);
  if (!validation.ok) return;
  assert.equal(createAgentProposalPreview(trip, proposal)[0]?.risk, "medium");
  assert.equal(validation.data.operationFacts[0]?.risk, "medium");
  assert.equal(
    createTripEditApprovalPolicy(validation.data).operations[0]?.requirement,
    "strong_confirm",
  );
});

test("sequential day-count operations share the same risk facts in preview and Validator", () => {
  const trip = createTrip();
  const proposal: TripEditProposal = {
    expectedUpdatedAt: trip.updatedAt,
    operations: [
      {
        dayCount: 3,
        operationId: "operation-expand-to-three-days",
        tripId: trip.id,
        type: "ensure_trip_day_count",
      },
      {
        dayCount: 3,
        operationId: "operation-keep-three-days",
        tripId: trip.id,
        type: "ensure_trip_day_count",
      },
    ],
    proposalId: "proposal-sequential-day-count",
    summary: "补齐并确认三天行程",
    tripId: trip.id,
  };

  const validation = validateTripEditProposal({ proposal, trip });

  assert.equal(validation.ok, true);
  if (!validation.ok) return;
  assert.deepEqual(
    createAgentProposalPreview(trip, proposal).map((item) => item.risk),
    ["medium", "low"],
  );
  assert.deepEqual(
    validation.data.operationFacts.map((fact) => fact.risk),
    ["medium", "low"],
  );
});

test("multiple low-risk operations keep their own risk while requiring strong confirmation", () => {
  const trip = createPopulatedTrip();
  const originalTrip = structuredClone(trip);
  const proposal: TripEditProposal = {
    expectedUpdatedAt: trip.updatedAt,
    operations: [
      {
        changes: { time: "10:30" },
        dayId: "day-1",
        itemId: "item-west-lake",
        operationId: "operation-update-west-lake-time",
        tripId: trip.id,
        type: "update_day_item",
      },
      {
        dayId: "day-2",
        operationId: "operation-update-day-two-title",
        title: "茶园漫步",
        tripId: trip.id,
        type: "update_trip_day_title",
      },
    ],
    proposalId: "proposal-two-low-risk-updates",
    summary: "更新两处安排",
    tripId: trip.id,
  };

  const validation = validateTripEditProposal({ proposal, trip });

  assert.equal(validation.ok, true);
  if (!validation.ok) return;
  assert.deepEqual(
    validation.data.operationFacts.map((fact) => fact.risk),
    ["low", "low"],
  );
  const policy = createTripEditApprovalPolicy(validation.data);
  assert.deepEqual(
    policy.operations.map((operation) => operation.risk),
    ["low", "low"],
  );
  assert.deepEqual(
    policy.operations.map((operation) => operation.requirement),
    ["strong_confirm", "strong_confirm"],
  );
  assert.equal(validation.data.nextTrip.days[0]?.items[0]?.time, "10:30");
  assert.equal(validation.data.nextTrip.days[1]?.title, "茶园漫步");
  assert.deepEqual(trip, originalTrip);
});

test("default TripEdit ApplyFlow persists Trip, dirty metadata, and idempotency receipt locally", async () => {
  const restoreWindow = installWindowLocalStorage();
  const originalExpoOs = process.env.EXPO_OS;
  process.env.EXPO_OS = "web";
  const values = new Map<string, string>();
  setAgentLocalStorageAdapterForTests({
    getAllKeys: async () => [...values.keys()],
    getItem: async (key) => values.get(key) ?? null,
    removeItem: async (key) => {
      values.delete(key);
    },
    setItem: async (key, value) => {
      values.set(key, value);
    },
  });
  await AsyncStorage.clear();
  await clearAppliedAgentProposalLedger();
  const trip = createTrip();
  await saveTrips([trip]);
  const input = {
    authorization: { kind: "explicit_confirmation" as const },
    conversationId: "conversation-default",
    proposal: createProposal(trip),
    turnId: "turn-default",
  };

  try {
    const result = await applyTripEditProposal(input, {
      clock: () => "2026-08-01T11:00:00.000Z",
      idGen: () => "item-lingyin",
      scheduleCloudSync: () => undefined,
    });
    assert.equal(result.status, "applied");
    const persistedTrip = await getTripById(trip.id);
    assert.equal(persistedTrip?.days[0]?.items[0]?.placeName, "灵隐寺");
    const syncStore = JSON.parse(
      (await AsyncStorage.getItem("waylog.trip_sync.v1")) ?? "{}",
    ) as { entities?: Record<string, { dirty?: boolean }> };
    assert.equal(syncStore.entities?.[trip.id]?.dirty, true);
    assert.equal(
      (await getAppliedAgentOperationIds()).has("operation-add-lingyin"),
      true,
    );

    const duplicate = await applyTripEditProposal(
      {
        ...input,
        conversationId: "conversation-retry",
        turnId: "turn-retry",
      },
      {
        scheduleCloudSync: () => undefined,
      },
    );
    assert.equal(duplicate.status, "duplicate");
    if (duplicate.status === "duplicate") {
      assert.equal(duplicate.receipt.conversationId, "conversation-default");
      assert.equal(duplicate.receipt.turnId, "turn-default");
    }
  } finally {
    await clearAppliedAgentProposalLedger();
    await AsyncStorage.clear();
    setAgentLocalStorageAdapterForTests(null);
    if (originalExpoOs === undefined) delete process.env.EXPO_OS;
    else process.env.EXPO_OS = originalExpoOs;
    restoreWindow();
  }
});

test("concurrent repeated confirmation is serialized and produces one local write", async () => {
  const trip = createTrip();
  const proposal = createProposal(trip);
  let currentTrip = trip;
  let persistedReceipt: TripEditApplyReceipt | undefined;
  let tripWrites = 0;
  const appliedIds = new Set<string>();
  const deps = {
    clock: () => "2026-08-01T11:00:00.000Z",
    findAppliedOperationIds: async () => new Set(appliedIds),
    findReceipt: async () => persistedReceipt,
    idGen: () => "item-lingyin",
    loadTrip: async () => currentTrip,
    markTripDirty: async () => undefined,
    persistTripLocally: async (nextTrip: Trip) => {
      tripWrites += 1;
      currentTrip = nextTrip;
      return nextTrip;
    },
    recordReceipt: async (receipt: TripEditApplyReceipt) => {
      persistedReceipt = receipt;
      for (const operationId of receipt.appliedOperationIds) {
        appliedIds.add(operationId);
      }
    },
    rollbackLocalMutation: async () => undefined,
    scheduleCloudSync: () => undefined,
  };
  const input = {
    authorization: { kind: "explicit_confirmation" as const },
    conversationId: "conversation-concurrent",
    proposal,
    turnId: "turn-concurrent",
  };

  const [first, second] = await Promise.all([
    applyTripEditProposal(input, deps),
    applyTripEditProposal(input, deps),
  ]);

  assert.deepEqual([first.status, second.status].sort(), [
    "applied",
    "duplicate",
  ]);
  assert.equal(tripWrites, 1);
  assert.equal(currentTrip.days[0]?.items.length, 1);
});

test("different operations against the same Trip cannot both commit the same version", async () => {
  const trip = createTrip();
  const firstProposal = createProposal(trip);
  const firstOperation = firstProposal.operations[0] as Extract<
    TripEditProposal["operations"][number],
    { type: "add_place_to_day" }
  >;
  const secondProposal: TripEditProposal = {
    ...firstProposal,
    operations: [
      {
        ...firstOperation,
        metadata: {
          placeResolution: {
            address: "浙江省杭州市西湖区南山路",
            confidence: "high",
            provider: "amap",
            providerPlaceId: "B0LEIFENG001",
            source: "amap",
          },
        },
        operationId: "operation-add-leifeng",
        place: {
          address: "浙江省杭州市西湖区南山路",
          category: "景点",
          latitude: 30.2338,
          longitude: 120.1452,
          name: "雷峰塔",
          provider: "amap",
          providerPlaceId: "B0LEIFENG001",
        },
      },
    ],
    proposalId: "proposal-add-leifeng",
    summary: "把雷峰塔加入第一天",
  };
  let currentTrip = trip;
  const appliedIds = new Set<string>();
  const receipts = new Map<string, TripEditApplyReceipt>();
  const deps = {
    clock: () => "2026-08-01T11:00:00.000Z",
    findAppliedOperationIds: async () => new Set(appliedIds),
    findReceipt: async (proposalId: string) => receipts.get(proposalId),
    idGen: (prefix: string) => `${prefix}-${appliedIds.size + 1}`,
    loadTrip: async () => currentTrip,
    markTripDirty: async () => undefined,
    persistTripLocally: async (nextTrip: Trip) => {
      currentTrip = nextTrip;
      return nextTrip;
    },
    recordReceipt: async (receipt: TripEditApplyReceipt) => {
      receipts.set(receipt.proposalId, receipt);
      for (const operationId of receipt.appliedOperationIds) {
        appliedIds.add(operationId);
      }
    },
    rollbackLocalMutation: async () => undefined,
    scheduleCloudSync: () => undefined,
  };

  const [first, second] = await Promise.all([
    applyTripEditProposal(
      {
        authorization: { kind: "explicit_confirmation" },
        conversationId: "conversation-first",
        proposal: firstProposal,
        turnId: "turn-first",
      },
      deps,
    ),
    applyTripEditProposal(
      {
        authorization: { kind: "explicit_confirmation" },
        conversationId: "conversation-second",
        proposal: secondProposal,
        turnId: "turn-second",
      },
      deps,
    ),
  ]);

  assert.deepEqual([first.status, second.status].sort(), [
    "applied",
    "version_conflict",
  ]);
  assert.equal(currentTrip.days[0]?.items.length, 1);
  assert.equal(appliedIds.size, 1);
  assert.equal(receipts.size, 1);
});

test("a stale manual Trip update cannot overwrite an Agent edit committed first", async () => {
  const restoreWindow = installWindowLocalStorage();
  const originalExpoOs = process.env.EXPO_OS;
  process.env.EXPO_OS = "web";
  const values = new Map<string, string>();
  setAgentLocalStorageAdapterForTests({
    getAllKeys: async () => [...values.keys()],
    getItem: async (key) => values.get(key) ?? null,
    removeItem: async (key) => {
      values.delete(key);
    },
    setItem: async (key, value) => {
      values.set(key, value);
    },
  });
  await AsyncStorage.clear();
  await clearAppliedAgentProposalLedger();
  const trip = createTrip();
  await saveTrips([trip]);

  try {
    const agentApply = applyTripEditProposal(
      {
        authorization: { kind: "explicit_confirmation" },
        conversationId: "conversation-agent-wins",
        proposal: createProposal(trip),
        turnId: "turn-agent-wins",
      },
      {
        clock: () => "2026-08-01T11:00:00.000Z",
        idGen: () => "item-lingyin",
        scheduleCloudSync: () => undefined,
      },
    );
    const staleManualUpdate = updateTrip(
      { ...trip, title: "旧页面标题" },
      { expectedUpdatedAt: trip.updatedAt },
    );
    const [agentResult, manualResult] = await Promise.allSettled([
      agentApply,
      staleManualUpdate,
    ]);

    assert.equal(agentResult.status, "fulfilled");
    if (agentResult.status === "fulfilled") {
      assert.equal(agentResult.value.status, "applied");
    }
    assert.equal(manualResult.status, "rejected");
    if (manualResult.status === "rejected") {
      assert.equal(
        manualResult.reason instanceof Error && "code" in manualResult.reason
          ? manualResult.reason.code
          : undefined,
        "VERSION_CONFLICT",
      );
    }
    const persisted = await getTripById(trip.id);
    assert.equal(persisted?.title, trip.title);
    assert.equal(persisted?.days[0]?.items[0]?.placeName, "灵隐寺");
  } finally {
    await clearAppliedAgentProposalLedger();
    await AsyncStorage.clear();
    setAgentLocalStorageAdapterForTests(null);
    if (originalExpoOs === undefined) delete process.env.EXPO_OS;
    else process.env.EXPO_OS = originalExpoOs;
    restoreWindow();
  }
});

test("a synchronous sync scheduling failure retains the committed Trip and receipt", async () => {
  const trip = createTrip();
  let receipt: TripEditApplyReceipt | undefined;
  const result = await applyTripEditProposal(
    {
      authorization: { kind: "explicit_confirmation" },
      conversationId: "conversation-sync-failure",
      proposal: createProposal(trip),
      turnId: "turn-sync-failure",
    },
    {
      clock: () => "2026-08-01T11:00:00.000Z",
      findAppliedOperationIds: async () => new Set(),
      idGen: () => "item-lingyin",
      loadTrip: async () => trip,
      markTripDirty: async () => undefined,
      persistTripLocally: async (nextTrip) => nextTrip,
      recordReceipt: async (nextReceipt) => {
        receipt = nextReceipt;
      },
      rollbackLocalMutation: async () => {
        throw new Error("committed state must not roll back");
      },
      scheduleCloudSync: () => {
        throw new Error("sync unavailable");
      },
    },
  );

  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert.equal(receipt?.proposalId, "proposal-add-lingyin");
  assert.equal(result.trip.days[0]?.items[0]?.placeName, "灵隐寺");
});

test("default compensation restores the original Trip and dirty metadata after a mid-commit failure", async () => {
  const restoreWindow = installWindowLocalStorage();
  const originalExpoOs = process.env.EXPO_OS;
  process.env.EXPO_OS = "web";
  const trip = createTrip();
  await AsyncStorage.clear();
  await saveTrips([trip]);

  try {
    const result = await applyTripEditProposal(
      {
        authorization: { kind: "explicit_confirmation" },
        conversationId: "conversation-rollback",
        proposal: createProposal(trip),
        turnId: "turn-rollback",
      },
      {
        clock: () => "2026-08-01T11:00:00.000Z",
        idGen: () => "item-lingyin",
        recordReceipt: async () => {
          throw new Error("receipt write failed");
        },
        scheduleCloudSync: () => undefined,
      },
    );

    assert.equal(result.status, "failed");
    const restoredTrip = await getTripById(trip.id);
    assert.equal(restoredTrip?.updatedAt, trip.updatedAt);
    assert.deepEqual(restoredTrip?.days[0]?.items, []);
    assert.deepEqual(restoredTrip?.places, []);
    const syncStore = JSON.parse(
      (await AsyncStorage.getItem("waylog.trip_sync.v1")) ?? "{}",
    ) as { entities?: Record<string, unknown> };
    assert.equal(syncStore.entities?.[trip.id], undefined);
  } finally {
    await AsyncStorage.clear();
    if (originalExpoOs === undefined) delete process.env.EXPO_OS;
    else process.env.EXPO_OS = originalExpoOs;
    restoreWindow();
  }
});
