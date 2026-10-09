import type { AgentToolResult } from "./tools";

export type AgentTraceEvent =
  | {
      detail?: string;
      kind: "route_selector";
      label: string;
      status: "completed" | "skipped";
    }
  | {
      detail?: string;
      kind: "planner";
      label: string;
      status: "completed" | "warning";
    }
  | {
      detail?: string;
      kind: "skill";
      label: string;
      status: "completed" | "warning";
    }
  | {
      detail?: string;
      kind: "tool";
      label: string;
      status: "completed" | "warning";
      toolResult?: AgentToolResult<unknown>;
    }
  | {
      detail?: string;
      kind: "trip_context";
      label: string;
      status: "completed" | "warning";
    };
