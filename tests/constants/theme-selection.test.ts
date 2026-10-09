import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveSelectedThemeId,
  resolveStoredThemeId,
} from "../../shared/theme/theme-selection";

test("设置页可以立即切换回简洁皮肤", () => {
  assert.equal(resolveSelectedThemeId("classic"), "classic");
});

test("重启后保留已选择的简洁皮肤", () => {
  assert.equal(resolveStoredThemeId("classic"), "classic");
});

test("无效的已存皮肤仍回退到默认皮肤", () => {
  assert.equal(resolveStoredThemeId("missing"), "default");
});
