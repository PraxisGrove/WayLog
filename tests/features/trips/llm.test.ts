import assert from "node:assert/strict";
import test from "node:test";

import { shouldGeneratePlaceSummary } from "../../../features/trips/llm";

test("shouldGeneratePlaceSummary skips custom places without shared amap poi id", () => {
  assert.equal(
    shouldGeneratePlaceSummary({
      placeId: "place-123",
      placeName: "我的秘密机位",
      category: "景点",
      poiGroup: "attraction",
    }),
    false,
  );
});

test("shouldGeneratePlaceSummary skips low-value poi groups", () => {
  assert.equal(
    shouldGeneratePlaceSummary({
      placeId: "B001LOWVALUE",
      placeName: "西安北站地铁站",
      category: "交通",
      poiGroup: "transport",
    }),
    false,
  );
});

test("shouldGeneratePlaceSummary skips low-value names", () => {
  assert.equal(
    shouldGeneratePlaceSummary({
      placeId: "B001TOILET",
      placeName: "景区公共厕所",
      category: "其他",
      poiGroup: "attraction",
    }),
    false,
  );
});

test("shouldGeneratePlaceSummary allows meaningful shared attraction poi", () => {
  assert.equal(
    shouldGeneratePlaceSummary({
      placeId: "B001D03PEX",
      placeName: "陕西历史博物馆",
      category: "景点",
      poiGroup: "attraction",
    }),
    true,
  );
});
