import {
  getTripRouteModeLabel,
  type TripDayRouteSegment,
  type TripRouteMode,
  type TripRouteModeOption,
  type TripRouteSegmentResult,
} from "../route-segments";

export type RouteModePendingKey = {
  mode: TripRouteMode;
  segmentId: string;
};

export function formatRouteDistance(distanceKm?: number): string {
  if (typeof distanceKm !== "number" || !Number.isFinite(distanceKm)) {
    return "-- km";
  }

  if (distanceKm >= 10) {
    return `${distanceKm.toFixed(distanceKm >= 100 ? 0 : 1)} km`;
  }

  return `${distanceKm.toFixed(2)} km`;
}

export function formatRouteDuration(durationMinutes?: number): string {
  if (
    typeof durationMinutes !== "number" ||
    !Number.isFinite(durationMinutes)
  ) {
    return "-- min";
  }

  if (durationMinutes >= 60) {
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  }

  return `${durationMinutes} min`;
}

export function getRouteSegmentSelectedOption(
  result: TripRouteSegmentResult | undefined,
  selectedMode: TripRouteMode | undefined,
): TripRouteModeOption | undefined {
  const options = result?.entry.modeOptions ?? [];

  if (!selectedMode) {
    return options[0];
  }

  return options.find((option) => option.mode === selectedMode);
}

export function hasRouteModeResult(
  result: TripRouteSegmentResult | undefined,
  mode: TripRouteMode | undefined,
): boolean {
  return Boolean(
    mode && result?.entry.modeOptions.some((option) => option.mode === mode),
  );
}

export function hasRouteModePolyline(option: TripRouteModeOption | undefined) {
  return Array.isArray(option?.polyline) && option.polyline.length >= 2;
}

export function getRouteOptionQualityLabel(
  option: TripRouteModeOption | undefined,
): string {
  if (!option) {
    return "";
  }

  if (option.source === "estimated") {
    return "估算";
  }

  return hasRouteModePolyline(option) ? "精确路线" : "仅时间距离";
}

export function formatRouteOptionMetric(
  option: TripRouteModeOption | undefined,
): string | undefined {
  if (!option) {
    return undefined;
  }

  return [
    formatRouteDistance(option.distanceKm),
    formatRouteDuration(option.durationMinutes),
    getRouteOptionQualityLabel(option),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function getRouteModePendingKey(
  segmentId: string,
  mode: TripRouteMode,
): string {
  return JSON.stringify([segmentId, mode]);
}

export function parseRouteModePendingKey(
  pendingKey: string,
): RouteModePendingKey | undefined {
  try {
    const parsed = JSON.parse(pendingKey) as unknown;

    if (
      !Array.isArray(parsed) ||
      typeof parsed[0] !== "string" ||
      typeof parsed[1] !== "string"
    ) {
      return undefined;
    }

    if (!isTripRouteMode(parsed[1])) {
      return undefined;
    }

    return {
      mode: parsed[1],
      segmentId: parsed[0],
    };
  } catch {
    return undefined;
  }
}

export function isRouteModePending(
  pendingCounts: Record<string, number>,
  pendingIntents: Record<string, boolean>,
  segmentId: string | undefined,
  mode: TripRouteMode | undefined,
): boolean {
  if (!segmentId || !mode) {
    return false;
  }

  const pendingKey = getRouteModePendingKey(segmentId, mode);
  return (
    (pendingCounts[pendingKey] ?? 0) > 0 || Boolean(pendingIntents[pendingKey])
  );
}

export function formatRouteModeMetric(
  option: TripRouteModeOption | undefined,
  isSelected: boolean,
  isPending: boolean,
): string {
  if (isPending) {
    return "正在查询中";
  }

  if (option) {
    return formatRouteOptionMetric(option) ?? "";
  }

  return isSelected ? "路线计算中" : "点选后查询";
}

export function getRouteSegmentStatusText(
  result: TripRouteSegmentResult | undefined,
  option: TripRouteModeOption | undefined,
  isPending = false,
): string {
  if (isPending) {
    return "正在查询中";
  }

  if (!result) {
    return "路线计算中";
  }

  if (result.entry.status === "unavailable") {
    return result.entry.errorMessage ?? "暂时无法计算路线";
  }

  if (!option) {
    return "暂无可用路线";
  }

  return formatRouteOptionMetric(option) ?? "暂无可用路线";
}

export function createRouteInputFromSegment(
  segment: TripDayRouteSegment,
  result: TripRouteSegmentResult | undefined,
) {
  const entry = result?.entry;

  return {
    fromCoordinates: entry?.fromCoordinates ?? segment.snapshot.fromCoordinates,
    fromLabel: entry?.fromLabel ?? segment.snapshot.fromLabel,
    fromQuery: entry?.fromQuery ?? segment.snapshot.fromQuery,
    toCoordinates: entry?.toCoordinates ?? segment.snapshot.toCoordinates,
    toLabel: entry?.toLabel ?? segment.snapshot.toLabel,
    toQuery: entry?.toQuery ?? segment.snapshot.toQuery,
  };
}

export function getRouteModeIssueMessage(
  result: TripRouteSegmentResult | undefined,
  selectedMode: TripRouteMode,
): string | undefined {
  if (!result) {
    return undefined;
  }

  const selectedOption = result.entry.modeOptions.find(
    (item) => item.mode === selectedMode,
  );

  if (!selectedOption) {
    return `当前${getTripRouteModeLabel(selectedMode)}暂时没有可用路线`;
  }

  if (selectedOption.source === "estimated") {
    const fallbackRealOption = result.entry.modeOptions.find(
      (item) => item.source === "amap" && hasRouteModePolyline(item),
    );

    return fallbackRealOption
      ? `当前${getTripRouteModeLabel(selectedMode)}没有查到可绘制路线，暂时按估算结果显示`
      : `当前${getTripRouteModeLabel(selectedMode)}路线为估算结果`;
  }

  if (!hasRouteModePolyline(selectedOption)) {
    return `当前${getTripRouteModeLabel(selectedMode)}只返回了时间和距离，没有可绘制路线`;
  }

  return undefined;
}

export function getUserVisibleRouteMessage(
  result: TripRouteSegmentResult | undefined,
  selectedMode: TripRouteMode | undefined,
  isPending = false,
): string | undefined {
  if (isPending) {
    return "正在查询中";
  }

  if (!result) {
    return undefined;
  }

  if (result.entry.status === "unavailable") {
    return "路线暂时还没准备好，请稍后再试";
  }

  if (!selectedMode) {
    return result.entry.errorMessage
      ? "当前路线使用估算结果，切换方式时会按需查询"
      : undefined;
  }

  const issueMessage = getRouteModeIssueMessage(result, selectedMode);

  if (issueMessage) {
    return issueMessage;
  }

  return result.entry.errorMessage
    ? "当前路线使用估算结果，切换方式时会按需查询"
    : undefined;
}

export function formatMapPreviewSegmentText(
  segment: TripDayRouteSegment | undefined,
  fallback: string,
  options: {
    pendingCounts: Record<string, number>;
    pendingIntents: Record<string, boolean>;
    routeSegmentModes: Record<string, TripRouteMode | undefined>;
    routeSegmentResults: Record<string, TripRouteSegmentResult>;
  },
) {
  if (!segment) {
    return fallback;
  }

  const result = options.routeSegmentResults[segment.id];
  const selectedMode = options.routeSegmentModes[segment.id];
  const selectedOption = getRouteSegmentSelectedOption(result, selectedMode);
  const isPending = isRouteModePending(
    options.pendingCounts,
    options.pendingIntents,
    segment.id,
    selectedMode,
  );
  const mode = selectedOption?.mode ?? selectedMode;

  if (!selectedOption) {
    return getRouteSegmentStatusText(result, selectedOption, isPending);
  }

  return [
    mode ? getTripRouteModeLabel(mode) : "路线",
    formatRouteDistance(selectedOption.distanceKm),
    formatRouteDuration(selectedOption.durationMinutes),
  ].join(" ");
}

function isTripRouteMode(value: string): value is TripRouteMode {
  return (
    value === "walking" ||
    value === "cycling" ||
    value === "transit" ||
    value === "driving"
  );
}
