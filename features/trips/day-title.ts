import type { TripDay } from "./types";

const dayNumberLabels = [
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
  "十",
];

export function formatTripDayTitle(dayIndex: number): string {
  return `第${dayNumberLabels[dayIndex - 1] ?? dayIndex}天`;
}

export function resolveTripDayTitle(
  day: Pick<TripDay, "dayIndex" | "title">,
): string {
  return day.title.trim() || formatTripDayTitle(day.dayIndex);
}

export function isDefaultTripDayTitle(
  day: Pick<TripDay, "dayIndex" | "title">,
): boolean {
  const title = day.title.trim();

  if (!title || title === formatTripDayTitle(day.dayIndex)) {
    return true;
  }

  return title.replace(/\s+/g, "") === `第${day.dayIndex}天`;
}
