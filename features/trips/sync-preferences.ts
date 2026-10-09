export const TRIP_SYNC_PREFERENCE_STORAGE_KEY =
  "waylog.trip_sync_preferences.v1";

export type TripSyncNetworkPolicy = "wifiOnly" | "wifiAndCellular";

export type TripSyncNetworkState = "cellular" | "offline" | "unknown" | "wifi";

export type TripSyncPreference = {
  networkPolicy: TripSyncNetworkPolicy;
};

type TripSyncPreferenceStorageRecord = {
  preference: TripSyncPreference;
  updatedAt?: string;
  version: 1;
};

type TripSyncPreferenceStorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  removeItem?: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

export const defaultTripSyncPreference: TripSyncPreference = {
  networkPolicy: "wifiAndCellular",
};

const networkPolicies: TripSyncNetworkPolicy[] = [
  "wifiOnly",
  "wifiAndCellular",
];
let syncPreferenceStorageAdapter: TripSyncPreferenceStorageAdapter | null =
  null;

export function setTripSyncPreferenceStorageAdapterForTests(
  adapter: TripSyncPreferenceStorageAdapter | null,
): void {
  syncPreferenceStorageAdapter = adapter;
}

async function getTripSyncPreferenceStorageAdapter(): Promise<TripSyncPreferenceStorageAdapter> {
  if (syncPreferenceStorageAdapter) {
    return syncPreferenceStorageAdapter;
  }

  const asyncStorage = await import(
    "@react-native-async-storage/async-storage"
  );
  const storage =
    asyncStorage.default as unknown as TripSyncPreferenceStorageAdapter;
  syncPreferenceStorageAdapter = storage;
  return storage;
}

function isTripSyncNetworkPolicy(
  value: unknown,
): value is TripSyncNetworkPolicy {
  return (
    typeof value === "string" &&
    networkPolicies.includes(value as TripSyncNetworkPolicy)
  );
}

export function normalizeTripSyncPreference(
  value: unknown,
): TripSyncPreference {
  if (typeof value !== "object" || value === null) {
    return defaultTripSyncPreference;
  }

  const source = value as Record<string, unknown>;

  return {
    networkPolicy: isTripSyncNetworkPolicy(source.networkPolicy)
      ? source.networkPolicy
      : defaultTripSyncPreference.networkPolicy,
  };
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizeTripSyncPreferenceStorageRecord(
  value: unknown,
): TripSyncPreferenceStorageRecord {
  if (typeof value !== "object" || value === null) {
    return {
      preference: defaultTripSyncPreference,
      version: 1,
    };
  }

  const source = value as Record<string, unknown>;
  const rawPreference =
    typeof source.preference === "object" && source.preference !== null
      ? source.preference
      : value;

  return {
    preference: normalizeTripSyncPreference(rawPreference),
    updatedAt: normalizeString(source.updatedAt),
    version: 1,
  };
}

async function readTripSyncPreferenceRecordFromLocal(): Promise<TripSyncPreferenceStorageRecord> {
  const storage = await getTripSyncPreferenceStorageAdapter();
  const rawPreference = await storage.getItem(TRIP_SYNC_PREFERENCE_STORAGE_KEY);

  if (!rawPreference) {
    return {
      preference: defaultTripSyncPreference,
      version: 1,
    };
  }

  try {
    return normalizeTripSyncPreferenceStorageRecord(JSON.parse(rawPreference));
  } catch {
    return {
      preference: defaultTripSyncPreference,
      version: 1,
    };
  }
}

async function saveTripSyncPreferenceRecordToLocal(
  record: TripSyncPreferenceStorageRecord,
): Promise<void> {
  const storage = await getTripSyncPreferenceStorageAdapter();
  await storage.setItem(
    TRIP_SYNC_PREFERENCE_STORAGE_KEY,
    JSON.stringify({
      preference: normalizeTripSyncPreference(record.preference),
      updatedAt: record.updatedAt,
      version: 1,
    }),
  );
}

export async function clearLocalTripSyncPreference(): Promise<void> {
  const storage = await getTripSyncPreferenceStorageAdapter();

  if (storage.removeItem) {
    await storage.removeItem(TRIP_SYNC_PREFERENCE_STORAGE_KEY);
    return;
  }

  await storage.setItem(
    TRIP_SYNC_PREFERENCE_STORAGE_KEY,
    JSON.stringify({
      preference: defaultTripSyncPreference,
      version: 1,
    }),
  );
}

export async function getTripSyncPreference(): Promise<TripSyncPreference> {
  return (await readTripSyncPreferenceRecordFromLocal()).preference;
}

export async function saveTripSyncPreference(
  preference: TripSyncPreference,
): Promise<void> {
  await saveTripSyncPreferenceRecordToLocal({
    preference: normalizeTripSyncPreference(preference),
    updatedAt: new Date().toISOString(),
    version: 1,
  });
}

export function getTripSyncNetworkPolicyLabel(
  policy: TripSyncNetworkPolicy,
): string {
  return policy === "wifiOnly" ? "仅 Wi-Fi" : "Wi-Fi 与流量都允许";
}

export function canRunCloudSyncOnNetwork(
  preference: TripSyncPreference,
  networkState: TripSyncNetworkState,
): boolean {
  if (networkState === "offline") {
    return false;
  }

  if (preference.networkPolicy === "wifiAndCellular") {
    return true;
  }

  return networkState === "wifi" || networkState === "unknown";
}
