import type {
  TripDayRouteSegment,
  TripRouteCoordinates,
  TripRouteMode,
  TripRouteModeOption,
  TripRouteSegmentResult,
} from "./route-segments";

export type MapSize = {
  height: number;
  width: number;
};

export type MapPadding = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export type MapViewport = {
  centerWorldX: number;
  centerWorldY: number;
  zoom: number;
};

export type ScreenPoint = {
  x: number;
  y: number;
};

type WorldPoint = {
  x: number;
  y: number;
};

const TILE_SIZE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 18;
const SINGLE_POINT_ZOOM = 15;
const ROUTE_VIEWPORT_FILL_RATIO = 0.8;
const MAX_ROUTE_GEOMETRY_DETOUR_RATIO = 3.5;
const MIN_ROUTE_GEOMETRY_EXCESS_DISTANCE_KM = 1.5;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function latitudeToMercatorY(latitude: number) {
  const limitedLatitude = clamp(latitude, -85.05112878, 85.05112878);
  const radians = (limitedLatitude * Math.PI) / 180;
  const sine = Math.sin(radians);

  return 0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI);
}

function longitudeToMercatorX(longitude: number) {
  return (longitude + 180) / 360;
}

function getHaversineDistanceKm(
  from: TripRouteCoordinates,
  to: TripRouteCoordinates,
) {
  const earthRadiusKm = 6371;
  const deltaLatitude = ((to.latitude - from.latitude) * Math.PI) / 180;
  const deltaLongitude = ((to.longitude - from.longitude) * Math.PI) / 180;
  const fromLatitude = (from.latitude * Math.PI) / 180;
  const toLatitude = (to.latitude * Math.PI) / 180;
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(deltaLongitude / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function hasPolylineGeometry(
  polyline?: TripRouteCoordinates[],
): polyline is TripRouteCoordinates[] {
  return Array.isArray(polyline) && polyline.length >= 2;
}

function getPolylineDistanceKm(polyline: TripRouteCoordinates[]) {
  let totalDistanceKm = 0;

  for (let index = 1; index < polyline.length; index += 1) {
    const previous = polyline[index - 1];
    const current = polyline[index];
    if (!previous || !current) {
      continue;
    }

    totalDistanceKm += getHaversineDistanceKm(previous, current);
  }

  return totalDistanceKm;
}

function isRouteGeometryReasonable(
  segment: TripDayRouteSegment,
  option: TripRouteModeOption,
) {
  if (!hasPolylineGeometry(option.polyline)) {
    return false;
  }

  const fromCoordinates = segment.snapshot.fromCoordinates;
  const toCoordinates = segment.snapshot.toCoordinates;

  if (!fromCoordinates || !toCoordinates) {
    return true;
  }

  const directDistanceKm = getHaversineDistanceKm(
    fromCoordinates,
    toCoordinates,
  );

  if (directDistanceKm <= 0) {
    return true;
  }

  const routeDistanceKm = Math.max(
    option.distanceKm,
    getPolylineDistanceKm(option.polyline),
  );
  const detourRatio = routeDistanceKm / directDistanceKm;
  const excessDistanceKm = routeDistanceKm - directDistanceKm;

  return (
    detourRatio <= MAX_ROUTE_GEOMETRY_DETOUR_RATIO ||
    excessDistanceKm <= MIN_ROUTE_GEOMETRY_EXCESS_DISTANCE_KM
  );
}

export function getWorldPoint(
  coordinate: TripRouteCoordinates,
  zoom: number,
): WorldPoint {
  const scale = TILE_SIZE * 2 ** zoom;

  return {
    x: longitudeToMercatorX(coordinate.longitude) * scale,
    y: latitudeToMercatorY(coordinate.latitude) * scale,
  };
}

export function getCoordinateFromWorldPoint(
  point: { x: number; y: number },
  zoom: number,
): TripRouteCoordinates {
  const scale = TILE_SIZE * 2 ** zoom;
  const mercatorX = point.x / scale;
  const mercatorY = point.y / scale;

  return {
    latitude:
      (Math.atan(Math.sinh(Math.PI * (1 - 2 * mercatorY))) * 180) / Math.PI,
    longitude: mercatorX * 360 - 180,
  };
}

function getBestZoom(
  coordinates: TripRouteCoordinates[],
  size: MapSize,
  padding: MapPadding,
): number {
  const drawableWidth = Math.max(
    1,
    (size.width - padding.left - padding.right) * ROUTE_VIEWPORT_FILL_RATIO,
  );
  const drawableHeight = Math.max(
    1,
    (size.height - padding.top - padding.bottom) * ROUTE_VIEWPORT_FILL_RATIO,
  );

  if (coordinates.length <= 1) {
    return SINGLE_POINT_ZOOM;
  }

  const mercatorXs = coordinates.map((c) => longitudeToMercatorX(c.longitude));
  const mercatorYs = coordinates.map((c) => latitudeToMercatorY(c.latitude));
  const spanX = Math.max(...mercatorXs) - Math.min(...mercatorXs);
  const spanY = Math.max(...mercatorYs) - Math.min(...mercatorYs);

  const effectiveSpanX = Math.max(spanX, 1e-10);
  const effectiveSpanY = Math.max(spanY, 1e-10);

  // worldSpan = span × TILE_SIZE × 2^zoom  →  zoom = log2(drawable × fillRatio / (span × TILE_SIZE))
  const zoomX = Math.log2(drawableWidth / (effectiveSpanX * TILE_SIZE));
  const zoomY = Math.log2(drawableHeight / (effectiveSpanY * TILE_SIZE));
  const exactZoom = Math.min(zoomX, zoomY);

  return clamp(exactZoom, MIN_ZOOM, MAX_ZOOM);
}

export function getFittedViewport(
  coordinates: TripRouteCoordinates[],
  size: MapSize,
  padding: MapPadding,
): MapViewport | undefined {
  if (coordinates.length === 0 || size.width <= 0 || size.height <= 0) {
    return undefined;
  }

  const zoom = getBestZoom(coordinates, size, padding);
  const points = coordinates.map((coordinate) =>
    getWorldPoint(coordinate, zoom),
  );
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const boundsCenterWorldX = (minX + maxX) / 2;
  const boundsCenterWorldY = (minY + maxY) / 2;

  return {
    centerWorldX: boundsCenterWorldX + (padding.right - padding.left) / 2,
    centerWorldY: boundsCenterWorldY + (padding.bottom - padding.top) / 2,
    zoom,
  };
}

export function projectWorldPointToScreen(
  coordinate: TripRouteCoordinates,
  viewport: MapViewport,
  size: MapSize,
): ScreenPoint {
  const point = getWorldPoint(coordinate, viewport.zoom);

  return {
    x: point.x - viewport.centerWorldX + size.width / 2,
    y: point.y - viewport.centerWorldY + size.height / 2,
  };
}

export function buildRoutePreviewPolyline(
  coordinates: TripRouteCoordinates[],
): TripRouteCoordinates[] | undefined {
  return coordinates.length >= 2 ? [...coordinates] : undefined;
}

function getSelectedSegmentModeOptionForSegment(
  segment: TripDayRouteSegment,
  results: Record<string, TripRouteSegmentResult>,
  selectedModes: Record<string, TripRouteMode>,
): TripRouteModeOption | undefined {
  const modeOptions = results[segment.id]?.entry.modeOptions;

  if (!modeOptions || modeOptions.length === 0) {
    return undefined;
  }

  const selectedMode = selectedModes[segment.id];

  if (!selectedMode) {
    return modeOptions.find((option) => hasPolylineGeometry(option.polyline));
  }

  const selectedOption = modeOptions.find(
    (option) =>
      option.mode === selectedMode && hasPolylineGeometry(option.polyline),
  );

  if (selectedOption) {
    return selectedOption;
  }

  return selectedMode === "transit"
    ? modeOptions.find(
        (option) =>
          option.mode === "walking" && hasPolylineGeometry(option.polyline),
      )
    : undefined;
}

function getSelectedSegmentPolylineForSegment(
  segment: TripDayRouteSegment,
  results: Record<string, TripRouteSegmentResult>,
  selectedModes: Record<string, TripRouteMode>,
): TripRouteCoordinates[] | undefined {
  const selectedOption = getSelectedSegmentModeOptionForSegment(
    segment,
    results,
    selectedModes,
  );

  if (!selectedOption || !isRouteGeometryReasonable(segment, selectedOption)) {
    return undefined;
  }

  return selectedOption.polyline;
}

export function hasSelectedSegmentRouteGeometry(
  segment: TripDayRouteSegment | undefined,
  results: Record<string, TripRouteSegmentResult>,
  selectedModes: Record<string, TripRouteMode>,
): boolean {
  if (!segment) {
    return true;
  }

  const selectedOption = getSelectedSegmentModeOptionForSegment(
    segment,
    results,
    selectedModes,
  );
  return Boolean(
    selectedOption && isRouteGeometryReasonable(segment, selectedOption),
  );
}

function buildSegmentFallbackPolyline(
  segment: TripDayRouteSegment,
): TripRouteCoordinates[] | undefined {
  if (!segment.snapshot.fromCoordinates || !segment.snapshot.toCoordinates) {
    return undefined;
  }

  return [segment.snapshot.fromCoordinates, segment.snapshot.toCoordinates];
}

export function buildRoutePreviewPolylines(
  coordinates: TripRouteCoordinates[],
  segments: TripDayRouteSegment[],
  results: Record<string, TripRouteSegmentResult>,
  selectedModes: Record<string, TripRouteMode>,
): TripRouteCoordinates[][] {
  if (segments.length > 0) {
    const segmentPolylines = segments
      .map(
        (segment) =>
          getSelectedSegmentPolylineForSegment(
            segment,
            results,
            selectedModes,
          ) ?? buildSegmentFallbackPolyline(segment),
      )
      .filter((polyline): polyline is TripRouteCoordinates[] =>
        Boolean(polyline && polyline.length >= 2),
      );

    if (segmentPolylines.length > 0) {
      return segmentPolylines;
    }
  }

  const previewPolyline = buildRoutePreviewPolyline(coordinates);

  return previewPolyline ? [previewPolyline] : [];
}

export function flattenRoutePreviewCoordinates(
  polylines: TripRouteCoordinates[][],
): TripRouteCoordinates[] {
  return polylines.flat();
}
