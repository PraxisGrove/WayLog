import assert from "node:assert/strict";
import test from "node:test";

import {
  formatExpenseAmount,
  getTripDayExpenseTotal,
  getTripExpenseEntries,
  getTripExpenseEntriesForDay,
  getTripExpenseEntriesForPlace,
  getTripExpenseSummary,
  getTripStandaloneExpenseTotal,
  getTripTotalCost,
  inferExpenseCategoryFromPlaceCategory,
  normalizeExpenseCurrency,
} from "../../../features/trips/expenses";
import type { Trip } from "../../../features/trips/types";

function getRequired<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

const trip: Trip = {
  id: "trip-budget",
  title: "西安 3 日行",
  destination: "西安",
  currency: "CNY",
  startDate: "2026-06-12",
  endDate: "2026-06-14",
  status: "计划中",
  budget: {
    amount: 1000,
    currency: "CNY",
  },
  days: [
    {
      id: "day-1",
      dayIndex: 1,
      title: "第一天",
      items: [
        {
          id: "item-1",
          title: "陕西历史博物馆",
          category: "景点",
          placeId: "place-1",
          placeName: "陕西历史博物馆",
          cost: 30,
          costRecordedAt: "2026-06-12T10:00:00.000Z",
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
      id: "place-1",
      name: "陕西历史博物馆",
      category: "景点",
      isScheduled: true,
    },
  ],
  transports: [],
  lodgings: [],
  memos: [],
  checklistItems: [],
  expenses: [
    {
      id: "expense-1",
      title: "往返高铁",
      amount: 520,
      category: "交通",
      currency: "CNY",
      createdAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T10:00:00.000Z",
    },
    {
      id: "expense-2",
      title: "酒店",
      amount: 300,
      category: "住宿",
      currency: "CNY",
      dayId: "day-1",
      date: "2026-06-12",
      createdAt: "2026-06-02T10:00:00.000Z",
      updatedAt: "2026-06-02T10:00:00.000Z",
    },
    {
      id: "expense-3",
      title: "讲解器",
      amount: 20,
      category: "活动",
      currency: "CNY",
      placeId: "place-1",
      placeName: "陕西历史博物馆",
      dayId: "day-1",
      date: "2026-06-12",
      createdAt: "2026-06-03T10:00:00.000Z",
      updatedAt: "2026-06-03T10:00:00.000Z",
    },
  ],
  importSources: [],
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

test("trip expense total includes standalone expenses and day item costs", () => {
  assert.equal(getTripTotalCost(trip), 870);
  assert.equal(
    getTripDayExpenseTotal(
      trip,
      getRequired(trip.days[0], "expected first trip day"),
    ),
    350,
  );
});

test("trip expense summary groups by category and budget remaining", () => {
  const summary = getTripExpenseSummary(trip);

  assert.equal(summary.totalAmount, 870);
  assert.equal(summary.remainingAmount, 130);
  assert.deepEqual(
    summary.categorySummaries.map((item) => [
      item.category,
      item.amount,
      item.count,
    ]),
    [
      ["交通", 520, 1],
      ["住宿", 300, 1],
      ["门票", 30, 1],
      ["活动", 20, 1],
    ],
  );
});

test("place expense entries include linked standalone costs and matching day item costs", () => {
  const entries = getTripExpenseEntriesForPlace(
    trip,
    getRequired(trip.places[0], "expected first trip place"),
  );

  assert.equal(entries.length, 2);
  assert.equal(
    entries.reduce((total, entry) => total + entry.amount, 0),
    50,
  );
});

test("expense category inference covers trip place categories", () => {
  assert.deepEqual(
    (["景点", "餐厅", "酒店", "交通", "购物", "其他"] as const).map(
      (category) => [category, inferExpenseCategoryFromPlaceCategory(category)],
    ),
    [
      ["景点", "门票"],
      ["餐厅", "餐饮"],
      ["酒店", "住宿"],
      ["交通", "交通"],
      ["购物", "购物"],
      ["其他", "其他"],
    ],
  );
});

test("expense currency falls back to default for empty values", () => {
  assert.equal(normalizeExpenseCurrency(""), "CNY");
  assert.equal(normalizeExpenseCurrency("   "), "CNY");
  assert.equal(normalizeExpenseCurrency("¥"), "CNY");
  assert.equal(normalizeExpenseCurrency("usd"), "USD");
});

test("formatExpenseAmount uses currency code metadata instead of raw symbols", () => {
  assert.equal(formatExpenseAmount(1234, "CNY"), "¥1,234");
  assert.equal(formatExpenseAmount(1234, "USD"), "$1,234");
});

test("standalone expense total only includes independent records", () => {
  assert.equal(getTripStandaloneExpenseTotal(trip), 840);
});

test("day expense entries mix scheduled item costs and standalone day records", () => {
  const entries = getTripExpenseEntriesForDay(
    trip,
    getRequired(trip.days[0], "expected first trip day"),
  );

  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((entry) => [entry.title, entry.source, entry.amount]),
    [
      ["陕西历史博物馆", "dayItem", 30],
      ["讲解器", "expense", 20],
      ["酒店", "expense", 300],
    ],
  );
});

test("JSON round-trip preserves all expense data", () => {
  // Simulate the full save-to-storage and read-from-storage cycle
  const json = JSON.stringify(trip);
  const parsed = JSON.parse(json) as Trip;

  // Verify expenses survived JSON round-trip
  assert.equal(parsed.expenses.length, trip.expenses.length);
  assert.equal(getTripTotalCost(parsed), getTripTotalCost(trip));
  assert.equal(getTripTotalCost(parsed), 870);

  // Verify each expense's amount survived
  parsed.expenses.forEach((expense) => {
    assert.equal(typeof expense.amount, "number");
    assert.ok(Number.isFinite(expense.amount));
  });

  // Verify expense entries are reconstructed correctly from parsed data
  assert.equal(
    getTripExpenseEntries(parsed).length,
    getTripExpenseEntries(trip).length,
  );

  // Verify budget survived
  const parsedBudget = parsed.budget;
  if (!parsedBudget) {
    throw new Error("budget should survive JSON round-trip");
  }

  assert.equal(parsedBudget.amount, 1000);
  assert.equal(parsedBudget.currency, "CNY");
});

test("JSON round-trip with newly added expense preserves it", () => {
  // Simulate what saveExpenseAndBudget does: add a new expense to the trip
  const newExpense = {
    id: "expense-new-test",
    title: "午餐",
    amount: 128.5,
    category: "餐饮" as const,
    currency: "CNY",
    date: "2026-06-12",
    dayId: "day-1",
    createdAt: "2026-06-12T12:00:00.000Z",
    updatedAt: "2026-06-12T12:00:00.000Z",
  };

  const updatedTrip: Trip = {
    ...trip,
    expenses: [newExpense, ...trip.expenses],
    updatedAt: new Date().toISOString(),
  };

  // Verify before round-trip
  assert.equal(getTripTotalCost(updatedTrip), 870 + 128.5);
  assert.equal(updatedTrip.expenses.length, 4);

  // JSON round-trip
  const json = JSON.stringify(updatedTrip);
  const parsed = JSON.parse(json) as Trip;

  // Verify after round-trip
  assert.equal(
    parsed.expenses.length,
    4,
    "all 4 expenses should survive JSON round-trip",
  );
  assert.equal(
    getTripTotalCost(parsed),
    998.5,
    "total cost should be preserved",
  );

  // Verify the new expense is first in the array
  assert.equal(parsed.expenses[0].id, "expense-new-test");
  assert.equal(parsed.expenses[0].amount, 128.5);
  assert.equal(parsed.expenses[0].category, "餐饮");
});

test("expenses array survives double JSON round-trip (simulating multiple saves)", () => {
  // First round-trip
  let tripJson = JSON.stringify(trip);
  let parsed = JSON.parse(tripJson) as Trip;

  // Modify (like saveExpenseAndBudget)
  parsed = {
    ...parsed,
    expenses: [
      {
        id: "expense-round2",
        title: "晚餐",
        amount: 200,
        category: "餐饮" as const,
        currency: "CNY",
        dayId: "day-1",
        date: "2026-06-12",
        createdAt: "2026-06-12T18:00:00.000Z",
        updatedAt: "2026-06-12T18:00:00.000Z",
      },
      ...parsed.expenses,
    ],
    updatedAt: new Date().toISOString(),
  };

  // Second round-trip
  tripJson = JSON.stringify(parsed);
  const parsedAgain = JSON.parse(tripJson) as Trip;

  assert.equal(parsedAgain.expenses.length, 4);
  assert.equal(getTripTotalCost(parsedAgain), 1070);

  // All amounts should be valid numbers
  parsedAgain.expenses.forEach((expense, index) => {
    assert.equal(
      typeof expense.amount,
      "number",
      `expense ${index} amount should be a number`,
    );
    assert.ok(
      Number.isFinite(expense.amount),
      `expense ${index} amount should be finite`,
    );
  });
});
