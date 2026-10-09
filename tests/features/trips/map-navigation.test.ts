import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNativeMapNavigationUrls,
  buildNativeMapPlaceUrls,
  buildNativeMapRouteUrls,
  getAvailableMapUrlCandidates,
  type MapUrlProvider,
  prioritizeDefaultNavigationCandidates,
} from "../../../features/trips/map-navigation";
import type { TripPlace } from "../../../features/trips/types";

const BELL_TOWER_PLACE: TripPlace = {
  id: "bell-tower",
  name: "BellTower",
  category: "景点",
  isScheduled: true,
  address: "No 1 Main Street",
  area: "Xian",
  latitude: 34.2572,
  longitude: 108.9439,
  externalRefs: {
    amapPoiId: "B001",
  },
};

function providers(urls: { provider: MapUrlProvider }[]): MapUrlProvider[] {
  return urls.map((url) => url.provider);
}

function assertMatches(value: string, pattern: RegExp) {
  assert.ok(pattern.test(value), `expected "${value}" to match ${pattern}`);
}

test("native navigation prefers Amap before iOS map app fallbacks", () => {
  const urls = buildNativeMapNavigationUrls(BELL_TOWER_PLACE, "driving", "ios");

  assert.deepEqual(providers(urls), ["amap", "apple", "baidu", "web-amap"]);
  assertMatches(urls[0]?.url, /^iosamap:\/\/navi\?/);
  assertMatches(decodeURIComponent(urls[0]?.url), /poiname=BellTower/);
  assertMatches(decodeURIComponent(urls[0]?.url), /lat=34.2572/);
  assertMatches(decodeURIComponent(urls[0]?.url), /lon=108.9439/);
  assertMatches(urls[1]?.url, /^http:\/\/maps\.apple\.com\//);
  assertMatches(urls[2]?.url, /^baidumap:\/\/map\/direction\?/);
});

test("native navigation includes web fallback on Android", () => {
  const urls = buildNativeMapNavigationUrls(
    BELL_TOWER_PLACE,
    "driving",
    "android",
  );

  assert.deepEqual(providers(urls), ["amap", "baidu", "system", "web-amap"]);
  assertMatches(urls[0]?.url, /^androidamap:\/\/navi\?/);
  assertMatches(urls[1]?.url, /^baidumap:\/\/map\/direction\?/);
  assertMatches(urls[2]?.url, /^geo:/);
  assertMatches(urls[3]?.url, /^https:\/\/uri\.amap\.com\//);
});

test("Android navigation uses Amap keyword navigation when a place has no coordinates", () => {
  const urls = buildNativeMapNavigationUrls(
    {
      ...BELL_TOWER_PLACE,
      latitude: undefined,
      longitude: undefined,
    },
    "driving",
    "android",
  );

  assert.deepEqual(providers(urls), ["amap", "baidu", "system", "web-amap"]);
  assertMatches(urls[0]?.url, /^androidamap:\/\/keywordNavi\?/);
  assertMatches(decodeURIComponent(urls[0]?.url), /keyword=BellTower/);
});

test("place preview links also prefer native map apps", () => {
  const androidUrls = buildNativeMapPlaceUrls(BELL_TOWER_PLACE, "android");
  const iosUrls = buildNativeMapPlaceUrls(BELL_TOWER_PLACE, "ios");

  assert.deepEqual(providers(androidUrls), [
    "amap",
    "baidu",
    "system",
    "web-amap",
  ]);
  assertMatches(androidUrls[0]?.url, /^androidamap:\/\/viewMap\?/);
  assert.deepEqual(providers(iosUrls), ["amap", "apple", "baidu", "web-amap"]);
  assertMatches(iosUrls[0]?.url, /^iosamap:\/\/viewMap\?/);
});

test("web keeps a browser fallback because native app schemes are platform dependent", () => {
  const urls = buildNativeMapNavigationUrls(BELL_TOWER_PLACE, "driving", "web");

  assert.deepEqual(providers(urls), ["web-amap"]);
  assertMatches(urls[0]?.url, /^https:\/\/uri\.amap\.com\//);
});

test("available native candidates are filtered by installed app scheme checks", async () => {
  const urls = buildNativeMapNavigationUrls(
    BELL_TOWER_PLACE,
    "driving",
    "android",
  );
  const availableUrls = await getAvailableMapUrlCandidates(
    urls,
    async (url) => url === "baidumap://",
  );

  assert.deepEqual(providers(availableUrls), ["baidu"]);
});

test("native candidate filtering retries the real URL when bare scheme checks fail", async () => {
  const urls = buildNativeMapRouteUrls(
    {
      fromLabel: "BellTower",
      fromCoordinates: { latitude: 34.2572, longitude: 108.9439 },
      toLabel: "CityWall",
      toCoordinates: { latitude: 34.265, longitude: 108.951 },
    },
    "walking",
    "android",
  );
  const availableUrls = await getAvailableMapUrlCandidates(urls, async (url) =>
    url.startsWith("androidamap://route?"),
  );

  assert.deepEqual(providers(availableUrls), ["amap"]);
});

test("available native candidate filtering preserves provider priority", async () => {
  const urls = buildNativeMapNavigationUrls(BELL_TOWER_PLACE, "driving", "ios");
  const availableUrls = await getAvailableMapUrlCandidates(
    urls,
    async (url) => url === "iosamap://" || url === "baidumap://",
  );

  assert.deepEqual(providers(availableUrls), ["amap", "baidu"]);
});

test("failed installed app probes are treated as unavailable", async () => {
  const urls = buildNativeMapNavigationUrls(
    BELL_TOWER_PLACE,
    "driving",
    "android",
  );
  const availableUrls = await getAvailableMapUrlCandidates(
    urls,
    async (url) => {
      if (url === "androidamap://") {
        throw new Error("probe failed");
      }

      return url === "geo:0,0?q=0,0";
    },
  );

  assert.deepEqual(providers(availableUrls), ["system"]);
});

test("route navigation between two places builds native app route URLs", () => {
  const urls = buildNativeMapRouteUrls(
    {
      fromLabel: "BellTower",
      fromCoordinates: { latitude: 34.2572, longitude: 108.9439 },
      toLabel: "CityWall",
      toCoordinates: { latitude: 34.265, longitude: 108.951 },
    },
    "walking",
    "ios",
  );

  assert.deepEqual(providers(urls), ["amap", "apple", "baidu", "web-amap"]);
  assertMatches(urls[0]?.url, /^iosamap:\/\/path\?/);
  assertMatches(decodeURIComponent(urls[0]?.url), /sname=BellTower/);
  assertMatches(decodeURIComponent(urls[0]?.url), /dname=CityWall/);
  assertMatches(decodeURIComponent(urls[0]?.url), /t=2/);
  assertMatches(urls[1]?.url, /^http:\/\/maps\.apple\.com\//);
  assertMatches(urls[2]?.url, /^baidumap:\/\/map\/direction\?/);
});

test("default route navigation on Android prefers apps that preserve the origin first", () => {
  const urls = buildNativeMapRouteUrls(
    {
      fromLabel: "BellTower",
      fromCoordinates: { latitude: 34.2572, longitude: 108.9439 },
      toLabel: "CityWall",
      toCoordinates: { latitude: 34.265, longitude: 108.951 },
    },
    "walking",
    "android",
  );

  const prioritized = prioritizeDefaultNavigationCandidates(urls, "android");

  assert.deepEqual(providers(prioritized), [
    "amap",
    "baidu",
    "system",
    "web-amap",
  ]);
  assertMatches(prioritized[0]?.url, /^androidamap:\/\/route\?/);
  assertMatches(decodeURIComponent(prioritized[0]?.url), /slat=34.2572/);
  assertMatches(decodeURIComponent(prioritized[0]?.url), /dlat=34.265/);
  assertMatches(prioritized[2]?.url, /^geo:/);
});

test("default navigation on iOS prefers Apple Maps handoff first", () => {
  const urls = buildNativeMapRouteUrls(
    {
      fromLabel: "BellTower",
      fromCoordinates: { latitude: 34.2572, longitude: 108.9439 },
      toLabel: "CityWall",
      toCoordinates: { latitude: 34.265, longitude: 108.951 },
    },
    "walking",
    "ios",
  );

  const prioritized = prioritizeDefaultNavigationCandidates(urls, "ios");

  assert.deepEqual(providers(prioritized), [
    "apple",
    "amap",
    "baidu",
    "web-amap",
  ]);
  assertMatches(prioritized[0]?.url, /^http:\/\/maps\.apple\.com\//);
});

test("Android route navigation skips Amap when coordinates are missing", () => {
  const urls = buildNativeMapRouteUrls(
    {
      fromLabel: "BellTower",
      fromQuery: "BellTower Xian",
      toLabel: "CityWall",
      toQuery: "CityWall Xian",
    },
    "driving",
    "android",
  );

  assert.deepEqual(providers(urls), ["baidu", "system"]);
  assertMatches(urls[0]?.url, /^baidumap:\/\/map\/direction\?/);
  assertMatches(urls[1]?.url, /^geo:/);
});
