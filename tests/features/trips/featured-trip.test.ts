import assert from "node:assert/strict";
import test from "node:test";

import {
  getFeaturedTrip,
  getTripStatusDisplayLabel,
} from "../../../features/trips/status";
import type { Trip, TripStatus } from "../../../features/trips/types";

function createTrip(
  id: string,
  status: TripStatus,
  startDate?: string,
  endDate?: string,
): Trip {
  return {
    id,
    title: id,
    destination: id,
    currency: "CNY",
    startDate,
    endDate,
    status,
    days: [],
    places: [],
    transports: [],
    lodgings: [],
    memos: [],
    checklistItems: [],
    expenses: [],
    importSources: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const today = new Date(2026, 5, 12, 12);

test("seed trips always display the example label regardless of auto status", () => {
  assert.equal(
    getTripStatusDisplayLabel(createTrip("seed-xian", "旅途中")),
    "示例",
  );
  assert.equal(
    getTripStatusDisplayLabel(createTrip("seed-xian", "已完成")),
    "示例",
  );
  assert.equal(
    getTripStatusDisplayLabel(createTrip("real-trip", "旅途中")),
    "旅途中",
  );
});

test("featured trip prefers an active trip over future and completed trips", () => {
  const featured = getFeaturedTrip(
    [
      createTrip("completed", "已完成", "2026-05-01", "2026-05-03"),
      createTrip("future", "计划中", "2026-06-18", "2026-06-20"),
      createTrip("active", "旅途中", "2026-06-11", "2026-06-14"),
    ],
    today,
  );

  assert.equal(featured?.id, "active");
});

test("featured trip selects the nearest future start date regardless of list order", () => {
  const featured = getFeaturedTrip(
    [
      createTrip("later", "计划中", "2026-08-01", "2026-08-03"),
      createTrip("nearest", "计划中", "2026-06-15", "2026-06-17"),
      createTrip("middle", "计划中", "2026-07-01", "2026-07-02"),
    ],
    today,
  );

  assert.equal(featured?.id, "nearest");
});

test("featured trip prefers the most recently started active trip when dates overlap", () => {
  const featured = getFeaturedTrip(
    [
      createTrip("long-running", "旅途中", "2026-06-01", "2026-06-20"),
      createTrip("recent-active", "旅途中", "2026-06-10", "2026-06-13"),
    ],
    today,
  );

  assert.equal(featured?.id, "recent-active");
});

test("featured trip stays empty when only completed or undated planned trips exist", () => {
  const featured = getFeaturedTrip(
    [
      createTrip("completed", "已完成", "2026-05-01", "2026-05-03"),
      createTrip("undated", "计划中"),
    ],
    today,
  );

  assert.equal(featured, undefined);
});
