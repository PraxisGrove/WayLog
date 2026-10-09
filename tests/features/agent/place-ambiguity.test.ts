import assert from "node:assert/strict";
import test from "node:test";

import {
  isRequestedPlaceCandidate,
  isUnrequestedDerivedPlaceName,
} from "../../../features/agent";

test("isRequestedPlaceCandidate accepts a venue suffix but rejects transit substitutes", () => {
  assert.equal(
    isRequestedPlaceCandidate("圆通山(地铁站)", "圆通山", "把圆通山加到第六天"),
    false,
  );
  assert.equal(
    isRequestedPlaceCandidate("圆通山公园", "圆通山", "把圆通山加到第六天"),
    true,
  );
  assert.equal(
    isRequestedPlaceCandidate("昆明动物园", "昆明动物园", "把圆通山加到第六天"),
    false,
  );
  assert.equal(
    isRequestedPlaceCandidate("西山", "山", "把圆通山加到第六天"),
    false,
  );
});

test("isUnrequestedDerivedPlaceName treats unspoken route-like POIs as ambiguous children", () => {
  assert.equal(
    isUnrequestedDerivedPlaceName(
      "虎跳峡东环线",
      "虎跳峡",
      "把虎跳峡加入第四天",
    ),
    true,
  );
  assert.equal(
    isUnrequestedDerivedPlaceName(
      "虎跳峡观光栈道",
      "虎跳峡",
      "把虎跳峡加入第四天",
    ),
    true,
  );
});

test("isUnrequestedDerivedPlaceName allows the route-like POI when the user names it", () => {
  assert.equal(
    isUnrequestedDerivedPlaceName(
      "虎跳峡东环线",
      "虎跳峡",
      "把虎跳峡东环线加入第四天",
    ),
    false,
  );
});

test("isUnrequestedDerivedPlaceName keeps normal exact POIs selectable without extra ambiguity", () => {
  assert.equal(
    isUnrequestedDerivedPlaceName("虎跳峡", "虎跳峡", "把虎跳峡加入第四天"),
    false,
  );
});
