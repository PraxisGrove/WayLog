import {
  createTripLocalMutationCheckpoint,
  getTripById,
  markTripDirtyWithoutScheduling,
  restoreTripLocalMutationCheckpointWithinWriteLock,
  scheduleTripsCloudSync,
  updateTripLocallyWithinWriteLock,
  type TripLocalMutationCheckpoint,
} from "../../../trips/storage";
import { runWithTripsLocalWriteLock } from "../../../trips/local-write-coordinator";
import type { Trip } from "../../../trips/types";
import {
  canApplyTripEditWithAuthorization,
  createTripEditApprovalPolicy,
  type TripEditAuthorization,
} from "../../approval/trip-edit-approval-gate";
import type { TripEditProposal } from "../../contracts/trip-edit-proposal-contract";
import { parseTripEditProposal } from "../../contracts/trip-edit-proposal-contract";
import {
  getAppliedAgentOperationIds,
  getAppliedAgentProposalRecords,
  recordAppliedAgentProposal,
} from "../../applied-proposals";
import { validateTripEditProposal } from "./trip-edit-validator";

export type TripEditApplyErrorCode =
  | "APPROVAL_REQUIRED"
  | "DUPLICATE_OPERATION"
  | "INVALID_PROPOSAL"
  | "ROLLBACK_FAILED"
  | "TARGET_NOT_FOUND"
  | "TRIP_NOT_FOUND"
  | "UNVERIFIED_POI"
  | "VERSION_CONFLICT"
  | "WRITE_FAILED";

export type TripEditApplyReceipt = {
  appliedAt: string;
  appliedOperationIds: string[];
  conversationId: string;
  proposalId: string;
  tripId: string;
  tripUpdatedAtAfterApply: string;
  turnId: string;
};

export type TripEditApplyResult =
  | {
      receipt: TripEditApplyReceipt;
      status: "applied" | "duplicate";
      trip: Trip;
    }
  | {
      error: { code: TripEditApplyErrorCode; message: string };
      status: "failed" | "rejected" | "version_conflict";
    };

export type TripEditApplyDeps = {
  captureLocalMutation?: (trip: Trip) => Promise<unknown>;
  clock?: () => string;
  findAppliedOperationIds: (
    proposal: TripEditProposal,
  ) => Promise<ReadonlySet<string>>;
  findReceipt?: (
    proposalId: string,
  ) => Promise<TripEditApplyReceipt | undefined>;
  idGen?: (prefix: string) => string;
  loadTrip: (tripId: string) => Promise<Trip | null>;
  markTripDirty: (trip: Trip) => Promise<void>;
  persistTripLocally: (trip: Trip) => Promise<Trip>;
  recordReceipt: (receipt: TripEditApplyReceipt, trip: Trip) => Promise<void>;
  rollbackLocalMutation: (
    originalTrip: Trip,
    checkpoint?: unknown,
  ) => Promise<void>;
  runWithTripWriteLock: <TResult>(
    work: () => Promise<TResult>,
  ) => Promise<TResult>;
  scheduleCloudSync: () => void;
};

export type ApplyTripEditProposalInput = {
  authorization?: TripEditAuthorization;
  conversationId: string;
  proposal: unknown;
  turnId: string;
};

export async function applyTripEditProposal(
  input: ApplyTripEditProposalInput,
  overrides: Partial<TripEditApplyDeps> = {},
): Promise<TripEditApplyResult> {
  const parsedProposal = parseTripEditProposal(input.proposal);
  if (!parsedProposal.ok) {
    return rejected("INVALID_PROPOSAL", parsedProposal.error.message);
  }
  if (!input.authorization) {
    return rejected(
      "APPROVAL_REQUIRED",
      "应用行程提案前需要用户确认或有效的快捷代办授权。",
    );
  }
  if (!input.conversationId.trim() || !input.turnId.trim()) {
    return rejected("INVALID_PROPOSAL", "TripEdit Apply 缺少对话审计标识。");
  }
  const deps = createDefaultDeps(parsedProposal.data, overrides);
  return deps.runWithTripWriteLock(() =>
    applyTripEditProposalOnce(input, parsedProposal.data, deps),
  );
}

async function applyTripEditProposalOnce(
  input: ApplyTripEditProposalInput,
  proposal: TripEditProposal,
  deps: TripEditApplyDeps,
): Promise<TripEditApplyResult> {
  const trip = await deps.loadTrip(proposal.tripId);
  if (!trip) {
    return rejected("TRIP_NOT_FOUND", "要修改的本地行程不存在。");
  }
  const appliedOperationIds = await deps.findAppliedOperationIds(proposal);
  const allOperationsApplied = proposal.operations.every((operation) =>
    appliedOperationIds.has(operation.operationId),
  );
  if (allOperationsApplied) {
    const receipt = await deps.findReceipt?.(proposal.proposalId);
    if (
      receipt &&
      receipt.proposalId === proposal.proposalId &&
      receipt.tripId === trip.id &&
      receipt.tripUpdatedAtAfterApply === trip.updatedAt &&
      proposal.operations.every((operation) =>
        receipt.appliedOperationIds.includes(operation.operationId),
      )
    ) {
      return { receipt, status: "duplicate", trip };
    }
    return rejected(
      "DUPLICATE_OPERATION",
      "操作账本已存在，但无法恢复对应的应用回执。",
    );
  }
  const commandDeps = {
    clock: deps.clock ?? (() => new Date().toISOString()),
    idGen:
      deps.idGen ??
      ((prefix: string) =>
        `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
  };
  const validation = validateTripEditProposal({
    commandDeps,
    proposal,
    trip,
  });
  if (!validation.ok) {
    const issue = validation.issues[0];
    if (issue?.code === "VERSION_CONFLICT") {
      return {
        error: { code: "VERSION_CONFLICT", message: issue.message },
        status: "version_conflict",
      };
    }
    return rejected(
      (issue?.code as TripEditApplyErrorCode | undefined) ?? "INVALID_PROPOSAL",
      issue?.message ?? "TripEditProposal 未通过 Validator。",
    );
  }
  const policy = createTripEditApprovalPolicy(validation.data);
  if (!canApplyTripEditWithAuthorization(policy, input.authorization)) {
    return rejected("APPROVAL_REQUIRED", "当前授权不能应用这张行程提案。");
  }

  const duplicateOperation = proposal.operations.find((operation) =>
    appliedOperationIds.has(operation.operationId),
  );
  if (duplicateOperation) {
    return rejected(
      "DUPLICATE_OPERATION",
      `操作 ${duplicateOperation.operationId} 已经应用过。`,
    );
  }

  let didStartLocalMutation = false;
  let checkpoint: unknown;
  try {
    checkpoint = await deps.captureLocalMutation?.(trip);
    if (
      isTripLocalMutationCheckpoint(checkpoint) &&
      checkpoint.trip.updatedAt !== trip.updatedAt
    ) {
      return {
        error: {
          code: "VERSION_CONFLICT",
          message: "Trip 在本地提交前已发生变化，请重新生成提案。",
        },
        status: "version_conflict",
      };
    }
    didStartLocalMutation = true;
    const persistedTrip = await deps.persistTripLocally(
      validation.data.nextTrip,
    );
    await deps.markTripDirty(persistedTrip);
    const receipt: TripEditApplyReceipt = {
      appliedAt: deps.clock?.() ?? new Date().toISOString(),
      appliedOperationIds: proposal.operations.map(
        (operation) => operation.operationId,
      ),
      conversationId: input.conversationId,
      proposalId: proposal.proposalId,
      tripId: persistedTrip.id,
      tripUpdatedAtAfterApply: persistedTrip.updatedAt,
      turnId: input.turnId,
    };
    await deps.recordReceipt(receipt, persistedTrip);
    try {
      deps.scheduleCloudSync();
    } catch {
      // 本地 Trip、dirty 与 receipt 已提交，调度失败不回滚已确认编辑。
    }
    return { receipt, status: "applied", trip: persistedTrip };
  } catch (error) {
    if (didStartLocalMutation) {
      try {
        await deps.rollbackLocalMutation(trip, checkpoint);
      } catch (rollbackError) {
        const rollbackMessage =
          rollbackError instanceof Error
            ? rollbackError.message
            : "本地补偿失败。";
        return {
          error: {
            code: "ROLLBACK_FAILED",
            message: `应用行程提案失败，且本地补偿失败：${rollbackMessage}`,
          },
          status: "failed",
        };
      }
    }
    return {
      error: {
        code: "WRITE_FAILED",
        message: error instanceof Error ? error.message : "应用行程提案失败。",
      },
      status: "failed",
    };
  }
}

function createDefaultDeps(
  proposal: TripEditProposal,
  overrides: Partial<TripEditApplyDeps>,
): TripEditApplyDeps {
  return {
    captureLocalMutation:
      overrides.captureLocalMutation ??
      (overrides.persistTripLocally || overrides.rollbackLocalMutation
        ? undefined
        : (trip) => createTripLocalMutationCheckpoint(trip.id)),
    clock: overrides.clock,
    findAppliedOperationIds:
      overrides.findAppliedOperationIds ??
      (() => getAppliedAgentOperationIds()),
    findReceipt:
      overrides.findReceipt ??
      (async (proposalId) => {
        const record = (await getAppliedAgentProposalRecords()).find(
          (candidate) => candidate.proposalId === proposalId,
        );
        return record?.conversationId && record.turnId
          ? {
              appliedAt: record.appliedAt,
              appliedOperationIds: record.operationIds,
              conversationId: record.conversationId,
              proposalId: record.proposalId,
              tripId: record.tripId,
              tripUpdatedAtAfterApply: record.tripUpdatedAtAfterApply,
              turnId: record.turnId,
            }
          : undefined;
      }),
    idGen: overrides.idGen,
    loadTrip: overrides.loadTrip ?? getTripById,
    markTripDirty: overrides.markTripDirty ?? markTripDirtyWithoutScheduling,
    persistTripLocally:
      overrides.persistTripLocally ?? updateTripLocallyWithinWriteLock,
    recordReceipt:
      overrides.recordReceipt ??
      (async (receipt, trip) => {
        await recordAppliedAgentProposal(
          {
            appliedOperationIds: receipt.appliedOperationIds,
            conversationId: receipt.conversationId,
            proposal,
            trip,
            turnId: receipt.turnId,
          },
          { clock: () => receipt.appliedAt },
        );
      }),
    rollbackLocalMutation:
      overrides.rollbackLocalMutation ??
      (async (_trip, checkpoint) => {
        if (!checkpoint) {
          throw new Error("缺少 Trip 本地补偿快照。");
        }
        await restoreTripLocalMutationCheckpointWithinWriteLock(
          checkpoint as TripLocalMutationCheckpoint,
        );
      }),
    runWithTripWriteLock:
      overrides.runWithTripWriteLock ?? runWithTripsLocalWriteLock,
    scheduleCloudSync: overrides.scheduleCloudSync ?? scheduleTripsCloudSync,
  };
}

function isTripLocalMutationCheckpoint(
  value: unknown,
): value is TripLocalMutationCheckpoint {
  return (
    isRecord(value) &&
    isRecord(value.trip) &&
    typeof value.trip.updatedAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejected(
  code: TripEditApplyErrorCode,
  message: string,
): TripEditApplyResult {
  return { error: { code, message }, status: "rejected" };
}
