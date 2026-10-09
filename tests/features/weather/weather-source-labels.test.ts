import assert from "node:assert/strict";
import test from "node:test";

import {
  getTripWeatherSourceBadgeLabel,
  type TripWeatherSource,
} from "../../../features/weather";

test("mock weather uses forecast badge copy", () => {
  const source: TripWeatherSource = {
    label: "本地模拟",
    type: "mock",
  };

  assert.equal(getTripWeatherSourceBadgeLabel(source), "预测");
});

test("remote weather sources do not show a badge", () => {
  const source: TripWeatherSource = {
    label: "高德天气",
    type: "amap",
  };

  assert.equal(getTripWeatherSourceBadgeLabel(source), undefined);
});
