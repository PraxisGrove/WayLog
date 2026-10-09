import assert from "node:assert/strict";
import test from "node:test";
import AsyncStorageModule from "@react-native-async-storage/async-storage";

import {
  clearLocalFavoritePlaceData,
  createPreviewTripPlaceFromSuggestion,
  getFavoritePlaces,
} from "../../../features/trips/favorite-places";
import {
  createScheduledTripPlaceFromSuggestion,
  createTripDayItemFromPlaceSuggestion,
  createTripPlaceFromPlaceSuggestion,
} from "../../../features/trips/place-draft";
import type { PlaceSuggestion } from "../../../features/trips/place-search";
import {
  clearLocalTripData,
  getTrips,
  TRIPS_STORAGE_KEY,
} from "../../../features/trips/storage";

const AsyncStorage =
  (AsyncStorageModule as { default?: typeof AsyncStorageModule }).default ??
  AsyncStorageModule;

function createSuggestion(): PlaceSuggestion {
  return {
    id: "amap-B001D03PEX",
    provider: "amap",
    providerPlaceId: "B001D03PEX",
    name: "陕西历史博物馆",
    category: "景点",
    area: "陕西省西安市雁塔区",
    address: "小寨东路 91 号",
    iconKey: "museum",
    poiGroup: "attraction",
    poiType: "博物馆",
    externalRefs: {
      amapPoiId: "B001D03PEX",
    },
    latitude: 34.2223,
    longitude: 108.9542,
  };
}

test("createScheduledTripPlaceFromSuggestion creates local trip place with provider reference", () => {
  const place = createScheduledTripPlaceFromSuggestion(createSuggestion());

  assert.match(place.id, /^place-/);
  assert.equal(place.address, "小寨东路 91 号");
  assert.equal(place.note, undefined);
  assert.equal(place.provider, "amap");
  assert.equal(place.providerPlaceId, "B001D03PEX");
  assert.equal(place.externalRefs?.amapPoiId, "B001D03PEX");
});

test("createTripPlaceFromPlaceSuggestion remains a compatibility wrapper", () => {
  const place = createTripPlaceFromPlaceSuggestion(createSuggestion());

  assert.match(place.id, /^place-/);
  assert.equal(place.providerPlaceId, "B001D03PEX");
});

test("createPreviewTripPlaceFromSuggestion keeps source id for transient detail display", () => {
  const place = createPreviewTripPlaceFromSuggestion(createSuggestion());

  assert.equal(place.id, "amap-B001D03PEX");
  assert.equal(place.provider, "amap");
  assert.equal(place.providerPlaceId, "B001D03PEX");
});

test("createTripDayItemFromPlaceSuggestion leaves note empty by default", () => {
  const item = createTripDayItemFromPlaceSuggestion(
    createSuggestion(),
    "place-1",
  );

  assert.equal(item.placeId, "place-1");
  assert.equal(item.note, undefined);
});

test("getTrips strips legacy place note when it only duplicates address", async (t) => {
  await AsyncStorage.clear();
  await clearLocalTripData();

  t.after(async () => {
    await clearLocalTripData();
  });

  await AsyncStorage.setItem(
    TRIPS_STORAGE_KEY,
    JSON.stringify([
      {
        id: "trip-1",
        title: "Legacy Trip",
        destination: "XiAn",
        currency: "CNY",
        status: "计划中",
        days: [],
        places: [
          {
            id: "place-1",
            name: "陕西历史博物馆",
            category: "景点",
            isScheduled: true,
            address: "小寨东路 91 号",
            note: "小寨东路 91 号",
          },
        ],
        transports: [],
        lodgings: [],
        memos: [],
        checklistItems: [],
        expenses: [],
        importSources: [],
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ]),
  );

  const trips = await getTrips();

  assert.equal(trips[0]?.places[0]?.address, "小寨东路 91 号");
  assert.equal(trips[0]?.places[0]?.note, undefined);
});

test("getFavoritePlaces strips legacy favorite note when it only duplicates address", async (t) => {
  await AsyncStorage.clear();
  await clearLocalFavoritePlaceData();

  t.after(async () => {
    await clearLocalFavoritePlaceData();
  });

  await AsyncStorage.setItem(
    "waylog.favorite_places.v1",
    JSON.stringify([
      {
        id: "favorite-place-1",
        name: "陕西历史博物馆",
        category: "景点",
        address: "小寨东路 91 号",
        note: "小寨东路 91 号",
        favoritedAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ]),
  );

  const places = await getFavoritePlaces();

  assert.equal(places[0]?.address, "小寨东路 91 号");
  assert.equal(places[0]?.note, undefined);
});
