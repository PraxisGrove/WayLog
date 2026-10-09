import {
  type PlaceSearchCenter,
  type PlaceSuggestion,
  searchPlaceSuggestions,
} from "../../trips/place-search";
import { isTripPlaceCategory, type TripPlaceCategory } from "../../trips/types";

import {
  type AgentToolDefinition,
  type AgentToolRunContext,
  createAgentToolAudit,
  createAgentToolFailure,
  createAgentToolSuccess,
  getAgentToolClock,
  isRecord,
} from "./agent-tool-types";

export type AgentPoiSearchInput = {
  category?: TripPlaceCategory;
  limit?: number;
  nearbyCenter?: PlaceSearchCenter;
  query: string;
  regionText?: string;
};

export type AgentPoiSearchResult = {
  candidates: PlaceSuggestion[];
  query: string;
};

export type AgentPoiSearchDeps = {
  search?: (input: AgentPoiSearchInput) => Promise<PlaceSuggestion[]>;
};

export const poiSearchTool: AgentToolDefinition<
  unknown,
  AgentPoiSearchResult,
  AgentPoiSearchDeps
> = {
  description:
    "搜索地点候选。返回地点名、地址、分类、坐标和来源，供 Skill 生成候选卡或提案。",
  id: "poi.search",
  inputSchema: {
    category: "TripPlaceCategory?",
    limit: "number?",
    nearbyCenter: "{ latitude: number, longitude: number, label?: string }?",
    query: "string",
    regionText: "string?",
  },
  readOnly: true,
  risk: "low",
  run: runPoiSearchTool,
};

export async function runPoiSearchTool(
  input: unknown,
  context?: AgentToolRunContext<AgentPoiSearchDeps>,
) {
  const clock = getAgentToolClock(context);
  const startedAt = clock();
  const parsedInput = parsePoiSearchInput(input);

  if (!parsedInput.ok) {
    const finishedAt = clock();

    return createAgentToolFailure(
      "poi.search",
      "INVALID_TOOL_INPUT",
      parsedInput.message,
      createAgentToolAudit(startedAt, finishedAt, "place-search"),
    );
  }

  try {
    const search = context?.deps?.search ?? defaultPoiSearch;
    const candidates = await search(parsedInput.data);
    const finishedAt = clock();

    return createAgentToolSuccess(
      "poi.search",
      {
        candidates: candidates.slice(0, parsedInput.data.limit ?? 6),
        query: parsedInput.data.query,
      },
      createAgentToolAudit(startedAt, finishedAt, "place-search"),
    );
  } catch {
    const finishedAt = clock();

    return createAgentToolFailure(
      "poi.search",
      "TOOL_FAILED",
      "地点搜索暂时不可用，请稍后重试。",
      createAgentToolAudit(startedAt, finishedAt, "place-search"),
    );
  }
}

async function defaultPoiSearch(input: AgentPoiSearchInput) {
  return searchPlaceSuggestions(input.query, input.category, {
    nearbyCenter: input.nearbyCenter,
    persistResults: false,
    regionText: input.regionText,
  });
}

function parsePoiSearchInput(
  input: unknown,
): { ok: true; data: AgentPoiSearchInput } | { ok: false; message: string } {
  if (!isRecord(input)) {
    return { ok: false, message: "poi.search 输入必须是对象。" };
  }

  const query = readOptionalString(input.query);

  if (!query) {
    return { ok: false, message: "poi.search 需要 query。" };
  }
  if (input.category !== undefined && !isTripPlaceCategory(input.category)) {
    return { ok: false, message: "poi.search category 不受支持。" };
  }

  return {
    ok: true,
    data: {
      category: input.category,
      limit: readPositiveInteger(input.limit),
      nearbyCenter: parsePlaceSearchCenter(input.nearbyCenter),
      query,
      regionText: readOptionalString(input.regionText),
    },
  };
}

function parsePlaceSearchCenter(value: unknown): PlaceSearchCenter | undefined {
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

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? Math.min(value, 20)
    : undefined;
}
