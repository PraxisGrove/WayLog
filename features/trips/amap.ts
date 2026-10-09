import { getCurrentAuthAccessToken } from "../auth/storage";
import { getSupabaseConfig } from "../auth/supabase";
import { inferPlaceKind } from "./place-kind";
import type { PlaceSearchCenter, PlaceSuggestion } from "./place-search";
import type { TripPlace, TripPlaceCategory } from "./types";

export type AmapCoordinate = {
  latitude: number;
  longitude: number;
};

export type AmapRouteMode = "driving" | "cycling" | "walking" | "transit";

export type AmapRouteResult = {
  distanceKm: number;
  durationMinutes: number;
  polyline?: AmapCoordinate[];
};

export type AmapRouteQueryOptions = {
  destinationCity?: string;
  originCity?: string;
};

export type AmapAoiBoundaryResult = {
  id: string;
  name?: string;
  paths: AmapCoordinate[][];
};

type AmapPoi = Record<string, unknown>;

type AmapPlaceSearchResponse = {
  info?: string;
  infocode?: string;
  pois?: unknown;
  status?: string;
};

type AmapRegeocodeResponse = {
  info?: string;
  infocode?: string;
  regeocode?: unknown;
  status?: string;
};

type AmapWeatherResponse = {
  forecasts?: unknown;
  info?: string;
  infocode?: string;
  status?: string;
};

export type AmapRegeocodeResult = {
  adcode: string;
  city?: string;
  district?: string;
  province?: string;
};

export type AmapWeatherCast = {
  date?: string;
  daypower?: string;
  daytemp?: string;
  dayweather?: string;
  daywind?: string;
  nightpower?: string;
  nighttemp?: string;
  nightweather?: string;
  nightwind?: string;
  week?: string;
};

export type AmapWeatherForecast = {
  adcode?: string;
  casts: AmapWeatherCast[];
  city?: string;
  province?: string;
  reporttime?: string;
};

type AmapPlaceSearchMode = "around" | "text";

type AmapPlaceSearchOptions = {
  city?: string;
  cityLimit?: boolean;
  limit?: number;
  mode?: AmapPlaceSearchMode;
  nearbyCenter?: PlaceSearchCenter;
  signal?: AbortSignal;
  sortRule?: "distance" | "weight";
  types?: string;
};

type AmapRouteResponse = {
  data?: unknown;
  errcode?: number;
  errmsg?: string;
  info?: string;
  infocode?: string;
  route?: unknown;
  status?: string;
};

type AmapAoiBoundaryResponse = {
  aois?: unknown;
  data?: unknown;
  info?: string;
  infocode?: string;
  status?: number | string;
};

type RouteEndpointConfig = {
  path: string;
  version: "v3" | "v4";
};

const AMAP_URI_BASE_URL = "https://uri.amap.com";
const AMAP_PROXY_FUNCTION_NAME = "amap-proxy";
const AMAP_SEARCH_RESULT_LIMIT = 8;
const AMAP_AROUND_SEARCH_RADIUS_METERS = 50000;
const AMAP_AROUND_SEARCH_ENABLED = false;
const AMAP_DEFAULT_ZOOM = 15;
const AMAP_SOURCE_NAME = "waylog";

export type AmapPoiTypeFilter = {
  category: TripPlaceCategory;
  code: string;
  label: string;
  shortLabel: string;
};

export type AmapPrimaryPoiCategoryId =
  | "attractions"
  | "food"
  | "stay"
  | "transit"
  | "shopping"
  | "education"
  | "medical"
  | "leisure"
  | "services"
  | "urgent";

export type AmapPrimaryPoiCategory = {
  id: AmapPrimaryPoiCategoryId;
  label: string;
  preferredTripCategory?: TripPlaceCategory;
  secondaryTypeCodes: string[];
  secondaryTypes: AmapPoiTypeFilter[];
};

export const amapPoiTypeFilters: AmapPoiTypeFilter[] = [
  {
    code: "010000",
    label: "汽车服务",
    shortLabel: "汽车服务",
    category: "交通",
  },
  {
    code: "020000",
    label: "汽车销售",
    shortLabel: "汽车销售",
    category: "交通",
  },
  {
    code: "030000",
    label: "汽车维修",
    shortLabel: "汽车维修",
    category: "交通",
  },
  {
    code: "040000",
    label: "摩托车服务",
    shortLabel: "摩托车",
    category: "交通",
  },
  { code: "050000", label: "餐饮服务", shortLabel: "餐饮", category: "餐厅" },
  { code: "060000", label: "购物服务", shortLabel: "购物", category: "购物" },
  { code: "070000", label: "生活服务", shortLabel: "生活", category: "其他" },
  {
    code: "080000",
    label: "体育休闲服务",
    shortLabel: "休闲",
    category: "景点",
  },
  {
    code: "090000",
    label: "医疗保健服务",
    shortLabel: "医疗",
    category: "医疗",
  },
  { code: "100000", label: "住宿服务", shortLabel: "住宿", category: "酒店" },
  { code: "110000", label: "风景名胜", shortLabel: "景点", category: "景点" },
  {
    code: "120000",
    label: "商务住宅",
    shortLabel: "商务住宅",
    category: "其他",
  },
  {
    code: "130000",
    label: "政府机构及社会团体",
    shortLabel: "政府社会",
    category: "其他",
  },
  {
    code: "140000",
    label: "科教文化服务",
    shortLabel: "科教文化",
    category: "教育",
  },
  {
    code: "150000",
    label: "交通设施服务",
    shortLabel: "交通",
    category: "交通",
  },
  {
    code: "160000",
    label: "金融保险服务",
    shortLabel: "金融",
    category: "其他",
  },
  { code: "170000", label: "公司企业", shortLabel: "企业", category: "其他" },
  {
    code: "180000",
    label: "道路附属设施",
    shortLabel: "道路附属",
    category: "交通",
  },
  {
    code: "190000",
    label: "地名地址信息",
    shortLabel: "地名地址",
    category: "其他",
  },
  {
    code: "200000",
    label: "公共设施",
    shortLabel: "公共设施",
    category: "其他",
  },
  {
    code: "220000",
    label: "事件活动",
    shortLabel: "事件活动",
    category: "其他",
  },
  {
    code: "970000",
    label: "室内设施",
    shortLabel: "室内设施",
    category: "其他",
  },
  {
    code: "980000",
    label: "虚拟数据",
    shortLabel: "虚拟数据",
    category: "其他",
  },
  {
    code: "990000",
    label: "通行设施",
    shortLabel: "通行设施",
    category: "交通",
  },
];

const amapPoiTypeFilterByCode = new Map(
  amapPoiTypeFilters.map((filter) => [filter.code, filter] as const),
);

type AmapPrimaryPoiCategoryDefinition = Omit<
  AmapPrimaryPoiCategory,
  "secondaryTypes"
>;

const amapPrimaryPoiCategoryDefinitions: AmapPrimaryPoiCategoryDefinition[] = [
  {
    id: "attractions",
    label: "景点",
    preferredTripCategory: "景点",
    secondaryTypeCodes: ["110000"],
  },
  {
    id: "food",
    label: "餐饮",
    preferredTripCategory: "餐厅",
    secondaryTypeCodes: ["050000"],
  },
  {
    id: "stay",
    label: "住宿",
    preferredTripCategory: "酒店",
    secondaryTypeCodes: ["100000", "120000"],
  },
  {
    id: "transit",
    label: "交通",
    preferredTripCategory: "交通",
    secondaryTypeCodes: [
      "150000",
      "180000",
      "990000",
      "010000",
      "020000",
      "030000",
      "040000",
    ],
  },
  {
    id: "shopping",
    label: "购物",
    preferredTripCategory: "购物",
    secondaryTypeCodes: ["060000"],
  },
  {
    id: "education",
    label: "教育",
    preferredTripCategory: "教育",
    secondaryTypeCodes: ["140000"],
  },
  {
    id: "medical",
    label: "医疗",
    preferredTripCategory: "医疗",
    secondaryTypeCodes: ["090000"],
  },
  {
    id: "leisure",
    label: "休闲",
    preferredTripCategory: "景点",
    secondaryTypeCodes: ["080000", "220000"],
  },
  {
    id: "services",
    label: "生活",
    preferredTripCategory: "其他",
    secondaryTypeCodes: [
      "070000",
      "190000",
      "200000",
      "970000",
      "980000",
      "170000",
    ],
  },
  {
    id: "urgent",
    label: "应急",
    preferredTripCategory: "其他",
    secondaryTypeCodes: ["090000", "130000", "160000"],
  },
];

const defaultAmapPoiTypeCodesByTripCategory: Partial<
  Record<TripPlaceCategory, string[]>
> = {
  景点: ["110000", "080000"],
  餐厅: ["050000"],
  酒店: ["100000", "120000"],
  交通: ["150000", "180000", "990000", "010000", "020000", "030000", "040000"],
  购物: ["060000"],
  教育: ["140000"],
  医疗: ["090000"],
};

export const amapPrimaryPoiCategories: AmapPrimaryPoiCategory[] =
  amapPrimaryPoiCategoryDefinitions.map((category) => ({
    ...category,
    secondaryTypes: category.secondaryTypeCodes
      .map((code) => amapPoiTypeFilterByCode.get(code))
      .filter((filter): filter is AmapPoiTypeFilter => Boolean(filter)),
  }));

const routeEndpointMap: Record<AmapRouteMode, RouteEndpointConfig> = {
  driving: {
    path: "/v3/direction/driving",
    version: "v3",
  },
  walking: {
    path: "/v3/direction/walking",
    version: "v3",
  },
  cycling: {
    path: "/v4/direction/bicycling",
    version: "v4",
  },
  transit: {
    path: "/v3/direction/transit/integrated",
    version: "v3",
  },
};

export function isAmapWebServiceConfigured(): boolean {
  try {
    const config = getSupabaseConfig();

    return Boolean(config.url && config.anonKey);
  } catch {
    return false;
  }
}

function getAmapProxyUrl(path = AMAP_PROXY_FUNCTION_NAME): string {
  const config = getSupabaseConfig();

  return `${config.url}/functions/v1/${path}`;
}

function normalizeAmapProxyParams(
  params: Record<string, string | undefined>,
): Record<string, string> {
  const normalizedParams: Record<string, string> = {};

  Object.entries(params).forEach(([name, value]) => {
    if (value) {
      normalizedParams[name] = value;
    }
  });

  return normalizedParams;
}

async function fetchAmapJson<T>(
  path: string,
  params: Record<string, string | undefined>,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const config = getSupabaseConfig();
  const accessToken = await getCurrentAuthAccessToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    apikey: config.anonKey,
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(getAmapProxyUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify({
      path,
      params: normalizeAmapProxyParams(params),
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`Amap proxy request failed: HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

function getStringValue(
  source: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = source[key];

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return undefined;
}

function getFirstStringValue(
  source: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = source[key];

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .find(
        (item): item is string =>
          typeof item === "string" && Boolean(item.trim()),
      )
      ?.trim();
  }

  return undefined;
}

function getObjectValue(
  source: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = source[key];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function getArrayObjects(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null,
  );
}

function getAmapAdcode(value?: string): string | undefined {
  const adcode = value?.trim();
  return adcode && /^\d{6}$/.test(adcode) ? adcode : undefined;
}

function getAmapCitycode(value?: string): string | undefined {
  const citycode = value?.trim();
  return citycode && /^\d{3,4}$/.test(citycode) ? citycode : undefined;
}

function isAmapSuccess(data: {
  info?: string;
  infocode?: string;
  status?: string;
}): boolean {
  return data.status === "1";
}

function throwAmapResponseError(
  data: { info?: string; infocode?: string },
  fallback: string,
): never {
  const detail = [data.info, data.infocode].filter(Boolean).join(" / ");
  throw new Error(detail ? `${fallback}：${detail}` : fallback);
}

function parseAmapLocation(location?: string): AmapCoordinate | undefined {
  if (!location) {
    return undefined;
  }

  const [longitudeText, latitudeText] = location.split(",");
  const longitude = Number(longitudeText);
  const latitude = Number(latitudeText);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return undefined;
  }

  return {
    latitude,
    longitude,
  };
}

function formatAmapCoordinate(coordinate: AmapCoordinate): string {
  return `${formatAmapCoordinatePart(coordinate.longitude)},${formatAmapCoordinatePart(coordinate.latitude)}`;
}

function isValidAmapCoordinate(
  value?: AmapCoordinate,
): value is AmapCoordinate {
  return (
    typeof value?.latitude === "number" &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    Math.abs(value.latitude) <= 90 &&
    Math.abs(value.longitude) <= 180
  );
}

function getAmapPoiTypeCodesByTripCategory(
  category?: TripPlaceCategory,
): string[] | undefined {
  if (!category) {
    return undefined;
  }

  const codes = defaultAmapPoiTypeCodesByTripCategory[category];
  return codes?.length ? codes : undefined;
}

export function joinAmapPoiTypeCodes(codes: string[]): string | undefined {
  const normalizedCodes = [
    ...new Set(codes.map((code) => code.trim()).filter(Boolean)),
  ];

  return normalizedCodes.length > 0 ? normalizedCodes.join("|") : undefined;
}

function getAmapPoiTypesByTripCategory(
  category?: TripPlaceCategory,
): string | undefined {
  const codes = getAmapPoiTypeCodesByTripCategory(category);
  return codes ? joinAmapPoiTypeCodes(codes) : undefined;
}

function formatAmapCoordinatePart(value: number): string {
  return Number(value.toFixed(6)).toString();
}

function getAmapCategory(typecode?: string, type?: string): TripPlaceCategory {
  if (typecode?.startsWith("05")) {
    return "餐厅";
  }

  if (typecode?.startsWith("06")) {
    return "购物";
  }

  if (typecode?.startsWith("10")) {
    return "酒店";
  }

  if (
    typecode?.startsWith("01") ||
    typecode?.startsWith("02") ||
    typecode?.startsWith("03") ||
    typecode?.startsWith("04") ||
    typecode?.startsWith("15") ||
    typecode?.startsWith("18") ||
    typecode?.startsWith("99")
  ) {
    return "交通";
  }

  if (
    typecode?.startsWith("08") ||
    typecode?.startsWith("11") ||
    typecode?.startsWith("1415") ||
    typecode?.startsWith("1416") ||
    type?.includes("风景名胜") ||
    type?.includes("博物馆") ||
    type?.includes("纪念馆")
  ) {
    return "景点";
  }

  if (
    typecode?.startsWith("1411") ||
    typecode?.startsWith("1412") ||
    typecode?.startsWith("1413") ||
    typecode?.startsWith("1414")
  ) {
    return "教育";
  }

  if (
    typecode?.startsWith("09") ||
    type?.includes("医院") ||
    type?.includes("诊所") ||
    type?.includes("药房")
  ) {
    return "医疗";
  }

  return "其他";
}

function getAmapPoiType(typecode?: string, type?: string): string {
  if (typecode?.startsWith("0501")) {
    return "restaurant";
  }

  if (typecode?.startsWith("0505")) {
    return "cafe";
  }

  if (typecode?.startsWith("1001")) {
    return "hotel";
  }

  if (typecode?.startsWith("1501")) {
    return "transport";
  }

  if (typecode?.startsWith("1505")) {
    return "subway";
  }

  if (typecode?.startsWith("1502")) {
    return "airport";
  }

  if (typecode?.startsWith("0601") || typecode?.startsWith("0604")) {
    return "mall";
  }

  if (typecode?.startsWith("11")) {
    return "attraction";
  }

  if (typecode?.startsWith("1411")) {
    return "research";
  }

  if (typecode?.startsWith("1412")) {
    return "school";
  }

  if (typecode?.startsWith("1413")) {
    return "university";
  }

  if (typecode?.startsWith("1414")) {
    return "library";
  }

  if (typecode?.startsWith("0901") || typecode?.startsWith("0902")) {
    return "hospital";
  }

  if (typecode?.startsWith("0903") || typecode?.startsWith("0906")) {
    return "clinic";
  }

  if (typecode?.startsWith("0905")) {
    return "pharmacy";
  }

  return type || typecode || "place";
}

function getAmapArea(poi: AmapPoi): string {
  return [
    getFirstStringValue(poi, "pname"),
    getFirstStringValue(poi, "cityname"),
    getFirstStringValue(poi, "adname"),
  ]
    .filter(Boolean)
    .join(" · ");
}

function getAmapAddress(poi: AmapPoi): string {
  const address = getFirstStringValue(poi, "address");

  if (address) {
    return address;
  }

  return getAmapArea(poi) || "地址信息待补充";
}

function parseAmapSecondaryType(type?: string): string | undefined {
  if (!type) {
    return undefined;
  }

  const parts = type.split(";");
  return parts.length > 1 ? parts[1]?.trim() : undefined;
}

function mapAmapPoi(poi: AmapPoi): PlaceSuggestion | null {
  const id = getStringValue(poi, "id");
  const name = getFirstStringValue(poi, "name");
  const location = parseAmapLocation(getStringValue(poi, "location"));

  if (!id || !name || !location) {
    return null;
  }

  const type = getFirstStringValue(poi, "type");
  const typecode = getFirstStringValue(poi, "typecode");
  const adcode = getAmapAdcode(getFirstStringValue(poi, "adcode"));
  const citycode = getAmapCitycode(getFirstStringValue(poi, "citycode"));
  const cityName = getFirstStringValue(poi, "cityname");
  const category = getAmapCategory(typecode, type);
  const poiType = getAmapPoiType(typecode, type);
  const amapSecondary = parseAmapSecondaryType(type);
  const kind = inferPlaceKind({
    category,
    name,
    amapSecondary,
  });

  const rawBusiness = poi.business;
  const business =
    typeof rawBusiness === "object" && rawBusiness !== null
      ? (rawBusiness as Record<string, unknown>)
      : undefined;
  const bizRating = business?.rating ?? poi.rating;
  const bizCost = business?.cost ?? poi.cost;
  const bizTel = business?.tel ?? poi.tel;
  const bizOpentime = business?.opentime_today ?? poi.opentime_today;
  const bizTag = business?.tag ?? poi.tag;
  const bizArea = business?.business_area ?? poi.business_area;
  const rating = bizRating != null ? Number(bizRating) : undefined;
  const costPerPerson = bizCost != null ? String(bizCost) : undefined;
  const phone = bizTel != null ? String(bizTel) : undefined;
  const openingHoursToday =
    bizOpentime != null ? String(bizOpentime) : undefined;
  const tags = bizTag != null ? String(bizTag) : undefined;
  const businessArea = bizArea != null ? String(bizArea) : undefined;

  const rawPhotos = Array.isArray(poi.photos) ? poi.photos : [];
  const photos = rawPhotos
    .filter(
      (p): p is Record<string, unknown> => typeof p === "object" && p !== null,
    )
    .map((p) => ({
      title: getStringValue(p, "title"),
      url: (getStringValue(p, "url") ?? "").replace(/^http:\/\//, "https://"),
    }))
    .filter((p) => p.url.length > 0);

  return {
    id: `amap-${id}`,
    providerPlaceId: id,
    provider: "amap",
    name,
    category,
    area: getAmapArea(poi) || "高德地图地点",
    address: getAmapAddress(poi),
    iconKey: kind.iconKey,
    latitude: location.latitude,
    longitude: location.longitude,
    poiGroup: kind.poiGroup,
    poiType,
    externalRefs: {
      amapAdcode: adcode,
      amapCitycode: citycode,
      amapCityName: cityName,
      amapPoiId: id,
      mapUrl: buildAmapPlaceUrl({
        name,
        address: getAmapAddress(poi),
        area: getAmapArea(poi),
        latitude: location.latitude,
        longitude: location.longitude,
      }),
    },
    rating: Number.isFinite(rating) ? rating : undefined,
    costPerPerson,
    phone,
    openingHoursToday,
    tags,
    businessArea,
    photos: photos.length > 0 ? photos : undefined,
  };
}

export async function searchAmapPlaceSuggestions(
  query: string,
  category?: TripPlaceCategory,
  options: AmapPlaceSearchOptions = {},
): Promise<PlaceSuggestion[]> {
  const nearbyCenter = isValidAmapCoordinate(options.nearbyCenter)
    ? options.nearbyCenter
    : undefined;
  const shouldSearchAround =
    AMAP_AROUND_SEARCH_ENABLED &&
    Boolean(nearbyCenter && options.mode !== "text");
  const limit = Math.max(
    1,
    Math.min(25, Math.round(options.limit ?? AMAP_SEARCH_RESULT_LIMIT)),
  );
  const types = options.types ?? getAmapPoiTypesByTripCategory(category);
  const data = await fetchAmapJson<AmapPlaceSearchResponse>(
    shouldSearchAround ? "/v5/place/around" : "/v5/place/text",
    {
      keywords: query || undefined,
      types,
      region: shouldSearchAround ? undefined : options.city,
      location:
        shouldSearchAround && nearbyCenter
          ? formatAmapCoordinate(nearbyCenter)
          : undefined,
      radius: shouldSearchAround
        ? String(AMAP_AROUND_SEARCH_RADIUS_METERS)
        : undefined,
      sortrule: shouldSearchAround ? (options.sortRule ?? "weight") : undefined,
      page_size: String(limit),
      page_num: "1",
      show_fields: "business,photos",
      city_limit: shouldSearchAround
        ? undefined
        : String(options.cityLimit ?? false),
    },
    { signal: options.signal },
  );

  if (!isAmapSuccess(data)) {
    throwAmapResponseError(data, "高德地点搜索失败");
  }

  const pois = Array.isArray(data.pois) ? data.pois : [];

  return pois
    .map((poi) =>
      typeof poi === "object" && poi !== null
        ? mapAmapPoi(poi as AmapPoi)
        : null,
    )
    .filter((suggestion): suggestion is PlaceSuggestion => Boolean(suggestion));
}

export type AmapPlaceDetailResult = {
  rating?: number;
  ratingSource?: string;
  phone?: string;
  openingHours?: string;
  priceLevel?: string;
  photos?: { title?: string; url: string }[];
};

export async function queryAmapPlaceDetail(
  amapPoiId: string,
): Promise<AmapPlaceDetailResult | undefined> {
  if (!amapPoiId) return undefined;

  try {
    const data = await fetchAmapJson<AmapPlaceSearchResponse>(
      "/v5/place/detail",
      {
        id: amapPoiId,
        show_fields: "business,photos",
      },
    );

    if (!isAmapSuccess(data)) return undefined;

    const pois = Array.isArray(data.pois) ? data.pois : [];
    const poi = pois.find(
      (p): p is AmapPoi => typeof p === "object" && p !== null,
    );
    if (!poi) return undefined;

    const business =
      typeof poi.business === "object" && poi.business !== null
        ? (poi.business as Record<string, unknown>)
        : undefined;
    const rating = business ? Number(business.rating) : undefined;
    const rawPhotos = Array.isArray(poi.photos) ? poi.photos : [];
    const photos = rawPhotos
      .filter(
        (p): p is Record<string, unknown> =>
          typeof p === "object" && p !== null,
      )
      .map((p) => ({
        title: getStringValue(p, "title"),
        url: (getStringValue(p, "url") ?? "").replace(/^http:\/\//, "https://"),
      }))
      .filter((p) => p.url.length > 0);

    return {
      rating: Number.isFinite(rating) ? rating : undefined,
      ratingSource: Number.isFinite(rating) ? "高德" : undefined,
      phone: business ? getStringValue(business, "tel") : undefined,
      openingHours: business
        ? getStringValue(business, "opentime_today")
        : undefined,
      priceLevel: business ? getStringValue(business, "cost") : undefined,
      photos: photos.length > 0 ? photos : undefined,
    };
  } catch {
    return undefined;
  }
}

function mapAmapRegeocode(
  data: AmapRegeocodeResponse,
): AmapRegeocodeResult | undefined {
  const regeocode =
    typeof data.regeocode === "object" && data.regeocode !== null
      ? data.regeocode
      : undefined;
  const addressComponent = regeocode
    ? getObjectValue(regeocode as Record<string, unknown>, "addressComponent")
    : undefined;
  const adcode = addressComponent
    ? getAmapAdcode(getFirstStringValue(addressComponent, "adcode"))
    : undefined;

  if (!adcode) {
    return undefined;
  }

  return {
    adcode,
    city: addressComponent
      ? getFirstStringValue(addressComponent, "city")
      : undefined,
    district: addressComponent
      ? getFirstStringValue(addressComponent, "district")
      : undefined,
    province: addressComponent
      ? getFirstStringValue(addressComponent, "province")
      : undefined,
  };
}

export async function reverseGeocodeAmapCoordinate(
  coordinate: AmapCoordinate,
): Promise<AmapRegeocodeResult | undefined> {
  const data = await fetchAmapJson<AmapRegeocodeResponse>("/v3/geocode/regeo", {
    extensions: "base",
    location: formatAmapCoordinate(coordinate),
    radius: "1000",
  });

  if (!isAmapSuccess(data)) {
    throwAmapResponseError(data, "Amap reverse geocode failed");
  }

  return mapAmapRegeocode(data);
}

function mapAmapWeatherForecast(
  data: AmapWeatherResponse,
): AmapWeatherForecast | undefined {
  const forecastSource = getArrayObjects(data.forecasts)[0];

  if (!forecastSource) {
    return undefined;
  }

  const casts = getArrayObjects(forecastSource.casts).map((cast) => ({
    date: getFirstStringValue(cast, "date"),
    daypower: getFirstStringValue(cast, "daypower"),
    daytemp: getFirstStringValue(cast, "daytemp"),
    dayweather: getFirstStringValue(cast, "dayweather"),
    daywind: getFirstStringValue(cast, "daywind"),
    nightpower: getFirstStringValue(cast, "nightpower"),
    nighttemp: getFirstStringValue(cast, "nighttemp"),
    nightweather: getFirstStringValue(cast, "nightweather"),
    nightwind: getFirstStringValue(cast, "nightwind"),
    week: getFirstStringValue(cast, "week"),
  }));

  if (casts.length === 0) {
    return undefined;
  }

  return {
    adcode: getAmapAdcode(getFirstStringValue(forecastSource, "adcode")),
    casts,
    city: getFirstStringValue(forecastSource, "city"),
    province: getFirstStringValue(forecastSource, "province"),
    reporttime: getFirstStringValue(forecastSource, "reporttime"),
  };
}

export async function queryAmapWeatherForecast(
  adcode: string,
): Promise<AmapWeatherForecast | undefined> {
  const city = getAmapAdcode(adcode);

  if (!city) {
    return undefined;
  }

  const data = await fetchAmapJson<AmapWeatherResponse>(
    "/v3/weather/weatherInfo",
    {
      city,
      extensions: "all",
    },
  );

  if (!isAmapSuccess(data)) {
    throwAmapResponseError(data, "Amap weather query failed");
  }

  return mapAmapWeatherForecast(data);
}

function getRoutePaths(data: AmapRouteResponse): Record<string, unknown>[] {
  const routeSource =
    typeof data.route === "object" && data.route !== null
      ? data.route
      : undefined;
  const routePaths = routeSource
    ? (routeSource as Record<string, unknown>).paths
    : undefined;

  if (Array.isArray(routePaths)) {
    return routePaths.filter(
      (path): path is Record<string, unknown> =>
        typeof path === "object" && path !== null,
    );
  }

  const dataSource =
    typeof data.data === "object" && data.data !== null ? data.data : undefined;
  const dataPaths = dataSource
    ? (dataSource as Record<string, unknown>).paths
    : undefined;

  if (Array.isArray(dataPaths)) {
    return dataPaths.filter(
      (path): path is Record<string, unknown> =>
        typeof path === "object" && path !== null,
    );
  }

  return [];
}

function getRouteTransits(data: AmapRouteResponse): Record<string, unknown>[] {
  const routeSource =
    typeof data.route === "object" && data.route !== null
      ? data.route
      : undefined;
  const routeTransits = routeSource
    ? (routeSource as Record<string, unknown>).transits
    : undefined;

  if (Array.isArray(routeTransits)) {
    return routeTransits.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    );
  }

  return [];
}

function getRouteDistanceMeters(
  path: Record<string, unknown>,
): number | undefined {
  const distance = path.distance;

  if (typeof distance === "number" && Number.isFinite(distance)) {
    return distance;
  }

  if (typeof distance === "string") {
    const parsedDistance = Number(distance);
    return Number.isFinite(parsedDistance) ? parsedDistance : undefined;
  }

  return undefined;
}

function isAmapRouteResult(
  value: AmapRouteResult | undefined,
): value is AmapRouteResult {
  return Boolean(value);
}

function getRouteDurationSeconds(
  path: Record<string, unknown>,
): number | undefined {
  const duration = path.duration;

  if (typeof duration === "number" && Number.isFinite(duration)) {
    return duration;
  }

  if (typeof duration === "string") {
    const parsedDuration = Number(duration);
    return Number.isFinite(parsedDuration) ? parsedDuration : undefined;
  }

  return undefined;
}

function sumFiniteNumbers(values: (number | undefined)[]): number | undefined {
  const finiteValues = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );

  if (finiteValues.length === 0) {
    return undefined;
  }

  return finiteValues.reduce((total, value) => total + value, 0);
}

function parseAmapPolyline(polyline?: string): AmapCoordinate[] {
  if (!polyline) {
    return [];
  }

  return polyline
    .split(";")
    .map(parseAmapLocation)
    .filter((coordinate): coordinate is AmapCoordinate => Boolean(coordinate));
}

function parseAmapAoiPolyline(polyline?: string): AmapCoordinate[][] {
  if (!polyline) {
    return [];
  }

  return polyline
    .split("|")
    .map((path) =>
      path
        .split("_")
        .map(parseAmapLocation)
        .filter((coordinate): coordinate is AmapCoordinate =>
          Boolean(coordinate),
        ),
    )
    .filter((path) => path.length >= 3);
}

function normalizeAmapPoiId(value?: string): string | undefined {
  const id = value?.trim();

  if (!id) {
    return undefined;
  }

  return id.startsWith("amap-") ? id.slice("amap-".length) : id;
}

function getAmapPoiIdFromPlace(
  place: Pick<TripPlace, "externalRefs" | "providerPlaceId">,
): string | undefined {
  return (
    normalizeAmapPoiId(place.externalRefs?.amapPoiId) ??
    normalizeAmapPoiId(place.providerPlaceId)
  );
}

function getAmapAoiItems(
  data: AmapAoiBoundaryResponse,
): Record<string, unknown>[] {
  const directAois = data.aois;

  if (Array.isArray(directAois)) {
    return directAois.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    );
  }

  if (typeof directAois === "object" && directAois !== null) {
    return [directAois as Record<string, unknown>];
  }

  const dataSource =
    typeof data.data === "object" && data.data !== null
      ? (data.data as Record<string, unknown>)
      : undefined;
  const nestedAois = dataSource?.aois;

  if (Array.isArray(nestedAois)) {
    return nestedAois.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    );
  }

  if (typeof nestedAois === "object" && nestedAois !== null) {
    return [nestedAois as Record<string, unknown>];
  }

  return [];
}

function isAmapAoiSuccess(data: AmapAoiBoundaryResponse): boolean {
  return (
    data.status === 0 ||
    data.status === "0" ||
    data.info?.toLocaleLowerCase() === "ok"
  );
}

function scoreAmapSuggestionForPlace(
  suggestion: PlaceSuggestion,
  place: Pick<TripPlace, "latitude" | "longitude" | "name">,
): number {
  let score = suggestion.name === place.name ? 0 : 1000;

  if (
    typeof place.latitude === "number" &&
    typeof place.longitude === "number" &&
    typeof suggestion.latitude === "number" &&
    typeof suggestion.longitude === "number"
  ) {
    score +=
      Math.abs(suggestion.latitude - place.latitude) +
      Math.abs(suggestion.longitude - place.longitude);
  }

  return score;
}

async function findAmapPoiIdForPlace(
  place: Pick<TripPlace, "category" | "latitude" | "longitude" | "name">,
  signal?: AbortSignal,
): Promise<string | undefined> {
  if (!place.name.trim()) {
    return undefined;
  }

  const nearbyCenter =
    typeof place.latitude === "number" && typeof place.longitude === "number"
      ? {
          latitude: place.latitude,
          longitude: place.longitude,
        }
      : undefined;
  const suggestions = await searchAmapPlaceSuggestions(
    place.name,
    place.category,
    { nearbyCenter, signal },
  );
  const suggestion = suggestions
    .filter((item) => item.provider === "amap")
    .sort(
      (left, right) =>
        scoreAmapSuggestionForPlace(left, place) -
        scoreAmapSuggestionForPlace(right, place),
    )[0];

  return (
    normalizeAmapPoiId(suggestion?.externalRefs?.amapPoiId) ??
    normalizeAmapPoiId(suggestion?.providerPlaceId)
  );
}

export async function queryAmapAoiBoundary(
  poiId: string,
  signal?: AbortSignal,
): Promise<AmapAoiBoundaryResult | undefined> {
  const normalizedPoiId = normalizeAmapPoiId(poiId);

  if (!normalizedPoiId) {
    return undefined;
  }

  const data = await fetchAmapJson<AmapAoiBoundaryResponse>(
    "/v5/aoi/polyline",
    { id: normalizedPoiId },
    { signal },
  );
  const aoiItems = getAmapAoiItems(data);
  const aoi = aoiItems
    .map((item) => ({
      id: getStringValue(item, "id") ?? normalizedPoiId,
      name: getFirstStringValue(item, "name"),
      paths: parseAmapAoiPolyline(getStringValue(item, "polyline")),
    }))
    .find((item) => item.paths.length > 0);

  if (aoi) {
    return aoi;
  }

  if (!isAmapAoiSuccess(data)) {
    throwAmapResponseError(data, "Amap AOI boundary query failed");
  }

  return undefined;
}

const amapBoundaryCache = new Map<
  string,
  Promise<AmapAoiBoundaryResult | undefined>
>();

function getAmapBoundaryCacheKey(
  place: Pick<
    TripPlace,
    | "category"
    | "externalRefs"
    | "latitude"
    | "longitude"
    | "name"
    | "providerPlaceId"
  >,
): string {
  return (
    getAmapPoiIdFromPlace(place) ??
    `search:${place.name.trim()}:${place.category}:${place.latitude ?? ""},${place.longitude ?? ""}`
  );
}

export async function queryAmapPlaceBoundary(
  place: Pick<
    TripPlace,
    | "category"
    | "externalRefs"
    | "latitude"
    | "longitude"
    | "name"
    | "providerPlaceId"
  >,
  signal?: AbortSignal,
): Promise<AmapAoiBoundaryResult | undefined> {
  if (!isAmapWebServiceConfigured()) {
    return undefined;
  }

  const cacheKey = getAmapBoundaryCacheKey(place);
  const cachedResult = amapBoundaryCache.get(cacheKey);

  if (cachedResult) {
    return cachedResult;
  }

  const boundaryPromise = (async () => {
    const poiId =
      getAmapPoiIdFromPlace(place) ??
      (await findAmapPoiIdForPlace(place, signal));

    if (!poiId) {
      return undefined;
    }

    return queryAmapAoiBoundary(poiId, signal);
  })().catch((error) => {
    amapBoundaryCache.delete(cacheKey);
    throw error;
  });

  amapBoundaryCache.set(cacheKey, boundaryPromise);
  return boundaryPromise;
}

function getRoutePolyline(
  path: Record<string, unknown>,
): AmapCoordinate[] | undefined {
  const steps = path.steps;

  if (!Array.isArray(steps)) {
    return undefined;
  }

  const coordinates = steps
    .filter(
      (step): step is Record<string, unknown> =>
        typeof step === "object" && step !== null,
    )
    .flatMap((step) => parseAmapPolyline(getStringValue(step, "polyline")));

  if (coordinates.length < 2) {
    return undefined;
  }

  const dedupedCoordinates: AmapCoordinate[] = [];

  coordinates.forEach((coordinate) => {
    const previous = dedupedCoordinates[dedupedCoordinates.length - 1];

    if (
      !previous ||
      previous.latitude !== coordinate.latitude ||
      previous.longitude !== coordinate.longitude
    ) {
      dedupedCoordinates.push(coordinate);
    }
  });

  return dedupedCoordinates.length >= 2 ? dedupedCoordinates : undefined;
}

function getTransitSegmentPolyline(
  segment: Record<string, unknown>,
): AmapCoordinate[] {
  const walking = getObjectValue(segment, "walking");
  const walkingSteps = getArrayObjects(walking?.steps);
  const bus = getObjectValue(segment, "bus");
  const busLines = getArrayObjects(bus?.buslines);

  return [...walkingSteps, ...busLines].flatMap((item) =>
    parseAmapPolyline(getStringValue(item, "polyline")),
  );
}

function getTransitSegmentDistanceMeters(
  segment: Record<string, unknown>,
): number | undefined {
  const walking = getObjectValue(segment, "walking");
  const bus = getObjectValue(segment, "bus");
  const busLines = getArrayObjects(bus?.buslines);

  return sumFiniteNumbers([
    getRouteDistanceMeters(segment),
    walking ? getRouteDistanceMeters(walking) : undefined,
    ...busLines.map(getRouteDistanceMeters),
  ]);
}

function getTransitSegmentDurationSeconds(
  segment: Record<string, unknown>,
): number | undefined {
  const walking = getObjectValue(segment, "walking");
  const bus = getObjectValue(segment, "bus");
  const busLines = getArrayObjects(bus?.buslines);

  return sumFiniteNumbers([
    getRouteDurationSeconds(segment),
    walking ? getRouteDurationSeconds(walking) : undefined,
    ...busLines.map(getRouteDurationSeconds),
  ]);
}

function getTransitPolyline(
  transit: Record<string, unknown>,
): AmapCoordinate[] | undefined {
  const segments = getArrayObjects(transit.segments);
  const coordinates = segments.flatMap(getTransitSegmentPolyline);

  if (coordinates.length < 2) {
    return undefined;
  }

  const dedupedCoordinates: AmapCoordinate[] = [];

  coordinates.forEach((coordinate) => {
    const previous = dedupedCoordinates[dedupedCoordinates.length - 1];

    if (
      !previous ||
      previous.latitude !== coordinate.latitude ||
      previous.longitude !== coordinate.longitude
    ) {
      dedupedCoordinates.push(coordinate);
    }
  });

  return dedupedCoordinates.length >= 2 ? dedupedCoordinates : undefined;
}

function mapRoutePathResult(
  path: Record<string, unknown>,
): AmapRouteResult | undefined {
  const distanceMeters = getRouteDistanceMeters(path);
  const durationSeconds = getRouteDurationSeconds(path);

  if (
    typeof distanceMeters !== "number" ||
    typeof durationSeconds !== "number" ||
    !Number.isFinite(distanceMeters) ||
    !Number.isFinite(durationSeconds)
  ) {
    return undefined;
  }

  return {
    distanceKm: roundDistanceKm(distanceMeters),
    durationMinutes: roundDurationMinutes(durationSeconds),
    polyline: getRoutePolyline(path),
  };
}

function mapTransitRouteResult(
  transit: Record<string, unknown>,
): AmapRouteResult | undefined {
  const segments = getArrayObjects(transit.segments);
  const distanceMeters =
    getRouteDistanceMeters(transit) ??
    sumFiniteNumbers(segments.map(getTransitSegmentDistanceMeters));
  const durationSeconds =
    getRouteDurationSeconds(transit) ??
    sumFiniteNumbers(segments.map(getTransitSegmentDurationSeconds));

  if (
    typeof distanceMeters !== "number" ||
    typeof durationSeconds !== "number" ||
    !Number.isFinite(distanceMeters) ||
    !Number.isFinite(durationSeconds)
  ) {
    return undefined;
  }

  return {
    distanceKm: roundDistanceKm(distanceMeters),
    durationMinutes: roundDurationMinutes(durationSeconds),
    polyline: getTransitPolyline(transit),
  };
}

function normalizeAmapRouteCity(value?: string): string | undefined {
  const city = value?.trim();
  return city || undefined;
}

export async function queryAmapRoute(
  mode: AmapRouteMode,
  fromCoordinates: AmapCoordinate,
  toCoordinates: AmapCoordinate,
  options: AmapRouteQueryOptions = {},
): Promise<AmapRouteResult | undefined> {
  const endpoint = routeEndpointMap[mode];
  const data = await fetchAmapJson<AmapRouteResponse>(endpoint.path, {
    origin: formatAmapCoordinate(fromCoordinates),
    destination: formatAmapCoordinate(toCoordinates),
    city:
      mode === "transit"
        ? normalizeAmapRouteCity(options.originCity)
        : undefined,
    cityd:
      mode === "transit" &&
      options.destinationCity &&
      options.destinationCity !== options.originCity
        ? normalizeAmapRouteCity(options.destinationCity)
        : undefined,
    extensions: endpoint.version === "v3" ? "all" : undefined,
  });
  const isV4Success = endpoint.version === "v4" && data.errcode === 0;

  if (!isV4Success && !isAmapSuccess(data)) {
    throwAmapResponseError(data, "高德路线查询失败");
  }

  if (mode === "transit") {
    return getRouteTransits(data)
      .map(mapTransitRouteResult)
      .filter(isAmapRouteResult)
      .sort((left, right) => {
        const durationDiff = left.durationMinutes - right.durationMinutes;
        return durationDiff || left.distanceKm - right.distanceKm;
      })[0];
  }

  const route = getRoutePaths(data)[0];
  return route ? mapRoutePathResult(route) : undefined;
}

export function buildAmapStaticMapUrl(input: {
  autoFit?: boolean;
  center?: AmapCoordinate;
  markers?: AmapCoordinate[];
  markerLabels?: string[];
  path?: AmapCoordinate[];
  size?: string;
  zoom?: number;
}): string | undefined {
  void input;

  // Supabase Functions keep JWT verification enabled. Plain image URLs cannot attach
  // the required Authorization header, so do not create a client-visible static map URL.
  return undefined;
}

export function buildAmapViewportStaticMapUrl(input: {
  center: AmapCoordinate;
  markers?: AmapCoordinate[];
  markerLabels?: string[];
  path?: AmapCoordinate[];
  size?: string;
  zoom: number;
}): string | undefined {
  return buildAmapStaticMapUrl({
    center: input.center,
    markers: input.markers,
    markerLabels: input.markerLabels,
    path: input.path,
    size: input.size,
    zoom: input.zoom,
  });
}

export function buildAmapPlaceStaticMapUrl(
  place: Pick<TripPlace, "latitude" | "longitude">,
): string | undefined {
  if (!isValidCoordinate(place)) {
    return undefined;
  }

  const coordinate = {
    latitude: place.latitude,
    longitude: place.longitude,
  };

  return buildAmapStaticMapUrl({
    center: coordinate,
    markers: [coordinate],
    zoom: AMAP_DEFAULT_ZOOM,
  });
}

export function buildAmapRouteStaticMapUrl(
  coordinates: AmapCoordinate[],
): string | undefined {
  const validCoordinates = coordinates.filter(isValidCoordinate);

  if (validCoordinates.length === 0) {
    return undefined;
  }

  return buildAmapStaticMapUrl({
    autoFit: true,
    markers: validCoordinates,
    markerLabels: validCoordinates.map((_, index) => `${index + 1}`),
    path: validCoordinates,
  });
}

export function buildAmapDayRouteStaticMapUrl(input: {
  markers: AmapCoordinate[];
  markerLabels?: string[];
  path?: AmapCoordinate[];
  size?: string;
}): string | undefined {
  const validMarkers = input.markers.filter(isValidCoordinate);
  const validPath = input.path?.filter(isValidCoordinate) ?? [];
  const fitCoordinates = validPath.length >= 2 ? validPath : validMarkers;

  if (fitCoordinates.length === 0) {
    return undefined;
  }

  return buildAmapStaticMapUrl({
    autoFit: true,
    markers: validMarkers,
    markerLabels: input.markerLabels,
    path: validPath,
    size: input.size,
  });
}

export function buildAmapPlaceUrl(
  place: Pick<
    TripPlace,
    "address" | "area" | "latitude" | "longitude" | "name"
  >,
): string {
  const keyword = [place.name, place.address, place.area]
    .filter(Boolean)
    .join(" ");

  if (isValidCoordinate(place)) {
    const params = new URLSearchParams({
      position: formatAmapCoordinate({
        latitude: place.latitude,
        longitude: place.longitude,
      }),
      name: place.name || keyword || "目的地",
      src: AMAP_SOURCE_NAME,
      coordinate: "gaode",
      callnative: "1",
    });

    return `${AMAP_URI_BASE_URL}/marker?${params.toString()}`;
  }

  const params = new URLSearchParams({
    keyword: keyword || place.name || "目的地",
    src: AMAP_SOURCE_NAME,
    callnative: "1",
  });

  return `${AMAP_URI_BASE_URL}/search?${params.toString()}`;
}

export function buildAmapDirectionsUrl(
  routeEntry: {
    fromCoordinates?: AmapCoordinate;
    fromLabel: string;
    toCoordinates?: AmapCoordinate;
    toLabel: string;
  },
  mode: AmapRouteMode,
): string | undefined {
  if (!routeEntry.fromCoordinates || !routeEntry.toCoordinates) {
    return undefined;
  }

  const modeMap: Record<AmapRouteMode, string> = {
    driving: "car",
    cycling: "ride",
    transit: "bus",
    walking: "walk",
  };
  const params = new URLSearchParams({
    from: `${formatAmapCoordinate(routeEntry.fromCoordinates)},${routeEntry.fromLabel}`,
    to: `${formatAmapCoordinate(routeEntry.toCoordinates)},${routeEntry.toLabel}`,
    mode: modeMap[mode],
    policy: "1",
    src: AMAP_SOURCE_NAME,
    coordinate: "gaode",
    callnative: "1",
  });

  return `${AMAP_URI_BASE_URL}/navigation?${params.toString()}`;
}

function isValidCoordinate(value?: {
  latitude?: number;
  longitude?: number;
}): value is AmapCoordinate {
  return (
    typeof value?.latitude === "number" &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    Math.abs(value.latitude) <= 90 &&
    Math.abs(value.longitude) <= 180
  );
}

function roundDistanceKm(distanceMeters: number): number {
  if (distanceMeters >= 100000) {
    return Number((distanceMeters / 1000).toFixed(0));
  }

  if (distanceMeters >= 10000) {
    return Number((distanceMeters / 1000).toFixed(1));
  }

  return Number((distanceMeters / 1000).toFixed(2));
}

function roundDurationMinutes(durationSeconds: number): number {
  return Math.max(1, Math.round(durationSeconds / 60));
}
