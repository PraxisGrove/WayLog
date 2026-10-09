import type { TripChecklistItem } from "./types";

export const defaultTripChecklistTitles = [
  "身份证",
  "学生证",
  "衣物",
  "雨伞",
  "充电设备",
];

export function createDefaultTripChecklistItems(): TripChecklistItem[] {
  return defaultTripChecklistTitles.map((title, index) => ({
    id: `default-checklist-${index + 1}`,
    title,
    isCompleted: false,
  }));
}
