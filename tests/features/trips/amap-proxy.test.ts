import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_STORAGE_KEY,
  setAuthStorageAdapter,
} from "../../../features/auth/storage";
import {
  buildAmapPlaceStaticMapUrl,
  queryAmapRoute,
  searchAmapPlaceSuggestions,
} from "../../../features/trips/amap";

async function withMockSupabaseAmapProxy<T>(
  run: (requests: RequestInitRecord[]) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const originalAmapKey = process.env.EXPO_PUBLIC_AMAP_WEB_SERVICE_KEY;
  const authStorage = new Map<string, string>();
  const requests: RequestInitRecord[] = [];

  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://travel-test.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  delete process.env.EXPO_PUBLIC_AMAP_WEB_SERVICE_KEY;
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
    const request = {
      body: typeof init?.body === "string" ? init.body : undefined,
      headers: init?.headers as Record<string, string> | undefined,
      method: init?.method,
      url: String(url),
    };
    requests.push(request);

    assert.equal(
      request.url,
      "https://travel-test.supabase.co/functions/v1/amap-proxy",
    );
    assert.equal(request.method, "POST");
    assert.equal(request.headers?.apikey, "test-anon-key");
    assert.equal(request.headers?.Authorization, "Bearer user-session-jwt");

    const body = JSON.parse(request.body ?? "{}") as {
      params?: Record<string, string>;
      path?: string;
      responseType?: string;
    };

    assert.equal(typeof body.path, "string");
    assert.equal(body.params?.key, undefined);

    if (body.path === "/v5/place/text") {
      return createJsonResponse({
        status: "1",
        info: "OK",
        pois: [
          {
            id: "poi-1",
            name: "钟楼",
            location: "108.943900,34.257200",
            type: "风景名胜;风景名胜相关;旅游景点",
            typecode: "110000",
            pname: "陕西省",
            cityname: "西安市",
            adname: "碑林区",
            address: "测试地址",
            business: {
              rating: "4.8",
              cost: "¥50",
              tel: "029-12345678",
              opentime_today: "08:00-18:00",
              tag: "古建筑,历史遗迹",
              business_area: "钟楼商圈",
            },
            photos: [
              { title: "钟楼全景", url: "https://example.com/zhonglou.jpg" },
            ],
          },
        ],
      });
    }

    if (body.path === "/v3/direction/walking") {
      return createJsonResponse({
        status: "1",
        info: "OK",
        route: {
          paths: [
            {
              distance: "1200",
              duration: "900",
              steps: [
                { polyline: "108.943900,34.257200;108.951000,34.265000" },
              ],
            },
          ],
        },
      });
    }

    if (body.path === "/v3/direction/transit/integrated") {
      assert.equal(body.params?.city, "西安市");
      assert.equal(body.params?.cityd, "咸阳市");

      return createJsonResponse({
        status: "1",
        info: "OK",
        route: {
          transits: [
            {
              distance: "42000",
              duration: "5400",
              segments: [
                {
                  walking: {
                    steps: [
                      { polyline: "108.943900,34.257200;108.944900,34.258200" },
                    ],
                  },
                  bus: {
                    buslines: [
                      { polyline: "108.944900,34.258200;108.951000,34.265000" },
                    ],
                  },
                },
              ],
            },
          ],
        },
      });
    }

    throw new Error(`Unexpected Amap proxy path: ${body.path}`);
  }) as typeof fetch;

  try {
    return await run(requests);
  } finally {
    globalThis.fetch = originalFetch;
    setAuthStorageAdapter(createAuthStorageAdapter(new Map()));
    restoreEnv("EXPO_PUBLIC_SUPABASE_URL", originalSupabaseUrl);
    restoreEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", originalSupabaseAnonKey);
    restoreEnv("EXPO_PUBLIC_AMAP_WEB_SERVICE_KEY", originalAmapKey);
  }
}

type RequestInitRecord = {
  body?: string;
  headers?: HeadersInit;
  method?: string;
  url: string;
};

function createJsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  } as Response;
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

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

test("Amap JSON requests go through the Supabase proxy without exposing the Web Service key", async () => {
  await withMockSupabaseAmapProxy(async (requests) => {
    const suggestions = await searchAmapPlaceSuggestions("钟楼", "景点");
    const route = await queryAmapRoute(
      "walking",
      { latitude: 34.2572, longitude: 108.9439 },
      { latitude: 34.265, longitude: 108.951 },
    );

    assert.equal(suggestions[0]?.name, "钟楼");
    assert.equal(suggestions[0]?.rating, 4.8);
    assert.equal(suggestions[0]?.costPerPerson, "¥50");
    assert.equal(suggestions[0]?.phone, "029-12345678");
    assert.equal(suggestions[0]?.openingHoursToday, "08:00-18:00");
    assert.equal(suggestions[0]?.tags, "古建筑,历史遗迹");
    assert.equal(suggestions[0]?.businessArea, "钟楼商圈");
    assert.equal(suggestions[0]?.photos?.length, 1);
    assert.equal(
      suggestions[0]?.photos?.[0]?.url,
      "https://example.com/zhonglou.jpg",
    );
    assert.equal(route?.distanceKm, 1.2);
    assert.equal(requests.length, 2);
    assert.equal(
      requests.some((request) => request.url.includes("restapi.amap.com")),
      false,
    );
    assert.equal(
      requests.some((request) => request.body?.includes("test-key")),
      false,
    );
  });
});

test("Amap transit route requests include city params and parse transit plans", async () => {
  await withMockSupabaseAmapProxy(async (requests) => {
    const route = await queryAmapRoute(
      "transit",
      { latitude: 34.2572, longitude: 108.9439 },
      { latitude: 34.265, longitude: 108.951 },
      {
        originCity: "西安市",
        destinationCity: "咸阳市",
      },
    );
    const requestBody = JSON.parse(requests[0]?.body ?? "{}") as {
      params?: Record<string, string>;
      path?: string;
    };

    assert.equal(route?.distanceKm, 42);
    assert.equal(route?.durationMinutes, 90);
    assert.deepEqual(route?.polyline, [
      { latitude: 34.2572, longitude: 108.9439 },
      { latitude: 34.2582, longitude: 108.9449 },
      { latitude: 34.265, longitude: 108.951 },
    ]);
    assert.equal(requestBody.path, "/v3/direction/transit/integrated");
    assert.equal(requestBody.params?.city, "西安市");
    assert.equal(requestBody.params?.cityd, "咸阳市");
  });
});

test("Amap transit route falls back to segment totals when top-level metrics are absent", async () => {
  await withMockSupabaseAmapProxy(async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        path?: string;
      };

      assert.equal(body.path, "/v3/direction/transit/integrated");

      return createJsonResponse({
        status: "1",
        info: "OK",
        route: {
          transits: [
            {
              segments: [
                {
                  walking: {
                    distance: "600",
                    duration: "420",
                  },
                  bus: {
                    buslines: [
                      {
                        distance: "8400",
                        duration: "1800",
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      });
    }) as typeof fetch;

    try {
      const route = await queryAmapRoute(
        "transit",
        { latitude: 34.2572, longitude: 108.9439 },
        { latitude: 34.265, longitude: 108.951 },
        {
          originCity: "西安市",
        },
      );

      assert.equal(route?.distanceKm, 9);
      assert.equal(route?.durationMinutes, 37);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("Amap static map URLs are not generated because the protected proxy requires an auth header", () => {
  const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const originalAmapKey = process.env.EXPO_PUBLIC_AMAP_WEB_SERVICE_KEY;

  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://travel-test.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  delete process.env.EXPO_PUBLIC_AMAP_WEB_SERVICE_KEY;

  try {
    const url = buildAmapPlaceStaticMapUrl({
      latitude: 34.2572,
      longitude: 108.9439,
    });

    assert.equal(url, undefined);
  } finally {
    restoreEnv("EXPO_PUBLIC_SUPABASE_URL", originalSupabaseUrl);
    restoreEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", originalSupabaseAnonKey);
    restoreEnv("EXPO_PUBLIC_AMAP_WEB_SERVICE_KEY", originalAmapKey);
  }
});

test("Amap JSON requests omit Authorization before sign-in for public proxy deployments", async () => {
  const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const originalFetch = globalThis.fetch;

  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://travel-test.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  setAuthStorageAdapter(createAuthStorageAdapter(new Map()));
  globalThis.fetch = (async (_url, init) => {
    const headers = init?.headers as Record<string, string> | undefined;

    assert.equal(headers?.apikey, "test-anon-key");
    assert.equal(headers?.Authorization, undefined);

    return createJsonResponse({
      status: "1",
      info: "OK",
      pois: [
        {
          id: "poi-1",
          name: "钟楼",
          location: "108.943900,34.257200",
          type: "风景名胜;风景名胜相关;旅游景点",
          typecode: "110000",
          pname: "陕西省",
          cityname: "西安市",
          adname: "碑林区",
          address: "测试地址",
          business: {
            rating: "4.8",
            cost: "¥50",
            tel: "029-12345678",
            opentime_today: "08:00-18:00",
          },
          photos: [],
        },
      ],
    });
  }) as typeof fetch;

  try {
    const suggestions = await searchAmapPlaceSuggestions("钟楼", "景点");

    assert.equal(suggestions[0]?.name, "钟楼");
  } finally {
    globalThis.fetch = originalFetch;
    setAuthStorageAdapter(createAuthStorageAdapter(new Map()));
    restoreEnv("EXPO_PUBLIC_SUPABASE_URL", originalSupabaseUrl);
    restoreEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", originalSupabaseAnonKey);
  }
});
