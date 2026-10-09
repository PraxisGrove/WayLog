import AsyncStorage from "@react-native-async-storage/async-storage";

import { createDiagnosticLogger } from "../diagnostics";
import type { CloudUserFavoritePlaceRow } from "./cloud-sync";
import {
  fetchCloudFavoritePlaceRows,
  getCloudRowUpdatedAt,
  getCloudSyncSession,
  hydrateFavoritePlaceFromCloud,
  markCloudFavoritePlaceDeleted,
  parseCloudRowVersion,
  upsertCloudFavoritePlaceRows,
} from "./cloud-sync";
import { getProviderPlaceIdFromSuggestion } from "./place-identity";
import type { PlaceSuggestion } from "./place-search";
import { batchFetchPoiFromCloud, ensurePoiCached } from "./poi-cache";
import type { EntitySyncMetadataStore } from "./sync-metadata";
import {
  clearEntitySyncMetadata,
  loadEntitySyncMetadata,
  markEntityDeleted,
  markEntityDirty,
  markEntitySynced,
  markEntitySyncFailed,
  saveEntitySyncMetadata,
} from "./sync-metadata";
import type {
  TripPlace,
  TripPlaceCategory,
  TripPlaceDetails,
  TripPlaceExternalRefs,
  TripPlaceIconKey,
  TripPlaceMapBoundary,
  TripPlacePhoto,
  TripPlacePoiGroup,
} from "./types";

export const FAVORITE_PLACES_STORAGE_KEY = "waylog.favorite_places.v1";

const FAVORITE_PLACE_SYNC_STORAGE_KEY = "waylog.favorite_place_sync.v1";
const favoriteSyncLogger = createDiagnosticLogger("favorite-sync");

export async function clearFavoritePlaceSyncMetadata(): Promise<void> {
  await clearEntitySyncMetadata(FAVORITE_PLACE_SYNC_STORAGE_KEY);
}

export async function clearLocalFavoritePlaceData(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(FAVORITE_PLACES_STORAGE_KEY),
    clearEntitySyncMetadata(FAVORITE_PLACE_SYNC_STORAGE_KEY),
  ]);
}

export type FavoritePlaceRecord = {
  id: string;
  name: string;
  category: TripPlaceCategory;
  address?: string;
  area?: string;
  latitude?: number;
  longitude?: number;
  mapBoundary?: TripPlaceMapBoundary;
  note?: string;
  iconKey?: TripPlaceIconKey;
  osmKey?: string;
  osmValue?: string;
  poiGroup?: TripPlacePoiGroup;
  poiType?: string;
  providerPlaceId?: string;
  externalRefs?: TripPlaceExternalRefs;
  favoritedAt: string;
  updatedAt: string;
  details?: TripPlaceDetails;
  photos?: TripPlacePhoto[];
};

type FavoritePlaceUpsertResult = {
  added: boolean;
  place: FavoritePlaceRecord;
  places: FavoritePlaceRecord[];
};

const favoritePlaceCategories: TripPlaceCategory[] = [
  "景点",
  "餐厅",
  "酒店",
  "交通",
  "购物",
  "教育",
  "医疗",
  "其他",
];
const favoritePlaceIconKeys: TripPlaceIconKey[] = [
  "attraction",
  "landmark",
  "museum",
  "park",
  "viewpoint",
  "temple",
  "restaurant",
  "cafe",
  "bar",
  "hotel",
  "guesthouse",
  "airport",
  "train",
  "subway",
  "bus",
  "car",
  "shopping",
  "mall",
  "school",
  "university",
  "library",
  "research",
  "hospital",
  "clinic",
  "pharmacy",
  "place",
];
const favoritePlacePoiGroups: TripPlacePoiGroup[] = [
  "attraction",
  "food",
  "hotel",
  "transport",
  "shopping",
  "education",
  "medical",
  "other",
];

function createFavoritePlaceId(prefix = "favorite-place"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCategory(value: unknown): TripPlaceCategory {
  return favoritePlaceCategories.includes(value as TripPlaceCategory)
    ? (value as TripPlaceCategory)
    : "其他";
}

function normalizeIconKey(value: unknown): TripPlaceIconKey | undefined {
  return favoritePlaceIconKeys.includes(value as TripPlaceIconKey)
    ? (value as TripPlaceIconKey)
    : undefined;
}

function normalizePoiGroup(value: unknown): TripPlacePoiGroup | undefined {
  return favoritePlacePoiGroups.includes(value as TripPlacePoiGroup)
    ? (value as TripPlacePoiGroup)
    : undefined;
}

function normalizeExternalRefs(
  value: unknown,
): TripPlaceExternalRefs | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const externalRefs: TripPlaceExternalRefs = {
    amapAdcode:
      typeof source.amapAdcode === "string" ? source.amapAdcode : undefined,
    amapCitycode:
      typeof source.amapCitycode === "string" ? source.amapCitycode : undefined,
    amapCityName:
      typeof source.amapCityName === "string" ? source.amapCityName : undefined,
    amapPoiId:
      typeof source.amapPoiId === "string" ? source.amapPoiId : undefined,
    wikidataId:
      typeof source.wikidataId === "string" ? source.wikidataId : undefined,
    sourceUrl:
      typeof source.sourceUrl === "string" ? source.sourceUrl : undefined,
    mapUrl: typeof source.mapUrl === "string" ? source.mapUrl : undefined,
  };

  return Object.values(externalRefs).some(Boolean) ? externalRefs : undefined;
}

function normalizeFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function normalizeMapCoordinate(
  value: unknown,
): { latitude: number; longitude: number } | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const latitude = normalizeFiniteNumber(source.latitude);
  const longitude = normalizeFiniteNumber(source.longitude);

  if (
    latitude === undefined ||
    longitude === undefined ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return undefined;
  }

  return {
    latitude,
    longitude,
  };
}

function normalizeFavoritePlaceMapBoundary(
  value: unknown,
): TripPlaceMapBoundary | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const boundary = value
    .map((path) =>
      Array.isArray(path)
        ? path
            .map(normalizeMapCoordinate)
            .filter(
              (
                coordinate,
              ): coordinate is { latitude: number; longitude: number } =>
                Boolean(coordinate),
            )
        : [],
    )
    .filter((path) => path.length >= 3);

  return boundary.length > 0 ? boundary : undefined;
}

function normalizeFavoritePlaceNote(
  note: unknown,
  address: string | undefined,
): string | undefined {
  if (typeof note !== "string") {
    return undefined;
  }

  const trimmedNote = note.trim();

  if (!trimmedNote) {
    return undefined;
  }

  if (address && trimmedNote === address.trim()) {
    return undefined;
  }

  return trimmedNote;
}

function normalizeFavoritePlace(
  value: unknown,
  index: number,
): FavoritePlaceRecord | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const name =
    typeof source.name === "string" && source.name.trim()
      ? source.name
      : undefined;

  if (!name) {
    return undefined;
  }

  const now = new Date().toISOString();

  return {
    id:
      typeof source.id === "string"
        ? source.id
        : createFavoritePlaceId(`favorite-place-${index + 1}`),
    name,
    category: normalizeCategory(source.category),
    address: typeof source.address === "string" ? source.address : undefined,
    area: typeof source.area === "string" ? source.area : undefined,
    latitude: typeof source.latitude === "number" ? source.latitude : undefined,
    longitude:
      typeof source.longitude === "number" ? source.longitude : undefined,
    mapBoundary: normalizeFavoritePlaceMapBoundary(source.mapBoundary),
    note: normalizeFavoritePlaceNote(
      source.note,
      typeof source.address === "string" ? source.address : undefined,
    ),
    iconKey: normalizeIconKey(source.iconKey),
    osmKey: typeof source.osmKey === "string" ? source.osmKey : undefined,
    osmValue: typeof source.osmValue === "string" ? source.osmValue : undefined,
    poiGroup: normalizePoiGroup(source.poiGroup),
    poiType: typeof source.poiType === "string" ? source.poiType : undefined,
    providerPlaceId:
      typeof source.providerPlaceId === "string"
        ? source.providerPlaceId
        : undefined,
    externalRefs: normalizeExternalRefs(source.externalRefs),
    favoritedAt:
      typeof source.favoritedAt === "string" ? source.favoritedAt : now,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : now,
    details:
      typeof source.details === "object" && source.details !== null
        ? (source.details as TripPlaceDetails)
        : undefined,
    photos: Array.isArray(source.photos)
      ? (source.photos as TripPlacePhoto[])
      : undefined,
  };
}

function createFavoritePlaceFromSuggestion(
  suggestion: PlaceSuggestion,
  now: string,
): FavoritePlaceRecord {
  const hasDetails =
    suggestion.rating != null ||
    suggestion.phone ||
    suggestion.openingHoursToday ||
    suggestion.costPerPerson;
  const details: TripPlaceDetails | undefined = hasDetails
    ? {
        rating: suggestion.rating,
        ratingSource: suggestion.rating != null ? "高德" : undefined,
        phone: suggestion.phone,
        openingHours: suggestion.openingHoursToday,
        priceLevel: suggestion.costPerPerson,
      }
    : undefined;
  const photos: TripPlacePhoto[] | undefined = suggestion.photos?.map(
    (p, i) => ({
      id: `amap-photo-${suggestion.providerPlaceId ?? suggestion.id}-${i}`,
      url: p.url,
      sourceLabel: "高德",
      ...(p.title ? { credit: p.title } : {}),
    }),
  );

  return {
    id: createFavoritePlaceId(),
    name: suggestion.name,
    category: suggestion.category,
    address: suggestion.address,
    area: suggestion.area,
    latitude: suggestion.latitude,
    longitude: suggestion.longitude,
    mapBoundary: suggestion.mapBoundary,
    iconKey: suggestion.iconKey,
    osmKey: suggestion.osmKey,
    osmValue: suggestion.osmValue,
    poiGroup: suggestion.poiGroup,
    poiType: suggestion.poiType,
    providerPlaceId: suggestion.providerPlaceId ?? suggestion.id,
    externalRefs: suggestion.externalRefs,
    favoritedAt: now,
    updatedAt: now,
    details,
    photos: photos && photos.length > 0 ? photos : undefined,
  };
}

function normalizeMatchText(value?: string): string {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function doPlaceDetailsMatch(
  place: FavoritePlaceRecord,
  suggestion: PlaceSuggestion,
): boolean {
  return (
    normalizeMatchText(place.name) === normalizeMatchText(suggestion.name) &&
    place.category === suggestion.category &&
    normalizeMatchText(place.address) ===
      normalizeMatchText(suggestion.address) &&
    normalizeMatchText(place.area) === normalizeMatchText(suggestion.area)
  );
}

export function findFavoritePlaceIndex(
  places: FavoritePlaceRecord[],
  suggestion: PlaceSuggestion,
): number {
  const suggestionProviderPlaceId = suggestion.providerPlaceId ?? suggestion.id;

  return places.findIndex((place) => {
    if (place.providerPlaceId) {
      return place.providerPlaceId === suggestionProviderPlaceId;
    }

    return doPlaceDetailsMatch(place, suggestion);
  });
}

export function isFavoritePlaceSuggestion(
  places: FavoritePlaceRecord[],
  suggestion: PlaceSuggestion,
): boolean {
  return findFavoritePlaceIndex(places, suggestion) >= 0;
}

function compareIsoTimestamp(left?: string, right?: string): number {
  const leftTime = left ? Date.parse(left) : 0;
  const rightTime = right ? Date.parse(right) : 0;
  const normalizedLeftTime = Number.isNaN(leftTime) ? 0 : leftTime;
  const normalizedRightTime = Number.isNaN(rightTime) ? 0 : rightTime;

  return normalizedLeftTime - normalizedRightTime;
}

function collectFavoriteAmapPoiIds(
  rows: CloudUserFavoritePlaceRow[],
): string[] {
  const ids: string[] = [];

  for (const row of rows) {
    if (
      row.deleted_at ||
      typeof row.payload !== "object" ||
      row.payload === null
    ) {
      continue;
    }

    const payload = row.payload as Record<string, unknown>;

    if (typeof payload.providerPlaceId === "string") {
      ids.push(payload.providerPlaceId);
    }
  }

  return [...new Set(ids)];
}

function getFavoritePlaceFromCloudRow(
  row: CloudUserFavoritePlaceRow,
  poiCache?: Map<string, TripPlace>,
): FavoritePlaceRecord | undefined {
  if (!row.id || typeof row.payload !== "object" || row.payload === null) {
    return undefined;
  }

  const payloadRow = row.payload as Record<string, unknown>;

  const hydrated =
    poiCache && poiCache.size > 0
      ? hydrateFavoritePlaceFromCloud(payloadRow, poiCache)
      : payloadRow;

  return normalizeFavoritePlace(
    {
      ...hydrated,
      id: row.id,
    },
    0,
  );
}

function shouldAcceptCloudFavoritePlace(
  row: CloudUserFavoritePlaceRow,
  localPlace: FavoritePlaceRecord | undefined,
  syncStore: EntitySyncMetadataStore,
) {
  if (!row.id) {
    return false;
  }

  const metadata = syncStore.entities[row.id];

  if (metadata?.dirty) {
    const cloudUpdatedAt = getCloudRowUpdatedAt(row);
    if (
      metadata.lastSyncedAt &&
      compareIsoTimestamp(cloudUpdatedAt, metadata.lastSyncedAt) > 0
    ) {
      return true;
    }
    return false;
  }

  if (metadata?.deletedAt) {
    const cloudUpdatedAt = getCloudRowUpdatedAt(row);

    if (compareIsoTimestamp(cloudUpdatedAt, metadata.deletedAt) <= 0) {
      return false;
    }
  }

  if (!localPlace) {
    return true;
  }

  const cloudUpdatedAt = getCloudRowUpdatedAt(row);
  const knownCloudUpdatedAt = metadata?.cloudUpdatedAt;

  return (
    compareIsoTimestamp(
      cloudUpdatedAt,
      knownCloudUpdatedAt ?? localPlace.updatedAt,
    ) >= 0
  );
}

function markUnsyncedLocalFavoritePlaces(
  places: FavoritePlaceRecord[],
  syncStore: EntitySyncMetadataStore,
): EntitySyncMetadataStore {
  return places.reduce((currentStore, place) => {
    if (currentStore.entities[place.id]) {
      return currentStore;
    }

    return markEntityDirty(currentStore, place.id, place.updatedAt);
  }, syncStore);
}

function hasNewerFavoriteDirtySyncIntent(
  latestStore: EntitySyncMetadataStore,
  currentStore: EntitySyncMetadataStore,
  syncStartedAt: string,
): boolean {
  return Object.entries(latestStore.entities).some(([id, latestMetadata]) => {
    if (latestMetadata.dirty !== true) {
      return false;
    }

    const currentMetadata = currentStore.entities[id];
    const latestLocalUpdatedAt =
      latestMetadata.localUpdatedAt ?? latestMetadata.deletedAt;
    const hasNewDeleteIntent = Boolean(
      latestMetadata.deletedAt &&
        latestMetadata.deletedAt !== currentMetadata?.deletedAt,
    );

    return (
      hasNewDeleteIntent ||
      compareIsoTimestamp(
        latestLocalUpdatedAt,
        currentMetadata?.localUpdatedAt,
      ) > 0 ||
      compareIsoTimestamp(latestLocalUpdatedAt, syncStartedAt) > 0
    );
  });
}

function preserveNewerFavoriteDirtySyncIntent(
  currentStore: EntitySyncMetadataStore,
  latestStore: EntitySyncMetadataStore,
  syncStartedAt: string,
): EntitySyncMetadataStore {
  const nextEntities = { ...currentStore.entities };

  for (const [id, latestMetadata] of Object.entries(latestStore.entities)) {
    if (latestMetadata.dirty !== true) {
      continue;
    }

    const currentMetadata = nextEntities[id];
    const latestLocalUpdatedAt =
      latestMetadata.localUpdatedAt ?? latestMetadata.deletedAt;
    const hasNewDeleteIntent = Boolean(
      latestMetadata.deletedAt &&
        latestMetadata.deletedAt !== currentMetadata?.deletedAt,
    );
    const isNewerThanCurrent =
      compareIsoTimestamp(
        latestLocalUpdatedAt,
        currentMetadata?.localUpdatedAt,
      ) > 0;
    const wasWrittenDuringSync =
      compareIsoTimestamp(latestLocalUpdatedAt, syncStartedAt) > 0;

    if (!hasNewDeleteIntent && !isNewerThanCurrent && !wasWrittenDuringSync) {
      continue;
    }

    nextEntities[id] = latestMetadata;
  }

  return {
    ...currentStore,
    entities: nextEntities,
  };
}

async function saveFavoritePlaces(
  places: FavoritePlaceRecord[],
): Promise<void> {
  await AsyncStorage.setItem(
    FAVORITE_PLACES_STORAGE_KEY,
    JSON.stringify(places),
  );
}

async function readFavoritePlacesFromLocal(): Promise<FavoritePlaceRecord[]> {
  const rawPlaces = await AsyncStorage.getItem(FAVORITE_PLACES_STORAGE_KEY);

  if (!rawPlaces) {
    return [];
  }

  try {
    const parsedPlaces = JSON.parse(rawPlaces);

    if (!Array.isArray(parsedPlaces)) {
      return [];
    }

    return parsedPlaces
      .map((place, index) => normalizeFavoritePlace(place, index))
      .filter((place): place is FavoritePlaceRecord => Boolean(place));
  } catch (error) {
    favoriteSyncLogger.warn(
      "local.parse.failed",
      { error },
      "Failed to parse favorite places from local storage",
    );
    return [];
  }
}

export async function hasLocalGuestFavoritePlaceData(): Promise<boolean> {
  return (await readFavoritePlacesFromLocal()).length > 0;
}

export async function getLocalFavoritePlacesSnapshot(): Promise<
  FavoritePlaceRecord[]
> {
  return readFavoritePlacesFromLocal();
}

let favoritePlacesCloudSyncPromise: Promise<void> | null = null;
let shouldRunFavoritePlacesSyncAgain = false;

export async function syncFavoritePlacesWithCloud(): Promise<void> {
  const session = await getCloudSyncSession();

  if (!session) {
    favoriteSyncLogger.info(
      "sync.skipped.no-session",
      {},
      "Skipped favorite-place sync because session is unavailable",
    );
    return;
  }

  try {
    const syncStartedAt = new Date().toISOString();
    let places = await readFavoritePlacesFromLocal();
    let syncStore = markUnsyncedLocalFavoritePlaces(
      places,
      await loadEntitySyncMetadata(FAVORITE_PLACE_SYNC_STORAGE_KEY),
    );
    const placesById = new Map(places.map((place) => [place.id, place]));
    const pendingUpserts = places.filter((place) => {
      const metadata = syncStore.entities[place.id];
      return metadata?.dirty === true && !metadata.deletedAt;
    });

    favoriteSyncLogger.info(
      "sync.started",
      {
        localPlaceCount: places.length,
        pendingUpsertCount: pendingUpserts.length,
        userId: session.userId,
      },
      "Started favorite-place sync",
    );

    try {
      const upsertedRows = await upsertCloudFavoritePlaceRows(
        session,
        pendingUpserts,
      );
      const syncedAt = new Date().toISOString();
      favoriteSyncLogger.info(
        "sync.upsert.finished",
        {
          pendingUpsertCount: pendingUpserts.length,
          returnedRowCount: upsertedRows.length,
          userId: session.userId,
        },
        "Finished favorite-place upsert",
      );

      upsertedRows.forEach((row) => {
        if (!row.id) {
          return;
        }

        syncStore = markEntitySynced(syncStore, row.id, {
          cloudUpdatedAt: getCloudRowUpdatedAt(row),
          lastSyncedAt: syncedAt,
          version: parseCloudRowVersion(row.version),
        });
      });
    } catch (error) {
      pendingUpserts.forEach((place) => {
        syncStore = markEntitySyncFailed(syncStore, place.id, error);
      });
      throw error;
    }

    const pendingDeletes = Object.entries(syncStore.entities).filter(
      ([, metadata]) => metadata.dirty === true && Boolean(metadata.deletedAt),
    );

    favoriteSyncLogger.debug(
      "sync.delete.pending",
      {
        pendingDeleteCount: pendingDeletes.length,
        userId: session.userId,
      },
      "Prepared favorite-place deletions for sync",
    );

    for (const [placeId, metadata] of pendingDeletes) {
      try {
        const deletedAt = metadata.deletedAt ?? new Date().toISOString();
        const deletedRows = await markCloudFavoritePlaceDeleted(
          session,
          placeId,
          deletedAt,
        );
        const deletedRow = deletedRows[0];

        syncStore = markEntitySynced(syncStore, placeId, {
          cloudUpdatedAt: getCloudRowUpdatedAt(deletedRow ?? {}) ?? deletedAt,
          deletedAt,
          lastSyncedAt: new Date().toISOString(),
          version: parseCloudRowVersion(deletedRow?.version),
        });
      } catch (error) {
        syncStore = markEntitySyncFailed(syncStore, placeId, error);
        favoriteSyncLogger.warn(
          "sync.delete.failed",
          {
            error,
            placeId,
            userId: session.userId,
          },
          "Failed to sync favorite-place deletion",
        );
      }
    }

    const cloudRows = await fetchCloudFavoritePlaceRows(session);
    const nextPlacesById = new Map(placesById);
    let didMergeCloudChanges = false;
    const syncedAt = new Date().toISOString();

    const amapPoiIds = collectFavoriteAmapPoiIds(cloudRows);
    const poiCache =
      amapPoiIds.length > 0
        ? await batchFetchPoiFromCloud(amapPoiIds, session.accessToken)
        : new Map<string, TripPlace>();

    favoriteSyncLogger.info(
      "sync.hydrate.prepared",
      {
        cloudRowCount: cloudRows.length,
        poiCacheHitCount: poiCache.size,
        requestedPoiIds: amapPoiIds,
        userId: session.userId,
      },
      "Prepared favorite-place hydrate data",
    );

    cloudRows.forEach((row) => {
      if (!row.id) {
        return;
      }

      if (row.deleted_at) {
        const metadata = syncStore.entities[row.id];

        if (
          !metadata?.dirty ||
          compareIsoTimestamp(row.deleted_at, metadata.localUpdatedAt) >= 0
        ) {
          didMergeCloudChanges =
            nextPlacesById.delete(row.id) || didMergeCloudChanges;
          syncStore = markEntitySynced(syncStore, row.id, {
            cloudUpdatedAt: getCloudRowUpdatedAt(row),
            deletedAt: row.deleted_at,
            lastSyncedAt: syncedAt,
            version: parseCloudRowVersion(row.version),
          });
        }

        return;
      }

      const cloudPlace = getFavoritePlaceFromCloudRow(row, poiCache);

      if (
        !cloudPlace ||
        !shouldAcceptCloudFavoritePlace(
          row,
          nextPlacesById.get(row.id),
          syncStore,
        )
      ) {
        return;
      }

      nextPlacesById.set(row.id, cloudPlace);
      didMergeCloudChanges = true;
      syncStore = markEntitySynced(syncStore, row.id, {
        cloudUpdatedAt: getCloudRowUpdatedAt(row),
        lastSyncedAt: syncedAt,
        version: parseCloudRowVersion(row.version),
      });
    });

    const latestSyncStore = await loadEntitySyncMetadata(
      FAVORITE_PLACE_SYNC_STORAGE_KEY,
    );
    const hasNewerLocalSyncIntent = hasNewerFavoriteDirtySyncIntent(
      latestSyncStore,
      syncStore,
      syncStartedAt,
    );
    syncStore = preserveNewerFavoriteDirtySyncIntent(
      syncStore,
      latestSyncStore,
      syncStartedAt,
    );

    if (didMergeCloudChanges && !hasNewerLocalSyncIntent) {
      places = [...nextPlacesById.values()].sort(
        (left, right) =>
          Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
      );
      await saveFavoritePlaces(places);
      favoriteSyncLogger.info(
        "sync.merge.saved",
        {
          mergedPlaceCount: places.length,
          userId: session.userId,
        },
        "Saved merged favorite places after cloud sync",
      );
    }

    await saveEntitySyncMetadata(FAVORITE_PLACE_SYNC_STORAGE_KEY, syncStore);
    favoriteSyncLogger.info(
      "sync.finished",
      {
        didMergeCloudChanges,
        hasNewerLocalSyncIntent,
        userId: session.userId,
      },
      "Finished favorite-place sync",
    );
  } catch (error) {
    favoriteSyncLogger.error(
      "sync.failed",
      {
        error,
        userId: session.userId,
      },
      "Favorite-place sync failed",
    );
  }
}

function scheduleFavoritePlacesCloudSync(): void {
  if (favoritePlacesCloudSyncPromise) {
    shouldRunFavoritePlacesSyncAgain = true;
    return;
  }

  favoritePlacesCloudSyncPromise = (async () => {
    do {
      shouldRunFavoritePlacesSyncAgain = false;
      await syncFavoritePlacesWithCloud();
    } while (shouldRunFavoritePlacesSyncAgain);
  })().finally(() => {
    favoritePlacesCloudSyncPromise = null;
  });
}

async function markFavoritePlaceDirtyForCloudSync(
  place: FavoritePlaceRecord,
): Promise<void> {
  const session = await getCloudSyncSession();
  if (!session) {
    return;
  }

  const syncStore = markEntityDirty(
    await loadEntitySyncMetadata(FAVORITE_PLACE_SYNC_STORAGE_KEY),
    place.id,
    place.updatedAt,
  );

  await saveEntitySyncMetadata(FAVORITE_PLACE_SYNC_STORAGE_KEY, syncStore);
  scheduleFavoritePlacesCloudSync();
}

async function markFavoritePlaceDeletedForCloudSync(
  placeId: string,
  deletedAt: string,
): Promise<void> {
  const syncStore = markEntityDeleted(
    await loadEntitySyncMetadata(FAVORITE_PLACE_SYNC_STORAGE_KEY),
    placeId,
    deletedAt,
  );
  await saveEntitySyncMetadata(FAVORITE_PLACE_SYNC_STORAGE_KEY, syncStore);

  const session = await getCloudSyncSession();
  if (!session) {
    return;
  }

  scheduleFavoritePlacesCloudSync();
}
export async function getFavoritePlaces(): Promise<FavoritePlaceRecord[]> {
  const places = await readFavoritePlacesFromLocal();

  if (places.length === 0) {
    scheduleFavoritePlacesCloudSync();
  }

  return places;
}

export async function getFavoritePlaceById(
  id: string,
): Promise<FavoritePlaceRecord | undefined> {
  const places = await getFavoritePlaces();
  return places.find((place) => place.id === id);
}

export async function updateFavoritePlaceById(
  id: string,
  updater: (place: FavoritePlaceRecord) => FavoritePlaceRecord,
): Promise<FavoritePlaceRecord | undefined> {
  const places = await getFavoritePlaces();
  const targetIndex = places.findIndex((place) => place.id === id);

  if (targetIndex < 0) {
    return undefined;
  }

  const currentPlace = places[targetIndex];
  const updatedPlace = {
    ...updater(currentPlace),
    id: currentPlace.id,
    favoritedAt: currentPlace.favoritedAt,
    updatedAt: new Date().toISOString(),
  };
  const nextPlaces = places.map((place, index) =>
    index === targetIndex ? updatedPlace : place,
  );

  await saveFavoritePlaces(nextPlaces);
  await markFavoritePlaceDirtyForCloudSync(updatedPlace);
  ensurePoiCached(createTripPlaceFromFavoritePlace(updatedPlace)).catch(
    () => {},
  );

  return updatedPlace;
}

export async function removeFavoritePlace(
  suggestion: PlaceSuggestion,
): Promise<FavoritePlaceRecord[]> {
  const places = await getFavoritePlaces();
  const existingIndex = findFavoritePlaceIndex(places, suggestion);

  if (existingIndex < 0) {
    return places;
  }

  const removedPlace = places[existingIndex];
  const nextPlaces = places.filter((_, index) => index !== existingIndex);
  await saveFavoritePlaces(nextPlaces);

  if (removedPlace) {
    await markFavoritePlaceDeletedForCloudSync(
      removedPlace.id,
      new Date().toISOString(),
    );
  }

  return nextPlaces;
}

export async function removeFavoritePlaceById(
  id: string,
): Promise<FavoritePlaceRecord[]> {
  const places = await getFavoritePlaces();
  const nextPlaces = places.filter((place) => place.id !== id);

  if (nextPlaces.length === places.length) {
    return places;
  }

  await saveFavoritePlaces(nextPlaces);
  await markFavoritePlaceDeletedForCloudSync(id, new Date().toISOString());
  return nextPlaces;
}

let pendingPlaceDetail: TripPlace | null = null;

export function setPendingPlaceDetail(place: TripPlace): void {
  pendingPlaceDetail = place;
}

export function getPendingPlaceDetail(): TripPlace | undefined {
  return pendingPlaceDetail ?? undefined;
}

export function clearPendingPlaceDetail(): void {
  pendingPlaceDetail = null;
}

export function createPreviewTripPlaceFromSuggestion(
  suggestion: PlaceSuggestion,
): TripPlace {
  const providerPlaceId = getProviderPlaceIdFromSuggestion(suggestion);
  const hasDetails =
    suggestion.rating != null ||
    suggestion.phone ||
    suggestion.openingHoursToday ||
    suggestion.costPerPerson;
  const details = hasDetails
    ? {
        rating: suggestion.rating,
        ratingSource: suggestion.rating != null ? "高德" : undefined,
        phone: suggestion.phone,
        openingHours: suggestion.openingHoursToday,
        priceLevel: suggestion.costPerPerson,
      }
    : undefined;
  const photos = suggestion.photos?.map((p, i) => ({
    id: `amap-photo-${providerPlaceId ?? suggestion.id}-${i}`,
    url: p.url,
    sourceLabel: "高德",
  }));

  return {
    id: suggestion.id,
    name: suggestion.name,
    category: suggestion.category,
    isScheduled: false,
    address: suggestion.address,
    area: suggestion.area,
    latitude: suggestion.latitude,
    longitude: suggestion.longitude,
    mapBoundary: suggestion.mapBoundary,
    iconKey: suggestion.iconKey,
    osmKey: suggestion.osmKey,
    osmValue: suggestion.osmValue,
    poiGroup: suggestion.poiGroup,
    poiType: suggestion.poiType,
    provider: suggestion.provider,
    providerPlaceId,
    externalRefs: suggestion.externalRefs,
    details,
    photos: photos && photos.length > 0 ? photos : undefined,
  };
}

/** @deprecated Use createPreviewTripPlaceFromSuggestion for transient search/detail previews. */
export function createTripPlaceFromSuggestion(
  suggestion: PlaceSuggestion,
): TripPlace {
  return createPreviewTripPlaceFromSuggestion(suggestion);
}

export function createTripPlaceFromFavoritePlace(
  place: FavoritePlaceRecord,
): TripPlace {
  return {
    id: place.id,
    name: place.name,
    category: place.category,
    isScheduled: false,
    address: place.address,
    area: place.area,
    latitude: place.latitude,
    longitude: place.longitude,
    mapBoundary: place.mapBoundary,
    note: place.note,
    iconKey: place.iconKey,
    osmKey: place.osmKey,
    osmValue: place.osmValue,
    poiGroup: place.poiGroup,
    poiType: place.poiType,
    providerPlaceId: place.providerPlaceId,
    externalRefs: place.externalRefs,
    details: place.details,
    photos: place.photos,
  };
}

export async function upsertFavoritePlace(
  suggestion: PlaceSuggestion,
): Promise<FavoritePlaceUpsertResult> {
  const places = await getFavoritePlaces();
  const now = new Date().toISOString();
  const nextPlace = createFavoritePlaceFromSuggestion(suggestion, now);
  const existingPlaceIndex = findFavoritePlaceIndex(places, suggestion);
  favoriteSyncLogger.info(
    "favorite.upsert.started",
    {
      existingPlaceIndex,
      placeId: nextPlace.id,
      providerPlaceId: nextPlace.providerPlaceId,
      suggestionProvider: suggestion.provider,
    },
    "Upserting favorite place",
  );

  if (existingPlaceIndex < 0) {
    const nextPlaces = [nextPlace, ...places];

    await saveFavoritePlaces(nextPlaces);
    await markFavoritePlaceDirtyForCloudSync(nextPlace);

    ensurePoiCached(createTripPlaceFromFavoritePlace(nextPlace)).catch((err) =>
      favoriteSyncLogger.warn(
        "poi-cache.ensure.failed",
        { error: err, placeId: nextPlace.id },
        "Failed to ensure favorite place POI cache",
      ),
    );

    favoriteSyncLogger.info(
      "favorite.upsert.created",
      {
        placeId: nextPlace.id,
        providerPlaceId: nextPlace.providerPlaceId,
      },
      "Created new favorite place",
    );

    return {
      added: true,
      place: nextPlace,
      places: nextPlaces,
    };
  }

  const existingPlace = places[existingPlaceIndex];
  const mergedPlace: FavoritePlaceRecord = {
    ...nextPlace,
    ...existingPlace,
    address: existingPlace.address ?? nextPlace.address,
    area: existingPlace.area ?? nextPlace.area,
    latitude: existingPlace.latitude ?? nextPlace.latitude,
    longitude: existingPlace.longitude ?? nextPlace.longitude,
    mapBoundary: existingPlace.mapBoundary ?? nextPlace.mapBoundary,
    note: existingPlace.note ?? nextPlace.note,
    iconKey: existingPlace.iconKey ?? nextPlace.iconKey,
    osmKey: existingPlace.osmKey ?? nextPlace.osmKey,
    osmValue: existingPlace.osmValue ?? nextPlace.osmValue,
    poiGroup: existingPlace.poiGroup ?? nextPlace.poiGroup,
    poiType: existingPlace.poiType ?? nextPlace.poiType,
    providerPlaceId: existingPlace.providerPlaceId ?? nextPlace.providerPlaceId,
    externalRefs: existingPlace.externalRefs ?? nextPlace.externalRefs,
    details: existingPlace.details ?? nextPlace.details,
    photos: existingPlace.photos ?? nextPlace.photos,
    updatedAt: now,
  };
  const nextPlaces = places.filter((_, index) => index !== existingPlaceIndex);
  const sortedPlaces = [mergedPlace, ...nextPlaces];

  await saveFavoritePlaces(sortedPlaces);
  await markFavoritePlaceDirtyForCloudSync(mergedPlace);

  ensurePoiCached(createTripPlaceFromFavoritePlace(mergedPlace)).catch(
    () => {},
  );
  favoriteSyncLogger.info(
    "favorite.upsert.updated",
    {
      placeId: mergedPlace.id,
      providerPlaceId: mergedPlace.providerPlaceId,
    },
    "Updated existing favorite place",
  );

  return {
    added: false,
    place: mergedPlace,
    places: sortedPlaces,
  };
}
