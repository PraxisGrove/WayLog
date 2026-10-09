import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_STORAGE_KEY,
  setAuthStorageAdapter,
} from "../../../features/auth/storage";
import type { Trip } from "../../../features/trips/types";
import { getTripWeather } from "../../../features/weather";

function createTrip(input: {
  adcode?: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  startDate?: string;
}): Trip {
  const placeId = input.placeId ?? "place-1";

  return {
    id: `trip-${placeId}`,
    title: "Weather test trip",
    destination: "Weather test destination",
    currency: "CNY",
    startDate: input.startDate ?? "2026-05-30",
    status: "planning" as unknown as Trip["status"],
    days: [
      {
        id: `day-${placeId}`,
        dayIndex: 1,
        title: "Day 1",
        items: [
          {
            id: `item-${placeId}`,
            title: "Test place",
            placeId,
            placeName: "Test place",
          },
        ],
      },
    ],
    places: [
      {
        id: placeId,
        name: "Test place",
        category: "place" as unknown as Trip["places"][number]["category"],
        isScheduled: true,
        latitude: input.latitude,
        longitude: input.longitude,
        externalRefs: input.adcode ? { amapAdcode: input.adcode } : undefined,
      },
    ],
    transports: [],
    lodgings: [],
    memos: [],
    checklistItems: [],
    expenses: [],
    importSources: [],
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  };
}

async function withMockFetch<T>(
  run: (calledUrls: string[]) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const authStorage = new Map<string, string>();
  const calledUrls: string[] = [];

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
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      params?: Record<string, string>;
      path?: string;
    };
    const params = body.params ?? {};
    const searchParams = new URLSearchParams(params);
    const decodedUrl = `${body.path ?? urlText}?${decodeURIComponent(searchParams.toString())}`;

    calledUrls.push(decodedUrl);

    if (urlText.includes("api.open-meteo.com")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          daily: {
            time: ["2026-05-30"],
            weather_code: [3],
            temperature_2m_max: [26],
            temperature_2m_min: [18],
            precipitation_probability_max: [10],
            uv_index_max: [6],
            wind_speed_10m_max: [15],
          },
        }),
      } as Response;
    }

    if (body.path === "/v3/geocode/regeo") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: "1",
          info: "OK",
          regeocode: {
            addressComponent: {
              adcode: "610100",
              city: "Xi An",
              district: "Beilin",
              province: "Shaanxi",
            },
          },
        }),
      } as Response;
    }

    if (body.path === "/v3/weather/weatherInfo") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: "1",
          info: "OK",
          forecasts: [
            {
              adcode: params.city === "310000" ? "310000" : "610100",
              city: "Test City",
              province: "Test Province",
              reporttime: "2026-05-30 08:00:00",
              casts: [
                {
                  date: "2026-05-30",
                  dayweather: "小雨",
                  nightweather: "多云",
                  daytemp: "26",
                  nighttemp: "18",
                  daywind: "东北",
                  nightwind: "东北",
                  daypower: "3",
                  nightpower: "≤3",
                  week: "6",
                },
              ],
            },
          ],
        }),
      } as Response;
    }

    throw new Error(`Unexpected fetch URL: ${urlText}`);
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

test("domestic weather uses Open-Meteo as primary source (Amap disabled)", async () => {
  await withMockFetch(async (calledUrls) => {
    const weather = await getTripWeather(
      createTrip({
        latitude: 34.261,
        longitude: 108.942,
      }),
    );

    assert.equal(weather.days[0]?.source.type, "open-meteo");
    assert.ok(calledUrls.some((url) => url.includes("api.open-meteo.com")));
    assert.equal(
      calledUrls.some((url) => url.includes("/v3/weather/weatherInfo")),
      false,
    );
  });
});

test("domestic weather uses Open-Meteo even with saved adcode", async () => {
  await withMockFetch(async (calledUrls) => {
    const weather = await getTripWeather(
      createTrip({
        adcode: "310000",
        latitude: 31.2304,
        longitude: 121.4737,
        placeId: "place-with-adcode",
      }),
    );

    assert.equal(weather.days[0]?.source.type, "open-meteo");
    assert.ok(calledUrls.some((url) => url.includes("api.open-meteo.com")));
    assert.equal(
      calledUrls.some((url) => url.includes("/v3/weather/weatherInfo")),
      false,
    );
  });
});
