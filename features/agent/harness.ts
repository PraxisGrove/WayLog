import type { TripCommandDeps } from "../trips/commands";
import type { Trip } from "../trips/types";
import {
  type ApplyTripEditProposalCommandsData,
  applyTripEditProposalCommands,
  type ValidateTripEditProposalPreviewData,
  validateTripEditProposalPreview,
} from "./proposals";
import type { TripEditProposal } from "./contracts/trip-edit-proposal-contract";
import type { AgentProposalPreviewItem, TripEditProposalError } from "./types";

export type AgentHarnessConfirmation = "preview_only" | "confirmed";

export type AgentHarnessModelContext = {
  trip: Trip;
  userMessage: string;
};

export type AgentHarnessModel = (
  context: AgentHarnessModelContext,
) => Promise<unknown> | unknown;

export type AgentHarnessTraceEvent =
  | { step: "model_output_received" }
  | {
      operationCount: number;
      proposalId: string;
      step: "proposal_validated";
    }
  | {
      code: AgentHarnessError["code"];
      step: "proposal_rejected";
    }
  | {
      proposalId: string;
      step: "waiting_for_confirmation";
    }
  | {
      appliedOperationIds: string[];
      proposalId: string;
      step: "proposal_applied";
    };

export type AgentHarnessError =
  | TripEditProposalError
  | { code: "MODEL_FAILED"; message: string };

export type AgentHarnessResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: AgentHarnessError;
      trace: AgentHarnessTraceEvent[];
    };

export type RunAgentHarnessTurnInput = {
  appliedOperationIds?: ReadonlySet<string>;
  confirmation?: AgentHarnessConfirmation;
  model: AgentHarnessModel;
  trip: Trip;
  userMessage: string;
};

export type AgentHarnessPreviewTurn = {
  preview: AgentProposalPreviewItem[];
  proposal: TripEditProposal;
  status: "preview";
  trace: AgentHarnessTraceEvent[];
};

export type AgentHarnessAppliedTurn = {
  appliedOperationIds: string[];
  preview: AgentProposalPreviewItem[];
  proposal: TripEditProposal;
  status: "applied";
  trace: AgentHarnessTraceEvent[];
  trip: Trip;
};

export type AgentHarnessTurn =
  | AgentHarnessAppliedTurn
  | AgentHarnessPreviewTurn;

export async function runAgentHarnessTurn(
  input: RunAgentHarnessTurnInput,
  deps?: TripCommandDeps,
): Promise<AgentHarnessResult<AgentHarnessTurn>> {
  const trace: AgentHarnessTraceEvent[] = [];
  const modelOutputResult = await getModelOutput(input);

  if (!modelOutputResult.ok) {
    trace.push({
      code: modelOutputResult.error.code,
      step: "proposal_rejected",
    });
    return {
      ok: false,
      error: modelOutputResult.error,
      trace,
    };
  }

  trace.push({ step: "model_output_received" });

  const validationResult = validateTripEditProposalPreview({
    proposal: modelOutputResult.data,
    trip: input.trip,
  });

  if (!validationResult.ok) {
    trace.push({
      code: validationResult.error.code,
      step: "proposal_rejected",
    });
    return {
      ok: false,
      error: validationResult.error,
      trace,
    };
  }

  appendValidationTrace(trace, validationResult.data);

  if ((input.confirmation ?? "preview_only") !== "confirmed") {
    trace.push({
      proposalId: validationResult.data.proposal.proposalId,
      step: "waiting_for_confirmation",
    });
    return {
      ok: true,
      data: {
        preview: validationResult.data.preview,
        proposal: validationResult.data.proposal,
        status: "preview",
        trace,
      },
    };
  }

  const applyResult = applyTripEditProposalCommands(
    {
      appliedOperationIds: input.appliedOperationIds,
      proposal: validationResult.data.proposal,
      trip: input.trip,
    },
    deps,
  );

  if (!applyResult.ok) {
    trace.push({
      code: applyResult.error.code,
      step: "proposal_rejected",
    });
    return {
      ok: false,
      error: applyResult.error,
      trace,
    };
  }

  appendAppliedTrace(
    trace,
    validationResult.data.proposal.proposalId,
    applyResult.data,
  );

  return {
    ok: true,
    data: {
      appliedOperationIds: applyResult.data.appliedOperationIds,
      preview: applyResult.data.preview,
      proposal: validationResult.data.proposal,
      status: "applied",
      trace,
      trip: applyResult.data.trip,
    },
  };
}

async function getModelOutput(
  input: RunAgentHarnessTurnInput,
): Promise<
  | { ok: true; data: unknown }
  | { ok: false; error: Extract<AgentHarnessError, { code: "MODEL_FAILED" }> }
> {
  try {
    return {
      ok: true,
      data: await input.model({
        trip: input.trip,
        userMessage: input.userMessage,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "MODEL_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Agent model failed before returning a proposal",
      },
    };
  }
}

function appendValidationTrace(
  trace: AgentHarnessTraceEvent[],
  data: ValidateTripEditProposalPreviewData,
) {
  trace.push({
    operationCount: data.proposal.operations.length,
    proposalId: data.proposal.proposalId,
    step: "proposal_validated",
  });
}

function appendAppliedTrace(
  trace: AgentHarnessTraceEvent[],
  proposalId: string,
  data: ApplyTripEditProposalCommandsData,
) {
  trace.push({
    appliedOperationIds: data.appliedOperationIds,
    proposalId,
    step: "proposal_applied",
  });
}
