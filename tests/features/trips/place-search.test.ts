import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_STORAGE_KEY,
  setAuthStorageAdapter,
} from "../../../features/auth/storage";
import { amapPoiTypeFilters } from "../../../features/trips/amap";
import {
  formatPlaceSearchDistance,
  getTripDayPlaceSearchCenter,
  getTripTitlePlaceSearchRegion,
  searchLocalPlaceSuggestions,
  searchPlaceSuggestions,
} from "../../../features/trips/place-search";
import type { TripDay } from "../../../features/trips/types";

function createAmapPoi(input: {
  adname?: string;
  cityname: string;
  id: string;
  location: string;
  name: string;
  type?: string;
  typecode?: string;
}) {
  return {
    id: input.id,
    name: input.name,
    location: input.location,
    type: input.type ?? "住宿服务;宾馆酒店",
    typecode: input.typecode ?? "100100",
    pname: input.cityname,
    cityname: input.cityname,
    adname: input.adname ?? "",
    address: "测试地址",
    business: {
      rating: "4.5",
      cost: "¥200",
      tel: "010-12345678",
      opentime_today: "00:00-24:00",
    },
    photos: [],
  };
}

function createPoiCacheRow(input: {
  address?: string;
  amapPoiId: string;
  area?: string;
  category?: string;
  iconKey?: string;
  latitude?: number;
  longitude?: number;
  name: string;
  poiGroup?: string;
  poiType?: string;
  rating?: number;
  score?: number;
  distanceKm?: number;
}) {
  return {
    amap_poi_id: input.amapPoiId,
    name: input.name,
    address: input.address ?? "缓存地址",
    area: input.area,
    latitude: input.latitude,
    longitude: input.longitude,
    category: input.category ?? "景点",
    iconKey: input.iconKey ?? "attraction",
    poiGroup: input.poiGroup ?? "attraction",
    poiType: input.poiType ?? "attraction",
    details:
      input.rating != null
        ? { rating: input.rating, ratingSource: "高德" }
        : null,
    externalRefs: {
      amapPoiId: input.amapPoiId,
      amapCityName: input.area,
    },
    score: input.score,
    distance_km: input.distanceKm,
  };
}

async function withMockAmapFetch<T>(
  getPois: (request: {
    params: Record<string, string>;
    path: string;
  }) => unknown[],
  run: (
    calledUrls: string[],
    getPoiSyncRequestCount: () => number,
  ) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const authStorage = new Map<string, string>();
  const calledUrls: string[] = [];
  let poiSyncRequestCount = 0;

  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://travel-test.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  authStorage.set(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      identities: [],
      session: {
        accessToken: "user-session-jwt",
        createdAt: "2026-05-30T00:00:00.000Z",
        lastActiveAt: "2026-05-30T00:00:00.000Z",
        userId: "user-1",
      },
      users: [
        {
          createdAt: "2026-05-30T00:00:00.000Z",
          displayName: "测试用户",
          id: "user-1",
          updatedAt: "2026-05-30T00:00:00.000Z",
        },
      ],
    }),
  );
  setAuthStorageAdapter(createAuthStorageAdapter(authStorage));
  globalThis.fetch = (async (url, init) => {
    const urlText = String(url);

    if (
      urlText.includes("/rest/v1/rpc/search_poi_cache_entries") ||
      urlText.includes("/rest/v1/poi_cache?")
    ) {
      return {
        ok: true,
        status: 200,
        json: async () => [],
      } as Response;
    }

    if (urlText.includes("/rest/v1/rpc/merge_poi_cache_entries")) {
      poiSyncRequestCount += 1;
      return {
        ok: true,
        status: 204,
        json: async () => ({}),
      } as Response;
    }

    const body = JSON.parse(String(init?.body ?? "{}")) as {
      params?: Record<string, string>;
      path?: string;
    };
    const params = body.params ?? {};
    const searchParams = new URLSearchParams(params);

    calledUrls.push(
      `${body.path ?? ""}?${decodeURIComponent(searchParams.toString())}`,
    );

    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: "1",
        info: "OK",
        pois: getPois({
          params,
          path: body.path ?? "",
        }),
      }),
    } as Response;
  }) as typeof fetch;

  try {
    return await run(calledUrls, () => poiSyncRequestCount);
  } finally {
    globalThis.fetch = originalFetch;
    setAuthStorageAdapter(createAuthStorageAdapter(new Map()));

    if (originalSupabaseUrl === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }

    if (originalSupabaseAnonKey === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    }
  }
}

async function withMockPoiCacheFetch<T>(
  getRows: (request: {
    body?: Record<string, unknown>;
    url: string;
  }) => unknown[],
  run: (calledUrls: string[]) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const calledUrls: string[] = [];

  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://travel-test.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  setAuthStorageAdapter(createAuthStorageAdapter(new Map()));
  globalThis.fetch = (async (url, init) => {
    const urlText = String(url);
    calledUrls.push(urlText);

    if (urlText.includes("/rest/v1/rpc/search_poi_cache_entries")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<
        string,
        unknown
      >;

      return {
        ok: true,
        status: 200,
        json: async () => getRows({ body, url: urlText }),
      } as Response;
    }

    if (urlText.includes("/rest/v1/poi_cache?")) {
      return {
        ok: true,
        status: 200,
        json: async () => [],
      } as Response;
    }

    throw new Error(`Unexpected network request: ${urlText}`);
  }) as typeof fetch;

  try {
    return await run(calledUrls);
  } finally {
    globalThis.fetch = originalFetch;
    setAuthStorageAdapter(createAuthStorageAdapter(new Map()));

    if (originalSupabaseUrl === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }

    if (originalSupabaseAnonKey === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    }
  }
}

async function withMockPoiCacheAndAmapFetch<T>(
  getRows: (request: {
    body?: Record<string, unknown>;
    url: string;
  }) => unknown[],
  getPois: (request: {
    params: Record<string, string>;
    path: string;
  }) => unknown[],
  run: (calledUrls: string[]) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const calledUrls: string[] = [];

  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://travel-test.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  setAuthStorageAdapter(createAuthStorageAdapter(new Map()));
  globalThis.fetch = (async (url, init) => {
    const urlText = String(url);
    calledUrls.push(urlText);

    if (urlText.includes("/rest/v1/rpc/search_poi_cache_entries")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<
        string,
        unknown
      >;

      return {
        ok: true,
        status: 200,
        json: async () => getRows({ body, url: urlText }),
      } as Response;
    }

    if (urlText.includes("/rest/v1/poi_cache?")) {
      return {
        ok: true,
        status: 200,
        json: async () => [],
      } as Response;
    }

    if (urlText.includes("/rest/v1/rpc/merge_poi_cache_entries")) {
      return {
        ok: true,
        status: 204,
        json: async () => ({}),
      } as Response;
    }

    const body = JSON.parse(String(init?.body ?? "{}")) as {
      params?: Record<string, string>;
      path?: string;
    };
    const params = body.params ?? {};

    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: "1",
        info: "OK",
        pois: getPois({
          params,
          path: body.path ?? "",
        }),
      }),
    } as Response;
  }) as typeof fetch;

  try {
    return await run(calledUrls);
  } finally {
    globalThis.fetch = originalFetch;
    setAuthStorageAdapter(createAuthStorageAdapter(new Map()));

    if (originalSupabaseUrl === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }

    if (originalSupabaseAnonKey === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    }
  }
}

async function waitForCondition(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (condition()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error("Timed out while waiting for asynchronous condition.");
}

function createAuthStorageAdapter(storage: Map<string, string>) {
  return {
    getItem: async (key: string) => storage.get(key) ?? null,
    removeItem: async (key: string) => {
      storage.delete(key);
    },
    setItem: async (key: string, value: string) => {
      storage.set(key, value);
    },
  };
}

test("cached Amap search results retry the cloud cache write without another Amap request", async () => {
  await withMockAmapFetch(
    () => [
      createAmapPoi({
        id: "harbin-normal-university",
        name: "哈尔滨师范大学",
        cityname: "哈尔滨市",
        adname: "南岗区",
        location: "126.621900,45.722800",
        type: "科教文化服务;学校;高等院校",
        typecode: "141201",
      }),
    ],
    async (calledUrls, getPoiSyncRequestCount) => {
      const query = "哈尔滨师范大学缓存重试测试";
      const firstSuggestions = await searchPlaceSuggestions(query);

      await waitForCondition(() => getPoiSyncRequestCount() === 1);

      const secondSuggestions = await searchPlaceSuggestions(query);

      await waitForCondition(() => getPoiSyncRequestCount() === 2);

      assert.equal(firstSuggestions[0]?.name, "哈尔滨师范大学");
      assert.deepEqual(secondSuggestions, firstSuggestions);
      assert.equal(calledUrls.length, 1);
      assert.equal(getPoiSyncRequestCount(), 2);
    },
  );
});

test("place search returns POI cloud cache hits before requesting Amap", async () => {
  await withMockPoiCacheFetch(
    ({ body }) =>
      body?.p_query === "武康大楼公共缓存测试"
        ? [
            createPoiCacheRow({
              amapPoiId: "B0FFTESTCACHE",
              name: "武康大楼",
              area: "上海市",
              address: "上海市徐汇区淮海中路1850号",
              latitude: 31.2048,
              longitude: 121.4376,
              category: "景点",
              iconKey: "landmark",
              poiGroup: "attraction",
              poiType: "landmark",
              rating: 4.8,
            }),
          ]
        : [],
    async (calledUrls) => {
      const suggestions = await searchPlaceSuggestions(
        "武康大楼公共缓存测试",
        "景点",
        {
          context: "trip",
          regionText: "上海",
        },
      );

      assert.equal(suggestions[0]?.name, "武康大楼");
      assert.equal(suggestions[0]?.provider, "poi_cache");
      assert.equal(suggestions[0]?.providerPlaceId, "B0FFTESTCACHE");
      assert.equal(suggestions[0]?.externalRefs?.amapPoiId, "B0FFTESTCACHE");
      assert.equal(suggestions[0]?.rating, 4.8);
      assert.equal(
        calledUrls.some((url) => url.includes("/functions/v1/amap-proxy")),
        false,
      );
      assert.equal(
        calledUrls.filter((url) =>
          url.includes("/rest/v1/rpc/search_poi_cache_entries"),
        ).length,
        1,
      );
    },
  );
});

test("distant POI cloud cache hits do not block Amap fallback for local chain searches", async () => {
  await withMockPoiCacheAndAmapFetch(
    ({ body }) =>
      body?.p_query === "星巴克公共缓存兜底测试"
        ? [
            createPoiCacheRow({
              amapPoiId: "BEIJING-STARBUCKS",
              name: "星巴克(北京测试店)",
              area: "北京市",
              address: "北京市朝阳区测试路1号",
              latitude: 39.9042,
              longitude: 116.4074,
              category: "餐厅",
              iconKey: "restaurant",
              poiGroup: "food",
              poiType: "cafe",
              distanceKm: 1067,
            }),
          ]
        : [],
    () => [
      createAmapPoi({
        id: "SHANGHAI-STARBUCKS",
        name: "星巴克(上海测试店)",
        cityname: "上海市",
        adname: "徐汇区",
        location: "121.437600,31.204800",
        type: "餐饮服务;咖啡厅;星巴克咖啡",
        typecode: "050501",
      }),
    ],
    async (calledUrls) => {
      const suggestions = await searchPlaceSuggestions(
        "星巴克公共缓存兜底测试",
        "餐厅",
        {
          context: "favorite",
          nearbyCenter: {
            latitude: 31.2048,
            longitude: 121.4376,
            label: "上海",
          },
          regionText: "上海",
        },
      );

      assert.equal(suggestions[0]?.name, "星巴克(上海测试店)");
      assert.equal(suggestions[0]?.provider, "amap");
      assert.ok(
        suggestions.some(
          (suggestion) => suggestion.name === "星巴克(北京测试店)",
        ),
      );
      assert.equal(
        calledUrls.filter((url) =>
          url.includes("/rest/v1/rpc/search_poi_cache_entries"),
        ).length,
        1,
      );
      assert.ok(
        calledUrls.some((url) => url.includes("/functions/v1/amap-proxy")),
      );
    },
  );
});

test("local place suggestions prefer places near the search center", () => {
  const suggestions = searchLocalPlaceSuggestions("", "景点", {
    nearbyCenter: {
      latitude: 34.3675,
      longitude: 109.214,
      label: "华清宫",
    },
  });

  assert.equal(suggestions[0]?.name, "华清宫");
  assert.ok((suggestions[0]?.distanceKm ?? Number.POSITIVE_INFINITY) < 0.01);
  assert.equal(
    suggestions.every((suggestion) => suggestion.category === "景点"),
    true,
  );
});

test("local place category preference does not hide matching candidates", () => {
  const suggestions = searchLocalPlaceSuggestions("钟楼", "餐厅");

  assert.equal(suggestions[0]?.name, "德发长饺子馆(钟楼店)");
  assert.ok(suggestions.some((suggestion) => suggestion.name === "钟楼"));
});

test("trip day place search center follows the last scheduled place with coordinates", () => {
  const day: TripDay = {
    id: "day-1",
    dayIndex: 1,
    title: "第一天",
    items: [
      {
        id: "item-1",
        title: "大雁塔",
        placeId: "place-dayanta",
        placeName: "大雁塔",
      },
      {
        id: "item-2",
        title: "华清宫",
        placeId: "place-huaqinggong",
        placeName: "华清宫",
      },
    ],
  };

  const center = getTripDayPlaceSearchCenter(day, [
    {
      id: "place-dayanta",
      name: "大雁塔",
      latitude: 34.2189,
      longitude: 108.9595,
    },
    {
      id: "place-huaqinggong",
      name: "华清宫",
      latitude: 34.3675,
      longitude: 109.214,
    },
  ]);

  assert.deepEqual(center, {
    latitude: 34.3675,
    longitude: 109.214,
    label: "华清宫",
  });
});

test("place search distance formatting stays compact for candidate metadata", () => {
  assert.equal(formatPlaceSearchDistance(0.25), "250 m");
  assert.equal(formatPlaceSearchDistance(3.42), "3.4 km");
  assert.equal(formatPlaceSearchDistance(118.7), "119 km");
});

test("trip title can provide a lightweight place search region before the trip is saved", () => {
  assert.equal(getTripTitlePlaceSearchRegion("西安 3 日历史文化行"), "西安");
  assert.equal(getTripTitlePlaceSearchRegion("2026 春节"), undefined);
});

test("Amap POI type filters expose the official top-level categories", () => {
  assert.equal(amapPoiTypeFilters.length, 24);
  assert.deepEqual(
    amapPoiTypeFilters.map((filter) => filter.code),
    [
      "010000",
      "020000",
      "030000",
      "040000",
      "050000",
      "060000",
      "070000",
      "080000",
      "090000",
      "100000",
      "110000",
      "120000",
      "130000",
      "140000",
      "150000",
      "160000",
      "170000",
      "180000",
      "190000",
      "200000",
      "220000",
      "970000",
      "980000",
      "990000",
    ],
  );
});

test.skip("remote place search keeps Amap weighted nearby results before broad supplements", async () => {
  await withMockAmapFetch(
    ({ path }) =>
      path === "/v5/place/around"
        ? [
            createAmapPoi({
              id: "nearby-hotel",
              name: "海友酒店上海人民广场店",
              cityname: "上海市",
              adname: "黄浦区",
              location: "121.473700,31.230400",
            }),
          ]
        : [
            createAmapPoi({
              id: "broad-hotel",
              name: "海友酒店杭州西湖店",
              cityname: "杭州市",
              adname: "西湖区",
              location: "120.155100,30.274100",
            }),
          ],
    async (calledUrls) => {
      const suggestions = await searchPlaceSuggestions("海友酒店", "酒店", {
        context: "favorite",
        nearbyCenter: {
          latitude: 31.2304,
          longitude: 121.4737,
          label: "当前位置",
        },
      });
      const decodedUrls = calledUrls.map((url) => decodeURIComponent(url));

      assert.equal(suggestions[0]?.name, "海友酒店上海人民广场店");
      assert.equal(suggestions[1]?.name, "海友酒店杭州西湖店");
      assert.ok(
        decodedUrls.some(
          (url) =>
            url.includes("/v5/place/around") && url.includes("sortrule=weight"),
        ),
      );
      assert.ok(
        decodedUrls.some(
          (url) =>
            url.includes("/v5/place/text") && url.includes("city_limit=false"),
        ),
      );
      assert.ok(decodedUrls.every((url) => url.includes("types=100000")));
    },
  );
});

test("trip place search uses the trip region as a hint without constraining global results", async () => {
  await withMockAmapFetch(
    ({ params }) =>
      params.region
        ? [
            createAmapPoi({
              id: "trip-city-hotel",
              name: "海友酒店西安钟楼店",
              cityname: "西安市",
              adname: "碑林区",
              location: "108.942000,34.261000",
            }),
          ]
        : [
            createAmapPoi({
              id: "global-hotel",
              name: "海友酒店巴黎测试店",
              cityname: "巴黎",
              adname: "",
              location: "2.352200,48.856600",
            }),
          ],
    async (calledUrls) => {
      const suggestions = await searchPlaceSuggestions("海友酒店西安", "酒店", {
        context: "trip",
        regionText: "西安",
      });
      const decodedUrls = calledUrls.map((url) => decodeURIComponent(url));

      assert.equal(suggestions[0]?.name, "海友酒店西安钟楼店");
      assert.equal(suggestions[1]?.name, "海友酒店巴黎测试店");
      assert.ok(
        decodedUrls.some(
          (url) =>
            url.includes("/v5/place/text") && url.includes("region=西安"),
        ),
      );
      assert.ok(decodedUrls.some((url) => url.includes("city_limit=false")));
      assert.ok(
        decodedUrls.some(
          (url) => url.includes("/v5/place/text") && !url.includes("region="),
        ),
      );
      assert.ok(decodedUrls.every((url) => url.includes("types=100000")));
    },
  );
});

test("remote place search keeps overseas candidates unbounded by the trip city", async () => {
  await withMockAmapFetch(
    () => [
      createAmapPoi({
        id: "eiffel-tower",
        name: "Eiffel Tower",
        cityname: "Paris",
        adname: "",
        location: "2.294500,48.858400",
        type: "风景名胜;风景名胜相关;旅游景点",
        typecode: "110000",
      }),
    ],
    async (calledUrls) => {
      const suggestions = await searchPlaceSuggestions("Eiffel Tower", "景点", {
        context: "trip",
        regionText: "西安",
      });
      const decodedUrls = calledUrls.map((url) => decodeURIComponent(url));

      assert.equal(suggestions[0]?.name, "Eiffel Tower");
      assert.equal(suggestions[0]?.category, "景点");
      assert.ok(decodedUrls.every((url) => url.includes("types=110000")));
      assert.ok(decodedUrls.every((url) => url.includes("city_limit=false")));
    },
  );
});

test("remote place search surfaces the proxy error when there is no local fallback", async () => {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://travel-test.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  setAuthStorageAdapter(createAuthStorageAdapter(new Map()));
  globalThis.fetch = (async () => ({
    ok: false,
    status: 401,
    json: async () => ({}),
  })) as unknown as typeof fetch;

  try {
    await assert.rejects(
      () => searchPlaceSuggestions("长安大学"),
      /Amap proxy request failed: HTTP 401/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    setAuthStorageAdapter(createAuthStorageAdapter(new Map()));

    if (originalSupabaseUrl === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }

    if (originalSupabaseAnonKey === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    }
  }
});
