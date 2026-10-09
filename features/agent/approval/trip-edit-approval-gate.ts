import type { AgentApprovalPolicy } from "../contracts/approval-contract";
import type { ValidatedTripEdit } from "../flows/trip-edit/trip-edit-validator";
import type { AgentOperationRisk } from "../types";

export type TripEditAuthorization =
  | { kind: "explicit_confirmation" }
  | { enabled: true; kind: "quick_delegate" }
  | { kind: "strong_confirmation" };

export function createTripEditApprovalPolicy(
  validated: ValidatedTripEdit,
): AgentApprovalPolicy {
  const requiresStrongConfirmation = requiresStrongTripEditConfirmation(
    validated.operationFacts,
  );
  const operations = validated.operationFacts.map((fact) => {
    return {
      operationId: fact.operationId,
      reasons: [
        fact.reasonCode,
        ...(validated.operationFacts.length > 1 ? ["multiple_operations"] : []),
      ],
      requirement: requiresStrongConfirmation
        ? ("strong_confirm" as const)
        : ("quick_delegate_allowed" as const),
      risk: fact.risk,
    };
  });

  return {
    operations,
    proposalId: validated.proposal.proposalId,
    requiresUserConfirmation: true,
  };
}

export function requiresStrongTripEditConfirmation(
  operations: readonly { risk: AgentOperationRisk }[],
): boolean {
  return (
    operations.length > 1 ||
    operations.some((operation) => operation.risk !== "low")
  );
}

export function canQuickDelegateTripEdit(
  operations: readonly { risk: AgentOperationRisk }[],
): boolean {
  return (
    operations.length === 1 && !requiresStrongTripEditConfirmation(operations)
  );
}

export function canApplyTripEditWithAuthorization(
  policy: AgentApprovalPolicy,
  authorization: TripEditAuthorization | undefined,
): boolean {
  if (!authorization) return false;
  if (authorization.kind === "strong_confirmation") return true;
  if (authorization.kind === "explicit_confirmation") {
    return policy.operations.every(
      (operation) => operation.requirement !== "strong_confirm",
    );
  }
  return policy.operations.every(
    (operation) => operation.requirement === "quick_delegate_allowed",
  );
}
