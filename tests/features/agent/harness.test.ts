import assert from "node:assert/strict";
import test from "node:test";

import {
  type TripEditAddPlaceToDayOperation,
  type AgentHarnessModelContext,
  type TripEditProposal,
  runAgentHarnessTurn,
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
    id: "trip-agent-harness",
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
          {
            id: "item-green-lake",
            title: "翠湖公园",
            category: "景点",
            placeId: "place-green-lake",
            placeName: "翠湖公园",
          },
        ],
      },
      {
        id: "day-2",
        dayIndex: 2,
        title: "第二天",
        items: [
          {
            id: "item-green-lake-repeat",
            title: "翠湖公园夜游",
            category: "景点",
            placeId: "place-green-lake",
            placeName: "翠湖公园",
          },
        ],
      },
    ],
    places: [
      {
        id: "place-stone-forest",
        name: "石林风景区",
        category: "景点",
        isScheduled: true,
      },
      {
        id: "place-green-lake",
        name: "翠湖公园",
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
        time: "15:30",
        tripId: "trip-agent-harness",
      },
    ],
    proposalId: "proposal-harness-1",
    summary: "把斗南花卉市场加入第二天",
    tripId: "trip-agent-harness",
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
        tripId: "trip-agent-harness",
      },
    ],
    proposalId: "proposal-remove-harness-1",
    summary: "删除第一天的石林安排",
    tripId: "trip-agent-harness",
    ...overrides,
  };
}

function getAddOperation(): TripEditAddPlaceToDayOperation {
  const operation = getRequired(
    makeProposal().operations[0],
    "expected first operation",
  );

  if (operation.type !== "add_place_to_day") {
    throw new Error("Expected add_place_to_day operation");
  }

  return operation;
}

function makeDeterministicDeps(): TripCommandDeps {
  let idIndex = 0;

  return {
    clock: () => "2026-06-02T08:00:00.000Z",
    idGen: (prefix) => {
      idIndex += 1;
      return `${prefix}-HARNESS-${idIndex}`;
    },
  };
}

test("runAgentHarnessTurn 预览合法提案时不修改原 Trip", async () => {
  const trip = makeFixtureTrip();
  const before = JSON.stringify(trip);
  const seenContext: AgentHarnessModelContext[] = [];

  const result = await runAgentHarnessTurn({
    model: (context) => {
      seenContext.push(context);
      return makeProposal();
    },
    trip,
    userMessage: "把斗南花市加到第二天",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.status, "preview");
  assert.equal(result.data.proposal.proposalId, "proposal-harness-1");
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
        time: "15:30",
      },
      impact: ["新增地点：斗南花卉市场", "目标日期：第二天"],
      operationId: "op-add-dounan",
      risk: "low",
      targetName: "斗南花卉市场",
    },
  ]);
  assert.deepEqual(
    result.data.trace.map((event) => event.step),
    ["model_output_received", "proposal_validated", "waiting_for_confirmation"],
  );
  assert.equal(seenContext[0]?.trip.id, "trip-agent-harness");
  assert.equal(seenContext[0]?.userMessage, "把斗南花市加到第二天");
  assert.equal(JSON.stringify(trip), before);
});

test("runAgentHarnessTurn 把高风险删除作为 preview 状态返回，不直接执行", async () => {
  const trip = makeFixtureTripWithItems();
  const before = JSON.stringify(trip);
  const result = await runAgentHarnessTurn({
    model: () => makeRemoveProposal(),
    trip,
    userMessage: "删掉第一天的石林",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.status, "preview");
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

test("runAgentHarnessTurn 用户确认后可以应用高风险删除提案", async () => {
  const trip = makeFixtureTripWithItems();
  const result = await runAgentHarnessTurn(
    {
      confirmation: "confirmed",
      model: () => makeRemoveProposal(),
      trip,
      userMessage: "确认删除",
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.status, "applied");
  if (result.data.status !== "applied") return;

  assert.deepEqual(result.data.appliedOperationIds, ["op-remove-stone-forest"]);
  assert.equal(
    result.data.trip.days[0]?.items.some(
      (item) => item.id === "item-stone-forest",
    ),
    false,
  );
  assert.equal(
    result.data.trip.places.some((place) => place.id === "place-stone-forest"),
    false,
  );
  assert.equal(
    result.data.trip.places.some((place) => place.id === "place-green-lake"),
    true,
  );
  assert.equal(trip.days[0]?.items.length, 2);
});

test("runAgentHarnessTurn 用户确认后通过 commands 应用提案", async () => {
  const trip = makeFixtureTrip();
  const result = await runAgentHarnessTurn(
    {
      confirmation: "confirmed",
      model: () => makeProposal(),
      trip,
      userMessage: "确认添加",
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.status, "applied");
  if (result.data.status !== "applied") return;

  assert.deepEqual(result.data.appliedOperationIds, ["op-add-dounan"]);
  assert.equal(result.data.trip.places[0]?.id, "place-HARNESS-1");
  assert.equal(result.data.trip.places[0]?.name, "斗南花卉市场");
  assert.equal(result.data.trip.days[1]?.items[0]?.id, "item-HARNESS-2");
  assert.equal(result.data.trip.days[1]?.items[0]?.placeId, "place-HARNESS-1");
  assert.equal(result.data.trip.updatedAt, "2026-06-02T08:00:00.000Z");
  assert.deepEqual(
    result.data.trace.map((event) => event.step),
    ["model_output_received", "proposal_validated", "proposal_applied"],
  );
  assert.equal(trip.days[1]?.items.length, 0);
});

test("runAgentHarnessTurn 校验前就拒绝结构不合法的模型输出", async () => {
  const result = await runAgentHarnessTurn({
    model: () => ({ hello: "world" }),
    trip: makeFixtureTrip(),
    userMessage: "随便安排",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.equal(result.error.code, "INVALID_PROPOSAL");
  assert.deepEqual(
    result.trace.map((event) => event.step),
    ["model_output_received", "proposal_rejected"],
  );
});

test("runAgentHarnessTurn 把模型抛出的异常归类为 MODEL_FAILED", async () => {
  const result = await runAgentHarnessTurn({
    model: () => {
      throw new Error("mock model timeout");
    },
    trip: makeFixtureTrip(),
    userMessage: "帮我规划",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.equal(result.error.code, "MODEL_FAILED");
  assert.equal(result.error.message, "mock model timeout");
  assert.deepEqual(result.trace, [
    {
      code: "MODEL_FAILED",
      step: "proposal_rejected",
    },
  ]);
});

test("runAgentHarnessTurn 拒绝版本冲突的提案", async () => {
  const result = await runAgentHarnessTurn({
    model: () =>
      makeProposal({ expectedUpdatedAt: "2026-06-01T09:00:00.000Z" }),
    trip: makeFixtureTrip(),
    userMessage: "把斗南花市加到第二天",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.equal(result.error.code, "VERSION_CONFLICT");
});

test("runAgentHarnessTurn 拒绝目标日期不存在的提案", async () => {
  const proposal = makeProposal({
    operations: [
      {
        ...getAddOperation(),
        dayId: "day-not-exist",
      },
    ],
  });

  const result = await runAgentHarnessTurn({
    model: () => proposal,
    trip: makeFixtureTrip(),
    userMessage: "把斗南花市加到不存在的一天",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.equal(result.error.code, "TARGET_NOT_FOUND");
});

test("runAgentHarnessTurn 在确认阶段拦截已经应用过的 operationId", async () => {
  const result = await runAgentHarnessTurn({
    appliedOperationIds: new Set(["op-add-dounan"]),
    confirmation: "confirmed",
    model: () => makeProposal(),
    trip: makeFixtureTrip(),
    userMessage: "确认添加",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.equal(result.error.code, "DUPLICATE_OPERATION");
  assert.deepEqual(
    result.trace.map((event) => event.step),
    ["model_output_received", "proposal_validated", "proposal_rejected"],
  );
});

test("runAgentHarnessTurn 在 command 校验失败时保持原 Trip 不变（原子性）", async () => {
  const trip = makeFixtureTrip();
  const before = JSON.stringify(trip);
  const proposal = makeProposal({
    operations: [
      {
        ...getAddOperation(),
        time: "下午三点半",
      },
    ],
  });

  const result = await runAgentHarnessTurn(
    {
      confirmation: "confirmed",
      model: () => proposal,
      trip,
      userMessage: "确认添加",
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.equal(result.error.code, "COMMAND_FAILED");
  assert.equal(JSON.stringify(trip), before);
});
