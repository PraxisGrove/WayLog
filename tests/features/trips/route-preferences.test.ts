import assert from "node:assert/strict";
import test from "node:test";
import type {
  CloudSyncSession,
  CloudUserPreferenceRow,
} from "../../../features/trips/cloud-sync";
import {
  clearLocalTripRoutePreference,
  defaultTripRoutePreference,
  getPreferredTripRouteMode,
  normalizeTripRoutePreference,
  setTripRoutePreferenceCloudAdapterForTests,
  setTripRoutePreferenceStorageAdapterForTests,
  syncTripRoutePreferenceWithCloud,
  TRIP_ROUTE_PREFERENCE_STORAGE_KEY,
  type TripRoutePreference,
} from "../../../features/trips/route-preferences";
import type { TripRouteModeOption } from "../../../features/trips/route-segments";
import type { PreferenceCloudAdapter } from "../../../features/trips/unified-preferences";

const ROUTE_OPTIONS: TripRouteModeOption[] = [
  {
    mode: "transit",
    label: "公共交通",
    distanceKm: 2.4,
    durationMinutes: 18,
    source: "amap",
  },
  {
    mode: "cycling",
    label: "骑行",
    distanceKm: 2.1,
    durationMinutes: 9,
    source: "amap",
  },
  {
    mode: "walking",
    label: "步行",
    distanceKm: 1.9,
    durationMinutes: 28,
    source: "estimated",
  },
];

test("route preference falls back to default values for invalid storage data", () => {
  assert.deepEqual(
    normalizeTripRoutePreference(null),
    defaultTripRoutePreference,
  );
  assert.deepEqual(
    normalizeTripRoutePreference({ preferredMode: "flight" }),
    defaultTripRoutePreference,
  );
});

test("auto route preference prefers walking for short local routes", () => {
  assert.equal(
    getPreferredTripRouteMode(ROUTE_OPTIONS, defaultTripRoutePreference),
    "walking",
  );
});

test("auto route preference keeps the fastest non-transit mode for longer routes", () => {
  assert.equal(
    getPreferredTripRouteMode(
      [
        {
          mode: "cycling",
          label: "骑行",
          distanceKm: 6,
          durationMinutes: 24,
          source: "amap",
        },
        {
          mode: "walking",
          label: "步行",
          distanceKm: 5.8,
          durationMinutes: 82,
          source: "amap",
        },
      ],
      defaultTripRoutePreference,
    ),
    "cycling",
  );
});

test("route preference honors a fixed mode when the option is usable", () => {
  const preference: TripRoutePreference = {
    allowEstimatedRoutes: true,
    preferredMode: "walking",
  };

  assert.equal(getPreferredTripRouteMode(ROUTE_OPTIONS, preference), "walking");
});

test("route preference avoids estimated options when requested", () => {
  const preference: TripRoutePreference = {
    allowEstimatedRoutes: false,
    preferredMode: "walking",
  };

  assert.equal(getPreferredTripRouteMode(ROUTE_OPTIONS, preference), "cycling");
});

test("route preference falls back to estimates when no precise options exist", () => {
  const preference: TripRoutePreference = {
    allowEstimatedRoutes: false,
    preferredMode: "auto",
  };

  assert.equal(
    getPreferredTripRouteMode(
      [
        {
          mode: "walking",
          label: "步行",
          distanceKm: 1,
          durationMinutes: 12,
          source: "estimated",
        },
      ],
      preference,
    ),
    "walking",
  );
});

test("auto route preference prefers a real route geometry over a shorter estimated fallback", () => {
  assert.equal(
    getPreferredTripRouteMode(
      [
        {
          mode: "walking",
          label: "步行",
          distanceKm: 0.9,
          durationMinutes: 13,
          source: "estimated",
        },
        {
          mode: "cycling",
          label: "骑行",
          distanceKm: 1.4,
          durationMinutes: 8,
          source: "amap",
          polyline: [
            { latitude: 34.2572, longitude: 108.9439 },
            { latitude: 34.2595, longitude: 108.9481 },
          ],
        },
      ],
      defaultTripRoutePreference,
    ),
    "cycling",
  );
});

function createMemoryStorage(initialEntries: Record<string, string> = {}) {
  const store = new Map(Object.entries(initialEntries));

  return {
    dump: () => Object.fromEntries(store),
    getItem: async (key: string) => store.get(key) ?? null,
    removeItem: async (key: string) => {
      store.delete(key);
    },
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

function createRoutePreferenceCloudAdapter(options: {
  row?: CloudUserPreferenceRow;
  session?: CloudSyncSession | null;
}) {
  let row = options.row;
  const session = options.session ?? {
    accessToken: "test-token",
    userId: "user-1",
  };
  const upsertedPreferences: TripRoutePreference[] = [];

  return {
    adapter: {
      fetchPreference: async () => row,
      getSession: async () => session,
      upsertPreference: async (
        syncSession: CloudSyncSession,
        preference: unknown,
      ) => {
        const typedPreference = preference as TripRoutePreference;
        upsertedPreferences.push(typedPreference);
        row = {
          payload: typedPreference,
          updated_at: "2026-06-02T10:00:00.000Z",
          user_id: syncSession.userId,
          version: 1,
        };
        return row;
      },
    } satisfies PreferenceCloudAdapter,
    get row() {
      return row;
    },
    upsertedPreferences,
  };
}

function resetRoutePreferenceTestAdapters() {
  setTripRoutePreferenceStorageAdapterForTests(null);
  setTripRoutePreferenceCloudAdapterForTests(null);
}

test("route preference uses newer cloud data and saves it locally", async (t) => {
  t.after(resetRoutePreferenceTestAdapters);

  const localPreference: TripRoutePreference = {
    allowEstimatedRoutes: true,
    preferredMode: "cycling",
  };
  const cloudPreference: TripRoutePreference = {
    allowEstimatedRoutes: false,
    preferredMode: "walking",
  };
  const storage = createMemoryStorage({
    [TRIP_ROUTE_PREFERENCE_STORAGE_KEY]: JSON.stringify({
      preference: localPreference,
      updatedAt: "2026-06-01T10:00:00.000Z",
      userId: "user-1",
      version: 1,
    }),
  });
  const cloud = createRoutePreferenceCloudAdapter({
    row: {
      payload: cloudPreference,
      updated_at: "2026-06-02T10:00:00.000Z",
      user_id: "user-1",
      version: 1,
    },
  });

  setTripRoutePreferenceStorageAdapterForTests(storage);
  setTripRoutePreferenceCloudAdapterForTests(cloud.adapter);

  assert.deepEqual(await syncTripRoutePreferenceWithCloud(), cloudPreference);
  assert.equal(cloud.upsertedPreferences.length, 0);

  const savedRecord = JSON.parse(
    storage.dump()[TRIP_ROUTE_PREFERENCE_STORAGE_KEY] ?? "{}",
  ) as {
    preference?: TripRoutePreference;
    userId?: string;
  };
  assert.deepEqual(savedRecord.preference, cloudPreference);
  assert.equal(savedRecord.userId, "user-1");
});

test("route preference uploads newer local data for the same user", async (t) => {
  t.after(resetRoutePreferenceTestAdapters);

  const localPreference: TripRoutePreference = {
    allowEstimatedRoutes: false,
    preferredMode: "driving",
  };
  const storage = createMemoryStorage({
    [TRIP_ROUTE_PREFERENCE_STORAGE_KEY]: JSON.stringify({
      preference: localPreference,
      updatedAt: "2026-06-03T10:00:00.000Z",
      userId: "user-1",
      version: 1,
    }),
  });
  const cloud = createRoutePreferenceCloudAdapter({
    row: {
      payload: defaultTripRoutePreference,
      updated_at: "2026-06-02T10:00:00.000Z",
      user_id: "user-1",
      version: 1,
    },
  });

  setTripRoutePreferenceStorageAdapterForTests(storage);
  setTripRoutePreferenceCloudAdapterForTests(cloud.adapter);

  assert.deepEqual(await syncTripRoutePreferenceWithCloud(), localPreference);
  assert.deepEqual(cloud.upsertedPreferences, [localPreference]);
  assert.deepEqual(cloud.row?.payload, localPreference);
});

test("route preference does not upload another user local record", async (t) => {
  t.after(resetRoutePreferenceTestAdapters);

  const oldUserPreference: TripRoutePreference = {
    allowEstimatedRoutes: false,
    preferredMode: "transit",
  };
  const storage = createMemoryStorage({
    [TRIP_ROUTE_PREFERENCE_STORAGE_KEY]: JSON.stringify({
      preference: oldUserPreference,
      updatedAt: "2026-06-03T10:00:00.000Z",
      userId: "user-old",
      version: 1,
    }),
  });
  const cloud = createRoutePreferenceCloudAdapter({
    row: undefined,
    session: {
      accessToken: "test-token",
      userId: "user-new",
    },
  });

  setTripRoutePreferenceStorageAdapterForTests(storage);
  setTripRoutePreferenceCloudAdapterForTests(cloud.adapter);

  assert.deepEqual(
    await syncTripRoutePreferenceWithCloud(),
    defaultTripRoutePreference,
  );
  assert.equal(cloud.upsertedPreferences.length, 0);
});

test("clearLocalTripRoutePreference removes local preference record", async (t) => {
  t.after(resetRoutePreferenceTestAdapters);

  const storage = createMemoryStorage({
    [TRIP_ROUTE_PREFERENCE_STORAGE_KEY]: JSON.stringify({
      preference: {
        allowEstimatedRoutes: false,
        preferredMode: "driving",
      } satisfies TripRoutePreference,
      updatedAt: "2026-06-03T10:00:00.000Z",
      version: 1,
    }),
  });

  setTripRoutePreferenceStorageAdapterForTests(storage);
  await clearLocalTripRoutePreference();

  assert.equal(storage.dump()[TRIP_ROUTE_PREFERENCE_STORAGE_KEY], undefined);
});

test("route preference hides another user local record when cloud sync fails", async (t) => {
  t.after(() => {
    resetRoutePreferenceTestAdapters();
  });

  const storage = createMemoryStorage({
    [TRIP_ROUTE_PREFERENCE_STORAGE_KEY]: JSON.stringify({
      preference: {
        allowEstimatedRoutes: false,
        preferredMode: "driving",
      } satisfies TripRoutePreference,
      updatedAt: "2026-06-03T10:00:00.000Z",
      userId: "user-old",
      version: 1,
    }),
  });

  setTripRoutePreferenceStorageAdapterForTests(storage);
  setTripRoutePreferenceCloudAdapterForTests({
    fetchPreference: async () => {
      throw new Error("Network unavailable");
    },
    getSession: async () => ({
      accessToken: "test-token",
      userId: "user-new",
    }),
    upsertPreference: async () => {
      throw new Error("Should not upload.");
    },
  });

  assert.deepEqual(
    await syncTripRoutePreferenceWithCloud(),
    defaultTripRoutePreference,
  );
});
