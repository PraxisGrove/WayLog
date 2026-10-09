import {
  handleAuthInvalidated,
  saveRefreshedSessionIfCurrent,
} from "../auth/session-lifecycle";
import { getCurrentAuthUser, refreshSupabaseSession } from "../auth/storage";
import { requestSupabase } from "../auth/supabase";
import { createDiagnosticLogger } from "../diagnostics";
import type { FavoritePlaceRecord } from "./favorite-places";
import { getAmapPoiIdFromPlace } from "./place-identity";
import type { Trip, TripPlace, TripPlaceRef } from "./types";

export type CloudSyncSession = {
  accessToken: string;
  userId: string;
};

export type CloudUserTripRow = {
  created_at?: string | null;
  deleted_at?: string | null;
  destination?: string | null;
  end_date?: string | null;
  id?: string;
  payload?: unknown;
  pinned_at?: string | null;
  start_date?: string | null;
  status?: string | null;
  title?: string | null;
  updated_at?: string | null;
  user_id?: string;
  version?: number | string | null;
};

export type CloudUserFavoritePlaceRow = {
  address?: string | null;
  area?: string | null;
  category?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
  favorited_at?: string | null;
  id?: string;
  latitude?: number | null;
  longitude?: number | null;
  name?: string | null;
  payload?: unknown;
  provider_place_id?: string | null;
  updated_at?: string | null;
  user_id?: string;
  version?: number | string | null;
};

type JsonPayload = Record<string, unknown>;
const cloudSyncLogger = createDiagnosticLogger("cloud-sync");
let inflightCloudSessionRefreshPromise: Promise<CloudSyncSession | null> | null =
  null;

function encodeFilterValue(value: string): string {
  return encodeURIComponent(value);
}

function toDateColumn(value?: string): string | null {
  return value ? value.slice(0, 10) : null;
}

function toTimestampColumn(value?: string): string | null {
  return value ?? null;
}

function normalizeText(value?: string): string {
  return value?.trim() ?? "";
}

function normalizeNumber(value?: number): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseCloudRowVersion(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : undefined;
  }

  return undefined;
}

export function getCloudRowUpdatedAt(row: {
  deleted_at?: string | null;
  updated_at?: string | null;
}): string | undefined {
  return row.deleted_at ?? row.updated_at ?? undefined;
}

export async function getCloudSyncSession(): Promise<CloudSyncSession | null> {
  try {
    const currentUser = await getCurrentAuthUser();

    if (!currentUser?.session.accessToken) {
      cloudSyncLogger.info(
        "session.unavailable",
        {
          hasCurrentUser: Boolean(currentUser),
          userId: currentUser?.user?.id ?? null,
        },
        "Cloud sync session unavailable",
      );
      return null;
    }

    let accessToken = currentUser.session.accessToken;

    if (isJwtExpired(accessToken)) {
      if (!inflightCloudSessionRefreshPromise) {
        cloudSyncLogger.info(
          "session.refresh.started",
          {
            userId: currentUser.user.id,
          },
          "Refreshing expired cloud sync JWT",
        );
        inflightCloudSessionRefreshPromise = (async () => {
          try {
            const refreshedSession = await refreshSupabaseSession(
              currentUser.session,
            );
            const nextAccessToken = refreshedSession.accessToken ?? accessToken;

            await saveRefreshedSessionIfCurrent(
              currentUser.session,
              refreshedSession,
            );

            cloudSyncLogger.info(
              "session.refresh.succeeded",
              {
                userId: currentUser.user.id,
              },
              "Refreshed cloud sync JWT",
            );
            return {
              accessToken: nextAccessToken,
              userId: currentUser.user.id,
            };
          } catch (refreshError) {
            cloudSyncLogger.error(
              "session.refresh.failed",
              {
                error: refreshError,
                userId: currentUser.user.id,
              },
              "Failed to refresh cloud sync JWT",
            );
            await handleAuthInvalidated();
            return null;
          } finally {
            inflightCloudSessionRefreshPromise = null;
          }
        })();
      }

      const refreshedCloudSession = await inflightCloudSessionRefreshPromise;
      if (!refreshedCloudSession) {
        return null;
      }

      accessToken = refreshedCloudSession.accessToken;
    }

    cloudSyncLogger.debug(
      "session.ready",
      {
        userId: currentUser.user.id,
      },
      "Prepared cloud sync session",
    );
    return {
      accessToken,
      userId: currentUser.user.id,
    };
  } catch (error) {
    cloudSyncLogger.error(
      "session.read.failed",
      {
        error,
      },
      "Failed to read cloud sync session",
    );
    return null;
  }
}

function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const expiresAt = payload.exp * 1000;
    return Date.now() > expiresAt - 60 * 1000;
  } catch {
    return true;
  }
}

function createCloudTripRow(
  session: CloudSyncSession,
  trip: Trip,
): Record<string, unknown> {
  return {
    user_id: session.userId,
    id: trip.id,
    title: normalizeText(trip.title),
    destination: normalizeText(trip.destination),
    status: normalizeText(trip.status),
    start_date: toDateColumn(trip.startDate),
    end_date: toDateColumn(trip.endDate),
    pinned_at: toTimestampColumn(trip.pinnedAt),
    payload: stripTripForCloud(trip) as unknown as JsonPayload,
    deleted_at: null,
  };
}

function extractPlaceRefOrCustom(place: TripPlace): TripPlaceRef | TripPlace {
  const amapPoiId = getAmapPoiIdFromPlace(place);

  if (!amapPoiId) {
    return place;
  }

  return {
    id: place.id,
    amapPoiId,
    category: place.category,
    note: place.note,
    isScheduled: place.isScheduled,
    plannedCount: place.details?.plannedCount,
    visitedCount: place.details?.visitedCount,
    cautions: place.details?.cautions,
  };
}

export function stripTripForCloud(trip: Trip): Record<string, unknown> {
  const { places, ...rest } = trip;

  return {
    ...rest,
    places: places.map(extractPlaceRefOrCustom),
  };
}

function isFullPlaceData(place: Record<string, unknown>): boolean {
  return (
    typeof place.name === "string" &&
    place.name.length > 0 &&
    (typeof place.latitude === "number" || place.latitude === undefined)
  );
}

export function hydrateTripPlacesFromCloud(
  payloadRow: Record<string, unknown>,
  poiCache: Map<string, TripPlace>,
): Record<string, unknown> {
  const rawPlaces = payloadRow.places;

  if (!Array.isArray(rawPlaces)) {
    return payloadRow;
  }

  const seenAmapPoiIds = new Map<string, number>();

  const hydratedPlaces = rawPlaces.map((rawPlace) => {
    if (typeof rawPlace !== "object" || rawPlace === null) {
      return rawPlace;
    }

    const place = rawPlace as Record<string, unknown>;

    if (isFullPlaceData(place)) {
      return place;
    }

    const amapPoiId = place.amapPoiId as string | undefined;

    if (!amapPoiId) {
      return place;
    }

    const occurrence = seenAmapPoiIds.get(amapPoiId) ?? 0;
    seenAmapPoiIds.set(amapPoiId, occurrence + 1);
    const persistedPlaceId =
      typeof place.id === "string" && place.id.trim() ? place.id : undefined;
    const placeId =
      persistedPlaceId ??
      (occurrence === 0
        ? `amap-${amapPoiId}`
        : `amap-${amapPoiId}-${occurrence}`);

    const cached = poiCache.get(amapPoiId);

    if (!cached) {
      return {
        id: placeId,
        name: "",
        category: place.category ?? "其他",
        isScheduled: place.isScheduled ?? false,
        note: place.note,
        externalRefs: { amapPoiId },
        details: {
          plannedCount: place.plannedCount,
          visitedCount: place.visitedCount,
          cautions: place.cautions,
        },
      };
    }

    return {
      ...cached,
      id: placeId,
      category: place.category ?? cached.category,
      note: place.note ?? cached.note,
      isScheduled: place.isScheduled ?? false,
      details: {
        ...cached.details,
        plannedCount: place.plannedCount ?? cached.details?.plannedCount,
        visitedCount: place.visitedCount ?? cached.details?.visitedCount,
        cautions: place.cautions ?? cached.details?.cautions,
      },
    };
  });

  return {
    ...payloadRow,
    places: hydratedPlaces,
  };
}

export function hydrateFavoritePlaceFromCloud(
  payloadRow: Record<string, unknown>,
  poiCache: Map<string, TripPlace>,
): Record<string, unknown> {
  const providerPlaceId = payloadRow.providerPlaceId as string | undefined;

  if (!providerPlaceId) {
    return payloadRow;
  }

  if (typeof payloadRow.name === "string" && payloadRow.name.length > 0) {
    return payloadRow;
  }

  const cached = poiCache.get(providerPlaceId) as
    | Record<string, unknown>
    | undefined;

  if (!cached) {
    return {
      ...payloadRow,
      name: "",
      category: "其他",
    };
  }

  return {
    ...cached,
    ...payloadRow,
    name: cached.name ?? "",
    category: cached.category ?? "其他",
    address: cached.address,
    area: cached.area,
    latitude: cached.latitude,
    longitude: cached.longitude,
    iconKey: cached.iconKey,
    osmKey: cached.osmKey,
    osmValue: cached.osmValue,
    poiGroup: cached.poiGroup,
    poiType: cached.poiType,
    externalRefs: cached.externalRefs,
    mapBoundary: cached.mapBoundary,
    details: cached.details,
    photos: cached.photos,
  };
}

function stripFavoritePlaceForCloud(
  place: FavoritePlaceRecord,
): Record<string, unknown> {
  if (!place.providerPlaceId) {
    return place as unknown as Record<string, unknown>;
  }

  return {
    providerPlaceId: place.providerPlaceId,
    note: place.note,
    favoritedAt: place.favoritedAt,
    updatedAt: place.updatedAt,
  };
}

function createCloudFavoritePlaceRow(
  session: CloudSyncSession,
  place: FavoritePlaceRecord,
): Record<string, unknown> {
  return {
    user_id: session.userId,
    id: place.id,
    name: normalizeText(place.name),
    category: normalizeText(place.category),
    area: place.area ?? null,
    address: place.address ?? null,
    latitude: normalizeNumber(place.latitude),
    longitude: normalizeNumber(place.longitude),
    provider_place_id: place.providerPlaceId ?? null,
    favorited_at: toTimestampColumn(place.favoritedAt),
    payload: stripFavoritePlaceForCloud(place) as unknown as JsonPayload,
    deleted_at: null,
  };
}

export async function fetchCloudTripRows(
  session: CloudSyncSession,
): Promise<CloudUserTripRow[]> {
  cloudSyncLogger.debug(
    "user-trips.fetch.started",
    {
      userId: session.userId,
    },
    "Fetching cloud trip rows",
  );

  const rows = await requestSupabase<CloudUserTripRow[]>({
    accessToken: session.accessToken,
    method: "GET",
    path: `user_trips?user_id=eq.${encodeFilterValue(
      session.userId,
    )}&select=id,user_id,title,destination,status,start_date,end_date,pinned_at,payload,version,deleted_at,created_at,updated_at&order=updated_at.desc`,
    service: "rest",
  });

  cloudSyncLogger.info(
    "user-trips.fetch.finished",
    {
      rowCount: rows.length,
      userId: session.userId,
    },
    "Fetched cloud trip rows",
  );

  return rows;
}

export async function upsertCloudTripRows(
  session: CloudSyncSession,
  trips: Trip[],
): Promise<CloudUserTripRow[]> {
  if (trips.length === 0) {
    cloudSyncLogger.debug(
      "user-trips.upsert.skipped-empty",
      {
        userId: session.userId,
      },
      "Skipped cloud trip upsert because there are no trips",
    );
    return [];
  }

  cloudSyncLogger.info(
    "user-trips.upsert.started",
    {
      tripIds: trips.map((trip) => trip.id),
      tripCount: trips.length,
      userId: session.userId,
    },
    "Upserting cloud trip rows",
  );

  const rows = await requestSupabase<CloudUserTripRow[]>({
    accessToken: session.accessToken,
    body: trips.map((trip) => createCloudTripRow(session, trip)),
    method: "POST",
    path: "user_trips?on_conflict=user_id,id",
    prefer: "resolution=merge-duplicates,return=representation",
    service: "rest",
  });

  cloudSyncLogger.info(
    "user-trips.upsert.finished",
    {
      returnedRowCount: rows.length,
      tripCount: trips.length,
      userId: session.userId,
    },
    "Finished upserting cloud trip rows",
  );

  return rows;
}

export async function markCloudTripDeleted(
  session: CloudSyncSession,
  tripId: string,
  deletedAt: string,
): Promise<CloudUserTripRow[]> {
  cloudSyncLogger.info(
    "user-trips.delete.started",
    {
      deletedAt,
      tripId,
      userId: session.userId,
    },
    "Marking cloud trip as deleted",
  );

  const rows = await requestSupabase<CloudUserTripRow[]>({
    accessToken: session.accessToken,
    body: {
      deleted_at: deletedAt,
    },
    method: "PATCH",
    path: `user_trips?user_id=eq.${encodeFilterValue(session.userId)}&id=eq.${encodeFilterValue(tripId)}`,
    prefer: "return=representation",
    service: "rest",
  });

  cloudSyncLogger.info(
    "user-trips.delete.finished",
    {
      deletedAt,
      returnedRowCount: rows.length,
      tripId,
      userId: session.userId,
    },
    "Marked cloud trip as deleted",
  );

  return rows;
}

export async function fetchCloudFavoritePlaceRows(
  session: CloudSyncSession,
): Promise<CloudUserFavoritePlaceRow[]> {
  cloudSyncLogger.debug(
    "favorite-places.fetch.started",
    {
      userId: session.userId,
    },
    "Fetching cloud favorite place rows",
  );

  const rows = await requestSupabase<CloudUserFavoritePlaceRow[]>({
    accessToken: session.accessToken,
    method: "GET",
    path: `user_favorite_places?user_id=eq.${encodeFilterValue(
      session.userId,
    )}&select=id,user_id,name,category,area,address,latitude,longitude,provider_place_id,favorited_at,payload,version,deleted_at,created_at,updated_at&order=updated_at.desc`,
    service: "rest",
  });

  cloudSyncLogger.info(
    "favorite-places.fetch.finished",
    {
      rowCount: rows.length,
      userId: session.userId,
    },
    "Fetched cloud favorite place rows",
  );

  return rows;
}

export async function upsertCloudFavoritePlaceRows(
  session: CloudSyncSession,
  places: FavoritePlaceRecord[],
): Promise<CloudUserFavoritePlaceRow[]> {
  if (places.length === 0) {
    cloudSyncLogger.debug(
      "favorite-places.upsert.skipped-empty",
      {
        userId: session.userId,
      },
      "Skipped cloud favorite-place upsert because there are no places",
    );
    return [];
  }

  cloudSyncLogger.info(
    "favorite-places.upsert.started",
    {
      placeCount: places.length,
      placeIds: places.map((place) => place.id),
      userId: session.userId,
    },
    "Upserting cloud favorite-place rows",
  );

  const rows = await requestSupabase<CloudUserFavoritePlaceRow[]>({
    accessToken: session.accessToken,
    body: places.map((place) => createCloudFavoritePlaceRow(session, place)),
    method: "POST",
    path: "user_favorite_places?on_conflict=user_id,id",
    prefer: "resolution=merge-duplicates,return=representation",
    service: "rest",
  });

  cloudSyncLogger.info(
    "favorite-places.upsert.finished",
    {
      placeCount: places.length,
      returnedRowCount: rows.length,
      userId: session.userId,
    },
    "Finished upserting cloud favorite-place rows",
  );

  return rows;
}

export async function markCloudFavoritePlaceDeleted(
  session: CloudSyncSession,
  placeId: string,
  deletedAt: string,
): Promise<CloudUserFavoritePlaceRow[]> {
  cloudSyncLogger.info(
    "favorite-places.delete.started",
    {
      deletedAt,
      placeId,
      userId: session.userId,
    },
    "Marking cloud favorite place as deleted",
  );

  const rows = await requestSupabase<CloudUserFavoritePlaceRow[]>({
    accessToken: session.accessToken,
    body: {
      deleted_at: deletedAt,
    },
    method: "PATCH",
    path: `user_favorite_places?user_id=eq.${encodeFilterValue(session.userId)}&id=eq.${encodeFilterValue(placeId)}`,
    prefer: "return=representation",
    service: "rest",
  });

  cloudSyncLogger.info(
    "favorite-places.delete.finished",
    {
      deletedAt,
      placeId,
      returnedRowCount: rows.length,
      userId: session.userId,
    },
    "Marked cloud favorite place as deleted",
  );

  return rows;
}
//
export type CloudUserPreferenceRow = {
  created_at?: string | null;
  preference_key?: string;
  payload?: unknown;
  updated_at?: string | null;
  user_id?: string;
  version?: number | string | null;
};

function createCloudPreferenceRow(
  session: CloudSyncSession,
  preferenceKey: string,
  preference: unknown,
): Record<string, unknown> {
  return {
    user_id: session.userId,
    preference_key: preferenceKey,
    payload: preference as JsonPayload,
  };
}

export async function fetchCloudPreferenceRow(
  session: CloudSyncSession,
  preferenceKey: string,
): Promise<CloudUserPreferenceRow | undefined> {
  const rows = await requestSupabase<CloudUserPreferenceRow[]>({
    accessToken: session.accessToken,
    method: "GET",
    path: `user_preferences?user_id=eq.${encodeFilterValue(
      session.userId,
    )}&preference_key=eq.${encodeFilterValue(
      preferenceKey,
    )}&select=user_id,preference_key,payload,version,created_at,updated_at&limit=1`,
    service: "rest",
  });

  return rows[0];
}

export async function upsertCloudPreferenceRow(
  session: CloudSyncSession,
  preferenceKey: string,
  preference: unknown,
): Promise<CloudUserPreferenceRow | undefined> {
  const rows = await requestSupabase<CloudUserPreferenceRow[]>({
    accessToken: session.accessToken,
    body: [createCloudPreferenceRow(session, preferenceKey, preference)],
    method: "POST",
    path: "user_preferences?on_conflict=user_id,preference_key",
    prefer: "resolution=merge-duplicates,return=representation",
    service: "rest",
  });

  return rows[0];
}
