import assert from "node:assert/strict";
import test from "node:test";

import { formatPlacePoiType } from "../../../features/trips/place-kind";

test("formatPlacePoiType uses a compact label for Amap semicolon POI types", () => {
  assert.equal(formatPlacePoiType("科教文化服务;学校;高等院校"), "高等院校");
});

test("formatPlacePoiType keeps existing simple POI labels", () => {
  assert.equal(formatPlacePoiType("school"), "学校");
  assert.equal(formatPlacePoiType("tourism:museum"), "博物馆");
});
