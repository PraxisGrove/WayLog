import type { AgentTripTargetCandidate } from "@/features/agent";
import {
  AgentErrorCard,
  AgentProposalConfirmationCard,
  AgentTripDraftCard,
  AgentTripSelectionCard,
} from "@/shared/agent/agent-action-cards";
import { useSkinSlot } from "@/shared/theme/use-app-theme";

import type {
  PendingAgentError,
  PendingAgentProposal,
  PendingTripDraft,
  PendingTripDraftClarification,
  PendingTripSelection,
} from "../agent-conversation.types";
import { AgentDayCountClarificationCard } from "./agent-day-count-clarification-card";
import { AgentDestinationClarificationCard } from "./agent-destination-clarification-card";
import { AgentDebugDetails } from "./agent-debug-details";

export type AgentPendingActionStackProps = {
  onApplyProposal: () => void;
  onCancelProposal: () => void;
  onCreateTripDraft: () => void;
  onDiscardTripDraft: () => void;
  onDismissError: () => void;
  onEditTripDraft: () => void;
  onSubmitDayCount: (dayCount: number) => void;
  onSubmitDestination: (destination: string) => void;
  onSelectTripCandidate: (candidate: AgentTripTargetCandidate) => void;
  pendingError?: PendingAgentError;
  pendingProposal?: PendingAgentProposal;
  pendingTripDraft?: PendingTripDraft;
  pendingTripDraftClarification?: PendingTripDraftClarification;
  pendingTripSelection?: PendingTripSelection;
};

export function AgentPendingActionStack({
  onApplyProposal,
  onCancelProposal,
  onCreateTripDraft,
  onDiscardTripDraft,
  onDismissError,
  onEditTripDraft,
  onSubmitDayCount,
  onSubmitDestination,
  onSelectTripCandidate,
  pendingError,
  pendingProposal,
  pendingTripDraft,
  pendingTripDraftClarification,
  pendingTripSelection,
}: AgentPendingActionStackProps) {
  const proposalCardSlot = useSkinSlot("agent.proposalCard");

  return (
    <>
      {pendingTripSelection ? (
        <AgentTripSelectionCard
          candidates={pendingTripSelection.candidates}
          intentLabel={pendingTripSelection.intentLabel}
          onSelect={onSelectTripCandidate}
        />
      ) : null}

      {pendingTripDraftClarification?.clarification.requestedField ===
      "destination" ? (
        <AgentDestinationClarificationCard
          disabled={pendingTripDraftClarification.isSubmitting}
          error={pendingTripDraftClarification.error}
          isSubmitting={pendingTripDraftClarification.isSubmitting}
          onSubmit={onSubmitDestination}
          question={pendingTripDraftClarification.clarification.question}
        />
      ) : null}

      {pendingTripDraftClarification?.clarification.requestedField ===
      "dayCount" ? (
        <AgentDayCountClarificationCard
          disabled={pendingTripDraftClarification.isSubmitting}
          error={pendingTripDraftClarification.error}
          isSubmitting={pendingTripDraftClarification.isSubmitting}
          onSubmit={onSubmitDayCount}
          question={pendingTripDraftClarification.clarification.question}
        />
      ) : null}

      {pendingProposal ? (
        <>
          <AgentProposalConfirmationCard
            adapterId={proposalCardSlot.adapterId}
            disabled={pendingProposal.isApplying}
            isApplying={pendingProposal.isApplying}
            notice={pendingProposal.notice}
            onApply={onApplyProposal}
            onCancel={onCancelProposal}
            preview={pendingProposal.preview}
            requiresRegeneration={pendingProposal.requiresRegeneration}
            tripTitle={pendingProposal.tripTitle}
          />
          <AgentDebugDetails debug={pendingProposal.debug} expanded />
        </>
      ) : null}

      {pendingTripDraft ? (
        <>
          <AgentTripDraftCard
            disabled={pendingTripDraft.isCreating}
            draft={pendingTripDraft.draft}
            isCreating={pendingTripDraft.isCreating}
            notice={pendingTripDraft.notice}
            onCreate={onCreateTripDraft}
            onDiscard={onDiscardTripDraft}
            onEdit={onEditTripDraft}
          />
          <AgentDebugDetails debug={pendingTripDraft.debug} expanded />
        </>
      ) : null}

      {pendingError ? (
        <>
          <AgentErrorCard
            actionLabel={pendingError.actionLabel}
            detail={pendingError.detail}
            onActionPress={onDismissError}
            title={pendingError.title}
          />
          <AgentDebugDetails debug={pendingError.debug} expanded />
        </>
      ) : null}
    </>
  );
}
