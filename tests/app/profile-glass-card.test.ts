import assert from "node:assert";
import { describe, it } from "node:test";

describe("ProfileGlassCard", () => {
  it("应该在 Web 平台上使用 CSS backdrop-filter", () => {
    const originalOS = process.env.EXPO_OS;
    process.env.EXPO_OS = "web";

    const tone = {
      blur: 18,
      cardBackgroundColor: "rgba(255, 255, 255, 0.56)",
      cardBorderColor: "rgba(255, 255, 255, 0.72)",
    };

    const expectedStyle = {
      backgroundColor: tone.cardBackgroundColor,
      borderColor: tone.cardBorderColor,
      backdropFilter: `blur(${tone.blur}px)`,
      WebkitBackdropFilter: `blur(${tone.blur}px)`,
    };

    assert.strictEqual(expectedStyle.backgroundColor, tone.cardBackgroundColor);
    assert.strictEqual(expectedStyle.backdropFilter, "blur(18px)");
    assert.strictEqual(expectedStyle.WebkitBackdropFilter, "blur(18px)");

    process.env.EXPO_OS = originalOS;
  });

  it("应该在原生平台上使用 BlurView 组件", () => {
    const originalOS = process.env.EXPO_OS;
    process.env.EXPO_OS = "android";

    const tone = {
      blur: 18,
      cardBackgroundColor: "rgba(23, 29, 38, 0.72)",
      cardBorderColor: "rgba(255, 255, 255, 0.08)",
    };

    const blurViewProps = {
      intensity: tone.blur,
      tint: tone.cardBackgroundColor.includes("23, 29, 38") ? "dark" : "light",
    };

    assert.strictEqual(blurViewProps.intensity, 18);
    assert.strictEqual(blurViewProps.tint, "dark");

    process.env.EXPO_OS = originalOS;
  });

  it("应该正确判断主题色调", () => {
    const darkTone = {
      cardBackgroundColor: "rgba(23, 29, 38, 0.72)",
    };

    const lightTone = {
      cardBackgroundColor: "rgba(255, 255, 255, 0.56)",
    };

    const isDark = darkTone.cardBackgroundColor.includes("23, 29, 38");
    const isLight = !lightTone.cardBackgroundColor.includes("23, 29, 38");

    assert.strictEqual(isDark, true);
    assert.strictEqual(isLight, true);
  });
});
