import assert from "node:assert/strict";
import test from "node:test";

import {
  compareVersionLike,
  formatAboutRuntimeInfo,
  getPgyerUpdateLink,
  getPgyerUpdateStatus,
  normalizePgyerAppUrl,
} from "../../../features/settings/about-page";

test("formatAboutRuntimeInfo uses Expo version and native build numbers when available", () => {
  const info = formatAboutRuntimeInfo({
    androidVersionCode: 26060420,
    debugMode: false,
    executionEnvironment: "standalone",
    nativeVersion: "1.0.0",
    platformOS: "android",
  });

  assert.equal(info.version, "1.0.0");
  assert.equal(info.buildNumber, "26060420");
  assert.equal(info.platformLabel, "Android");
  assert.equal(info.executionLabel, "独立应用");
  assert.equal(info.releaseChannelLabel, "内测/正式包");
});

test("formatAboutRuntimeInfo keeps development web builds readable", () => {
  const info = formatAboutRuntimeInfo({
    debugMode: true,
    nativeVersion: "",
    platformOS: "web",
  });

  assert.equal(info.version, "1.0.0");
  assert.equal(info.buildNumber, "暂无");
  assert.equal(info.releaseChannelLabel, "Web 调试");
});

test("normalizePgyerAppUrl keeps full Pgyer links intact", () => {
  assert.equal(
    normalizePgyerAppUrl("https://www.pgyer.com/waylog"),
    "https://www.pgyer.com/waylog",
  );
});

test("normalizePgyerAppUrl accepts Pgyer shortcut codes", () => {
  assert.equal(normalizePgyerAppUrl("waylog"), "https://www.pgyer.com/waylog");
  assert.equal(normalizePgyerAppUrl("/waylog"), "https://www.pgyer.com/waylog");
});

test("getPgyerUpdateLink returns a configured Pgyer update URL", () => {
  assert.deepEqual(getPgyerUpdateLink("waylog"), {
    ok: true,
    updateUrl: "https://www.pgyer.com/waylog",
  });
});

test("getPgyerUpdateLink uses public GitHub releases when no distribution is configured", () => {
  assert.deepEqual(getPgyerUpdateLink(), {
    ok: true,
    updateUrl: "https://github.com/PraxisGrove/WayLog/releases",
  });
});

test("getPgyerUpdateLink reports missing Pgyer configuration clearly", () => {
  assert.deepEqual(getPgyerUpdateLink(""), {
    message: "蒲公英更新链接不可用，请稍后再试。",
    ok: false,
  });
});

test("configured app download URL overrides the public release fallback", () => {
  const originalUrl = process.env.EXPO_PUBLIC_APP_DOWNLOAD_URL;
  process.env.EXPO_PUBLIC_APP_DOWNLOAD_URL = "https://example.com/download";

  try {
    assert.deepEqual(getPgyerUpdateLink(), {
      ok: true,
      updateUrl: "https://example.com/download",
    });
    assert.equal(
      getPgyerUpdateStatus({ latest: {} }).updateUrl,
      "https://example.com/download",
    );
  } finally {
    if (originalUrl === undefined) {
      delete process.env.EXPO_PUBLIC_APP_DOWNLOAD_URL;
    } else {
      process.env.EXPO_PUBLIC_APP_DOWNLOAD_URL = originalUrl;
    }
  }
});

test("compareVersionLike compares numeric build-like values", () => {
  assert.equal(compareVersionLike("26060420", "26060421"), 1);
  assert.equal(compareVersionLike("26060421", "26060420"), -1);
  assert.equal(compareVersionLike("26060421", "26060421"), 0);
});

test("compareVersionLike compares dotted versions by numeric parts", () => {
  assert.equal(compareVersionLike("1.0.9", "1.0.10"), 1);
  assert.equal(compareVersionLike("1.2.0", "1.1.9"), -1);
  assert.equal(compareVersionLike("1.2", "1.2.0"), 0);
});

test("getPgyerUpdateStatus prefers native build number comparison", () => {
  const status = getPgyerUpdateStatus({
    currentBuildNumber: "26060420",
    currentVersion: "1.0.0",
    latest: {
      buildUpdateDescription: "修复地点搜索问题",
      buildVersion: "1.0.0",
      buildVersionNo: "26060421",
    },
  });

  assert.deepEqual(status, {
    hasUpdate: true,
    latestBuildNumber: "26060421",
    latestVersion: "1.0.0",
    releaseNotes: "修复地点搜索问题",
    updateUrl: "https://github.com/PraxisGrove/WayLog/releases",
  });
});

test("getPgyerUpdateStatus falls back to version comparison when build number is unavailable", () => {
  const status = getPgyerUpdateStatus({
    currentBuildNumber: "暂无",
    currentVersion: "1.0.0",
    latest: {
      buildVersion: "1.0.1",
      buildVersionNo: "26060421",
    },
  });

  assert.equal(status.hasUpdate, true);
});

test("getPgyerUpdateStatus uses Pgyer update signal when it is provided", () => {
  const status = getPgyerUpdateStatus({
    currentBuildNumber: "26060420",
    currentVersion: "1.0.0",
    latest: {
      buildHaveNewVersion: false,
      buildVersion: "1.0.1",
      buildVersionNo: "26060421",
    },
  });

  assert.equal(status.hasUpdate, false);
});
