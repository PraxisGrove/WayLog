import assert from "node:assert/strict";
import test from "node:test";
import type { Trip, TripPlace } from "../../../features/trips";
import {
  hydrateTripPlacesFromCloud,
  stripTripForCloud,
} from "../../../features/trips/cloud-sync";

function createTripWithAmapPlace(): Trip {
  return {
    id: "trip-poi-ref",
    title: "POI ref trip",
    destination: "香格里拉市",
    currency: "CNY",
    status: "计划中",
    days: [
      {
        id: "day-1",
        dayIndex: 1,
        title: "第一天",
        items: [
          {
            id: "item-1",
            title: "香格里拉市独克宗古城",
            category: "景点",
            placeId: "place-local-1",
            placeName: "香格里拉市独克宗古城",
          },
        ],
      },
    ],
    places: [
      {
        id: "place-local-1",
        name: "香格里拉市独克宗古城",
        category: "景点",
        isScheduled: true,
        provider: "amap",
        providerPlaceId: "B03770LV82",
        externalRefs: {
          amapPoiId: "B03770LV82",
        },
      },
    ],
    transports: [],
    lodgings: [],
    memos: [],
    checklistItems: [],
    expenses: [],
    importSources: [],
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
  };
}

test("stripTripForCloud keeps local TripPlace id in POI refs", () => {
  const payload = stripTripForCloud(createTripWithAmapPlace());
  const placeRef = Array.isArray(payload.places)
    ? (payload.places[0] as Record<string, unknown>)
    : undefined;

  assert.equal(placeRef?.id, "place-local-1");
  assert.equal(placeRef?.amapPoiId, "B03770LV82");
});

test("hydrateTripPlacesFromCloud restores local TripPlace id from POI refs", () => {
  const cachedPlace: TripPlace = {
    id: "amap-B03770LV82",
    name: "香格里拉市独克宗古城",
    category: "景点",
    isScheduled: true,
    provider: "amap",
    providerPlaceId: "B03770LV82",
    externalRefs: {
      amapPoiId: "B03770LV82",
    },
  };
  const hydrated = hydrateTripPlacesFromCloud(
    {
      places: [
        {
          id: "place-local-1",
          amapPoiId: "B03770LV82",
          category: "景点",
          isScheduled: true,
        },
      ],
    },
    new Map([["B03770LV82", cachedPlace]]),
  );
  const places = hydrated.places as TripPlace[];

  assert.equal(places[0]?.id, "place-local-1");
  assert.equal(places[0]?.providerPlaceId, "B03770LV82");
  assert.equal(places[0]?.externalRefs?.amapPoiId, "B03770LV82");
});
