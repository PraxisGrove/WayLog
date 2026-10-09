import { createDiagnosticLogger } from "../diagnostics";
import { isAmapWebServiceConfigured, searchAmapPlaceSuggestions } from "./amap";
import { inferPlaceKind } from "./place-kind";
import {
  batchSyncPoiToCloud,
  type PoiCloudSearchEntry,
  searchPoiCacheEntriesFromCloud,
} from "./poi-cache";
import type {
  TripDay,
  TripGeoCoordinate,
  TripPlace,
  TripPlaceCategory,
  TripPlaceExternalRefs,
  TripPlaceIconKey,
  TripPlaceMapBoundary,
  TripPlacePoiGroup,
} from "./types";

const placeSearchLogger = createDiagnosticLogger("place-search");

export type PlaceSuggestionProvider = "mock" | "amap" | "poi_cache";

export type PlaceSuggestion = {
  address: string;
  area: string;
  category: TripPlaceCategory;
  distanceKm?: number;
  iconKey: TripPlaceIconKey;
  id: string;
  latitude?: number;
  longitude?: number;
  mapBoundary?: TripPlaceMapBoundary;
  name: string;
  osmKey?: string;
  osmValue?: string;
  poiGroup: TripPlacePoiGroup;
  poiType: string;
  provider: PlaceSuggestionProvider;
  providerPlaceId?: string;
  externalRefs?: TripPlaceExternalRefs;
  rating?: number;
  costPerPerson?: string;
  phone?: string;
  openingHoursToday?: string;
  tags?: string;
  businessArea?: string;
  photos?: { title?: string; url: string }[];
};

type RawPlaceSuggestion = Omit<
  PlaceSuggestion,
  "category" | "iconKey" | "poiGroup" | "poiType"
> & {
  category?: TripPlaceCategory;
};

export type PlaceSearchContext = "favorite" | "trip";

type SearchPlaceSuggestionsOptions = {
  amapTypes?: string;
  context?: PlaceSearchContext;
  nearbyCenter?: PlaceSearchCenter;
  persistResults?: boolean;
  regionText?: string;
  signal?: AbortSignal;
};

export type PlaceSearchCenter = TripGeoCoordinate & {
  label?: string;
};

type PlaceSearchCenterInputPlace = {
  latitude?: number;
  longitude?: number;
  name?: string;
};

type TripDayPlaceSearchCenterInputPlace = PlaceSearchCenterInputPlace & {
  id: string;
  name: string;
};

const SEARCH_RESULT_LIMIT = 8;
const NEARBY_REMOTE_RESULT_LIMIT = 6;
const BROAD_REMOTE_RESULT_LIMIT = 6;
const minRemoteQueryLength = 2;
/** Public cache hits must be close enough to skip the Amap fallback. */
const CLOUD_CACHE_LOCAL_HIT_RADIUS_KM = 50;
const searchCache = new Map<string, PlaceSuggestion[]>();

// 离线演示候选不代表已核验 POI；供应商身份与营业信息仅由运行时查询提供。
const rawPlaceSuggestions: RawPlaceSuggestion[] = [
  {
    id: "mock-xian-dayanta",
    name: "大雁塔",
    category: "景点",
    area: "陕西省西安市雁塔区",
    address: "芙蓉东路 10 号(大雁塔东门)",
    latitude: 34.218841,
    longitude: 108.965068,
    osmKey: "historic",
    osmValue: "monument",
    provider: "mock",
    tags: "历史古迹,唐代建筑,玄奘",
    businessArea: "大雁塔",
    photos: [],
  },
  {
    id: "mock-xian-datang",
    name: "大唐不夜城",
    category: "景点",
    area: "陕西省西安市雁塔区",
    address: "雁塔南路 428 号",
    latitude: 34.218,
    longitude: 108.964,
    osmKey: "tourism",
    osmValue: "attraction",
    provider: "mock",
    tags: "步行街,夜景,网红打卡",
    businessArea: "大雁塔",
    photos: [],
  },
  {
    id: "mock-xian-joy-city",
    name: "西安大悦城",
    category: "购物",
    area: "陕西省西安市雁塔区",
    address: "慈恩西路 777 号",
    latitude: 34.2164,
    longitude: 108.9579,
    osmKey: "shop",
    osmValue: "mall",
    provider: "mock",
    tags: "购物中心,美食,电影院",
    businessArea: "大雁塔",
    photos: [],
  },
  {
    id: "mock-xian-dayanta-metro",
    name: "大雁塔(地铁站)",
    category: "交通",
    area: "陕西省西安市雁塔区",
    address: "地铁 3 号线 / 4 号线",
    latitude: 34.2191,
    longitude: 108.9593,
    osmKey: "railway",
    osmValue: "subway_entrance",
    provider: "mock",
    tags: "地铁站,3号线,4号线",
    photos: [],
  },
  {
    id: "mock-xian-north-square",
    name: "大雁塔北广场",
    category: "景点",
    area: "陕西省西安市雁塔区",
    address: "芙蓉东路 3 号",
    latitude: 34.221,
    longitude: 108.9591,
    osmKey: "tourism",
    osmValue: "attraction",
    provider: "mock",
    tags: "音乐喷泉,广场,夜景",
    businessArea: "大雁塔",
    photos: [],
  },
  {
    id: "mock-xian-south-square",
    name: "大雁塔南广场",
    category: "景点",
    area: "陕西省西安市雁塔区",
    address: "慈恩路大悦城旁边",
    latitude: 34.2148,
    longitude: 108.9588,
    osmKey: "tourism",
    osmValue: "attraction",
    provider: "mock",
    tags: "广场,玄奘雕塑",
    businessArea: "大雁塔",
    photos: [],
  },
  {
    id: "mock-xian-yanta",
    name: "雁塔区",
    category: "其他",
    area: "陕西省西安市",
    address: "西安市雁塔区",
    provider: "mock",
  },
  {
    id: "mock-xian-history-museum",
    name: "陕西历史博物馆",
    category: "景点",
    area: "陕西省西安市雁塔区",
    address: "小寨东路 91 号",
    latitude: 34.2223,
    longitude: 108.9542,
    osmKey: "tourism",
    osmValue: "museum",
    provider: "mock",
    tags: "博物馆,周秦汉唐,国宝",
    businessArea: "小寨",
    photos: [],
  },
  {
    id: "mock-xian-bell-tower",
    name: "钟楼",
    category: "景点",
    area: "陕西省西安市碑林区",
    address: "西安地铁 2 号线钟楼站 C 出口正对面",
    latitude: 34.2572,
    longitude: 108.9439,
    osmKey: "historic",
    osmValue: "monument",
    provider: "mock",
    tags: "明代建筑,地标,钟鼓楼",
    businessArea: "钟楼",
    photos: [],
  },
  {
    id: "mock-xian-drum-tower",
    name: "鼓楼",
    category: "景点",
    area: "陕西省西安市莲湖区",
    address: "北院门 74 号(广济街地铁站 D1 口步行 370 米)",
    latitude: 34.2604,
    longitude: 108.9405,
    osmKey: "historic",
    osmValue: "monument",
    provider: "mock",
    tags: "明代建筑,鼓乐表演",
    businessArea: "钟楼",
    photos: [],
  },
  {
    id: "mock-xian-muslim-quarter",
    name: "回民街",
    category: "餐厅",
    area: "陕西省西安市莲湖区",
    address: "北院门 125 号 1-51",
    latitude: 34.2647,
    longitude: 108.9405,
    osmKey: "amenity",
    osmValue: "restaurant",
    provider: "mock",
    tags: "美食街,清真小吃,羊肉泡馍",
    businessArea: "回民街",
    photos: [],
  },
  {
    id: "mock-xian-city-wall-yongning",
    name: "西安城墙永宁门",
    category: "景点",
    area: "陕西省西安市碑林区",
    address: "南门盘道",
    latitude: 34.2507,
    longitude: 108.9425,
    osmKey: "historic",
    osmValue: "citywalls",
    provider: "mock",
    tags: "古城墙,骑行,夜景灯光秀",
    businessArea: "南门",
    photos: [],
  },
  {
    id: "mock-xian-yongxingfang",
    name: "永兴坊",
    category: "餐厅",
    area: "陕西省西安市新城区",
    address: "东新街小东门内",
    latitude: 34.2636,
    longitude: 108.9677,
    osmKey: "amenity",
    osmValue: "restaurant",
    provider: "mock",
    tags: "摔碗酒,陕西小吃,非遗美食",
    businessArea: "永兴坊",
    photos: [],
  },
  {
    id: "mock-xian-defachang",
    name: "德发长饺子馆(钟楼店)",
    category: "餐厅",
    area: "陕西省西安市碑林区",
    address: "钟鼓楼广场周边",
    latitude: 34.2606,
    longitude: 108.9412,
    osmKey: "amenity",
    osmValue: "restaurant",
    provider: "mock",
    tags: "老字号,饺子宴,钟楼",
    businessArea: "钟楼",
    photos: [],
  },
  {
    id: "mock-xian-terracotta",
    name: "秦始皇帝陵博物院(兵马俑)",
    category: "景点",
    area: "陕西省西安市临潼区",
    address: "秦陵北路",
    latitude: 34.381667,
    longitude: 109.253889,
    osmKey: "tourism",
    osmValue: "museum",
    provider: "mock",
    tags: "世界奇迹,秦代,陶俑",
    businessArea: "兵马俑",
    photos: [],
  },
  {
    id: "mock-xian-huaqinggong",
    name: "华清宫",
    category: "景点",
    area: "陕西省西安市临潼区",
    address: "华清路 38 号",
    latitude: 34.3675,
    longitude: 109.214,
    osmKey: "tourism",
    osmValue: "attraction",
    provider: "mock",
    tags: "唐代,温泉,长恨歌",
    businessArea: "临潼",
    photos: [],
  },
  {
    id: "mock-xian-lishan",
    name: "骊山",
    category: "景点",
    area: "陕西省西安市临潼区",
    address: "西安市临潼区",
    latitude: 34.353066,
    longitude: 109.21535,
    osmKey: "natural",
    osmValue: "peak",
    provider: "mock",
    tags: "山峰,兵谏亭,骊山晚照",
    businessArea: "临潼",
    photos: [],
  },
  {
    id: "mock-xian-qin-mausoleum",
    name: "秦始皇陵",
    category: "景点",
    area: "陕西省西安市临潼区",
    address: "秦陵北路附近",
    latitude: 34.3815,
    longitude: 109.2534,
    osmKey: "historic",
    osmValue: "archaeological_site",
    provider: "mock",
    tags: "帝王陵墓,世界遗产",
    businessArea: "兵马俑",
    photos: [],
  },
  {
    id: "mock-xian-lintong",
    name: "临潼区",
    category: "其他",
    area: "陕西省西安市",
    address: "西安市临潼区",
    provider: "mock",
    tags: "行政区,兵马俑所在地",
    photos: [],
  },
];

const placeSuggestions: PlaceSuggestion[] = rawPlaceSuggestions.map(
  (suggestion) => {
    const kind = inferPlaceKind({
      category: suggestion.category,
      name: suggestion.name,
      osmKey: suggestion.osmKey,
      osmValue: suggestion.osmValue,
    });

    return {
      ...suggestion,
      category: kind.category,
      iconKey: kind.iconKey,
      poiGroup: kind.poiGroup,
      poiType: kind.poiType,
    };
  },
);

const defaultSuggestionIds = [
  "mock-xian-dayanta",
  "mock-xian-datang",
  "mock-xian-history-museum",
  "mock-xian-bell-tower",
  "mock-xian-muslim-quarter",
  "mock-xian-terracotta",
  "mock-xian-huaqinggong",
  "mock-xian-lishan",
];

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizeSearchRegionText(value?: string): string | undefined {
  const normalizedValue = value?.replace(/\s+/g, " ").trim();

  return normalizedValue || undefined;
}

/** Normalize text for coarse region comparisons. */
function normalizeComparableSearchText(value?: string): string {
  return (value ?? "").replace(/\s+/g, "").toLocaleLowerCase();
}

export function getTripTitlePlaceSearchRegion(
  title: string,
): string | undefined {
  const normalizedTitle = normalizeSearchRegionText(title);

  if (!normalizedTitle) {
    return undefined;
  }

  const firstPart = normalizedTitle
    .split(/[\s,，、·|/\\>-]+/)
    .map((part) => part.trim())
    .find(Boolean);

  if (!firstPart || /^\d/.test(firstPart) || firstPart.length > 12) {
    return undefined;
  }

  return firstPart;
}

function matchesSuggestion(
  suggestion: PlaceSuggestion,
  query: string,
): boolean {
  const haystack = [
    suggestion.name,
    suggestion.category,
    suggestion.area,
    suggestion.address,
  ]
    .join(" ")
    .toLocaleLowerCase();
  const terms = query
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  return terms.every((term) => haystack.includes(term));
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasValidSearchCoordinate<T extends PlaceSearchCenterInputPlace>(
  place: T | undefined,
): place is T & { latitude: number; longitude: number } {
  return Boolean(
    place &&
      isFiniteCoordinate(place.latitude) &&
      isFiniteCoordinate(place.longitude) &&
      Math.abs(place.latitude) <= 90 &&
      Math.abs(place.longitude) <= 180,
  );
}

function doesTripDayItemMatchSearchCenterPlace(
  item: TripDay["items"][number],
  place: TripDayPlaceSearchCenterInputPlace,
): boolean {
  return (
    item.placeId === place.id ||
    item.placeName === place.name ||
    item.title === place.name
  );
}

export function isValidPlaceSearchCenter(
  value?: PlaceSearchCenter,
): value is PlaceSearchCenter {
  return (
    isFiniteCoordinate(value?.latitude) &&
    isFiniteCoordinate(value?.longitude) &&
    Math.abs(value.latitude) <= 90 &&
    Math.abs(value.longitude) <= 180
  );
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function getPlaceSearchDistanceKm(
  fromCoordinates: TripGeoCoordinate,
  toCoordinates: TripGeoCoordinate,
): number {
  const earthRadiusKm = 6371;
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

export function formatPlaceSearchDistance(
  distanceKm?: number,
): string | undefined {
  if (!isFiniteCoordinate(distanceKm)) {
    return undefined;
  }

  if (distanceKm < 1) {
    return `${Math.max(1, Math.round(distanceKm * 1000))} m`;
  }

  if (distanceKm < 100) {
    return `${Number(distanceKm.toFixed(distanceKm < 10 ? 1 : 0))} km`;
  }

  return `${Math.round(distanceKm)} km`;
}

function getSuggestionDistanceKm(
  suggestion: PlaceSuggestion,
  center: PlaceSearchCenter,
): number | undefined {
  if (
    !isFiniteCoordinate(suggestion.latitude) ||
    !isFiniteCoordinate(suggestion.longitude)
  ) {
    return undefined;
  }

  return getPlaceSearchDistanceKm(center, {
    latitude: suggestion.latitude,
    longitude: suggestion.longitude,
  });
}

type PlaceSuggestionSortOptions = {
  nearbyCenter?: PlaceSearchCenter;
  preferredCategory?: TripPlaceCategory;
};

function getSuggestionCategoryRank(
  suggestion: PlaceSuggestion,
  preferredCategory?: TripPlaceCategory,
): number {
  return preferredCategory && suggestion.category !== preferredCategory ? 1 : 0;
}

function compareOptionalDistances(
  leftDistanceKm: number | undefined,
  rightDistanceKm: number | undefined,
): number {
  if (leftDistanceKm !== undefined && rightDistanceKm !== undefined) {
    return leftDistanceKm - rightDistanceKm;
  }

  if (leftDistanceKm !== undefined) {
    return -1;
  }

  if (rightDistanceKm !== undefined) {
    return 1;
  }

  return 0;
}

function attachPlaceSuggestionDistances(
  suggestions: PlaceSuggestion[],
  nearbyCenter?: PlaceSearchCenter,
): PlaceSuggestion[] {
  if (!isValidPlaceSearchCenter(nearbyCenter)) {
    return suggestions;
  }

  return suggestions.map((suggestion) => {
    const distanceKm = getSuggestionDistanceKm(suggestion, nearbyCenter);

    return distanceKm === undefined
      ? suggestion
      : { ...suggestion, distanceKm };
  });
}

export function sortPlaceSuggestionsByPreference(
  suggestions: PlaceSuggestion[],
  options: PlaceSuggestionSortOptions = {},
): PlaceSuggestion[] {
  const nearbyCenter = isValidPlaceSearchCenter(options.nearbyCenter)
    ? options.nearbyCenter
    : undefined;

  return suggestions
    .map((suggestion, index) => ({
      categoryRank: getSuggestionCategoryRank(
        suggestion,
        options.preferredCategory,
      ),
      distanceKm: nearbyCenter
        ? getSuggestionDistanceKm(suggestion, nearbyCenter)
        : undefined,
      index,
      suggestion,
    }))
    .sort((left, right) => {
      const categoryRankDiff = left.categoryRank - right.categoryRank;

      if (categoryRankDiff !== 0) {
        return categoryRankDiff;
      }

      return (
        compareOptionalDistances(left.distanceKm, right.distanceKm) ||
        left.index - right.index
      );
    })
    .map(({ distanceKm, suggestion }) =>
      distanceKm === undefined ? suggestion : { ...suggestion, distanceKm },
    );
}

export function sortPlaceSuggestionsByDistance(
  suggestions: PlaceSuggestion[],
  nearbyCenter?: PlaceSearchCenter,
): PlaceSuggestion[] {
  return sortPlaceSuggestionsByPreference(suggestions, { nearbyCenter });
}

function getDefaultSuggestions(
  category?: TripPlaceCategory,
  nearbyCenter?: PlaceSearchCenter,
): PlaceSuggestion[] {
  const defaults = isValidPlaceSearchCenter(nearbyCenter)
    ? placeSuggestions
    : defaultSuggestionIds
        .map((id) =>
          placeSuggestions.find((suggestion) => suggestion.id === id),
        )
        .filter((suggestion): suggestion is PlaceSuggestion =>
          Boolean(suggestion),
        );

  return sortPlaceSuggestionsByPreference(defaults, {
    nearbyCenter,
    preferredCategory: category,
  });
}

export function getPlacesSearchCenter(
  places: PlaceSearchCenterInputPlace[],
  label = "附近地点",
): PlaceSearchCenter | undefined {
  const coordinates = places.filter(hasValidSearchCoordinate);

  if (coordinates.length === 0) {
    return undefined;
  }

  if (coordinates.length === 1) {
    return {
      latitude: coordinates[0].latitude,
      longitude: coordinates[0].longitude,
      label: coordinates[0].name ?? label,
    };
  }

  return {
    latitude:
      coordinates.reduce((sum, place) => sum + place.latitude, 0) /
      coordinates.length,
    longitude:
      coordinates.reduce((sum, place) => sum + place.longitude, 0) /
      coordinates.length,
    label,
  };
}

export function getTripDayPlaceSearchCenter(
  day: TripDay,
  places: TripDayPlaceSearchCenterInputPlace[],
): PlaceSearchCenter | undefined {
  const sortedDayPlaces = day.items
    .map((item) =>
      places.find((place) =>
        doesTripDayItemMatchSearchCenterPlace(item, place),
      ),
    )
    .filter(hasValidSearchCoordinate);

  const lastDayPlace = sortedDayPlaces[sortedDayPlaces.length - 1];

  if (!lastDayPlace) {
    return getPlacesSearchCenter(places, "本次行程");
  }

  return {
    latitude: lastDayPlace.latitude,
    longitude: lastDayPlace.longitude,
    label: lastDayPlace.name,
  };
}

export function searchLocalPlaceSuggestions(
  query: string,
  category?: TripPlaceCategory,
  options?: Pick<SearchPlaceSuggestionsOptions, "nearbyCenter">,
): PlaceSuggestion[] {
  const normalizedQuery = normalizeSearchText(query);
  const baseSuggestions = normalizedQuery
    ? placeSuggestions.filter((suggestion) =>
        matchesSuggestion(suggestion, normalizedQuery),
      )
    : getDefaultSuggestions(category, options?.nearbyCenter);

  return sortPlaceSuggestionsByPreference(baseSuggestions, {
    nearbyCenter: options?.nearbyCenter,
    preferredCategory: category,
  }).slice(0, SEARCH_RESULT_LIMIT);
}

function mergeSuggestions(
  primary: PlaceSuggestion[],
  fallback: PlaceSuggestion[],
): PlaceSuggestion[] {
  const seen = new Set<string>();

  return [...primary, ...fallback].filter((suggestion) => {
    const key = `${suggestion.providerPlaceId ?? suggestion.id}:${suggestion.name}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function mergeSuggestionGroups(
  suggestionGroups: PlaceSuggestion[][],
): PlaceSuggestion[] {
  return suggestionGroups.reduce(
    (mergedSuggestions, suggestions) =>
      mergeSuggestions(mergedSuggestions, suggestions),
    [],
  );
}

function createSuggestionFromPoiCloudEntry(
  entry: PoiCloudSearchEntry,
): PlaceSuggestion {
  const { place } = entry;
  const kind = inferPlaceKind({
    category: place.category,
    name: place.name,
    osmKey: place.osmKey,
    osmValue: place.osmValue,
  });

  return {
    id: place.id,
    provider: "poi_cache",
    providerPlaceId: place.providerPlaceId ?? place.externalRefs?.amapPoiId,
    name: place.name,
    category: place.category,
    area: place.area ?? place.externalRefs?.amapCityName ?? "公共地点缓存",
    address: place.address ?? "地址信息待补充",
    iconKey: place.iconKey ?? kind.iconKey,
    latitude: place.latitude,
    longitude: place.longitude,
    mapBoundary: place.mapBoundary,
    osmKey: place.osmKey,
    osmValue: place.osmValue,
    poiGroup: place.poiGroup ?? kind.poiGroup,
    poiType: place.poiType ?? kind.poiType,
    externalRefs: place.externalRefs,
    rating: place.details?.rating,
    costPerPerson: place.details?.priceLevel,
    phone: place.details?.phone,
    openingHoursToday: place.details?.openingHours,
    photos: place.photos?.map((photo) => ({
      title: photo.credit ?? photo.sourceLabel,
      url: photo.url,
    })),
    distanceKm: entry.distanceKm,
  };
}

function doesSuggestionMatchRegion(
  suggestion: PlaceSuggestion,
  regionText?: string,
): boolean {
  const normalizedRegion = normalizeComparableSearchText(regionText);

  if (!normalizedRegion) {
    return false;
  }

  const regionTokens = [
    suggestion.area,
    suggestion.address,
    suggestion.externalRefs?.amapCityName,
    suggestion.externalRefs?.amapAdcode,
    suggestion.externalRefs?.amapCitycode,
  ]
    .map((value) => normalizeComparableSearchText(value))
    .filter(Boolean);

  return regionTokens.some(
    (token) =>
      token.includes(normalizedRegion) || normalizedRegion.includes(token),
  );
}

function getSuggestionLocalDistanceKm(
  suggestion: PlaceSuggestion,
  nearbyCenter?: PlaceSearchCenter,
): number | undefined {
  if (!isValidPlaceSearchCenter(nearbyCenter)) {
    return undefined;
  }

  return (
    suggestion.distanceKm ?? getSuggestionDistanceKm(suggestion, nearbyCenter)
  );
}

function isCloudSuggestionLocallyRelevant(
  suggestion: PlaceSuggestion,
  options?: SearchPlaceSuggestionsOptions,
): boolean {
  const distanceKm = getSuggestionLocalDistanceKm(
    suggestion,
    options?.nearbyCenter,
  );

  if (distanceKm !== undefined) {
    return distanceKm <= CLOUD_CACHE_LOCAL_HIT_RADIUS_KM;
  }

  return doesSuggestionMatchRegion(suggestion, options?.regionText);
}

function canUseCloudSuggestionsWithoutAmap(
  cloudSuggestions: PlaceSuggestion[],
  options?: SearchPlaceSuggestionsOptions,
): boolean {
  if (cloudSuggestions.length === 0) {
    return false;
  }

  if (
    !isValidPlaceSearchCenter(options?.nearbyCenter) &&
    !normalizeSearchRegionText(options?.regionText)
  ) {
    return false;
  }

  return cloudSuggestions.some((suggestion) =>
    isCloudSuggestionLocallyRelevant(suggestion, options),
  );
}

async function searchCloudPlaceSuggestions(
  query: string,
  category: TripPlaceCategory | undefined,
  options?: SearchPlaceSuggestionsOptions,
): Promise<PlaceSuggestion[]> {
  const entries = await searchPoiCacheEntriesFromCloud(query, {
    category,
    limit: SEARCH_RESULT_LIMIT,
    nearbyCenter: isValidPlaceSearchCenter(options?.nearbyCenter)
      ? options.nearbyCenter
      : undefined,
    regionText: options?.regionText,
    signal: options?.signal,
  });

  return entries.map(createSuggestionFromPoiCloudEntry);
}

function syncAmapSuggestionsToCloud(suggestions: PlaceSuggestion[]): void {
  const amapPlaces: TripPlace[] = suggestions
    .filter(
      (suggestion) =>
        suggestion.provider === "amap" && suggestion.externalRefs?.amapPoiId,
    )
    .map((suggestion) => ({
      id: `amap-${suggestion.externalRefs?.amapPoiId}`,
      name: suggestion.name,
      category: suggestion.category,
      isScheduled: false,
      address: suggestion.address,
      area: suggestion.area,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      iconKey: suggestion.iconKey,
      poiGroup: suggestion.poiGroup,
      poiType: suggestion.poiType,
      providerPlaceId: suggestion.providerPlaceId,
      externalRefs: suggestion.externalRefs,
      details:
        suggestion.rating != null ||
        suggestion.phone ||
        suggestion.openingHoursToday ||
        suggestion.costPerPerson ||
        suggestion.tags
          ? {
              rating: suggestion.rating,
              ratingSource: suggestion.rating != null ? "高德" : undefined,
              phone: suggestion.phone,
              openingHours: suggestion.openingHoursToday,
              priceLevel: suggestion.costPerPerson,
              tags: suggestion.tags,
            }
          : undefined,
      photos: suggestion.photos?.map((photo, index) => ({
        id: `amap-photo-${suggestion.providerPlaceId ?? suggestion.id}-${index}`,
        url: photo.url,
        sourceLabel: "高德",
        ...(photo.title ? { credit: photo.title } : {}),
      })),
    }));

  if (amapPlaces.length > 0) {
    batchSyncPoiToCloud(amapPlaces).catch((error) => {
      placeSearchLogger.warn(
        "poi-cache.batch-sync.failed",
        { error, placeCount: amapPlaces.length },
        "Failed to batch sync place search results to POI cache",
      );
    });
  }
}

function getRejectedReason(
  result: PromiseSettledResult<PlaceSuggestion[]>,
): unknown {
  return result.status === "rejected" ? result.reason : undefined;
}

function addTextSearchRequests(
  requests: Promise<PlaceSuggestion[]>[],
  query: string,
  category: TripPlaceCategory | undefined,
  regionText: string | undefined,
  limit: number,
  options?: SearchPlaceSuggestionsOptions,
) {
  const baseOptions = {
    limit,
    mode: "text" as const,
    signal: options?.signal,
    types: options?.amapTypes,
  };

  if (regionText) {
    requests.push(
      searchAmapPlaceSuggestions(query, category, {
        ...baseOptions,
        city: regionText,
        cityLimit: false,
      }),
    );
  }

  requests.push(
    searchAmapPlaceSuggestions(query, category, {
      ...baseOptions,
      cityLimit: false,
    }),
  );
}

async function searchRemotePlaceSuggestions(
  query: string,
  category: TripPlaceCategory | undefined,
  options?: SearchPlaceSuggestionsOptions,
): Promise<PlaceSuggestion[]> {
  const nearbyCenter = isValidPlaceSearchCenter(options?.nearbyCenter)
    ? options.nearbyCenter
    : undefined;
  const regionText = normalizeSearchRegionText(options?.regionText);
  const requests: Promise<PlaceSuggestion[]>[] = [];

  if (nearbyCenter) {
    requests.push(
      searchAmapPlaceSuggestions(query, category, {
        limit: query ? NEARBY_REMOTE_RESULT_LIMIT : SEARCH_RESULT_LIMIT,
        nearbyCenter,
        signal: options?.signal,
        sortRule: "weight",
        types: options?.amapTypes,
      }),
    );

    if (query) {
      addTextSearchRequests(
        requests,
        query,
        category,
        regionText,
        BROAD_REMOTE_RESULT_LIMIT,
        options,
      );
    }
  } else {
    addTextSearchRequests(
      requests,
      query,
      category,
      regionText,
      SEARCH_RESULT_LIMIT,
      options,
    );
  }

  const results = await Promise.allSettled(requests);
  const successfulSuggestionGroups = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );

  if (successfulSuggestionGroups.length > 0) {
    return mergeSuggestionGroups(successfulSuggestionGroups);
  }

  const rejectedReason = results.map(getRejectedReason).find(Boolean);

  if (rejectedReason) {
    throw rejectedReason;
  }

  return [];
}
export async function searchPlaceSuggestions(
  query: string,
  category?: TripPlaceCategory,
  options?: SearchPlaceSuggestionsOptions,
): Promise<PlaceSuggestion[]> {
  const normalizedQuery = normalizeSearchText(query);
  const localSuggestions = searchLocalPlaceSuggestions(
    normalizedQuery,
    category,
    {
      nearbyCenter: options?.nearbyCenter,
    },
  );

  if (!normalizedQuery) {
    if (!isValidPlaceSearchCenter(options?.nearbyCenter)) {
      return localSuggestions;
    }
  }

  if (normalizedQuery && normalizedQuery.length < minRemoteQueryLength) {
    return localSuggestions;
  }

  const context = options?.context ?? "trip";
  const nearbyCacheKey = isValidPlaceSearchCenter(options?.nearbyCenter)
    ? `${options.nearbyCenter.latitude.toFixed(4)},${options.nearbyCenter.longitude.toFixed(4)}`
    : "anywhere";
  const regionCacheKey =
    normalizeSearchRegionText(options?.regionText) ?? "anywhere";
  const typesCacheKey = options?.amapTypes ?? "default-types";
  const queryCacheKey = normalizedQuery || "<nearby>";
  const cacheKey = `${context}:${category ?? "all"}:${typesCacheKey}:${nearbyCacheKey}:${regionCacheKey}:${queryCacheKey}`;
  const cachedSuggestions = searchCache.get(cacheKey);

  if (cachedSuggestions) {
    if (options?.persistResults !== false) {
      syncAmapSuggestionsToCloud(cachedSuggestions);
    }
    return cachedSuggestions;
  }

  const cloudSuggestions = await searchCloudPlaceSuggestions(
    normalizedQuery,
    category,
    options,
  );
  const cloudMergedSuggestions = attachPlaceSuggestionDistances(
    mergeSuggestions(cloudSuggestions, localSuggestions),
    options?.nearbyCenter,
  ).slice(0, SEARCH_RESULT_LIMIT);

  if (canUseCloudSuggestionsWithoutAmap(cloudSuggestions, options)) {
    searchCache.set(cacheKey, cloudMergedSuggestions);
    return cloudMergedSuggestions;
  }

  if (!isAmapWebServiceConfigured()) {
    if (cloudMergedSuggestions.length > 0 || localSuggestions.length > 0) {
      return cloudMergedSuggestions.length > 0
        ? cloudMergedSuggestions
        : localSuggestions;
    }

    throw new Error(
      "高德地点服务未配置，请先设置 Supabase URL、anon key，并部署 amap-proxy Edge Function。",
    );
  }

  try {
    const remoteSuggestions = await searchRemotePlaceSuggestions(
      normalizedQuery,
      category,
      options,
    );
    const suggestions = attachPlaceSuggestionDistances(
      mergeSuggestionGroups([
        remoteSuggestions,
        cloudSuggestions,
        localSuggestions,
      ]),
      options?.nearbyCenter,
    ).slice(0, SEARCH_RESULT_LIMIT);

    searchCache.set(cacheKey, suggestions);
    if (options?.persistResults !== false) {
      syncAmapSuggestionsToCloud(suggestions);
    }

    return suggestions;
  } catch (error) {
    if (options?.signal?.aborted) {
      throw error;
    }

    if (localSuggestions.length === 0) {
      throw error;
    }

    placeSearchLogger.warn(
      "amap.search.failed",
      { error },
      "Failed to search Amap places",
    );
    return localSuggestions;
  }
}
