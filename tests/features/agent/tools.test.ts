import assert from "node:assert/strict";
import test from "node:test";

import {
  type AgentWeatherGetInput,
  defaultAgentToolRegistry,
  getAgentTool,
  runAgentTool,
  runRouteEstimateTool,
  runTimeNowTool,
} from "../../../features/agent";
import type { PlaceSuggestion } from "../../../features/trips/place-search";
import type { TripWeatherDayForecast } from "../../../features/weather";

const fixedNow = new Date("2026-06-29T14:30:15.000Z");
const fixedClock = () => fixedNow;

test("default tool registry exposes the first internal read tools", () => {
  assert.equal(
    getAgentTool(defaultAgentToolRegistry, "time.now")?.readOnly,
    true,
  );
  assert.equal(
    getAgentTool(defaultAgentToolRegistry, "weather.get")?.readOnly,
    true,
  );
  assert.equal(
    getAgentTool(defaultAgentToolRegistry, "route.estimate")?.readOnly,
    true,
  );
  assert.equal(
    getAgentTool(defaultAgentToolRegistry, "poi.search")?.readOnly,
    true,
  );
  assert.equal(
    getAgentTool(defaultAgentToolRegistry, "web.search")?.readOnly,
    true,
  );
});

test("time.now returns stable local runtime context", () => {
  const result = runTimeNowTool(
    {
      locale: "zh-CN",
      timeZone: "Asia/Shanghai",
    },
    {
      clock: fixedClock,
    },
  );

  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.equal(result.toolId, "time.now");
  assert.equal(result.data.iso, "2026-06-29T14:30:15.000Z");
  assert.equal(result.data.date, "2026-06-29");
  assert.equal(result.data.timeZone, "Asia/Shanghai");
  assert.match(result.data.localDateTime, /2026/);
});

test("route.estimate estimates distance, duration and auto mode from coordinates", () => {
  const result = runRouteEstimateTool(
    {
      from: {
        label: "A",
        latitude: 31.2304,
        longitude: 121.4737,
      },
      to: {
        label: "B",
        latitude: 31.232,
        longitude: 121.485,
      },
    },
    {
      clock: fixedClock,
    },
  );

  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.equal(result.data.mode, "walking");
  assert.equal(result.data.modeLabel, "步行");
  assert.equal(result.data.source, "estimated");
  assert.ok(result.data.distanceKm > 0);
  assert.ok(result.data.durationMinutes > 0);
});

test("poi.search can run through injected dependency without network", async () => {
  const suggestion: PlaceSuggestion = {
    address: "1850 Huaihai Middle Road",
    area: "上海市徐汇区",
    category: "景点",
    iconKey: "landmark",
    id: "poi-test",
    latitude: 31.204,
    longitude: 121.438,
    name: "武康大楼",
    poiGroup: "attraction",
    poiType: "landmark",
    provider: "amap",
    providerPlaceId: "B00155TEST",
  };
  const result = await runAgentTool({
    context: {
      clock: fixedClock,
      deps: {
        search: async () => [suggestion],
      },
    },
    input: {
      query: "武康大楼",
    },
    toolId: "poi.search",
  });

  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.equal(result.data.query, "武康大楼");
  assert.equal(result.data.candidates[0]?.name, "武康大楼");
});

test("poi.search rejects an unsupported category before invoking search", async () => {
  let searchCalls = 0;
  const result = await runAgentTool({
    context: {
      deps: {
        search: async () => {
          searchCalls += 1;
          return [];
        },
      },
    },
    input: { category: "夜生活", query: "酒吧" },
    toolId: "poi.search",
  });

  assert.equal(result.status, "error");
  assert.equal(searchCalls, 0);
});

test("weather.get can run through injected dependency without network", async () => {
  const forecast: TripWeatherDayForecast = {
    condition: "sunny",
    conditionLabel: "晴",
    dateKey: "2026-06-29",
    dayId: "today",
    dayIndex: 1,
    id: "weather-test",
    label: "今天",
    location: {
      latitude: 31.204,
      longitude: 121.438,
      name: "武康大楼",
    },
    precipitationChance: 10,
    riskLabels: [],
    source: {
      label: "test",
      type: "mock",
    },
    suggestion: "适合步行。",
    summary: "武康大楼 今天：晴，24-30°C",
    temperatureHigh: 30,
    temperatureLow: 24,
    uvIndex: 5,
    windLevel: "2级",
  };
  const result = await runAgentTool({
    context: {
      clock: fixedClock,
      deps: {
        getWeather: async (_input: AgentWeatherGetInput) => forecast,
      },
    },
    input: {
      latitude: 31.204,
      longitude: 121.438,
      placeName: "武康大楼",
    },
    toolId: "weather.get",
  });

  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.equal(result.data.placeName, "武康大楼");
  assert.equal(result.data.forecast.conditionLabel, "晴");
});
