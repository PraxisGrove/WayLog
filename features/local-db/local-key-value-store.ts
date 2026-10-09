import { getLocalDb, isLocalDbSupported } from "./local-db";

type LocalKeyValueStorageAdapter = {
  getAllKeys: () => Promise<string[]>;
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

type AsyncStorageLike = LocalKeyValueStorageAdapter;

function assertStorageKey(value: string, fieldName: string): void {
  if (!value.trim()) {
    throw new Error(`${fieldName} cannot be empty`);
  }
}

export function createLocalDbKeyValueStorageAdapter(
  namespace: string,
): LocalKeyValueStorageAdapter {
  assertStorageKey(namespace, "namespace");

  if (!isLocalDbSupported()) {
    return createAsyncStorageKeyValueStorageAdapter(namespace);
  }

  return {
    getAllKeys: async () => {
      const db = await getLocalDb();
      const rows = await db.getAll<{ key: string }>(
        `SELECT key
          FROM local_key_value_entries
          WHERE namespace = ?
          ORDER BY key`,
        [namespace],
      );

      return rows
        .map((row) => row.key)
        .filter((key) => typeof key === "string" && key.trim().length > 0);
    },
    getItem: async (key) => {
      assertStorageKey(key, "key");

      const db = await getLocalDb();
      const row = await db.getFirst<{ value: string }>(
        `SELECT value
          FROM local_key_value_entries
          WHERE namespace = ? AND key = ?
          LIMIT 1`,
        [namespace, key],
      );

      return row?.value ?? null;
    },
    removeItem: async (key) => {
      assertStorageKey(key, "key");

      const db = await getLocalDb();
      await db.run(
        `DELETE FROM local_key_value_entries
          WHERE namespace = ? AND key = ?`,
        [namespace, key],
      );
    },
    setItem: async (key, value) => {
      assertStorageKey(key, "key");

      const db = await getLocalDb();
      await db.run(
        `INSERT OR REPLACE INTO local_key_value_entries
          (namespace, key, value, updated_at)
          VALUES (?, ?, ?, ?)`,
        [namespace, key, value, new Date().toISOString()],
      );
    },
  };
}

function createAsyncStorageKeyValueStorageAdapter(
  namespace: string,
): LocalKeyValueStorageAdapter {
  const storageKeyPrefix = `waylog.local-db.${namespace}.`;
  let asyncStoragePromise: Promise<AsyncStorageLike> | null = null;

  const loadAsyncStorage = async (): Promise<AsyncStorageLike> => {
    if (!asyncStoragePromise) {
      asyncStoragePromise = import("@react-native-async-storage/async-storage")
        .then((module) => normalizeAsyncStorageModule(module))
        .catch((error) => {
          asyncStoragePromise = null;
          throw error;
        });
    }

    return asyncStoragePromise;
  };

  return {
    getAllKeys: async () => {
      const storage = await loadAsyncStorage();
      const keys = await storage.getAllKeys();

      return keys
        .filter((key) => key.startsWith(storageKeyPrefix))
        .map((key) => key.slice(storageKeyPrefix.length))
        .filter((key) => key.trim().length > 0)
        .sort();
    },
    getItem: async (key) => {
      assertStorageKey(key, "key");

      const storage = await loadAsyncStorage();

      return storage.getItem(`${storageKeyPrefix}${key}`);
    },
    removeItem: async (key) => {
      assertStorageKey(key, "key");

      const storage = await loadAsyncStorage();
      await storage.removeItem(`${storageKeyPrefix}${key}`);
    },
    setItem: async (key, value) => {
      assertStorageKey(key, "key");

      const storage = await loadAsyncStorage();
      await storage.setItem(`${storageKeyPrefix}${key}`, value);
    },
  };
}

function normalizeAsyncStorageModule(module: unknown): AsyncStorageLike {
  const candidate = readAsyncStorageCandidate(module);

  if (candidate) {
    return candidate;
  }

  throw new Error("AsyncStorage is not available for LocalDB fallback.");
}

function readAsyncStorageCandidate(
  value: unknown,
): AsyncStorageLike | undefined {
  if (isAsyncStorageLike(value)) {
    return value;
  }

  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  return readAsyncStorageCandidate(record.default);
}

function isAsyncStorageLike(value: unknown): value is AsyncStorageLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "getAllKeys" in value &&
    "getItem" in value &&
    "removeItem" in value &&
    "setItem" in value
  );
}
