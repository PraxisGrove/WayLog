import type { Trip } from "@/features/trips";

import type { DayDetailSheetReturnSnapshot } from "./immersive/types";

const DAY_DETAIL_RETURN_SNAPSHOT_TTL_MS = 5 * 60 * 1000;

const dayDetailSheetReturnSnapshotByTripId = new Map<
  string,
  DayDetailSheetReturnSnapshot
>();

export function saveDayDetailSheetReturnSnapshot(
  tripId: string | undefined,
  snapshot: Omit<DayDetailSheetReturnSnapshot, "savedAt">,
) {
  if (tripId) {
    dayDetailSheetReturnSnapshotByTripId.set(tripId, {
      ...snapshot,
      savedAt: Date.now(),
    });
  }
}

export function takeDayDetailSheetReturnSnapshot(
  tripId: string | undefined,
  trip: Trip,
): DayDetailSheetReturnSnapshot | undefined {
  if (!tripId) {
    return undefined;
  }

  const snapshot = dayDetailSheetReturnSnapshotByTripId.get(tripId);
  dayDetailSheetReturnSnapshotByTripId.delete(tripId);

  if (
    !snapshot ||
    Date.now() - snapshot.savedAt > DAY_DETAIL_RETURN_SNAPSHOT_TTL_MS
  ) {
    return undefined;
  }

  const snapshotDay = trip.days.find((day) => day.id === snapshot.dayId);

  if (!snapshotDay) {
    return undefined;
  }

  const previewItemId =
    snapshot.previewItemId &&
    snapshotDay.items.some((item) => item.id === snapshot.previewItemId)
      ? snapshot.previewItemId
      : undefined;

  return {
    ...snapshot,
    previewItemId,
  };
}
