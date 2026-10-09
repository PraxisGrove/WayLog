import assert from "node:assert/strict";
import test from "node:test";

import {
  formatTripDayTitle,
  isDefaultTripDayTitle,
  resolveTripDayTitle,
} from "../../../features/trips/day-title";

test("formatTripDayTitle formats Chinese day labels", () => {
  assert.equal(formatTripDayTitle(1), "第一天");
  assert.equal(formatTripDayTitle(2), "第二天");
  assert.equal(formatTripDayTitle(11), "第11天");
});

test("resolveTripDayTitle falls back to the default day title", () => {
  assert.equal(resolveTripDayTitle({ dayIndex: 1, title: "" }), "第一天");
  assert.equal(
    resolveTripDayTitle({ dayIndex: 2, title: "  大理古城与洱海  " }),
    "大理古城与洱海",
  );
});

test("isDefaultTripDayTitle recognizes current and legacy default titles", () => {
  assert.equal(isDefaultTripDayTitle({ dayIndex: 2, title: "第二天" }), true);
  assert.equal(isDefaultTripDayTitle({ dayIndex: 2, title: "第 2 天" }), true);
  assert.equal(
    isDefaultTripDayTitle({ dayIndex: 2, title: "大理古城与洱海" }),
    false,
  );
});
