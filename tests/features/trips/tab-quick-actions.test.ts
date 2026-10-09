import assert from "node:assert/strict";
import test from "node:test";

import {
  quickActions,
  secondaryQuickActions,
} from "../../../features/trips/quick-actions";

test("quick add sheet does not include smart planning after it moved to tab navigation", () => {
  assert.equal(
    quickActions.some((action) => action.title === "智能规划"),
    false,
  );
  assert.equal(
    secondaryQuickActions.some((action) => action.title === "智能规划"),
    false,
  );
});

test("quick add sheet does not include memo entry", () => {
  assert.equal(
    quickActions.some((action) => action.title === "添加备忘"),
    false,
  );
  assert.equal(
    secondaryQuickActions.some((action) => action.title === "添加备忘"),
    false,
  );
});

test("quick add sheet does not include favorite places entry", () => {
  assert.equal(
    quickActions.some((action) => action.title === "收藏地点"),
    false,
  );
  assert.equal(
    secondaryQuickActions.some((action) => action.title === "收藏地点"),
    false,
  );
});
