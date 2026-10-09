import {
  type AmapCoordinate,
  type AmapRouteMode,
  buildAmapDirectionsUrl,
  buildAmapPlaceUrl,
} from "./amap";
import type { TripRouteSegmentCacheEntry } from "./route-segments";
import type { TripPlace } from "./types";

export type MapNavigationPlatform = "android" | "ios" | "web" | string;

export type MapUrlProvider = "amap" | "apple" | "baidu" | "system" | "web-amap";

export type MapUrlCandidate = {
  isNativeApp: boolean;
  label: string;
  probeUrl?: string;
  provider: MapUrlProvider;
  url: string;
};

const DEFAULT_NAVIGATION_PROVIDER_PRIORITY: Record<string, MapUrlProvider[]> = {
  android: ["amap", "baidu", "system"],
  ios: ["apple", "amap", "baidu"],
  web: ["web-amap"],
};

export type MapRouteInput = {
  fromCoordinates?: AmapCoordinate;
  fromLabel: string;
  fromQuery?: string;
  toCoordinates?: AmapCoordinate;
  toLabel: string;
  toQuery?: string;
};

const MAP_SOURCE_NAME = "waylog";
const BAIDU_ANDROID_SOURCE_NAME = "andr.waylog";
const BAIDU_IOS_SOURCE_NAME = "ios.waylog";

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

function getPlaceCoordinate(
  place: Pick<TripPlace, "latitude" | "longitude">,
): AmapCoordinate | undefined {
  if (!isValidCoordinate(place)) {
    return undefined;
  }

  return {
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

function formatCoordinatePart(value: number): string {
  return Number(value.toFixed(6)).toString();
}

function formatLatLon(coordinate: AmapCoordinate): string {
  return `${formatCoordinatePart(coordinate.latitude)},${formatCoordinatePart(coordinate.longitude)}`;
}

function getPlaceLabel(
  place: Pick<TripPlace, "address" | "area" | "name">,
): string {
  return place.name || place.address || place.area || "目的地";
}

function getPlaceSearchText(
  place: Pick<TripPlace, "address" | "area" | "name">,
): string {
  return (
    [place.name, place.address, place.area].filter(Boolean).join(" ") ||
    getPlaceLabel(place)
  );
}

function getRouteLabel(label: string, fallback: string): string {
  return label.trim() || fallback;
}

function getRouteEndpointSearchText(
  label: string,
  query: string | undefined,
  coordinate: AmapCoordinate | undefined,
): string {
  if (coordinate) {
    return formatLatLon(coordinate);
  }

  return query?.trim() || label.trim();
}

function createUrl(
  baseUrl: string,
  params: Record<string, string | undefined>,
): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `${baseUrl}?${query}` : baseUrl;
}

function getAmapScheme(
  platform: MapNavigationPlatform,
): "androidamap" | "iosamap" | undefined {
  if (platform === "android") {
    return "androidamap";
  }

  if (platform === "ios") {
    return "iosamap";
  }

  return undefined;
}

function getAmapProbeUrl(platform: MapNavigationPlatform): string | undefined {
  const scheme = getAmapScheme(platform);
  return scheme ? `${scheme}://` : undefined;
}

function getBaiduSourceName(platform: MapNavigationPlatform): string {
  return platform === "ios" ? BAIDU_IOS_SOURCE_NAME : BAIDU_ANDROID_SOURCE_NAME;
}

function getAppleMapsProbeUrl(
  platform: MapNavigationPlatform,
): string | undefined {
  return platform === "ios" ? "http://maps.apple.com/" : undefined;
}

function getBaiduProbeUrl(platform: MapNavigationPlatform): string | undefined {
  return platform === "android" || platform === "ios"
    ? "baidumap://"
    : undefined;
}

function getAndroidSystemMapProbeUrl(
  platform: MapNavigationPlatform,
): string | undefined {
  return platform === "android" ? "geo:0,0?q=0,0" : undefined;
}

function getAmapNavigationUrl(
  place: Pick<
    TripPlace,
    "address" | "area" | "externalRefs" | "latitude" | "longitude" | "name"
  >,
  platform: MapNavigationPlatform,
): string | undefined {
  const scheme = getAmapScheme(platform);

  if (!scheme) {
    return undefined;
  }

  const coordinate = getPlaceCoordinate(place);

  if (!coordinate) {
    if (platform !== "android") {
      return undefined;
    }

    return createUrl("androidamap://keywordNavi", {
      sourceApplication: MAP_SOURCE_NAME,
      keyword: getPlaceSearchText(place),
      style: "0",
    });
  }

  return createUrl(`${scheme}://navi`, {
    sourceApplication: MAP_SOURCE_NAME,
    poiname: getPlaceLabel(place),
    poiid: place.externalRefs?.amapPoiId,
    lat: formatCoordinatePart(coordinate.latitude),
    lon: formatCoordinatePart(coordinate.longitude),
    dev: "0",
    style: "0",
  });
}

function getAmapRouteAppUrl(
  route: MapRouteInput,
  mode: AmapRouteMode,
  platform: MapNavigationPlatform,
): string | undefined {
  const scheme = getAmapScheme(platform);

  if (!scheme || !route.fromCoordinates || !route.toCoordinates) {
    return undefined;
  }

  const typeMap: Record<AmapRouteMode, string> = {
    cycling: "3",
    driving: "0",
    transit: "1",
    walking: "2",
  };

  return createUrl(`${scheme}://${platform === "ios" ? "path" : "route"}`, {
    sourceApplication: MAP_SOURCE_NAME,
    slat: formatCoordinatePart(route.fromCoordinates.latitude),
    slon: formatCoordinatePart(route.fromCoordinates.longitude),
    sname: getRouteLabel(route.fromLabel, "起点"),
    dlat: formatCoordinatePart(route.toCoordinates.latitude),
    dlon: formatCoordinatePart(route.toCoordinates.longitude),
    dname: getRouteLabel(route.toLabel, "终点"),
    dev: "0",
    t: typeMap[mode],
  });
}

function getAmapPlaceAppUrl(
  place: Pick<
    TripPlace,
    "address" | "area" | "latitude" | "longitude" | "name"
  >,
  platform: MapNavigationPlatform,
): string | undefined {
  const scheme = getAmapScheme(platform);
  const coordinate = getPlaceCoordinate(place);

  if (!scheme || !coordinate) {
    return undefined;
  }

  return createUrl(`${scheme}://viewMap`, {
    sourceApplication: MAP_SOURCE_NAME,
    poiname: getPlaceLabel(place),
    lat: formatCoordinatePart(coordinate.latitude),
    lon: formatCoordinatePart(coordinate.longitude),
    dev: "0",
  });
}

function getAppleMapsNavigationUrl(
  place: Pick<
    TripPlace,
    "address" | "area" | "latitude" | "longitude" | "name"
  >,
  mode: AmapRouteMode,
): string {
  const coordinate = getPlaceCoordinate(place);
  const destination = coordinate
    ? formatLatLon(coordinate)
    : getPlaceSearchText(place);
  const dirflg = mode === "walking" ? "w" : mode === "transit" ? "r" : "d";

  return createUrl("http://maps.apple.com/", {
    daddr: destination,
    dirflg,
  });
}

function getAppleMapsRouteUrl(
  route: MapRouteInput,
  mode: AmapRouteMode,
): string {
  const dirflg = mode === "walking" ? "w" : mode === "transit" ? "r" : "d";

  return createUrl("http://maps.apple.com/", {
    saddr: getRouteEndpointSearchText(
      route.fromLabel,
      route.fromQuery,
      route.fromCoordinates,
    ),
    daddr: getRouteEndpointSearchText(
      route.toLabel,
      route.toQuery,
      route.toCoordinates,
    ),
    dirflg,
  });
}

function getAppleMapsPlaceUrl(
  place: Pick<
    TripPlace,
    "address" | "area" | "latitude" | "longitude" | "name"
  >,
): string {
  const coordinate = getPlaceCoordinate(place);

  if (!coordinate) {
    return createUrl("http://maps.apple.com/", {
      q: getPlaceSearchText(place),
    });
  }

  return createUrl("http://maps.apple.com/", {
    ll: formatLatLon(coordinate),
    q: getPlaceLabel(place),
  });
}

function getBaiduMode(mode: AmapRouteMode): string {
  const modeMap: Record<AmapRouteMode, string> = {
    cycling: "riding",
    driving: "driving",
    transit: "transit",
    walking: "walking",
  };

  return modeMap[mode];
}

function getBaiduDestination(
  place: Pick<
    TripPlace,
    "address" | "area" | "latitude" | "longitude" | "name"
  >,
): string {
  const coordinate = getPlaceCoordinate(place);

  if (!coordinate) {
    return getPlaceSearchText(place);
  }

  return `latlng:${formatLatLon(coordinate)}|name:${getPlaceLabel(place)}`;
}

function getBaiduRouteEndpoint(
  label: string,
  query: string | undefined,
  coordinate: AmapCoordinate | undefined,
): string {
  if (!coordinate) {
    return query?.trim() || label.trim();
  }

  return `latlng:${formatLatLon(coordinate)}|name:${getRouteLabel(label, "地点")}`;
}

function getBaiduNavigationUrl(
  place: Pick<
    TripPlace,
    "address" | "area" | "latitude" | "longitude" | "name"
  >,
  mode: AmapRouteMode,
  platform: MapNavigationPlatform,
): string {
  return createUrl("baidumap://map/direction", {
    origin: "我的位置",
    destination: getBaiduDestination(place),
    coord_type: "gcj02",
    mode: getBaiduMode(mode),
    src: getBaiduSourceName(platform),
  });
}

function getBaiduRouteUrl(
  route: MapRouteInput,
  mode: AmapRouteMode,
  platform: MapNavigationPlatform,
): string {
  return createUrl("baidumap://map/direction", {
    origin: getBaiduRouteEndpoint(
      route.fromLabel,
      route.fromQuery,
      route.fromCoordinates,
    ),
    destination: getBaiduRouteEndpoint(
      route.toLabel,
      route.toQuery,
      route.toCoordinates,
    ),
    coord_type: "gcj02",
    mode: getBaiduMode(mode),
    src: getBaiduSourceName(platform),
  });
}

function getBaiduPlaceUrl(
  place: Pick<
    TripPlace,
    "address" | "area" | "latitude" | "longitude" | "name"
  >,
  platform: MapNavigationPlatform,
): string {
  const coordinate = getPlaceCoordinate(place);

  if (!coordinate) {
    return createUrl("baidumap://map/place/search", {
      query: getPlaceSearchText(place),
      src: getBaiduSourceName(platform),
    });
  }

  return createUrl("baidumap://map/marker", {
    location: formatLatLon(coordinate),
    title: getPlaceLabel(place),
    content: getPlaceSearchText(place),
    coord_type: "gcj02",
    src: getBaiduSourceName(platform),
  });
}

function getAndroidSystemNavigationUrl(
  place: Pick<
    TripPlace,
    "address" | "area" | "latitude" | "longitude" | "name"
  >,
): string {
  const coordinate = getPlaceCoordinate(place);
  const query = coordinate
    ? `${formatLatLon(coordinate)}(${getPlaceLabel(place)})`
    : getPlaceSearchText(place);
  const center = coordinate ? formatLatLon(coordinate) : "0,0";

  return `geo:${center}?q=${encodeURIComponent(query)}`;
}

function getAndroidSystemRouteUrl(route: MapRouteInput): string {
  const destination = route.toCoordinates
    ? `${formatLatLon(route.toCoordinates)}(${getRouteLabel(route.toLabel, "终点")})`
    : getRouteEndpointSearchText(
        route.toLabel,
        route.toQuery,
        route.toCoordinates,
      );
  const center = route.toCoordinates
    ? formatLatLon(route.toCoordinates)
    : "0,0";

  return `geo:${center}?q=${encodeURIComponent(destination)}`;
}

async function canOpenMapUrl(
  url: string,
  canOpenUrl: (url: string) => Promise<boolean>,
): Promise<boolean> {
  try {
    return await canOpenUrl(url);
  } catch {
    return false;
  }
}

export async function getAvailableMapUrlCandidates(
  candidates: MapUrlCandidate[],
  canOpenUrl: (url: string) => Promise<boolean>,
): Promise<MapUrlCandidate[]> {
  const availableCandidates: MapUrlCandidate[] = [];

  for (const candidate of candidates) {
    if (!candidate.isNativeApp) {
      continue;
    }

    const probeUrl = candidate.probeUrl ?? candidate.url;
    const probeUrls = Array.from(new Set([probeUrl, candidate.url]));

    for (const url of probeUrls) {
      if (await canOpenMapUrl(url, canOpenUrl)) {
        availableCandidates.push(candidate);
        break;
      }
    }
  }

  return availableCandidates;
}

export function prioritizeDefaultNavigationCandidates(
  candidates: MapUrlCandidate[],
  platform: MapNavigationPlatform,
): MapUrlCandidate[] {
  const priority = DEFAULT_NAVIGATION_PROVIDER_PRIORITY[platform];

  if (!priority || candidates.length <= 1) {
    return candidates;
  }

  const priorityIndex = new Map<MapUrlProvider, number>(
    priority.map((provider, index) => [provider, index]),
  );

  return [...candidates].sort((left, right) => {
    const leftIndex =
      priorityIndex.get(left.provider) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex =
      priorityIndex.get(right.provider) ?? Number.MAX_SAFE_INTEGER;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return candidates.indexOf(left) - candidates.indexOf(right);
  });
}

export function buildNativeMapNavigationUrls(
  place: Pick<
    TripPlace,
    "address" | "area" | "externalRefs" | "latitude" | "longitude" | "name"
  >,
  mode: AmapRouteMode,
  platform: MapNavigationPlatform,
): MapUrlCandidate[] {
  if (platform === "web") {
    const routeEntry: TripRouteSegmentCacheEntry = {
      fromLabel: "当前位置",
      fromQuery: "当前位置",
      fromSignature: "current-location",
      modeOptions: [],
      provider: "amap",
      status: "ready",
      toCoordinates: getPlaceCoordinate(place),
      toLabel: getPlaceLabel(place),
      toQuery: getPlaceSearchText(place),
      toSignature: getPlaceSearchText(place),
      updatedAt: new Date(0).toISOString(),
    };
    const webRouteUrl =
      buildAmapDirectionsUrl(routeEntry, mode) ?? buildAmapPlaceUrl(place);

    return [
      {
        isNativeApp: false,
        label: "高德网页地图",
        provider: "web-amap",
        url: webRouteUrl,
      },
    ];
  }

  const candidates: MapUrlCandidate[] = [];
  const amapUrl = getAmapNavigationUrl(place, platform);

  if (amapUrl) {
    candidates.push({
      isNativeApp: true,
      label: "高德地图",
      probeUrl: getAmapProbeUrl(platform),
      provider: "amap",
      url: amapUrl,
    });
  }

  if (platform === "ios") {
    candidates.push({
      isNativeApp: true,
      label: "苹果地图",
      probeUrl: getAppleMapsProbeUrl(platform),
      provider: "apple",
      url: getAppleMapsNavigationUrl(place, mode),
    });
  }

  candidates.push({
    isNativeApp: true,
    label: "百度地图",
    probeUrl: getBaiduProbeUrl(platform),
    provider: "baidu",
    url: getBaiduNavigationUrl(place, mode, platform),
  });

  if (platform === "android") {
    candidates.push({
      isNativeApp: true,
      label: "系统地图",
      probeUrl: getAndroidSystemMapProbeUrl(platform),
      provider: "system",
      url: getAndroidSystemNavigationUrl(place),
    });
  }

  candidates.push({
    isNativeApp: false,
    label: "高德网页地图",
    provider: "web-amap",
    url: buildAmapPlaceUrl(place),
  });

  return candidates;
}

export function buildNativeMapRouteUrls(
  route: MapRouteInput,
  mode: AmapRouteMode,
  platform: MapNavigationPlatform,
): MapUrlCandidate[] {
  if (platform === "web") {
    const routeEntry: TripRouteSegmentCacheEntry = {
      fromLabel: getRouteLabel(route.fromLabel, "起点"),
      fromQuery: route.fromQuery ?? route.fromLabel,
      fromSignature: "route-from",
      fromCoordinates: route.fromCoordinates,
      modeOptions: [],
      provider: "amap",
      status: "ready",
      toCoordinates: route.toCoordinates,
      toLabel: getRouteLabel(route.toLabel, "终点"),
      toQuery: route.toQuery ?? route.toLabel,
      toSignature: "route-to",
      updatedAt: new Date(0).toISOString(),
    };
    const webRouteUrl = buildAmapDirectionsUrl(routeEntry, mode);

    return webRouteUrl
      ? [
          {
            isNativeApp: false,
            label: "高德网页地图",
            provider: "web-amap",
            url: webRouteUrl,
          },
        ]
      : [];
  }

  const candidates: MapUrlCandidate[] = [];
  const amapUrl = getAmapRouteAppUrl(route, mode, platform);

  if (amapUrl) {
    candidates.push({
      isNativeApp: true,
      label: "高德地图",
      probeUrl: getAmapProbeUrl(platform),
      provider: "amap",
      url: amapUrl,
    });
  }

  if (platform === "ios") {
    candidates.push({
      isNativeApp: true,
      label: "苹果地图",
      probeUrl: getAppleMapsProbeUrl(platform),
      provider: "apple",
      url: getAppleMapsRouteUrl(route, mode),
    });
  }

  candidates.push({
    isNativeApp: true,
    label: "百度地图",
    probeUrl: getBaiduProbeUrl(platform),
    provider: "baidu",
    url: getBaiduRouteUrl(route, mode, platform),
  });

  if (platform === "android") {
    candidates.push({
      isNativeApp: true,
      label: "系统地图",
      probeUrl: getAndroidSystemMapProbeUrl(platform),
      provider: "system",
      url: getAndroidSystemRouteUrl(route),
    });
  }

  const webRouteUrl = buildAmapDirectionsUrl(
    {
      fromCoordinates: route.fromCoordinates,
      fromLabel: route.fromLabel,
      toCoordinates: route.toCoordinates,
      toLabel: route.toLabel,
    },
    mode,
  );

  if (webRouteUrl) {
    candidates.push({
      isNativeApp: false,
      label: "高德网页地图",
      provider: "web-amap",
      url: webRouteUrl,
    });
  }

  return candidates;
}

export function buildNativeMapPlaceUrls(
  place: Pick<
    TripPlace,
    "address" | "area" | "latitude" | "longitude" | "name"
  >,
  platform: MapNavigationPlatform,
): MapUrlCandidate[] {
  if (platform === "web") {
    return [
      {
        isNativeApp: false,
        label: "高德网页地图",
        provider: "web-amap",
        url: buildAmapPlaceUrl(place),
      },
    ];
  }

  const candidates: MapUrlCandidate[] = [];
  const amapUrl = getAmapPlaceAppUrl(place, platform);

  if (amapUrl) {
    candidates.push({
      isNativeApp: true,
      label: "高德地图",
      probeUrl: getAmapProbeUrl(platform),
      provider: "amap",
      url: amapUrl,
    });
  }

  if (platform === "ios") {
    candidates.push({
      isNativeApp: true,
      label: "苹果地图",
      probeUrl: getAppleMapsProbeUrl(platform),
      provider: "apple",
      url: getAppleMapsPlaceUrl(place),
    });
  }

  candidates.push({
    isNativeApp: true,
    label: "百度地图",
    probeUrl: getBaiduProbeUrl(platform),
    provider: "baidu",
    url: getBaiduPlaceUrl(place, platform),
  });

  if (platform === "android") {
    candidates.push({
      isNativeApp: true,
      label: "系统地图",
      probeUrl: getAndroidSystemMapProbeUrl(platform),
      provider: "system",
      url: getAndroidSystemNavigationUrl(place),
    });
  }

  candidates.push({
    isNativeApp: false,
    label: "高德网页地图",
    provider: "web-amap",
    url: buildAmapPlaceUrl(place),
  });

  return candidates;
}
