import { formatTripDestination } from "../trips/destination";
import { countTripItems, formatTripDateRange } from "../trips/format";
import type { Trip } from "../trips/types";

export type GlobalSearchScope = "places" | "trips" | "users";

export const globalSearchScopes: GlobalSearchScope[] = [
  "places",
  "trips",
  "users",
];

export type TripGlobalSearchResult = {
  detail: string;
  id: string;
  meta: string;
  title: string;
  trip: Trip;
};

type ScoredTripResult = {
  index: number;
  result: TripGlobalSearchResult;
  score: number;
};

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function normalizeGlobalSearchScope(value: unknown): GlobalSearchScope {
  return globalSearchScopes.includes(value as GlobalSearchScope)
    ? (value as GlobalSearchScope)
    : "places";
}

function createTripSearchResult(trip: Trip): TripGlobalSearchResult {
  const destination = formatTripDestination(trip);
  const itemCount = countTripItems(trip);
  const itemLabel = itemCount > 0 ? `${itemCount} 个地点` : "还没有地点";

  return {
    detail: [trip.status, itemLabel].join(" · "),
    id: trip.id,
    meta: [destination, formatTripDateRange(trip)].filter(Boolean).join(" · "),
    title: trip.title,
    trip,
  };
}

function getTripSearchText(trip: Trip): string {
  const placeNames = trip.places.map((place) => place.name);
  const dayItemNames = trip.days.flatMap((day) =>
    day.items.map((item) => item.placeName ?? item.title),
  );
  const memoTexts = trip.memos.flatMap((memo) => [
    memo.title,
    memo.detail ?? "",
  ]);

  return [
    trip.title,
    trip.destination,
    ...placeNames,
    ...dayItemNames,
    ...memoTexts,
  ]
    .map(normalizeSearchText)
    .filter(Boolean)
    .join(" ");
}

function getTripSearchScore(trip: Trip, query: string): number | undefined {
  if (!query) {
    return 20;
  }

  const title = normalizeSearchText(trip.title);
  const destination = normalizeSearchText(trip.destination);

  if (title === query) {
    return 0;
  }

  if (title.startsWith(query)) {
    return 1;
  }

  if (title.includes(query)) {
    return 2;
  }

  if (destination.includes(query)) {
    return 3;
  }

  return getTripSearchText(trip).includes(query) ? 4 : undefined;
}

export function searchTripsForGlobalSearch(
  trips: Trip[],
  query: string,
  limit = 12,
): TripGlobalSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);

  return trips
    .map((trip, index): ScoredTripResult | undefined => {
      const score = getTripSearchScore(trip, normalizedQuery);

      if (score === undefined) {
        return undefined;
      }

      return {
        index,
        result: createTripSearchResult(trip),
        score,
      };
    })
    .filter((result): result is ScoredTripResult => Boolean(result))
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }

      return left.index - right.index;
    })
    .slice(0, limit)
    .map(({ result }) => result);
}
