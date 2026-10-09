import assert from "node:assert/strict";
import test from "node:test";
import type {
  CloudSyncSession,
  CloudUserPreferenceRow,
} from "../../../features/trips/cloud-sync";
import {
  clearLocalTripExpensePreference,
  defaultTripExpensePreference,
  normalizeTripExpensePreference,
  saveTripExpensePreference,
  setTripExpensePreferenceCloudAdapterForTests,
  setTripExpensePreferenceStorageAdapterForTests,
  sortTripExpenseCategoriesByPreference,
  syncTripExpensePreferenceWithCloud,
  TRIP_EXPENSE_PREFERENCE_STORAGE_KEY,
  type TripExpensePreference,
} from "../../../features/trips/expense-preferences";
import { tripExpenseCategories } from "../../../features/trips/expenses";
import type { PreferenceCloudAdapter } from "../../../features/trips/unified-preferences";

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

function createExpensePreferenceCloudAdapter(options: {
  row?: CloudUserPreferenceRow;
  session?: CloudSyncSession | null;
}) {
  let row = options.row;
  const session = options.session ?? {
    accessToken: "test-token",
    userId: "user-1",
  };
  const upsertedPreferences: TripExpensePreference[] = [];

  return {
    adapter: {
      fetchPreference: async () => row,
      getSession: async () => session,
      upsertPreference: async (
        syncSession: CloudSyncSession,
        preference: unknown,
      ) => {
        const typedPreference = preference as TripExpensePreference;
        upsertedPreferences.push(typedPreference);
        row = {
          payload: typedPreference,
          updated_at: "2026-06-03T10:00:00.000Z",
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

function resetExpensePreferenceTestAdapters() {
  setTripExpensePreferenceStorageAdapterForTests(null);
  setTripExpensePreferenceCloudAdapterForTests(null);
}

test("expense preference falls back to defaults for invalid data", () => {
  assert.deepEqual(
    normalizeTripExpensePreference(null),
    defaultTripExpensePreference,
  );
  assert.deepEqual(
    normalizeTripExpensePreference({
      budgetWarningRatio: 0.65,
      defaultCurrency: "¥",
      pinnedCategories: ["餐饮", "未知分类"],
    }),
    {
      budgetWarningRatio: defaultTripExpensePreference.budgetWarningRatio,
      defaultCurrency: "CNY",
      pinnedCategories: ["餐饮"],
    },
  );
});

test("expense preference uses newer cloud data and saves it locally", async (t) => {
  t.after(resetExpensePreferenceTestAdapters);

  const localPreference: TripExpensePreference = {
    budgetWarningRatio: 0.9,
    defaultCurrency: "USD",
    pinnedCategories: ["购物", "活动"],
  };
  const cloudPreference: TripExpensePreference = {
    budgetWarningRatio: 0.7,
    defaultCurrency: "JPY",
    pinnedCategories: ["交通", "住宿"],
  };
  const storage = createMemoryStorage({
    [TRIP_EXPENSE_PREFERENCE_STORAGE_KEY]: JSON.stringify({
      preference: localPreference,
      updatedAt: "2026-06-01T10:00:00.000Z",
      userId: "user-1",
      version: 1,
    }),
  });
  const cloud = createExpensePreferenceCloudAdapter({
    row: {
      payload: cloudPreference,
      updated_at: "2026-06-02T10:00:00.000Z",
      user_id: "user-1",
      version: 1,
    },
  });

  setTripExpensePreferenceStorageAdapterForTests(storage);
  setTripExpensePreferenceCloudAdapterForTests(cloud.adapter);

  assert.deepEqual(await syncTripExpensePreferenceWithCloud(), cloudPreference);
  assert.equal(cloud.upsertedPreferences.length, 0);
});

test("expense preference uploads newer local data for the same user", async (t) => {
  t.after(resetExpensePreferenceTestAdapters);

  const localPreference: TripExpensePreference = {
    budgetWarningRatio: 0.6,
    defaultCurrency: "HKD",
    pinnedCategories: ["门票", "购物"],
  };
  const storage = createMemoryStorage({
    [TRIP_EXPENSE_PREFERENCE_STORAGE_KEY]: JSON.stringify({
      preference: localPreference,
      updatedAt: "2026-06-03T10:00:00.000Z",
      userId: "user-1",
      version: 1,
    }),
  });
  const cloud = createExpensePreferenceCloudAdapter({
    row: {
      payload: defaultTripExpensePreference,
      updated_at: "2026-06-02T10:00:00.000Z",
      user_id: "user-1",
      version: 1,
    },
  });

  setTripExpensePreferenceStorageAdapterForTests(storage);
  setTripExpensePreferenceCloudAdapterForTests(cloud.adapter);

  assert.deepEqual(await syncTripExpensePreferenceWithCloud(), localPreference);
  assert.deepEqual(cloud.upsertedPreferences, [localPreference]);
});

test("clearLocalTripExpensePreference removes local preference record", async (t) => {
  t.after(resetExpensePreferenceTestAdapters);

  const storage = createMemoryStorage({
    [TRIP_EXPENSE_PREFERENCE_STORAGE_KEY]: JSON.stringify({
      preference: {
        budgetWarningRatio: 0.7,
        defaultCurrency: "EUR",
        pinnedCategories: ["餐饮", "住宿"],
      } satisfies TripExpensePreference,
      updatedAt: "2026-06-03T10:00:00.000Z",
      version: 1,
    }),
  });

  setTripExpensePreferenceStorageAdapterForTests(storage);
  await clearLocalTripExpensePreference();

  assert.equal(storage.dump()[TRIP_EXPENSE_PREFERENCE_STORAGE_KEY], undefined);
});

test("saveTripExpensePreference persists normalized local record", async (t) => {
  t.after(resetExpensePreferenceTestAdapters);

  const storage = createMemoryStorage();
  setTripExpensePreferenceStorageAdapterForTests(storage);
  setTripExpensePreferenceCloudAdapterForTests({
    fetchPreference: async () => undefined,
    getSession: async () => null,
    upsertPreference: async () => undefined,
  });

  await saveTripExpensePreference({
    budgetWarningRatio: 0.9,
    defaultCurrency: "¥",
    pinnedCategories: ["购物", "购物", "其他"],
  });

  const savedRecord = JSON.parse(
    storage.dump()[TRIP_EXPENSE_PREFERENCE_STORAGE_KEY] ?? "{}",
  ) as {
    preference?: TripExpensePreference;
  };

  assert.deepEqual(savedRecord.preference, {
    budgetWarningRatio: 0.9,
    defaultCurrency: "CNY",
    pinnedCategories: ["购物", "其他"],
  });
});

test("sortTripExpenseCategoriesByPreference pins preferred categories to the front", () => {
  assert.deepEqual(
    sortTripExpenseCategoriesByPreference(tripExpenseCategories, {
      ...defaultTripExpensePreference,
      pinnedCategories: ["门票", "购物"],
    }).slice(0, 4),
    ["门票", "购物", "交通", "住宿"],
  );
});
