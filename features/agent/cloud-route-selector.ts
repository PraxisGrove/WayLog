import {
  type AgentUiEvent,
  createStageEvent,
  projectPiAgentEvent,
} from "./agent-ui-events";
import type { WayLogPiAgentOptions } from "./pi-runtime";
import { createWayLogPiAgent } from "./pi-runtime";
import {
  type AgentSkillRegistry,
  defaultAgentSkillRegistry,
  listRouteVisibleAgentSkills,
} from "./skill-registry";
import { type AgentSkillId, isAgentSkillId } from "./skill-types";

type StreamFn = WayLogPiAgentOptions["streamFn"];
type AgentTool = NonNullable<
  NonNullable<WayLogPiAgentOptions["initialState"]>["tools"]
>[number];

const ROUTE_TOOL_NAME = "waylog_route";
const MAX_MISSING_SLOTS = 8;
const MAX_PUBLIC_MESSAGE_LENGTH = 500;

export type CloudRouteBuiltInHandler = "clarification" | "out_of_scope";
export type CloudRouteScope = "ambiguous" | "in_scope" | "out_of_scope";

export type CloudRouteDecision = {
  confidence: number;
  handler?: CloudRouteBuiltInHandler;
  missingSlots: string[];
  publicMessage?: string;
  routeKind: "built_in" | "skill";
  scope: CloudRouteScope;
  skillId?: AgentSkillId;
};

export type CloudRoutePageContext = {
  hasSelectedTrip: boolean;
  surface: "agent_conversation";
};

export type RunCloudRouteSelectorInput = {
  model: StreamFn;
  onEvent?: (event: AgentUiEvent) => void;
  pageContext?: CloudRoutePageContext;
  registerAbort?: (abort: () => void) => () => void;
  skillRegistry?: AgentSkillRegistry;
  userMessage: string;
};

/**
 * 云端 RouteSelector 的移动端 Pi run。这里只装载路由元数据与终止工具，
 * 不装载任一 Skill 正文、执行 schema、业务工具或完整 Trip。
 */
export async function runCloudRouteSelector(
  input: RunCloudRouteSelectorInput,
): Promise<CloudRouteDecision> {
  let route: CloudRouteDecision | undefined;
  const routeTool: AgentTool = {
    description:
      "Return the validated WayLog route decision and terminate routing.",
    execute: async (_toolCallId, params) => {
      route = parseCloudRouteDecision(params);

      return {
        content: [{ text: route.scope, type: "text" }],
        details: { scope: route.scope },
        terminate: true,
      };
    },
    label: "完成路由",
    name: ROUTE_TOOL_NAME,
    parameters: createCloudRouteToolSchema(),
  };
  const agent = await createWayLogPiAgent({
    initialState: {
      model: createRouteModelProfile(),
      systemPrompt: "",
      tools: [routeTool],
    },
    streamFn: input.model,
  });

  agent.subscribe((event) => {
    const publicEvent = projectPiAgentEvent(event, new Map());

    // 路由 run 结束不等于整个 Proposal Generation 完成。
    if (
      publicEvent?.type === "stage.changed" &&
      publicEvent.stage === "completed"
    ) {
      return;
    }

    if (publicEvent) input.onEvent?.(publicEvent);
  });
  input.onEvent?.(createStageEvent("preparing"));

  const unregisterAbort = input.registerAbort?.(() => agent.abort());
  try {
    await agent.prompt(
      JSON.stringify({
        builtInHandlers: ["clarification", "out_of_scope"],
        kind: "waylog_route_request",
        pageContext: input.pageContext ?? {
          hasSelectedTrip: false,
          surface: "agent_conversation",
        },
        skills: listRouteVisibleAgentSkills(
          input.skillRegistry ?? defaultAgentSkillRegistry,
        ),
        userMessage: input.userMessage,
      }),
    );
  } finally {
    unregisterAbort?.();
  }

  if (!route) {
    throw new Error(
      agent.state.errorMessage ||
        "Pi route run ended without a valid waylog_route terminating tool call.",
    );
  }

  return route;
}

function parseCloudRouteDecision(value: unknown): CloudRouteDecision {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["route"]) ||
    !isRecord(value.route) ||
    !hasOnlyKeys(value.route, [
      "confidence",
      "handler",
      "missingSlots",
      "publicMessage",
      "routeKind",
      "scope",
      "skillId",
    ])
  ) {
    throw new Error("waylog_route requires a structured route object.");
  }

  const route = value.route;
  const scope = readScope(route.scope);
  const routeKind =
    route.routeKind === "built_in" || route.routeKind === "skill"
      ? route.routeKind
      : undefined;
  const confidence = route.confidence;
  const missingSlots = readMissingSlots(route.missingSlots);

  if (
    !scope ||
    !routeKind ||
    typeof confidence !== "number" ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1 ||
    !missingSlots
  ) {
    throw new Error("waylog_route.route contains invalid routing fields.");
  }

  if (routeKind === "skill") {
    if (
      scope !== "in_scope" ||
      !isAgentSkillId(route.skillId) ||
      route.handler !== undefined ||
      route.publicMessage !== undefined
    ) {
      throw new Error("A Skill route requires an in-scope registered skillId.");
    }

    return {
      confidence,
      missingSlots,
      routeKind,
      scope,
      skillId: route.skillId,
    };
  }

  const handler = readBuiltInHandler(route.handler);
  const publicMessage = readBoundedString(
    route.publicMessage,
    MAX_PUBLIC_MESSAGE_LENGTH,
  );

  if (
    !handler ||
    !publicMessage ||
    route.skillId !== undefined ||
    (scope === "ambiguous" && handler !== "clarification") ||
    (scope === "out_of_scope" && handler !== "out_of_scope") ||
    scope === "in_scope"
  ) {
    throw new Error("A built-in route has inconsistent scope or handler.");
  }

  return {
    confidence,
    handler,
    missingSlots,
    publicMessage,
    routeKind,
    scope,
  };
}

export function createCloudRouteToolSchema(): Record<string, unknown> {
  return {
    additionalProperties: false,
    properties: {
      route: {
        anyOf: [
          createCloudSkillRouteSchema(),
          createCloudBuiltInRouteSchema("ambiguous", "clarification"),
          createCloudBuiltInRouteSchema("out_of_scope", "out_of_scope"),
        ],
      },
    },
    required: ["route"],
    type: "object",
  };
}

function createCloudSkillRouteSchema() {
  return {
    additionalProperties: false,
    properties: {
      confidence: { maximum: 1, minimum: 0, type: "number" },
      missingSlots: createCloudMissingSlotsSchema(),
      routeKind: { enum: ["skill"], type: "string" },
      scope: { enum: ["in_scope"], type: "string" },
      skillId: {
        enum: ["itinerary.edit", "trip.draft", "waylog.qa"],
        type: "string",
      },
    },
    required: ["confidence", "missingSlots", "routeKind", "scope", "skillId"],
    type: "object",
  };
}

function createCloudBuiltInRouteSchema(
  scope: "ambiguous" | "out_of_scope",
  handler: CloudRouteBuiltInHandler,
) {
  return {
    additionalProperties: false,
    properties: {
      confidence: { maximum: 1, minimum: 0, type: "number" },
      handler: { enum: [handler], type: "string" },
      missingSlots: createCloudMissingSlotsSchema(),
      publicMessage: {
        maxLength: MAX_PUBLIC_MESSAGE_LENGTH,
        minLength: 1,
        type: "string",
      },
      routeKind: { enum: ["built_in"], type: "string" },
      scope: { enum: [scope], type: "string" },
    },
    required: [
      "confidence",
      "handler",
      "missingSlots",
      "publicMessage",
      "routeKind",
      "scope",
    ],
    type: "object",
  };
}

function createCloudMissingSlotsSchema() {
  return {
    items: { maxLength: 80, minLength: 1, type: "string" },
    maxItems: MAX_MISSING_SLOTS,
    type: "array",
  };
}

function createRouteModelProfile() {
  return {
    api: "waylog-proxy",
    baseUrl: "",
    contextWindow: 4_000,
    cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
    id: "router",
    input: ["text"] as ["text"],
    maxTokens: 320,
    name: "WayLog Route Selector",
    provider: "waylog",
    reasoning: false,
  };
}

function readScope(value: unknown): CloudRouteScope | undefined {
  return value === "ambiguous" ||
    value === "in_scope" ||
    value === "out_of_scope"
    ? value
    : undefined;
}

function readBuiltInHandler(
  value: unknown,
): CloudRouteBuiltInHandler | undefined {
  return value === "clarification" || value === "out_of_scope"
    ? value
    : undefined;
}

function readMissingSlots(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_MISSING_SLOTS) {
    return undefined;
  }

  const slots = value.map((slot) => readBoundedString(slot, 80));

  return slots.every((slot): slot is string => slot !== undefined)
    ? Array.from(new Set(slots))
    : undefined;
}

function readBoundedString(
  value: unknown,
  maxLength: number,
): string | undefined {
  return typeof value === "string" && value.trim().length <= maxLength
    ? value.trim() || undefined
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  const allowed = new Set(allowedKeys);

  return Object.keys(value).every((key) => allowed.has(key));
}
