import assert from "node:assert/strict";
import test from "node:test";

import {
  addChecklistItem,
  addChecklistItems,
  addMemo,
  addPlaceToDay,
  addTripDay,
  clearTripBudget,
  getTripPoiNoteLines,
  moveChecklistItem,
  moveDayItem,
  removeChecklistItem,
  removeChecklistItems,
  removeDayItem,
  removeTripDay,
  removeTripExpense,
  replaceTripDayItemsLayout,
  resizeTripDays,
  setTripBudget,
  setTripDayItemCost,
  setTripDayItemNote,
  setTripGeneralNote,
  type TripCommandDeps,
  toggleChecklistItem,
  updateChecklistItemTitle,
  updateDayItem,
  updateTripDayTitle,
  updateTripFields,
  upsertTripExpense,
} from "../../../features/trips/commands";
import type { Trip, TripChecklistItem } from "../../../features/trips/types";

function getRequired<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

function makeFixtureTrip(): {
  trip: Trip;
  setChecklist: (items: TripChecklistItem[]) => void;
} {
  const trip: Trip = {
    id: "trip-test",
    title: "测试行程",
    destination: "西安",
    currency: "CNY",
    status: "计划中",
    startDate: "2026-06-20",
    days: [
      {
        id: "day-1",
        dayIndex: 1,
        title: "第 1 天",
        items: [
          {
            id: "day-item-1",
            title: "大雁塔",
            category: "景点",
            placeId: "place-1",
            placeName: "大雁塔",
            iconKey: "landmark",
          },
          {
            id: "day-item-shared",
            title: "共享地点",
            category: "景点",
            placeId: "place-shared",
            placeName: "共享地点",
          },
        ],
      },
      {
        id: "day-2",
        dayIndex: 2,
        title: "第 2 天",
        items: [
          {
            id: "day-item-2",
            title: "钟楼",
            category: "景点",
            placeId: "place-2",
            placeName: "钟楼",
          },
          {
            id: "day-item-shared-2",
            title: "共享地点",
            category: "景点",
            placeId: "place-shared",
            placeName: "共享地点",
          },
        ],
      },
    ],
    places: [
      {
        id: "place-1",
        name: "大雁塔",
        category: "景点",
        isScheduled: true,
        iconKey: "landmark",
      },
      {
        id: "place-2",
        name: "钟楼",
        category: "景点",
        isScheduled: true,
      },
      {
        id: "place-shared",
        name: "共享地点",
        category: "景点",
        isScheduled: true,
      },
    ],
    transports: [],
    lodgings: [],
    generalNote: undefined,
    memos: [],
    checklistItems: [
      { id: "item-1", title: "身份证", isCompleted: false },
      { id: "item-2", title: "充电器", isCompleted: true },
    ],
    expenses: [
      {
        id: "expense-1",
        title: "午餐",
        amount: 88,
        category: "餐饮",
        currency: "CNY",
        dayId: "day-1",
        date: "2026-06-20",
        note: "两人",
        createdAt: "2026-06-01T01:00:00.000Z",
        updatedAt: "2026-06-01T01:00:00.000Z",
      },
    ],
    importSources: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };

  return {
    trip,
    setChecklist: (items) => {
      trip.checklistItems = items;
    },
  };
}

function makeDeterministicDeps(): TripCommandDeps {
  let idIndex = 0;

  return {
    idGen: (prefix) => {
      idIndex += 1;
      return `${prefix}-FIXED-${idIndex}`;
    },
    clock: () => "2026-06-15T10:00:00.000Z",
  };
}

test("toggleChecklistItem 切换已存在项的状态", () => {
  const { trip } = makeFixtureTrip();
  const result = toggleChecklistItem(
    trip,
    { itemId: "item-1" },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return; // TS narrow

  const toggled = result.data.trip.checklistItems.find(
    (item) => item.id === "item-1",
  );
  assert.equal(toggled?.isCompleted, true, "应翻转为 true");
  assert.equal(
    result.data.trip.updatedAt,
    "2026-06-15T10:00:00.000Z",
    "updatedAt 应更新",
  );
});

test("toggleChecklistItem 不可变：不修改入参 trip", () => {
  const { trip } = makeFixtureTrip();
  const before = JSON.stringify(trip);

  toggleChecklistItem(trip, { itemId: "item-1" }, makeDeterministicDeps());

  assert.equal(JSON.stringify(trip), before, "入参 trip 必须保持不变");
});

test("toggleChecklistItem 找不到 itemId 时返回 NOT_FOUND", () => {
  const { trip } = makeFixtureTrip();
  const result = toggleChecklistItem(
    trip,
    { itemId: "item-not-exist" },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "NOT_FOUND");
});

test("addChecklistItem 添加新项时 itemId / title / isCompleted 正确", () => {
  const { trip } = makeFixtureTrip();
  const result = addChecklistItem(
    trip,
    { title: " 雨伞 " },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const added = result.data.trip.checklistItems.at(-1);
  assert.equal(added?.id, "checklist-FIXED-1");
  assert.equal(added?.title, "雨伞");
  assert.equal(added?.isCompleted, false);
  assert.equal(result.data.trip.checklistItems.length, 3);
  assert.equal(result.data.itemId, "checklist-FIXED-1");
  assert.equal(result.data.trip.updatedAt, "2026-06-15T10:00:00.000Z");
});

test("addChecklistItem 空标题返回 INVALID_INPUT", () => {
  const { trip } = makeFixtureTrip();

  for (const title of ["", "   "]) {
    const result = addChecklistItem(trip, { title }, makeDeterministicDeps());

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "INVALID_INPUT");
  }
});

test("addChecklistItem 不可变：不修改入参 trip", () => {
  const { trip } = makeFixtureTrip();
  const before = JSON.stringify(trip);

  addChecklistItem(trip, { title: "雨伞" }, makeDeterministicDeps());

  assert.equal(JSON.stringify(trip), before);
});

test("removeChecklistItem 删除已存在项", () => {
  const { trip } = makeFixtureTrip();
  const result = removeChecklistItem(
    trip,
    { itemId: "item-1" },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.trip.checklistItems.length, 1);
  assert.equal(result.data.trip.checklistItems[0]?.id, "item-2");
  assert.equal(result.data.trip.updatedAt, "2026-06-15T10:00:00.000Z");
});

test("removeChecklistItem 找不到 itemId 时返回 NOT_FOUND", () => {
  const { trip } = makeFixtureTrip();
  const before = JSON.stringify(trip);
  const result = removeChecklistItem(
    trip,
    { itemId: "item-not-exist" },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "NOT_FOUND");
  assert.equal(JSON.stringify(trip), before);
});

test("removeChecklistItems 批量删除并去重", () => {
  const { trip } = makeFixtureTrip();
  const result = removeChecklistItems(
    trip,
    { itemIds: ["item-1", "item-1", "item-2"] },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.removedCount, 2);
  assert.deepEqual(result.data.trip.checklistItems, []);
});

test("removeChecklistItems 有不存在的 itemId 时整个操作失败", () => {
  const { trip } = makeFixtureTrip();
  const before = JSON.stringify(trip);
  const result = removeChecklistItems(
    trip,
    { itemIds: ["item-1", "missing"] },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "NOT_FOUND");
  assert.equal(JSON.stringify(trip), before);
});

test("updateChecklistItemTitle 更新标题并 trim", () => {
  const { trip } = makeFixtureTrip();
  const result = updateChecklistItemTitle(
    trip,
    { itemId: "item-1", title: " 护照 " },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.trip.checklistItems[0]?.title, "护照");
  assert.equal(trip.checklistItems[0]?.title, "身份证");
});

test("updateChecklistItemTitle 空标题返回 INVALID_INPUT", () => {
  const { trip } = makeFixtureTrip();
  const result = updateChecklistItemTitle(
    trip,
    { itemId: "item-1", title: " " },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "INVALID_INPUT");
});

test("moveChecklistItem 支持上移和下移", () => {
  const { trip } = makeFixtureTrip();
  const movedDown = moveChecklistItem(
    trip,
    { itemId: "item-1", direction: "down" },
    makeDeterministicDeps(),
  );

  assert.equal(movedDown.ok, true);
  if (!movedDown.ok) return;
  assert.deepEqual(
    movedDown.data.trip.checklistItems.map((item) => item.id),
    ["item-2", "item-1"],
  );

  const movedUp = moveChecklistItem(
    movedDown.data.trip,
    { itemId: "item-1", direction: "up" },
    makeDeterministicDeps(),
  );

  assert.equal(movedUp.ok, true);
  if (!movedUp.ok) return;
  assert.deepEqual(
    movedUp.data.trip.checklistItems.map((item) => item.id),
    ["item-1", "item-2"],
  );
});

test("moveChecklistItem 越界时返回 INVALID_INPUT", () => {
  const { trip } = makeFixtureTrip();
  const result = moveChecklistItem(
    trip,
    { itemId: "item-1", direction: "up" },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "INVALID_INPUT");
});

test("upsertTripExpense 新增行程内开销并关联日期", () => {
  const { trip } = makeFixtureTrip();
  const result = upsertTripExpense(
    trip,
    {
      amount: 128.5,
      category: "交通",
      dayId: "day-2",
      note: "机场大巴",
      placeId: "place-bus",
      placeName: "机场巴士",
      title: "机场大巴",
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.expenseId, "expense-FIXED-1");
  assert.equal(result.data.trip.expenses.length, 2);
  assert.equal(result.data.trip.expenses[0]?.date, "2026-06-21");
  assert.equal(result.data.trip.expenses[0]?.placeId, "place-bus");
  assert.equal(result.data.trip.expenses[0]?.note, "机场大巴");
  assert.equal(result.data.trip.updatedAt, "2026-06-15T10:00:00.000Z");
  assert.equal(trip.expenses.length, 1);
});

test("upsertTripExpense 编辑已有开销并保留 createdAt", () => {
  const { trip } = makeFixtureTrip();
  const result = upsertTripExpense(
    trip,
    {
      amount: 99,
      category: "餐饮",
      dayId: "day-1",
      expenseId: "expense-1",
      title: "晚餐",
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.expenseId, "expense-1");
  assert.equal(result.data.trip.expenses[0]?.title, "晚餐");
  assert.equal(result.data.trip.expenses[0]?.amount, 99);
  assert.equal(
    result.data.trip.expenses[0]?.createdAt,
    "2026-06-01T01:00:00.000Z",
  );
  assert.equal(
    result.data.trip.expenses[0]?.updatedAt,
    "2026-06-15T10:00:00.000Z",
  );
});

test("upsertTripExpense 找不到关联日期时失败", () => {
  const { trip } = makeFixtureTrip();
  const before = JSON.stringify(trip);
  const result = upsertTripExpense(
    trip,
    {
      amount: 12,
      category: "其他",
      dayId: "missing-day",
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "NOT_FOUND");
  assert.equal(JSON.stringify(trip), before);
});

test("removeTripExpense 删除独立开销", () => {
  const { trip } = makeFixtureTrip();
  const result = removeTripExpense(
    trip,
    { expenseId: "expense-1" },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data.trip.expenses, []);
  assert.equal(result.data.trip.updatedAt, "2026-06-15T10:00:00.000Z");
});

test("setTripDayItemCost 更新日程项花费和记录时间", () => {
  const { trip } = makeFixtureTrip();
  const result = setTripDayItemCost(
    trip,
    { amount: 66.6, dayId: "day-1", itemId: "day-item-1" },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.trip.days[0]?.items[0]?.cost, 66.6);
  assert.equal(
    result.data.trip.days[0]?.items[0]?.costRecordedAt,
    "2026-06-15T10:00:00.000Z",
  );
  assert.equal(trip.days[0]?.items[0]?.cost, undefined);
});

test("setTripDayItemNote 保存地点备注并 trim", () => {
  const { trip } = makeFixtureTrip();
  const result = setTripDayItemNote(
    trip,
    { dayId: "day-1", itemId: "day-item-1", note: "  下午人多，早点去  " },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.trip.days[0]?.items[0]?.note, "下午人多，早点去");
  assert.equal(result.data.trip.updatedAt, "2026-06-15T10:00:00.000Z");
});

test("setTripGeneralNote 保存行程总备注并 trim", () => {
  const { trip } = makeFixtureTrip();
  const before = JSON.stringify(trip);
  const result = setTripGeneralNote(
    trip,
    { note: "  这趟重点看夜景  " },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.trip.generalNote, "这趟重点看夜景");
  assert.equal(result.data.trip.updatedAt, "2026-06-15T10:00:00.000Z");
  assert.equal(JSON.stringify(trip), before);
});

test("setTripGeneralNote 空内容会清空行程总备注", () => {
  const { trip } = makeFixtureTrip();
  const result = setTripGeneralNote(
    { ...trip, generalNote: "旧备注" },
    { note: "   " },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.trip.generalNote, undefined);
});

test("getTripPoiNoteLines 汇总每天地点备注", () => {
  const { trip } = makeFixtureTrip();
  const result = getTripPoiNoteLines({
    ...trip,
    days: trip.days.map((day) =>
      day.id === "day-1"
        ? {
            ...day,
            items: [
              {
                ...getRequired(day.items[0], "expected first day item"),
                note: "  下午人多，早点去  ",
              },
              {
                id: "day-item-2",
                title: "钟楼",
                category: "景点",
                note: "夜景好看",
              },
            ],
          }
        : day,
    ),
  });

  assert.deepEqual(result, [
    {
      dayId: "day-1",
      dayTitle: "第 1 天",
      itemId: "day-item-1",
      placeName: "大雁塔",
      note: "下午人多，早点去",
    },
    {
      dayId: "day-1",
      dayTitle: "第 1 天",
      itemId: "day-item-2",
      placeName: "钟楼",
      note: "夜景好看",
    },
  ]);
});

test("updateTripFields 更新基础字段并保留未传字段", () => {
  const { trip } = makeFixtureTrip();
  const result = updateTripFields(
    trip,
    {
      changes: {
        title: "  西安深度游  ",
        currency: "USD",
      },
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.trip.title, "西安深度游");
  assert.equal(result.data.trip.currency, "USD");
  assert.equal(result.data.trip.startDate, "2026-06-20");
  assert.equal(result.data.trip.endDate, undefined);
});

test("addTripDay 新增一天并根据开始日期更新结束日期", () => {
  const { trip } = makeFixtureTrip();
  const result = addTripDay(trip, {}, makeDeterministicDeps());

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.day.id, "day-3-FIXED-1");
  assert.equal(result.data.day.dayIndex, 3);
  assert.equal(result.data.day.title, "第三天");
  assert.equal(result.data.trip.days.length, 3);
  assert.equal(result.data.trip.endDate, "2026-06-22");
  assert.equal(trip.days.length, 2);
});

test("resizeTripDays 扩展天数时补空 day 并更新日期范围", () => {
  const { trip } = makeFixtureTrip();
  const result = resizeTripDays(
    trip,
    {
      dayCount: 4,
      endDate: "2026-06-23",
      startDate: "2026-06-20",
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.addedDays.length, 2);
  assert.equal(result.data.removedDays.length, 0);
  assert.deepEqual(
    result.data.trip.days.map((day) => [
      day.id,
      day.dayIndex,
      day.title,
      day.items.length,
    ]),
    [
      ["day-1", 1, "第一天", 2],
      ["day-2", 2, "第二天", 2],
      ["day-3-FIXED-1", 3, "第三天", 0],
      ["day-4-FIXED-2", 4, "第四天", 0],
    ],
  );
  assert.equal(result.data.trip.startDate, "2026-06-20");
  assert.equal(result.data.trip.endDate, "2026-06-23");
  assert.equal(result.data.trip.updatedAt, "2026-06-15T10:00:00.000Z");
  assert.equal(trip.days.length, 2);
});

test("resizeTripDays 缩短天数时删除超出安排并清理仅被超出天引用的地点", () => {
  const { trip } = makeFixtureTrip();
  const tripWithThirdDay: Trip = {
    ...trip,
    days: [
      ...trip.days,
      {
        id: "day-3",
        dayIndex: 3,
        title: "第三天",
        items: [
          {
            id: "day-item-3",
            title: "城墙",
            category: "景点",
            placeId: "place-3",
            placeName: "城墙",
          },
          {
            id: "day-item-shared-3",
            title: "共享地点",
            category: "景点",
            placeId: "place-shared",
            placeName: "共享地点",
          },
        ],
      },
    ],
    places: [
      ...trip.places,
      {
        id: "place-3",
        name: "城墙",
        category: "景点",
        isScheduled: true,
      },
    ],
  };
  const result = resizeTripDays(
    tripWithThirdDay,
    {
      dayCount: 2,
      endDate: "2026-06-21",
      startDate: "2026-06-20",
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.addedDays.length, 0);
  assert.deepEqual(
    result.data.removedDays.map((day) => day.id),
    ["day-3"],
  );
  assert.deepEqual(
    result.data.trip.days.map((day) => day.id),
    ["day-1", "day-2"],
  );
  assert.equal(
    result.data.trip.places.some((place) => place.id === "place-3"),
    false,
  );
  assert.equal(
    result.data.trip.places.some((place) => place.id === "place-shared"),
    true,
  );
  assert.equal(result.data.trip.startDate, "2026-06-20");
  assert.equal(result.data.trip.endDate, "2026-06-21");
  assert.equal(tripWithThirdDay.days.length, 3);
});

test("resizeTripDays 至少保留一天", () => {
  const { trip } = makeFixtureTrip();
  const result = resizeTripDays(trip, { dayCount: 0 }, makeDeterministicDeps());

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "INVALID_INPUT");
});

test("updateTripDayTitle 更新某一天标题并 trim", () => {
  const { trip } = makeFixtureTrip();
  const result = updateTripDayTitle(
    trip,
    { dayId: "day-1", title: "  抵达西安  " },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.trip.days[0]?.title, "抵达西安");
  assert.equal(trip.days[0]?.title, "第 1 天");
});

test("removeTripDay 删除一天后重新编号并清理仅被该天引用的地点", () => {
  const { trip } = makeFixtureTrip();
  const result = removeTripDay(
    trip,
    { dayId: "day-1" },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.removedDayIndex, 0);
  assert.equal(result.data.removedDay.id, "day-1");
  assert.deepEqual(
    result.data.trip.days.map((day) => [day.id, day.dayIndex, day.title]),
    [["day-2", 1, "第一天"]],
  );
  assert.equal(
    result.data.trip.places.some((place) => place.id === "place-1"),
    false,
  );
  assert.equal(
    result.data.trip.places.some((place) => place.id === "place-shared"),
    true,
  );
  assert.equal(result.data.trip.endDate, "2026-06-20");
});

test("removeTripDay 至少保留一天", () => {
  const { trip } = makeFixtureTrip();
  const result = removeTripDay(
    { ...trip, days: [getRequired(trip.days[0], "expected first trip day")] },
    { dayId: "day-1" },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "INVALID_INPUT");
});

test("setTripBudget 设置预算金额并标准化货币", () => {
  const { trip } = makeFixtureTrip();
  const result = setTripBudget(
    trip,
    { amount: 1999.999, currency: "usd" },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data.trip.budget, { amount: 2000, currency: "USD" });
  assert.equal(result.data.trip.updatedAt, "2026-06-15T10:00:00.000Z");
});

test("clearTripBudget 清除预算", () => {
  const { trip } = makeFixtureTrip();
  const result = clearTripBudget(
    { ...trip, budget: { amount: 3000, currency: "CNY" } },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.trip.budget, undefined);
});

test("addPlaceToDay 新增地点时同步写入 days 和 places", () => {
  const { trip } = makeFixtureTrip();
  const result = addPlaceToDay(
    trip,
    {
      dayId: "day-2",
      targetIndex: 1,
      time: "18:30",
      note: "看夜景",
      recommendationReason: "适合傍晚",
      place: {
        name: "大唐不夜城",
        category: "景点",
        provider: "amap",
        providerPlaceId: "B0TEST",
      },
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.placeId, "place-FIXED-1");
  assert.equal(result.data.itemId, "item-FIXED-2");
  assert.equal(result.data.trip.days[1]?.items[1]?.title, "大唐不夜城");
  assert.equal(result.data.trip.days[1]?.items[1]?.time, "18:30");
  assert.equal(result.data.trip.days[1]?.items[1]?.placeId, "place-FIXED-1");
  assert.equal(result.data.trip.places.at(-1)?.providerPlaceId, "B0TEST");
  assert.equal(
    result.data.trip.places.at(-1)?.externalRefs?.amapPoiId,
    "B0TEST",
  );
  assert.equal(trip.days[1]?.items.length, 2);
});

test("addPlaceToDay treats sourcePlaceId as external fallback, not local TripPlace id", () => {
  const { trip } = makeFixtureTrip();
  const result = addPlaceToDay(
    trip,
    {
      dayId: "day-1",
      place: {
        name: "独克宗古城",
        category: "景点",
        provider: "amap",
        sourcePlaceId: "B03770LV82",
      },
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const addedPlace = result.data.trip.places.at(-1);
  const addedItem = result.data.trip.days[0]?.items.at(-1);

  assert.equal(addedPlace?.id, "place-FIXED-1");
  assert.equal(addedPlace?.providerPlaceId, "B03770LV82");
  assert.equal(addedPlace?.externalRefs?.amapPoiId, "B03770LV82");
  assert.equal(addedItem?.placeId, "place-FIXED-1");
});

test("addPlaceToDay 无效时间返回 INVALID_INPUT", () => {
  const { trip } = makeFixtureTrip();
  const result = addPlaceToDay(
    trip,
    {
      dayId: "day-1",
      time: "晚上",
      place: { name: "回民街" },
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "INVALID_INPUT");
});

test("updateDayItem 更新标题时同步地点库名称", () => {
  const { trip } = makeFixtureTrip();
  const result = updateDayItem(
    trip,
    {
      dayId: "day-1",
      itemId: "day-item-1",
      changes: {
        title: "  大雁塔北广场  ",
        time: "20:00",
        note: "看音乐喷泉",
      },
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.trip.days[0]?.items[0]?.title, "大雁塔北广场");
  assert.equal(result.data.trip.days[0]?.items[0]?.placeName, "大雁塔北广场");
  assert.equal(result.data.trip.days[0]?.items[0]?.time, "20:00");
  assert.equal(
    result.data.trip.places.find((place) => place.id === "place-1")?.name,
    "大雁塔北广场",
  );
});

test("moveDayItem 支持跨天移动并保持 places 不变", () => {
  const { trip } = makeFixtureTrip();
  const result = moveDayItem(
    trip,
    {
      fromDayId: "day-1",
      toDayId: "day-2",
      itemId: "day-item-1",
      targetIndex: 1,
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.data.trip.days[0]?.items.map((item) => item.id),
    ["day-item-shared"],
  );
  assert.deepEqual(
    result.data.trip.days[1]?.items.map((item) => item.id),
    ["day-item-2", "day-item-1", "day-item-shared-2"],
  );
  assert.equal(result.data.trip.places.length, 3);
});

test("replaceTripDayItemsLayout 支持跨天排序并清理删除后未引用地点", () => {
  const { trip } = makeFixtureTrip();
  const result = replaceTripDayItemsLayout(
    trip,
    {
      days: [
        { dayId: "day-1", itemIds: ["day-item-shared-2", "day-item-shared"] },
        { dayId: "day-2", itemIds: ["day-item-2"] },
      ],
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.data.trip.days[0]?.items.map((item) => item.id),
    ["day-item-shared-2", "day-item-shared"],
  );
  assert.deepEqual(
    result.data.trip.days[1]?.items.map((item) => item.id),
    ["day-item-2"],
  );
  assert.equal(
    result.data.trip.places.some((place) => place.id === "place-1"),
    false,
  );
  assert.equal(
    result.data.trip.places.some((place) => place.id === "place-shared"),
    true,
  );
  assert.equal(result.data.trip.updatedAt, "2026-06-15T10:00:00.000Z");
});

test("replaceTripDayItemsLayout 拒绝重复安排同一个地点条目", () => {
  const { trip } = makeFixtureTrip();
  const result = replaceTripDayItemsLayout(
    trip,
    {
      days: [
        { dayId: "day-1", itemIds: ["day-item-1"] },
        { dayId: "day-2", itemIds: ["day-item-1"] },
      ],
    },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "INVALID_INPUT");
});

test("removeDayItem 删除最后一次引用时清理地点库", () => {
  const { trip } = makeFixtureTrip();
  const result = removeDayItem(
    trip,
    { dayId: "day-1", itemId: "day-item-1" },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    result.data.trip.days[0]?.items.some((item) => item.id === "day-item-1"),
    false,
  );
  assert.equal(
    result.data.trip.places.some((place) => place.id === "place-1"),
    false,
  );
  assert.equal(
    result.data.trip.places.some((place) => place.id === "place-shared"),
    true,
  );
});

test("removeDayItem 删除共享地点的一次引用时保留地点库", () => {
  const { trip } = makeFixtureTrip();
  const result = removeDayItem(
    trip,
    { dayId: "day-1", itemId: "day-item-shared" },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    result.data.trip.places.some((place) => place.id === "place-shared"),
    true,
  );
});

test("removeDayItem 不会把同名但不同 placeId 的行程点当成同一地点引用", () => {
  const { trip } = makeFixtureTrip();
  trip.days[1]?.items.push({
    id: "day-item-same-name-other-place",
    title: "大雁塔",
    category: "景点",
    placeId: "place-2",
    placeName: "大雁塔",
  });

  const result = removeDayItem(
    trip,
    { dayId: "day-1", itemId: "day-item-1" },
    makeDeterministicDeps(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    result.data.trip.places.some((place) => place.id === "place-1"),
    false,
  );
  assert.equal(
    result.data.trip.places.some((place) => place.id === "place-2"),
    true,
  );
});

test("addMemo 和 addChecklistItems 支持批量新增", () => {
  const { trip } = makeFixtureTrip();
  const memoResult = addMemo(
    trip,
    { title: "  买票  ", detail: "提前预约", pinned: true },
    makeDeterministicDeps(),
  );

  assert.equal(memoResult.ok, true);
  if (!memoResult.ok) return;
  assert.equal(memoResult.data.memoId, "memo-FIXED-1");
  assert.equal(memoResult.data.trip.memos[0]?.title, "买票");

  const checklistResult = addChecklistItems(
    trip,
    { titles: [" 护照 ", "", "药品"] },
    makeDeterministicDeps(),
  );

  assert.equal(checklistResult.ok, true);
  if (!checklistResult.ok) return;
  assert.deepEqual(checklistResult.data.itemIds, [
    "checklist-FIXED-1",
    "checklist-FIXED-2",
  ]);
  assert.deepEqual(
    checklistResult.data.trip.checklistItems
      .slice(-2)
      .map((item) => item.title),
    ["护照", "药品"],
  );
});
