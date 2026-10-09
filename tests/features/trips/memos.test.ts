import assert from "node:assert/strict";
import test from "node:test";

import { appendTripMemo, createTripMemo } from "../../../features/trips/memos";
import type { Trip } from "../../../features/trips/types";

test("createTripMemo trims title and detail for travel reminders", () => {
  const memo = createTripMemo({
    title: "  证件提醒  ",
    detail: "  护照和签证放在随身包  ",
  });

  assert.equal(memo.title, "证件提醒");
  assert.equal(memo.detail, "护照和签证放在随身包");
  assert.equal(memo.pinned, false);
  assert.ok(/^memo-/.test(memo.id));
});

test("createTripMemo falls back to default title when title is empty", () => {
  const memo = createTripMemo({
    title: "   ",
    detail: " 提前值机 ",
  });

  assert.equal(memo.title, "备忘");
  assert.equal(memo.detail, "提前值机");
});

test("appendTripMemo appends memo and refreshes trip updated time", () => {
  const trip: Trip = {
    id: "trip-1",
    title: "西安 3 日历史文化行",
    destination: "西安",
    currency: "CNY",
    status: "计划中",
    days: [],
    places: [],
    transports: [],
    lodgings: [],
    memos: [],
    checklistItems: [],
    expenses: [],
    importSources: [],
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  };

  const nextTrip = appendTripMemo(trip, {
    title: "航班",
    detail: "MU1234 09:20 起飞",
  });

  assert.equal(nextTrip.memos.length, 1);
  assert.equal(nextTrip.memos[0]?.title, "航班");
  assert.equal(nextTrip.memos[0]?.detail, "MU1234 09:20 起飞");
  assert.ok(nextTrip.updatedAt !== trip.updatedAt);
  assert.equal(trip.memos.length, 0);
});
