import { getCurrentAuthUser } from "../auth/storage";
import { requestSupabase } from "../auth/supabase";
import { createDiagnosticLogger } from "../diagnostics";
import { getAmapPoiIdFromPlace } from "./place-identity";
import {
  inferPlaceKind,
  isTripPlaceIconKey,
  isTripPlacePoiGroup,
} from "./place-kind";
import type {
  TripGeoCoordinate,
  TripPlace,
  TripPlaceCategory,
  TripPlaceDetails,
  TripPlaceExternalRefs,
  TripPlacePhoto,
} from "./types";

type PoiCacheRow = {
  amap_poi_id: string;
  name: string;
  address?: string | null;
  area?: string | null;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: string | null;
  icon_key?: string | null;
  iconKey?: string | null;
  poi_group?: string | null;
  poiGroup?: string | null;
  poi_type?: string | null;
  poiType?: string | null;
  details?: TripPlaceDetails | null;
  photos?: TripPlacePhoto[] | null;
  external_refs?: TripPlaceExternalRefs | null;
  externalRefs?: TripPlaceExternalRefs | null;
  created_at?: string;
  createdAt?: string;
  distance_km?: number | null;
  updated_at?: string;
  updatedAt?: string;
  score?: number | null;
  version?: number;
};
const poiCacheLogger = createDiagnosticLogger("poi-cache");
const POI_CACHE_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const POI_CACHE_SEARCH_TIMEOUT_MS = 2500;
const POI_CACHE_SEARCH_MAX_LIMIT = 20;
const tripPlaceCategories: TripPlaceCategory[] = [
  "景点",
  "餐厅",
  "酒店",
  "交通",
  "购物",
  "教育",
  "医疗",
  "其他",
];

export type PoiCloudCacheEntry = {
  place: TripPlace;
  updatedAt?: string;
};

export type PoiCloudSearchEntry = PoiCloudCacheEntry & {
  distanceKm?: number;
  score?: number;
};

export type PoiCloudSearchOptions = {
  category?: TripPlaceCategory;
  limit?: number;
  nearbyCenter?: TripGeoCoordinate;
  regionText?: string;
  signal?: AbortSignal;
};

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

const AMAP_DETAIL_KEYS = new Set([
  "rating",
  "ratingSource",
  "phone",
  "openingHours",
  "priceLevel",
  "summary",
]);

function getSharedAmapPoiId(
  place: Pick<TripPlace, "externalRefs" | "providerPlaceId">,
): string | undefined {
  return getAmapPoiIdFromPlace(place);
}

function buildCloudPayload(place: TripPlace): Record<string, unknown> {
  const amapPoiId = getSharedAmapPoiId(place);
  if (!amapPoiId) return {};

  const payload: Record<string, unknown> = { amap_poi_id: amapPoiId };

  if (!isEmpty(place.name)) payload.name = place.name;
  if (!isEmpty(place.address)) payload.address = place.address;
  if (place.latitude != null) payload.latitude = place.latitude;
  if (place.longitude != null) payload.longitude = place.longitude;
  if (!isEmpty(place.category)) payload.category = place.category;
  if (!isEmpty(place.iconKey)) payload.iconKey = place.iconKey;
  if (!isEmpty(place.poiGroup)) payload.poiGroup = place.poiGroup;
  if (!isEmpty(place.poiType)) payload.poiType = place.poiType;
  if (place.details) {
    const amapDetails: Record<string, unknown> = {};
    for (const key of AMAP_DETAIL_KEYS) {
      const value = (place.details as Record<string, unknown>)[key];
      if (!isEmpty(value)) {
        amapDetails[key] = value;
      }
    }
    if (Object.keys(amapDetails).length > 0) {
      payload.details = amapDetails;
    }
  }

  if (!isEmpty(place.photos)) payload.photos = place.photos;
  if (!isEmpty(place.externalRefs)) payload.externalRefs = place.externalRefs;

  return payload;
}

function buildMergePayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return payload;
}

function getPoiCacheRowUpdatedAt(row: PoiCacheRow): string | undefined {
  return row.updatedAt ?? row.updated_at;
}

function isPoiCacheFresh(updatedAt?: string): boolean {
  if (!updatedAt) return false;

  const updatedAtTime = Date.parse(updatedAt);
  if (!Number.isFinite(updatedAtTime)) return false;

  return Date.now() - updatedAtTime < POI_CACHE_REFRESH_TTL_MS;
}

function isTripPlaceCategory(value: unknown): value is TripPlaceCategory {
  return (
    typeof value === "string" &&
    tripPlaceCategories.includes(value as TripPlaceCategory)
  );
}

function normalizePoiCacheSearchText(value?: string): string | undefined {
  const normalizedValue = value?.replace(/\s+/g, " ").trim();

  return normalizedValue || undefined;
}

function clampPoiCacheSearchLimit(limit?: number): number {
  return Math.max(
    1,
    Math.min(POI_CACHE_SEARCH_MAX_LIMIT, Math.round(limit ?? 8)),
  );
}

function escapePostgrestLike(value: string): string {
  return value.replace(/[%*]/g, "");
}

function getPoiCacheRowDistanceKm(row: PoiCacheRow): number | undefined {
  return typeof row.distance_km === "number" && Number.isFinite(row.distance_km)
    ? row.distance_km
    : undefined;
}

function getPoiCacheRowScore(row: PoiCacheRow): number | undefined {
  return typeof row.score === "number" && Number.isFinite(row.score)
    ? row.score
    : undefined;
}

async function mergePoiPayloads(
  payloads: Record<string, unknown>[],
  accessToken: string,
): Promise<void> {
  await requestSupabase({
    accessToken,
    body: {
      payloads: payloads.map(buildMergePayload),
    },
    method: "POST",
    path: "rpc/merge_poi_cache_entries",
    prefer: "return=minimal",
    service: "rest",
  });
}

export function createPublicTripPlaceShapeFromPoiCacheRow(
  row: PoiCacheRow,
): TripPlace {
  const externalRefs = row.externalRefs ?? row.external_refs ?? undefined;
  const category = isTripPlaceCategory(row.category) ? row.category : undefined;
  const iconKey = row.iconKey ?? row.icon_key;
  const poiGroup = row.poiGroup ?? row.poi_group;
  const kind = inferPlaceKind({
    category,
    name: row.name,
  });

  return {
    id: `amap-${row.amap_poi_id}`,
    name: row.name,
    category: category ?? kind.category,
    isScheduled: false,
    address: row.address ?? undefined,
    area: row.area ?? externalRefs?.amapCityName ?? undefined,
    latitude: row.latitude ?? row.lat ?? undefined,
    longitude: row.longitude ?? row.lng ?? undefined,
    iconKey: isTripPlaceIconKey(iconKey) ? iconKey : kind.iconKey,
    poiGroup: isTripPlacePoiGroup(poiGroup) ? poiGroup : kind.poiGroup,
    poiType: row.poiType ?? row.poi_type ?? kind.poiType,
    providerPlaceId: row.amap_poi_id,
    details: row.details ?? undefined,
    photos: row.photos ?? undefined,
    provider: "amap",
    externalRefs: {
      ...(externalRefs ?? {}),
      amapPoiId: externalRefs?.amapPoiId ?? row.amap_poi_id,
    },
  };
}

/** @deprecated Use createPublicTripPlaceShapeFromPoiCacheRow. */
function rowToTripPlace(row: PoiCacheRow): TripPlace {
  return createPublicTripPlaceShapeFromPoiCacheRow(row);
}

function rowToPoiCloudSearchEntry(row: PoiCacheRow): PoiCloudSearchEntry {
  return {
    place: rowToTripPlace(row),
    updatedAt: getPoiCacheRowUpdatedAt(row),
    distanceKm: getPoiCacheRowDistanceKm(row),
    score: getPoiCacheRowScore(row),
  };
}

async function searchPoiCacheEntriesWithRpc(
  query: string | undefined,
  options: PoiCloudSearchOptions,
): Promise<PoiCloudSearchEntry[] | undefined> {
  const rows = await requestSupabase<PoiCacheRow[]>({
    body: {
      p_category: options.category,
      p_center_lat: options.nearbyCenter?.latitude,
      p_center_lng: options.nearbyCenter?.longitude,
      p_limit: clampPoiCacheSearchLimit(options.limit),
      p_query: query ?? "",
      p_region: normalizePoiCacheSearchText(options.regionText),
    },
    method: "POST",
    path: "rpc/search_poi_cache_entries",
    prefer: "return=representation",
    service: "rest",
    timeoutMs: POI_CACHE_SEARCH_TIMEOUT_MS,
  });

  return Array.isArray(rows) ? rows.map(rowToPoiCloudSearchEntry) : undefined;
}

async function searchPoiCacheEntriesWithRestFallback(
  query: string | undefined,
  options: PoiCloudSearchOptions,
): Promise<PoiCloudSearchEntry[]> {
  if (!query) {
    return [];
  }

  const filters = [
    `name.ilike.*${escapePostgrestLike(query)}*`,
    `address.ilike.*${escapePostgrestLike(query)}*`,
  ];

  const params = new URLSearchParams({
    limit: String(clampPoiCacheSearchLimit(options.limit)),
    or: `(${filters.join(",")})`,
    review_status: "in.(pending,confirmed)",
    select: "*",
  });

  const rows = await requestSupabase<PoiCacheRow[]>({
    method: "GET",
    path: `poi_cache?${params.toString()}`,
    service: "rest",
    timeoutMs: POI_CACHE_SEARCH_TIMEOUT_MS,
  });

  return Array.isArray(rows) ? rows.map(rowToPoiCloudSearchEntry) : [];
}

export async function fetchPoiCacheEntryFromCloud(
  amapPoiId: string,
  accessToken?: string,
): Promise<PoiCloudCacheEntry | null> {
  if (!amapPoiId) return null;

  try {
    poiCacheLogger.debug(
      "fetch.started",
      {
        accessTokenProvided: Boolean(accessToken),
        amapPoiId,
      },
      "Fetching POI from cloud cache",
    );
    const rows = await requestSupabase<PoiCacheRow[]>({
      method: "GET",
      path: `poi_cache?amap_poi_id=eq.${encodeURIComponent(amapPoiId)}&select=*`,
      service: "rest",
      accessToken,
    });

    if (!rows || rows.length === 0) {
      poiCacheLogger.info(
        "fetch.miss",
        {
          amapPoiId,
        },
        "POI cloud cache miss",
      );
      return null;
    }

    poiCacheLogger.info(
      "fetch.hit",
      {
        amapPoiId,
        rowCount: rows.length,
      },
      "POI cloud cache hit",
    );
    const row = rows[0];
    if (!row) return null;

    return {
      place: rowToTripPlace(row),
      updatedAt: getPoiCacheRowUpdatedAt(row),
    };
  } catch (error) {
    poiCacheLogger.warn(
      "fetch.failed",
      {
        amapPoiId,
        error,
      },
      "Failed to fetch POI from cloud cache",
    );
    return null;
  }
}

export async function fetchPoiFromCloud(
  amapPoiId: string,
  accessToken?: string,
): Promise<TripPlace | null> {
  const entry = await fetchPoiCacheEntryFromCloud(amapPoiId, accessToken);
  return entry?.place ?? null;
}

export async function fetchFreshPoiFromCloudCache(
  amapPoiId: string,
  accessToken?: string,
): Promise<TripPlace | null> {
  const entry = await fetchPoiCacheEntryFromCloud(amapPoiId, accessToken);

  if (!entry || !isPoiCacheFresh(entry.updatedAt)) {
    return null;
  }

  return entry.place;
}

export async function searchPoiCacheEntriesFromCloud(
  query: string,
  options: PoiCloudSearchOptions = {},
): Promise<PoiCloudSearchEntry[]> {
  const normalizedQuery = normalizePoiCacheSearchText(query);

  if (options.signal?.aborted) {
    throw new Error("Search request was aborted.");
  }

  if (!normalizedQuery && !options.nearbyCenter) {
    return [];
  }

  try {
    const rpcResults = await searchPoiCacheEntriesWithRpc(
      normalizedQuery,
      options,
    );

    if (options.signal?.aborted) {
      throw new Error("Search request was aborted.");
    }

    if (rpcResults) {
      return rpcResults;
    }
  } catch (error) {
    poiCacheLogger.debug(
      "search.rpc-fallback",
      {
        error,
        query: normalizedQuery,
      },
      "POI cache RPC search unavailable; falling back to REST query",
    );
  }

  try {
    if (options.signal?.aborted) {
      throw new Error("Search request was aborted.");
    }

    return await searchPoiCacheEntriesWithRestFallback(
      normalizedQuery,
      options,
    );
  } catch (error) {
    if (options.signal?.aborted) {
      throw error;
    }

    poiCacheLogger.warn(
      "search.failed",
      {
        error,
        query: normalizedQuery,
      },
      "Failed to search POI cloud cache",
    );
    return [];
  }
}

export async function syncPoiToCloud(place: TripPlace): Promise<void> {
  const amapPoiId = getSharedAmapPoiId(place);
  if (!amapPoiId) {
    poiCacheLogger.warn(
      "sync.skipped.invalid-shared-id",
      {
        externalAmapPoiId: place.externalRefs?.amapPoiId,
        placeId: place.id,
        providerPlaceId: place.providerPlaceId,
      },
      "Skipped POI sync because no valid shared Amap POI ID was available",
    );
    return;
  }

  try {
    const currentUser = await getCurrentAuthUser();
    const accessToken = currentUser?.session.accessToken;

    if (!accessToken) {
      poiCacheLogger.info(
        "sync.skipped.no-access-token",
        {
          amapPoiId,
        },
        "Skipped POI sync because access token is unavailable",
      );
      return;
    }

    poiCacheLogger.info(
      "sync.single.started",
      {
        amapPoiId,
        hasDetails: Boolean(place.details),
        hasPhotos: Boolean(place.photos?.length),
      },
      "Syncing single POI to cloud cache",
    );

    const payload = buildCloudPayload(place);
    if (typeof payload.amap_poi_id !== "string") {
      return;
    }

    await mergePoiPayloads([payload], accessToken);
    poiCacheLogger.info(
      "sync.single.finished",
      {
        amapPoiId,
      },
      "Synced single POI to cloud cache",
    );
  } catch (error) {
    poiCacheLogger.error(
      "sync.single.failed",
      {
        amapPoiId,
        error,
      },
      "Failed to sync single POI to cloud cache",
    );
  }
}

export async function batchSyncPoiToCloud(places: TripPlace[]): Promise<void> {
  if (places.length === 0) return;

  try {
    const currentUser = await getCurrentAuthUser();
    const accessToken = currentUser?.session.accessToken;

    if (!accessToken) {
      poiCacheLogger.info(
        "sync.batch.skipped.no-access-token",
        {
          placeCount: places.length,
        },
        "Skipped batch POI sync because access token is unavailable",
      );
      return;
    }

    const payloads = places
      .map(buildCloudPayload)
      .filter(
        (payload) =>
          typeof (payload as { amap_poi_id?: unknown }).amap_poi_id ===
          "string",
      );

    if (payloads.length === 0) {
      poiCacheLogger.warn(
        "sync.batch.skipped.no-valid-payloads",
        {
          placeCount: places.length,
        },
        "Skipped batch POI sync because no payload had a valid shared Amap POI ID",
      );
      return;
    }

    poiCacheLogger.info(
      "sync.batch.started",
      {
        payloadCount: payloads.length,
        requestedIds: payloads
          .map((payload) => (payload as { amap_poi_id?: unknown }).amap_poi_id)
          .filter((id): id is string => typeof id === "string"),
      },
      "Syncing POI batch to cloud cache",
    );
    await mergePoiPayloads(payloads, accessToken);
    poiCacheLogger.info(
      "sync.batch.finished",
      {
        payloadCount: payloads.length,
      },
      "Finished POI batch sync",
    );
  } catch (error) {
    poiCacheLogger.error(
      "sync.batch.failed",
      {
        error,
        placeCount: places.length,
      },
      "Failed POI batch sync",
    );
  }
}

export async function batchFetchPoiFromCloud(
  amapPoiIds: string[],
  accessToken?: string,
): Promise<Map<string, TripPlace>> {
  const result = new Map<string, TripPlace>();

  if (amapPoiIds.length === 0) return result;

  const uniqueIds = [...new Set(amapPoiIds.filter(Boolean))];
  if (uniqueIds.length === 0) return result;

  try {
    const idsParam = uniqueIds.map((id) => `"${id}"`).join(",");
    poiCacheLogger.debug("fetch.batch.started", {
      accessTokenProvided: Boolean(accessToken),
      requestedIds: uniqueIds,
    });
    const rows = await requestSupabase<PoiCacheRow[]>({
      method: "GET",
      path: `poi_cache?amap_poi_id=in.(${idsParam})&select=*`,
      service: "rest",
      accessToken,
    });

    if (!rows || rows.length === 0) {
      poiCacheLogger.info("fetch.batch.empty", {
        requestedIds: uniqueIds,
      });
      return result;
    }

    for (const row of rows) {
      const place = rowToTripPlace(row);
      const amapPoiId = row.amap_poi_id;
      if (amapPoiId) {
        result.set(amapPoiId, place);
      }
    }
    poiCacheLogger.info("fetch.batch.succeeded", {
      foundIds: [...result.keys()],
      requestedIds: uniqueIds,
      size: result.size,
    });
  } catch (error) {
    poiCacheLogger.error("fetch.batch.failed", {
      error,
      requestedIds: uniqueIds,
    });
  }

  return result;
}

export async function ensurePoiCached(place: TripPlace): Promise<void> {
  poiCacheLogger.debug(
    "ensure.started",
    {
      externalAmapPoiId: place.externalRefs?.amapPoiId,
      placeId: place.id,
      providerPlaceId: place.providerPlaceId,
    },
    "Ensuring POI is cached",
  );
  await hydratePoiFromCloudOrSaveBase(place);
}

const pendingHydrations = new Map<string, Promise<TripPlace | null>>();

export async function hydratePoiFromCloudOrSaveBase(
  place: TripPlace,
): Promise<TripPlace | null> {
  const amapPoiId = getSharedAmapPoiId(place);
  if (!amapPoiId) {
    poiCacheLogger.warn(
      "hydrate.skipped.invalid-shared-id",
      {
        externalAmapPoiId: place.externalRefs?.amapPoiId,
        placeId: place.id,
        providerPlaceId: place.providerPlaceId,
      },
      "Skipped POI cloud hydrate because shared Amap POI ID is invalid",
    );
    return null;
  }

  const existing = pendingHydrations.get(amapPoiId);
  if (existing) {
    poiCacheLogger.debug(
      "hydrate.reused-promise",
      {
        amapPoiId,
      },
      "Reused pending POI hydrate promise",
    );
    return existing;
  }

  const promise = doHydratePoiFromCloudOrSaveBase(amapPoiId, place);
  pendingHydrations.set(amapPoiId, promise);
  promise.finally(() => pendingHydrations.delete(amapPoiId));
  return promise;
}

async function doHydratePoiFromCloudOrSaveBase(
  amapPoiId: string,
  place: TripPlace,
): Promise<TripPlace | null> {
  try {
    const cached = await fetchPoiFromCloud(amapPoiId);

    if (cached) {
      poiCacheLogger.info(
        "hydrate.cache-hit",
        {
          amapPoiId,
          hasDetails: Boolean(cached.details),
          hasPhotos: Boolean(cached.photos?.length),
        },
        "Resolved POI data from cloud cache",
      );
      return {
        ...cached,
        id: place.id,
        category: place.category ?? cached.category,
        note: place.note ?? cached.note,
        isScheduled: place.isScheduled ?? false,
        details: {
          ...cached.details,
          plannedCount:
            place.details?.plannedCount ?? cached.details?.plannedCount,
          visitedCount:
            place.details?.visitedCount ?? cached.details?.visitedCount,
          cautions: place.details?.cautions ?? cached.details?.cautions,
        },
      };
    }

    poiCacheLogger.info(
      "hydrate.cache-miss-save-base",
      {
        amapPoiId,
        hasDetails: Boolean(place.details),
        hasPhotos: Boolean(place.photos?.length),
      },
      "Cloud cache missed and saved base POI data",
    );
    await syncPoiToCloud(place);
    return place;
  } catch (error) {
    poiCacheLogger.error(
      "hydrate.failed",
      {
        amapPoiId,
        error,
      },
      "Failed to hydrate or save base POI data",
    );
    return null;
  }
}
