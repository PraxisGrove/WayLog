import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_STORAGE_KEY,
  setAuthStorageAdapter,
} from "../../../features/auth/storage";
import type { RouteCacheStorageAdapter } from "../../../features/trips/route-segments";
import {
  buildTripDayRouteSegments,
  createTripRouteSegmentFetchPlan,
  getAutoTripRouteModeForDistance,
  getRouteSegmentWithCache,
  resetTripRouteSegmentCacheForTests,
  setRouteCacheStorageAdapterForTests,
} from "../../../features/trips/route-segments";
import type { Trip } from "../../../features/trips/types";

const ROUTE_CACHE_STORAGE_KEY = "waylog.trip_route_segments.v14";
const LEGACY_ROUTE_CACHE_STORAGE_KEY = "waylog.trip_route_segments.v7";

function getFirstRouteSegment(
  trip: Trip,
): ReturnType<typeof buildTripDayRouteSegments>[number] {
  const firstDay = trip.days[0];
  assert.ok(firstDay);
  const firstSegment = buildTripDayRouteSegments(trip, firstDay)[0];
  assert.ok(firstSegment);
  return firstSegment;
}

function createReadyRouteResult(
  segment: ReturnType<typeof buildTripDayRouteSegments>[number],
) {
  return {
    cached: true,
    entry: {
      fromCoordinates: segment.snapshot.fromCoordinates,
      fromLabel: segment.snapshot.fromLabel,
      fromQuery: segment.snapshot.fromQuery,
      fromSignature: segment.snapshot.fromSignature,
      modeOptions: [
        {
          distanceKm: 1,
          durationMinutes: 10,
          label: "步行",
          mode: "walking" as const,
          source: "amap" as const,
        },
      ],
      provider: "amap" as const,
      status: "ready" as const,
      toCoordinates: segment.snapshot.toCoordinates,
      toLabel: segment.snapshot.toLabel,
      toQuery: segment.snapshot.toQuery,
      toSignature: segment.snapshot.toSignature,
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
  };
}

function getSegmentFetchKey(
  segment: ReturnType<typeof buildTripDayRouteSegments>[number],
  selectedMode?: "cycling" | "driving" | "transit" | "walking",
): string {
  return `${segment.id}:${segment.snapshot.cacheKey}:${selectedMode ?? "auto"}`;
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

function createRouteCacheStorageAdapter(
  storage: Map<string, string>,
): RouteCacheStorageAdapter {
  return {
    getItem: async (key: string) => storage.get(key) ?? null,
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

async function withMockRouteFetch<T>(
  run: (
    requests: { params: Record<string, string>; path: string }[],
  ) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const authStorage = new Map<string, string>();
  const routeCacheStorage = new Map<string, string>();
  const routeRequests: { params: Record<string, string>; path: string }[] = [];

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
      users: [],
    }),
  );
  setAuthStorageAdapter(createAuthStorageAdapter(authStorage));
  resetTripRouteSegmentCacheForTests();
  setRouteCacheStorageAdapterForTests(
    createRouteCacheStorageAdapter(routeCacheStorage),
  );

  globalThis.fetch = (async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      params?: Record<string, string>;
      path?: string;
    };
    const params = body.params ?? {};
    const path = body.path ?? "";

    routeRequests.push({ path, params });

    if (path === "/v3/direction/driving") {
      return createJsonResponse({
        status: "1",
        info: "OK",
        route: {
          paths: [{ distance: "3000", duration: "600" }],
        },
      });
    }

    if (path === "/v4/direction/bicycling") {
      return createJsonResponse({
        errcode: 0,
        errmsg: "OK",
        data: {
          paths: [{ distance: 2800, duration: 700 }],
        },
      });
    }

    if (path === "/v3/direction/walking") {
      return createJsonResponse({
        status: "1",
        info: "OK",
        route: {
          paths: [{ distance: "2600", duration: "1800" }],
        },
      });
    }

    if (path === "/v3/direction/transit/integrated") {
      return createJsonResponse({
        status: "1",
        info: "OK",
        route: {
          transits: [],
        },
      });
    }

    throw new Error(`Unexpected route path: ${path}`);
  }) as typeof fetch;

  try {
    return await run(routeRequests);
  } finally {
    globalThis.fetch = originalFetch;
    setAuthStorageAdapter(createAuthStorageAdapter(new Map()));
    setRouteCacheStorageAdapterForTests(null);
    resetTripRouteSegmentCacheForTests();
    restoreEnv("EXPO_PUBLIC_SUPABASE_URL", originalSupabaseUrl);
    restoreEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", originalSupabaseAnonKey);
  }
}

async function withMockRouteFetchAndStorage<T>(
  routeCacheStorage: Map<string, string>,
  run: (
    requests: { params: Record<string, string>; path: string }[],
  ) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const authStorage = new Map<string, string>();
  const routeRequests: { params: Record<string, string>; path: string }[] = [];

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
      users: [],
    }),
  );
  setAuthStorageAdapter(createAuthStorageAdapter(authStorage));
  resetTripRouteSegmentCacheForTests();
  setRouteCacheStorageAdapterForTests(
    createRouteCacheStorageAdapter(routeCacheStorage),
  );

  globalThis.fetch = (async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      params?: Record<string, string>;
      path?: string;
    };
    const params = body.params ?? {};
    const path = body.path ?? "";

    routeRequests.push({ path, params });

    if (path === "/v3/direction/driving") {
      return createJsonResponse({
        status: "1",
        info: "OK",
        route: {
          paths: [{ distance: "3000", duration: "600" }],
        },
      });
    }

    if (path === "/v4/direction/bicycling") {
      return createJsonResponse({
        errcode: 0,
        errmsg: "OK",
        data: {
          paths: [{ distance: 2800, duration: 700 }],
        },
      });
    }

    if (path === "/v3/direction/walking") {
      return createJsonResponse({
        status: "1",
        info: "OK",
        route: {
          paths: [{ distance: "2600", duration: "1800" }],
        },
      });
    }

    if (path === "/v3/direction/transit/integrated") {
      return createJsonResponse({
        status: "1",
        info: "OK",
        route: {
          transits: [],
        },
      });
    }

    throw new Error(`Unexpected route path: ${path}`);
  }) as typeof fetch;

  try {
    return await run(routeRequests);
  } finally {
    globalThis.fetch = originalFetch;
    setAuthStorageAdapter(createAuthStorageAdapter(new Map()));
    setRouteCacheStorageAdapterForTests(null);
    resetTripRouteSegmentCacheForTests();
    restoreEnv("EXPO_PUBLIC_SUPABASE_URL", originalSupabaseUrl);
    restoreEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", originalSupabaseAnonKey);
  }
}

async function withMockTransitRouteFetch<T>(
  run: (
    requests: { params: Record<string, string>; path: string }[],
  ) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const authStorage = new Map<string, string>();
  const routeCacheStorage = new Map<string, string>();
  const routeRequests: { params: Record<string, string>; path: string }[] = [];

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
      users: [],
    }),
  );
  setAuthStorageAdapter(createAuthStorageAdapter(authStorage));
  resetTripRouteSegmentCacheForTests();
  setRouteCacheStorageAdapterForTests(
    createRouteCacheStorageAdapter(routeCacheStorage),
  );

  globalThis.fetch = (async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      params?: Record<string, string>;
      path?: string;
    };
    const params = body.params ?? {};
    const path = body.path ?? "";

    routeRequests.push({ path, params });

    if (path === "/v3/direction/driving") {
      return createJsonResponse({
        status: "1",
        info: "OK",
        route: {
          paths: [{ distance: "3000", duration: "600" }],
        },
      });
    }

    if (path === "/v4/direction/bicycling") {
      return createJsonResponse({
        errcode: 0,
        errmsg: "OK",
        data: {
          paths: [{ distance: 2800, duration: 700 }],
        },
      });
    }

    if (path === "/v3/direction/walking") {
      return createJsonResponse({
        status: "1",
        info: "OK",
        route: {
          paths: [{ distance: "2600", duration: "1800" }],
        },
      });
    }

    if (path === "/v3/direction/transit/integrated") {
      return createJsonResponse({
        status: "1",
        info: "OK",
        route: {
          transits: [{ distance: "3500", duration: "1500" }],
        },
      });
    }

    throw new Error(`Unexpected route path: ${path}`);
  }) as typeof fetch;

  try {
    return await run(routeRequests);
  } finally {
    globalThis.fetch = originalFetch;
    setAuthStorageAdapter(createAuthStorageAdapter(new Map()));
    setRouteCacheStorageAdapterForTests(null);
    resetTripRouteSegmentCacheForTests();
    restoreEnv("EXPO_PUBLIC_SUPABASE_URL", originalSupabaseUrl);
    restoreEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", originalSupabaseAnonKey);
  }
}

function createJsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  } as Response;
}

function createTrip(): Trip {
  const now = "2026-06-01T00:00:00.000Z";

  return {
    id: "trip-1",
    title: "Route test",
    destination: "Xian",
    currency: "CNY",
    status: "计划中",
    days: [
      {
        id: "day-1",
        dayIndex: 1,
        title: "Day 1",
        items: [
          {
            id: "item-1",
            title: "From",
            placeId: "place-1",
            placeName: "From",
          },
          {
            id: "item-2",
            title: "To",
            placeId: "place-2",
            placeName: "To",
          },
        ],
      },
    ],
    places: [
      {
        id: "place-1",
        name: "From",
        category: "景点",
        isScheduled: true,
        latitude: 34.2572,
        longitude: 108.9439,
      },
      {
        id: "place-2",
        name: "To",
        category: "景点",
        isScheduled: true,
        latitude: 34.265,
        longitude: 108.951,
      },
    ],
    transports: [],
    lodgings: [],
    memos: [],
    checklistItems: [],
    expenses: [],
    importSources: [],
    createdAt: now,
    updatedAt: now,
  };
}

test("auto route mode selection follows distance thresholds", () => {
  assert.equal(getAutoTripRouteModeForDistance(1.2), "walking");
  assert.equal(getAutoTripRouteModeForDistance(5), "cycling");
  assert.equal(getAutoTripRouteModeForDistance(30), "driving");
  assert.equal(getAutoTripRouteModeForDistance(120), "transit");
});

test("route segment fetch plan only fetches the new tail segment when a place is appended", () => {
  const trip = createTrip();
  const day = trip.days[0];
  assert.ok(day);
  const initialSegments = buildTripDayRouteSegments(trip, day);
  const stableSegment = initialSegments[0];
  assert.ok(stableSegment);
  const stableResult = createReadyRouteResult(stableSegment);

  const appendedTrip: Trip = {
    ...trip,
    days: [
      {
        ...day,
        items: [
          ...day.items,
          {
            id: "item-3",
            placeId: "place-3",
            placeName: "Tail",
            title: "Tail",
          },
        ],
      },
    ],
    places: [
      ...trip.places,
      {
        category: "景点",
        id: "place-3",
        isScheduled: true,
        latitude: 34.27,
        longitude: 108.96,
        name: "Tail",
      },
    ],
  };
  const appendedDay = appendedTrip.days[0];
  assert.ok(appendedDay);
  const nextSegments = buildTripDayRouteSegments(appendedTrip, appendedDay);

  const plan = createTripRouteSegmentFetchPlan({
    currentResults: {
      [stableSegment.id]: stableResult,
    },
    previousFetchSnapshots: {
      [stableSegment.id]: getSegmentFetchKey(stableSegment),
    },
    routeSegmentModes: {},
    segments: nextSegments,
  });

  assert.deepEqual(Object.keys(plan.retainedResults), [stableSegment.id]);
  assert.deepEqual(plan.removedSegmentIds, []);
  assert.deepEqual(
    plan.segmentsToFetch.map((item) => item.segment.id),
    ["item-2->item-3"],
  );
});

test("route segment fetch plan replaces only affected adjacent segments when a place is inserted", () => {
  const baseTrip = createTrip();
  const baseDay = baseTrip.days[0];
  assert.ok(baseDay);
  const tripWithThreePlaces: Trip = {
    ...baseTrip,
    days: [
      {
        ...baseDay,
        items: [
          ...baseDay.items,
          {
            id: "item-3",
            placeId: "place-3",
            placeName: "End",
            title: "End",
          },
        ],
      },
    ],
    places: [
      ...baseTrip.places,
      {
        category: "景点",
        id: "place-3",
        isScheduled: true,
        latitude: 34.27,
        longitude: 108.96,
        name: "End",
      },
    ],
  };
  const dayWithThreePlaces = tripWithThreePlaces.days[0];
  assert.ok(dayWithThreePlaces);
  const previousSegments = buildTripDayRouteSegments(
    tripWithThreePlaces,
    dayWithThreePlaces,
  );
  const retainedSegment = previousSegments[1];
  assert.ok(retainedSegment);
  const replacedSegment = previousSegments[0];
  assert.ok(replacedSegment);
  const retainedResult = createReadyRouteResult(retainedSegment);

  const insertedDay = {
    ...dayWithThreePlaces,
    items: [
      dayWithThreePlaces.items[0],
      {
        id: "item-x",
        placeId: "place-x",
        placeName: "Inserted",
        title: "Inserted",
      },
      dayWithThreePlaces.items[1],
      dayWithThreePlaces.items[2],
    ].filter((item): item is (typeof dayWithThreePlaces.items)[number] =>
      Boolean(item),
    ),
  };
  const insertedTrip: Trip = {
    ...tripWithThreePlaces,
    days: [insertedDay],
    places: [
      ...tripWithThreePlaces.places,
      {
        category: "景点",
        id: "place-x",
        isScheduled: true,
        latitude: 34.262,
        longitude: 108.947,
        name: "Inserted",
      },
    ],
  };
  const nextSegments = buildTripDayRouteSegments(insertedTrip, insertedDay);

  const plan = createTripRouteSegmentFetchPlan({
    currentResults: {
      [replacedSegment.id]: createReadyRouteResult(replacedSegment),
      [retainedSegment.id]: retainedResult,
    },
    previousFetchSnapshots: {
      [replacedSegment.id]: getSegmentFetchKey(replacedSegment),
      [retainedSegment.id]: getSegmentFetchKey(retainedSegment),
    },
    routeSegmentModes: {},
    segments: nextSegments,
  });

  assert.deepEqual(Object.keys(plan.retainedResults), [retainedSegment.id]);
  assert.deepEqual(plan.removedSegmentIds, [replacedSegment.id]);
  assert.deepEqual(
    plan.segmentsToFetch.map((item) => item.segment.id),
    ["item-1->item-x", "item-x->item-2"],
  );
});

test("route segment fetch plan refetches a retained segment when its selected mode changes", () => {
  const trip = createTrip();
  const segment = getFirstRouteSegment(trip);

  const plan = createTripRouteSegmentFetchPlan({
    currentResults: {
      [segment.id]: createReadyRouteResult(segment),
    },
    previousFetchSnapshots: {
      [segment.id]: getSegmentFetchKey(segment),
    },
    routeSegmentModes: {
      [segment.id]: "driving",
    },
    segments: [segment],
  });

  assert.deepEqual(Object.keys(plan.retainedResults), []);
  assert.deepEqual(
    plan.segmentsToFetch.map((item) => ({
      mode: item.selectedMode,
      segmentId: item.segment.id,
    })),
    [{ mode: "driving", segmentId: segment.id }],
  );
});

test("route segment cache only requests the auto-selected mode by default", async () => {
  await withMockRouteFetch(async (requests) => {
    const trip = createTrip();
    const segment = getFirstRouteSegment(trip);
    const result = await getRouteSegmentWithCache(segment);

    assert.equal(
      result.entry.modeOptions.some((option) => option.mode === "walking"),
      true,
    );
    assert.deepEqual(
      result.entry.modeOptions.map((option) => option.mode),
      ["walking"],
    );
    assert.deepEqual(
      requests.map((request) => request.path),
      ["/v3/direction/walking"],
    );
    assert.equal(result.entry.modeFetchState?.walking?.status, "ready");
  });
});

test("route segment cache fetches and stores a user-selected mode on demand", async () => {
  await withMockRouteFetch(async (requests) => {
    const trip = createTrip();
    const segment = getFirstRouteSegment(trip);
    const autoResult = await getRouteSegmentWithCache(segment);
    const drivingResult = await getRouteSegmentWithCache(segment, {
      mode: "driving",
      reason: "user",
    });

    assert.equal(
      autoResult.entry.modeOptions.some((option) => option.mode === "walking"),
      true,
    );
    assert.equal(
      drivingResult.entry.modeOptions.some(
        (option) => option.mode === "walking",
      ),
      true,
    );
    assert.equal(
      drivingResult.entry.modeOptions.some(
        (option) => option.mode === "driving",
      ),
      true,
    );
    assert.deepEqual(
      requests.map((request) => request.path),
      ["/v3/direction/walking", "/v3/direction/driving"],
    );
    assert.equal(drivingResult.entry.modeFetchState?.driving?.reason, "user");
  });
});

test("route segment cache keeps Amap failure details when the selected mode falls back to estimates", async () => {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const authStorage = new Map<string, string>();
  const routeCacheStorage = new Map<string, string>();

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
      users: [],
    }),
  );
  setAuthStorageAdapter(createAuthStorageAdapter(authStorage));
  resetTripRouteSegmentCacheForTests();
  setRouteCacheStorageAdapterForTests(
    createRouteCacheStorageAdapter(routeCacheStorage),
  );

  globalThis.fetch = (async () =>
    createJsonResponse({
      status: "0",
      info: "DAILY_QUERY_OVER_LIMIT",
      infocode: "10003",
    })) as typeof fetch;

  try {
    const trip = createTrip();
    const segment = getFirstRouteSegment(trip);
    const result = await getRouteSegmentWithCache(segment);

    assert.equal(
      result.entry.modeOptions.every((option) => option.source === "estimated"),
      true,
    );
    assert.deepEqual(
      result.entry.modeOptions.map((option) => option.mode),
      ["walking"],
    );
    assert.match(
      result.entry.errorMessage ?? "",
      /当前步行高德暂未返回道路路线，已按直线距离估算/,
    );
    assert.match(result.entry.errorMessage ?? "", /高德路线查询失败/);
    assert.match(result.entry.errorMessage ?? "", /10003/);
  } finally {
    globalThis.fetch = originalFetch;
    setAuthStorageAdapter(createAuthStorageAdapter(new Map()));
    setRouteCacheStorageAdapterForTests(null);
    resetTripRouteSegmentCacheForTests();
    restoreEnv("EXPO_PUBLIC_SUPABASE_URL", originalSupabaseUrl);
    restoreEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", originalSupabaseAnonKey);
  }
});

test("route segment cache may return ready entries without drawable geometry for specific modes", async () => {
  await withMockRouteFetch(async () => {
    const trip = createTrip();
    const segment = getFirstRouteSegment(trip);
    const result = await getRouteSegmentWithCache(segment);

    const walkingOption = result.entry.modeOptions.find(
      (option) => option.mode === "walking",
    );

    assert.equal(walkingOption?.source, "amap");
    assert.equal(Array.isArray(walkingOption?.polyline), false);
  });
});

test("route segment cache reuses fresh selected-mode entries even without drawable geometry", async () => {
  const routeCacheStorage = new Map<string, string>();
  const trip = createTrip();
  const segment = getFirstRouteSegment(trip);

  routeCacheStorage.set(
    ROUTE_CACHE_STORAGE_KEY,
    JSON.stringify({
      version: 14,
      entries: {
        [segment.snapshot.cacheKey]: {
          status: "ready",
          provider: "amap",
          fromSignature: segment.snapshot.fromSignature,
          toSignature: segment.snapshot.toSignature,
          fromLabel: segment.snapshot.fromLabel,
          toLabel: segment.snapshot.toLabel,
          fromQuery: segment.snapshot.fromQuery,
          toQuery: segment.snapshot.toQuery,
          fromCoordinates: segment.snapshot.fromCoordinates,
          toCoordinates: segment.snapshot.toCoordinates,
          modeOptions: [
            {
              mode: "walking",
              label: "步行",
              distanceKm: 1.2,
              durationMinutes: 16,
              source: "amap",
            },
          ],
          modeFetchState: {
            walking: {
              mode: "walking",
              reason: "auto",
              status: "ready",
              updatedAt: new Date().toISOString(),
            },
          },
          updatedAt: new Date().toISOString(),
        },
      },
      geocodes: {},
    }),
  );

  await withMockRouteFetchAndStorage(routeCacheStorage, async (requests) => {
    const result = await getRouteSegmentWithCache(segment);

    assert.equal(result.cached, true);
    assert.equal(requests.length, 0);
  });
});

test("route segment cache keys use the current route response version", () => {
  const trip = createTrip();
  const segment = getFirstRouteSegment(trip);

  assert.equal(segment.snapshot.cacheKey.startsWith("amap-v14-"), true);
});

test("route segment cache reuses ready distance and duration results for the selected mode", async () => {
  await withMockRouteFetch(async (requests) => {
    const trip = createTrip();
    const segment = getFirstRouteSegment(trip);
    const firstResult = await getRouteSegmentWithCache(segment);
    const requestCountAfterFirstLoad = requests.length;
    const secondResult = await getRouteSegmentWithCache(segment);

    assert.equal(firstResult.cached, false);
    assert.equal(secondResult.cached, true);
    assert.equal(requests.length, requestCountAfterFirstLoad);
    assert.equal(
      secondResult.entry.modeOptions.some((option) =>
        Array.isArray(option.polyline),
      ),
      false,
    );
  });
});

test("route segment cache force refresh bypasses fresh estimated-only cache", async () => {
  const routeCacheStorage = new Map<string, string>();
  const trip = createTrip();
  const segment = getFirstRouteSegment(trip);

  routeCacheStorage.set(
    ROUTE_CACHE_STORAGE_KEY,
    JSON.stringify({
      version: 14,
      entries: {
        [segment.snapshot.cacheKey]: {
          status: "ready",
          provider: "amap",
          fromSignature: segment.snapshot.fromSignature,
          toSignature: segment.snapshot.toSignature,
          fromLabel: segment.snapshot.fromLabel,
          toLabel: segment.snapshot.toLabel,
          fromQuery: segment.snapshot.fromQuery,
          toQuery: segment.snapshot.toQuery,
          fromCoordinates: segment.snapshot.fromCoordinates,
          toCoordinates: segment.snapshot.toCoordinates,
          modeOptions: [
            {
              mode: "walking",
              label: "步行",
              distanceKm: 1.2,
              durationMinutes: 16,
              source: "estimated",
            },
          ],
          modeFetchState: {
            walking: {
              mode: "walking",
              reason: "auto",
              status: "unavailable",
              errorMessage: "高德路线查询失败",
              updatedAt: new Date().toISOString(),
            },
          },
          errorMessage: "高德暂未返回道路路线，已按直线距离估算",
          updatedAt: new Date().toISOString(),
        },
      },
      geocodes: {},
    }),
  );

  await withMockRouteFetchAndStorage(routeCacheStorage, async (requests) => {
    const result = await getRouteSegmentWithCache(segment, {
      forceRefresh: true,
    });

    assert.equal(result.cached, false);
    assert.ok(requests.length > 0);
    assert.equal(
      result.entry.modeOptions.some((option) => option.source === "amap"),
      true,
    );
  });
});

test("route segment cache reuses fresh estimated-only results briefly", async () => {
  const routeCacheStorage = new Map<string, string>();
  const trip = createTrip();
  const segment = getFirstRouteSegment(trip);

  routeCacheStorage.set(
    ROUTE_CACHE_STORAGE_KEY,
    JSON.stringify({
      version: 14,
      entries: {
        [segment.snapshot.cacheKey]: {
          status: "ready",
          provider: "amap",
          fromSignature: segment.snapshot.fromSignature,
          toSignature: segment.snapshot.toSignature,
          fromLabel: segment.snapshot.fromLabel,
          toLabel: segment.snapshot.toLabel,
          fromQuery: segment.snapshot.fromQuery,
          toQuery: segment.snapshot.toQuery,
          fromCoordinates: segment.snapshot.fromCoordinates,
          toCoordinates: segment.snapshot.toCoordinates,
          modeOptions: [
            {
              mode: "walking",
              label: "步行",
              distanceKm: 1.2,
              durationMinutes: 16,
              source: "estimated",
            },
          ],
          modeFetchState: {
            walking: {
              mode: "walking",
              reason: "auto",
              status: "unavailable",
              errorMessage: "高德路线查询失败",
              updatedAt: new Date().toISOString(),
            },
          },
          errorMessage: "高德暂未返回道路路线，已按直线距离估算",
          updatedAt: new Date().toISOString(),
        },
      },
      geocodes: {},
    }),
  );

  await withMockRouteFetchAndStorage(routeCacheStorage, async (requests) => {
    const result = await getRouteSegmentWithCache(segment);

    assert.equal(result.cached, true);
    assert.equal(requests.length, 0);
    assert.equal(result.entry.modeOptions[0]?.source, "estimated");
  });
});

test("route segment cache refreshes stale estimated-only results instead of keeping straight-line previews forever", async () => {
  const routeCacheStorage = new Map<string, string>();
  const trip = createTrip();
  const segment = getFirstRouteSegment(trip);

  routeCacheStorage.set(
    ROUTE_CACHE_STORAGE_KEY,
    JSON.stringify({
      version: 14,
      entries: {
        [segment.snapshot.cacheKey]: {
          status: "ready",
          provider: "amap",
          fromSignature: segment.snapshot.fromSignature,
          toSignature: segment.snapshot.toSignature,
          fromLabel: segment.snapshot.fromLabel,
          toLabel: segment.snapshot.toLabel,
          fromQuery: segment.snapshot.fromQuery,
          toQuery: segment.snapshot.toQuery,
          fromCoordinates: segment.snapshot.fromCoordinates,
          toCoordinates: segment.snapshot.toCoordinates,
          modeOptions: [
            {
              mode: "walking",
              label: "步行",
              distanceKm: 1.2,
              durationMinutes: 16,
              source: "estimated",
            },
          ],
          modeFetchState: {
            walking: {
              mode: "walking",
              reason: "auto",
              status: "unavailable",
              errorMessage: "高德路线查询失败",
              updatedAt: new Date(
                Date.now() - 25 * 60 * 60 * 1000,
              ).toISOString(),
            },
          },
          errorMessage: "高德暂未返回道路路线，已按直线距离估算",
          updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        },
      },
      geocodes: {},
    }),
  );

  await withMockRouteFetchAndStorage(routeCacheStorage, async (requests) => {
    const result = await getRouteSegmentWithCache(segment);

    assert.equal(result.cached, false);
    assert.ok(requests.length > 0);
    assert.equal(
      result.entry.modeOptions.some((option) => option.source === "amap"),
      true,
    );
  });
});

test("route segment cache does not reuse legacy route entries from an older response version", async () => {
  const routeCacheStorage = new Map<string, string>();
  const trip = createTrip();
  const segment = getFirstRouteSegment(trip);

  routeCacheStorage.set(
    LEGACY_ROUTE_CACHE_STORAGE_KEY,
    JSON.stringify({
      version: 7,
      entries: {
        [segment.snapshot.cacheKey]: {
          status: "ready",
          provider: "amap",
          fromSignature: segment.snapshot.fromSignature,
          toSignature: segment.snapshot.toSignature,
          fromLabel: segment.snapshot.fromLabel,
          toLabel: segment.snapshot.toLabel,
          fromQuery: segment.snapshot.fromQuery,
          toQuery: segment.snapshot.toQuery,
          fromCoordinates: segment.snapshot.fromCoordinates,
          toCoordinates: segment.snapshot.toCoordinates,
          modeOptions: [
            {
              mode: "driving",
              label: "驾车",
              distanceKm: 3,
              durationMinutes: 10,
            },
          ],
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
      },
    }),
  );

  await withMockRouteFetchAndStorage(routeCacheStorage, async (requests) => {
    const result = await getRouteSegmentWithCache(segment);

    assert.equal(result.cached, false);
    assert.ok(requests.length > 0);
  });
});

test("route segment cache persists refreshed route entries to the current cache store", async () => {
  const routeCacheStorage = new Map<string, string>();

  await withMockRouteFetchAndStorage(routeCacheStorage, async () => {
    const trip = createTrip();
    const segment = getFirstRouteSegment(trip);
    await getRouteSegmentWithCache(segment);

    const rawCache = routeCacheStorage.get(ROUTE_CACHE_STORAGE_KEY);
    assert.ok(rawCache);

    const cache = JSON.parse(rawCache ?? "{}") as {
      entries?: Record<string, unknown>;
      geocodes?: Record<string, unknown>;
      version?: number;
    };

    assert.equal(cache.version, 14);
    assert.ok(cache.entries?.[segment.snapshot.cacheKey]);
    assert.ok(cache.geocodes);
  });
});

test("route segment transit requests use the place city when available", async () => {
  await withMockTransitRouteFetch(async (requests) => {
    const trip = createTrip();

    trip.places = trip.places.map((place) => ({
      ...place,
      area: "陕西省 · 西安市 · 碑林区",
      externalRefs: {
        amapCityName: "西安市",
      },
    }));

    const segment = getFirstRouteSegment(trip);
    const result = await getRouteSegmentWithCache(segment, {
      mode: "transit",
      reason: "user",
    });
    const transitRequest = requests.find(
      (request) => request.path === "/v3/direction/transit/integrated",
    );

    assert.equal(
      result.entry.modeOptions.some((option) => option.mode === "transit"),
      true,
    );
    assert.equal(transitRequest?.params.city, "西安市");
    assert.equal(transitRequest?.params.cityd, undefined);
  });
});

test("route segment transit requests infer city from the place address before district area", async () => {
  await withMockTransitRouteFetch(async (requests) => {
    const trip = createTrip();

    trip.places = trip.places.map((place) => ({
      ...place,
      area: "临潼区",
      address: "西安市临潼区秦陵北路",
    }));

    const segment = getFirstRouteSegment(trip);
    await getRouteSegmentWithCache(segment, {
      mode: "transit",
      reason: "user",
    });

    const transitRequest = requests.find(
      (request) => request.path === "/v3/direction/transit/integrated",
    );

    assert.equal(transitRequest?.params.city, "西安市");
  });
});
