import assert from "node:assert/strict";
import test from "node:test";

import AsyncStorageModule from "@react-native-async-storage/async-storage";

import { setAuthStorageAdapter } from "../../../features/auth";
import {
  setTripChecklistTemplatePreferenceCloudAdapterForTests,
  setTripChecklistTemplatePreferenceStorageAdapterForTests,
  TRIP_CHECKLIST_TEMPLATE_PREFERENCE_STORAGE_KEY,
} from "../../../features/trips/checklist-templates";
import {
  clearLocalTripData,
  createTrip,
  deleteTrip,
  getTrips,
  getTripsWithSeed,
  syncTripsWithCloud,
  TRIPS_STORAGE_KEY,
} from "../../../features/trips/storage";

const AsyncStorage =
  (AsyncStorageModule as { default?: typeof AsyncStorageModule }).default ??
  AsyncStorageModule;
const TRIP_SYNC_STORAGE_KEY = "waylog.trip_sync.v1";
const AUTH_STORAGE_KEY = "waylog.auth.v1";
const originalFetch = globalThis.fetch;

const authStorage = {
  getItem: async () => null,
  removeItem: async () => undefined,
  setItem: async () => undefined,
};

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

function resetChecklistTemplatePreferenceTestAdapters() {
  setTripChecklistTemplatePreferenceStorageAdapterForTests(null);
  setTripChecklistTemplatePreferenceCloudAdapterForTests(null);
}

function createSignedInAuthState(now: string) {
  return {
    identities: [
      {
        id: "identity-1",
        userId: "user-1",
        provider: "email",
        providerUid: "tester@example.com",
        label: "tester@example.com",
        createdAt: now,
        lastLoginAt: now,
      },
    ],
    session: {
      userId: "user-1",
      accessToken: "access-token-1",
      createdAt: now,
      lastActiveAt: now,
      refreshToken: "refresh-token-1",
    },
    users: [
      {
        id: "user-1",
        displayName: "Test User",
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    reject,
    resolve,
  };
}

function createStoredTrip(id: string, updatedAt: string) {
  return {
    id,
    title: "Race Trip",
    destination: "Hangzhou",
    startDate: "2026-06-10",
    endDate: "2026-06-12",
    days: [],
    places: [],
    transports: [],
    lodgings: [],
    memos: [],
    checklistItems: [],
    expenses: [],
    importSources: [],
    currency: "CNY",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt,
  };
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) {
        resolve();
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error("Timed out waiting for condition."));
        return;
      }

      setTimeout(tick, 0);
    };

    tick();
  });
}

function installWindowLocalStorage(
  initialEntries: Record<string, string> = {},
) {
  const store = new Map(Object.entries(initialEntries));
  const globalScope = globalThis as typeof globalThis & {
    window?: {
      localStorage: {
        clear(): void;
        getItem(key: string): string | null;
        key(index: number): string | null;
        readonly length: number;
        removeItem(key: string): void;
        setItem(key: string, value: string): void;
      };
    };
  };
  const previousWindow = globalScope.window;
  const localStorage = {
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    get length() {
      return store.size;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };

  Object.defineProperty(globalScope, "window", {
    configurable: true,
    value: {
      localStorage,
    },
  });

  return {
    restore() {
      if (previousWindow) {
        Object.defineProperty(globalScope, "window", {
          configurable: true,
          value: previousWindow,
        });
        return;
      }

      Object.defineProperty(globalScope, "window", {
        configurable: true,
        value: undefined,
      });
    },
  };
}

test("seed trip appears on first launch and stays hidden after deleting the seed trip", async (t) => {
  const browserStorage = installWindowLocalStorage();
  t.after(() => browserStorage.restore());
  setAuthStorageAdapter(authStorage);

  await AsyncStorage.clear();
  await clearLocalTripData();

  const firstTrips = await getTripsWithSeed();

  assert.equal(firstTrips.length > 0, true);
  assert.equal(firstTrips[0]?.id, "seed-xian");

  const afterDelete = await deleteTrip("seed-xian");
  assert.deepEqual(afterDelete, []);

  const storedTrips = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);
  assert.equal(storedTrips, "[]");

  const secondTrips = await getTripsWithSeed();
  assert.deepEqual(secondTrips, []);

  await clearLocalTripData();
});

test("seed trip does not reappear when the local store already contains an explicit empty list", async (t) => {
  const browserStorage = installWindowLocalStorage();
  t.after(() => browserStorage.restore());
  setAuthStorageAdapter(authStorage);

  await AsyncStorage.clear();
  await clearLocalTripData();
  await AsyncStorage.setItem(TRIPS_STORAGE_KEY, "[]");

  const trips = await getTripsWithSeed();

  assert.equal(trips.length > 0, true);
  assert.equal(trips[0]?.id, "seed-xian");

  await clearLocalTripData();
});

test("createTrip uses selected checklist template for new trips", async (t) => {
  t.after(resetChecklistTemplatePreferenceTestAdapters);
  setAuthStorageAdapter(authStorage);

  await AsyncStorage.clear();
  await clearLocalTripData();

  const preferenceStorage = createMemoryStorage({
    [TRIP_CHECKLIST_TEMPLATE_PREFERENCE_STORAGE_KEY]: JSON.stringify({
      preference: {
        selectedTemplateId: "custom-packing",
        userTemplates: [
          {
            id: "custom-packing",
            name: "自定义出行",
            source: "user",
            titles: ["护照", "转换插头"],
          },
        ],
      },
      updatedAt: "2026-06-01T00:00:00.000Z",
      version: 1,
    }),
  });

  setTripChecklistTemplatePreferenceStorageAdapterForTests(preferenceStorage);
  setTripChecklistTemplatePreferenceCloudAdapterForTests({
    fetchPreference: async () => undefined,
    getSession: async () => null,
    upsertPreference: async () => undefined,
  });

  const trip = await createTrip({
    title: "模板测试",
    startDate: "2026-06-20",
    endDate: "2026-06-21",
  });

  assert.deepEqual(
    trip.checklistItems.map((item) => ({
      isCompleted: item.isCompleted,
      title: item.title,
    })),
    [
      { isCompleted: false, title: "护照" },
      { isCompleted: false, title: "转换插头" },
    ],
  );

  await clearLocalTripData();
});

test("normalized trip keeps an explicitly empty checklist instead of restoring defaults", async () => {
  setAuthStorageAdapter(authStorage);

  await AsyncStorage.clear();
  await clearLocalTripData();
  await AsyncStorage.setItem(
    TRIPS_STORAGE_KEY,
    JSON.stringify([
      {
        ...createStoredTrip("trip-empty-checklist", "2026-06-01T00:00:00.000Z"),
        checklistItems: [],
      },
    ]),
  );

  const trips = await getTrips();
  assert.deepEqual(trips[0]?.checklistItems, []);

  await clearLocalTripData();
});

test("cloud sync ignores seed trips stored in the backend after deleting the local seed trip", async (t) => {
  const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const browserStorage = installWindowLocalStorage();
  const authStore = new Map<string, string>();
  const now = "2026-06-01T00:00:00.000Z";
  const cloudSeedTrip = createStoredTrip("seed-xian", now);

  t.after(() => {
    browserStorage.restore();
    restoreEnv("EXPO_PUBLIC_SUPABASE_URL", originalSupabaseUrl);
    restoreEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", originalSupabaseAnonKey);
    globalThis.fetch = originalFetch;
    setAuthStorageAdapter(authStorage);
  });

  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://travel-test.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  authStore.set(AUTH_STORAGE_KEY, JSON.stringify(createSignedInAuthState(now)));
  setAuthStorageAdapter(createAuthStorageAdapter(authStore));

  await AsyncStorage.clear();
  await clearLocalTripData();

  let getRequestCount = 0;

  globalThis.fetch = (async (url, init) => {
    const urlText = String(url);

    if (
      urlText.includes("/rest/v1/user_trips") &&
      (init?.method ?? "GET") === "GET"
    ) {
      getRequestCount += 1;

      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            ...cloudSeedTrip,
            user_id: "user-1",
            payload: cloudSeedTrip,
            deleted_at: null,
            updated_at: "2026-06-01T00:00:01.000Z",
            version: 2,
          },
        ],
      } as Response;
    }

    if (urlText.includes("/rest/v1/user_trips") && init?.method === "POST") {
      return {
        ok: true,
        status: 200,
        json: async () => [],
      } as Response;
    }

    if (urlText.includes("/rest/v1/user_trips") && init?.method === "PATCH") {
      return {
        ok: true,
        status: 200,
        json: async () => [],
      } as Response;
    }

    throw new Error(`Unexpected request ${urlText}`);
  }) as typeof fetch;

  const firstTrips = await getTripsWithSeed();
  assert.equal(firstTrips[0]?.id, "seed-xian");

  const afterDelete = await deleteTrip("seed-xian");
  assert.deepEqual(afterDelete, []);

  await syncTripsWithCloud();
  assert.equal(getRequestCount, 1);

  const secondTrips = await getTripsWithSeed();
  assert.deepEqual(secondTrips, []);

  const storedTrips = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);
  assert.equal(storedTrips, "[]");

  await clearLocalTripData();
});

test("deleting a trip during an in-flight cloud sync preserves the deletion tombstone", async (t) => {
  const originalSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const browserStorage = installWindowLocalStorage();
  const authStore = new Map<string, string>();
  const firstCloudFetchStarted = createDeferred<void>();
  const firstCloudFetchResponse = createDeferred<Response>();
  const patchRequests: { body: Record<string, unknown>; url: string }[] = [];
  const now = "2026-06-01T00:00:00.000Z";
  const trip = createStoredTrip("trip-race", "2026-06-01T00:00:00.000Z");

  t.after(() => {
    browserStorage.restore();
    restoreEnv("EXPO_PUBLIC_SUPABASE_URL", originalSupabaseUrl);
    restoreEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", originalSupabaseAnonKey);
    globalThis.fetch = originalFetch;
    setAuthStorageAdapter(authStorage);
  });

  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://travel-test.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  authStore.set(AUTH_STORAGE_KEY, JSON.stringify(createSignedInAuthState(now)));
  setAuthStorageAdapter(createAuthStorageAdapter(authStore));

  await AsyncStorage.clear();
  await AsyncStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify([trip]));
  await AsyncStorage.setItem(
    TRIP_SYNC_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      entities: {
        "trip-race": {
          dirty: false,
          cloudUpdatedAt: "2026-06-01T00:00:00.000Z",
          localUpdatedAt: "2026-06-01T00:00:00.000Z",
          lastSyncedAt: "2026-06-01T00:00:00.000Z",
          version: 1,
        },
      },
    }),
  );

  let fetchCloudTripRowsCount = 0;

  globalThis.fetch = (async (url, init) => {
    const urlText = String(url);

    if (
      urlText.includes("/rest/v1/user_trips") &&
      (init?.method ?? "GET") === "GET"
    ) {
      fetchCloudTripRowsCount += 1;

      if (fetchCloudTripRowsCount === 1) {
        firstCloudFetchStarted.resolve();
        return firstCloudFetchResponse.promise;
      }

      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            ...trip,
            user_id: "user-1",
            payload: trip,
            deleted_at: patchRequests[0]?.body.deleted_at,
            updated_at: "2026-06-01T00:00:01.000Z",
            version: 2,
          },
        ],
      } as Response;
    }

    if (urlText.includes("/rest/v1/user_trips") && init?.method === "PATCH") {
      patchRequests.push({
        body: JSON.parse(String(init.body)) as Record<string, unknown>,
        url: urlText,
      });

      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            ...trip,
            user_id: "user-1",
            payload: trip,
            deleted_at: patchRequests[0]?.body.deleted_at,
            updated_at: "2026-06-01T00:00:01.000Z",
            version: 2,
          },
        ],
      } as Response;
    }

    throw new Error(`Unexpected request ${urlText}`);
  }) as typeof fetch;

  const tripsBeforeDelete = await getTrips();
  assert.equal(tripsBeforeDelete[0]?.id, "trip-race");
  await firstCloudFetchStarted.promise;

  const tripsAfterDelete = await deleteTrip("trip-race");
  assert.deepEqual(tripsAfterDelete, []);

  firstCloudFetchResponse.resolve({
    ok: true,
    status: 200,
    json: async () => [
      {
        ...trip,
        user_id: "user-1",
        payload: trip,
        deleted_at: null,
        updated_at: "2026-06-01T00:00:00.000Z",
        version: 1,
      },
    ],
  } as Response);

  await waitFor(() => patchRequests.length === 1);

  const storedTrips = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);
  const syncMetadata = JSON.parse(
    (await AsyncStorage.getItem(TRIP_SYNC_STORAGE_KEY)) ?? "{}",
  ) as {
    entities?: Record<string, { deletedAt?: string; dirty?: boolean }>;
  };

  assert.equal(storedTrips, "[]");
  assert.equal(typeof patchRequests[0]?.body.deleted_at, "string");
  assert.equal(syncMetadata.entities?.["trip-race"]?.dirty, false);
  assert.equal(
    syncMetadata.entities?.["trip-race"]?.deletedAt,
    patchRequests[0]?.body.deleted_at,
  );

  await clearLocalTripData();
});
