import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeGlobalSearchScope,
  searchTripsForGlobalSearch,
} from "../../../features/search";
import type { Trip } from "../../../features/trips/types";

function createTrip(overrides: Partial<Trip>): Trip {
  return {
    checklistItems: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: "CNY",
    days: [],
    destination: "",
    expenses: [],
    id: "trip-default",
    importSources: [],
    lodgings: [],
    memos: [],
    places: [],
    startDate: "2026-06-01",
    endDate: "2026-06-03",
    status: "计划中",
    title: "未命名行程",
    transports: [],
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("global search scope falls back to places for unknown values", () => {
  assert.equal(normalizeGlobalSearchScope("trips"), "trips");
  assert.equal(normalizeGlobalSearchScope("unknown"), "places");
});

test("trip global search prioritizes trip titles before other matched fields", () => {
  const trips = [
    createTrip({
      destination: "西安",
      id: "destination-match",
      title: "六月旅行",
      updatedAt: "2026-01-03T00:00:00.000Z",
    }),
    createTrip({
      destination: "成都",
      id: "title-match",
      title: "西安 3 日历史文化行",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }),
  ];

  const results = searchTripsForGlobalSearch(trips, "西安");

  assert.equal(results[0]?.id, "title-match");
  assert.equal(results[1]?.id, "destination-match");
});

test("trip global search can match planned place names", () => {
  const results = searchTripsForGlobalSearch(
    [
      createTrip({
        id: "xian-trip",
        places: [
          {
            category: "景点",
            id: "place-1",
            isScheduled: true,
            name: "大雁塔",
          },
        ],
        title: "古都周末",
      }),
    ],
    "大雁塔",
  );

  assert.equal(results.length, 1);
  assert.equal(results[0]?.id, "xian-trip");
});
