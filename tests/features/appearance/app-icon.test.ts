import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_ICON_PATTERNS,
  DEFAULT_APP_ICON_PATTERN,
  getAppIconName,
  getAppIconPalette,
  isAppIconPatternId,
  normalizeAppIconPatternId,
} from "../../../features/appearance/app-icon";

test("defines the six lightweight logo background patterns", () => {
  assert.equal(APP_ICON_PATTERNS.length, 6);
  assert.deepEqual(
    APP_ICON_PATTERNS.map((pattern) => pattern.id),
    [
      "sunburst",
      "handdrawn-check",
      "soft-waves",
      "diagonal-bands",
      "wide-grid",
      "tilted-check",
    ],
  );
  assert.equal(DEFAULT_APP_ICON_PATTERN, "sunburst");
});

test("validates and normalizes stored pattern ids", () => {
  assert.equal(isAppIconPatternId("wide-grid"), true);
  assert.equal(isAppIconPatternId("missing"), false);
  assert.equal(normalizeAppIconPatternId("h"), "diagonal-bands");
  assert.equal(normalizeAppIconPatternId("tilted-check"), "tilted-check");
  assert.equal(normalizeAppIconPatternId(null), undefined);
});

test("builds the native app icon alias name from theme color and pattern", () => {
  assert.equal(getAppIconName("nature", "soft-waves"), "nature-soft-waves");
  assert.equal(
    getAppIconName("unknown", "handdrawn-check"),
    "warm-handdrawn-check",
  );
});

test("returns the native app icon palette used by generated Android resources", () => {
  assert.deepEqual(getAppIconPalette("warm"), {
    main: "#F2CD68",
    soft: "#FFF0B8",
  });
  assert.deepEqual(getAppIconPalette("unknown"), getAppIconPalette("warm"));
});
