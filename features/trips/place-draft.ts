import { getProviderPlaceIdFromSuggestion } from "./place-identity";
import type { PlaceSuggestion } from "./place-search";
import type { TripDayItem, TripPlace } from "./types";

export function createLocalTripEntityId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createTripDayItemFromPlaceSuggestion(
  suggestion: PlaceSuggestion,
  placeId?: string,
): TripDayItem {
  return {
    id: createLocalTripEntityId("item"),
    title: suggestion.name,
    category: suggestion.category,
    iconKey: suggestion.iconKey,
    placeId,
    placeName: suggestion.name,
  };
}

type CreateTripPlaceOptions = {
  isScheduled?: boolean;
};

export function createScheduledTripPlaceFromSuggestion(
  suggestion: PlaceSuggestion,
  options: CreateTripPlaceOptions = {},
): TripPlace {
  const providerPlaceId = getProviderPlaceIdFromSuggestion(suggestion);
  const hasDetails =
    suggestion.rating != null ||
    suggestion.phone ||
    suggestion.openingHoursToday ||
    suggestion.costPerPerson ||
    suggestion.tags;
  const details = hasDetails
    ? {
        rating: suggestion.rating,
        ratingSource: suggestion.rating != null ? "高德" : undefined,
        phone: suggestion.phone,
        openingHours: suggestion.openingHoursToday,
        priceLevel: suggestion.costPerPerson,
        tags: suggestion.tags,
      }
    : undefined;
  const photos = suggestion.photos?.map((p, i) => ({
    id: `amap-photo-${providerPlaceId ?? suggestion.id}-${i}`,
    url: p.url,
    sourceLabel: "高德",
  }));

  return {
    id: createLocalTripEntityId("place"),
    name: suggestion.name,
    category: suggestion.category,
    isScheduled: options.isScheduled ?? true,
    address: suggestion.address,
    area: suggestion.area,
    latitude: suggestion.latitude,
    longitude: suggestion.longitude,
    mapBoundary: suggestion.mapBoundary,
    iconKey: suggestion.iconKey,
    osmKey: suggestion.osmKey,
    osmValue: suggestion.osmValue,
    poiGroup: suggestion.poiGroup,
    poiType: suggestion.poiType,
    provider: suggestion.provider,
    providerPlaceId,
    externalRefs: suggestion.externalRefs,
    details,
    photos: photos && photos.length > 0 ? photos : undefined,
  };
}

/** @deprecated Use createScheduledTripPlaceFromSuggestion for trip writes. */
export function createTripPlaceFromPlaceSuggestion(
  suggestion: PlaceSuggestion,
  options: CreateTripPlaceOptions = {},
): TripPlace {
  return createScheduledTripPlaceFromSuggestion(suggestion, options);
}

export function createTripDayItemFromTripPlace(place: TripPlace): TripDayItem {
  return {
    id: createLocalTripEntityId("item"),
    title: place.name,
    category: place.category,
    iconKey: place.iconKey,
    placeId: place.id,
    placeName: place.name,
    note: place.note,
  };
}
