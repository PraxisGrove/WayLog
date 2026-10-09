import assert from "node:assert/strict";
import test from "node:test";

import AsyncStorageModule from "@react-native-async-storage/async-storage";

import { setAuthStorageAdapter } from "../../../features/auth";
import type { Trip } from "../../../features/trips/types";
import {
  clearLocalTripData,
  createTripLocally,
  getTrips,
  markTripDirtyWithoutScheduling,
  rollbackLocallyCreatedTrip,
  updateTrip,
} from "../../../features/trips/storage";

const AsyncStorage =
  (AsyncStorageModule as { default?: typeof AsyncStorageModule }).default ??
  AsyncStorageModule;
const TRIP_SYNC_STORAGE_KEY = "waylog.trip_sync.v1";

function installWindowLocalStorage() {
  const globalWithWindow = globalThis as {
    window?: unknown;
  };
  const originalWindow = globalWithWindow.window;
  const store = new Map<string, string>();
  const localStorage = {
    clear: () => {
      store.clear();
    },
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };

  globalWithWindow.window = { localStorage };

  return {
    restore: () => {
      if (originalWindow === undefined) {
        delete globalWithWindow.window;
        return;
      }

      globalWithWindow.window = originalWindow;
    },
  };
}

function makeStoredTrip(): Trip {
  return {
    checklistItems: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    currency: "CNY",
    days: [
      {
        dayIndex: 1,
        id: "day-1",
        items: [],
        title: "Day 1",
      },
    ],
    destination: "Kunming",
    expenses: [],
    id: "trip-day-title-storage",
    importSources: [],
    lodgings: [],
    memos: [],
    places: [],
    status: "planned" as Trip["status"],
    title: "Yunnan 3 days",
    transports: [],
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}

function createFreshAccessToken(): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: "user-sync-failure",
    }),
  ).toString("base64url");
  return `${header}.${payload}.signature`;
}

test("并发创建行程不会覆盖另一条本地 Trip", async (t) => {
  const browserStorage = installWindowLocalStorage();
  t.after(async () => {
    await clearLocalTripData();
    browserStorage.restore();
  });
  await clearLocalTripData();
  const createInput = (title: string, destination: string) => ({
    destination,
    endDate: "2026-10-03",
    startDate: "2026-10-01",
    title,
  });

  const [first, second] = await Promise.all([
    createTripLocally(createInput("并发行程 A", "云南"), {
      tripId: "trip-concurrent-a",
    }),
    createTripLocally(createInput("并发行程 B", "上海"), {
      tripId: "trip-concurrent-b",
    }),
  ]);

  const trips = await getTrips();
  assert.equal(first.id, "trip-concurrent-a");
  assert.equal(second.id, "trip-concurrent-b");
  await Promise.all(trips.map((trip) => markTripDirtyWithoutScheduling(trip)));
  const syncEntities = (
    JSON.parse((await AsyncStorage.getItem(TRIP_SYNC_STORAGE_KEY)) ?? "{}") as {
      entities?: Record<string, { dirty?: boolean }>;
    }
  ).entities;
  assert.equal(syncEntities?.["trip-concurrent-a"]?.dirty, true);
  assert.equal(syncEntities?.["trip-concurrent-b"]?.dirty, true);
  await clearLocalTripData();
});

test("并发创建和更新行程不会互相覆盖", async (t) => {
  const browserStorage = installWindowLocalStorage();
  t.after(async () => {
    await clearLocalTripData();
    browserStorage.restore();
  });
  await clearLocalTripData();
  const existing = await createTripLocally(
    {
      destination: "云南",
      endDate: "2026-10-03",
      startDate: "2026-10-01",
      title: "待更新行程",
    },
    { tripId: "trip-update-race" },
  );

  await Promise.all([
    createTripLocally(
      {
        destination: "上海",
        endDate: "2026-11-03",
        startDate: "2026-11-01",
        title: "并发新行程",
      },
      { tripId: "trip-create-race" },
    ),
    updateTrip({ ...existing, title: "已更新行程" }),
  ]);

  const trips = await getTrips();
  assert.deepEqual(
    new Set(trips.map((trip) => trip.id)),
    new Set(["trip-update-race", "trip-create-race"]),
  );
  assert.equal(
    trips.find((trip) => trip.id === "trip-update-race")?.title,
    "已更新行程",
  );
  await clearLocalTripData();
});

test("创建回滚和其他行程更新并发时不会丢失更新", async (t) => {
  const browserStorage = installWindowLocalStorage();
  t.after(async () => {
    await clearLocalTripData();
    browserStorage.restore();
  });
  await clearLocalTripData();
  const kept = await createTripLocally(
    {
      destination: "云南",
      endDate: "2026-10-03",
      startDate: "2026-10-01",
      title: "保留行程",
    },
    { tripId: "trip-rollback-kept" },
  );
  await createTripLocally(
    {
      destination: "上海",
      endDate: "2026-11-03",
      startDate: "2026-11-01",
      title: "待回滚行程",
    },
    { tripId: "trip-rollback-target" },
  );

  await Promise.all([
    rollbackLocallyCreatedTrip("trip-rollback-target"),
    updateTrip({ ...kept, title: "保留行程已更新" }),
  ]);

  const trips = await getTrips();
  assert.deepEqual(
    trips.map((trip) => trip.id),
    ["trip-rollback-kept"],
  );
  assert.equal(trips[0]?.title, "保留行程已更新");
  await clearLocalTripData();
});
test("updateTrip persists custom day titles", async (t) => {
  const browserStorage = installWindowLocalStorage();
  const { clearLocalTripData, getTripById, saveTrips, updateTrip } =
    await import("../../../features/trips/storage.js");

  t.after(async () => {
    await clearLocalTripData();
    browserStorage.restore();
  });

  await clearLocalTripData();

  const trip = makeStoredTrip();
  await saveTrips([trip]);

  await updateTrip({
    ...trip,
    days: trip.days.map((day) =>
      day.id === "day-1" ? { ...day, title: "Dianchi first look" } : day,
    ),
  });

  const restoredTrip = await getTripById("trip-day-title-storage");
  assert.equal(restoredTrip?.days[0]?.title, "Dianchi first look");
});

test("updateTrip rejects a stale expectedUpdatedAt instead of overwriting a newer Trip", async (t) => {
  const browserStorage = installWindowLocalStorage();
  const { clearLocalTripData, getTripById, saveTrips, updateTrip } =
    await import("../../../features/trips/storage.js");

  t.after(async () => {
    await clearLocalTripData();
    browserStorage.restore();
  });

  await clearLocalTripData();
  const trip = makeStoredTrip();
  await saveTrips([trip]);
  const first = await updateTrip(
    { ...trip, title: "first writer" },
    { expectedUpdatedAt: trip.updatedAt },
  );
  const firstSaved = first.find((candidate) => candidate.id === trip.id);
  if (!firstSaved) throw new Error("Expected the first Trip update to persist");

  await assert.rejects(
    () =>
      updateTrip(
        { ...trip, title: "stale writer" },
        { expectedUpdatedAt: trip.updatedAt },
      ),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "VERSION_CONFLICT",
  );
  assert.equal((await getTripById(trip.id))?.title, "first writer");

  const second = await updateTrip(
    { ...firstSaved, title: "fresh writer" },
    { expectedUpdatedAt: firstSaved.updatedAt },
  );
  assert.equal(
    second.find((candidate) => candidate.id === trip.id)?.title,
    "fresh writer",
  );
});

test("confirmed agent day title proposals persist through updateTrip", async (t) => {
  const browserStorage = installWindowLocalStorage();
  const { clearLocalTripData, getTripById, saveTrips, updateTrip } =
    await import("../../../features/trips/storage.js");
  const { runAgentHarnessTurn } = await import(
    "../../../features/agent/harness.js"
  );

  t.after(async () => {
    await clearLocalTripData();
    browserStorage.restore();
  });

  await clearLocalTripData();

  const trip = makeStoredTrip();
  await saveTrips([trip]);

  const turn = await runAgentHarnessTurn({
    confirmation: "confirmed",
    model: () => ({
      expectedUpdatedAt: trip.updatedAt,
      operations: [
        {
          dayId: "day-1",
          operationId: "agent-day-title-storage-op",
          title: "Cuihu sunrise",
          tripId: trip.id,
          type: "update_trip_day_title",
        },
      ],
      proposalId: "agent-day-title-storage-proposal",
      summary: "Update day title",
      tripId: trip.id,
    }),
    trip,
    userMessage: "rename day",
  });

  assert.equal(turn.ok, true);
  if (!turn.ok || turn.data.status !== "applied") {
    throw new Error("Expected confirmed proposal to apply");
  }

  await updateTrip(turn.data.trip);

  const restoredTrip = await getTripById("trip-day-title-storage");
  assert.equal(restoredTrip?.days[0]?.title, "Cuihu sunrise");
});

test("createTrip marks a local Trip dirty even without a cloud session", async (t) => {
  const browserStorage = installWindowLocalStorage();
  const { clearLocalTripData, createTrip } = await import(
    "../../../features/trips/storage.js"
  );
  setAuthStorageAdapter({
    getItem: async () => null,
    removeItem: async () => undefined,
    setItem: async () => undefined,
  });

  t.after(async () => {
    await clearLocalTripData();
    browserStorage.restore();
  });

  await clearLocalTripData();
  const trip = await createTrip({
    destination: "云南",
    title: "离线创建行程",
  });
  const syncMetadata = JSON.parse(
    (await AsyncStorage.getItem(TRIP_SYNC_STORAGE_KEY)) ?? "{}",
  ) as { entities?: Record<string, { dirty?: boolean }> };

  assert.equal(syncMetadata.entities?.[trip.id]?.dirty, true);
});

test("scheduled cloud sync absorbs async failure and retains dirty metadata", async (t) => {
  const browserStorage = installWindowLocalStorage();
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const authValues = new Map<string, string>();
  const {
    clearLocalTripData,
    markTripDirtyWithoutScheduling,
    saveTrips,
    scheduleTripsCloudSync,
  } = await import("../../../features/trips/storage.js");
  const { AUTH_STORAGE_KEY } = await import(
    "../../../features/auth/storage.js"
  );

  t.after(async () => {
    await clearLocalTripData();
    globalThis.fetch = originalFetch;
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
    setAuthStorageAdapter({
      getItem: async () => null,
      removeItem: async () => undefined,
      setItem: async () => undefined,
    });
    browserStorage.restore();
  });

  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://travel-test.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  authValues.set(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      identities: [],
      session: {
        accessToken: createFreshAccessToken(),
        createdAt: "2026-08-01T00:00:00.000Z",
        lastActiveAt: "2026-08-01T00:00:00.000Z",
        refreshToken: "refresh-token",
        userId: "user-sync-failure",
      },
      users: [
        {
          createdAt: "2026-08-01T00:00:00.000Z",
          displayName: "Sync Failure User",
          id: "user-sync-failure",
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    }),
  );
  setAuthStorageAdapter({
    getItem: async (key) => authValues.get(key) ?? null,
    removeItem: async (key) => {
      authValues.delete(key);
    },
    setItem: async (key, value) => {
      authValues.set(key, value);
    },
  });
  globalThis.fetch = (async () => {
    throw new Error("cloud unavailable");
  }) as typeof fetch;

  await clearLocalTripData();
  const trip = makeStoredTrip();
  await saveTrips([trip]);
  await markTripDirtyWithoutScheduling(trip);
  await scheduleTripsCloudSync();

  const syncMetadata = JSON.parse(
    (await AsyncStorage.getItem(TRIP_SYNC_STORAGE_KEY)) ?? "{}",
  ) as { entities?: Record<string, { dirty?: boolean }> };
  assert.equal(syncMetadata.entities?.[trip.id]?.dirty, true);
});
