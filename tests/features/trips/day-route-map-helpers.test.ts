import assert from "node:assert/strict";
import test from "node:test";
import type {
  TripDayRouteSegment,
  TripRouteCoordinates,
  TripRouteSegmentResult,
} from "../../../features/trips";
import {
  buildRoutePreviewPolyline,
  buildRoutePreviewPolylines,
  getFittedViewport,
  type MapPadding,
  type MapSize,
  projectWorldPointToScreen,
} from "../../../features/trips/day-route-map-helpers";

const SAMPLE_COORDINATES: TripRouteCoordinates[] = [
  { latitude: 34.7025, longitude: 135.4959 },
  { latitude: 34.6913, longitude: 135.183 },
  { latitude: 34.4346, longitude: 135.2443 },
];

function getRequired<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

const SAMPLE_SEGMENT: TripDayRouteSegment = {
  id: "from-item->to-item",
  fromItem: {
    id: "from-item",
    title: "From",
  },
  toItem: {
    id: "to-item",
    title: "To",
  },
  snapshot: {
    cacheKey: "route-cache-key",
    fromCoordinates: SAMPLE_COORDINATES[0],
    fromLabel: "From",
    fromQuery: "From",
    fromSignature: "from",
    toCoordinates: SAMPLE_COORDINATES[1],
    toLabel: "To",
    toQuery: "To",
    toSignature: "to",
  },
};
const SAMPLE_ROUTE_RESULT: TripRouteSegmentResult = {
  cached: false,
  entry: {
    status: "ready",
    provider: "amap",
    fromSignature: "from",
    toSignature: "to",
    fromLabel: "From",
    toLabel: "To",
    fromQuery: "From",
    toQuery: "To",
    fromCoordinates: SAMPLE_COORDINATES[0],
    toCoordinates: SAMPLE_COORDINATES[1],
    modeOptions: [
      {
        mode: "driving",
        label: "Driving",
        distanceKm: 8,
        durationMinutes: 18,
        source: "amap",
      },
      {
        mode: "transit",
        label: "Transit",
        distanceKm: 9.5,
        durationMinutes: 25,
        source: "estimated",
      },
      {
        mode: "walking",
        label: "Walking",
        distanceKm: 9,
        durationMinutes: 120,
        polyline: SAMPLE_COORDINATES,
        source: "amap",
      },
    ],
    updatedAt: "2026-05-29T00:00:00.000Z",
  },
};
const LOCAL_COORDINATES: TripRouteCoordinates[] = [
  { latitude: 34.2223, longitude: 108.9542 },
  { latitude: 34.2208, longitude: 108.9565 },
  { latitude: 34.2189, longitude: 108.9595 },
];
const LOCAL_SEGMENT: TripDayRouteSegment = {
  id: "local-from->local-to",
  fromItem: {
    id: "local-from",
    title: "Local From",
  },
  toItem: {
    id: "local-to",
    title: "Local To",
  },
  snapshot: {
    cacheKey: "local-route-cache-key",
    fromCoordinates: LOCAL_COORDINATES[0],
    fromLabel: "Local From",
    fromQuery: "Local From",
    fromSignature: "local-from",
    toCoordinates: LOCAL_COORDINATES[2],
    toLabel: "Local To",
    toQuery: "Local To",
    toSignature: "local-to",
  },
};

test("buildRoutePreviewPolyline preserves the day item order for route preview lines", () => {
  const polyline = buildRoutePreviewPolyline(SAMPLE_COORDINATES);

  assert.deepEqual(polyline, SAMPLE_COORDINATES);
});

test("buildRoutePreviewPolyline drops empty and single-point previews", () => {
  assert.equal(buildRoutePreviewPolyline([]), undefined);
  assert.equal(
    buildRoutePreviewPolyline([
      getRequired(SAMPLE_COORDINATES[0], "expected first sample coordinate"),
    ]),
    undefined,
  );
});

test("buildRoutePreviewPolylines does not borrow unrelated mode geometry", () => {
  const polylines = buildRoutePreviewPolylines(
    SAMPLE_COORDINATES,
    [SAMPLE_SEGMENT],
    {
      [SAMPLE_SEGMENT.id]: SAMPLE_ROUTE_RESULT,
    },
    {
      [SAMPLE_SEGMENT.id]: "driving",
    },
  );

  assert.deepEqual(polylines, [[SAMPLE_COORDINATES[0], SAMPLE_COORDINATES[1]]]);
});

test("buildRoutePreviewPolylines allows transit to fall back to walking geometry", () => {
  const routeResult: TripRouteSegmentResult = {
    cached: false,
    entry: {
      status: "ready",
      provider: "amap",
      fromSignature: "local-from",
      toSignature: "local-to",
      fromLabel: "Local From",
      toLabel: "Local To",
      fromQuery: "Local From",
      toQuery: "Local To",
      fromCoordinates: LOCAL_COORDINATES[0],
      toCoordinates: LOCAL_COORDINATES[2],
      modeOptions: [
        {
          mode: "transit",
          label: "Transit",
          distanceKm: 1,
          durationMinutes: 12,
          source: "estimated",
        },
        {
          mode: "walking",
          label: "Walking",
          distanceKm: 0.65,
          durationMinutes: 9,
          polyline: LOCAL_COORDINATES,
          source: "amap",
        },
      ],
      updatedAt: "2026-05-29T00:00:00.000Z",
    },
  };

  const polylines = buildRoutePreviewPolylines(
    LOCAL_COORDINATES,
    [LOCAL_SEGMENT],
    {
      [LOCAL_SEGMENT.id]: routeResult,
    },
    {
      [LOCAL_SEGMENT.id]: "transit",
    },
  );

  assert.deepEqual(polylines, [LOCAL_COORDINATES]);
});

test("buildRoutePreviewPolylines rejects strongly circuitous route geometry", () => {
  const circuitousPolyline: TripRouteCoordinates[] = [
    getRequired(LOCAL_COORDINATES[0], "expected first local coordinate"),
    { latitude: 34.229, longitude: 108.948 },
    { latitude: 34.214, longitude: 108.966 },
    { latitude: 34.226, longitude: 108.951 },
    getRequired(LOCAL_COORDINATES[2], "expected third local coordinate"),
  ];
  const routeResult: TripRouteSegmentResult = {
    cached: false,
    entry: {
      status: "ready",
      provider: "amap",
      fromSignature: "local-from",
      toSignature: "local-to",
      fromLabel: "Local From",
      toLabel: "Local To",
      fromQuery: "Local From",
      toQuery: "Local To",
      fromCoordinates: LOCAL_COORDINATES[0],
      toCoordinates: LOCAL_COORDINATES[2],
      modeOptions: [
        {
          mode: "walking",
          label: "Walking",
          distanceKm: 4,
          durationMinutes: 60,
          polyline: circuitousPolyline,
          source: "amap",
        },
      ],
      updatedAt: "2026-05-29T00:00:00.000Z",
    },
  };

  const polylines = buildRoutePreviewPolylines(
    LOCAL_COORDINATES,
    [LOCAL_SEGMENT],
    {
      [LOCAL_SEGMENT.id]: routeResult,
    },
    {
      [LOCAL_SEGMENT.id]: "walking",
    },
  );

  assert.deepEqual(polylines, [[LOCAL_COORDINATES[0], LOCAL_COORDINATES[2]]]);
});

test("getFittedViewport centers coordinates within the drawable area when bottom inset is present", () => {
  const mapSize: MapSize = { width: 390, height: 640 };
  const padding: MapPadding = { top: 72, right: 36, bottom: 240, left: 36 };
  const viewport = getRequired(
    getFittedViewport(SAMPLE_COORDINATES, mapSize, padding),
    "expected a fitted viewport",
  );

  const projectedPoints = SAMPLE_COORDINATES.map((coordinate) =>
    projectWorldPointToScreen(coordinate, viewport, mapSize),
  );

  const minScreenX = Math.min(...projectedPoints.map((point) => point.x));
  const maxScreenX = Math.max(...projectedPoints.map((point) => point.x));
  const minScreenY = Math.min(...projectedPoints.map((point) => point.y));
  const maxScreenY = Math.max(...projectedPoints.map((point) => point.y));

  assert.ok(minScreenX >= padding.left);
  assert.ok(maxScreenX <= mapSize.width - padding.right);
  assert.ok(minScreenY >= padding.top);
  assert.ok(maxScreenY <= mapSize.height - padding.bottom);

  const drawableCenterX =
    padding.left + (mapSize.width - padding.left - padding.right) / 2;
  const drawableCenterY =
    padding.top + (mapSize.height - padding.top - padding.bottom) / 2;
  const boundsCenterX = (minScreenX + maxScreenX) / 2;
  const boundsCenterY = (minScreenY + maxScreenY) / 2;

  assert.ok(Math.abs(boundsCenterX - drawableCenterX) < 1);
  assert.ok(Math.abs(boundsCenterY - drawableCenterY) < 1);
});
