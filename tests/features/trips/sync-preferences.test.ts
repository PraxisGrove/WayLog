import assert from "node:assert/strict";
import test from "node:test";

import {
  canRunCloudSyncOnNetwork,
  clearLocalTripSyncPreference,
  defaultTripSyncPreference,
  getTripSyncPreference,
  normalizeTripSyncPreference,
  saveTripSyncPreference,
  setTripSyncPreferenceStorageAdapterForTests,
  TRIP_SYNC_PREFERENCE_STORAGE_KEY,
  type TripSyncPreference,
} from "../../../features/trips/sync-preferences";

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

function resetSyncPreferenceTestAdapters() {
  setTripSyncPreferenceStorageAdapterForTests(null);
}

test("sync preference falls back to defaults for invalid data", () => {
  assert.deepEqual(
    normalizeTripSyncPreference(null),
    defaultTripSyncPreference,
  );
  assert.deepEqual(
    normalizeTripSyncPreference({ networkPolicy: "bluetoothOnly" }),
    defaultTripSyncPreference,
  );
});

test("sync preference reads local stored policy", async (t) => {
  t.after(resetSyncPreferenceTestAdapters);

  const storage = createMemoryStorage({
    [TRIP_SYNC_PREFERENCE_STORAGE_KEY]: JSON.stringify({
      preference: {
        networkPolicy: "wifiOnly",
      } satisfies TripSyncPreference,
      updatedAt: "2026-06-05T10:00:00.000Z",
      version: 1,
    }),
  });

  setTripSyncPreferenceStorageAdapterForTests(storage);

  assert.deepEqual(await getTripSyncPreference(), {
    networkPolicy: "wifiOnly",
  });
});

test("saveTripSyncPreference persists normalized local record", async (t) => {
  t.after(resetSyncPreferenceTestAdapters);

  const storage = createMemoryStorage();
  setTripSyncPreferenceStorageAdapterForTests(storage);

  await saveTripSyncPreference({
    networkPolicy: "wifiOnly",
  });

  const savedRecord = JSON.parse(
    storage.dump()[TRIP_SYNC_PREFERENCE_STORAGE_KEY] ?? "{}",
  ) as {
    preference?: TripSyncPreference;
  };

  assert.deepEqual(savedRecord.preference, {
    networkPolicy: "wifiOnly",
  });
});

test("clearLocalTripSyncPreference removes local preference record", async (t) => {
  t.after(resetSyncPreferenceTestAdapters);

  const storage = createMemoryStorage({
    [TRIP_SYNC_PREFERENCE_STORAGE_KEY]: JSON.stringify({
      preference: {
        networkPolicy: "wifiOnly",
      } satisfies TripSyncPreference,
      updatedAt: "2026-06-05T10:00:00.000Z",
      version: 1,
    }),
  });

  setTripSyncPreferenceStorageAdapterForTests(storage);
  await clearLocalTripSyncPreference();

  assert.equal(storage.dump()[TRIP_SYNC_PREFERENCE_STORAGE_KEY], undefined);
});

test("sync network policy allows only the expected network states", () => {
  assert.equal(
    canRunCloudSyncOnNetwork({ networkPolicy: "wifiOnly" }, "wifi"),
    true,
  );
  assert.equal(
    canRunCloudSyncOnNetwork({ networkPolicy: "wifiOnly" }, "cellular"),
    false,
  );
  assert.equal(
    canRunCloudSyncOnNetwork({ networkPolicy: "wifiOnly" }, "unknown"),
    true,
  );
  assert.equal(
    canRunCloudSyncOnNetwork({ networkPolicy: "wifiAndCellular" }, "cellular"),
    true,
  );
  assert.equal(
    canRunCloudSyncOnNetwork({ networkPolicy: "wifiAndCellular" }, "offline"),
    false,
  );
});
