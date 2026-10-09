import assert from "node:assert/strict";
import test from "node:test";

import {
  doesTripDayItemMatchPlace,
  getPlaceForTripDayItem,
  removeUnusedTripPlacesForDayItems,
} from "../../../features/trips/day-items";
import type {
  Trip,
  TripDayItem,
  TripPlace,
} from "../../../features/trips/types";

function getRequired<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

function createTripWithPlaces(places: TripPlace[]): Trip {
  return {
    id: "trip-day-items",
    title: "Day item place matching",
    destination: "Xian",
    currency: "CNY",
    status: "计划中",
    days: [],
    places,
    transports: [],
    lodgings: [],
    memos: [],
    checklistItems: [],
    expenses: [],
    importSources: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}

test("getPlaceForTripDayItem prefers exact placeId matches over title matches", () => {
  const places: TripPlace[] = [
    {
      id: "place-a",
      name: "Bell Tower",
      category: "景点",
      isScheduled: true,
    },
    {
      id: "place-b",
      name: "Bell Tower",
      category: "景点",
      isScheduled: true,
    },
  ];
  const item: TripDayItem = {
    id: "item-1",
    title: "Bell Tower",
    placeId: "place-b",
    placeName: "Bell Tower",
  };

  assert.equal(
    getPlaceForTripDayItem(createTripWithPlaces(places), item)?.id,
    "place-b",
  );
});

test("getPlaceForTripDayItem skips ambiguous name-only matches", () => {
  const places: TripPlace[] = [
    {
      id: "place-a",
      name: "Bell Tower",
      category: "景点",
      isScheduled: true,
    },
    {
      id: "place-b",
      name: "Bell Tower",
      category: "景点",
      isScheduled: true,
    },
  ];
  const item: TripDayItem = {
    id: "item-1",
    title: "Bell Tower",
    placeName: "Bell Tower",
  };

  assert.equal(
    getPlaceForTripDayItem(createTripWithPlaces(places), item),
    undefined,
  );
});

test("doesTripDayItemMatchPlace uses trip place context to reject ambiguous name matches", () => {
  const places: TripPlace[] = [
    {
      id: "place-a",
      name: "Bell Tower",
      category: "景点",
      isScheduled: true,
    },
    {
      id: "place-b",
      name: "Bell Tower",
      category: "景点",
      isScheduled: true,
    },
  ];
  const item: TripDayItem = {
    id: "item-1",
    title: "Bell Tower",
    placeName: "Bell Tower",
  };

  assert.equal(
    doesTripDayItemMatchPlace(
      item,
      getRequired(places[0], "expected first place"),
      places,
    ),
    false,
  );
  assert.equal(
    doesTripDayItemMatchPlace(
      item,
      getRequired(places[1], "expected second place"),
      places,
    ),
    false,
  );
});

test("removeUnusedTripPlacesForDayItems keeps places still referenced by exact placeId", () => {
  const places: TripPlace[] = [
    {
      id: "place-a",
      name: "Bell Tower",
      category: "景点",
      isScheduled: true,
    },
    {
      id: "place-b",
      name: "Bell Tower",
      category: "景点",
      isScheduled: true,
    },
  ];

  const remainingPlaces = removeUnusedTripPlacesForDayItems(
    places,
    [
      {
        id: "day-1",
        dayIndex: 1,
        title: "Day 1",
        items: [
          {
            id: "item-still-kept",
            title: "Bell Tower",
            placeId: "place-b",
            placeName: "Bell Tower",
          },
        ],
      },
    ],
    [
      {
        id: "item-removed",
        title: "Bell Tower",
        placeId: "place-a",
        placeName: "Bell Tower",
      },
    ],
  );

  assert.deepEqual(remainingPlaces.map((place) => place.id).sort(), [
    "place-b",
  ]);
});
