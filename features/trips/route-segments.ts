import { createDiagnosticLogger } from "../diagnostics";
import { createLocalDbKeyValueStorageAdapter } from "../local-db";
import { buildAmapDirectionsUrl, queryAmapRoute } from "./amap";
import { getPlaceForTripDayItem } from "./day-items";
import { getSortedTripDayItems } from "./format";
import { searchPlaceSuggestions } from "./place-search";
import type { Trip, TripDay, TripDayItem, TripPlace } from "./types";

const routeSegmentLogger = createDiagnosticLogger("route-segments");

export type TripRouteMode = "driving" | "cycling" | "walking" | "transit";

export type TripRouteModeOption = {
  distanceKm: number;
  durationMinutes: number;
  label: string;
  mode: TripRouteMode;
  polyline?: TripRouteCoordinates[];
  source: "amap" | "estimated";
};

export type TripRouteModeFetchState = {
  errorMessage?: string;
  mode: TripRouteMode;
  reason: "auto" | "user";
  status: "ready" | "unavailable";
  updatedAt: string;
};

export type TripRouteCoordinates = {
  latitude: number;
  longitude: number;
};

export type TripRouteSegmentSnapshot = {
  cacheKey: string;
  fromCoordinates?: TripRouteCoordinates;
  fromLabel: string;
  fromQuery: string;
  fromRouteCity?: string;
  fromSignature: string;
  toCoordinates?: TripRouteCoordinates;
  toLabel: string;
  toQuery: string;
  toRouteCity?: string;
  toSignature: string;
};

export type TripDayRouteSegment = {
  fromItem: TripDayItem;
  fromPlace?: TripPlace;
  id: string;
  snapshot: TripRouteSegmentSnapshot;
  toItem: TripDayItem;
  toPlace?: TripPlace;
};

export type TripRouteSegmentCacheEntry = {
  errorMessage?: string;
  diagnosticMessage?: string;
  fromCoordinates?: TripRouteCoordinates;
  fromLabel: string;
  fromQuery: string;
  fromSignature: string;
  modeOptions: TripRouteModeOption[];
  modeFetchState?: Partial<Record<TripRouteMode, TripRouteModeFetchState>>;
  provider: "amap";
  status: "ready" | "unavailable";
  toCoordinates?: TripRouteCoordinates;
  toLabel: string;
  toQuery: string;
  toSignature: string;
  updatedAt: string;
};

export type TripRouteSegmentResult = {
  cached: boolean;
  entry: TripRouteSegmentCacheEntry;
};

export type TripRouteSegmentFetchPlanItem = {
  fetchKey: string;
  selectedMode?: TripRouteMode;
  segment: TripDayRouteSegment;
};

export type TripRouteSegmentFetchPlan = {
  nextFetchSnapshots: Record<string, string>;
  removedSegmentIds: string[];
  retainedResults: Record<string, TripRouteSegmentResult>;
  segmentsToFetch: TripRouteSegmentFetchPlanItem[];
};

export type CreateTripRouteSegmentFetchPlanInput = {
  currentResults: Record<string, TripRouteSegmentResult>;
  previousFetchSnapshots: Record<string, string>;
  routeSegmentModes: Record<string, TripRouteMode | undefined>;
  segments: TripDayRouteSegment[];
};

export type GetRouteSegmentWithCacheOptions = {
  forceRefresh?: boolean;
  mode?: TripRouteMode;
  reason?: "auto" | "user";
};

type TripRoutePoint = {
  coordinates?: TripRouteCoordinates;
  label: string;
  query: string;
  routeCity?: string;
  signature: string;
};

export type RouteCacheStore = {
  entries: Record<string, TripRouteSegmentCacheEntry>;
  geocodes: Record<string, TripRouteGeocodeCacheEntry>;
  version: 14;
};

export type TripRouteGeocodeCacheEntry = {
  coordinates?: TripRouteCoordinates;
  provider: "amap";
  query: string;
  routeCity?: string;
  status: "ready" | "unavailable";
  updatedAt: string;
};

export type RouteCacheStorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  removeItem?: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

export const ROUTE_CACHE_STORAGE_KEY = "waylog.trip_route_segments.v14";
const ROUTE_CACHE_UNAVAILABLE_TTL_MS = 15 * 60 * 1000;
const ROUTE_GEOCODE_UNAVAILABLE_TTL_MS = 60 * 60 * 1000;
const AMAP_ROUTE_REQUEST_INTERVAL_MS = 160;
const routeModeLabelMap: Record<TripRouteMode, string> = {
  driving: "驾车",
  cycling: "骑行",
  walking: "步行",
  transit: "公共交通",
};

const routeModeFallbackSpeedKmhMap: Record<TripRouteMode, number> = {
  driving: 68,
  cycling: 16,
  walking: 4.8,
  transit: 28,
};

const routeModeDistanceFactorMap: Record<TripRouteMode, number> = {
  driving: 1.25,
  cycling: 1.2,
  transit: 1.4,
  walking: 1.15,
};

const AUTO_ROUTE_WALKING_MAX_DISTANCE_KM = 1.5;
const AUTO_ROUTE_CYCLING_MAX_DISTANCE_KM = 8;
const AUTO_ROUTE_DRIVING_MAX_DISTANCE_KM = 80;

let routeCacheStore: RouteCacheStore | null = null;
let routeCacheLoadPromise: Promise<RouteCacheStore> | null = null;
let routeCacheSaveQueue = Promise.resolve();
let routeCacheStorageAdapter: RouteCacheStorageAdapter | null = null;
let routeCacheStorageAdapterPromise: Promise<RouteCacheStorageAdapter> | null =
  null;
const geocodeCoordinatesCache = new Map<string, TripRouteGeocodeCacheEntry>();
let amapRouteRequestQueue = Promise.resolve<unknown>(undefined);
let lastAmapRouteRequestStartedAt = 0;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeText(value?: string): string {
  return value?.trim() ?? "";
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function formatCoordinateValue(value: number): string {
  return value.toFixed(6);
}

function hasCoordinates(
  place?: TripPlace,
): place is TripPlace & TripRouteCoordinates {
  return Boolean(
    place && isFiniteNumber(place.latitude) && isFiniteNumber(place.longitude),
  );
}

function getTripRouteCoordinates(
  place?: TripPlace,
): TripRouteCoordinates | undefined {
  if (!hasCoordinates(place)) {
    return undefined;
  }

  return {
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

function getTripRouteCityNameFromText(value?: string): string | undefined {
  const normalizedArea = normalizeText(value);
  const cityMatch = normalizedArea.match(/[^省市区县\s·,，、/]+市/);

  return cityMatch?.[0];
}

function getTripRouteCity(place?: TripPlace): string | undefined {
  return (
    normalizeText(place?.externalRefs?.amapCityName) ||
    normalizeText(place?.externalRefs?.amapCitycode) ||
    getTripRouteCityNameFromText(place?.area) ||
    getTripRouteCityNameFromText(place?.address) ||
    normalizeText(place?.externalRefs?.amapAdcode) ||
    undefined
  );
}

function buildRoutePoint(item: TripDayItem, place?: TripPlace): TripRoutePoint {
  const label =
    normalizeText(place?.name) ||
    normalizeText(item.placeName) ||
    normalizeText(item.title) ||
    "未命名地点";
  const query = [label, place?.address, place?.area].filter(Boolean).join(" ");
  const coordinates = getTripRouteCoordinates(place);
  const routeCity = getTripRouteCity(place);
  const signature = [
    normalizeText(place?.id),
    label,
    normalizeText(place?.address),
    normalizeText(place?.area),
    routeCity ?? "",
    coordinates ? formatCoordinateValue(coordinates.latitude) : "",
    coordinates ? formatCoordinateValue(coordinates.longitude) : "",
  ].join("|");

  return {
    label,
    query: query || label,
    routeCity,
    signature,
    coordinates,
  };
}

function hashText(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return (hash >>> 0).toString(36);
}

function createRouteCacheKey(
  fromSignature: string,
  toSignature: string,
): string {
  const primaryHash = hashText(`${fromSignature}=>${toSignature}`);
  const reverseHash = hashText(`${toSignature}=>${fromSignature}`);
  return `amap-v14-${primaryHash}-${reverseHash}`;
}

function normalizeTripRouteMode(value: unknown): TripRouteMode | undefined {
  return value === "driving" ||
    value === "cycling" ||
    value === "walking" ||
    value === "transit"
    ? value
    : undefined;
}

function normalizeTripRouteCoordinates(
  value: unknown,
): TripRouteCoordinates | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const latitude = source.latitude;
  const longitude = source.longitude;

  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    return undefined;
  }

  return {
    latitude,
    longitude,
  };
}

function normalizeTripRoutePolyline(
  value: unknown,
): TripRouteCoordinates[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const polyline = value
    .map((item) => normalizeTripRouteCoordinates(item))
    .filter((item): item is TripRouteCoordinates => Boolean(item));

  return polyline.length >= 2 ? polyline : undefined;
}

function createEmptyRouteCacheStore(): RouteCacheStore {
  return {
    version: 14,
    entries: {},
    geocodes: {},
  };
}

function normalizeModeOptions(value: unknown): TripRouteModeOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .map((item): TripRouteModeOption | null => {
      const mode = normalizeTripRouteMode(item.mode);
      const distanceKm = item.distanceKm;
      const durationMinutes = item.durationMinutes;

      if (
        !mode ||
        !isFiniteNumber(distanceKm) ||
        !isFiniteNumber(durationMinutes)
      ) {
        return null;
      }

      const option: TripRouteModeOption = {
        mode,
        label:
          normalizeText(asOptionalString(item.label)) ||
          getTripRouteModeLabel(mode),
        distanceKm,
        durationMinutes,
        source: item.source === "estimated" ? "estimated" : "amap",
      };

      const polyline = normalizeTripRoutePolyline(item.polyline);

      if (polyline) {
        option.polyline = polyline;
      }

      return option;
    })
    .filter((item): item is TripRouteModeOption => Boolean(item));
}

function normalizeModeFetchState(
  value: unknown,
): TripRouteModeFetchState | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const mode = normalizeTripRouteMode(source.mode);
  const status =
    source.status === "ready" || source.status === "unavailable"
      ? source.status
      : undefined;

  if (!mode || !status) {
    return undefined;
  }

  return {
    mode,
    status,
    reason: source.reason === "user" ? "user" : "auto",
    errorMessage:
      normalizeText(asOptionalString(source.errorMessage)) || undefined,
    updatedAt:
      normalizeText(asOptionalString(source.updatedAt)) ||
      new Date().toISOString(),
  };
}

function normalizeModeFetchStateMap(
  value: unknown,
): Partial<Record<TripRouteMode, TripRouteModeFetchState>> | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const normalized = Object.values(value as Record<string, unknown>).reduce<
    Partial<Record<TripRouteMode, TripRouteModeFetchState>>
  >((current, rawState) => {
    const state = normalizeModeFetchState(rawState);

    if (state) {
      current[state.mode] = state;
    }

    return current;
  }, {});

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeGeocodeCacheEntry(
  value: unknown,
): TripRouteGeocodeCacheEntry | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const status =
    source.status === "ready" || source.status === "unavailable"
      ? source.status
      : undefined;

  if (!status) {
    return undefined;
  }

  return {
    status,
    provider: "amap",
    query: normalizeText(asOptionalString(source.query)),
    routeCity: normalizeText(asOptionalString(source.routeCity)) || undefined,
    coordinates: normalizeTripRouteCoordinates(source.coordinates),
    updatedAt:
      normalizeText(
        typeof source.updatedAt === "string" ? source.updatedAt : undefined,
      ) || new Date().toISOString(),
  };
}

function normalizeCacheEntry(
  value: unknown,
): TripRouteSegmentCacheEntry | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const status =
    source.status === "ready" || source.status === "unavailable"
      ? source.status
      : undefined;

  if (!status) {
    return undefined;
  }

  return {
    status,
    provider: "amap",
    fromSignature: normalizeText(asOptionalString(source.fromSignature)),
    toSignature: normalizeText(asOptionalString(source.toSignature)),
    fromLabel: normalizeText(asOptionalString(source.fromLabel)),
    toLabel: normalizeText(asOptionalString(source.toLabel)),
    fromQuery: normalizeText(asOptionalString(source.fromQuery)),
    toQuery: normalizeText(asOptionalString(source.toQuery)),
    fromCoordinates: normalizeTripRouteCoordinates(source.fromCoordinates),
    toCoordinates: normalizeTripRouteCoordinates(source.toCoordinates),
    modeOptions: normalizeModeOptions(source.modeOptions),
    modeFetchState: normalizeModeFetchStateMap(source.modeFetchState),
    errorMessage:
      normalizeText(
        typeof source.errorMessage === "string"
          ? source.errorMessage
          : undefined,
      ) || undefined,
    diagnosticMessage:
      normalizeText(
        typeof source.diagnosticMessage === "string"
          ? source.diagnosticMessage
          : undefined,
      ) || undefined,
    updatedAt:
      normalizeText(
        typeof source.updatedAt === "string" ? source.updatedAt : undefined,
      ) || new Date().toISOString(),
  };
}

function normalizeRouteCacheStore(value: unknown): RouteCacheStore {
  if (typeof value !== "object" || value === null) {
    return createEmptyRouteCacheStore();
  }

  const source = value as Record<string, unknown>;
  const rawEntries = source.entries;
  const rawGeocodes = source.geocodes;
  const entries =
    typeof rawEntries === "object" && rawEntries !== null
      ? Object.entries(rawEntries as Record<string, unknown>).reduce<
          Record<string, TripRouteSegmentCacheEntry>
        >((current, [key, rawEntry]) => {
          const normalizedEntry = normalizeCacheEntry(rawEntry);

          if (!normalizedEntry) {
            return current;
          }

          current[key] = normalizedEntry;
          return current;
        }, {})
      : {};
  const geocodes =
    typeof rawGeocodes === "object" && rawGeocodes !== null
      ? Object.entries(rawGeocodes as Record<string, unknown>).reduce<
          Record<string, TripRouteGeocodeCacheEntry>
        >((current, [key, rawEntry]) => {
          const normalizedEntry = normalizeGeocodeCacheEntry(rawEntry);

          if (!normalizedEntry) {
            return current;
          }

          current[key] = normalizedEntry;
          return current;
        }, {})
      : {};

  return {
    version: 14,
    entries,
    geocodes,
  };
}

function getCacheEntryAgeMs(entry: { updatedAt: string }): number {
  const updatedAtTime = new Date(entry.updatedAt).getTime();

  if (!Number.isFinite(updatedAtTime)) {
    return Number.POSITIVE_INFINITY;
  }

  return Date.now() - updatedAtTime;
}

function isCacheEntryFresh(
  entry: { updatedAt: string },
  ttlMs: number,
): boolean {
  return getCacheEntryAgeMs(entry) <= ttlMs;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function enqueueAmapRouteRequest<T>(task: () => Promise<T>): Promise<T> {
  const queuedTask = amapRouteRequestQueue
    .catch(() => undefined)
    .then(async () => {
      const elapsedMs = Date.now() - lastAmapRouteRequestStartedAt;
      const waitMs = Math.max(0, AMAP_ROUTE_REQUEST_INTERVAL_MS - elapsedMs);

      if (waitMs > 0) {
        await delay(waitMs);
      }

      lastAmapRouteRequestStartedAt = Date.now();
      return await task();
    });

  amapRouteRequestQueue = queuedTask;
  return queuedTask;
}

function isEstimatedOnlyRouteEntry(entry: TripRouteSegmentCacheEntry): boolean {
  return (
    entry.modeOptions.length > 0 &&
    entry.modeOptions.every((option) => option.source === "estimated")
  );
}

function hasDrawableRouteGeometryEntry(
  entry: TripRouteSegmentCacheEntry,
): boolean {
  return entry.modeOptions.some(
    (option) => Array.isArray(option.polyline) && option.polyline.length >= 2,
  );
}

function canReuseRouteModeCacheEntry(
  entry: TripRouteSegmentCacheEntry,
  mode: TripRouteMode,
): boolean {
  const option = entry.modeOptions.find((item) => item.mode === mode);

  if (
    option?.source === "amap" &&
    Array.isArray(option.polyline) &&
    option.polyline.length >= 2
  ) {
    return true;
  }

  const modeState = entry.modeFetchState?.[mode];

  if (!modeState) {
    return false;
  }

  if (modeState.status === "ready" && option?.source === "amap") {
    return true;
  }

  return isCacheEntryFresh(modeState, ROUTE_CACHE_UNAVAILABLE_TTL_MS);
}

function canReuseRouteCacheEntry(
  entry: TripRouteSegmentCacheEntry,
  snapshot: TripRouteSegmentSnapshot,
  requestedMode?: TripRouteMode,
): boolean {
  if (
    entry.fromSignature !== snapshot.fromSignature ||
    entry.toSignature !== snapshot.toSignature
  ) {
    return false;
  }

  if (requestedMode) {
    return canReuseRouteModeCacheEntry(entry, requestedMode);
  }

  if (entry.status === "ready") {
    if (entry.modeOptions.length === 0) {
      return false;
    }

    if (isEstimatedOnlyRouteEntry(entry)) {
      return isCacheEntryFresh(entry, ROUTE_CACHE_UNAVAILABLE_TTL_MS);
    }

    return hasDrawableRouteGeometryEntry(entry);
  }

  return isCacheEntryFresh(entry, ROUTE_CACHE_UNAVAILABLE_TTL_MS);
}

async function loadDefaultRouteCacheStorageAdapter(): Promise<RouteCacheStorageAdapter> {
  return createLocalDbKeyValueStorageAdapter("trip-route-cache");
}

async function getRouteCacheStorageAdapter(): Promise<RouteCacheStorageAdapter> {
  if (routeCacheStorageAdapter) {
    return routeCacheStorageAdapter;
  }

  if (!routeCacheStorageAdapterPromise) {
    routeCacheStorageAdapterPromise = loadDefaultRouteCacheStorageAdapter();
  }

  routeCacheStorageAdapter = await routeCacheStorageAdapterPromise;
  return routeCacheStorageAdapter;
}

async function readRouteCacheRaw(): Promise<string | null> {
  try {
    const storage = await getRouteCacheStorageAdapter();
    return await storage.getItem(ROUTE_CACHE_STORAGE_KEY);
  } catch (error) {
    routeSegmentLogger.warn(
      "cache.storage.read.failed",
      { error },
      "Failed to read route cache fallback storage",
    );
    return null;
  }
}

async function writeRouteCacheRaw(raw: string): Promise<void> {
  try {
    const storage = await getRouteCacheStorageAdapter();
    await storage.setItem(ROUTE_CACHE_STORAGE_KEY, raw);
  } catch (error) {
    routeSegmentLogger.warn(
      "cache.storage.write.failed",
      { error },
      "Failed to write route cache fallback storage",
    );
  }
}

async function loadRouteCacheStore(): Promise<RouteCacheStore> {
  if (routeCacheStore) {
    return routeCacheStore;
  }

  if (!routeCacheLoadPromise) {
    routeCacheLoadPromise = (async () => {
      const raw = await readRouteCacheRaw();

      if (!raw) {
        routeCacheStore = createEmptyRouteCacheStore();
        return routeCacheStore;
      }

      try {
        const parsed = JSON.parse(raw);
        routeCacheStore = normalizeRouteCacheStore(parsed);
        return routeCacheStore;
      } catch (error) {
        routeSegmentLogger.warn(
          "cache.parse.failed",
          { error },
          "Failed to parse route cache store",
        );
        routeCacheStore = createEmptyRouteCacheStore();
        return routeCacheStore;
      }
    })();
  }

  return routeCacheLoadPromise;
}

async function saveRouteCacheStore(): Promise<void> {
  if (!routeCacheStore) {
    return;
  }

  const raw = JSON.stringify(routeCacheStore);
  routeCacheSaveQueue = routeCacheSaveQueue
    .then(() => writeRouteCacheRaw(raw))
    .catch((error) => {
      routeSegmentLogger.warn(
        "cache.persist.failed",
        { error },
        "Failed to persist route cache store",
      );
    });
  await routeCacheSaveQueue;
}

function getHaversineDistanceKm(
  fromCoordinates: TripRouteCoordinates,
  toCoordinates: TripRouteCoordinates,
): number {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(
    toCoordinates.latitude - fromCoordinates.latitude,
  );
  const longitudeDelta = toRadians(
    toCoordinates.longitude - fromCoordinates.longitude,
  );
  const fromLatitude = toRadians(fromCoordinates.latitude);
  const toLatitude = toRadians(toCoordinates.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    earthRadiusKm *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function createEstimatedModeOption(
  mode: TripRouteMode,
  directDistanceKm: number,
): TripRouteModeOption {
  const distanceKm = Number(
    (directDistanceKm * routeModeDistanceFactorMap[mode]).toFixed(
      directDistanceKm >= 100 ? 0 : 2,
    ),
  );
  const durationMinutes = Math.max(
    1,
    Math.round((distanceKm / routeModeFallbackSpeedKmhMap[mode]) * 60),
  );

  return {
    mode,
    label: getTripRouteModeLabel(mode),
    distanceKm,
    durationMinutes,
    source: "estimated",
  };
}

export function getAutoTripRouteModeForDistance(
  distanceKm: number,
): TripRouteMode {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return "driving";
  }

  if (distanceKm <= AUTO_ROUTE_WALKING_MAX_DISTANCE_KM) {
    return "walking";
  }

  if (distanceKm <= AUTO_ROUTE_CYCLING_MAX_DISTANCE_KM) {
    return "cycling";
  }

  if (distanceKm <= AUTO_ROUTE_DRIVING_MAX_DISTANCE_KM) {
    return "driving";
  }

  return "transit";
}

function normalizeRouteModeOptions(
  options: TripRouteModeOption[],
): TripRouteModeOption[] {
  const optionMap = new Map<TripRouteMode, TripRouteModeOption>();

  options.forEach((option) => {
    optionMap.set(option.mode, option);
  });

  return Array.from(optionMap.values()).sort((left, right) => {
    if (left.mode === "transit" && right.mode !== "transit") return 1;
    if (left.mode !== "transit" && right.mode === "transit") return -1;
    return left.durationMinutes - right.durationMinutes;
  });
}

function createRouteCacheEntry(
  snapshot: TripRouteSegmentSnapshot,
  options: {
    diagnosticMessage?: string;
    errorMessage?: string;
    fromCoordinates?: TripRouteCoordinates;
    modeFetchState?: Partial<Record<TripRouteMode, TripRouteModeFetchState>>;
    modeOptions?: TripRouteModeOption[];
    status?: TripRouteSegmentCacheEntry["status"];
    toCoordinates?: TripRouteCoordinates;
    updatedAt?: string;
  } = {},
): TripRouteSegmentCacheEntry {
  return {
    status: options.status ?? "ready",
    provider: "amap",
    fromSignature: snapshot.fromSignature,
    toSignature: snapshot.toSignature,
    fromLabel: snapshot.fromLabel,
    toLabel: snapshot.toLabel,
    fromQuery: snapshot.fromQuery,
    toQuery: snapshot.toQuery,
    fromCoordinates: options.fromCoordinates,
    toCoordinates: options.toCoordinates,
    modeOptions: normalizeRouteModeOptions(options.modeOptions ?? []),
    modeFetchState: options.modeFetchState,
    errorMessage: options.errorMessage,
    diagnosticMessage: options.diagnosticMessage,
    updatedAt: options.updatedAt ?? new Date().toISOString(),
  };
}

function getCachedRouteDistanceKm(
  snapshot: TripRouteSegmentSnapshot,
  entry?: TripRouteSegmentCacheEntry,
): number | undefined {
  const fromCoordinates = snapshot.fromCoordinates ?? entry?.fromCoordinates;
  const toCoordinates = snapshot.toCoordinates ?? entry?.toCoordinates;

  return fromCoordinates && toCoordinates
    ? getHaversineDistanceKm(fromCoordinates, toCoordinates)
    : undefined;
}

function getAutoRouteModeForSnapshot(
  snapshot: TripRouteSegmentSnapshot,
  entry?: TripRouteSegmentCacheEntry,
): TripRouteMode | undefined {
  const distanceKm = getCachedRouteDistanceKm(snapshot, entry);
  return distanceKm === undefined
    ? undefined
    : getAutoTripRouteModeForDistance(distanceKm);
}

function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    const message = normalizeText(error.message);
    return message || undefined;
  }

  if (typeof error === "string") {
    const message = normalizeText(error);
    return message || undefined;
  }

  return undefined;
}

function createRouteGeocodeCacheKey(point: TripRoutePoint): string {
  return hashText(
    [
      point.signature,
      normalizeText(point.query).toLocaleLowerCase(),
      point.routeCity ?? "",
    ].join("|"),
  );
}

function canReuseRouteGeocodeCacheEntry(
  entry: TripRouteGeocodeCacheEntry,
): boolean {
  if (entry.status === "ready") {
    return Boolean(entry.coordinates);
  }

  return isCacheEntryFresh(entry, ROUTE_GEOCODE_UNAVAILABLE_TTL_MS);
}

async function resolveRouteCoordinatesFromRemote(
  point: TripRoutePoint,
): Promise<TripRouteGeocodeCacheEntry> {
  try {
    const suggestions = await searchPlaceSuggestions(point.query, undefined, {
      regionText: point.routeCity,
    });
    const suggestion = suggestions.find(
      (item) => isFiniteNumber(item.latitude) && isFiniteNumber(item.longitude),
    );
    const latitude = suggestion?.latitude;
    const longitude = suggestion?.longitude;
    const resolvedCoordinates =
      suggestion && isFiniteNumber(latitude) && isFiniteNumber(longitude)
        ? {
            latitude,
            longitude,
          }
        : undefined;

    return {
      status: resolvedCoordinates ? "ready" : "unavailable",
      provider: "amap",
      query: point.query,
      routeCity: point.routeCity,
      coordinates: resolvedCoordinates,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    routeSegmentLogger.warn(
      "coordinates.resolve.failed",
      {
        error,
        query: point.query,
        routeCity: point.routeCity,
      },
      "Failed to resolve route segment coordinates",
    );

    return {
      status: "unavailable",
      provider: "amap",
      query: point.query,
      routeCity: point.routeCity,
      updatedAt: new Date().toISOString(),
    };
  }
}

async function resolveRouteCoordinates(
  point: TripRoutePoint,
): Promise<TripRouteCoordinates | undefined> {
  if (point.coordinates) {
    return point.coordinates;
  }

  const store = await loadRouteCacheStore();
  const geocodeKey = createRouteGeocodeCacheKey(point);
  const memoryCachedEntry = geocodeCoordinatesCache.get(geocodeKey);

  if (memoryCachedEntry && canReuseRouteGeocodeCacheEntry(memoryCachedEntry)) {
    return memoryCachedEntry.coordinates;
  }

  const persistedCachedEntry = store.geocodes[geocodeKey];

  if (
    persistedCachedEntry &&
    canReuseRouteGeocodeCacheEntry(persistedCachedEntry)
  ) {
    geocodeCoordinatesCache.set(geocodeKey, persistedCachedEntry);
    return persistedCachedEntry.coordinates;
  }

  const nextEntry = await resolveRouteCoordinatesFromRemote(point);
  geocodeCoordinatesCache.set(geocodeKey, nextEntry);
  store.geocodes[geocodeKey] = nextEntry;
  await saveRouteCacheStore();

  return nextEntry.coordinates;
}

async function queryAmapModeOption(
  mode: TripRouteMode,
  fromCoordinates: TripRouteCoordinates,
  toCoordinates: TripRouteCoordinates,
  options: {
    fromRouteCity?: string;
    toRouteCity?: string;
  } = {},
): Promise<TripRouteModeOption | undefined> {
  const route = await enqueueAmapRouteRequest(() =>
    queryAmapRoute(mode, fromCoordinates, toCoordinates, {
      originCity: options.fromRouteCity,
      destinationCity: options.toRouteCity,
    }),
  );

  if (route) {
    return {
      mode,
      label: getTripRouteModeLabel(mode),
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      polyline: route.polyline,
      source: "amap",
    };
  }

  return undefined;
}

async function resolveRouteSegmentCoordinates(
  snapshot: TripRouteSegmentSnapshot,
): Promise<{
  fromCoordinates?: TripRouteCoordinates;
  toCoordinates?: TripRouteCoordinates;
}> {
  const fromCoordinates = await resolveRouteCoordinates({
    label: snapshot.fromLabel,
    query: snapshot.fromQuery,
    signature: snapshot.fromSignature,
    routeCity: snapshot.fromRouteCity,
    coordinates: snapshot.fromCoordinates,
  });
  const toCoordinates = await resolveRouteCoordinates({
    label: snapshot.toLabel,
    query: snapshot.toQuery,
    signature: snapshot.toSignature,
    routeCity: snapshot.toRouteCity,
    coordinates: snapshot.toCoordinates,
  });

  return {
    fromCoordinates,
    toCoordinates,
  };
}

async function queryRouteSegment(
  snapshot: TripRouteSegmentSnapshot,
  options: {
    existingEntry?: TripRouteSegmentCacheEntry;
    mode?: TripRouteMode;
    reason?: "auto" | "user";
  } = {},
): Promise<TripRouteSegmentCacheEntry> {
  const { fromCoordinates, toCoordinates } =
    await resolveRouteSegmentCoordinates(snapshot);
  const now = new Date().toISOString();
  const existingEntry = options.existingEntry;
  const existingModeOptions = existingEntry?.modeOptions ?? [];
  const existingModeFetchState = existingEntry?.modeFetchState ?? {};

  if (!fromCoordinates || !toCoordinates) {
    return createRouteCacheEntry(snapshot, {
      status: "unavailable",
      fromCoordinates,
      toCoordinates,
      modeOptions: existingModeOptions,
      modeFetchState: existingModeFetchState,
      errorMessage: "缺少可用坐标，暂时无法查询交通方式",
      updatedAt: now,
    });
  }

  const directDistanceKm = getHaversineDistanceKm(
    fromCoordinates,
    toCoordinates,
  );
  const mode =
    options.mode ?? getAutoTripRouteModeForDistance(directDistanceKm);
  let queriedOption: TripRouteModeOption | undefined;
  let failedMessage: string | undefined;

  try {
    queriedOption = await queryAmapModeOption(
      mode,
      fromCoordinates,
      toCoordinates,
      {
        fromRouteCity: snapshot.fromRouteCity,
        toRouteCity: snapshot.toRouteCity,
      },
    );
  } catch (error) {
    routeSegmentLogger.warn(
      "amap.query.failed",
      { error, mode },
      "Failed to query route segment from Amap",
    );
    failedMessage = getErrorMessage(error);
  }

  const nextOption =
    queriedOption ?? createEstimatedModeOption(mode, directDistanceKm);
  const nextModeFetchState: TripRouteModeFetchState = {
    mode,
    status: queriedOption ? "ready" : "unavailable",
    reason: options.reason ?? "auto",
    errorMessage: failedMessage,
    updatedAt: now,
  };
  const modeOptions = normalizeRouteModeOptions([
    ...existingModeOptions,
    nextOption,
  ]);
  const modeFetchState = {
    ...existingModeFetchState,
    [mode]: nextModeFetchState,
  };

  if (modeOptions.length === 0) {
    return createRouteCacheEntry(snapshot, {
      status: "unavailable",
      fromCoordinates,
      toCoordinates,
      modeFetchState,
      errorMessage: "暂时没有查询到可用路线",
      updatedAt: now,
    });
  }

  const failedModeMessages = Object.values(modeFetchState)
    .filter((state): state is TripRouteModeFetchState =>
      Boolean(state?.errorMessage),
    )
    .map(
      (state) => `${getTripRouteModeLabel(state.mode)}: ${state.errorMessage}`,
    );
  const latestErrorMessage = queriedOption
    ? failedModeMessages.length > 0
      ? `部分路线模式暂未返回道路路线，已按直线距离估算。${failedModeMessages.join("；")}`
      : undefined
    : failedMessage
      ? `当前${getTripRouteModeLabel(mode)}高德暂未返回道路路线，已按直线距离估算。${failedMessage}`
      : `当前${getTripRouteModeLabel(mode)}高德暂未返回道路路线，已按直线距离估算`;

  return createRouteCacheEntry(snapshot, {
    status: "ready",
    fromCoordinates,
    toCoordinates,
    modeOptions,
    modeFetchState,
    errorMessage: latestErrorMessage,
    diagnosticMessage:
      failedModeMessages.length > 0 ? failedModeMessages.join("；") : undefined,
    updatedAt: now,
  });
}
export function getTripRouteModeLabel(mode: TripRouteMode): string {
  return routeModeLabelMap[mode] ?? "出行";
}

export function buildTripDayRouteSegments(
  trip: Trip,
  day: TripDay,
): TripDayRouteSegment[] {
  const sortedItems = getSortedTripDayItems(day.items);
  const segments: TripDayRouteSegment[] = [];

  for (let index = 0; index < sortedItems.length - 1; index += 1) {
    const fromItem = sortedItems[index];
    const toItem = sortedItems[index + 1];
    if (!fromItem || !toItem) {
      continue;
    }

    const fromPlace = getPlaceForTripDayItem(trip, fromItem);
    const toPlace = getPlaceForTripDayItem(trip, toItem);
    const fromPoint = buildRoutePoint(fromItem, fromPlace);
    const toPoint = buildRoutePoint(toItem, toPlace);

    segments.push({
      id: `${fromItem.id}->${toItem.id}`,
      fromItem,
      toItem,
      fromPlace,
      toPlace,
      snapshot: {
        cacheKey: createRouteCacheKey(fromPoint.signature, toPoint.signature),
        fromLabel: fromPoint.label,
        toLabel: toPoint.label,
        fromQuery: fromPoint.query,
        toQuery: toPoint.query,
        fromRouteCity: fromPoint.routeCity,
        toRouteCity: toPoint.routeCity,
        fromSignature: fromPoint.signature,
        toSignature: toPoint.signature,
        fromCoordinates: fromPoint.coordinates,
        toCoordinates: toPoint.coordinates,
      },
    });
  }

  return segments;
}

export function createTripRouteSegmentFetchPlan({
  currentResults,
  previousFetchSnapshots,
  routeSegmentModes,
  segments,
}: CreateTripRouteSegmentFetchPlanInput): TripRouteSegmentFetchPlan {
  const nextFetchSnapshots: Record<string, string> = {};
  const retainedResults: Record<string, TripRouteSegmentResult> = {};
  const segmentsToFetch: TripRouteSegmentFetchPlanItem[] = [];
  const nextSegmentIds = new Set(segments.map((segment) => segment.id));
  const removedSegmentIds = Object.keys(previousFetchSnapshots).filter(
    (segmentId) => !nextSegmentIds.has(segmentId),
  );

  for (const segment of segments) {
    const selectedMode = routeSegmentModes[segment.id];
    const fetchKey = createTripRouteSegmentFetchKey(segment, selectedMode);
    nextFetchSnapshots[segment.id] = fetchKey;

    const currentResult = currentResults[segment.id];
    const previousFetchKey = previousFetchSnapshots[segment.id];
    const canRetainResult =
      currentResult !== undefined && previousFetchKey === fetchKey;

    if (canRetainResult) {
      retainedResults[segment.id] = currentResult;
      continue;
    }

    segmentsToFetch.push({
      fetchKey,
      selectedMode,
      segment,
    });
  }

  return {
    nextFetchSnapshots,
    removedSegmentIds,
    retainedResults,
    segmentsToFetch,
  };
}

function createTripRouteSegmentFetchKey(
  segment: TripDayRouteSegment,
  selectedMode?: TripRouteMode,
): string {
  return `${segment.id}:${segment.snapshot.cacheKey}:${selectedMode ?? "auto"}`;
}

export async function getRouteSegmentWithCache(
  segment: TripDayRouteSegment,
  options: GetRouteSegmentWithCacheOptions = {},
): Promise<TripRouteSegmentResult> {
  const store = await loadRouteCacheStore();
  const cacheEntry = store.entries[segment.snapshot.cacheKey];
  const requestedMode =
    options.mode ?? getAutoRouteModeForSnapshot(segment.snapshot, cacheEntry);

  if (
    !options.forceRefresh &&
    cacheEntry &&
    canReuseRouteCacheEntry(cacheEntry, segment.snapshot, requestedMode)
  ) {
    return {
      cached: true,
      entry: cacheEntry,
    };
  }

  const nextCacheEntry = await queryRouteSegment(segment.snapshot, {
    existingEntry:
      cacheEntry &&
      cacheEntry.fromSignature === segment.snapshot.fromSignature &&
      cacheEntry.toSignature === segment.snapshot.toSignature
        ? cacheEntry
        : undefined,
    mode: requestedMode,
    reason: options.reason,
  });
  store.entries[segment.snapshot.cacheKey] = nextCacheEntry;
  await saveRouteCacheStore();

  return {
    cached: false,
    entry: nextCacheEntry,
  };
}

export function setRouteCacheStorageAdapterForTests(
  adapter: RouteCacheStorageAdapter | null,
): void {
  routeCacheStorageAdapter = adapter;
  routeCacheStorageAdapterPromise = null;
}

export function resetTripRouteSegmentCacheForTests(): void {
  routeCacheStore = null;
  routeCacheLoadPromise = null;
  routeCacheSaveQueue = Promise.resolve();
  routeCacheStorageAdapter = null;
  routeCacheStorageAdapterPromise = null;
  amapRouteRequestQueue = Promise.resolve<unknown>(undefined);
  lastAmapRouteRequestStartedAt = 0;
  geocodeCoordinatesCache.clear();
}

export async function clearRouteSegmentCache(): Promise<void> {
  geocodeCoordinatesCache.clear();
  routeCacheStore = null;
  routeCacheLoadPromise = null;
  const storage = await getRouteCacheStorageAdapter();
  await storage.removeItem?.(ROUTE_CACHE_STORAGE_KEY);
  await storage.removeItem?.("waylog.trip_route_segments.v13");
  await storage.removeItem?.("waylog.route_cache_seeded.v3");
  await storage.removeItem?.("waylog.route_cache_seeded.v2");
}

export function buildAmapRouteUrl(
  routeEntry: TripRouteSegmentCacheEntry,
  mode: TripRouteMode,
): string | undefined {
  return buildAmapDirectionsUrl(routeEntry, mode);
}
