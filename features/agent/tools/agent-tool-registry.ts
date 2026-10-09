import {
  type AgentToolDefinition,
  type AgentToolId,
  type AgentToolResult,
  type AgentToolRunContext,
  createAgentToolAudit,
  createAgentToolFailure,
  getAgentToolClock,
} from "./agent-tool-types";
import { type AgentPoiSearchResult, poiSearchTool } from "./poi-search-tool";
import {
  type AgentRouteEstimateResult,
  routeEstimateTool,
} from "./route-estimate-tool";
import { type AgentTimeNowResult, timeNowTool } from "./time-now-tool";
import { type AgentWeatherGetResult, weatherGetTool } from "./weather-get-tool";
import { type AgentWebSearchResult, webSearchTool } from "./web-search-tool";

export type AnyAgentToolDefinition = Omit<
  AgentToolDefinition<unknown, unknown, unknown>,
  "run"
> & {
  run: (
    input: unknown,
    context?: AgentToolRunContext,
  ) => AgentToolResult<unknown> | Promise<AgentToolResult<unknown>>;
};

export type AgentToolRegistry = ReadonlyMap<
  AgentToolId,
  AnyAgentToolDefinition
>;

export type AgentToolDataById = {
  "poi.search": AgentPoiSearchResult;
  "route.estimate": AgentRouteEstimateResult;
  "time.now": AgentTimeNowResult;
  "web.search": AgentWebSearchResult;
  "weather.get": AgentWeatherGetResult;
};

export function createAgentToolRegistry(
  tools: AnyAgentToolDefinition[] = [
    timeNowTool as unknown as AnyAgentToolDefinition,
    weatherGetTool as unknown as AnyAgentToolDefinition,
    routeEstimateTool as unknown as AnyAgentToolDefinition,
    poiSearchTool as unknown as AnyAgentToolDefinition,
    webSearchTool as unknown as AnyAgentToolDefinition,
  ],
): AgentToolRegistry {
  const registry = new Map<AgentToolId, AnyAgentToolDefinition>();

  for (const tool of tools) {
    if (registry.has(tool.id)) {
      throw new Error(`Duplicate Agent tool id: ${tool.id}`);
    }

    registry.set(tool.id, tool);
  }

  return registry;
}

export const defaultAgentToolRegistry = createAgentToolRegistry();

export function getAgentTool(registry: AgentToolRegistry, toolId: AgentToolId) {
  return registry.get(toolId);
}

export async function runAgentTool<
  TToolId extends AgentToolId,
  TInput = unknown,
>(input: {
  context?: AgentToolRunContext;
  input: TInput;
  registry?: AgentToolRegistry;
  toolId: TToolId;
}): Promise<AgentToolResult<AgentToolDataById[TToolId]>>;
export async function runAgentTool<
  TToolId extends AgentToolId,
  TInput = unknown,
>(input: {
  context?: AgentToolRunContext;
  input: TInput;
  registry?: AgentToolRegistry;
  toolId: TToolId;
}): Promise<AgentToolResult<AgentToolDataById[TToolId]>> {
  const registry = input.registry ?? defaultAgentToolRegistry;
  const tool = getAgentTool(registry, input.toolId);

  if (!tool) {
    const clock = getAgentToolClock(input.context);
    const startedAt = clock();
    const finishedAt = clock();

    return createAgentToolFailure(
      input.toolId,
      "TOOL_NOT_FOUND",
      `找不到 Agent Tool：${input.toolId}`,
      createAgentToolAudit(startedAt, finishedAt),
    ) as AgentToolResult<AgentToolDataById[TToolId]>;
  }

  return (await tool.run(input.input, input.context)) as AgentToolResult<
    AgentToolDataById[TToolId]
  >;
}
