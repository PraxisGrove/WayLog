import {
  fetchQuickWeatherByCoordinates,
  type TripWeatherDayForecast,
} from "../../weather";

import {
  type AgentToolDefinition,
  type AgentToolRunContext,
  createAgentToolAudit,
  createAgentToolFailure,
  createAgentToolSuccess,
  getAgentToolClock,
  isRecord,
} from "./agent-tool-types";

export type AgentWeatherGetInput = {
  latitude: number;
  longitude: number;
  placeName: string;
};

export type AgentWeatherGetResult = {
  forecast: TripWeatherDayForecast;
  placeName: string;
};

export type AgentWeatherGetDeps = {
  getWeather?: (
    input: AgentWeatherGetInput,
  ) => Promise<TripWeatherDayForecast | undefined>;
};

export const weatherGetTool: AgentToolDefinition<
  unknown,
  AgentWeatherGetResult,
  AgentWeatherGetDeps
> = {
  description: "按地点坐标查询天气。返回温度、天气、降雨概率、风力和旅行建议。",
  id: "weather.get",
  inputSchema: {
    latitude: "number",
    longitude: "number",
    placeName: "string",
  },
  readOnly: true,
  risk: "low",
  run: runWeatherGetTool,
};

export async function runWeatherGetTool(
  input: unknown,
  context?: AgentToolRunContext<AgentWeatherGetDeps>,
) {
  const clock = getAgentToolClock(context);
  const startedAt = clock();
  const parsedInput = parseWeatherGetInput(input);

  if (!parsedInput.ok) {
    const finishedAt = clock();

    return createAgentToolFailure(
      "weather.get",
      "INVALID_TOOL_INPUT",
      parsedInput.message,
      createAgentToolAudit(startedAt, finishedAt, "weather"),
    );
  }

  try {
    const getWeather = context?.deps?.getWeather ?? defaultWeatherGet;
    const forecast = await getWeather(parsedInput.data);
    const finishedAt = clock();

    if (!forecast) {
      return createAgentToolFailure(
        "weather.get",
        "TOOL_UNAVAILABLE",
        "暂时没有可用天气数据。",
        createAgentToolAudit(startedAt, finishedAt, "weather"),
      );
    }

    return createAgentToolSuccess(
      "weather.get",
      {
        forecast,
        placeName: parsedInput.data.placeName,
      },
      createAgentToolAudit(startedAt, finishedAt, forecast.source.label),
    );
  } catch {
    const finishedAt = clock();

    return createAgentToolFailure(
      "weather.get",
      "TOOL_FAILED",
      "天气查询暂时不可用，请稍后重试。",
      createAgentToolAudit(startedAt, finishedAt, "weather"),
    );
  }
}

async function defaultWeatherGet(input: AgentWeatherGetInput) {
  return fetchQuickWeatherByCoordinates(
    input.latitude,
    input.longitude,
    input.placeName,
  );
}

function parseWeatherGetInput(
  input: unknown,
): { ok: true; data: AgentWeatherGetInput } | { ok: false; message: string } {
  if (!isRecord(input)) {
    return { ok: false, message: "weather.get 输入必须是对象。" };
  }

  const latitude = readFiniteNumber(input.latitude);
  const longitude = readFiniteNumber(input.longitude);
  const placeName = readOptionalString(input.placeName);

  if (latitude === undefined || longitude === undefined || !placeName) {
    return {
      ok: false,
      message: "weather.get 需要 latitude、longitude 和 placeName。",
    };
  }

  return {
    ok: true,
    data: {
      latitude,
      longitude,
      placeName,
    },
  };
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
