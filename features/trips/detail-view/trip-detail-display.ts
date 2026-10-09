import { addDaysToDateKey, parseDateKey } from "../date";
import type { TripExpenseEntry } from "../expenses";
import { inferPlaceKind } from "../place-kind";
import type { Trip, TripDay, TripDayItem } from "../types";

const ROUTE_RETRY_DELAY_MS = 4000;

export function reInferTripPlaceKinds(trip: Trip): Trip {
  let hasChanges = false;
  const kindByPlaceId = new Map<string, ReturnType<typeof inferPlaceKind>>();

  const updatedPlaces = trip.places.map((place) => {
    const inferred = inferPlaceKind({
      category: place.category,
      name: place.name,
      osmKey: place.osmKey,
      osmValue: place.osmValue,
    });

    if (
      inferred.iconKey === (place.iconKey ?? "place") &&
      inferred.category === place.category
    ) {
      return place;
    }

    hasChanges = true;
    kindByPlaceId.set(place.id, inferred);
    return {
      ...place,
      category: inferred.category,
      iconKey: inferred.iconKey,
      poiGroup: inferred.poiGroup,
      poiType: inferred.poiType,
    };
  });

  if (!hasChanges) return trip;

  const updatedDays = trip.days.map((day) => {
    const updatedItems = day.items.map((item) => {
      if (!item.placeId) return item;
      const inferred = kindByPlaceId.get(item.placeId);
      if (!inferred) return item;

      return {
        ...item,
        category: inferred.category,
        iconKey: inferred.iconKey,
      };
    });

    const itemsChanged = updatedItems.some(
      (item, index) => item !== day.items[index],
    );
    return itemsChanged ? { ...day, items: updatedItems } : day;
  });

  return {
    ...trip,
    days: updatedDays,
    places: updatedPlaces,
    updatedAt: new Date().toISOString(),
  };
}

export function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "刚刚更新";
  }

  return `${date.getMonth() + 1} 月 ${date.getDate()} 日更新`;
}

export function getSelectedDay(days: TripDay[], selectedDayId: string) {
  return days.find((day) => day.id === selectedDayId) ?? days[0];
}

export function formatDayTabDate(trip: Trip, day: TripDay): string | undefined {
  if (!trip.startDate) {
    return undefined;
  }

  const dateParts = parseDateKey(
    addDaysToDateKey(trip.startDate, day.dayIndex - 1),
  );

  if (!dateParts) {
    return undefined;
  }

  return `${dateParts.month} 月 ${dateParts.day} 日`;
}

export function formatExpenseEntryMeta(entry: TripExpenseEntry): string {
  return [
    entry.date,
    entry.placeName ? `地点：${entry.placeName}` : undefined,
    entry.source === "dayItem" ? "行程地点" : "独立记账",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function formatExpenseEntryNote(
  entry: TripExpenseEntry,
): string | undefined {
  if (entry.source !== "expense") {
    return undefined;
  }

  const note = entry.note?.trim();
  return note ? `账单备注：${note}` : undefined;
}

export function getRouteRetryDelayMs(attempt: number): number {
  if (attempt < 3) {
    return ROUTE_RETRY_DELAY_MS;
  }

  if (attempt < 6) {
    return 10_000;
  }

  return 30_000;
}

export function moveDayItemToIndex(
  items: TripDayItem[],
  itemId: string,
  targetIndex: number,
): TripDayItem[] {
  const currentIndex = items.findIndex((item) => item.id === itemId);

  if (currentIndex < 0) {
    return items;
  }

  const nextItems = [...items];
  const [movingItem] = nextItems.splice(currentIndex, 1);

  if (!movingItem) {
    return items;
  }

  const nextIndex = Math.max(0, Math.min(targetIndex, nextItems.length));
  nextItems.splice(nextIndex, 0, movingItem);

  return nextItems;
}
