import type { CloudSyncSession } from "./cloud-sync";
import { getCloudSyncSession } from "./cloud-sync";
import { createDiagnosticLogger } from "../diagnostics";

type PreferenceStorageRecord<T> = {
  cloudUpdatedAt?: string;
  preference: T;
  updatedAt?: string;
  userId?: string;
  version: 1;
};

export type PreferenceStorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  removeItem?: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

type CloudPreferenceRow = {
  created_at?: string | null;
  preference_key?: string;
  payload?: unknown;
  updated_at?: string | null;
  user_id?: string;
  version?: number | string | null;
};

export type PreferenceCloudAdapter = {
  fetchPreference: (
    session: CloudSyncSession,
  ) => Promise<CloudPreferenceRow | undefined>;
  getSession: () => Promise<CloudSyncSession | null>;
  upsertPreference: (
    session: CloudSyncSession,
    preference: unknown,
  ) => Promise<CloudPreferenceRow | undefined>;
};

type PreferenceSyncConfig<T> = {
  storageKey: string;
  defaultValue: T;
  normalize: (value: unknown) => T;
  fetchCloudRow: (
    session: CloudSyncSession,
  ) => Promise<CloudPreferenceRow | undefined>;
  upsertCloudRow: (
    session: CloudSyncSession,
    preference: T,
  ) => Promise<CloudPreferenceRow | undefined>;
};

const preferenceSyncLogger = createDiagnosticLogger("preference-sync");

export type PreferenceSyncInstance<T> = {
  get: () => Promise<T>;
  save: (preference: T) => Promise<void>;
  sync: () => Promise<T>;
  clear: () => Promise<void>;
  hasGuestData: () => Promise<boolean>;
  setStorageAdapterForTests: (adapter: PreferenceStorageAdapter | null) => void;
  setCloudAdapterForTests: (adapter: PreferenceCloudAdapter | null) => void;
};

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function compareIsoTimestamp(left?: string, right?: string): number {
  const leftTime = left ? Date.parse(left) : 0;
  const rightTime = right ? Date.parse(right) : 0;
  const normalizedLeftTime = Number.isNaN(leftTime) ? 0 : leftTime;
  const normalizedRightTime = Number.isNaN(rightTime) ? 0 : rightTime;

  return normalizedLeftTime - normalizedRightTime;
}

export function createPreferenceSync<T>(
  config: PreferenceSyncConfig<T>,
): PreferenceSyncInstance<T> {
  let storageAdapter: PreferenceStorageAdapter | null = null;
  let cloudAdapter: PreferenceCloudAdapter | null = null;
  let cloudSyncPromise: Promise<void> | null = null;
  let shouldRunCloudSyncAgain = false;

  function setStorageAdapterForTests(
    adapter: PreferenceStorageAdapter | null,
  ): void {
    storageAdapter = adapter;
  }

  function setCloudAdapterForTests(
    adapter: PreferenceCloudAdapter | null,
  ): void {
    cloudAdapter = adapter;
    cloudSyncPromise = null;
    shouldRunCloudSyncAgain = false;
  }

  async function getStorageAdapter(): Promise<PreferenceStorageAdapter> {
    if (storageAdapter) {
      return storageAdapter;
    }

    const asyncStorage = await import(
      "@react-native-async-storage/async-storage"
    );
    const storage = asyncStorage.default as unknown as PreferenceStorageAdapter;
    storageAdapter = storage;
    return storage;
  }

  function getCloudAdapter(): PreferenceCloudAdapter {
    if (cloudAdapter) {
      return cloudAdapter;
    }

    return {
      fetchPreference: config.fetchCloudRow,
      getSession: getCloudSyncSession,
      upsertPreference: (session: CloudSyncSession, preference: unknown) =>
        config.upsertCloudRow(session, preference as T),
    };
  }

  function normalizeRecord(value: unknown): PreferenceStorageRecord<T> {
    if (typeof value !== "object" || value === null) {
      return {
        preference: config.defaultValue,
        version: 1,
      };
    }

    const source = value as Record<string, unknown>;
    const rawPreference =
      typeof source.preference === "object" && source.preference !== null
        ? source.preference
        : value;

    return {
      cloudUpdatedAt: normalizeString(source.cloudUpdatedAt),
      preference: config.normalize(rawPreference),
      updatedAt: normalizeString(source.updatedAt),
      userId: normalizeString(source.userId),
      version: 1,
    };
  }

  async function readRecordFromLocal(): Promise<PreferenceStorageRecord<T>> {
    const storage = await getStorageAdapter();
    const raw = await storage.getItem(config.storageKey);

    if (!raw) {
      return {
        preference: config.defaultValue,
        version: 1,
      };
    }

    try {
      return normalizeRecord(JSON.parse(raw));
    } catch {
      return {
        preference: config.defaultValue,
        version: 1,
      };
    }
  }

  async function saveRecordToLocal(
    record: PreferenceStorageRecord<T>,
  ): Promise<void> {
    const storage = await getStorageAdapter();
    await storage.setItem(
      config.storageKey,
      JSON.stringify({
        cloudUpdatedAt: record.cloudUpdatedAt,
        preference: config.normalize(record.preference),
        updatedAt: record.updatedAt,
        userId: record.userId,
        version: 1,
      }),
    );
  }

  function getRecordFromCloudRow(
    row: CloudPreferenceRow,
    fallbackUserId: string,
  ): PreferenceStorageRecord<T> {
    const cloudUpdatedAt = row.updated_at ?? undefined;

    return {
      cloudUpdatedAt,
      preference: config.normalize(row.payload),
      updatedAt: cloudUpdatedAt,
      userId: row.user_id ?? fallbackUserId,
      version: 1,
    };
  }

  function updateRecordAfterUpsert(
    record: PreferenceStorageRecord<T>,
    row: CloudPreferenceRow | undefined,
    session: CloudSyncSession,
  ): PreferenceStorageRecord<T> {
    const cloudUpdatedAt = row?.updated_at ?? record.updatedAt;

    return {
      ...record,
      cloudUpdatedAt,
      updatedAt: cloudUpdatedAt ?? record.updatedAt,
      userId: row?.user_id ?? session.userId,
    };
  }

  function getSessionLocalRecord(
    localRecord: PreferenceStorageRecord<T>,
    session: CloudSyncSession,
  ): PreferenceStorageRecord<T> {
    if (localRecord.userId && localRecord.userId !== session.userId) {
      return {
        preference: config.defaultValue,
        userId: session.userId,
        version: 1,
      };
    }

    return localRecord;
  }

  async function getCloudSession(): Promise<CloudSyncSession | null> {
    try {
      return await getCloudAdapter().getSession();
    } catch (error) {
      preferenceSyncLogger.warn(
        "session.read.failed",
        { error, storageKey: config.storageKey },
        "Failed to read preference sync session",
      );
      return null;
    }
  }

  async function get(): Promise<T> {
    const record = await readRecordFromLocal();
    return record.preference;
  }

  async function save(preference: T): Promise<void> {
    const normalizedPreference = config.normalize(preference);
    const session = await getCloudSession();

    await saveRecordToLocal({
      preference: normalizedPreference,
      updatedAt: new Date().toISOString(),
      userId: session?.userId,
      version: 1,
    });

    scheduleCloudSync();
  }

  async function sync(): Promise<T> {
    const localRecord = await readRecordFromLocal();
    const session = await getCloudSession();

    if (!session) {
      return localRecord.preference;
    }

    const sessionLocalRecord = getSessionLocalRecord(localRecord, session);

    try {
      const adapter = getCloudAdapter();
      const cloudRow = await adapter.fetchPreference(session);

      if (!cloudRow) {
        if (!sessionLocalRecord.updatedAt) {
          await saveRecordToLocal({
            ...sessionLocalRecord,
            userId: session.userId,
          });
          return sessionLocalRecord.preference;
        }

        const upsertedRow = await adapter.upsertPreference(
          session,
          sessionLocalRecord.preference,
        );
        const syncedRecord = updateRecordAfterUpsert(
          sessionLocalRecord,
          upsertedRow,
          session,
        );
        await saveRecordToLocal(syncedRecord);
        return syncedRecord.preference;
      }

      const cloudRecord = getRecordFromCloudRow(cloudRow, session.userId);

      if (
        sessionLocalRecord.updatedAt &&
        compareIsoTimestamp(
          sessionLocalRecord.updatedAt,
          cloudRecord.updatedAt,
        ) > 0
      ) {
        const upsertedRow = await adapter.upsertPreference(
          session,
          sessionLocalRecord.preference,
        );
        const syncedRecord = updateRecordAfterUpsert(
          sessionLocalRecord,
          upsertedRow,
          session,
        );
        await saveRecordToLocal(syncedRecord);
        return syncedRecord.preference;
      }

      await saveRecordToLocal(cloudRecord);
      return cloudRecord.preference;
    } catch (error) {
      preferenceSyncLogger.warn(
        "cloud.sync.failed",
        { error, storageKey: config.storageKey },
        "Failed to sync preference with cloud",
      );
      return sessionLocalRecord.preference;
    }
  }

  async function clear(): Promise<void> {
    const storage = await getStorageAdapter();

    if (storage.removeItem) {
      await storage.removeItem(config.storageKey);
      return;
    }

    await storage.setItem(
      config.storageKey,
      JSON.stringify({
        preference: config.defaultValue,
        version: 1,
      }),
    );
  }

  async function hasGuestData(): Promise<boolean> {
    const record = await readRecordFromLocal();
    return !record.userId && Boolean(record.updatedAt);
  }

  function scheduleCloudSync(): void {
    if (cloudSyncPromise) {
      shouldRunCloudSyncAgain = true;
      return;
    }

    cloudSyncPromise = (async () => {
      do {
        shouldRunCloudSyncAgain = false;
        await sync();
      } while (shouldRunCloudSyncAgain);
    })().finally(() => {
      cloudSyncPromise = null;
    });
  }

  return {
    get,
    save,
    sync,
    clear,
    hasGuestData,
    setStorageAdapterForTests,
    setCloudAdapterForTests,
  };
}
