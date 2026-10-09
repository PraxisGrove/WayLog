import assert from "node:assert/strict";
import test from "node:test";
import {
  createTripChecklistItemsFromTemplate,
  createUserTripChecklistTemplate,
  defaultTripChecklistTemplatePreference,
  getSelectedTripChecklistTemplate,
  normalizeTripChecklistTemplatePreference,
  parseChecklistTemplateItemsText,
  setTripChecklistTemplatePreferenceCloudAdapterForTests,
  setTripChecklistTemplatePreferenceStorageAdapterForTests,
  syncTripChecklistTemplatePreferenceWithCloud,
  TRIP_CHECKLIST_TEMPLATE_PREFERENCE_STORAGE_KEY,
  type TripChecklistTemplatePreference,
} from "../../../features/trips/checklist-templates";
import type {
  CloudSyncSession,
  CloudUserPreferenceRow,
} from "../../../features/trips/cloud-sync";
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

function createChecklistTemplateCloudAdapter(options: {
  row?: CloudUserPreferenceRow;
  session?: CloudSyncSession | null;
}) {
  let row = options.row;
  const session = options.session ?? {
    accessToken: "test-token",
    userId: "user-1",
  };
  const upsertedPreferences: TripChecklistTemplatePreference[] = [];

  return {
    adapter: {
      fetchPreference: async () => row,
      getSession: async () => session,
      upsertPreference: async (
        syncSession: CloudSyncSession,
        preference: unknown,
      ) => {
        const typedPreference = preference as TripChecklistTemplatePreference;
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

function resetChecklistTemplatePreferenceTestAdapters() {
  setTripChecklistTemplatePreferenceStorageAdapterForTests(null);
  setTripChecklistTemplatePreferenceCloudAdapterForTests(null);
}

test("checklist template preference normalizes invalid records to default", () => {
  assert.deepEqual(
    normalizeTripChecklistTemplatePreference(null),
    defaultTripChecklistTemplatePreference,
  );
  assert.deepEqual(
    normalizeTripChecklistTemplatePreference({
      selectedTemplateId: "missing",
      userTemplates: [
        { id: "bad", name: "", titles: ["身份证"] },
        { id: "empty", name: "空模板", titles: [] },
      ],
    }),
    defaultTripChecklistTemplatePreference,
  );
});

test("checklist template preference keeps valid user templates and selected id", () => {
  const preference = normalizeTripChecklistTemplatePreference({
    selectedTemplateId: "my-template",
    userTemplates: [
      {
        description: "  常用  ",
        id: "my-template",
        name: "  我的模板  ",
        titles: ["身份证", "身份证", "充电器", ""],
        updatedAt: "2026-06-01T10:00:00.000Z",
      },
    ],
  });

  assert.equal(preference.selectedTemplateId, "my-template");
  assert.deepEqual(preference.userTemplates, [
    {
      description: "常用",
      id: "my-template",
      name: "我的模板",
      source: "user",
      titles: ["身份证", "充电器"],
      updatedAt: "2026-06-01T10:00:00.000Z",
    },
  ]);
});

test("selected checklist template falls back to the system default", () => {
  const template = getSelectedTripChecklistTemplate({
    selectedTemplateId: "missing",
    userTemplates: [],
  });

  assert.equal(template.id, "system-basic");
});

test("create checklist items from template resets completion state", () => {
  const items = createTripChecklistItemsFromTemplate({
    id: "custom-template",
    name: "自定义",
    source: "user",
    titles: ["身份证", "充电器"],
  });

  assert.deepEqual(items, [
    { id: "checklist-custom-template-1", isCompleted: false, title: "身份证" },
    { id: "checklist-custom-template-2", isCompleted: false, title: "充电器" },
  ]);
});

test("parse checklist template item text supports newlines and comma separators", () => {
  assert.deepEqual(
    parseChecklistTemplateItemsText("身份证\n充电器、雨伞, 常用药，雨伞"),
    ["身份证", "充电器", "雨伞", "常用药"],
  );
});

test("create user checklist template validates name and items", () => {
  assert.equal(
    createUserTripChecklistTemplate({ name: "", titles: ["身份证"] }),
    null,
  );
  assert.equal(
    createUserTripChecklistTemplate({ name: "出差", titles: [] }),
    null,
  );

  assert.deepEqual(
    createUserTripChecklistTemplate(
      {
        description: " 办公 ",
        name: " 出差 ",
        titles: ["电脑", "电脑", "充电器"],
      },
      {
        idGen: () => "template-1",
        now: () => "2026-06-01T00:00:00.000Z",
      },
    ),
    {
      description: "办公",
      id: "template-1",
      name: "出差",
      source: "user",
      titles: ["电脑", "充电器"],
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
  );
});

test("checklist template sync uses newer cloud data and saves it locally", async (t) => {
  t.after(resetChecklistTemplatePreferenceTestAdapters);

  const localPreference: TripChecklistTemplatePreference = {
    selectedTemplateId: "system-light",
    userTemplates: [],
  };
  const cloudPreference: TripChecklistTemplatePreference = {
    selectedTemplateId: "system-business",
    userTemplates: [],
  };
  const storage = createMemoryStorage({
    [TRIP_CHECKLIST_TEMPLATE_PREFERENCE_STORAGE_KEY]: JSON.stringify({
      preference: localPreference,
      updatedAt: "2026-06-01T10:00:00.000Z",
      userId: "user-1",
      version: 1,
    }),
  });
  const cloud = createChecklistTemplateCloudAdapter({
    row: {
      payload: cloudPreference,
      updated_at: "2026-06-02T10:00:00.000Z",
      user_id: "user-1",
      version: 1,
    },
  });

  setTripChecklistTemplatePreferenceStorageAdapterForTests(storage);
  setTripChecklistTemplatePreferenceCloudAdapterForTests(cloud.adapter);

  assert.deepEqual(
    await syncTripChecklistTemplatePreferenceWithCloud(),
    cloudPreference,
  );
  assert.equal(cloud.upsertedPreferences.length, 0);

  const savedRecord = JSON.parse(
    storage.dump()[TRIP_CHECKLIST_TEMPLATE_PREFERENCE_STORAGE_KEY] ?? "{}",
  ) as {
    preference?: TripChecklistTemplatePreference;
  };
  assert.deepEqual(savedRecord.preference, cloudPreference);
});

test("checklist template sync uploads newer local data", async (t) => {
  t.after(resetChecklistTemplatePreferenceTestAdapters);

  const localPreference: TripChecklistTemplatePreference = {
    selectedTemplateId: "system-family",
    userTemplates: [],
  };
  const storage = createMemoryStorage({
    [TRIP_CHECKLIST_TEMPLATE_PREFERENCE_STORAGE_KEY]: JSON.stringify({
      preference: localPreference,
      updatedAt: "2026-06-03T10:00:00.000Z",
      userId: "user-1",
      version: 1,
    }),
  });
  const cloud = createChecklistTemplateCloudAdapter({
    row: {
      payload: defaultTripChecklistTemplatePreference,
      updated_at: "2026-06-02T10:00:00.000Z",
      user_id: "user-1",
      version: 1,
    },
  });

  setTripChecklistTemplatePreferenceStorageAdapterForTests(storage);
  setTripChecklistTemplatePreferenceCloudAdapterForTests(cloud.adapter);

  assert.deepEqual(
    await syncTripChecklistTemplatePreferenceWithCloud(),
    localPreference,
  );
  assert.deepEqual(cloud.upsertedPreferences, [localPreference]);
});
