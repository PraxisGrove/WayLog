import {
  DEFAULT_THEME_COLOR_ID,
  getThemeColorById,
  getThemeSkinMode,
} from "../../shared/theme/theme-colors";

import {
  addDaysToDateKey,
  createDateKey,
  dateKeyToDate,
  formatDateKeyForDisplay,
  formatDateRangeForDisplay,
} from "./date";
import { formatExpenseAmount, getTripTotalCost } from "./expenses";
import type { Trip, TripDay, TripDayItem } from "./types";

export function countTripItems(trip: Trip): number {
  return trip.days.reduce((total, day) => total + day.items.length, 0);
}

export type TripTicketStat = {
  label: string;
  value: number | string;
};

export type FeaturedTripTicketPalette = {
  accentText: string;
  dashColor: string;
  dashSegmentLength: number;
  dashSegmentThickness: number;
  heroBackground: string;
  heroMutedText: string;
  heroPattern: string;
  heroText: string;
  paperBackground: string;
  paperPressed: string;
  paperText: string;
  punchBorder: string;
  seamHeight: number;
  seamSplitY: number;
  statBackground: string;
};

export function getTripTicketStats(
  trip: Trip,
  currentDate = new Date(),
): TripTicketStat[] {
  return [
    { label: "天数", value: trip.days.length },
    { label: "地点", value: countTripItems(trip) },
    { label: "已到点", value: countDueTripItems(trip, currentDate) },
    { label: "开销", value: formatExpenseAmount(getTripTotalCost(trip)) },
  ];
}

export function getTripCurrentDayNumber(
  trip: Trip,
  currentDate = new Date(),
): number {
  if (!trip.startDate) {
    return 0;
  }

  const startDate = dateKeyToDate(trip.startDate);
  const currentDay = dateKeyToDate(createDateKey(currentDate));

  if (!startDate || !currentDay) {
    return 0;
  }

  const currentDayNumber =
    Math.floor(
      (currentDay.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
    ) + 1;

  if (currentDayNumber < 1) {
    return 0;
  }

  return Math.min(currentDayNumber, Math.max(1, trip.days.length));
}

export function getFeaturedTripTicketPalette(
  mode: "dark" | "light",
  colorId = DEFAULT_THEME_COLOR_ID,
): FeaturedTripTicketPalette {
  return getThemeSkinMode(getThemeColorById(colorId), mode).ticket.featured;
}

export function formatTripDayCount(trip: Trip): string {
  return `${trip.days.length} 天行程`;
}

export function formatTripProgress(trip: Trip): string {
  const itemCount = countTripItems(trip);
  return itemCount > 0 ? `已添加 ${itemCount} 个地点` : "还没有添加地点";
}

function getDayItemTimeSortValue(item: TripDayItem): number | undefined {
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(item.time?.trim() ?? "");

  if (!timeMatch) {
    return undefined;
  }

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return undefined;
  }

  return hour * 60 + minute;
}

export function getSortedTripDayItems(items: TripDayItem[]): TripDayItem[] {
  return [...items];
}

export function getTripDayItemsSortedByTime(
  items: TripDayItem[],
): TripDayItem[] {
  return items
    .map((item, index) => ({
      index,
      item,
      timeSortValue: getDayItemTimeSortValue(item),
    }))
    .sort((left, right) => {
      const leftHasTime = left.timeSortValue !== undefined;
      const rightHasTime = right.timeSortValue !== undefined;

      if (
        left.timeSortValue !== undefined &&
        right.timeSortValue !== undefined &&
        left.timeSortValue !== right.timeSortValue
      ) {
        return left.timeSortValue - right.timeSortValue;
      }

      if (leftHasTime !== rightHasTime) {
        return leftHasTime ? -1 : 1;
      }

      return left.index - right.index;
    })
    .map(({ item }) => item);
}

export function getTripTodayDay(
  trip: Trip,
  currentDate = new Date(),
): TripDay | undefined {
  const startDate = trip.startDate;

  if (!startDate) {
    return undefined;
  }

  const currentDateKey = createDateKey(currentDate);
  return trip.days.find(
    (day) => addDaysToDateKey(startDate, day.dayIndex - 1) === currentDateKey,
  );
}

export function getTripPrimaryDay(
  trip: Trip,
  currentDate = new Date(),
): TripDay | undefined {
  return (
    getTripTodayDay(trip, currentDate) ??
    trip.days.find((day) => day.items.length > 0) ??
    trip.days[0]
  );
}

export function getTripPrimaryItems(trip: Trip) {
  const items = getTripPrimaryDay(trip)?.items ?? [];

  return getSortedTripDayItems(items);
}

export function countScheduledPlaces(trip: Trip): number {
  return trip.places.filter((place) => place.isScheduled).length;
}

export function countDueTripItems(
  trip: Trip,
  currentDate = new Date(),
): number {
  const startDate = trip.startDate;

  if (!startDate) {
    return 0;
  }

  return trip.days.reduce((total, day) => {
    const dayDate = dateKeyToDate(
      addDaysToDateKey(startDate, day.dayIndex - 1),
    );

    if (!dayDate) {
      return total;
    }

    const dueItemCount = day.items.filter((item) => {
      const timeSortValue = getDayItemTimeSortValue(item);

      if (timeSortValue === undefined) {
        return false;
      }

      const plannedAt = new Date(dayDate);
      plannedAt.setHours(
        Math.floor(timeSortValue / 60),
        timeSortValue % 60,
        0,
        0,
      );

      return plannedAt.getTime() <= currentDate.getTime();
    }).length;

    return total + dueItemCount;
  }, 0);
}

export function getRoutePlaceNames(trip: Trip): string[] {
  const dayItemPlaceNames = trip.days.flatMap((day) =>
    getSortedTripDayItems(day.items).map(
      (item) => item.placeName ?? item.title,
    ),
  );

  if (dayItemPlaceNames.length > 0) {
    return dayItemPlaceNames;
  }

  const scheduledPlaceNames = trip.places
    .filter((place) => place.isScheduled)
    .map((place) => place.name);

  if (scheduledPlaceNames.length > 0) {
    return scheduledPlaceNames;
  }

  return [];
}

export function formatTripDateRange(trip: Trip): string {
  if (!trip.startDate && !trip.endDate) {
    return "日期未定";
  }

  if (trip.startDate && trip.endDate) {
    return formatDateRangeForDisplay(trip.startDate, trip.endDate);
  }

  return formatDateKeyForDisplay(trip.startDate ?? trip.endDate ?? "");
}
