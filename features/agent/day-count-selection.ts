export const MIN_TRIP_DRAFT_DAY_COUNT = 1;
export const MAX_TRIP_DRAFT_DAY_COUNT = 14;

export type DayCountSelection = {
  focusedDay: number;
  selectedDay?: number;
};

export function createDayCountSelection(focusedDay = 3): DayCountSelection {
  assertDayCount(focusedDay);
  return { focusedDay };
}

export function selectDayCount(
  _current: DayCountSelection,
  dayCount: number,
): DayCountSelection {
  assertDayCount(dayCount);
  return { focusedDay: dayCount, selectedDay: dayCount };
}

export function canSubmitDayCountSelection(
  selection: DayCountSelection,
): selection is DayCountSelection & { selectedDay: number } {
  return isDayCount(selection.selectedDay);
}

export function isDayCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_TRIP_DRAFT_DAY_COUNT &&
    value <= MAX_TRIP_DRAFT_DAY_COUNT
  );
}

function assertDayCount(value: unknown): asserts value is number {
  if (!isDayCount(value)) {
    throw new Error("行程天数必须是 1–14 的整数。");
  }
}
