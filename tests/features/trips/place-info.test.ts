import assert from "node:assert/strict";
import test from "node:test";
import type { Trip, TripPlace } from "../../../features/trips";
import {
  findTripPlace,
  findTripPlaceByLocalPlaceId,
  getPlaceMapBoundaryPaths,
  getPlaceMapPreviewZoom,
} from "../../../features/trips/place-info";

const BOUNDARY_PLACE: TripPlace = {
  id: "boundary-place",
  name: "Boundary Scenic Area",
  category: "other" as TripPlace["category"],
  isScheduled: true,
  mapBoundary: [
    [
      { latitude: 25.58, longitude: 100.17 },
      { latitude: 25.64, longitude: 100.13 },
      { latitude: 25.78, longitude: 100.12 },
    ],
  ],
};

test("getPlaceMapBoundaryPaths returns boundary paths", () => {
  assert.deepEqual(
    getPlaceMapBoundaryPaths(BOUNDARY_PLACE),
    BOUNDARY_PLACE.mapBoundary,
  );
});

test("getPlaceMapBoundaryPaths returns empty for places without boundary", () => {
  assert.deepEqual(getPlaceMapBoundaryPaths({}), []);
});

test("getPlaceMapPreviewZoom keeps airport previews contextual", () => {
  assert.equal(
    getPlaceMapPreviewZoom({
      category: "交通",
      iconKey: "airport",
      poiGroup: "transport",
      poiType: "airport",
    }),
    10,
  );
});

test("getPlaceMapPreviewZoom keeps compact food and lodging places close enough", () => {
  assert.equal(
    getPlaceMapPreviewZoom({
      category: "餐厅",
      iconKey: "restaurant",
      poiGroup: "food",
      poiType: "restaurant",
    }),
    14,
  );
});

test("findTripPlaceByLocalPlaceId resolves local TripPlace id, not provider POI id", () => {
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
  } as Trip;

  assert.equal(
    findTripPlaceByLocalPlaceId(trip, "place-local-1")?.name,
    "独克宗古城",
  );
  assert.equal(findTripPlaceByLocalPlaceId(trip, "B03770LV82"), undefined);
  assert.equal(findTripPlace(trip, "place-local-1")?.name, "独克宗古城");
});
