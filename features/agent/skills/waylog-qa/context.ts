import type {
  Trip,
  TripExpenseCategory,
  TripPlaceCategory,
  TripStatus,
} from "../../../trips/types";

const MAX_DAYS = 14;
const MAX_ITEMS_PER_DAY = 7;
const MAX_LIST_ITEMS = 16;
const MAX_TEXT_LENGTH = 120;

export type WaylogQaTripContext = {
  budget?: { amount?: number; currency: string };
  checklist: Array<{ completed: boolean; title: string }>;
  checklistSummary: { completed: number; total: number };
  dateRange: { endDate?: string; startDate?: string };
  dayCount: number;
  days: Array<{
    dayIndex: number;
    itemCount: number;
    items: Array<{
      category?: TripPlaceCategory;
      placeName?: string;
      time?: string;
      title: string;
    }>;
    summary?: string;
    title: string;
  }>;
  destination: string;
  expenseSummary: {
    byCategory: Partial<Record<TripExpenseCategory, number>>;
    currency: string;
    total: number;
  };
  lodgings: Array<{
    address?: string;
    checkIn?: string;
    checkOut?: string;
    name: string;
  }>;
  memos: Array<{ detail?: string; pinned: boolean; title: string }>;
  status: TripStatus;
  title: string;
  transports: Array<{
    arrivalTime?: string;
    departureTime?: string;
    detail?: string;
    title: string;
    type: string;
  }>;
};

export type WaylogQaContext = {
  trip: WaylogQaTripContext;
  trust: "untrusted_trip_data";
};

/**
 * 只为 waylog.qa 构建可回答问题的最小只读视图。
 * 本地 ID、外部来源、媒体、自由备注和写入版本不进入模型上下文。
 */
export function createWaylogQaContext(trip: Trip): WaylogQaContext {
  const byCategory: Partial<Record<TripExpenseCategory, number>> = {};
  let total = 0;

  for (const expense of trip.expenses) {
    total += expense.amount;
    byCategory[expense.category] =
      (byCategory[expense.category] ?? 0) + expense.amount;
  }

  return {
    trip: {
      budget: trip.budget
        ? { amount: trip.budget.amount, currency: trip.budget.currency }
        : undefined,
      checklist: trip.checklistItems.slice(0, MAX_LIST_ITEMS).map((item) => ({
        completed: item.isCompleted,
        title: truncate(item.title),
      })),
      checklistSummary: {
        completed: trip.checklistItems.filter((item) => item.isCompleted)
          .length,
        total: trip.checklistItems.length,
      },
      dateRange: { endDate: trip.endDate, startDate: trip.startDate },
      dayCount: trip.days.length,
      days: trip.days.slice(0, MAX_DAYS).map((day) => ({
        dayIndex: day.dayIndex,
        itemCount: day.items.length,
        items: day.items.slice(0, MAX_ITEMS_PER_DAY).map((item) => ({
          category: item.category,
          placeName: optionalText(item.placeName),
          time: optionalText(item.time),
          title: truncate(item.title),
        })),
        summary: optionalText(day.summary),
        title: truncate(day.title),
      })),
      destination: truncate(trip.destination),
      expenseSummary: {
        byCategory,
        currency: trip.expenses[0]?.currency ?? trip.currency,
        total,
      },
      lodgings: trip.lodgings.slice(0, MAX_LIST_ITEMS).map((lodging) => ({
        address: optionalText(lodging.address),
        checkIn: optionalText(lodging.checkIn),
        checkOut: optionalText(lodging.checkOut),
        name: truncate(lodging.name),
      })),
      memos: trip.memos.slice(0, MAX_LIST_ITEMS).map((memo) => ({
        detail: optionalText(memo.detail),
        pinned: memo.pinned === true,
        title: truncate(memo.title),
      })),
      status: trip.status,
      title: truncate(trip.title),
      transports: trip.transports.slice(0, MAX_LIST_ITEMS).map((transport) => ({
        arrivalTime: optionalText(transport.arrivalTime),
        departureTime: optionalText(transport.departureTime),
        detail: optionalText(transport.detail),
        title: truncate(transport.title),
        type: transport.type,
      })),
    },
    trust: "untrusted_trip_data",
  };
}

function optionalText(value: string | undefined): string | undefined {
  return value?.trim() ? truncate(value) : undefined;
}

function truncate(value: string): string {
  const normalized = value.trim();
  return normalized.length <= MAX_TEXT_LENGTH
    ? normalized
    : `${normalized.slice(0, MAX_TEXT_LENGTH - 1).trimEnd()}…`;
}
