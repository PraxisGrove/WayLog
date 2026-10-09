import type { CloudSyncSession } from "./cloud-sync";
import {
  fetchCloudPreferenceRow,
  upsertCloudPreferenceRow,
} from "./cloud-sync";
import type { TripRouteMode, TripRouteModeOption } from "./route-segments";
import {
  createPreferenceSync,
  type PreferenceCloudAdapter,
  type PreferenceStorageAdapter,
} from "./unified-preferences";

export const TRIP_ROUTE_PREFERENCE_STORAGE_KEY = "waylog.preferences.route.v1";

export type TripRoutePreferredMode = "auto" | TripRouteMode;

export type TripRoutePreference = {
  allowEstimatedRoutes: boolean;
  preferredMode: TripRoutePreferredMode;
};

export const defaultTripRoutePreference: TripRoutePreference = {
  allowEstimatedRoutes: true,
  preferredMode: "auto",
};

const AUTO_WALKING_MAX_DISTANCE_KM = 2.5;
const AUTO_WALKING_MAX_DURATION_MINUTES = 45;
const preferredModes: TripRoutePreferredMode[] = [
  "auto",
  "walking",
  "cycling",
  "transit",
  "driving",
];

function isTripRoutePreferredMode(
  value: unknown,
): value is TripRoutePreferredMode {
  return (
    typeof value === "string" &&
    preferredModes.includes(value as TripRoutePreferredMode)
  );
}

export function normalizeTripRoutePreference(
  value: unknown,
): TripRoutePreference {
  if (typeof value !== "object" || value === null) {
    return defaultTripRoutePreference;
  }

  const source = value as Record<string, unknown>;

  return {
    allowEstimatedRoutes:
      typeof source.allowEstimatedRoutes === "boolean"
        ? source.allowEstimatedRoutes
        : defaultTripRoutePreference.allowEstimatedRoutes,
    preferredMode: isTripRoutePreferredMode(source.preferredMode)
      ? source.preferredMode
      : defaultTripRoutePreference.preferredMode,
  };
}

const routePreferenceSync = createPreferenceSync<TripRoutePreference>({
  storageKey: TRIP_ROUTE_PREFERENCE_STORAGE_KEY,
  defaultValue: defaultTripRoutePreference,
  normalize: normalizeTripRoutePreference,
  fetchCloudRow: (session: CloudSyncSession) =>
    fetchCloudPreferenceRow(session, "route"),
  upsertCloudRow: (
    session: CloudSyncSession,
    preference: TripRoutePreference,
  ) => upsertCloudPreferenceRow(session, "route", preference),
});

export function setTripRoutePreferenceStorageAdapterForTests(
  adapter: PreferenceStorageAdapter | null,
): void {
  routePreferenceSync.setStorageAdapterForTests(adapter);
}

export function setTripRoutePreferenceCloudAdapterForTests(
  adapter: PreferenceCloudAdapter | null,
): void {
  routePreferenceSync.setCloudAdapterForTests(adapter);
}

export async function clearLocalTripRoutePreference(): Promise<void> {
  await routePreferenceSync.clear();
}

export async function hasLocalGuestTripRoutePreferenceData(): Promise<boolean> {
  return routePreferenceSync.hasGuestData();
}

export async function syncTripRoutePreferenceWithCloud(): Promise<TripRoutePreference> {
  return routePreferenceSync.sync();
}

export async function getTripRoutePreference(): Promise<TripRoutePreference> {
  return routePreferenceSync.get();
}

export async function saveTripRoutePreference(
  preference: TripRoutePreference,
): Promise<void> {
  await routePreferenceSync.save(preference);
}

function canUseRouteOption(
  option: TripRouteModeOption,
  preference: TripRoutePreference,
): boolean {
  return preference.allowEstimatedRoutes || option.source !== "estimated";
}

function isShortWalkingOption(option: TripRouteModeOption): boolean {
  return (
    option.mode === "walking" &&
    (option.distanceKm <= AUTO_WALKING_MAX_DISTANCE_KM ||
      option.durationMinutes <= AUTO_WALKING_MAX_DURATION_MINUTES)
  );
}

function hasRouteGeometry(option: TripRouteModeOption): boolean {
  return Array.isArray(option.polyline) && option.polyline.length >= 2;
}

export function getPreferredTripRouteMode(
  options: TripRouteModeOption[],
  preference: TripRoutePreference,
): TripRouteMode | undefined {
  if (options.length === 0) {
    return undefined;
  }

  const usableOptions = options.filter((option) =>
    canUseRouteOption(option, preference),
  );
  const fallbackOptions = usableOptions.length > 0 ? usableOptions : options;

  if (preference.preferredMode !== "auto") {
    const preferredOption = fallbackOptions.find(
      (option) => option.mode === preference.preferredMode,
    );

    if (preferredOption) {
      return preferredOption.mode;
    }
  }

  const preciseGeometryOptions = fallbackOptions.filter(
    (option) => option.source === "amap" && hasRouteGeometry(option),
  );
  const geometryAwareOptions =
    preciseGeometryOptions.length > 0
      ? preciseGeometryOptions
      : fallbackOptions;

  const walkingOption = geometryAwareOptions.find(isShortWalkingOption);

  if (walkingOption) {
    return walkingOption.mode;
  }

  return (
    geometryAwareOptions.find((option) => option.mode !== "transit")?.mode ??
    geometryAwareOptions[0]?.mode
  );
}
