export type AgentApprovalRisk = "high" | "low" | "medium";

export type AgentApprovalRequirement =
  | "explicit_confirm"
  | "quick_delegate_allowed"
  | "strong_confirm";

export type AgentOperationApprovalPolicy = {
  operationId: string;
  reasons: string[];
  requirement: AgentApprovalRequirement;
  risk: AgentApprovalRisk;
};

export type AgentApprovalPolicy = {
  operations: AgentOperationApprovalPolicy[];
  proposalId: string;
  requiresUserConfirmation: boolean;
};
