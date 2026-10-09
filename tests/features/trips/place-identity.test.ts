import assert from "node:assert/strict";
import test from "node:test";
import type { PlaceSuggestion, Trip } from "../../../features/trips";
import {
  canUseProviderPlaceIdAsAmapPoiId,
  doesTripDayItemReferenceTripPlace,
  findTripPlaceByLocalId,
  getAmapPoiIdFromPlace,
  getAmapPoiIdFromSuggestion,
  getProviderPlaceIdFromSuggestion,
  isFavoritePlaceId,
  isLocalTripPlaceId,
  isPublicAmapPlaceShapeId,
  normalizeAmapPoiId,
} from "../../../features/trips/place-identity";

test("place identity helpers classify local and public ids", () => {
  assert.equal(isLocalTripPlaceId("place-123"), true);
  assert.equal(isLocalTripPlaceId("B03770LV82"), false);
  assert.equal(isFavoritePlaceId("favorite-place-123"), true);
  assert.equal(isPublicAmapPlaceShapeId("amap-B03770LV82"), true);
});

test("normalizeAmapPoiId rejects local entity ids and strips public shape prefix", () => {
  assert.equal(normalizeAmapPoiId("place-123"), undefined);
  assert.equal(normalizeAmapPoiId("favorite-place-123"), undefined);
  assert.equal(normalizeAmapPoiId("amap-B03770LV82"), "B03770LV82");
  assert.equal(normalizeAmapPoiId("B03770LV82"), "B03770LV82");
});

test("getAmapPoiIdFromPlace uses externalRefs first and avoids local ids", () => {
  assert.equal(
    getAmapPoiIdFromPlace({
      externalRefs: { amapPoiId: "B03770LV82" },
      provider: "amap",
      providerPlaceId: "place-should-not-win",
    }),
    "B03770LV82",
  );
  assert.equal(
    getAmapPoiIdFromPlace({
      provider: "amap",
      providerPlaceId: "place-local-1",
    }),
    undefined,
  );
  assert.equal(
    getAmapPoiIdFromPlace({
      provider: "poi_cache",
      providerPlaceId: "B0CACHE",
    }),
    "B0CACHE",
  );
});

test("suggestion identity helpers separate provider ids from local trip ids", () => {
  const suggestion: Pick<
    PlaceSuggestion,
    "externalRefs" | "id" | "provider" | "providerPlaceId"
  > = {
    id: "amap-B03770LV82",
    provider: "amap",
    providerPlaceId: undefined,
    externalRefs: undefined,
  };

  assert.equal(getAmapPoiIdFromSuggestion(suggestion), "B03770LV82");
  assert.equal(getProviderPlaceIdFromSuggestion(suggestion), "B03770LV82");
  assert.equal(canUseProviderPlaceIdAsAmapPoiId("mock", "B03770LV82"), false);
});

test("day items reference trip places by local id first and names only as legacy fallback", () => {
  const place = { id: "place-local-1", name: "独克宗古城" };

  assert.equal(
    doesTripDayItemReferenceTripPlace(
      { placeId: "place-local-1", placeName: "别名", title: "别名" },
      place,
    ),
    true,
  );
  assert.equal(
    doesTripDayItemReferenceTripPlace(
      { placeId: "B03770LV82", placeName: "独克宗古城", title: "独克宗古城" },
      place,
    ),
    false,
  );
  assert.equal(
    doesTripDayItemReferenceTripPlace(
      { placeName: "独克宗古城", title: "独克宗古城" },
      place,
    ),
    true,
  );
});

test("findTripPlaceByLocalId only resolves TripPlace.id", () => {
  const trip = {
    places: [
      {
        id: "place-local-1",
        name: "独克宗古城",
        category: "景点",
        isScheduled: true,
        provider: "amap",
        providerPlaceId: "B03770LV82",
        externalRefs: { amapPoiId: "B03770LV82" },
      },
    ],
  } as Pick<Trip, "places">;

  assert.equal(
    findTripPlaceByLocalId(trip, "place-local-1")?.name,
    "独克宗古城",
  );
  assert.equal(findTripPlaceByLocalId(trip, "B03770LV82"), undefined);
});
