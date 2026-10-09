import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveAndroidNavigationBarButtonStyle } from "../../../shared/theme/android-navigation-bar-style";

describe("resolveAndroidNavigationBarButtonStyle", () => {
  it("maps explicit navigation bar styles to readable button styles", () => {
    assert.equal(
      resolveAndroidNavigationBarButtonStyle("light", "light"),
      "dark",
    );
    assert.equal(
      resolveAndroidNavigationBarButtonStyle("dark", "dark"),
      "light",
    );
  });

  it("uses readable buttons for auto mode", () => {
    assert.equal(
      resolveAndroidNavigationBarButtonStyle("auto", "light"),
      "dark",
    );
    assert.equal(
      resolveAndroidNavigationBarButtonStyle("auto", "dark"),
      "light",
    );
    assert.equal(resolveAndroidNavigationBarButtonStyle("auto", null), "dark");
  });

  it("inverts the system color scheme when requested", () => {
    assert.equal(
      resolveAndroidNavigationBarButtonStyle("inverted", "light"),
      "light",
    );
    assert.equal(
      resolveAndroidNavigationBarButtonStyle("inverted", "dark"),
      "dark",
    );
    assert.equal(
      resolveAndroidNavigationBarButtonStyle("inverted", undefined),
      "light",
    );
  });
});
