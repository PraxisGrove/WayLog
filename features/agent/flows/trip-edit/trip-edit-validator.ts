import type { Trip } from "../../../trips/types";
import type { TripCommandDeps } from "../../../trips/commands";
import type { AgentValidationResult } from "../../contracts/validation-contract";
import type { TripEditProposal } from "../../contracts/trip-edit-proposal-contract";
import { evaluateTripEditProposal } from "../../proposals";
import {
  createTripEditOperationFacts,
  type TripEditOperationFact,
} from "./trip-edit-risk";

export type { TripEditOperationFact } from "./trip-edit-risk";

export type TripEditValidationCode =
  | "INVALID_PROPOSAL"
  | "TARGET_NOT_FOUND"
  | "UNVERIFIED_POI"
  | "VERSION_CONFLICT";

export type ValidatedTripEdit = {
  nextTrip: Trip;
  operationFacts: TripEditOperationFact[];
  proposal: TripEditProposal;
};

/** 完整校验整张提案；这里只计算不可变 next Trip，不执行任何存储写入。 */
export function validateTripEditProposal(input: {
  commandDeps?: TripCommandDeps;
  proposal: TripEditProposal;
  trip: Trip;
}): AgentValidationResult<ValidatedTripEdit> {
  const { commandDeps, proposal, trip } = input;
  if (proposal.tripId !== trip.id) {
    return invalid("INVALID_PROPOSAL", "TripEditProposal 与本地 Trip 不匹配。");
  }
  if (proposal.expectedUpdatedAt !== trip.updatedAt) {
    return invalid("VERSION_CONFLICT", "Trip 已发生变化，请重新生成提案。");
  }

  for (const operation of proposal.operations) {
    if (operation.tripId !== trip.id) {
      return invalid(
        "INVALID_PROPOSAL",
        "TripEditOperation 的 tripId 不匹配。",
      );
    }
    if (operation.type === "add_place_to_day") {
      const resolution = operation.metadata?.placeResolution;
      if (
        !operation.dayId ||
        operation.place.provider !== "amap" ||
        !operation.place.providerPlaceId?.trim() ||
        !Number.isFinite(operation.place.latitude) ||
        !Number.isFinite(operation.place.longitude) ||
        (operation.place.latitude ?? 91) < -90 ||
        (operation.place.latitude ?? -91) > 90 ||
        (operation.place.longitude ?? 181) < -180 ||
        (operation.place.longitude ?? -181) > 180 ||
        resolution?.confidence !== "high" ||
        resolution.provider !== operation.place.provider ||
        resolution.providerPlaceId !== operation.place.providerPlaceId
      ) {
        return invalid(
          "UNVERIFIED_POI",
          `地点「${operation.place.name}」缺少稳定 dayId 或已验证 POI 身份。`,
        );
      }
    }
  }

  const dryRun = evaluateTripEditProposal({ proposal, trip }, commandDeps);
  if (!dryRun.ok) {
    const code =
      dryRun.error.code === "TARGET_NOT_FOUND"
        ? "TARGET_NOT_FOUND"
        : dryRun.error.code === "VERSION_CONFLICT"
          ? "VERSION_CONFLICT"
          : "INVALID_PROPOSAL";
    return invalid(code, dryRun.error.message);
  }

  return {
    data: {
      nextTrip: dryRun.data.trip,
      operationFacts: createTripEditOperationFacts(proposal.operations, trip),
      proposal,
    },
    ok: true,
  };
}

function invalid(
  code: TripEditValidationCode,
  message: string,
): AgentValidationResult<never> {
  return {
    issues: [{ code, message, severity: "error" }],
    ok: false,
  };
}
