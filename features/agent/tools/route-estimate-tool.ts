import type { TripRouteMode } from "../../trips/route-segments";
import {
  getAutoTripRouteModeForDistance,
  getTripRouteModeLabel,
} from "../../trips/route-segments";

import {
  type AgentToolDefinition,
  type AgentToolRunContext,
  createAgentToolAudit,
  createAgentToolFailure,
  createAgentToolSuccess,
  getAgentToolClock,
  isRecord,
} from "./agent-tool-types";

export type AgentRouteEstimateInput = {
  from: AgentRoutePointInput;
  mode?: TripRouteMode;
  to: AgentRoutePointInput;
};

export type AgentRoutePointInput = {
  label?: string;
  latitude: number;
  longitude: number;
};

export type AgentRouteEstimateResult = {
  distanceKm: number;
  durationMinutes: number;
  from: AgentRoutePointInput;
  mode: TripRouteMode;
  modeLabel: string;
  source: "estimated";
  to: AgentRoutePointInput;
};

const routeModeFallbackSpeedKmhMap: Record<TripRouteMode, number> = {
  cycling: 16,
  driving: 68,
  transit: 28,
  walking: 4.8,
};

const routeModeDistanceFactorMap: Record<TripRouteMode, number> = {
  cycling: 1.2,
  driving: 1.25,
  transit: 1.4,
  walking: 1.15,
};

export const routeEstimateTool: AgentToolDefinition<
  unknown,
  AgentRouteEstimateResult
> = {
  description:
    "基于两点坐标估算路线距离、耗时和推荐交通方式。首版不触发远程路线查询。",
  id: "route.estimate",
  inputSchema: {
    from: "{ latitude: number, longitude: number, label?: string }",
    mode: "'walking' | 'cycling' | 'driving' | 'transit'?",
    to: "{ latitude: number, longitude: number, label?: string }",
  },
  readOnly: true,
  risk: "low",
  run: runRouteEstimateTool,
};

export function runRouteEstimateTool(
  input: unknown,
  context?: AgentToolRunContext,
) {
  const clock = getAgentToolClock(context);
  const startedAt = clock();
  const parsedInput = parseRouteEstimateInput(input);

  if (!parsedInput.ok) {
    const finishedAt = clock();

    return createAgentToolFailure(
      "route.estimate",
      "INVALID_TOOL_INPUT",
      parsedInput.message,
      createAgentToolAudit(startedAt, finishedAt, "local-estimate"),
    );
  }

  const directDistanceKm = getHaversineDistanceKm(
    parsedInput.data.from,
    parsedInput.data.to,
  );
  const mode =
    parsedInput.data.mode ?? getAutoTripRouteModeForDistance(directDistanceKm);
  const distanceKm = Number(
    (directDistanceKm * routeModeDistanceFactorMap[mode]).toFixed(
      directDistanceKm >= 100 ? 0 : 2,
    ),
  );
  const durationMinutes = Math.max(
    1,
    Math.round((distanceKm / routeModeFallbackSpeedKmhMap[mode]) * 60),
  );
  const finishedAt = clock();

  return createAgentToolSuccess(
    "route.estimate",
    {
      distanceKm,
      durationMinutes,
      from: parsedInput.data.from,
      mode,
      modeLabel: getTripRouteModeLabel(mode),
      source: "estimated" as const,
      to: parsedInput.data.to,
    },
    createAgentToolAudit(startedAt, finishedAt, "local-estimate"),
  );
}

function parseRouteEstimateInput(
  input: unknown,
):
  | { ok: true; data: AgentRouteEstimateInput }
  | { ok: false; message: string } {
  if (!isRecord(input)) {
    return { ok: false, message: "route.estimate 输入必须是对象。" };
  }

  const from = parseRoutePoint(input.from);
  const to = parseRoutePoint(input.to);
  const mode = readRouteMode(input.mode);

  if (!from || !to) {
    return { ok: false, message: "route.estimate 需要有效的 from/to 经纬度。" };
  }

  if (input.mode !== undefined && !mode) {
    return { ok: false, message: "route.estimate mode 不受支持。" };
  }

  return {
    ok: true,
    data: {
      from,
      mode,
      to,
    },
  };
}

function parseRoutePoint(value: unknown): AgentRoutePointInput | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const latitude = readFiniteNumber(value.latitude);
  const longitude = readFiniteNumber(value.longitude);

  if (latitude === undefined || longitude === undefined) {
    return undefined;
  }

  return {
    label: readOptionalString(value.label),
    latitude,
    longitude,
  };
}

function getHaversineDistanceKm(
  from: AgentRoutePointInput,
  to: AgentRoutePointInput,
) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readRouteMode(value: unknown): TripRouteMode | undefined {
  return value === "walking" ||
    value === "cycling" ||
    value === "driving" ||
    value === "transit"
    ? value
    : undefined;
}
