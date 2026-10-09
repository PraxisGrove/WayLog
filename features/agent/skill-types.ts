import type { TripCommandDeps } from "../trips/commands";
import type { Trip } from "../trips/types";
import type { AgentSkillRouteMetadata } from "./contracts/skill-contract";
import type { TripEditProposal } from "./contracts/trip-edit-proposal-contract";
import type { AgentToolId } from "./tools";
import type { AgentTripDraft } from "./trip-draft";

export const AGENT_SKILL_IDS = [
  "trip.draft",
  "itinerary.edit",
  "waylog.qa",
] as const;

const agentSkillIdSet = new Set<unknown>(AGENT_SKILL_IDS);

export type AgentSkillId = (typeof AGENT_SKILL_IDS)[number];

export function isAgentSkillId(value: unknown): value is AgentSkillId {
  return agentSkillIdSet.has(value);
}

export type AgentSkillOutputKind =
  | "answer"
  | "answer_or_proposal"
  | "clarification"
  | "draft"
  | "draft_or_clarification"
  | "proposal";

export type AgentSkillRisk = "high" | "low" | "medium";

export type AgentSkillToolName =
  | "get_trip_context"
  | "search_places"
  | "research_places"
  | "get_weather"
  | "estimate_day_routes"
  | "get_expense_summary"
  | "propose_trip_patch"
  | "propose_create_trip";

export type AgentSkillInternalAction =
  | "estimate_day_routes"
  | "get_expense_summary"
  | "get_trip_context"
  | "propose_create_trip"
  | "propose_trip_patch"
  | "research_places";

export type AgentSkillStreamEvent =
  | { type: "status"; text: string }
  | {
      type: "tool_request";
      toolName: AgentSkillToolName;
      argsPreview?: Record<string, unknown>;
    }
  | {
      type: "tool_result_summary";
      toolName: AgentSkillToolName;
      summary: string;
      sourceCount?: number;
    };

export type AgentSkillErrorCode =
  | "INVALID_SKILL_INPUT"
  | "SKILL_NOT_FOUND"
  | "SKILL_TOOL_UNAVAILABLE"
  | "SKILL_FAILED";

export type AgentSkillError = {
  code: AgentSkillErrorCode;
  message: string;
};

export type AgentSkillResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AgentSkillError; events: AgentSkillStreamEvent[] };

export type AgentSkillRunContext = {
  deps?: TripCommandDeps;
  emit?: (event: AgentSkillStreamEvent) => void;
  trip: Trip;
  userMessage?: string;
};

export type AgentSkillRunResult =
  | {
      kind: "answer";
      answer: string;
      events: AgentSkillStreamEvent[];
    }
  | {
      kind: "clarification";
      message: string;
      events: AgentSkillStreamEvent[];
    }
  | {
      kind: "proposal";
      proposal: TripEditProposal;
      events: AgentSkillStreamEvent[];
    }
  | {
      kind: "draft";
      draft: AgentTripDraft;
      events: AgentSkillStreamEvent[];
    };

type AgentSkillDefinitionBase = {
  allowedTools: AgentSkillToolName[];
  allowedInternalActions: AgentSkillInternalAction[];
  allowedRuntimeTools: AgentToolId[];
  description: string;
  id: AgentSkillId;
  maxToolCalls: number;
  output: AgentSkillOutputKind;
  inputSchema?: Readonly<Record<string, unknown>>;
  outputSchema?: Readonly<Record<string, unknown>>;
  resultTypes?: readonly AgentSkillRunResult["kind"][];
  routeMetadata?: AgentSkillRouteMetadata;
  risk: AgentSkillRisk;
  triggerExamples: string[];
};

export type AgentSkillDefinition<TInput = unknown> = AgentSkillDefinitionBase &
  (
    | {
        execution: "pi_cloud";
        run?: never;
      }
    | {
        execution?: "local";
        run: (
          input: TInput,
          context: AgentSkillRunContext,
        ) => AgentSkillResult<AgentSkillRunResult>;
      }
  );

export function createAgentSkillError(
  code: AgentSkillErrorCode,
  message: string,
  events: AgentSkillStreamEvent[] = [],
): AgentSkillResult<never> {
  return {
    ok: false,
    error: { code, message },
    events,
  };
}
