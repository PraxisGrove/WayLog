import assert from "node:assert/strict";
import test from "node:test";

import {
  type TripEditAddPlaceToDayOperation,
  type TripEditProposal,
  applyTripEditProposalCommands,
  type TripEditRemoveDayItemOperation,
  validateTripEditProposalPreview,
} from "../../../features/agent";
import type { TripCommandDeps } from "../../../features/trips/commands";
import type { Trip } from "../../../features/trips/types";

function getRequired<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

function makeFixtureTrip(): Trip {
  return {
    id: "trip-agent-test",
    title: "云南 3 日",
    destination: "云南",
    currency: "CNY",
    status: "计划中",
    startDate: "2026-06-15",
    endDate: "2026-06-17",
    days: [
      {
        id: "day-1",
        dayIndex: 1,
        title: "第一天",
        items: [],
      },
      {
        id: "day-2",
        dayIndex: 2,
        title: "第二天",
        items: [],
      },
    ],
    places: [],
    transports: [],
    lodgings: [],
    memos: [],
    checklistItems: [],
    expenses: [],
    importSources: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
  };
}

function makeFixtureTripWithItems(): Trip {
  return {
    ...makeFixtureTrip(),
    days: [
      {
        id: "day-1",
        dayIndex: 1,
        title: "第一天",
        items: [
          {
            id: "item-stone-forest",
            title: "石林风景区",
            category: "景点",
            placeId: "place-stone-forest",
            placeName: "石林风景区",
            time: "09:00",
          },
        ],
      },
      {
        id: "day-2",
        dayIndex: 2,
        title: "第二天",
        items: [],
      },
    ],
    places: [
      {
        id: "place-stone-forest",
        name: "石林风景区",
        category: "景点",
        isScheduled: true,
      },
    ],
  };
}

function makeProposal(
  overrides: Partial<TripEditProposal> = {},
): TripEditProposal {
  return {
    expectedUpdatedAt: "2026-06-01T10:00:00.000Z",
    operations: [
      {
        type: "add_place_to_day",
        dayId: "day-2",
        operationId: "op-add-dounan",
        place: {
          address: "昆明市呈贡区",
          category: "购物",
          name: "斗南花卉市场",
          provider: "amap",
          providerPlaceId: "B000A-test",
        },
        metadata: {
          placeResolution: {
            address: "昆明市呈贡区",
            confidence: "high",
            provider: "amap",
            providerPlaceId: "B000A-test",
            source: "poi_cache",
          },
        },
        time: "15:30",
        tripId: "trip-agent-test",
      },
    ],
    proposalId: "proposal-1",
    summary: "把斗南花卉市场加入第二天",
    tripId: "trip-agent-test",
    ...overrides,
  };
}

function makeRemoveProposal(
  overrides: Partial<TripEditProposal> = {},
): TripEditProposal {
  return {
    expectedUpdatedAt: "2026-06-01T10:00:00.000Z",
    operations: [
      {
        type: "remove_day_item",
        dayId: "day-1",
        itemId: "item-stone-forest",
        operationId: "op-remove-stone-forest",
        tripId: "trip-agent-test",
      },
    ],
    proposalId: "proposal-remove-1",
    summary: "删除第一天的石林安排",
    tripId: "trip-agent-test",
    ...overrides,
  };
}

function makeUpdateProposal(
  overrides: Partial<TripEditProposal> = {},
): TripEditProposal {
  return {
    expectedUpdatedAt: "2026-06-01T10:00:00.000Z",
    operations: [
      {
        type: "update_day_item",
        changes: {
          note: "Arrive early",
          time: "09:30",
          title: "Stone Forest Scenic Area",
        },
        dayId: "day-1",
        itemId: "item-stone-forest",
        operationId: "op-update-stone-forest",
        tripId: "trip-agent-test",
      },
    ],
    proposalId: "proposal-update-1",
    summary: "Update Stone Forest",
    tripId: "trip-agent-test",
    ...overrides,
  };
}

function makeMoveProposal(
  overrides: Partial<TripEditProposal> = {},
): TripEditProposal {
  return {
    expectedUpdatedAt: "2026-06-01T10:00:00.000Z",
    operations: [
      {
        type: "move_day_item",
        fromDayId: "day-1",
        itemId: "item-stone-forest",
        operationId: "op-move-stone-forest",
        targetIndex: 0,
        toDayId: "day-2",
        tripId: "trip-agent-test",
      },
    ],
    proposalId: "proposal-move-1",
    summary: "Move Stone Forest",
    tripId: "trip-agent-test",
    ...overrides,
  };
}

function getAddOperation(): TripEditAddPlaceToDayOperation {
  const operation = getRequired(
    makeProposal().operations[0],
    "expected first add operation",
  );

  if (operation.type !== "add_place_to_day") {
    throw new Error("Expected add_place_to_day operation");
  }

  return operation;
}

function getRemoveOperation(): TripEditRemoveDayItemOperation {
  const operation = getRequired(
    makeRemoveProposal().operations[0],
    "expected first remove operation",
  );

  if (operation.type !== "remove_day_item") {
    throw new Error("Expected remove_day_item operation");
  }

  return operation;
}

function getUpdateOperation() {
  const operation = getRequired(
    makeUpdateProposal().operations[0],
    "expected first update operation",
  );

  if (operation.type !== "update_day_item") {
    throw new Error("Expected update_day_item operation");
  }

  return operation;
}

function getMoveOperation() {
  const operation = getRequired(
    makeMoveProposal().operations[0],
    "expected first move operation",
  );

  if (operation.type !== "move_day_item") {
    throw new Error("Expected move_day_item operation");
  }

  return operation;
}

function makeDeterministicDeps(): TripCommandDeps {
  let idIndex = 0;

  return {
    clock: () => "2026-06-02T08:00:00.000Z",
    idGen: (prefix) => {
      idIndex += 1;
      return `${prefix}-AGENT-${idIndex}`;
    },
  };
}

test("validateTripEditProposalPreview 生成预览但不修改 Trip", () => {
  const trip = makeFixtureTrip();
  const before = JSON.stringify(trip);
  const result = validateTripEditProposalPreview({
    proposal: makeProposal(),
    trip,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.proposal.proposalId, "proposal-1");
  assert.deepEqual(result.data.preview, [
    {
      action: "add_place_to_day",
      dayId: "day-2",
      description: "在第二天 15:30添加地点：斗南花卉市场",
      display: {
        address: "昆明市呈贡区",
        dayLabel: "第二天",
        kind: "add_place_to_day",
        placeName: "斗南花卉市场",
        sourceDetails: [
          "已匹配真实地点：缓存 / 高德",
          "地点来源 ID：B000A-test",
        ],
        time: "15:30",
      },
      impact: [
        "新增地点：斗南花卉市场",
        "目标日期：第二天",
        "已匹配真实地点：缓存 / 高德",
        "地点地址：昆明市呈贡区",
        "地点来源 ID：B000A-test",
      ],
      operationId: "op-add-dounan",
      risk: "low",
      targetName: "斗南花卉市场",
    },
  ]);
  assert.equal(JSON.stringify(trip), before, "校验和预览阶段不应修改 Trip");
});

test("validateTripEditProposalPreview 拒绝版本冲突的提案", () => {
  const trip = makeFixtureTrip();
  const result = validateTripEditProposalPreview({
    proposal: makeProposal({ expectedUpdatedAt: "2026-06-01T09:00:00.000Z" }),
    trip,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "VERSION_CONFLICT");
});

test("validateTripEditProposalPreview 拒绝指向其他 Trip 的提案", () => {
  const trip = makeFixtureTrip();
  const result = validateTripEditProposalPreview({
    proposal: makeProposal({ tripId: "trip-other" }),
    trip,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "TRIP_MISMATCH");
});

test("validateTripEditProposalPreview 拒绝找不到 dayId 的操作", () => {
  const trip = makeFixtureTrip();
  const proposal = makeProposal({
    operations: [
      {
        ...getAddOperation(),
        dayId: "day-not-exist",
      },
    ],
  });
  const result = validateTripEditProposalPreview({ proposal, trip });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "TARGET_NOT_FOUND");
});

test("validateTripEditProposalPreview 为删除操作生成高风险影响预览", () => {
  const trip = makeFixtureTripWithItems();
  const before = JSON.stringify(trip);
  const result = validateTripEditProposalPreview({
    proposal: makeRemoveProposal(),
    trip,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.data.preview, [
    {
      action: "remove_day_item",
      dayId: "day-1",
      description: "从第一天删除行程点：石林风景区",
      display: {
        dayLabel: "第一天",
        kind: "remove_day_item",
        placeImpact: "可能清理地点库：石林风景区",
        targetName: "石林风景区",
      },
      impact: ["删除行程点：石林风景区", "可能清理地点库：石林风景区"],
      itemId: "item-stone-forest",
      operationId: "op-remove-stone-forest",
      risk: "high",
      targetName: "石林风景区",
    },
  ]);
  assert.equal(JSON.stringify(trip), before);
});

test("validateTripEditProposalPreview 删除预览不把同名但不同 placeId 的行程点当成同一地点引用", () => {
  const trip = makeFixtureTripWithItems();
  trip.days[1]?.items.push({
    id: "item-same-name-other-place",
    title: "石林风景区",
    category: "景点",
    placeId: "place-other",
    placeName: "石林风景区",
  });
  trip.places.push({
    id: "place-other",
    name: "石林风景区",
    category: "景点",
    isScheduled: true,
  });

  const result = validateTripEditProposalPreview({
    proposal: makeRemoveProposal(),
    trip,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.preview[0]?.impact[1], "可能清理地点库：石林风景区");
});

test("validateTripEditProposalPreview 拒绝找不到 itemId 的删除操作", () => {
  const trip = makeFixtureTripWithItems();
  const proposal = makeRemoveProposal({
    operations: [
      {
        ...getRemoveOperation(),
        itemId: "item-not-exist",
      },
    ],
  });
  const result = validateTripEditProposalPreview({ proposal, trip });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "TARGET_NOT_FOUND");
});

test("validateTripEditProposalPreview 拒绝重复 operationId", () => {
  const trip = makeFixtureTrip();
  const operation = getAddOperation();
  const result = validateTripEditProposalPreview({
    proposal: makeProposal({
      operations: [
        operation,
        {
          ...operation,
          dayId: "day-1",
        },
      ],
    }),
    trip,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "DUPLICATE_OPERATION");
});

test("validateTripEditProposalPreview 拒绝未知结构", () => {
  const trip = makeFixtureTrip();
  const result = validateTripEditProposalPreview({
    proposal: {
      hello: "world",
    },
    trip,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "INVALID_PROPOSAL");
});

test("applyTripEditProposalCommands 确认后调用 command，把地点加入目标 day", () => {
  const trip = makeFixtureTrip();
  const result = applyTripEditProposalCommands(
    {
      proposal: makeProposal(),
      trip,
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const nextTrip = result.data.trip;
  const targetDay = nextTrip.days.find((day) => day.id === "day-2");
  const addedItem = targetDay?.items[0];
  const addedPlace = nextTrip.places[0];

  assert.deepEqual(result.data.appliedOperationIds, ["op-add-dounan"]);
  assert.equal(addedPlace?.id, "place-AGENT-1");
  assert.equal(addedPlace?.name, "斗南花卉市场");
  assert.equal(addedPlace?.provider, "amap");
  assert.equal(addedPlace?.providerPlaceId, "B000A-test");
  assert.equal(addedItem?.id, "item-AGENT-2");
  assert.equal(addedItem?.placeId, "place-AGENT-1");
  assert.equal(addedItem?.placeName, "斗南花卉市场");
  assert.equal(addedItem?.time, "15:30");
  assert.equal(addedItem?.recommendationReason, undefined);
  assert.equal(nextTrip.updatedAt, "2026-06-02T08:00:00.000Z");
  assert.equal(trip.days[1]?.items.length, 0, "原 Trip 不应被原地修改");
});

test("applyTripEditProposalCommands 拒绝已经应用过的 operationId", () => {
  const trip = makeFixtureTrip();
  const result = applyTripEditProposalCommands({
    appliedOperationIds: new Set(["op-add-dounan"]),
    proposal: makeProposal(),
    trip,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "DUPLICATE_OPERATION");
});

test("applyTripEditProposalCommands can extend missing days before adding a place by dayIndex", () => {
  const trip = makeFixtureTrip();
  const proposal: TripEditProposal = {
    expectedUpdatedAt: "2026-06-01T10:00:00.000Z",
    operations: [
      {
        dayCount: 5,
        operationId: "op-ensure-day-5",
        reason: "用户要求添加到第5天",
        tripId: "trip-agent-test",
        type: "ensure_trip_day_count",
      },
      {
        type: "add_place_to_day",
        dayIndex: 5,
        operationId: "op-add-yunnan-university",
        place: {
          category: "教育",
          name: "云南大学",
          provider: "amap",
          providerPlaceId: "B0YNU",
        },
        tripId: "trip-agent-test",
      },
    ],
    proposalId: "proposal-extend-day-5",
    summary: "把云南大学加入第5天",
    tripId: "trip-agent-test",
  };

  const previewResult = validateTripEditProposalPreview({ proposal, trip });

  assert.equal(previewResult.ok, true);
  if (!previewResult.ok) return;
  assert.equal(previewResult.data.preview[0]?.risk, "medium");
  assert.match(previewResult.data.preview[0]?.description ?? "", /第5天/);
  assert.match(previewResult.data.preview[1]?.description ?? "", /第5天/);

  const applyResult = applyTripEditProposalCommands(
    {
      proposal,
      trip,
    },
    makeDeterministicDeps(),
  );

  assert.equal(applyResult.ok, true);
  if (!applyResult.ok) return;
  assert.deepEqual(applyResult.data.appliedOperationIds, [
    "op-ensure-day-5",
    "op-add-yunnan-university",
  ]);
  assert.equal(applyResult.data.trip.days.length, 5);
  assert.deepEqual(
    applyResult.data.trip.days.map((day) => day.dayIndex),
    [1, 2, 3, 4, 5],
  );
  assert.equal(applyResult.data.trip.days[4]?.items[0]?.title, "云南大学");
  assert.equal(applyResult.data.trip.days[2]?.items.length, 0);
  assert.equal(applyResult.data.trip.endDate, "2026-06-19");
});

test("validateTripEditProposalPreview rejects add by missing dayIndex without an ensure operation", () => {
  const trip = makeFixtureTrip();
  const proposal = makeProposal({
    operations: [
      {
        type: "add_place_to_day",
        dayIndex: 5,
        operationId: "op-add-missing-day",
        place: {
          name: "云南大学",
        },
        tripId: "trip-agent-test",
      },
    ],
  });

  const result = validateTripEditProposalPreview({ proposal, trip });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "TARGET_NOT_FOUND");
});

test("applyTripEditProposalCommands 确认后可删除行程点并级联清理地点库", () => {
  const trip = makeFixtureTripWithItems();
  const result = applyTripEditProposalCommands(
    {
      proposal: makeRemoveProposal(),
      trip,
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.data.appliedOperationIds, ["op-remove-stone-forest"]);
  assert.equal(result.data.trip.days[0]?.items.length, 0);
  assert.equal(result.data.trip.places.length, 0);
  assert.equal(result.data.trip.updatedAt, "2026-06-02T08:00:00.000Z");
  assert.equal(trip.days[0]?.items.length, 1, "原 Trip 不应被原地修改");
});

test("applyTripEditProposalCommands 透传 command 层失败为 COMMAND_FAILED", () => {
  const trip = makeFixtureTrip();
  const proposal = makeProposal({
    operations: [
      {
        ...getAddOperation(),
        time: "下午三点半",
      },
    ],
  });
  const result = applyTripEditProposalCommands(
    {
      proposal,
      trip,
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "COMMAND_FAILED");
});

test("validateTripEditProposalPreview supports update_day_item previews without mutating Trip", () => {
  const trip = makeFixtureTripWithItems();
  const before = JSON.stringify(trip);
  const result = validateTripEditProposalPreview({
    proposal: makeUpdateProposal(),
    trip,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.preview[0]?.action, "update_day_item");
  assert.equal(result.data.preview[0]?.dayId, "day-1");
  assert.equal(result.data.preview[0]?.itemId, "item-stone-forest");
  assert.equal(result.data.preview[0]?.risk, "low");
  assert.deepEqual(result.data.preview[0], {
    action: "update_day_item",
    dayId: "day-1",
    description: "更新第一天的行程点：石林风景区",
    display: {
      changes: [
        {
          afterValue: "Stone Forest Scenic Area",
          beforeValue: "石林风景区",
          field: "title",
          label: "标题",
        },
        {
          afterValue: "09:30",
          beforeValue: "09:00",
          field: "time",
          label: "时间",
        },
        {
          afterValue: "Arrive early",
          beforeValue: "未设置",
          field: "note",
          label: "备注",
        },
      ],
      kind: "update_day_item",
      targetName: "石林风景区",
    },
    impact: [
      "标题：石林风景区 -> Stone Forest Scenic Area",
      "时间：09:00 -> 09:30",
      "备注：Arrive early",
    ],
    itemId: "item-stone-forest",
    operationId: "op-update-stone-forest",
    risk: "low",
    targetName: "石林风景区",
  });
  assert.equal(JSON.stringify(trip), before);
});

test("validateTripEditProposalPreview supports move_day_item previews without mutating Trip", () => {
  const trip = makeFixtureTripWithItems();
  const before = JSON.stringify(trip);
  const result = validateTripEditProposalPreview({
    proposal: makeMoveProposal(),
    trip,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.preview[0]?.action, "move_day_item");
  assert.equal(result.data.preview[0]?.dayId, "day-2");
  assert.equal(result.data.preview[0]?.itemId, "item-stone-forest");
  assert.equal(result.data.preview[0]?.risk, "medium");
  assert.deepEqual(result.data.preview[0], {
    action: "move_day_item",
    dayId: "day-2",
    description: "移动行程点：石林风景区",
    display: {
      from: {
        dayId: "day-1",
        dayLabel: "第一天",
        position: 1,
      },
      kind: "move_day_item",
      targetName: "石林风景区",
      to: {
        dayId: "day-2",
        dayLabel: "第二天",
        position: 1,
      },
    },
    impact: ["从第一天移动到第二天", "目标位置：第 1 位"],
    itemId: "item-stone-forest",
    operationId: "op-move-stone-forest",
    risk: "medium",
    targetName: "石林风景区",
  });
  assert.equal(JSON.stringify(trip), before);
});

test("validateTripEditProposalPreview rejects update_day_item missing target item", () => {
  const trip = makeFixtureTripWithItems();
  const result = validateTripEditProposalPreview({
    proposal: makeUpdateProposal({
      operations: [
        {
          ...getUpdateOperation(),
          itemId: "item-not-exist",
        },
      ],
    }),
    trip,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "TARGET_NOT_FOUND");
});

test("validateTripEditProposalPreview rejects move_day_item target index out of range", () => {
  const trip = makeFixtureTripWithItems();
  const result = validateTripEditProposalPreview({
    proposal: makeMoveProposal({
      operations: [
        {
          ...getMoveOperation(),
          targetIndex: 10,
        },
      ],
    }),
    trip,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "INVALID_PROPOSAL");
});

test("applyTripEditProposalCommands can update an existing day item", () => {
  const trip = makeFixtureTripWithItems();
  const result = applyTripEditProposalCommands(
    {
      proposal: makeUpdateProposal(),
      trip,
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const updatedItem = result.data.trip.days[0]?.items[0];
  assert.deepEqual(result.data.appliedOperationIds, ["op-update-stone-forest"]);
  assert.equal(updatedItem?.title, "Stone Forest Scenic Area");
  assert.equal(updatedItem?.placeName, "Stone Forest Scenic Area");
  assert.equal(updatedItem?.time, "09:30");
  assert.equal(updatedItem?.note, "Arrive early");
  assert.equal(result.data.trip.places[0]?.name, "Stone Forest Scenic Area");
  assert.equal(
    trip.days[0]?.items[0]?.title === "Stone Forest Scenic Area",
    false,
  );
});

test("applyTripEditProposalCommands can move an existing day item across days", () => {
  const trip = makeFixtureTripWithItems();
  const result = applyTripEditProposalCommands(
    {
      proposal: makeMoveProposal(),
      trip,
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data.appliedOperationIds, ["op-move-stone-forest"]);
  assert.equal(result.data.trip.days[0]?.items.length, 0);
  assert.equal(result.data.trip.days[1]?.items[0]?.id, "item-stone-forest");
  assert.equal(trip.days[0]?.items.length, 1);
});
