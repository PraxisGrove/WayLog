import type { Trip, TripDay, TripDayItem, TripPlace } from "./types";

function normalizePlaceMatchText(value?: string): string {
  return value?.trim() ?? "";
}

function getTripDayItemPlaceCandidateNames(item: TripDayItem): string[] {
  return Array.from(
    new Set(
      [item.placeName, item.title]
        .map((value) => normalizePlaceMatchText(value))
        .filter((value) => value.length > 0),
    ),
  );
}

function findMatchingTripPlacesForDayItem(
  places: TripPlace[],
  item: TripDayItem,
): TripPlace[] {
  const normalizedPlaceId = normalizePlaceMatchText(item.placeId);

  if (normalizedPlaceId) {
    const idMatches = places.filter(
      (place) => normalizePlaceMatchText(place.id) === normalizedPlaceId,
    );

    if (idMatches.length > 0) {
      return idMatches;
    }
  }

  const candidateNames = getTripDayItemPlaceCandidateNames(item);

  if (candidateNames.length === 0) {
    return [];
  }

  const nameMatches = places.filter((place) =>
    candidateNames.includes(normalizePlaceMatchText(place.name)),
  );

  return nameMatches.length === 1 ? nameMatches : [];
}

export function getPlaceForTripDayItem(
  trip: Trip,
  item: TripDayItem,
): TripPlace | undefined {
  return findMatchingTripPlacesForDayItem(trip.places, item)[0];
}

export function doesTripDayItemMatchPlace(
  item: TripDayItem,
  place: TripPlace,
  places?: TripPlace[],
): boolean {
  if (places) {
    return findMatchingTripPlacesForDayItem(places, item).some(
      (matchedPlace) => matchedPlace.id === place.id,
    );
  }

  const normalizedPlaceId = normalizePlaceMatchText(item.placeId);

  if (normalizedPlaceId) {
    return normalizePlaceMatchText(place.id) === normalizedPlaceId;
  }

  const candidateNames = getTripDayItemPlaceCandidateNames(item);

  return candidateNames.includes(normalizePlaceMatchText(place.name));
}

export function removeUnusedTripPlacesForDayItems(
  places: TripPlace[],
  days: TripDay[],
  removedItems: TripDayItem[],
): TripPlace[] {
  return places.filter((place) => {
    const wasRemovedWithItems = removedItems.some((item) =>
      doesTripDayItemMatchPlace(item, place, places),
    );

    if (!wasRemovedWithItems) {
      return true;
    }

    return days.some((day) =>
      day.items.some((item) => doesTripDayItemMatchPlace(item, place, places)),
    );
  });
}
