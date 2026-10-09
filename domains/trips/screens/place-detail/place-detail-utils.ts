import { Linking, Platform } from "react-native";
import {
  getAmapMapVisualPreset,
  getAvailableMapUrlCandidates,
  type MapUrlCandidate,
  type Trip,
  type TripExpenseEntry,
  type TripPlace,
  type TripRouteMode,
} from "@/features/trips";
import type { AmapPlaceDetailResult } from "@/features/trips/amap";
import { createDiagnosticLogger } from "@/features/diagnostics";
const placeDetailUtilsLogger = createDiagnosticLogger("place-detail-utils");
export const PLACE_NAVIGATION_MODE: TripRouteMode = "driving";
export function getPlaceMapVisualPreset(mode?: "light" | "dark") {
  return getAmapMapVisualPreset(undefined, mode);
}
const poiGroupLabels: Record<NonNullable<TripPlace["poiGroup"]>, string> = {
  attraction: "景点",
  education: "教育",
  food: "餐饮",
  medical: "医疗",
  hotel: "住宿",
  other: "其他",
  shopping: "购物",
  transport: "交通",
};

export function isSeedTripId(value?: string | null): boolean {
  return typeof value === "string" && value.startsWith("seed-");
}

export function openPreparedWebWindow(): Window | null {
  if (Platform.OS !== "web") {
    return null;
  }

  const preparedWindow = globalThis.window?.open("about:blank", "_blank");

  if (preparedWindow) {
    preparedWindow.opener = null;
  }

  return preparedWindow;
}

async function openNavigationUrl(
  url: string,
  preparedWindow?: Window | null,
): Promise<boolean> {
  if (Platform.OS === "web") {
    if (preparedWindow) {
      preparedWindow.location.href = url;
      return true;
    }

    const webWindow = globalThis.window;

    if (webWindow) {
      webWindow.open(url, "_blank", "noopener,noreferrer");
      return true;
    }
  }

  try {
    await Linking.openURL(url);
    return true;
  } catch (openError) {
    placeDetailUtilsLogger.warn(
      "legacy.warn",
      { args: ["Failed to open navigation url.", openError] },
      "Legacy warning captured",
    );
    return false;
  }
}

export async function openFirstMapUrl(
  candidates: MapUrlCandidate[],
  preparedWindow?: Window | null,
): Promise<MapUrlCandidate | undefined> {
  const openableCandidates =
    Platform.OS === "web"
      ? candidates
      : await getAvailableMapUrlCandidates(candidates, Linking.canOpenURL);
  const launchCandidates =
    openableCandidates.length > 0 ? openableCandidates : candidates;

  for (const candidate of launchCandidates) {
    const didOpen = await openNavigationUrl(candidate.url, preparedWindow);

    if (didOpen) {
      return candidate;
    }
  }

  return undefined;
}

export function getPlaceRecordTags(
  place: TripPlace,
  scheduleCount: number,
  isFavoritePlaceDetail: boolean,
): string[] {
  const tags = [
    place.category,
    place.poiGroup ? poiGroupLabels[place.poiGroup] : undefined,
    isFavoritePlaceDetail ? "已收藏" : place.isScheduled ? "已安排" : "待安排",
    scheduleCount > 0 ? `${scheduleCount} 次安排` : undefined,
  ];

  return [...new Set(tags.filter((tag): tag is string => Boolean(tag)))];
}

export function getPlaceCoverPhoto(place: TripPlace) {
  return place.photos?.find((photo) => photo.isCover) ?? place.photos?.[0];
}

function formatCount(value: number | undefined, fallback: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  if (value >= 10000) {
    return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}w`;
  }

  return `${value}`;
}

export function getPlaceIntro(place: TripPlace, trip?: Trip | null): string {
  if (isSeedTripId(trip?.id) && place.llm?.text?.trim()) {
    return place.llm.text.trim();
  }

  if (place.details?.summary) {
    return place.details.summary;
  }

  const destination = trip?.destination ? `${trip.destination} ` : "";
  const area = place.area ? `，位于${place.area}` : "";
  return `${place.name}已收进${destination}旅行地点库${area}。地点介绍待补充。`;
}

export function mergePublicPoiFields(
  place: TripPlace,
  publicPlace: TripPlace,
): TripPlace {
  const nextDetails = { ...place.details };

  if (publicPlace.details) {
    for (const [key, value] of Object.entries(publicPlace.details)) {
      if (value !== undefined && value !== null && value !== "") {
        (nextDetails as Record<string, unknown>)[key] = value;
      }
    }
  }

  return {
    ...place,
    address: publicPlace.address ?? place.address,
    area: publicPlace.area ?? place.area,
    latitude: publicPlace.latitude ?? place.latitude,
    longitude: publicPlace.longitude ?? place.longitude,
    iconKey: publicPlace.iconKey ?? place.iconKey,
    osmKey: publicPlace.osmKey ?? place.osmKey,
    osmValue: publicPlace.osmValue ?? place.osmValue,
    poiGroup: publicPlace.poiGroup ?? place.poiGroup,
    poiType: publicPlace.poiType ?? place.poiType,
    providerPlaceId: publicPlace.providerPlaceId ?? place.providerPlaceId,
    externalRefs: {
      ...place.externalRefs,
      ...publicPlace.externalRefs,
    },
    details: Object.keys(nextDetails).length > 0 ? nextDetails : undefined,
    photos: publicPlace.photos?.length ? publicPlace.photos : place.photos,
  };
}

export function createPlaceFromAmapDetail(
  place: TripPlace,
  amapPoiId: string,
  detail: AmapPlaceDetailResult,
): TripPlace {
  return mergePublicPoiFields(place, {
    ...place,
    details: {
      rating: detail.rating,
      ratingSource: detail.ratingSource,
      phone: detail.phone,
      openingHours: detail.openingHours,
      priceLevel: detail.priceLevel,
    },
    photos: detail.photos
      ? detail.photos.map((photo, index) => ({
          id: `amap-photo-${amapPoiId}-${index}`,
          url: photo.url,
          sourceLabel: "高德",
          ...(photo.title ? { credit: photo.title } : {}),
        }))
      : undefined,
  });
}

export function getPlaceMetricValue(
  place: TripPlace,
  metric: "rating" | "photos" | "planned" | "visited",
): string {
  if (metric === "rating") {
    return typeof place.details?.rating === "number"
      ? place.details.rating.toFixed(1)
      : "未评分";
  }

  if (metric === "photos") {
    return `${place.photos?.length ?? 0} 张`;
  }

  if (metric === "planned") {
    return formatCount(place.details?.plannedCount, "待统计");
  }

  return formatCount(place.details?.visitedCount, "待记录");
}

export function getScheduleEntryKey(dayId: string, itemId: string): string {
  return `${dayId}:${itemId}`;
}

function padTimePart(value: number): string {
  return String(value).padStart(2, "0");
}

function formatExpenseRecordedAt(value: string | undefined): string {
  if (!value) {
    return "记账时间未保存";
  }

  const recordedAt = new Date(value);

  if (Number.isNaN(recordedAt.getTime())) {
    return "记账时间未保存";
  }

  return `${recordedAt.getFullYear()} 年 ${
    recordedAt.getMonth() + 1
  } 月 ${recordedAt.getDate()} 日 ${padTimePart(recordedAt.getHours())}:${padTimePart(recordedAt.getMinutes())}`;
}

export function getExpenseEntrySortValue(entry: TripExpenseEntry): number {
  const timestamp = Date.parse(entry.recordedAt ?? entry.date ?? "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function formatExpenseEntryRecordedAt(entry: TripExpenseEntry): string {
  return formatExpenseRecordedAt(entry.recordedAt ?? entry.date);
}
