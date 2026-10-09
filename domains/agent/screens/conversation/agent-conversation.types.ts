import type {
  AgentConversationAudit,
  AgentConversationDebug,
  AgentHarnessPreviewTurn,
  AgentProposalPreviewItem,
  AgentTripDraft,
  AgentTripTargetCandidate,
  CloudRouteDecision,
  ProposalGenerationTripDraftClarificationResult,
} from "@/features/agent";

export type PendingTripDraftClarification = {
  clarification: ProposalGenerationTripDraftClarificationResult["clarification"];
  error?: string;
  isSubmitting: boolean;
  userMessage: string;
};

export type PendingTripSelection = {
  candidates: AgentTripTargetCandidate[];
  continuation?: {
    conversationId: string;
    route: CloudRouteDecision;
    turnId: string;
  };
  id: string;
  intentLabel: string;
  userMessage: string;
};

export type PendingAgentProposal = {
  audit?: AgentConversationAudit;
  debug?: AgentDebugInfo;
  id: string;
  isApplying: boolean;
  notice?: string;
  requiresRegeneration?: boolean;
  preview: AgentProposalPreviewItem[];
  tripId: string;
  tripTitle: string;
  turn: AgentHarnessPreviewTurn;
  userMessage: string;
};

export type PendingTripDraft = {
  debug?: AgentDebugInfo;
  draft: AgentTripDraft;
  id: string;
  isCreating: boolean;
  notice?: string;
  userMessage: string;
};

export type AgentExecutionMode = "confirm" | "auto";

export type PendingAgentError = {
  actionLabel?: string;
  debug?: AgentDebugInfo;
  detail?: string;
  id: string;
  retry?: {
    conversationId: string;
    selectedTripId?: string;
    turnId: string;
    userMessage: string;
  };
  title: string;
};

export type AgentDebugInfo = AgentConversationDebug;

export type AgentConversationScreenProps = {
  bottomChromeInset?: number;
  conversationId?: string;
  showBackButton?: boolean;
  tripId?: string;
  tripTitle?: string;
};
