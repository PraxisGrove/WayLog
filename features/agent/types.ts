import type { TripEditOperation } from "./contracts/trip-edit-proposal-contract";

export type AgentOperationRisk = "low" | "medium" | "high";

export type AgentProposalPreviewFieldChange = {
  afterValue: string;
  beforeValue: string;
  field: "note" | "recommendationReason" | "time" | "title";
  label: string;
};

export type AgentProposalPreviewDisplay =
  | {
      address?: string;
      dayLabel: string;
      kind: "add_place_to_day";
      placeName: string;
      sourceDetails?: string[];
      targetPosition?: number;
      time?: string;
    }
  | {
      addedDayLabels: string[];
      currentDayCount: number;
      kind: "ensure_trip_day_count";
      targetDayCount: number;
    }
  | {
      changes: AgentProposalPreviewFieldChange[];
      kind: "update_day_item";
      targetName: string;
    }
  | {
      afterValue: string;
      beforeValue: string;
      dayLabel: string;
      kind: "update_trip_day_title";
    }
  | {
      from: {
        dayId: string;
        dayLabel: string;
        position: number;
      };
      kind: "move_day_item";
      targetName: string;
      to: {
        dayId: string;
        dayLabel: string;
        position: number;
      };
    }
  | {
      dayLabel: string;
      kind: "remove_day_item";
      placeImpact: string;
      targetName: string;
    };

export type AgentProposalPreviewItem = {
  action: TripEditOperation["type"];
  dayId?: string;
  description: string;
  display: AgentProposalPreviewDisplay;
  impact: string[];
  itemId?: string;
  operationId: string;
  risk: AgentOperationRisk;
  targetName?: string;
};

export type TripEditProposalResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: TripEditProposalError };

export type TripEditProposalErrorCode =
  | "COMMAND_FAILED"
  | "DUPLICATE_OPERATION"
  | "INVALID_PROPOSAL"
  | "TARGET_NOT_FOUND"
  | "TRIP_MISMATCH"
  | "VERSION_CONFLICT";

export type TripEditProposalError = {
  code: TripEditProposalErrorCode;
  message: string;
};
