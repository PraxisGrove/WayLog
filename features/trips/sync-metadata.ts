import AsyncStorage from "@react-native-async-storage/async-storage";

import { createDiagnosticLogger } from "../diagnostics";

export type EntitySyncMetadata = {
  cloudUpdatedAt?: string;
  deletedAt?: string;
  dirty?: boolean;
  lastSyncError?: string;
  lastSyncedAt?: string;
  localUpdatedAt?: string;
  version?: number;
};

export type EntitySyncMetadataStore = {
  entities: Record<string, EntitySyncMetadata>;
  version: 1;
};

const syncMetadataLogger = createDiagnosticLogger("sync-metadata");

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizeVersion(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : undefined;
  }

  return undefined;
}

function normalizeSyncMetadata(value: unknown): EntitySyncMetadata {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const source = value as Record<string, unknown>;

  return {
    cloudUpdatedAt: normalizeString(source.cloudUpdatedAt),
    deletedAt: normalizeString(source.deletedAt),
    dirty: source.dirty === true,
    lastSyncError: normalizeString(source.lastSyncError),
    lastSyncedAt: normalizeString(source.lastSyncedAt),
    localUpdatedAt: normalizeString(source.localUpdatedAt),
    version: normalizeVersion(source.version),
  };
}

export async function loadEntitySyncMetadata(
  storageKey: string,
): Promise<EntitySyncMetadataStore> {
  const rawStore = await AsyncStorage.getItem(storageKey);

  if (!rawStore) {
    return {
      entities: {},
      version: 1,
    };
  }

  try {
    const parsedStore = JSON.parse(rawStore);
    const rawEntities =
      typeof parsedStore === "object" && parsedStore !== null
        ? (parsedStore as Record<string, unknown>).entities
        : undefined;

    if (typeof rawEntities !== "object" || rawEntities === null) {
      return {
        entities: {},
        version: 1,
      };
    }

    const entities = Object.entries(
      rawEntities as Record<string, unknown>,
    ).reduce<Record<string, EntitySyncMetadata>>(
      (currentEntities, [id, rawMetadata]) => {
        currentEntities[id] = normalizeSyncMetadata(rawMetadata);
        return currentEntities;
      },
      {},
    );

    return {
      entities,
      version: 1,
    };
  } catch (error) {
    syncMetadataLogger.warn(
      "parse.failed",
      { error, storageKey },
      "Failed to parse sync metadata",
    );
    return {
      entities: {},
      version: 1,
    };
  }
}

export async function saveEntitySyncMetadata(
  storageKey: string,
  store: EntitySyncMetadataStore,
): Promise<void> {
  await AsyncStorage.setItem(storageKey, JSON.stringify(store));
}

export async function clearEntitySyncMetadata(
  storageKey: string,
): Promise<void> {
  await AsyncStorage.removeItem(storageKey);
}

export function markEntityDirty(
  store: EntitySyncMetadataStore,
  id: string,
  localUpdatedAt: string,
): EntitySyncMetadataStore {
  return {
    ...store,
    entities: {
      ...store.entities,
      [id]: {
        ...store.entities[id],
        deletedAt: undefined,
        dirty: true,
        lastSyncError: undefined,
        localUpdatedAt,
      },
    },
  };
}

export function removeEntitySyncMetadata(
  store: EntitySyncMetadataStore,
  id: string,
): EntitySyncMetadataStore {
  const entities = { ...store.entities };
  delete entities[id];

  return {
    ...store,
    entities,
  };
}

export function markEntityDeleted(
  store: EntitySyncMetadataStore,
  id: string,
  deletedAt: string,
): EntitySyncMetadataStore {
  return {
    ...store,
    entities: {
      ...store.entities,
      [id]: {
        ...store.entities[id],
        deletedAt,
        dirty: true,
        lastSyncError: undefined,
        localUpdatedAt: deletedAt,
      },
    },
  };
}

export function markEntitySynced(
  store: EntitySyncMetadataStore,
  id: string,
  input: {
    cloudUpdatedAt?: string;
    deletedAt?: string;
    lastSyncedAt: string;
    version?: number;
  },
): EntitySyncMetadataStore {
  return {
    ...store,
    entities: {
      ...store.entities,
      [id]: {
        ...store.entities[id],
        cloudUpdatedAt:
          input.cloudUpdatedAt ?? store.entities[id]?.cloudUpdatedAt,
        deletedAt: input.deletedAt,
        dirty: false,
        lastSyncError: undefined,
        lastSyncedAt: input.lastSyncedAt,
        localUpdatedAt: store.entities[id]?.localUpdatedAt,
        version: input.version ?? store.entities[id]?.version,
      },
    },
  };
}

export function markEntitySyncFailed(
  store: EntitySyncMetadataStore,
  id: string,
  error: unknown,
): EntitySyncMetadataStore {
  const message = error instanceof Error ? error.message : "Sync failed.";

  return {
    ...store,
    entities: {
      ...store.entities,
      [id]: {
        ...store.entities[id],
        dirty: true,
        lastSyncError: message,
      },
    },
  };
}
