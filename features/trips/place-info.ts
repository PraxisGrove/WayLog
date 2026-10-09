import { buildAmapPlaceUrl } from "./amap";
import {
  doesTripDayItemReferenceTripPlace,
  findTripPlaceByLocalId,
} from "./place-identity";
import type { Trip, TripDay, TripDayItem, TripPlace } from "./types";

export type PlaceScheduleEntry = {
  day: TripDay;
  item: TripDayItem;
};

export type PlaceInfoLink = {
  detail: string;
  id: "map" | "source" | "baidu_baike" | "dianping" | "mafengwo" | "ctrip";
  title: string;
  url: string;
};

function hasCoordinates(place: TripPlace): boolean {
  return (
    typeof place.latitude === "number" && typeof place.longitude === "number"
  );
}

function isViewportCoordinate(value?: {
  latitude?: number;
  longitude?: number;
}): value is {
  latitude: number;
  longitude: number;
} {
  return (
    typeof value?.latitude === "number" &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    Math.abs(value.latitude) <= 90 &&
    Math.abs(value.longitude) <= 180
  );
}

function normalizeBoundaryPath(
  path?: {
    latitude?: number;
    longitude?: number;
  }[],
): {
  latitude: number;
  longitude: number;
}[] {
  if (!Array.isArray(path)) {
    return [];
  }

  const coordinates = path.filter(isViewportCoordinate);
  return coordinates.length >= 3 ? coordinates : [];
}
export function getPlaceMapBoundaryPaths(
  place?: Pick<TripPlace, "mapBoundary">,
): {
  latitude: number;
  longitude: number;
}[][] {
  const boundaryPaths =
    place?.mapBoundary
      ?.map(normalizeBoundaryPath)
      .filter((path) => path.length >= 3) ?? [];
  return boundaryPaths;
}

export function getPlaceMapPreviewZoom(
  place?: Pick<
    TripPlace,
    "category" | "iconKey" | "mapBoundary" | "poiGroup" | "poiType"
  >,
): number {
  if (getPlaceMapBoundaryPaths(place).length > 0) {
    return 12;
  }

  const poiType = place?.poiType?.toLocaleLowerCase() ?? "";

  if (place?.iconKey === "airport" || poiType.includes("airport")) {
    return 10;
  }

  if (place?.poiGroup === "transport" || place?.category === "交通") {
    return 12;
  }

  if (
    place?.poiGroup === "food" ||
    place?.poiGroup === "hotel" ||
    place?.category === "餐厅" ||
    place?.category === "酒店"
  ) {
    return 14;
  }

  return 13;
}

function getAmapUrl(place: TripPlace): string {
  if (place.externalRefs?.mapUrl) {
    return place.externalRefs.mapUrl;
  }

  return buildAmapPlaceUrl(place);
}

function doesItemMatchPlace(item: TripDayItem, place: TripPlace): boolean {
  return doesTripDayItemReferenceTripPlace(item, place);
}

export function findTripPlaceByLocalPlaceId(
  trip: Trip,
  localPlaceId: string,
): TripPlace | undefined {
  return findTripPlaceByLocalId(trip, localPlaceId);
}

/** @deprecated Use findTripPlaceByLocalPlaceId so callers do not confuse it with provider POI IDs. */
export function findTripPlace(
  trip: Trip,
  placeId: string,
): TripPlace | undefined {
  return findTripPlaceByLocalPlaceId(trip, placeId);
}

export function getPlaceScheduleEntries(
  trip: Trip,
  place: TripPlace,
): PlaceScheduleEntry[] {
  return trip.days.flatMap((day) =>
    day.items
      .filter((item) => doesItemMatchPlace(item, place))
      .map((item) => ({
        day,
        item,
      })),
  );
}

export function formatPlaceCoordinates(place: TripPlace): string | undefined {
  if (!hasCoordinates(place)) {
    return undefined;
  }

  return `${place.latitude?.toFixed(5)}, ${place.longitude?.toFixed(5)}`;
}

export function getPlaceSearchQuery(place: TripPlace): string {
  if (hasCoordinates(place)) {
    return `${place.latitude},${place.longitude}`;
  }

  return [place.name, place.address, place.area].filter(Boolean).join(" ");
}

export function getPlaceDataSourceLabel(place: TripPlace): string {
  if (place.externalRefs?.amapPoiId || place.provider === "amap") {
    return "高德地图";
  }

  return "本地记录";
}

export function getPlaceInfoLinks(place: TripPlace): PlaceInfoLink[] {
  const query = place.name;
  const mapUrl = getAmapUrl(place);
  const links: PlaceInfoLink[] = [
    {
      id: "map",
      title: "高德地图",
      detail: "从当前位置导航",
      url: mapUrl,
    },
    {
      id: "baidu_baike",
      title: "百度百科",
      detail: "查看百科介绍",
      url: `https://baike.baidu.com/search?word=${encodeURIComponent(query)}`,
    },
    {
      id: "dianping",
      title: "大众点评",
      detail: "查看评价与人均",
      url: `https://www.dianping.com/search/keyword/0/0_${encodeURIComponent(query)}`,
    },
    {
      id: "mafengwo",
      title: "马蜂窝",
      detail: "查看旅游攻略",
      url: `https://www.mafengwo.cn/search/q.php?q=${encodeURIComponent(query)}`,
    },
    {
      id: "ctrip",
      title: "携程",
      detail: "查看门票与预订",
      url: `https://vacations.ctrip.com/search?keyword=${encodeURIComponent(query)}`,
    },
  ];

  if (place.externalRefs?.sourceUrl) {
    links.push({
      id: "source",
      title: "来源",
      detail: "已保存的外部链接",
      url: place.externalRefs.sourceUrl,
    });
  }

  return links;
}
