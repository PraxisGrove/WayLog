import AsyncStorage from "@react-native-async-storage/async-storage";

import { createDiagnosticLogger } from "../diagnostics";
import { createDefaultTripChecklistItems } from "./checklist";
import {
  createTripChecklistItemsFromTemplate,
  getSelectedTripChecklistTemplate,
  getTripChecklistTemplatePreference,
} from "./checklist-templates";
import type { CloudUserTripRow } from "./cloud-sync";
import {
  fetchCloudTripRows,
  getCloudRowUpdatedAt,
  getCloudSyncSession,
  hydrateTripPlacesFromCloud,
  markCloudTripDeleted,
  parseCloudRowVersion,
  upsertCloudTripRows,
} from "./cloud-sync";
import {
  DEFAULT_TRIP_CURRENCY_CODE,
  normalizeTripCurrencyCode,
} from "./currency";
import { formatTripDayTitle, isDefaultTripDayTitle } from "./day-title";
import { resolveTripDestination } from "./destination";
import { emitTripsUpdated } from "./events";
import {
  normalizeExpenseAmount,
  normalizeExpenseCategory,
  normalizeExpenseCurrency,
} from "./expenses";
import {
  inferPlaceKind,
  isTripPlaceIconKey,
  isTripPlacePoiGroup,
} from "./place-kind";
import {
  batchFetchPoiFromCloud,
  batchSyncPoiToCloud,
  ensurePoiCached,
  hydratePoiFromCloudOrSaveBase,
} from "./poi-cache";
import { seedTrips } from "./seed";
import { seedRouteCacheIfNeeded } from "./seed-route-cache";
import { applyTripAutoStatus, normalizeTripStatus } from "./status";
import {
  runWithTripSyncMetadataWriteLock,
  runWithTripsLocalWriteLock,
} from "./local-write-coordinator";
import type {
  EntitySyncMetadata,
  EntitySyncMetadataStore,
} from "./sync-metadata";
import {
  clearEntitySyncMetadata,
  loadEntitySyncMetadata,
  markEntityDeleted,
  markEntityDirty,
  markEntitySynced,
  markEntitySyncFailed,
  removeEntitySyncMetadata,
  saveEntitySyncMetadata,
} from "./sync-metadata";
import type {
  CreateTripImportSourceInput,
  CreateTripInput,
  Trip,
  TripBudget,
  TripChecklistItem,
  TripDay,
  TripDayItem,
  TripExpense,
  TripGeoCoordinate,
  TripImportSource,
  TripLodging,
  TripMemo,
  TripPlace,
  TripPlaceCategory,
  TripPlaceDetails,
  TripPlaceExternalRefs,
  TripPlaceMapBoundary,
  TripPlacePhoto,
  TripTransport,
} from "./types";

export const TRIPS_STORAGE_KEY = "waylog.trips.v1";
const tripStorageLogger = createDiagnosticLogger("trip-storage");

let cachedTrips: Trip[] | null = null;

const TRIP_SYNC_STORAGE_KEY = "waylog.trip_sync.v1";

const TRIPS_SEEDED_KEY = "waylog.trips.seeded.v2";

const TRIPS_SEED_DISMISSED_KEY = "waylog.trips.seed.dismissed.v1";

const CURRENT_SEED_TRIP_ID = "seed-xian";

const LEGACY_SEED_TRIP_IDS = new Set([
  "seed-osaka",
  "seed-yunnan",
  "seed-hangzhou",
]);

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export async function clearTripSyncMetadata(): Promise<void> {
  await clearEntitySyncMetadata(TRIP_SYNC_STORAGE_KEY);
}

export async function clearLocalTripData(): Promise<void> {
  cachedTrips = null;
  await Promise.all([
    AsyncStorage.removeItem(TRIPS_STORAGE_KEY),
    AsyncStorage.removeItem(TRIPS_SEEDED_KEY),
    AsyncStorage.removeItem(TRIPS_SEED_DISMISSED_KEY),
    clearEntitySyncMetadata(TRIP_SYNC_STORAGE_KEY),
  ]);
}

export function invalidateTripsCache(): void {
  cachedTrips = null;
}

const createId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function shouldRefreshDayTitle(day: TripDay): boolean {
  return isDefaultTripDayTitle(day);
}

export function renumberTripDays(days: TripDay[]): TripDay[] {
  return days.map((day, index) => {
    const dayIndex = index + 1;

    return {
      ...day,
      dayIndex,
      title: shouldRefreshDayTitle(day)
        ? formatTripDayTitle(dayIndex)
        : day.title.trim(),
    };
  });
}

function hasOwnValue(source: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(source, key);
}

function normalizeIsoDateString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : value;
}

function normalizeDayItems(items: unknown): TripDayItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .map((item, index) => {
      const cost = normalizeExpenseAmount(item.cost);

      return {
        id:
          typeof item.id === "string" ? item.id : createId(`item-${index + 1}`),
        title: typeof item.title === "string" ? item.title : "未命名安排",
        category:
          item.category === "景点" ||
          item.category === "餐厅" ||
          item.category === "酒店" ||
          item.category === "交通" ||
          item.category === "购物" ||
          item.category === "教育" ||
          item.category === "医疗" ||
          item.category === "其他"
            ? item.category
            : undefined,
        time: typeof item.time === "string" ? item.time : undefined,
        iconKey: isTripPlaceIconKey(item.iconKey) ? item.iconKey : undefined,
        placeId: typeof item.placeId === "string" ? item.placeId : undefined,
        placeName:
          typeof item.placeName === "string" ? item.placeName : undefined,
        note: typeof item.note === "string" ? item.note : undefined,
        cost,
        costRecordedAt:
          cost === undefined
            ? undefined
            : normalizeIsoDateString(item.costRecordedAt),
        recommendationReason:
          typeof item.recommendationReason === "string" &&
          item.recommendationReason.trim()
            ? item.recommendationReason.trim()
            : undefined,
      };
    });
}

function normalizeTripBudget(value: unknown): TripBudget | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const amount = normalizeExpenseAmount(source.amount);

  return {
    amount,
    currency: normalizeExpenseCurrency(source.currency),
  };
}

function normalizeTripCurrency(
  value: unknown,
  fallbackCurrency?: unknown,
): string {
  return normalizeTripCurrencyCode(
    value ?? fallbackCurrency ?? DEFAULT_TRIP_CURRENCY_CODE,
  );
}

function normalizeTripGeneralNote(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isValidExpenseDate(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return true;
  }

  return !Number.isNaN(Date.parse(value));
}

function normalizeTripExpenses(expenses: unknown): TripExpense[] {
  if (!Array.isArray(expenses)) {
    return [];
  }

  return expenses
    .filter(
      (expense): expense is Record<string, unknown> =>
        typeof expense === "object" && expense !== null,
    )
    .map((expense, index): TripExpense | undefined => {
      const amount = normalizeExpenseAmount(expense.amount);

      if (amount === undefined) {
        return undefined;
      }

      const now = new Date().toISOString();
      const createdAt = normalizeIsoDateString(expense.createdAt) ?? now;

      return {
        id:
          typeof expense.id === "string"
            ? expense.id
            : createId(`expense-${index + 1}`),
        title:
          typeof expense.title === "string" && expense.title.trim()
            ? expense.title.trim()
            : normalizeExpenseCategory(expense.category) === "其他"
              ? "旅行开销"
              : `${normalizeExpenseCategory(expense.category)}开销`,
        amount,
        category: normalizeExpenseCategory(expense.category),
        currency: normalizeExpenseCurrency(expense.currency),
        date: isValidExpenseDate(expense.date) ? expense.date : undefined,
        dayId: typeof expense.dayId === "string" ? expense.dayId : undefined,
        placeId:
          typeof expense.placeId === "string" ? expense.placeId : undefined,
        placeName:
          typeof expense.placeName === "string" ? expense.placeName : undefined,
        note:
          typeof expense.note === "string" && expense.note.trim()
            ? expense.note.trim()
            : undefined,
        paidBy:
          typeof expense.paidBy === "string" && expense.paidBy.trim()
            ? expense.paidBy.trim()
            : undefined,
        createdAt,
        updatedAt: normalizeIsoDateString(expense.updatedAt) ?? createdAt,
      };
    })
    .filter((expense): expense is TripExpense => Boolean(expense));
}

function normalizeTripDays(days: unknown): TripDay[] {
  if (!Array.isArray(days)) {
    return [createTripDay(1)];
  }

  return days
    .filter(
      (day): day is Record<string, unknown> =>
        typeof day === "object" && day !== null,
    )
    .map((day, index) => {
      const dayIndex =
        typeof day.dayIndex === "number" ? day.dayIndex : index + 1;

      return {
        id: typeof day.id === "string" ? day.id : createId(`day-${dayIndex}`),
        dayIndex,
        title:
          typeof day.title === "string"
            ? day.title
            : formatTripDayTitle(dayIndex),
        summary:
          typeof day.summary === "string" && day.summary.trim()
            ? day.summary.trim()
            : undefined,
        items: normalizeDayItems(day.items),
      };
    });
}

function normalizeTripPlaceCategory(
  value: unknown,
  fallback: TripPlaceCategory = "其他",
): TripPlaceCategory {
  return value === "景点" ||
    value === "餐厅" ||
    value === "酒店" ||
    value === "交通" ||
    value === "购物" ||
    value === "教育" ||
    value === "医疗" ||
    value === "其他"
    ? value
    : fallback;
}

function normalizeTripPlaceExternalRefs(
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

function normalizeTripGeoCoordinate(
  value: unknown,
): TripGeoCoordinate | undefined {
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

function normalizeTripPlaceMapBoundary(
  value: unknown,
): TripPlaceMapBoundary | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const boundary = value
    .map((path) =>
      Array.isArray(path)
        ? path
            .map(normalizeTripGeoCoordinate)
            .filter((coordinate): coordinate is TripGeoCoordinate =>
              Boolean(coordinate),
            )
        : [],
    )
    .filter((path) => path.length >= 3);

  return boundary.length > 0 ? boundary : undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
  return items.length > 0 ? items : undefined;
}

function normalizeTripPlacePhotos(
  value: unknown,
): TripPlacePhoto[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const photos = value
    .filter(
      (photo): photo is Record<string, unknown> =>
        typeof photo === "object" && photo !== null,
    )
    .map((photo, index) => {
      const url = typeof photo.url === "string" ? photo.url.trim() : "";

      if (!url) {
        return undefined;
      }

      const normalizedPhoto: TripPlacePhoto = {
        id: typeof photo.id === "string" ? photo.id : `photo-${index + 1}`,
        url,
      };

      if (typeof photo.sourceLabel === "string") {
        normalizedPhoto.sourceLabel = photo.sourceLabel;
      }

      if (typeof photo.sourceUrl === "string") {
        normalizedPhoto.sourceUrl = photo.sourceUrl;
      }

      if (typeof photo.credit === "string") {
        normalizedPhoto.credit = photo.credit;
      }

      const width = normalizeFiniteNumber(photo.width);
      const height = normalizeFiniteNumber(photo.height);

      if (width !== undefined) {
        normalizedPhoto.width = width;
      }

      if (height !== undefined) {
        normalizedPhoto.height = height;
      }

      if (typeof photo.isCover === "boolean") {
        normalizedPhoto.isCover = photo.isCover;
      }

      return normalizedPhoto;
    })
    .filter((photo): photo is TripPlacePhoto => Boolean(photo));

  return photos.length > 0 ? photos : undefined;
}

function normalizeTripPlaceDetails(
  value: unknown,
): TripPlaceDetails | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const details: TripPlaceDetails = {
    summary: typeof source.summary === "string" ? source.summary : undefined,
    highlights: normalizeStringArray(source.highlights),
    cautions: normalizeStringArray(source.cautions),
    openingHours:
      typeof source.openingHours === "string" ? source.openingHours : undefined,
    phone: typeof source.phone === "string" ? source.phone : undefined,
    website: typeof source.website === "string" ? source.website : undefined,
    ticketInfo:
      typeof source.ticketInfo === "string" ? source.ticketInfo : undefined,
    visitDuration:
      typeof source.visitDuration === "string"
        ? source.visitDuration
        : undefined,
    rating: normalizeFiniteNumber(source.rating),
    ratingSource:
      typeof source.ratingSource === "string" ? source.ratingSource : undefined,
    reviewCount: normalizeFiniteNumber(source.reviewCount),
    plannedCount: normalizeFiniteNumber(source.plannedCount),
    visitedCount: normalizeFiniteNumber(source.visitedCount),
    priceLevel:
      typeof source.priceLevel === "string" ? source.priceLevel : undefined,
  };

  return Object.values(details).some((field) =>
    Array.isArray(field) ? field.length > 0 : Boolean(field),
  )
    ? details
    : undefined;
}

function normalizeUserPlaceNote(
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

function normalizePlaces(places: unknown): TripPlace[] {
  if (!Array.isArray(places)) {
    return [];
  }

  return places
    .filter(
      (place): place is Record<string, unknown> =>
        typeof place === "object" && place !== null,
    )
    .map((place, index) => {
      const name = typeof place.name === "string" ? place.name : "未命名地点";
      const category = normalizeTripPlaceCategory(place.category);
      const osmKey =
        typeof place.osmKey === "string" ? place.osmKey : undefined;
      const osmValue =
        typeof place.osmValue === "string" ? place.osmValue : undefined;
      const inferredKind = inferPlaceKind({
        category,
        name,
        osmKey,
        osmValue,
      });

      return {
        id:
          typeof place.id === "string"
            ? place.id
            : createId(`place-${index + 1}`),
        name,
        category,
        isScheduled:
          typeof place.isScheduled === "boolean" ? place.isScheduled : false,
        address: typeof place.address === "string" ? place.address : undefined,
        latitude:
          typeof place.latitude === "number" ? place.latitude : undefined,
        longitude:
          typeof place.longitude === "number" ? place.longitude : undefined,
        mapBoundary: normalizeTripPlaceMapBoundary(place.mapBoundary),
        note: normalizeUserPlaceNote(
          place.note,
          typeof place.address === "string" ? place.address : undefined,
        ),
        area: typeof place.area === "string" ? place.area : undefined,
        iconKey: isTripPlaceIconKey(place.iconKey)
          ? place.iconKey
          : inferredKind.iconKey,
        osmKey,
        osmValue,
        poiGroup: isTripPlacePoiGroup(place.poiGroup)
          ? place.poiGroup
          : inferredKind.poiGroup,
        poiType:
          typeof place.poiType === "string"
            ? place.poiType
            : inferredKind.poiType,
        providerPlaceId:
          typeof place.providerPlaceId === "string"
            ? place.providerPlaceId
            : undefined,
        externalRefs: normalizeTripPlaceExternalRefs(place.externalRefs),
        photos: normalizeTripPlacePhotos(place.photos),
        details: normalizeTripPlaceDetails(place.details),
      };
    });
}

function findPlaceForDayItem(
  places: TripPlace[],
  item: TripDayItem,
): TripPlace | undefined {
  const itemPlaceName = item.placeName ?? item.title;

  return places.find((place) => {
    if (item.placeId && place.id === item.placeId) {
      return true;
    }

    if (place.name === itemPlaceName || place.name === item.title) {
      return true;
    }

    return (
      item.title.includes(place.name) || itemPlaceName.includes(place.name)
    );
  });
}

function createPlaceFromDayItem(item: TripDayItem, index: number): TripPlace {
  const name = item.placeName ?? item.title;
  const category = normalizeTripPlaceCategory(item.category);
  const inferredKind = inferPlaceKind({
    category,
    name,
  });

  return {
    id: item.placeId ?? createId(`place-from-item-${index + 1}`),
    name,
    category,
    isScheduled: true,
    note: item.note,
    iconKey: item.iconKey ?? inferredKind.iconKey,
    poiGroup: inferredKind.poiGroup,
    poiType: inferredKind.poiType,
  };
}

function syncDayItemsWithPlaces(
  days: TripDay[],
  places: TripPlace[],
): { days: TripDay[]; places: TripPlace[] } {
  const nextPlaces = [...places];
  let createdPlaceIndex = 0;

  const nextDays = days.map((day) => ({
    ...day,
    items: day.items.map((item) => {
      const existingPlace = findPlaceForDayItem(nextPlaces, item);
      const place =
        existingPlace ?? createPlaceFromDayItem(item, createdPlaceIndex++);

      if (!existingPlace) {
        nextPlaces.push(place);
      } else if (!existingPlace.isScheduled) {
        const placeIndex = nextPlaces.findIndex(
          (nextPlace) => nextPlace.id === existingPlace.id,
        );

        if (placeIndex >= 0) {
          nextPlaces[placeIndex] = {
            ...existingPlace,
            isScheduled: true,
          };
        }
      }

      return {
        ...item,
        title: place.name,
        category: item.category ?? place.category,
        iconKey: item.iconKey ?? place.iconKey,
        placeId: place.id,
        placeName: place.name,
      };
    }),
  }));

  return {
    days: nextDays,
    places: nextPlaces,
  };
}

function mergePlacesWithFallback(
  places: TripPlace[],
  fallbackPlaces: TripPlace[],
): TripPlace[] {
  const nextPlaces = [...places];

  fallbackPlaces.forEach((fallbackPlace) => {
    const existingPlaceIndex = nextPlaces.findIndex(
      (place) =>
        place.id === fallbackPlace.id || place.name === fallbackPlace.name,
    );

    if (existingPlaceIndex < 0) {
      nextPlaces.push(fallbackPlace);
      return;
    }

    const existingPlace = nextPlaces[existingPlaceIndex];
    nextPlaces[existingPlaceIndex] = {
      ...fallbackPlace,
      ...existingPlace,
      isScheduled: existingPlace.isScheduled || fallbackPlace.isScheduled,
      latitude: existingPlace.latitude ?? fallbackPlace.latitude,
      longitude: existingPlace.longitude ?? fallbackPlace.longitude,
      mapBoundary: existingPlace.mapBoundary ?? fallbackPlace.mapBoundary,
      iconKey: existingPlace.iconKey ?? fallbackPlace.iconKey,
      poiGroup: existingPlace.poiGroup ?? fallbackPlace.poiGroup,
      poiType: existingPlace.poiType ?? fallbackPlace.poiType,
      externalRefs:
        existingPlace.externalRefs || fallbackPlace.externalRefs
          ? {
              ...fallbackPlace.externalRefs,
              ...existingPlace.externalRefs,
            }
          : undefined,
    };
  });

  return nextPlaces;
}

function getFallbackPlacesForDayItems(
  days: TripDay[],
  fallbackPlaces: TripPlace[],
): TripPlace[] {
  return fallbackPlaces.filter((fallbackPlace) =>
    days.some((day) =>
      day.items.some((item) => {
        const itemPlaceName = item.placeName ?? item.title;

        return (
          item.placeId === fallbackPlace.id ||
          itemPlaceName === fallbackPlace.name ||
          item.title === fallbackPlace.name ||
          item.title.includes(fallbackPlace.name)
        );
      }),
    ),
  );
}

function normalizeTransports(transports: unknown): TripTransport[] {
  if (!Array.isArray(transports)) {
    return [];
  }

  return transports
    .filter(
      (transport): transport is Record<string, unknown> =>
        typeof transport === "object" && transport !== null,
    )
    .map((transport, index) => ({
      id:
        typeof transport.id === "string"
          ? transport.id
          : createId(`transport-${index + 1}`),
      type:
        transport.type === "航班" ||
        transport.type === "火车" ||
        transport.type === "自驾" ||
        transport.type === "巴士" ||
        transport.type === "其他"
          ? transport.type
          : "其他",
      title: typeof transport.title === "string" ? transport.title : "交通安排",
      detail:
        typeof transport.detail === "string" ? transport.detail : undefined,
      departureTime:
        typeof transport.departureTime === "string"
          ? transport.departureTime
          : undefined,
      arrivalTime:
        typeof transport.arrivalTime === "string"
          ? transport.arrivalTime
          : undefined,
      note: typeof transport.note === "string" ? transport.note : undefined,
    }));
}

function normalizeLodgings(lodgings: unknown): TripLodging[] {
  if (!Array.isArray(lodgings)) {
    return [];
  }

  return lodgings
    .filter(
      (lodging): lodging is Record<string, unknown> =>
        typeof lodging === "object" && lodging !== null,
    )
    .map((lodging, index) => ({
      id:
        typeof lodging.id === "string"
          ? lodging.id
          : createId(`lodging-${index + 1}`),
      name: typeof lodging.name === "string" ? lodging.name : "住宿安排",
      address:
        typeof lodging.address === "string" ? lodging.address : undefined,
      checkIn:
        typeof lodging.checkIn === "string" ? lodging.checkIn : undefined,
      checkOut:
        typeof lodging.checkOut === "string" ? lodging.checkOut : undefined,
      note: typeof lodging.note === "string" ? lodging.note : undefined,
    }));
}

function normalizeMemos(memos: unknown): TripMemo[] {
  if (!Array.isArray(memos)) {
    return [];
  }

  return memos
    .filter(
      (memo): memo is Record<string, unknown> =>
        typeof memo === "object" && memo !== null,
    )
    .map((memo, index) => ({
      id: typeof memo.id === "string" ? memo.id : createId(`memo-${index + 1}`),
      title: typeof memo.title === "string" ? memo.title : "备忘",
      detail: typeof memo.detail === "string" ? memo.detail : undefined,
      pinned: typeof memo.pinned === "boolean" ? memo.pinned : false,
    }));
}

function normalizeChecklistItems(checklistItems: unknown): TripChecklistItem[] {
  if (!Array.isArray(checklistItems)) {
    return createDefaultTripChecklistItems();
  }

  return checklistItems
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .map((item, index) => ({
      id:
        typeof item.id === "string"
          ? item.id
          : createId(`checklist-${index + 1}`),
      title:
        typeof item.title === "string" && item.title.trim()
          ? item.title.trim()
          : "未命名物品",
      isCompleted:
        typeof item.isCompleted === "boolean" ? item.isCompleted : false,
    }));
}

async function createChecklistItemsForNewTrip(
  input: CreateTripInput,
): Promise<TripChecklistItem[]> {
  if (input.checklistItems) {
    return input.checklistItems;
  }

  try {
    const preference = await getTripChecklistTemplatePreference();
    return createTripChecklistItemsFromTemplate(
      getSelectedTripChecklistTemplate(preference),
    );
  } catch (error) {
    tripStorageLogger.warn(
      "checklist-template.preference.load.failed",
      { error },
      "Failed to load checklist template preference for new trip",
    );
    return createDefaultTripChecklistItems();
  }
}

function normalizeImportSources(importSources: unknown): TripImportSource[] {
  if (!Array.isArray(importSources)) {
    return [];
  }

  return importSources
    .filter(
      (source): source is Record<string, unknown> =>
        typeof source === "object" && source !== null,
    )
    .map((source, index) => ({
      id:
        typeof source.id === "string"
          ? source.id
          : createId(`source-${index + 1}`),
      title: typeof source.title === "string" ? source.title : "导入来源",
      sourceType:
        source.sourceType === "link" ||
        source.sourceType === "text" ||
        source.sourceType === "image"
          ? source.sourceType
          : "link",
      status:
        source.status === "待解析" ||
        source.status === "已导入" ||
        source.status === "占位"
          ? source.status
          : "占位",
    }));
}

function normalizeRouteModeOverrides(
  value: unknown,
): Record<string, "walking" | "cycling" | "transit" | "driving"> | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const validModes = new Set(["walking", "cycling", "transit", "driving"]);
  const source = value as Record<string, unknown>;
  const result: Record<string, "walking" | "cycling" | "transit" | "driving"> =
    {};

  for (const [key, mode] of Object.entries(source)) {
    if (
      typeof key === "string" &&
      key.includes("->") &&
      typeof mode === "string" &&
      validModes.has(mode)
    ) {
      result[key] = mode as "walking" | "cycling" | "transit" | "driving";
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function getRawTripId(rawTrip: unknown): string | undefined {
  if (typeof rawTrip !== "object" || rawTrip === null) {
    return undefined;
  }

  const trip = rawTrip as Record<string, unknown>;
  return typeof trip.id === "string" ? trip.id : undefined;
}

function migrateLegacySeedTrips(rawTrips: unknown[]): {
  didMigrate: boolean;
  trips: unknown[];
} {
  const currentSeedTrip = seedTrips.find(
    (trip) => trip.id === CURRENT_SEED_TRIP_ID,
  );

  if (!currentSeedTrip) {
    return { didMigrate: false, trips: rawTrips };
  }

  let didMigrate = false;
  let hasCurrentSeedTrip = rawTrips.some(
    (rawTrip) => getRawTripId(rawTrip) === CURRENT_SEED_TRIP_ID,
  );
  const trips: unknown[] = [];

  rawTrips.forEach((rawTrip) => {
    const rawTripId = getRawTripId(rawTrip);

    if (!rawTripId || !LEGACY_SEED_TRIP_IDS.has(rawTripId)) {
      trips.push(rawTrip);
      return;
    }

    didMigrate = true;

    if (hasCurrentSeedTrip) {
      return;
    }

    const legacyTrip =
      typeof rawTrip === "object" && rawTrip !== null
        ? (rawTrip as Record<string, unknown>)
        : {};

    trips.push({
      ...currentSeedTrip,
      pinnedAt:
        typeof legacyTrip.pinnedAt === "string"
          ? legacyTrip.pinnedAt
          : currentSeedTrip.pinnedAt,
    });
    hasCurrentSeedTrip = true;
  });

  return { didMigrate, trips };
}

function normalizeTrip(rawTrip: unknown): Trip {
  const trip =
    typeof rawTrip === "object" && rawTrip !== null
      ? (rawTrip as Record<string, unknown>)
      : {};
  const fallbackTrip = seedTrips.find((seedTrip) => seedTrip.id === trip.id);
  const days = normalizeTripDays(
    hasOwnValue(trip, "days") ? trip.days : fallbackTrip?.days,
  );
  const fallbackPlaces = fallbackTrip
    ? normalizePlaces(fallbackTrip.places)
    : [];
  const places = mergePlacesWithFallback(
    normalizePlaces(
      hasOwnValue(trip, "places") ? trip.places : fallbackTrip?.places,
    ),
    getFallbackPlacesForDayItems(days, fallbackPlaces),
  );
  const syncedTripData = syncDayItemsWithPlaces(days, places);
  const normalizedCurrency = normalizeTripCurrency(
    hasOwnValue(trip, "currency") ? trip.currency : fallbackTrip?.currency,
    hasOwnValue(trip, "budget") &&
      typeof trip.budget === "object" &&
      trip.budget !== null
      ? (trip.budget as Record<string, unknown>).currency
      : fallbackTrip?.budget?.currency,
  );
  const normalizedTrip: Trip = {
    id: typeof trip.id === "string" ? trip.id : createId("trip"),
    title:
      typeof trip.title === "string"
        ? trip.title
        : (fallbackTrip?.title ?? "未命名行程"),
    destination:
      typeof trip.destination === "string"
        ? trip.destination
        : (fallbackTrip?.destination ?? ""),
    currency: normalizedCurrency,
    startDate:
      typeof trip.startDate === "string"
        ? trip.startDate
        : fallbackTrip?.startDate,
    endDate:
      typeof trip.endDate === "string" ? trip.endDate : fallbackTrip?.endDate,
    status: normalizeTripStatus(trip.status),
    days: syncedTripData.days,
    places: syncedTripData.places,
    transports: normalizeTransports(
      hasOwnValue(trip, "transports")
        ? trip.transports
        : fallbackTrip?.transports,
    ),
    lodgings: normalizeLodgings(
      hasOwnValue(trip, "lodgings") ? trip.lodgings : fallbackTrip?.lodgings,
    ),
    generalNote: normalizeTripGeneralNote(
      hasOwnValue(trip, "generalNote")
        ? trip.generalNote
        : fallbackTrip?.generalNote,
    ),
    memos: normalizeMemos(
      hasOwnValue(trip, "memos") ? trip.memos : fallbackTrip?.memos,
    ),
    checklistItems: normalizeChecklistItems(
      hasOwnValue(trip, "checklistItems")
        ? trip.checklistItems
        : fallbackTrip?.checklistItems,
    ),
    budget: (() => {
      const budget = normalizeTripBudget(
        hasOwnValue(trip, "budget") ? trip.budget : fallbackTrip?.budget,
      );

      if (!budget) {
        return undefined;
      }

      return {
        ...budget,
        currency: normalizedCurrency,
      };
    })(),
    expenses: normalizeTripExpenses(
      hasOwnValue(trip, "expenses") ? trip.expenses : fallbackTrip?.expenses,
    ).map((expense) => ({
      ...expense,
      currency: normalizeTripCurrency(expense.currency, normalizedCurrency),
    })),
    importSources: normalizeImportSources(
      hasOwnValue(trip, "importSources")
        ? trip.importSources
        : fallbackTrip?.importSources,
    ),
    routeModeOverrides: normalizeRouteModeOverrides(
      hasOwnValue(trip, "routeModeOverrides")
        ? trip.routeModeOverrides
        : fallbackTrip?.routeModeOverrides,
    ),
    createdAt:
      typeof trip.createdAt === "string"
        ? trip.createdAt
        : (fallbackTrip?.createdAt ?? new Date().toISOString()),
    pinnedAt:
      typeof trip.pinnedAt === "string"
        ? trip.pinnedAt
        : fallbackTrip?.pinnedAt,
    updatedAt:
      typeof trip.updatedAt === "string"
        ? trip.updatedAt
        : (fallbackTrip?.updatedAt ?? new Date().toISOString()),
  };

  return applyTripAutoStatus({
    ...normalizedTrip,
    destination: resolveTripDestination(normalizedTrip),
  });
}

function getDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_IN_MS,
  );
}

function parseDateKey(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const dateKeyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (dateKeyMatch) {
    const [, year, month, day] = dateKeyMatch;
    return Math.floor(
      Date.UTC(Number(year), Number(month) - 1, Number(day)) / DAY_IN_MS,
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return getDayNumber(date);
}

function getTripDateSortValue(trip: Trip, todayDay: number): number {
  const startDay = parseDateKey(trip.startDate);
  const endDay = parseDateKey(trip.endDate);
  const primaryDay = startDay ?? endDay;

  if (
    startDay !== undefined &&
    endDay !== undefined &&
    startDay <= todayDay &&
    endDay >= todayDay
  ) {
    return 0;
  }

  if (primaryDay === undefined) {
    return Number.MAX_SAFE_INTEGER;
  }

  if (primaryDay >= todayDay) {
    return 1_000_000 + primaryDay - todayDay;
  }

  return 2_000_000 + todayDay - primaryDay;
}

export function sortTrips(trips: Trip[]): Trip[] {
  const todayDay = getDayNumber(new Date());

  return trips
    .map((trip, index) => ({ index, trip }))
    .sort((left, right) => {
      const leftPinnedAt = left.trip.pinnedAt
        ? Date.parse(left.trip.pinnedAt)
        : 0;
      const rightPinnedAt = right.trip.pinnedAt
        ? Date.parse(right.trip.pinnedAt)
        : 0;
      const leftPinnedTime = Number.isNaN(leftPinnedAt) ? 0 : leftPinnedAt;
      const rightPinnedTime = Number.isNaN(rightPinnedAt) ? 0 : rightPinnedAt;

      if (leftPinnedTime !== rightPinnedTime) {
        return rightPinnedTime - leftPinnedTime;
      }

      if (Boolean(left.trip.pinnedAt) !== Boolean(right.trip.pinnedAt)) {
        return left.trip.pinnedAt ? -1 : 1;
      }

      const leftDateSortValue = getTripDateSortValue(left.trip, todayDay);
      const rightDateSortValue = getTripDateSortValue(right.trip, todayDay);

      if (leftDateSortValue !== rightDateSortValue) {
        return leftDateSortValue - rightDateSortValue;
      }

      return left.index - right.index;
    })
    .map(({ trip }) => trip);
}

function prepareTripsForStorage(trips: Trip[]): Trip[] {
  return sortTrips(trips.map(normalizeTrip).map(applyTripAutoStatus));
}

function isSeedTripId(id: string): boolean {
  return (
    id === CURRENT_SEED_TRIP_ID ||
    LEGACY_SEED_TRIP_IDS.has(id) ||
    id.startsWith("seed-")
  );
}

function getSeedTrips(trips: Trip[]): Trip[] {
  return trips.filter((trip) => isSeedTripId(trip.id));
}

function getNonSeedTrips(trips: Trip[]): Trip[] {
  return trips.filter((trip) => !isSeedTripId(trip.id));
}

const TRIP_EQUALITY_FIELDS: Record<keyof Trip, true> = {
  budget: true,
  checklistItems: true,
  createdAt: true,
  currency: true,
  days: true,
  destination: true,
  endDate: true,
  expenses: true,
  generalNote: true,
  id: true,
  importSources: true,
  lodgings: true,
  memos: true,
  pinnedAt: true,
  places: true,
  routeModeOverrides: true,
  startDate: true,
  status: true,
  title: true,
  transports: true,
  updatedAt: true,
};

function areTripsEqual(left: Trip[], right: Trip[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightById = new Map<string, Trip>();
  for (const trip of right) {
    if (rightById.has(trip.id)) {
      return false;
    }

    rightById.set(trip.id, trip);
  }

  const leftSeenIds = new Set<string>();
  for (const l of left) {
    if (leftSeenIds.has(l.id)) {
      return false;
    }

    leftSeenIds.add(l.id);

    const r = rightById.get(l.id);
    if (!r || !isTripEqual(l, r)) {
      return false;
    }
  }

  return true;
}

function isTripEqual(a: Trip, b: Trip): boolean {
  if (a.updatedAt !== b.updatedAt) {
    return false;
  }

  for (const key of Object.keys(TRIP_EQUALITY_FIELDS) as (keyof Trip)[]) {
    const leftValue = a[key];
    const rightValue = b[key];

    if (leftValue === rightValue) {
      continue;
    }

    if (typeof leftValue === "object" || typeof rightValue === "object") {
      if (JSON.stringify(leftValue) !== JSON.stringify(rightValue)) {
        return false;
      }
      continue;
    }

    return false;
  }

  return true;
}

function compareIsoTimestamp(left?: string, right?: string): number {
  const leftTime = left ? Date.parse(left) : 0;
  const rightTime = right ? Date.parse(right) : 0;
  const normalizedLeftTime = Number.isNaN(leftTime) ? 0 : leftTime;
  const normalizedRightTime = Number.isNaN(rightTime) ? 0 : rightTime;

  return normalizedLeftTime - normalizedRightTime;
}

function getTripFromCloudRow(
  row: CloudUserTripRow,
  poiCache?: Map<string, TripPlace>,
): Trip | undefined {
  if (!row.id || typeof row.payload !== "object" || row.payload === null) {
    return undefined;
  }

  const payloadRow = row.payload as Record<string, unknown>;

  const hydrated =
    poiCache && poiCache.size > 0
      ? hydrateTripPlacesFromCloud(payloadRow, poiCache)
      : payloadRow;

  return normalizeTrip({
    ...hydrated,
    id: row.id,
  });
}

function collectMissingHydratedTripPlaces(trip: Trip): {
  id: string;
  name: string;
  amapPoiId?: string;
}[] {
  return trip.places
    .filter((place) => place.externalRefs?.amapPoiId && !place.name.trim())
    .map((place) => ({
      id: place.id,
      name: place.name,
      amapPoiId: place.externalRefs?.amapPoiId,
    }));
}

function collectAmapPoiIdsFromCloudRows(rows: CloudUserTripRow[]): string[] {
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
    const places = payload.places;

    if (!Array.isArray(places)) {
      continue;
    }

    for (const place of places) {
      if (typeof place !== "object" || place === null) {
        continue;
      }

      const p = place as Record<string, unknown>;

      if (typeof p.amapPoiId === "string") {
        ids.push(p.amapPoiId);
        continue;
      }

      const extRefs = p.externalRefs as Record<string, unknown> | undefined;
      if (extRefs && typeof extRefs.amapPoiId === "string") {
        ids.push(extRefs.amapPoiId);
      }
    }
  }

  return [...new Set(ids)];
}

function shouldAcceptCloudTrip(
  row: CloudUserTripRow,
  localTrip: Trip | undefined,
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

  if (
    metadata?.deletedAt &&
    compareIsoTimestamp(getCloudRowUpdatedAt(row), metadata.deletedAt) <= 0
  ) {
    return false;
  }

  if (!localTrip) {
    return true;
  }

  const cloudUpdatedAt = getCloudRowUpdatedAt(row);
  const knownCloudUpdatedAt = metadata?.cloudUpdatedAt;

  return (
    compareIsoTimestamp(
      cloudUpdatedAt,
      knownCloudUpdatedAt ?? localTrip.updatedAt,
    ) >= 0
  );
}

function markUnsyncedLocalTrips(
  trips: Trip[],
  syncStore: EntitySyncMetadataStore,
): EntitySyncMetadataStore {
  return trips.reduce((currentStore, trip) => {
    if (isSeedTripId(trip.id) || currentStore.entities[trip.id]) {
      return currentStore;
    }

    return markEntityDirty(currentStore, trip.id, trip.updatedAt);
  }, syncStore);
}

function hasNewerDirtySyncIntent(
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

function preserveNewerDirtySyncIntent(
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

async function readTripsFromLocal(): Promise<Trip[]> {
  if (cachedTrips !== null) {
    return [...cachedTrips];
  }

  const rawTrips = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);

  if (!rawTrips) {
    cachedTrips = [];
    return [];
  }

  try {
    const parsedTrips = JSON.parse(rawTrips);
    if (!Array.isArray(parsedTrips)) {
      cachedTrips = [];
      return [];
    }

    const seedMigration = migrateLegacySeedTrips(parsedTrips);
    const normalizedTrips = seedMigration.trips.map(normalizeTrip);
    const sortedTrips = sortTrips(normalizedTrips);

    if (
      seedMigration.didMigrate ||
      hasAutoStatusChanges(seedMigration.trips, normalizedTrips)
    ) {
      await saveTrips(sortedTrips);
      return [...sortedTrips];
    }

    cachedTrips = sortedTrips;
    return [...sortedTrips];
  } catch (error) {
    tripStorageLogger.warn(
      "local.parse.failed",
      { error },
      "Failed to parse trips from local storage",
    );
    cachedTrips = [];
    return [];
  }
}

export async function hasLocalGuestTripData(): Promise<boolean> {
  const trips = await readTripsFromLocal();
  return trips.some((trip) => !isSeedTripId(trip.id));
}

export async function getLocalTripsSnapshot(): Promise<Trip[]> {
  return readTripsFromLocal();
}

async function hydrateSyncedTripPlacesFromCloudCache(
  trips: Trip[],
): Promise<void> {
  let hasUpdates = false;
  let allTrips = await readTripsFromLocal();

  for (const trip of trips) {
    if (isSeedTripId(trip.id)) continue;

    let tripUpdated = false;
    const hydratedPlaces = await Promise.all(
      trip.places.map(async (place) => {
        if (!place.externalRefs?.amapPoiId) return place;
        const hydrated = await hydratePoiFromCloudOrSaveBase(place);
        if (hydrated) {
          tripUpdated = true;
          return hydrated;
        }
        return place;
      }),
    );

    if (tripUpdated) {
      hasUpdates = true;
      const updatedTrip = {
        ...trip,
        places: hydratedPlaces,
        updatedAt: new Date().toISOString(),
      };
      const nextTrips = allTrips.map((t) =>
        t.id === updatedTrip.id ? updatedTrip : t,
      );
      if (areTripsEqual(allTrips, nextTrips)) {
        continue;
      }
      await saveTrips(nextTrips);
      allTrips = nextTrips;
    }
  }

  if (hasUpdates) {
    tripStorageLogger.info(
      "poi-cache.hydrate.synced-trips.updated",
      undefined,
      "Updated local trips from POI cloud cache",
    );
  }
}

let tripCloudSyncPromise: Promise<void> | null = null;
let shouldRunTripsCloudSyncAgain = false;
let tripSyncMutex: Promise<void> | null = null;

export async function syncTripsWithCloud(): Promise<void> {
  if (tripSyncMutex) {
    await tripSyncMutex;
    return;
  }

  let resolveMutex: (() => void) | undefined;
  tripSyncMutex = new Promise<void>((resolve) => {
    resolveMutex = resolve;
  });

  try {
    await doSyncTripsWithCloud();
  } finally {
    tripSyncMutex = null;
    resolveMutex?.();
  }
}

async function doSyncTripsWithCloud(): Promise<void> {
  const session = await getCloudSyncSession();

  if (!session) {
    tripStorageLogger.info(
      "sync.skipped.no-session",
      undefined,
      "Skipped trip sync because cloud session is unavailable",
    );
    return;
  }

  tripStorageLogger.info(
    "sync.started",
    { userId: session.userId },
    "Started trip sync",
  );

  try {
    const syncStartedAt = new Date().toISOString();
    let trips = await readTripsFromLocal();
    const rawSyncStore = await loadEntitySyncMetadata(TRIP_SYNC_STORAGE_KEY);
    const syncableTrips = getNonSeedTrips(trips);

    trips.forEach((trip) => {
      if (!isSeedTripId(trip.id)) {
        const meta = rawSyncStore.entities[trip.id];
        tripStorageLogger.debug(
          "sync.local-trip.metadata",
          {
            hasMetadata: Boolean(meta),
            lastSyncedAt: meta?.lastSyncedAt,
            metadataDirty: meta?.dirty,
            tripId: trip.id,
          },
          "Read local trip sync metadata",
        );
      }
    });

    let syncStore = markUnsyncedLocalTrips(syncableTrips, rawSyncStore);
    const tripsById = new Map(syncableTrips.map((trip) => [trip.id, trip]));
    const pendingUpserts = syncableTrips.filter((trip) => {
      const metadata = syncStore.entities[trip.id];
      return metadata?.dirty === true && !metadata.deletedAt;
    });

    tripStorageLogger.info(
      "sync.pending-upserts.ready",
      { pendingUpsertCount: pendingUpserts.length },
      "Prepared pending trip upserts",
    );

    const poisToSync = pendingUpserts.flatMap((trip) =>
      trip.places.filter((place) => place.externalRefs?.amapPoiId),
    );

    if (poisToSync.length > 0) {
      tripStorageLogger.info(
        "sync.poi-cache.batch.started",
        { poiCount: poisToSync.length },
        "Started trip POI cache sync",
      );
      await batchSyncPoiToCloud(poisToSync);
    }

    try {
      const upsertedRows = await upsertCloudTripRows(session, pendingUpserts);
      tripStorageLogger.info(
        "sync.upsert.finished",
        {
          pendingUpsertCount: pendingUpserts.length,
          upsertedRowCount: upsertedRows.length,
        },
        "Finished trip upsert",
      );
      const syncedAt = new Date().toISOString();

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
      pendingUpserts.forEach((trip) => {
        syncStore = markEntitySyncFailed(syncStore, trip.id, error);
      });
      throw error;
    }

    const pendingDeletes = Object.entries(syncStore.entities).filter(
      ([, metadata]) => metadata.dirty === true && Boolean(metadata.deletedAt),
    );

    for (const [tripId, metadata] of pendingDeletes) {
      try {
        const deletedAt = metadata.deletedAt ?? new Date().toISOString();
        const deletedRows = await markCloudTripDeleted(
          session,
          tripId,
          deletedAt,
        );
        const deletedRow = deletedRows[0];

        syncStore = markEntitySynced(syncStore, tripId, {
          cloudUpdatedAt: getCloudRowUpdatedAt(deletedRow ?? {}) ?? deletedAt,
          deletedAt,
          lastSyncedAt: new Date().toISOString(),
          version: parseCloudRowVersion(deletedRow?.version),
        });
      } catch (error) {
        syncStore = markEntitySyncFailed(syncStore, tripId, error);
        tripStorageLogger.warn(
          "sync.delete.failed",
          { error, tripId },
          "Failed to sync trip deletion",
        );
      }
    }

    const cloudRows = await fetchCloudTripRows(session);
    tripStorageLogger.info(
      "sync.cloud-rows.fetched",
      { cloudRowCount: cloudRows.length },
      "Fetched cloud trip rows",
    );
    const nextTripsById = new Map(tripsById);
    let didMergeCloudChanges = false;
    const syncedAt = new Date().toISOString();

    const amapPoiIds = collectAmapPoiIdsFromCloudRows(cloudRows);
    const poiCache =
      amapPoiIds.length > 0
        ? await batchFetchPoiFromCloud(amapPoiIds, session.accessToken)
        : new Map<never, never>();
    const missingPoiIds = amapPoiIds.filter((id) => !poiCache.has(id));

    tripStorageLogger.debug("sync.poi-cache.prepared", {
      cloudRowCount: cloudRows.length,
      missingPoiIds,
      poiCacheHitCount: poiCache.size,
      requestedPoiIds: amapPoiIds,
    });

    cloudRows.forEach((row) => {
      if (!row.id) {
        return;
      }

      if (isSeedTripId(row.id)) {
        return;
      }

      if (row.deleted_at) {
        const metadata = syncStore.entities[row.id];

        if (
          !metadata?.dirty ||
          compareIsoTimestamp(row.deleted_at, metadata.localUpdatedAt) >= 0
        ) {
          didMergeCloudChanges =
            nextTripsById.delete(row.id) || didMergeCloudChanges;
          syncStore = markEntitySynced(syncStore, row.id, {
            cloudUpdatedAt: getCloudRowUpdatedAt(row),
            deletedAt: row.deleted_at,
            lastSyncedAt: syncedAt,
            version: parseCloudRowVersion(row.version),
          });
        }

        return;
      }

      const cloudTrip = getTripFromCloudRow(row, poiCache);

      if (
        !cloudTrip ||
        !shouldAcceptCloudTrip(row, nextTripsById.get(row.id), syncStore)
      ) {
        return;
      }

      const missingHydratedPlaces = collectMissingHydratedTripPlaces(cloudTrip);
      if (missingHydratedPlaces.length > 0) {
        tripStorageLogger.warn("sync.cloud-trip.hydrate-missing", {
          rowId: row.id,
          title: row.title,
          missingHydratedPlaces,
        });
      }

      const previousTrip = nextTripsById.get(row.id);
      nextTripsById.set(row.id, cloudTrip);
      didMergeCloudChanges =
        !previousTrip ||
        !areTripsEqual([previousTrip], [cloudTrip]) ||
        didMergeCloudChanges;
      syncStore = markEntitySynced(syncStore, row.id, {
        cloudUpdatedAt: getCloudRowUpdatedAt(row),
        lastSyncedAt: syncedAt,
        version: parseCloudRowVersion(row.version),
      });
    });

    const latestSyncStore = await loadEntitySyncMetadata(TRIP_SYNC_STORAGE_KEY);
    const hasNewerLocalSyncIntent = hasNewerDirtySyncIntent(
      latestSyncStore,
      syncStore,
      syncStartedAt,
    );
    syncStore = preserveNewerDirtySyncIntent(
      syncStore,
      latestSyncStore,
      syncStartedAt,
    );

    if (didMergeCloudChanges && !hasNewerLocalSyncIntent) {
      const latestLocalSeedTrips = getSeedTrips(await readTripsFromLocal());
      trips = sortTrips([...nextTripsById.values(), ...latestLocalSeedTrips]);
      tripStorageLogger.info(
        "sync.cloud-merge.applied",
        { localTripCount: trips.length },
        "Applied cloud trip changes locally",
      );
      await saveTrips(trips);

      hydrateSyncedTripPlacesFromCloudCache(trips).catch((err) =>
        tripStorageLogger.warn(
          "poi-cache.hydrate.synced-trips.failed",
          { error: err },
          "Failed to hydrate synced trip places from cloud cache",
        ),
      );
    } else {
      tripStorageLogger.info(
        "sync.cloud-merge.skipped",
        { didMergeCloudChanges, hasNewerLocalSyncIntent },
        "Skipped cloud trip merge",
      );
    }

    await saveEntitySyncMetadata(TRIP_SYNC_STORAGE_KEY, syncStore);
  } catch (error) {
    tripStorageLogger.error(
      "sync.failed",
      { error },
      "Failed to sync trips with cloud",
    );
  }
}

export async function syncTripsWithCloudDetailed(): Promise<string> {
  const session = await getCloudSyncSession();

  if (!session) {
    return "未登录，跳过同步";
  }

  try {
    const syncStartedAt = new Date().toISOString();
    let trips = await readTripsFromLocal();
    const rawSyncStore = await loadEntitySyncMetadata(TRIP_SYNC_STORAGE_KEY);
    const syncableTrips = getNonSeedTrips(trips);

    trips.forEach((trip) => {
      if (!isSeedTripId(trip.id)) {
        const meta = rawSyncStore.entities[trip.id];
        tripStorageLogger.debug(
          "sync-detailed.local-trip.metadata",
          {
            deletedAt: meta?.deletedAt,
            hasMetadata: Boolean(meta),
            lastSyncedAt: meta?.lastSyncedAt,
            metadataDirty: meta?.dirty,
            tripId: trip.id,
          },
          "Read local trip sync metadata for detailed sync",
        );
      }
    });

    let syncStore = markUnsyncedLocalTrips(syncableTrips, rawSyncStore);
    const tripsById = new Map(syncableTrips.map((trip) => [trip.id, trip]));
    const pendingUpserts = syncableTrips.filter((trip) => {
      const metadata = syncStore.entities[trip.id];
      return metadata?.dirty === true && !metadata.deletedAt;
    });

    tripStorageLogger.info(
      "sync-detailed.pending-upserts.ready",
      {
        localTripCount: trips.length,
        pendingUpsertCount: pendingUpserts.length,
      },
      "Prepared detailed trip sync upserts",
    );

    const poisToSync = pendingUpserts.flatMap((trip) =>
      trip.places.filter((place) => place.externalRefs?.amapPoiId),
    );

    if (poisToSync.length > 0) {
      tripStorageLogger.info(
        "sync-detailed.poi-cache.batch.started",
        { poiCount: poisToSync.length },
        "Started detailed trip POI cache sync",
      );
      await batchSyncPoiToCloud(poisToSync);
    }

    let uploadResult = "";

    try {
      const upsertedRows = await upsertCloudTripRows(session, pendingUpserts);
      uploadResult = `上传${pendingUpserts.length}条，返回${upsertedRows.length}条`;
      tripStorageLogger.info(
        "sync-detailed.upsert.finished",
        {
          pendingUpsertCount: pendingUpserts.length,
          upsertedRowCount: upsertedRows.length,
        },
        "Finished detailed trip upsert",
      );
      const syncedAt = new Date().toISOString();

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
      const errorMsg = error instanceof Error ? error.message : String(error);
      tripStorageLogger.warn(
        "sync-detailed.upsert.failed",
        { errorMessage: errorMsg },
        "Detailed trip upsert failed",
      );
      pendingUpserts.forEach((trip) => {
        syncStore = markEntitySyncFailed(syncStore, trip.id, error);
      });
      throw error;
    }

    const pendingDeletes = Object.entries(syncStore.entities).filter(
      ([, metadata]) => metadata.dirty === true && Boolean(metadata.deletedAt),
    );

    for (const [tripId, metadata] of pendingDeletes) {
      try {
        const deletedAt = metadata.deletedAt ?? new Date().toISOString();
        const deletedRows = await markCloudTripDeleted(
          session,
          tripId,
          deletedAt,
        );
        const deletedRow = deletedRows[0];

        syncStore = markEntitySynced(syncStore, tripId, {
          cloudUpdatedAt: getCloudRowUpdatedAt(deletedRow ?? {}) ?? deletedAt,
          deletedAt,
          lastSyncedAt: new Date().toISOString(),
          version: parseCloudRowVersion(deletedRow?.version),
        });
      } catch (error) {
        syncStore = markEntitySyncFailed(syncStore, tripId, error);
        tripStorageLogger.warn(
          "sync-detailed.delete.failed",
          { error, tripId },
          "Failed to sync trip deletion during detailed sync",
        );
      }
    }

    const cloudRows = await fetchCloudTripRows(session);
    tripStorageLogger.info(
      "sync-detailed.cloud-rows.fetched",
      { cloudRowCount: cloudRows.length },
      "Fetched cloud trip rows for detailed sync",
    );
    const nextTripsById = new Map(tripsById);
    let didMergeCloudChanges = false;
    const syncedAt = new Date().toISOString();

    const amapPoiIds = collectAmapPoiIdsFromCloudRows(cloudRows);
    const poiCache =
      amapPoiIds.length > 0
        ? await batchFetchPoiFromCloud(amapPoiIds, session.accessToken)
        : new Map<never, never>();

    let acceptedCount = 0;
    let rejectedCount = 0;
    let deletedCount = 0;

    tripStorageLogger.debug(
      "sync-detailed.cloud-rows.raw",
      {
        cloudRowCount: cloudRows.length,
        rows: cloudRows.map((r) => ({
          id: r.id,
          title: r.title,
          deleted: !!r.deleted_at,
        })),
      },
      "Read raw cloud trip rows for detailed sync",
    );

    cloudRows.forEach((row) => {
      if (!row.id) {
        tripStorageLogger.debug(
          "sync-detailed.cloud-row.skipped.missing-id",
          undefined,
          "Skipped cloud trip row without id",
        );
        return;
      }

      if (isSeedTripId(row.id)) {
        tripStorageLogger.debug(
          "sync-detailed.cloud-row.skipped.seed",
          { rowId: row.id },
          "Skipped seed trip cloud row",
        );
        return;
      }

      if (row.deleted_at) {
        deletedCount++;
        tripStorageLogger.debug(
          "sync-detailed.cloud-row.deleted",
          { rowId: row.id },
          "Processed deleted cloud trip row",
        );
        const metadata = syncStore.entities[row.id];

        if (
          !metadata?.dirty ||
          compareIsoTimestamp(row.deleted_at, metadata.localUpdatedAt) >= 0
        ) {
          didMergeCloudChanges =
            nextTripsById.delete(row.id) || didMergeCloudChanges;
          syncStore = markEntitySynced(syncStore, row.id, {
            cloudUpdatedAt: getCloudRowUpdatedAt(row),
            deletedAt: row.deleted_at,
            lastSyncedAt: syncedAt,
            version: parseCloudRowVersion(row.version),
          });
        }

        return;
      }

      const cloudTrip = getTripFromCloudRow(row, poiCache);

      if (!cloudTrip) {
        tripStorageLogger.warn(
          "sync-detailed.cloud-row.parse.failed",
          { rowId: row.id },
          "Failed to parse cloud trip row",
        );
        rejectedCount++;
        return;
      }

      if (!shouldAcceptCloudTrip(row, nextTripsById.get(row.id), syncStore)) {
        const metadata = syncStore.entities[row.id];
        tripStorageLogger.debug(
          "sync-detailed.cloud-row.rejected",
          {
            deletedAt: metadata?.deletedAt,
            dirty: metadata?.dirty,
            rowId: row.id,
          },
          "Rejected cloud trip row during detailed sync",
        );
        rejectedCount++;
        return;
      }

      tripStorageLogger.debug(
        "sync-detailed.cloud-row.accepted",
        { rowId: row.id },
        "Accepted cloud trip row during detailed sync",
      );
      acceptedCount++;
      const previousTrip = nextTripsById.get(row.id);
      nextTripsById.set(row.id, cloudTrip);
      didMergeCloudChanges =
        !previousTrip ||
        !areTripsEqual([previousTrip], [cloudTrip]) ||
        didMergeCloudChanges;
      syncStore = markEntitySynced(syncStore, row.id, {
        cloudUpdatedAt: getCloudRowUpdatedAt(row),
        lastSyncedAt: syncedAt,
        version: parseCloudRowVersion(row.version),
      });
    });

    tripStorageLogger.info(
      "sync-detailed.cloud-merge.summary",
      { acceptedCount, rejectedCount },
      "Computed detailed cloud merge summary",
    );

    const latestSyncStore = await loadEntitySyncMetadata(TRIP_SYNC_STORAGE_KEY);
    const hasNewerLocalSyncIntent = hasNewerDirtySyncIntent(
      latestSyncStore,
      syncStore,
      syncStartedAt,
    );
    syncStore = preserveNewerDirtySyncIntent(
      syncStore,
      latestSyncStore,
      syncStartedAt,
    );

    if (didMergeCloudChanges && !hasNewerLocalSyncIntent) {
      const latestLocalSeedTrips = getSeedTrips(await readTripsFromLocal());
      trips = sortTrips([...nextTripsById.values(), ...latestLocalSeedTrips]);
      await saveTrips(trips);

      hydrateSyncedTripPlacesFromCloudCache(trips).catch((err) =>
        tripStorageLogger.warn(
          "poi-cache.hydrate.synced-trips.failed",
          { error: err },
          "Failed to hydrate synced trip places from cloud cache",
        ),
      );
    }

    await saveEntitySyncMetadata(TRIP_SYNC_STORAGE_KEY, syncStore);

    const mergeInfo = didMergeCloudChanges ? "，已合并" : "";
    const nonSeedTrips = trips.filter((t) => !isSeedTripId(t.id));
    const withMeta = nonSeedTrips.filter((t) => rawSyncStore.entities[t.id]);
    const noMeta = nonSeedTrips.filter((t) => !rawSyncStore.entities[t.id]);
    return `同步完成 | 本地${nonSeedTrips.length}条(有元数据${withMeta.length}无元数据${noMeta.length}) | ${uploadResult} | 云端${cloudRows.length}条(接受${acceptedCount}删除${deletedCount})${mergeInfo}`;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`同步失败: ${errorMsg}`);
  }
}

export function scheduleTripsCloudSync(): Promise<void> {
  tripStorageLogger.debug(
    "sync.schedule.requested",
    undefined,
    "Trip sync schedule requested",
  );
  if (tripCloudSyncPromise) {
    tripStorageLogger.debug(
      "sync.schedule.queued",
      undefined,
      "Queued another trip sync run",
    );
    shouldRunTripsCloudSyncAgain = true;
    return tripCloudSyncPromise;
  }

  tripCloudSyncPromise = (async () => {
    do {
      shouldRunTripsCloudSyncAgain = false;
      await doSyncTripsWithCloud();
    } while (shouldRunTripsCloudSyncAgain);
  })()
    .catch((error) => {
      tripStorageLogger.warn(
        "sync.schedule.failed",
        { error },
        "Scheduled trip sync failed; dirty state is retained for retry",
      );
    })
    .finally(() => {
      tripCloudSyncPromise = null;
    });
  return tripCloudSyncPromise;
}

async function markTripDirtyForCloudSync(
  trip: Trip,
  options: { schedule?: boolean } = {},
): Promise<void> {
  tripStorageLogger.debug(
    "sync.dirty.mark.requested",
    { isSeedTrip: isSeedTripId(trip.id), tripId: trip.id },
    "Trip dirty mark requested",
  );

  if (isSeedTripId(trip.id)) {
    return;
  }

  await runWithTripSyncMetadataWriteLock(async () => {
    const syncStore = markEntityDirty(
      await loadEntitySyncMetadata(TRIP_SYNC_STORAGE_KEY),
      trip.id,
      trip.updatedAt,
    );
    await saveEntitySyncMetadata(TRIP_SYNC_STORAGE_KEY, syncStore);
  });
  tripStorageLogger.info(
    "sync.dirty.marked",
    { tripId: trip.id },
    "Marked trip dirty for cloud sync",
  );
  if (options.schedule === false) return;

  const session = await getCloudSyncSession();
  tripStorageLogger.debug(
    "sync.dirty.session.checked",
    { hasSession: Boolean(session), userId: session?.userId },
    "Checked cloud session before scheduling dirty Trip sync",
  );
  if (session) scheduleTripsCloudSync();
}

export async function markTripDirtyWithoutScheduling(
  trip: Trip,
): Promise<void> {
  await markTripDirtyForCloudSync(trip, { schedule: false });
}

async function markTripDeletedForCloudSync(
  tripId: string,
  deletedAt: string,
): Promise<void> {
  if (isSeedTripId(tripId)) {
    return;
  }

  await runWithTripSyncMetadataWriteLock(async () => {
    const syncStore = markEntityDeleted(
      await loadEntitySyncMetadata(TRIP_SYNC_STORAGE_KEY),
      tripId,
      deletedAt,
    );
    await saveEntitySyncMetadata(TRIP_SYNC_STORAGE_KEY, syncStore);
  });

  const session = await getCloudSyncSession();
  if (!session) {
    return;
  }

  scheduleTripsCloudSync();
}

function hasAutoStatusChanges(
  rawTrips: unknown[],
  normalizedTrips: Trip[],
): boolean {
  return rawTrips.some((rawTrip, index) => {
    if (typeof rawTrip !== "object" || rawTrip === null) {
      return false;
    }

    const rawTripRecord = rawTrip as Record<string, unknown>;
    const rawChecklistItems = rawTripRecord.checklistItems;
    const normalizedChecklistItems =
      normalizedTrips[index]?.checklistItems ?? [];
    const hasChecklistChanges =
      !Array.isArray(rawChecklistItems) ||
      rawChecklistItems.length !== normalizedChecklistItems.length ||
      rawChecklistItems.some((item, itemIndex) => {
        if (typeof item !== "object" || item === null) {
          return true;
        }

        const rawChecklistItem = item as Record<string, unknown>;
        const normalizedChecklistItem = normalizedChecklistItems[itemIndex];
        return (
          rawChecklistItem.id !== normalizedChecklistItem?.id ||
          rawChecklistItem.title !== normalizedChecklistItem?.title ||
          rawChecklistItem.isCompleted !== normalizedChecklistItem?.isCompleted
        );
      });

    return (
      rawTripRecord.status !== normalizedTrips[index]?.status ||
      hasChecklistChanges
    );
  });
}

export function createTripDay(dayIndex: number): TripDay {
  return {
    id: createId(`day-${dayIndex}`),
    dayIndex,
    title: formatTripDayTitle(dayIndex),
    items: [],
  };
}

export async function getTrips(): Promise<Trip[]> {
  return readTripsFromLocal();
}

export async function saveTrips(trips: Trip[]): Promise<void> {
  const prepared = prepareTripsForStorage(trips);
  await AsyncStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(prepared));
  cachedTrips = prepared;
  emitTripsUpdated();
}

export async function getTripsWithSeed(): Promise<Trip[]> {
  const trips = await getTrips();

  if (trips.length > 0) {
    return trips;
  }

  const dismissed = await AsyncStorage.getItem(TRIPS_SEED_DISMISSED_KEY);
  tripStorageLogger.debug(
    "seed.read.dismissed",
    { dismissed },
    "Read seed trip dismissed marker",
  );

  if (dismissed === "true") {
    return [];
  }

  const currentSeedTrip = seedTrips.find(
    (trip) => trip.id === CURRENT_SEED_TRIP_ID,
  );

  if (!currentSeedTrip) {
    return [];
  }

  tripStorageLogger.info(
    "seed.autofill.started",
    { seedTripId: currentSeedTrip.id },
    "Started seed trip autofill",
  );
  await saveTrips([currentSeedTrip]);
  await seedRouteCacheIfNeeded();
  return [currentSeedTrip];
}

export async function getTripById(id: string): Promise<Trip | null> {
  const trips = await getTripsWithSeed();
  return trips.find((trip) => trip.id === id) ?? null;
}

export async function createTripLocally(
  input: CreateTripInput,
  options: { tripId?: string } = {},
): Promise<Trip> {
  const now = new Date().toISOString();
  const days =
    input.days && input.days.length > 0 ? input.days : [createTripDay(1)];
  const places = input.places ?? [];
  const currency = normalizeTripCurrency(
    input.currency,
    input.budget?.currency,
  );
  const checklistItems = await createChecklistItemsForNewTrip(input);
  const trip: Trip = applyTripAutoStatus({
    id: options.tripId ?? createId("trip"),
    title: input.title.trim(),
    destination: resolveTripDestination({
      destination: input.destination ?? "",
      places,
    }),
    currency,
    startDate: input.startDate,
    endDate: input.endDate,
    status: input.status ?? "计划中",
    days,
    places,
    transports: input.transports ?? [],
    lodgings: input.lodgings ?? [],
    generalNote: normalizeTripGeneralNote(input.generalNote),
    memos: input.memos ?? [],
    checklistItems,
    budget: input.budget
      ? {
          ...input.budget,
          currency,
        }
      : undefined,
    expenses: (input.expenses ?? []).map((expense) => ({
      ...expense,
      currency: normalizeTripCurrency(expense.currency, currency),
    })),
    importSources: [],
    createdAt: now,
    updatedAt: now,
  });

  return runWithTripsLocalWriteLock(async () => {
    const trips = await readTripsFromLocal();
    const existingTrip = options.tripId
      ? trips.find((candidate) => candidate.id === options.tripId)
      : undefined;
    if (existingTrip) {
      return existingTrip;
    }
    const sortedTrips = prepareTripsForStorage([trip, ...trips]);

    const normalizedTrip =
      sortedTrips.find((t) => t.id === trip.id) ?? sortedTrips[0];
    await saveTrips(sortedTrips);
    return normalizedTrip;
  });
}

export async function rollbackLocallyCreatedTrip(
  tripId: string,
): Promise<void> {
  await runWithTripsLocalWriteLock(async () => {
    const trips = await readTripsFromLocal();
    await saveTrips(trips.filter((trip) => trip.id !== tripId));
    await runWithTripSyncMetadataWriteLock(async () => {
      const syncStore = removeEntitySyncMetadata(
        await loadEntitySyncMetadata(TRIP_SYNC_STORAGE_KEY),
        tripId,
      );
      await saveEntitySyncMetadata(TRIP_SYNC_STORAGE_KEY, syncStore);
    });
  });
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const trip = await createTripLocally(input);
  await markTripDirtyForCloudSync(trip);
  return trip;
}

export async function toggleTripPinned(id: string): Promise<Trip[]> {
  return runWithTripsLocalWriteLock(async () => {
    const trips = await readTripsFromLocal();
    const now = new Date().toISOString();
    const nextTrips = trips.map((trip): Trip => {
      if (trip.id !== id) {
        return trip;
      }

      return {
        ...trip,
        pinnedAt: trip.pinnedAt ? undefined : now,
        updatedAt: now,
      };
    });

    const sortedTrips = prepareTripsForStorage(nextTrips);
    const nextTrip = sortedTrips.find((trip) => trip.id === id);

    if (nextTrip) {
      await markTripDirtyForCloudSync(nextTrip);
    }

    await saveTrips(sortedTrips);
    return sortedTrips;
  });
}

export async function deleteTrip(id: string): Promise<Trip[]> {
  return runWithTripsLocalWriteLock(async () => {
    const trips = await readTripsFromLocal();
    const nextTrips = trips.filter((trip) => trip.id !== id);
    const sortedTrips = prepareTripsForStorage(nextTrips);

    if (isSeedTripId(id) || sortedTrips.length === 0) {
      tripStorageLogger.info(
        "seed.dismissed.marked",
        { tripId: id },
        "Marked seed trip dismissed",
      );
      await AsyncStorage.setItem(TRIPS_SEED_DISMISSED_KEY, "true");
    }

    await saveTrips(sortedTrips);
    await markTripDeletedForCloudSync(id, new Date().toISOString());
    return sortedTrips;
  });
}

export type UpdateTripOptions = {
  expectedUpdatedAt?: string;
};

export class TripStorageVersionConflictError extends Error {
  readonly code = "VERSION_CONFLICT" as const;

  constructor(tripId: string) {
    super(`Trip ${tripId} 已发生变化，请重新加载后再保存。`);
    this.name = "TripStorageVersionConflictError";
  }
}

export async function updateTrip(
  updatedTrip: Trip,
  options: UpdateTripOptions = {},
): Promise<Trip[]> {
  return runWithTripsLocalWriteLock(() =>
    updateTripWithinWriteLock(updatedTrip, options),
  );
}

async function updateTripWithinWriteLock(
  updatedTrip: Trip,
  options: UpdateTripOptions,
): Promise<Trip[]> {
  const trips = await readTripsFromLocal();
  const currentTrip = trips.find((trip) => trip.id === updatedTrip.id);
  if (
    currentTrip &&
    options.expectedUpdatedAt !== undefined &&
    currentTrip.updatedAt !== options.expectedUpdatedAt
  ) {
    throw new TripStorageVersionConflictError(updatedTrip.id);
  }
  const now = createStrictlyNewerUpdatedAt(
    currentTrip?.updatedAt ?? updatedTrip.updatedAt,
    updatedTrip.updatedAt,
  );
  const nextTrip = applyTripAutoStatus({
    ...updatedTrip,
    destination: resolveTripDestination(updatedTrip),
    updatedAt: now,
  });
  const hasTrip = trips.some((trip) => trip.id === updatedTrip.id);
  const nextTrips = hasTrip
    ? trips.map((trip) => (trip.id === updatedTrip.id ? nextTrip : trip))
    : [nextTrip, ...trips];

  const sortedTrips = prepareTripsForStorage(nextTrips);

  const normalizedTrip = sortedTrips.find((trip) => trip.id === updatedTrip.id);
  await saveTrips(sortedTrips);
  if (normalizedTrip) {
    await markTripDirtyForCloudSync(normalizedTrip);
  }

  for (const place of nextTrip.places) {
    if (place.externalRefs?.amapPoiId) {
      ensurePoiCached(place).catch((err) =>
        tripStorageLogger.warn(
          "poi-cache.ensure.failed",
          { error: err, placeId: place.id, tripId: nextTrip.id },
          "Failed to ensure trip place POI cache",
        ),
      );
    }
  }

  return sortedTrips;
}

function createStrictlyNewerUpdatedAt(
  previousUpdatedAt: string,
  candidateUpdatedAt: string,
): string {
  const now = Date.now();
  const previous = Date.parse(previousUpdatedAt);
  const candidate = Date.parse(candidateUpdatedAt);
  if (
    Number.isFinite(previous) &&
    Number.isFinite(candidate) &&
    candidate > previous
  ) {
    return new Date(candidate).toISOString();
  }
  if (!Number.isFinite(previous) || now > previous) {
    return new Date(now).toISOString();
  }
  return new Date(previous + 1).toISOString();
}

export type TripLocalMutationCheckpoint = {
  syncMetadata?: EntitySyncMetadata;
  trip: Trip;
};

/**
 * 为跨 AsyncStorage Trip 与 dirty 元数据的确认写入保存最小补偿快照。
 */
export async function createTripLocalMutationCheckpoint(
  tripId: string,
): Promise<TripLocalMutationCheckpoint | undefined> {
  const trip = (await readTripsFromLocal()).find(
    (candidate) => candidate.id === tripId,
  );
  if (!trip) return undefined;
  const syncStore = await loadEntitySyncMetadata(TRIP_SYNC_STORAGE_KEY);

  return {
    syncMetadata: syncStore.entities[tripId]
      ? { ...syncStore.entities[tripId] }
      : undefined,
    trip,
  };
}

/**
 * 只提交 Trip JSON，不标记 dirty、不调度云同步；供 Confirmed Apply 统一编排。
 */
export async function updateTripLocally(updatedTrip: Trip): Promise<Trip> {
  return runWithTripsLocalWriteLock(() =>
    updateTripLocallyWithinWriteLock(updatedTrip),
  );
}

export async function updateTripLocallyWithinWriteLock(
  updatedTrip: Trip,
): Promise<Trip> {
  const trips = await readTripsFromLocal();
  if (!trips.some((trip) => trip.id === updatedTrip.id)) {
    throw new Error(`Trip ${updatedTrip.id} 不存在。`);
  }
  const nextTrip = applyTripAutoStatus({
    ...updatedTrip,
    destination: resolveTripDestination(updatedTrip),
  });
  const sortedTrips = prepareTripsForStorage(
    trips.map((trip) => (trip.id === nextTrip.id ? nextTrip : trip)),
  );
  await saveTrips(sortedTrips);
  const persistedTrip = sortedTrips.find((trip) => trip.id === nextTrip.id);
  if (!persistedTrip) {
    throw new Error(`Trip ${updatedTrip.id} 本地提交失败。`);
  }
  return persistedTrip;
}

/** 恢复本次确认写入前的 Trip 与该 Trip 的 dirty 元数据，不覆盖其它 Trip。 */
export async function restoreTripLocalMutationCheckpoint(
  checkpoint: TripLocalMutationCheckpoint,
): Promise<void> {
  await runWithTripsLocalWriteLock(() =>
    restoreTripLocalMutationCheckpointWithinWriteLock(checkpoint),
  );
}

export async function restoreTripLocalMutationCheckpointWithinWriteLock(
  checkpoint: TripLocalMutationCheckpoint,
): Promise<void> {
  const trips = await readTripsFromLocal();
  const nextTrips = trips.some((trip) => trip.id === checkpoint.trip.id)
    ? trips.map((trip) =>
        trip.id === checkpoint.trip.id ? checkpoint.trip : trip,
      )
    : [checkpoint.trip, ...trips];
  await saveTrips(nextTrips);

  await runWithTripSyncMetadataWriteLock(async () => {
    const syncStore = await loadEntitySyncMetadata(TRIP_SYNC_STORAGE_KEY);
    const entities = { ...syncStore.entities };
    if (checkpoint.syncMetadata) {
      entities[checkpoint.trip.id] = checkpoint.syncMetadata;
    } else {
      delete entities[checkpoint.trip.id];
    }
    await saveEntitySyncMetadata(TRIP_SYNC_STORAGE_KEY, {
      ...syncStore,
      entities,
    });
  });
}

export async function addTripImportSource(
  tripId: string,
  input: CreateTripImportSourceInput,
): Promise<Trip | null> {
  return runWithTripsLocalWriteLock(async () => {
    const trips = await getTripsWithSeed();
    const now = new Date().toISOString();
    let nextTrip: Trip | null = null;

    const nextTrips = trips.map((trip): Trip => {
      if (trip.id !== tripId) {
        return trip;
      }

      nextTrip = {
        ...trip,
        importSources: [
          {
            id: createId("source"),
            title: input.title.trim(),
            sourceType: input.sourceType,
            status: input.status ?? "待解析",
          },
          ...trip.importSources,
        ],
        updatedAt: now,
      };

      return nextTrip;
    });

    if (!nextTrip) {
      return null;
    }

    await saveTrips(nextTrips);
    await markTripDirtyForCloudSync(nextTrip);
    return nextTrip;
  });
}
