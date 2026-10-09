import type { WayLogPiAgent } from "./pi-runtime";
import { readPublicSummary } from "./source-references";

type AgentEvent = Parameters<Parameters<WayLogPiAgent["subscribe"]>[0]>[0];

export const AGENT_UI_EVENT_SCHEMA_VERSION = 1 as const;

export type AgentUiStage =
  | "preparing"
  | "running_model"
  | "running_tool"
  | "validating_result"
  | "completed";

export type AgentUiEvent =
  | {
      schemaVersion: typeof AGENT_UI_EVENT_SCHEMA_VERSION;
      stage: AgentUiStage;
      type: "stage.changed";
    }
  | {
      publicSummary?: string;
      schemaVersion: typeof AGENT_UI_EVENT_SCHEMA_VERSION;
      status: "completed" | "failed" | "running";
      toolCallId: string;
      toolName: string;
      type: "tool.updated";
    };

export function projectPiAgentEvent(
  event: AgentEvent,
  publicToolNames: ReadonlyMap<string, string>,
): AgentUiEvent | undefined {
  if (event.type === "agent_start" || event.type === "turn_start") {
    return createStageEvent("running_model");
  }

  if (event.type === "agent_end") {
    return createStageEvent("completed");
  }

  if (event.type === "tool_execution_start") {
    if (isTerminatingTool(event.toolName)) {
      return createStageEvent("validating_result");
    }

    const toolName = publicToolNames.get(event.toolName);

    return toolName
      ? {
          schemaVersion: AGENT_UI_EVENT_SCHEMA_VERSION,
          status: "running",
          toolCallId: event.toolCallId,
          toolName,
          type: "tool.updated",
        }
      : undefined;
  }

  if (event.type === "tool_execution_end") {
    if (isTerminatingTool(event.toolName)) {
      return undefined;
    }

    const toolName = publicToolNames.get(event.toolName);
    const publicSummary = readPublicSummary(event.result.details);

    return toolName
      ? {
          ...(publicSummary ? { publicSummary } : {}),
          schemaVersion: AGENT_UI_EVENT_SCHEMA_VERSION,
          status: event.isError ? "failed" : "completed",
          toolCallId: event.toolCallId,
          toolName,
          type: "tool.updated",
        }
      : undefined;
  }

  return undefined;
}

function isTerminatingTool(toolName: string): boolean {
  return (
    toolName === "waylog_answer" ||
    toolName === "waylog_route" ||
    toolName === "waylog_trip_draft" ||
    toolName === "waylog_trip_edit_proposal"
  );
}

export function createStageEvent(stage: AgentUiStage): AgentUiEvent {
  return {
    schemaVersion: AGENT_UI_EVENT_SCHEMA_VERSION,
    stage,
    type: "stage.changed",
  };
}
