import type { PlaceSuggestion } from "./place-search";
import type {
  Trip,
  TripDayItem,
  TripPlace,
  TripPlaceExternalRefs,
} from "./types";

type ProviderPlaceReference = {
  externalRefs?: Pick<TripPlaceExternalRefs, "amapPoiId">;
  provider?: string;
  providerPlaceId?: string;
};

function normalizeIdentityText(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function isLocalTripPlaceId(value?: string | null): boolean {
  const text = normalizeIdentityText(value);
  return Boolean(text && (/^place-/.test(text) || /^seed-.*place-/.test(text)));
}

export function isFavoritePlaceId(value?: string | null): boolean {
  const text = normalizeIdentityText(value);
  return Boolean(text && /^favorite-place-/.test(text));
}

export function isLocalTripDayItemId(value?: string | null): boolean {
  const text = normalizeIdentityText(value);
  return Boolean(text && (/^item-/.test(text) || /^day-item-/.test(text)));
}

export function isPublicAmapPlaceShapeId(value?: string | null): boolean {
  const text = normalizeIdentityText(value);
  return Boolean(text && /^amap-/.test(text));
}

export function isKnownLocalEntityId(value?: string | null): boolean {
  const text = normalizeIdentityText(value);
  return Boolean(
    text &&
      (/^(place|favorite-place|trip|day|item|memo|expense|transport|lodging|checklist)-/.test(
        text,
      ) ||
        /^seed-/.test(text)),
  );
}

export function normalizeAmapPoiId(value?: string | null): string | undefined {
  const text = normalizeIdentityText(value);

  if (!text || isKnownLocalEntityId(text)) {
    return undefined;
  }

  return text.startsWith("amap-") ? text.slice("amap-".length) : text;
}

export function canUseProviderPlaceIdAsAmapPoiId(
  provider?: string,
  providerPlaceId?: string,
): boolean {
  const normalizedProvider = normalizeIdentityText(provider)?.toLowerCase();

  return Boolean(
    normalizeAmapPoiId(providerPlaceId) &&
      (!normalizedProvider ||
        normalizedProvider === "amap" ||
        normalizedProvider === "poi_cache"),
  );
}

export function getAmapPoiIdFromReference(
  reference: ProviderPlaceReference,
): string | undefined {
  return (
    normalizeAmapPoiId(reference.externalRefs?.amapPoiId) ??
    (canUseProviderPlaceIdAsAmapPoiId(
      reference.provider,
      reference.providerPlaceId,
    )
      ? normalizeAmapPoiId(reference.providerPlaceId)
      : undefined)
  );
}

export function getAmapPoiIdFromPlace(
  place: Pick<TripPlace, "externalRefs" | "provider" | "providerPlaceId">,
): string | undefined {
  return getAmapPoiIdFromReference(place);
}

export function getAmapPoiIdFromSuggestion(
  suggestion: Pick<
    PlaceSuggestion,
    "externalRefs" | "provider" | "providerPlaceId" | "id"
  >,
): string | undefined {
  return (
    getAmapPoiIdFromReference(suggestion) ??
    (suggestion.provider === "amap" || suggestion.provider === "poi_cache"
      ? normalizeAmapPoiId(suggestion.id)
      : undefined)
  );
}

export function getProviderPlaceIdFromSuggestion(
  suggestion: Pick<
    PlaceSuggestion,
    "externalRefs" | "provider" | "providerPlaceId" | "id"
  >,
): string | undefined {
  return (
    normalizeIdentityText(suggestion.providerPlaceId) ??
    getAmapPoiIdFromSuggestion(suggestion) ??
    normalizeIdentityText(suggestion.id)
  );
}

export function getReferencedTripPlaceId(
  item: Pick<TripDayItem, "placeId">,
): string | undefined {
  return normalizeIdentityText(item.placeId);
}

export function findTripPlaceByLocalId(
  trip: Pick<Trip, "places">,
  localPlaceId: string,
): TripPlace | undefined {
  const normalizedLocalPlaceId = normalizeIdentityText(localPlaceId);
  return normalizedLocalPlaceId
    ? trip.places.find((place) => place.id === normalizedLocalPlaceId)
    : undefined;
}

export function doesTripDayItemReferenceTripPlace(
  item: Pick<TripDayItem, "placeId" | "placeName" | "title">,
  place: Pick<TripPlace, "id" | "name">,
): boolean {
  const referencedPlaceId = getReferencedTripPlaceId(item);

  if (referencedPlaceId) {
    return referencedPlaceId === place.id;
  }

  return item.placeName === place.name || item.title === place.name;
}
