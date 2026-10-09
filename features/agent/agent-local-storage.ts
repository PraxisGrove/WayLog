import { createLocalDbKeyValueStorageAdapter } from "../local-db";

export type AgentLocalStorage = {
  getAllKeys?: () => Promise<readonly string[]>;
  getItem: (key: string) => Promise<string | null>;
  removeItem?: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

const AGENT_LOCAL_DB_NAMESPACE = "agent";
const LEGACY_AGENT_STORAGE_KEY_PREFIX = "waylog.agent.";

let agentLocalStorageForTests: AgentLocalStorage | null = null;
let defaultAgentLocalStorage: AgentLocalStorage | null = null;
let legacyAgentLocalStorageForTests: AgentLocalStorage | null | undefined;
let legacyAgentLocalStoragePromise: Promise<AgentLocalStorage | null> | null =
  null;

export function getAgentLocalStorage(): AgentLocalStorage {
  if (agentLocalStorageForTests) {
    return agentLocalStorageForTests;
  }

  if (!defaultAgentLocalStorage) {
    defaultAgentLocalStorage = createMigratingAgentLocalStorage();
  }

  return defaultAgentLocalStorage;
}

export function setAgentLocalStorageAdapterForTests(
  storage: AgentLocalStorage | null,
): void {
  agentLocalStorageForTests = storage;
  defaultAgentLocalStorage = null;
}

export function setLegacyAgentLocalStorageAdapterForTests(
  storage: AgentLocalStorage | null | undefined,
): void {
  legacyAgentLocalStorageForTests = storage;
  legacyAgentLocalStoragePromise = null;
}

async function loadLegacyAgentLocalStorage(): Promise<AgentLocalStorage | null> {
  if (legacyAgentLocalStorageForTests !== undefined) {
    return legacyAgentLocalStorageForTests;
  }

  if (!legacyAgentLocalStoragePromise) {
    legacyAgentLocalStoragePromise = import(
      "@react-native-async-storage/async-storage"
    )
      .then((module) => {
        const candidate = (module.default ?? module) as unknown;

        return isAgentLocalStorage(candidate)
          ? (candidate as AgentLocalStorage)
          : null;
      })
      .catch(() => null);
  }

  return legacyAgentLocalStoragePromise;
}

function createMigratingAgentLocalStorage(): AgentLocalStorage {
  const localStorage = createLocalDbKeyValueStorageAdapter(
    AGENT_LOCAL_DB_NAMESPACE,
  );

  return {
    getAllKeys: async () => {
      const keys = new Set<string>();

      for (const key of await localStorage.getAllKeys()) {
        keys.add(key);
      }

      const legacyStorage = await loadLegacyAgentLocalStorage();
      const legacyKeys = await legacyStorage?.getAllKeys?.();

      for (const key of legacyKeys ?? []) {
        if (key.startsWith(LEGACY_AGENT_STORAGE_KEY_PREFIX)) {
          keys.add(key);
        }
      }

      return [...keys];
    },
    getItem: async (key) => {
      const localValue = await localStorage.getItem(key);

      if (localValue !== null) {
        return localValue;
      }

      const legacyStorage = await loadLegacyAgentLocalStorage();
      const legacyValue = (await legacyStorage?.getItem(key)) ?? null;

      if (legacyValue !== null) {
        await localStorage.setItem(key, legacyValue);
        await legacyStorage?.removeItem?.(key);
      }

      return legacyValue;
    },
    removeItem: async (key) => {
      const legacyStorage = await loadLegacyAgentLocalStorage();

      await Promise.all([
        localStorage.removeItem(key),
        legacyStorage?.removeItem?.(key) ?? Promise.resolve(),
      ]);
    },
    setItem: async (key, value) => {
      await localStorage.setItem(key, value);
      const legacyStorage = await loadLegacyAgentLocalStorage();

      await legacyStorage?.removeItem?.(key);
    },
  };
}

function isAgentLocalStorage(value: unknown): value is AgentLocalStorage {
  return (
    typeof value === "object" &&
    value !== null &&
    "getItem" in value &&
    "setItem" in value
  );
}
