import {
  DEFAULT_TRIP_CURRENCY_CODE,
  formatTripCurrencyAmount,
  normalizeTripCurrencyCode,
} from "./currency";
import { addDaysToDateKey } from "./date";
import { doesTripDayItemMatchPlace } from "./day-items";
import type {
  Trip,
  TripDay,
  TripDayItem,
  TripExpense,
  TripExpenseCategory,
  TripPlace,
} from "./types";

export const DEFAULT_TRIP_CURRENCY = DEFAULT_TRIP_CURRENCY_CODE;

export const tripExpenseCategories: TripExpenseCategory[] = [
  "交通",
  "住宿",
  "餐饮",
  "门票",
  "购物",
  "活动",
  "其他",
];

export const tripExpenseCategoryIcons: Record<TripExpenseCategory, string> = {
  交通: "directions-transit",
  住宿: "hotel",
  餐饮: "restaurant",
  门票: "confirmation-number",
  购物: "shopping-bag",
  活动: "local-activity",
  其他: "receipt-long",
};

export type TripExpenseEntrySource = "dayItem" | "expense";

export type TripExpenseEntry = {
  id: string;
  amount: number;
  category: TripExpenseCategory;
  currency: string;
  date?: string;
  dayId?: string;
  itemId?: string;
  note?: string;
  placeId?: string;
  placeName?: string;
  recordedAt?: string;
  source: TripExpenseEntrySource;
  title: string;
};

export type TripExpenseCategorySummary = {
  amount: number;
  category: TripExpenseCategory;
  count: number;
};

export type TripExpenseDaySummary = {
  amount: number;
  count: number;
  date?: string;
  day: TripDay;
};

export type TripExpenseSummary = {
  budgetAmount?: number;
  categorySummaries: TripExpenseCategorySummary[];
  daySummaries: TripExpenseDaySummary[];
  entries: TripExpenseEntry[];
  recordedCount: number;
  remainingAmount?: number;
  totalAmount: number;
};

export function normalizeExpenseAmount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.round(value * 100) / 100;
}

export function normalizeExpenseCurrency(value: unknown): string {
  return normalizeTripCurrencyCode(value);
}

export function normalizeExpenseCategory(
  value: unknown,
  fallback: TripExpenseCategory = "其他",
): TripExpenseCategory {
  return tripExpenseCategories.includes(value as TripExpenseCategory)
    ? (value as TripExpenseCategory)
    : fallback;
}

export function parseExpenseAmountInput(value: string): {
  amount?: number;
  error?: string;
} {
  const normalizedValue = value.trim().replace(/,/g, "").replace("，", ".");

  if (!normalizedValue) {
    return {};
  }

  if (!/^\d+(\.\d{0,2})?$/.test(normalizedValue)) {
    return { error: "金额最多保留 2 位小数" };
  }

  const amount = Number(normalizedValue);

  if (!Number.isFinite(amount)) {
    return { error: "请填写有效金额" };
  }

  return { amount: normalizeExpenseAmount(amount) };
}

export function formatExpenseAmount(
  value: number | undefined,
  currency: string = DEFAULT_TRIP_CURRENCY,
): string {
  const amount = normalizeExpenseAmount(value);
  return formatTripCurrencyAmount(amount, currency);
}

export function formatExpenseInputValue(value: number | undefined): string {
  const amount = normalizeExpenseAmount(value);

  if (amount === undefined) {
    return "";
  }

  return Number.isInteger(amount)
    ? `${amount}`
    : amount.toFixed(2).replace(/0$/, "");
}

export function inferExpenseCategoryFromPlaceCategory(
  category: TripDayItem["category"],
): TripExpenseCategory {
  if (category === "餐厅") {
    return "餐饮";
  }

  if (category === "酒店") {
    return "住宿";
  }

  if (category === "交通") {
    return "交通";
  }

  if (category === "购物") {
    return "购物";
  }

  if (category === "景点") {
    return "门票";
  }

  return "其他";
}

export function getTripDayItemCost(item: TripDayItem): number {
  return normalizeExpenseAmount(item.cost) ?? 0;
}

export function getTripDayTotalCost(day: TripDay): number {
  return roundExpenseTotal(
    day.items.reduce((total, item) => total + getTripDayItemCost(item), 0),
  );
}

function roundExpenseTotal(value: number): number {
  return Math.round(value * 100) / 100;
}

function getTripDayDate(trip: Trip, day: TripDay): string | undefined {
  return trip.startDate
    ? addDaysToDateKey(trip.startDate, day.dayIndex - 1)
    : undefined;
}

function createDayItemExpenseEntry(
  trip: Trip,
  day: TripDay,
  item: TripDayItem,
): TripExpenseEntry | undefined {
  const amount = normalizeExpenseAmount(item.cost);

  if (amount === undefined) {
    return undefined;
  }

  return {
    id: `day-item:${day.id}:${item.id}`,
    amount,
    category: inferExpenseCategoryFromPlaceCategory(item.category),
    currency: normalizeExpenseCurrency(trip.currency ?? trip.budget?.currency),
    date: getTripDayDate(trip, day),
    dayId: day.id,
    itemId: item.id,
    note: item.note,
    placeId: item.placeId,
    placeName: item.placeName ?? item.title,
    recordedAt: item.costRecordedAt,
    source: "dayItem",
    title: item.title,
  };
}

function createExpenseEntry(
  expense: TripExpense,
): TripExpenseEntry | undefined {
  const amount = normalizeExpenseAmount(expense.amount);

  if (amount === undefined) {
    return undefined;
  }

  return {
    id: `expense:${expense.id}`,
    amount,
    category: normalizeExpenseCategory(expense.category),
    currency: normalizeExpenseCurrency(expense.currency),
    date: expense.date,
    dayId: expense.dayId,
    note: expense.note,
    placeId: expense.placeId,
    placeName: expense.placeName,
    recordedAt: expense.updatedAt || expense.createdAt,
    source: "expense",
    title: expense.title,
  };
}

function normalizeExpenseEntries(
  entries: TripExpenseEntry[],
): TripExpenseEntry[] {
  return entries.sort((left, right) => {
    const leftTime = Date.parse(left.recordedAt ?? left.date ?? "");
    const rightTime = Date.parse(right.recordedAt ?? right.date ?? "");
    const normalizedLeftTime = Number.isNaN(leftTime) ? 0 : leftTime;
    const normalizedRightTime = Number.isNaN(rightTime) ? 0 : rightTime;

    return normalizedRightTime - normalizedLeftTime;
  });
}

export function getTripExpenseEntries(trip: Trip): TripExpenseEntry[] {
  const dayItemEntries = trip.days.flatMap((day) =>
    day.items
      .map((item) => createDayItemExpenseEntry(trip, day, item))
      .filter((entry): entry is TripExpenseEntry => Boolean(entry)),
  );
  const standaloneEntries = (trip.expenses ?? [])
    .map(createExpenseEntry)
    .filter((entry): entry is TripExpenseEntry => Boolean(entry));

  return normalizeExpenseEntries([...standaloneEntries, ...dayItemEntries]);
}

export function getTripExpenseEntriesForDay(
  trip: Trip,
  day: TripDay,
): TripExpenseEntry[] {
  return getTripExpenseEntries(trip).filter((entry) => entry.dayId === day.id);
}

export function getTripExpenseEntriesForPlace(
  trip: Trip,
  place: TripPlace,
): TripExpenseEntry[] {
  const dayItemEntries = trip.days.flatMap((day) =>
    day.items
      .filter((item) => doesTripDayItemMatchPlace(item, place, trip.places))
      .map((item) => createDayItemExpenseEntry(trip, day, item))
      .filter((entry): entry is TripExpenseEntry => Boolean(entry)),
  );
  const standaloneEntries = (trip.expenses ?? [])
    .map(createExpenseEntry)
    .filter((entry): entry is TripExpenseEntry => Boolean(entry))
    .filter((entry) => {
      if (entry.placeId && entry.placeId === place.id) {
        return true;
      }

      return Boolean(entry.placeName && entry.placeName === place.name);
    });

  return normalizeExpenseEntries([...standaloneEntries, ...dayItemEntries]);
}

export function getTripDayExpenseTotal(trip: Trip, day: TripDay): number {
  return roundExpenseTotal(
    getTripExpenseEntriesForDay(trip, day).reduce(
      (total, entry) => total + entry.amount,
      0,
    ),
  );
}

export function getTripStandaloneExpenseTotal(trip: Trip): number {
  return roundExpenseTotal(
    (trip.expenses ?? []).reduce(
      (total, expense) => total + (normalizeExpenseAmount(expense.amount) ?? 0),
      0,
    ),
  );
}

export function getTripTotalCost(trip: Trip): number {
  return roundExpenseTotal(
    getTripExpenseEntries(trip).reduce(
      (total, entry) => total + entry.amount,
      0,
    ),
  );
}

export function getTripPlaceTotalCost(trip: Trip, place: TripPlace): number {
  return roundExpenseTotal(
    getTripExpenseEntriesForPlace(trip, place).reduce(
      (total, entry) => total + entry.amount,
      0,
    ),
  );
}

export function getTripPlaceDayItemTotalCost(
  trip: Trip,
  place: TripPlace,
): number {
  return roundExpenseTotal(
    trip.days.reduce(
      (total, day) =>
        total +
        day.items.reduce((dayTotal, item) => {
          if (!doesTripDayItemMatchPlace(item, place, trip.places)) {
            return dayTotal;
          }

          return dayTotal + getTripDayItemCost(item);
        }, 0),
      0,
    ),
  );
}

export function getTripExpenseSummary(trip: Trip): TripExpenseSummary {
  const entries = getTripExpenseEntries(trip);
  const totalAmount = roundExpenseTotal(
    entries.reduce((total, entry) => total + entry.amount, 0),
  );
  const budgetAmount = normalizeExpenseAmount(trip.budget?.amount);
  const categorySummaries = tripExpenseCategories
    .map((category) => {
      const categoryEntries = entries.filter(
        (entry) => entry.category === category,
      );

      return {
        amount: roundExpenseTotal(
          categoryEntries.reduce((total, entry) => total + entry.amount, 0),
        ),
        category,
        count: categoryEntries.length,
      };
    })
    .filter((summary) => summary.count > 0);
  const daySummaries = trip.days.map((day) => {
    const dayEntries = entries.filter((entry) => entry.dayId === day.id);

    return {
      amount: roundExpenseTotal(
        dayEntries.reduce((total, entry) => total + entry.amount, 0),
      ),
      count: dayEntries.length,
      date: getTripDayDate(trip, day),
      day,
    };
  });

  return {
    budgetAmount,
    categorySummaries,
    daySummaries,
    entries,
    recordedCount: entries.length,
    remainingAmount:
      budgetAmount === undefined
        ? undefined
        : roundExpenseTotal(budgetAmount - totalAmount),
    totalAmount,
  };
}
