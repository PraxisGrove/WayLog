import type { Trip, TripPlaceCategory } from "../trips/types";
import {
  type AgentUiEvent,
  createStageEvent,
  projectPiAgentEvent,
} from "./agent-ui-events";
import {
  type CloudRouteDecision,
  type CloudRoutePageContext,
  runCloudRouteSelector,
} from "./cloud-route-selector";
import {
  parseTripEditProposal,
  type TripEditProposal,
} from "./contracts/trip-edit-proposal-contract";
import {
  type AgentConversationRetryContext,
  type AgentConversationStorage,
  appendAgentConversationMessage,
  getAgentConversation,
  recordAgentConversationTurn,
  startNewAgentConversation,
} from "./conversations";
import type { AgentTripTargetCandidate } from "./global-trip-target";
import { type AgentHarnessPreviewTurn, runAgentHarnessTurn } from "./harness";
import { parsePiProxyPublicFailure } from "./pi-proxy-stream";
import type { WayLogPiAgentOptions } from "./pi-runtime";
import { createWayLogPiAgent } from "./pi-runtime";
import { isRequestedPlaceCandidate } from "./place-ambiguity";
import {
  type AgentFailure,
  AgentRuntimeFailure,
  beginAgentRuntimeAttempt,
  createAgentFailure,
} from "./runtime-lifecycle";
import { defaultAgentSkillRegistry, getAgentSkill } from "./skill-registry";
import type { AgentSkillId } from "./skill-types";
import {
  parseTripDraftSkillInput,
  tripDraftTerminatingToolParameters,
} from "./skills/trip-draft";
import { createWaylogQaContext } from "./skills/waylog-qa";
import {
  type AgentSourceReference,
  appendSourceReferences,
  readPublicSourceReferences,
} from "./source-references";
import type { AgentTripDraft, ReliableAgentTripDraft } from "./trip-draft";
import {
  applyTripDraftClarificationResponse,
  claimTripDraftContinuation,
  completeTripDraftContinuation,
  getTripDraftContinuation,
  releaseTripDraftContinuation,
  saveTripDraftContinuation,
  type TripDraftClarificationResponse,
  type TripDraftContinuation,
} from "./trip-draft-continuation";
import type {
  TripDraftSemantics,
  TripDraftTurnReference,
} from "./trip-draft-semantics";
import type { TripDraftClarificationCandidate } from "./trip-draft-skill-result";
import {
  parseTripDraftSkillTermination,
  type TripDraftSkillTermination,
} from "./trip-draft-skill-result";

type StreamFn = WayLogPiAgentOptions["streamFn"];
type AgentTool = NonNullable<
  NonNullable<WayLogPiAgentOptions["initialState"]>["tools"]
>[number];

const ANSWER_TOOL_NAME = "waylog_answer";
// 工具实现是受信任的装配依赖；模型可见权限只由这份固定 ID 列表授予。
const PROPOSAL_GENERATION_READ_TOOL_IDS = [
  "poi.search",
  "route.estimate",
  "weather.get",
  "web.search",
] as const;
const proposalGenerationReadToolIdSet = new Set<string>(
  PROPOSAL_GENERATION_READ_TOOL_IDS,
);
const activeTripDraftContinuationClaims = new Set<string>();

export type ProposalGenerationReadToolId =
  (typeof PROPOSAL_GENERATION_READ_TOOL_IDS)[number];

export type ProposalGenerationReadTool = {
  id: ProposalGenerationReadToolId;
  publicName: string;
  tool: AgentTool;
};

export type ProposalGenerationInput = {
  accountId: string;
  conversationId?: string;
  pageContext?: CloudRoutePageContext;
  selectedTrip?: Trip;
  userMessage: string;
  timeZone?: string;
};

export type ResumeTripDraftProposalGenerationInput = {
  accountId: string;
  clarificationId: string;
  value: TripDraftClarificationResponse["value"];
};

export type ResumeProposalGenerationInput = {
  accountId: string;
  conversationId: string;
  route: CloudRouteDecision;
  selectedTrip: Trip;
  turnId: string;
  userMessage: string;
};

export type RetryProposalGenerationInput = {
  accountId: string;
  conversationId: string;
  selectedTrip?: Trip;
  turnId: string;
};

export type ProposalGenerationDeps = {
  clock: () => string;
  ids?: {
    conversation?: () => string;
    attempt?: () => string;
    clarification?: () => string;
    message?: () => string;
    turn?: () => string;
  };
  onEvent?: (event: AgentUiEvent) => void;
  routeModel: StreamFn;
  resolveTrip?: (
    userMessage: string,
  ) =>
    | Promise<ProposalGenerationTripResolution>
    | ProposalGenerationTripResolution;
  resolveToolsForUserMessage?: (
    userMessage: string,
  ) => ProposalGenerationReadTool[];
  skillModel: StreamFn;
  skillModels?: Partial<Record<AgentSkillId, StreamFn>>;
  storage: AgentConversationStorage;
  tools: ProposalGenerationReadTool[];
};

export type ProposalGenerationTripResolution =
  | { status: "selected"; trip: Trip }
  | {
      candidates: AgentTripTargetCandidate[];
      reason: string;
      status: "ambiguous";
    }
  | { reason: string; status: "not_found" };

export type ProposalGenerationAnswer = {
  citations?: Array<{ title?: string; url?: string }>;
  sources?: AgentSourceReference[];
  text: string;
};

type WayLogQaSkillTermination =
  | { answer: ProposalGenerationAnswer; kind: "answer" }
  | { kind: "clarification"; message: string };

type ProposalGenerationResultBase = {
  attemptId: string;
  conversationId: string;
  events: AgentUiEvent[];
  route: CloudRouteDecision;
  turnId: string;
};

export type ProposalGenerationAnswerResult = ProposalGenerationResultBase & {
  answer: ProposalGenerationAnswer;
  resultType: "answer";
};

export type ProposalGenerationBuiltInResult = ProposalGenerationResultBase & {
  message: string;
  resultType: "clarification" | "out_of_scope";
};

export type ProposalGenerationTripDraftResult = ProposalGenerationResultBase & {
  draft: AgentTripDraft;
  message: string;
  resultType: "trip_draft";
};

export type ProposalGenerationTripDraftClarificationResult =
  ProposalGenerationResultBase & {
    clarification: TripDraftClarificationCandidate & {
      clarificationId: string;
      continuation: {
        conversationId: string;
        skillId: "trip.draft";
        turnId: string;
      };
    };
    message: string;
    resultType: "trip_draft_clarification";
    userMessage: string;
  };

export type ProposalGenerationTripEditResult = ProposalGenerationResultBase & {
  message: string;
  preview: AgentHarnessPreviewTurn;
  resultType: "trip_edit_proposal";
};

export type ProposalGenerationTripSelectionResult =
  ProposalGenerationResultBase & {
    candidates: AgentTripTargetCandidate[];
    message: string;
    resultType: "trip_selection_required";
    userMessage: string;
  };

export type ProposalGenerationFailureResult = Omit<
  ProposalGenerationResultBase,
  "route"
> & {
  error: string;
  failure: AgentFailure;
  resultType: "failure";
  retryable: boolean;
  route?: CloudRouteDecision;
  userMessage: string;
};

export type ProposalGenerationResult =
  | ProposalGenerationAnswerResult
  | ProposalGenerationBuiltInResult
  | ProposalGenerationTripDraftResult
  | ProposalGenerationTripDraftClarificationResult
  | ProposalGenerationTripEditResult
  | ProposalGenerationTripSelectionResult
  | ProposalGenerationFailureResult;

export async function resumeProposalGeneration(
  input: ResumeProposalGenerationInput,
  deps: ProposalGenerationDeps,
): Promise<ProposalGenerationTripEditResult | ProposalGenerationFailureResult> {
  const accountId = input.accountId.trim();
  const conversationId = input.conversationId.trim();
  const turnId = input.turnId.trim();
  const userMessage = input.userMessage.trim();

  if (
    !accountId ||
    !conversationId ||
    !turnId ||
    !userMessage ||
    input.route.routeKind !== "skill" ||
    input.route.skillId !== "itinerary.edit"
  ) {
    throw new Error("Proposal Generation continuation is invalid.");
  }

  validateReadTools(deps.tools);
  const events: AgentUiEvent[] = [];
  const emit = createPublicEventEmitter(events, deps.onEvent);
  const conversationDeps = {
    accountId,
    clock: deps.clock,
    ids: deps.ids,
    storage: deps.storage,
  };
  const persistedConversation = await getAgentConversation(
    conversationId,
    conversationDeps,
  );
  const persistedTurn = persistedConversation?.turns.find(
    (candidate) => candidate.id === turnId,
  );
  if (
    !persistedTurn ||
    persistedTurn.userMessage !== userMessage ||
    persistedTurn.status !== "place_selection"
  ) {
    throw new Error(
      "Proposal Generation continuation is stale or already handled.",
    );
  }
  const attemptId = deps.ids?.attempt?.() ?? createRuntimeId("agent-attempt");
  const runtimeAttempt = beginAgentRuntimeAttempt({
    accountId,
    attemptId,
    conversationId,
    turnId,
  });

  try {
    await recordAgentConversationTurn(
      {
        attemptId,
        conversationId,
        retryContext: { selectedTripId: input.selectedTrip.id },
        status: "running",
        turnId,
        userMessage,
      },
      conversationDeps,
    );
    const preview = await runSelectedItineraryEditSkill({
      emit,
      model: deps.skillModels?.["itinerary.edit"] ?? deps.skillModel,
      registerAbort: runtimeAttempt.registerAbort,
      selectedTrip: input.selectedTrip,
      tools: deps.tools,
      userMessage,
    });
    runtimeAttempt.throwIfCancelled();
    const message = `我生成了一份待确认的行程修改提案：${preview.proposal.summary}`;

    await appendAgentConversationMessage(
      {
        attemptId,
        conversationId,
        dedupeKey: `${turnId}:trip_edit_proposal`,
        role: "agent",
        text: message,
        turnId,
      },
      conversationDeps,
    );
    await recordAgentConversationTurn(
      {
        attemptId,
        conversationId,
        mode: "pi_cloud_routed",
        proposal: preview.proposal,
        reply: message,
        status: "previewed",
        tripId: input.selectedTrip.id,
        tripTitle: input.selectedTrip.title,
        turnId,
        userMessage,
      },
      conversationDeps,
    );

    return {
      attemptId,
      conversationId,
      events,
      message,
      preview,
      resultType: "trip_edit_proposal",
      route: input.route,
      turnId,
    };
  } catch (error) {
    const failure = resolveAttemptFailure(runtimeAttempt, error);
    return createRetryableFailure({
      attemptId,
      conversationDeps,
      conversationId,
      error: failure.message,
      failure,
      events,
      route: input.route,
      turnId,
      userMessage,
    });
  } finally {
    runtimeAttempt.complete();
  }
}

/**
 * Proposal Generation 的唯一公开 seam。自由文本先走云端 RouteSelector；
 * 只有命中的已实现 Skill 才能启动第二个 Pi run。
 */
export async function runProposalGeneration(
  input: ProposalGenerationInput,
  deps: ProposalGenerationDeps,
): Promise<ProposalGenerationResult> {
  return runProposalGenerationAttempt(input, deps);
}

export async function retryProposalGeneration(
  input: RetryProposalGenerationInput,
  deps: ProposalGenerationDeps,
): Promise<ProposalGenerationResult> {
  const accountId = input.accountId.trim();
  const conversationId = input.conversationId.trim();
  const turnId = input.turnId.trim();
  if (!accountId || !conversationId || !turnId) {
    throw new Error("Proposal Generation retry identity is invalid.");
  }
  const conversation = await getAgentConversation(conversationId, {
    accountId,
    storage: deps.storage,
  });
  const turn = conversation?.turns.find((candidate) => candidate.id === turnId);
  if (!turn?.userMessage) {
    throw new Error("Proposal Generation retry source was not found.");
  }
  if (turn.status !== "failed" && turn.status !== "interrupted") {
    throw new Error("Proposal Generation turn is not retryable.");
  }
  if (turn.failure && !turn.failure.retryable) {
    throw new Error("Proposal Generation failure is not retryable.");
  }
  const retryDeps = deps.resolveToolsForUserMessage
    ? {
        ...deps,
        tools: deps.resolveToolsForUserMessage(turn.userMessage),
      }
    : deps;
  const selectedTripId = turn.retryContext?.selectedTripId;
  if (selectedTripId && input.selectedTrip?.id !== selectedTripId) {
    throw new Error(
      "Proposal Generation retry context no longer matches its Trip.",
    );
  }
  const tripDraftClarification = turn.retryContext?.tripDraftClarification;
  if (tripDraftClarification) {
    return resumeTripDraftProposalGeneration(
      {
        accountId,
        clarificationId: tripDraftClarification.clarificationId,
        value: tripDraftClarification.value,
      },
      retryDeps,
    );
  }

  return runProposalGenerationAttempt(
    {
      accountId,
      conversationId,
      pageContext:
        turn.retryContext?.surface === "agent_conversation"
          ? {
              hasSelectedTrip: Boolean(turn.retryContext.hasSelectedTrip),
              surface: "agent_conversation",
            }
          : undefined,
      selectedTrip: input.selectedTrip,
      timeZone: turn.retryContext?.timeZone,
      userMessage: turn.userMessage,
    },
    retryDeps,
    { skipUserMessage: true, turnId },
  );
}

async function runProposalGenerationAttempt(
  input: ProposalGenerationInput,
  deps: ProposalGenerationDeps,
  retry: { skipUserMessage: boolean; turnId: string } | undefined = undefined,
): Promise<ProposalGenerationResult> {
  const accountId = input.accountId.trim();
  const userMessage = input.userMessage.trim();

  if (!accountId || !userMessage) {
    throw new Error("Proposal Generation requires accountId and userMessage.");
  }

  validateReadTools(deps.tools);
  const events: AgentUiEvent[] = [];
  const emit = createPublicEventEmitter(events, deps.onEvent);
  const conversationDeps = {
    accountId,
    clock: deps.clock,
    ids: deps.ids,
    storage: deps.storage,
  };
  const existingConversation = input.conversationId
    ? await getAgentConversation(input.conversationId, conversationDeps)
    : undefined;
  const conversationId =
    existingConversation?.id ??
    input.conversationId?.trim() ??
    deps.ids?.conversation?.() ??
    createRuntimeId("agent-conversation");
  const turnId =
    retry?.turnId ?? deps.ids?.turn?.() ?? createRuntimeId("agent-turn");
  const attemptId = deps.ids?.attempt?.() ?? createRuntimeId("agent-attempt");
  const runtimeAttempt = beginAgentRuntimeAttempt({
    accountId,
    attemptId,
    conversationId,
    turnId,
  });
  const turnReference: TripDraftTurnReference = {
    referenceTime: deps.clock(),
    timeZone: input.timeZone?.trim() || "Asia/Shanghai",
  };

  try {
    const conversation =
      existingConversation ??
      (await startNewAgentConversation({
        ...conversationDeps,
        ids: {
          ...deps.ids,
          conversation: () => conversationId,
        },
      }));
    await recordAgentConversationTurn(
      {
        attemptId,
        conversationId: conversation.id,
        retryContext: {
          hasSelectedTrip: input.pageContext?.hasSelectedTrip,
          selectedTripId: input.selectedTrip?.id,
          surface: input.pageContext?.surface,
          timeZone: turnReference.timeZone,
        },
        status: "running",
        turnId,
        userMessage,
      },
      conversationDeps,
    );
    if (!retry?.skipUserMessage) {
      await appendAgentConversationMessage(
        {
          attemptId,
          conversationId: conversation.id,
          dedupeKey: `${turnId}:user`,
          role: "user",
          text: userMessage,
          turnId,
        },
        conversationDeps,
      );
    }

    let route: CloudRouteDecision | undefined;

    try {
      route = await runCloudRouteSelector({
        model: deps.routeModel,
        onEvent: emit,
        pageContext: input.pageContext,
        registerAbort: runtimeAttempt.registerAbort,
        userMessage,
      });
      runtimeAttempt.throwIfCancelled();

      if (route.routeKind === "built_in") {
        return await finishBuiltInRoute({
          conversationDeps,
          conversationId: conversation.id,
          attemptId,
          emit,
          events,
          route,
          turnId,
          userMessage,
        });
      }

      if (route.skillId === "trip.draft") {
        const termination = await runSelectedTripDraftSkill({
          emit,
          model: deps.skillModels?.["trip.draft"] ?? deps.skillModel,
          registerAbort: runtimeAttempt.registerAbort,
          tools: deps.tools,
          turnReference,
          userMessage,
        });
        runtimeAttempt.throwIfCancelled();
        if (termination.kind === "clarification") {
          return finishTripDraftClarification({
            accountId,
            candidate: termination.clarification,
            conversationDeps,
            conversationId: conversation.id,
            attemptId,
            events,
            ids: deps.ids,
            route,
            semantics: termination.semantics,
            storage: deps.storage,
            turnId,
            turnReference,
            userMessage,
          });
        }
        const draft = termination.draft;
        const message = `我用受控 Trip Draft ReAct loop 生成了一份「${draft.title}」草案。你可以直接应用，也可以进入新建行程页继续编辑。`;

        await appendAgentConversationMessage(
          {
            attemptId,
            conversationId: conversation.id,
            dedupeKey: `${turnId}:trip_draft`,
            role: "agent",
            text: message,
            turnId,
          },
          conversationDeps,
        );
        await recordAgentConversationTurn(
          {
            attemptId,
            conversationId: conversation.id,
            mode: "pi_cloud_routed",
            reply: message,
            status: "previewed",
            turnId,
            userMessage,
          },
          conversationDeps,
        );

        return {
          attemptId,
          conversationId: conversation.id,
          draft,
          events,
          message,
          resultType: "trip_draft",
          route,
          turnId,
        };
      }

      if (route.skillId === "itinerary.edit") {
        let selectedTrip = input.selectedTrip;

        if (!selectedTrip && deps.resolveTrip) {
          const resolution = await deps.resolveTrip(userMessage);
          runtimeAttempt.throwIfCancelled();

          if (resolution.status === "selected") {
            selectedTrip = resolution.trip;
          } else if (resolution.status === "ambiguous") {
            return await finishTripSelectionRoute({
              attemptId,
              candidates: resolution.candidates,
              conversationDeps,
              conversationId: conversation.id,
              emit,
              events,
              route,
              turnId,
              userMessage,
            });
          } else {
            return await createRetryableFailure({
              attemptId,
              conversationDeps,
              conversationId: conversation.id,
              error: `${resolution.reason}。请说明要修改哪条行程后重试。`,
              failure: createAgentFailure("internal", {
                code: "TRIP_TARGET_NOT_FOUND",
                message: `${resolution.reason}。请说明要修改哪条行程后重试。`,
              }),
              events,
              route,
              turnId,
              userMessage,
            });
          }
        }

        if (!selectedTrip) {
          return await createRetryableFailure({
            attemptId,
            conversationDeps,
            conversationId: conversation.id,
            error: "请先选择需要修改的行程后重试。",
            failure: createAgentFailure("internal", {
              code: "TRIP_SELECTION_REQUIRED",
              message: "请先选择需要修改的行程后重试。",
            }),
            events,
            route,
            turnId,
            userMessage,
          });
        }

        const preview = await runSelectedItineraryEditSkill({
          emit,
          model: deps.skillModels?.["itinerary.edit"] ?? deps.skillModel,
          registerAbort: runtimeAttempt.registerAbort,
          selectedTrip,
          tools: deps.tools,
          userMessage,
        });
        runtimeAttempt.throwIfCancelled();
        const message = `我生成了一份待确认的行程修改提案：${preview.proposal.summary}`;

        await appendAgentConversationMessage(
          {
            attemptId,
            conversationId: conversation.id,
            dedupeKey: `${turnId}:trip_edit_proposal`,
            role: "agent",
            text: message,
            turnId,
          },
          conversationDeps,
        );
        await recordAgentConversationTurn(
          {
            attemptId,
            conversationId: conversation.id,
            mode: "pi_cloud_routed",
            proposal: preview.proposal,
            reply: message,
            status: "previewed",
            tripId: selectedTrip.id,
            tripTitle: selectedTrip.title,
            turnId,
            userMessage,
          },
          conversationDeps,
        );

        return {
          attemptId,
          conversationId: conversation.id,
          events,
          message,
          preview,
          resultType: "trip_edit_proposal",
          route,
          turnId,
        };
      }

      if (route.skillId !== "waylog.qa") {
        return await createRetryableFailure({
          attemptId,
          conversationDeps,
          conversationId: conversation.id,
          error: `Skill ${route.skillId} 尚未接入两阶段 Pi Runtime。`,
          failure: createAgentFailure("skill_unavailable"),
          events,
          route,
          turnId,
          userMessage,
        });
      }

      const qaTermination = await runSelectedWayLogQaSkill({
        emit,
        model: deps.skillModel,
        registerAbort: runtimeAttempt.registerAbort,
        selectedTrip: input.selectedTrip,
        tools: deps.tools,
        userMessage,
      });
      runtimeAttempt.throwIfCancelled();

      if (qaTermination.kind === "clarification") {
        const message = qaTermination.message;
        emit(createStageEvent("completed"));
        await appendAgentConversationMessage(
          {
            attemptId,
            conversationId: conversation.id,
            dedupeKey: `${turnId}:clarification`,
            role: "agent",
            text: message,
            turnId,
          },
          conversationDeps,
        );
        await recordAgentConversationTurn(
          {
            attemptId,
            conversationId: conversation.id,
            mode: "pi_cloud_routed",
            reply: message,
            status: "failed",
            turnId,
            userMessage,
          },
          conversationDeps,
        );

        return {
          attemptId,
          conversationId: conversation.id,
          events,
          message,
          resultType: "clarification",
          route,
          turnId,
        };
      }

      const { answer } = qaTermination;

      await appendAgentConversationMessage(
        {
          attemptId,
          conversationId: conversation.id,
          dedupeKey: `${turnId}:answer`,
          role: "agent",
          text: answer.text,
          turnId,
        },
        conversationDeps,
      );
      await recordAgentConversationTurn(
        {
          attemptId,
          conversationId: conversation.id,
          mode: "pi_cloud_routed",
          reply: answer.text,
          status: "chat",
          turnId,
          userMessage,
        },
        conversationDeps,
      );

      return {
        answer,
        attemptId,
        conversationId: conversation.id,
        events,
        resultType: "answer",
        route,
        turnId,
      };
    } catch (error) {
      const failure = resolveAttemptFailure(runtimeAttempt, error);
      return createRetryableFailure({
        attemptId,
        conversationDeps,
        conversationId: conversation.id,
        error: failure.message,
        failure,
        events,
        route,
        turnId,
        userMessage,
      });
    }
  } finally {
    runtimeAttempt.complete();
  }
}

export async function resumeTripDraftProposalGeneration(
  input: ResumeTripDraftProposalGenerationInput,
  deps: ProposalGenerationDeps,
): Promise<ProposalGenerationResult> {
  const accountId = input.accountId.trim();
  const clarificationId = input.clarificationId.trim();
  if (!accountId || !clarificationId) {
    throw new Error("Trip Draft clarification continuation is invalid.");
  }
  const claimKey = `${accountId}:${clarificationId}`;
  if (activeTripDraftContinuationClaims.has(claimKey)) {
    throw new Error("Trip Draft clarification is already being submitted.");
  }
  activeTripDraftContinuationClaims.add(claimKey);
  try {
    return await resumeClaimedTripDraftProposalGeneration(
      { ...input, accountId, clarificationId },
      deps,
    );
  } finally {
    activeTripDraftContinuationClaims.delete(claimKey);
  }
}

async function resumeClaimedTripDraftProposalGeneration(
  input: ResumeTripDraftProposalGenerationInput,
  deps: ProposalGenerationDeps,
): Promise<ProposalGenerationResult> {
  const accountId = input.accountId;
  const clarificationId = input.clarificationId;
  validateReadTools(deps.tools);
  const continuation = await getTripDraftContinuation(
    accountId,
    clarificationId,
    deps.storage,
  );
  if (!continuation) {
    throw new Error("Trip Draft clarification continuation was not found.");
  }
  const applied = applyTripDraftClarificationResponse(
    continuation,
    { clarificationId, value: input.value },
    deps.clock(),
  );
  if (!applied.ok) throw new Error(applied.error);

  const events: AgentUiEvent[] = [];
  const emit = createPublicEventEmitter(events, deps.onEvent);
  const conversationDeps = {
    accountId,
    clock: deps.clock,
    ids: deps.ids,
    storage: deps.storage,
  };
  const route: CloudRouteDecision = {
    confidence: applied.data.semantics.confidence,
    missingSlots: [],
    routeKind: "skill",
    scope: "in_scope",
    skillId: "trip.draft",
  };
  const attemptId = deps.ids?.attempt?.() ?? createRuntimeId("agent-attempt");
  const runtimeAttempt = beginAgentRuntimeAttempt({
    accountId,
    attemptId,
    conversationId: continuation.conversationId,
    turnId: continuation.turnId,
  });
  let claimedContinuation: TripDraftContinuation | undefined;

  try {
    claimedContinuation = await claimTripDraftContinuation(
      continuation,
      deps.clock(),
      deps.storage,
    );
    await recordAgentConversationTurn(
      {
        attemptId,
        conversationId: continuation.conversationId,
        status: "running",
        turnId: continuation.turnId,
        userMessage: continuation.originalInput,
      },
      conversationDeps,
    );
    const termination = await runSelectedTripDraftSkill({
      emit,
      model: deps.skillModels?.["trip.draft"] ?? deps.skillModel,
      registerAbort: runtimeAttempt.registerAbort,
      tools: deps.tools,
      turnReference: applied.data.turnReference,
      userMessage: applied.data.originalInput,
      validatedSemantics: applied.data.semantics,
    });
    runtimeAttempt.throwIfCancelled();
    if (termination.kind === "clarification") {
      await completeTripDraftContinuation(claimedContinuation, deps.storage);
      return finishTripDraftClarification({
        accountId,
        attemptId,
        candidate: termination.clarification,
        conversationDeps,
        conversationId: continuation.conversationId,
        events,
        ids: deps.ids,
        route,
        semantics: termination.semantics,
        storage: deps.storage,
        turnId: continuation.turnId,
        turnReference: applied.data.turnReference,
        userMessage: applied.data.originalInput,
      });
    }
    await completeTripDraftContinuation(claimedContinuation, deps.storage);
    const message = `我生成了一份「${termination.draft.title}」行程草案，请先预览确认。`;
    await appendAgentConversationMessage(
      {
        attemptId,
        conversationId: continuation.conversationId,
        dedupeKey: `${continuation.turnId}:trip_draft`,
        role: "agent",
        text: message,
        turnId: continuation.turnId,
      },
      conversationDeps,
    );
    await recordAgentConversationTurn(
      {
        attemptId,
        conversationId: continuation.conversationId,
        mode: "pi_cloud_routed",
        reply: message,
        status: "previewed",
        turnId: continuation.turnId,
        userMessage: continuation.originalInput,
      },
      conversationDeps,
    );
    return {
      attemptId,
      conversationId: continuation.conversationId,
      draft: termination.draft,
      events,
      message,
      resultType: "trip_draft",
      route,
      turnId: continuation.turnId,
    };
  } catch (error) {
    if (claimedContinuation) {
      await releaseTripDraftContinuation(claimedContinuation, deps.storage);
    }
    const failure = resolveAttemptFailure(runtimeAttempt, error);
    return createRetryableFailure({
      attemptId,
      conversationDeps,
      conversationId: continuation.conversationId,
      error: failure.message,
      failure,
      events,
      route,
      retryContext: {
        tripDraftClarification: {
          clarificationId,
          value: input.value,
        },
      },
      turnId: continuation.turnId,
      userMessage: continuation.originalInput,
    });
  } finally {
    runtimeAttempt.complete();
  }
}

async function finishTripSelectionRoute(input: {
  attemptId: string;
  candidates: AgentTripTargetCandidate[];
  conversationDeps: Parameters<typeof recordAgentConversationTurn>[1];
  conversationId: string;
  emit: (event: AgentUiEvent) => void;
  events: AgentUiEvent[];
  route: CloudRouteDecision;
  turnId: string;
  userMessage: string;
}): Promise<ProposalGenerationTripSelectionResult> {
  const message = "我还需要确认一下目标行程。选好后会继续处理这条请求。";
  input.emit(createStageEvent("completed"));
  await appendAgentConversationMessage(
    {
      attemptId: input.attemptId,
      conversationId: input.conversationId,
      dedupeKey: `${input.turnId}:trip_selection`,
      role: "agent",
      text: message,
      turnId: input.turnId,
    },
    input.conversationDeps,
  );
  await recordAgentConversationTurn(
    {
      attemptId: input.attemptId,
      conversationId: input.conversationId,
      mode: "pi_cloud_routed",
      reply: message,
      status: "place_selection",
      turnId: input.turnId,
      userMessage: input.userMessage,
    },
    input.conversationDeps,
  );

  return {
    attemptId: input.attemptId,
    candidates: input.candidates,
    conversationId: input.conversationId,
    events: input.events,
    message,
    resultType: "trip_selection_required",
    route: input.route,
    turnId: input.turnId,
    userMessage: input.userMessage,
  };
}

async function runSelectedItineraryEditSkill(input: {
  emit: (event: AgentUiEvent) => void;
  model: StreamFn;
  registerAbort?: (abort: () => void) => () => void;
  selectedTrip: Trip;
  tools: ProposalGenerationReadTool[];
  userMessage: string;
}): Promise<AgentHarnessPreviewTurn> {
  let proposal: unknown;
  const trustedPois = new Map<string, VerifiedPoiCandidate>();
  const poiToolEntry = input.tools.find((entry) => entry.id === "poi.search");
  const poiTool: AgentTool | undefined = poiToolEntry
    ? createBoundedPoiSearchTool({
        budgetError: "itinerary.edit exceeded its poi.search tool-call budget.",
        maxCalls: 3,
        onCandidates: (candidates, params) => {
          const query = isRecord(params) ? readString(params.query) : undefined;
          if (!query) return [];
          const exactCandidates: VerifiedPoiCandidate[] = [];

          for (const candidate of candidates) {
            const verified = parseVerifiedPoiCandidate(candidate);
            if (
              verified &&
              isRequestedPlaceCandidate(
                readString(verified.name) ?? "",
                query,
                input.userMessage,
              )
            ) {
              trustedPois.set(getPoiIdentity(verified), verified);
              exactCandidates.push(verified);
            }
          }

          return exactCandidates;
        },
        sourceTool: poiToolEntry.tool,
      })
    : undefined;
  const proposalTool: AgentTool = {
    description:
      "Return the validated Trip edit proposal preview and terminate this Skill run.",
    execute: async (_toolCallId, params) => {
      const parsedProposal =
        isRecord(params) && "proposal" in params
          ? parseTripEditProposal(params.proposal)
          : undefined;

      if (!parsedProposal?.ok) {
        throw new Error("waylog_trip_edit_proposal requires a valid proposal.");
      }

      const trustedProposal = canonicalizeVerifiedAddedPlaces(
        parsedProposal.data,
        input.selectedTrip,
        trustedPois,
      );

      if (!trustedProposal) {
        throw new Error(
          "itinerary.edit cannot add a place that is absent from the verified Trip context.",
        );
      }

      proposal = trustedProposal;

      return {
        content: [{ text: trustedProposal.summary, type: "text" }],
        details: { proposal: trustedProposal },
        terminate: true,
      };
    },
    label: "完成行程修改提案",
    name: "waylog_trip_edit_proposal",
    parameters: {
      additionalProperties: false,
      properties: { proposal: { type: "object" } },
      required: ["proposal"],
      type: "object",
    },
  };
  const agent = await createWayLogPiAgent({
    initialState: {
      model: createSkillModelProfile(),
      systemPrompt: "",
      tools: [...(poiTool ? [poiTool] : []), proposalTool],
    },
    streamFn: input.model,
  });

  agent.subscribe((event) => {
    const publicEvent = projectPiAgentEvent(event, new Map());

    if (publicEvent) input.emit(publicEvent);
  });
  const unregisterAbort = input.registerAbort?.(() => agent.abort());
  try {
    await agent.prompt(
      JSON.stringify({
        kind: "waylog_itinerary_edit_request",
        selectedTrip: createSelectedTripContext(input.selectedTrip),
        userMessage: input.userMessage,
      }),
    );
  } finally {
    unregisterAbort?.();
  }

  if (!proposal) {
    throw new Error(
      agent.state.errorMessage ||
        "Pi Skill run ended without a valid waylog_trip_edit_proposal terminating tool call.",
    );
  }

  const previewResult = await runAgentHarnessTurn({
    model: () => proposal,
    trip: input.selectedTrip,
    userMessage: input.userMessage,
  });

  if (!previewResult.ok) {
    throw new Error(previewResult.error.message);
  }

  if (previewResult.data.status !== "preview") {
    throw new Error(
      "Trip edit proposal unexpectedly crossed the preview seam.",
    );
  }

  return previewResult.data;
}

async function runSelectedTripDraftSkill(input: {
  emit: (event: AgentUiEvent) => void;
  model: StreamFn;
  registerAbort?: (abort: () => void) => () => void;
  tools: ProposalGenerationReadTool[];
  turnReference: TripDraftTurnReference;
  userMessage: string;
  validatedSemantics?: TripDraftSemantics;
}): Promise<TripDraftSkillTermination> {
  let termination: TripDraftSkillTermination | undefined;
  const skillResult = getAgentSkill(defaultAgentSkillRegistry, "trip.draft");
  if (!skillResult.ok) throw new Error(skillResult.error.message);
  const allowedToolIds = new Set(skillResult.data.allowedRuntimeTools);
  const trustedPois = new Map<string, TrustedTripDraftPoi>();
  let toolCallCount = 0;
  let poiToolFailed = false;
  let schemaFailed = false;
  let toolBudgetExceeded = false;
  const selectedTools = input.tools
    .filter(
      (entry) => entry.id === "poi.search" && allowedToolIds.has(entry.id),
    )
    .map((entry) => ({
      ...entry,
      tool: createBoundedPoiSearchTool({
        budgetError: "trip.draft exceeded its read-only tool-call budget.",
        maxCalls: skillResult.data.maxToolCalls,
        onCall: (count) => {
          toolCallCount = count;
        },
        onCandidates: (candidates, params) => {
          const queryText = isRecord(params)
            ? [readString(params.query), readString(params.regionText)]
                .filter(Boolean)
                .join(" ")
            : "";
          for (const candidate of candidates) {
            trustedPois.set(getPoiIdentity(candidate), {
              candidate,
              queryText,
            });
          }
          return undefined;
        },
        sourceTool: entry.tool,
      }),
    }));
  const draftTool: AgentTool = {
    description:
      "Return exactly one validated TripDraft or Clarification result and terminate this Skill run.",
    execute: async (_toolCallId, params) => {
      if (!isRecord(params) || !("result" in params)) {
        throw new Error("waylog_trip_draft requires a structured result.");
      }
      const parsed = parseTripDraftSkillTermination(
        params.result,
        input.turnReference,
      );
      if (!parsed.ok) throw new Error(parsed.error);
      let accepted: TripDraftSkillTermination;
      if (parsed.data.kind === "trip_draft") {
        const trustedDraft = canonicalizeTripDraftPois(
          parsed.data.draft,
          trustedPois,
          parsed.data.semantics,
        );
        if (!trustedDraft) {
          throw new Error(
            "trip.draft requires verified poi.search results for every draft place.",
          );
        }
        accepted = { ...parsed.data, draft: trustedDraft };
      } else {
        accepted = parsed.data;
      }
      termination = accepted;

      return {
        content: [
          {
            text:
              accepted.kind === "trip_draft"
                ? accepted.draft.title
                : accepted.clarification.question,
            type: "text",
          },
        ],
        details: { result: accepted },
        terminate: true,
      };
    },
    label: "完成行程草案",
    name: "waylog_trip_draft",
    parameters: tripDraftTerminatingToolParameters,
  };
  const agent = await createWayLogPiAgent({
    afterToolCall: async ({ isError, toolCall }) => {
      if (!isError) return undefined;
      if (toolCall.name === "poi.search" && !toolBudgetExceeded) {
        poiToolFailed = true;
      }
      if (toolCall.name === "waylog_trip_draft") schemaFailed = true;
      return toolCall.name === "poi.search" ||
        toolCall.name === "waylog_trip_draft"
        ? { terminate: true }
        : undefined;
    },
    beforeToolCall: async ({ toolCall }) => {
      if (
        toolCall.name === "poi.search" &&
        toolCallCount >= skillResult.data.maxToolCalls
      ) {
        toolBudgetExceeded = true;
        return {
          block: true,
          reason: "trip.draft reached its read-only tool-call budget.",
          terminate: true,
        };
      }
      return undefined;
    },
    initialState: {
      model: createSkillModelProfile(),
      systemPrompt: "",
      tools: [...selectedTools.map(({ tool }) => tool), draftTool],
    },
    streamFn: input.model,
  });

  agent.subscribe((event) => {
    const publicEvent = projectPiAgentEvent(
      event,
      new Map(
        selectedTools.map((entry) => [entry.tool.name, entry.publicName]),
      ),
    );

    if (publicEvent) input.emit(publicEvent);
  });
  const promptInput = parseTripDraftSkillInput({
    kind: input.validatedSemantics
      ? "waylog_trip_draft_continuation"
      : "waylog_trip_draft_request",
    originalInput: input.userMessage,
    turnReference: input.turnReference,
    validatedSemantics: input.validatedSemantics,
  });
  if (!promptInput.ok) throw new Error(promptInput.error);
  const unregisterAbort = input.registerAbort?.(() => agent.abort());
  try {
    await agent.prompt(JSON.stringify(promptInput.data));
  } finally {
    unregisterAbort?.();
  }

  if (!termination) {
    if (toolBudgetExceeded) {
      throw new PublicRetryableAgentError(
        "地点检索次数已达上限，原消息已保留，请重试。",
      );
    }
    if (poiToolFailed) {
      throw new PublicRetryableAgentError(
        "地点搜索暂时不可用，原消息已保留，请重试。",
      );
    }
    if (schemaFailed) {
      throw new PublicRetryableAgentError(
        "行程草案未通过可靠性校验，原消息已保留，请重试。",
      );
    }
    throw new Error(
      agent.state.errorMessage ||
        "Pi Skill run ended without a valid waylog_trip_draft terminating tool call.",
    );
  }

  return termination;
}

async function finishTripDraftClarification(input: {
  accountId: string;
  attemptId: string;
  candidate: TripDraftClarificationCandidate;
  conversationDeps: Parameters<typeof recordAgentConversationTurn>[1];
  conversationId: string;
  events: AgentUiEvent[];
  ids?: ProposalGenerationDeps["ids"];
  route: CloudRouteDecision;
  semantics: TripDraftSemantics;
  storage: AgentConversationStorage;
  turnId: string;
  turnReference: TripDraftTurnReference;
  userMessage: string;
}): Promise<ProposalGenerationTripDraftClarificationResult> {
  const clarificationId =
    input.ids?.clarification?.() ?? createRuntimeId("trip-draft-clarification");
  const expiresAt = new Date(
    Date.parse(input.turnReference.referenceTime) + 24 * 60 * 60 * 1_000,
  ).toISOString();
  const continuation: TripDraftContinuation = {
    accountId: input.accountId,
    clarificationId,
    conversationId: input.conversationId,
    expiresAt,
    originalInput: input.userMessage,
    question: input.candidate.question,
    requestedField: input.candidate.requestedField,
    responseContract: input.candidate.responseContract,
    semantics: input.semantics,
    status: "active",
    turnId: input.turnId,
    turnReference: input.turnReference,
  };
  await saveTripDraftContinuation(continuation, input.storage);
  await appendAgentConversationMessage(
    {
      attemptId: input.attemptId,
      conversationId: input.conversationId,
      dedupeKey: `${input.turnId}:trip_draft_clarification:${clarificationId}`,
      role: "agent",
      text: input.candidate.question,
      turnId: input.turnId,
    },
    input.conversationDeps,
  );
  await recordAgentConversationTurn(
    {
      attemptId: input.attemptId,
      conversationId: input.conversationId,
      mode: "pi_cloud_routed",
      reply: input.candidate.question,
      status: "requested",
      turnId: input.turnId,
      userMessage: input.userMessage,
    },
    input.conversationDeps,
  );

  return {
    attemptId: input.attemptId,
    clarification: {
      ...input.candidate,
      clarificationId,
      continuation: {
        conversationId: input.conversationId,
        skillId: "trip.draft",
        turnId: input.turnId,
      },
    },
    conversationId: input.conversationId,
    events: input.events,
    message: input.candidate.question,
    resultType: "trip_draft_clarification",
    route: input.route,
    turnId: input.turnId,
    userMessage: input.userMessage,
  };
}

function canonicalizeTripDraftPois(
  draft: ReliableAgentTripDraft,
  trustedPois: ReadonlyMap<string, TrustedTripDraftPoi>,
  semantics: TripDraftSemantics,
): ReliableAgentTripDraft | undefined {
  if (trustedPois.size === 0) return undefined;
  let itemCount = 0;
  const days = draft.days.map((day) => {
    const items = day.items.map((item) => {
      itemCount += 1;
      const identity = getPoiIdentity(
        item as unknown as Record<string, unknown>,
      );
      const provenance = trustedPois.get(identity);
      if (
        !provenance ||
        !isPoiGeographicallyConsistent(provenance, semantics)
      ) {
        return undefined;
      }
      const trusted = provenance.candidate;
      const name = readString(trusted.name);
      const provider = readString(trusted.provider);
      const providerPlaceId = readString(trusted.providerPlaceId);
      if (!name || !provider || !providerPlaceId) return undefined;

      return {
        ...item,
        address: readString(trusted.address),
        area: readString(trusted.area),
        category: readTripPlaceCategory(trusted.category),
        latitude: readFiniteNumber(trusted.latitude),
        longitude: readFiniteNumber(trusted.longitude),
        placeName: name,
        poiType: readString(trusted.poiType),
        provider,
        providerPlaceId,
        title: name,
      };
    });
    if (items.some((item) => !item)) return undefined;
    return { ...day, items: items as typeof day.items };
  });

  return itemCount > 0 && days.every(Boolean)
    ? { ...draft, days: days as typeof draft.days }
    : undefined;
}

type TrustedTripDraftPoi = {
  candidate: Record<string, unknown>;
  queryText: string;
};

const geographicAliasCanonicalNames: Readonly<Record<string, string>> = {
  bangkok: "曼谷",
  beijing: "北京",
  hongkong: "香港",
  kyoto: "京都",
  london: "伦敦",
  losangeles: "洛杉矶",
  macau: "澳门",
  newyork: "纽约",
  osaka: "大阪",
  paris: "巴黎",
  seoul: "首尔",
  shanghai: "上海",
  singapore: "新加坡",
  taipei: "台北",
  tokyo: "东京",
};

function isPoiGeographicallyConsistent(
  provenance: TrustedTripDraftPoi,
  semantics: TripDraftSemantics,
): boolean {
  return isTripDraftPoiGeographicallyConsistent(
    provenance.candidate,
    provenance.queryText,
    semantics,
  );
}

export function isTripDraftPoiGeographicallyConsistent(
  candidate: Readonly<Record<string, unknown>>,
  queryText: string,
  semantics: TripDraftSemantics,
): boolean {
  const broadScopes = [semantics.destination, ...semantics.cities]
    .map(normalizeGeographicText)
    .filter(Boolean);
  const destinationScope = normalizeGeographicText(semantics.destination);
  const cityScopes = semantics.cities
    .map(normalizeGeographicText)
    .filter(
      (scope) => Boolean(scope) && !textsOverlap(scope, destinationScope),
    );
  const localScopes = cityScopes.length > 0 ? cityScopes : [destinationScope];
  const query = normalizeGeographicText(queryText);
  const candidateLocation = normalizeGeographicText(
    [
      readString(candidate.city),
      readString(candidate.area),
      readString(candidate.address),
    ]
      .filter(Boolean)
      .join(" "),
  );

  return (
    broadScopes.some((scope) => textsOverlap(query, scope)) &&
    localScopes.some((scope) => textsOverlap(candidateLocation, scope))
  );
}

function normalizeGeographicText(value: string | null | undefined): string {
  const normalized = (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\s\p{P}\p{S}]/gu, "")
    .replace(
      /(特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|省|市|都)$/u,
      "",
    );
  return Object.entries(geographicAliasCanonicalNames).reduce(
    (result, [alias, canonical]) => result.replaceAll(alias, canonical),
    normalized,
  );
}

function textsOverlap(left: string, right: string): boolean {
  return Boolean(
    left && right && (left.includes(right) || right.includes(left)),
  );
}

function readTrustedPoiCandidates(
  toolResult: unknown,
): Record<string, unknown>[] {
  if (!isRecord(toolResult)) return [];
  const details = toolResult.details;
  const detailCandidates = isRecord(details)
    ? Array.isArray(details.candidates)
      ? details.candidates
      : isRecord(details.result) &&
          isRecord(details.result.data) &&
          Array.isArray(details.result.data.candidates)
        ? details.result.data.candidates
        : []
    : [];
  const contentCandidates = Array.isArray(toolResult.content)
    ? toolResult.content.flatMap((content) => {
        if (!isRecord(content) || content.type !== "text") return [];
        const text = readString(content.text);
        if (!text) return [];
        try {
          const envelope = JSON.parse(text) as unknown;
          return isRecord(envelope) &&
            envelope.kind === "untrusted_tool_data" &&
            envelope.toolName === "poi.search" &&
            isRecord(envelope.data) &&
            Array.isArray(envelope.data.candidates)
            ? envelope.data.candidates
            : [];
        } catch {
          return [];
        }
      })
    : [];
  const candidates = [...detailCandidates, ...contentCandidates];

  return candidates.filter(
    (candidate): candidate is Record<string, unknown> => {
      if (!isRecord(candidate)) return false;
      const provider = readString(candidate.provider);
      return (
        (provider === "amap" || provider === "poi_cache") &&
        Boolean(readString(candidate.providerPlaceId)) &&
        Boolean(readString(candidate.name))
      );
    },
  );
}

function createBoundedPoiSearchTool(input: {
  budgetError: string;
  maxCalls: number;
  onCall?: (count: number) => void;
  onCandidates: (
    candidates: Record<string, unknown>[],
    params: unknown,
  ) => Record<string, unknown>[] | undefined;
  sourceTool: AgentTool;
}): AgentTool {
  let callCount = 0;

  return {
    ...input.sourceTool,
    execute: async (...args: Parameters<AgentTool["execute"]>) => {
      callCount += 1;
      input.onCall?.(callCount);
      if (callCount > input.maxCalls) {
        throw new Error(input.budgetError);
      }
      const result = await input.sourceTool.execute(...args);
      const selectedCandidates = input.onCandidates(
        readTrustedPoiCandidates(result),
        args[1],
      );
      return selectedCandidates
        ? replacePoiCandidatesInToolResult(result, selectedCandidates)
        : result;
    },
  };
}

function replacePoiCandidatesInToolResult<T>(
  toolResult: T,
  candidates: Record<string, unknown>[],
): T {
  if (!isRecord(toolResult) || !Array.isArray(toolResult.content)) {
    return toolResult;
  }

  return Object.assign({}, toolResult, {
    content: toolResult.content.map((content) => {
      if (!isRecord(content) || content.type !== "text") return content;
      const text = readString(content.text);
      if (!text) return content;
      try {
        const envelope = JSON.parse(text) as unknown;
        if (
          !isRecord(envelope) ||
          envelope.kind !== "untrusted_tool_data" ||
          envelope.toolName !== "poi.search" ||
          !isRecord(envelope.data)
        ) {
          return content;
        }
        return {
          ...content,
          text: JSON.stringify({
            ...envelope,
            data: { ...envelope.data, candidates },
          }),
        };
      } catch {
        return content;
      }
    }),
  });
}

function getPoiIdentity(value: Record<string, unknown>): string {
  const provider = readString(value.provider) ?? "";
  const providerPlaceId = readString(value.providerPlaceId) ?? "";
  return `${provider}:${providerPlaceId}`;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

type VerifiedPoiCandidate = {
  address?: string;
  area?: string;
  category?: TripPlaceCategory;
  id?: string;
  latitude: number;
  longitude: number;
  name: string;
  poiType?: string;
  provider: "amap";
  providerPlaceId: string;
};

function parseVerifiedPoiCandidate(
  value: Readonly<Record<string, unknown>>,
): VerifiedPoiCandidate | undefined {
  const latitude = readFiniteNumber(value.latitude);
  const longitude = readFiniteNumber(value.longitude);
  const name = readString(value.name);
  const providerPlaceId = readString(value.providerPlaceId);
  if (
    readString(value.provider) !== "amap" ||
    !providerPlaceId ||
    !name ||
    latitude === undefined ||
    latitude < -90 ||
    latitude > 90 ||
    longitude === undefined ||
    longitude < -180 ||
    longitude > 180
  ) {
    return undefined;
  }

  return {
    address: readString(value.address),
    area: readString(value.area),
    category: readTripPlaceCategory(value.category),
    id: readString(value.id),
    latitude,
    longitude,
    name,
    poiType: readString(value.poiType),
    provider: "amap",
    providerPlaceId,
  };
}

function readTripPlaceCategory(value: unknown): TripPlaceCategory | undefined {
  return value === "景点" ||
    value === "餐厅" ||
    value === "酒店" ||
    value === "交通" ||
    value === "购物" ||
    value === "教育" ||
    value === "医疗" ||
    value === "其他"
    ? value
    : undefined;
}

function canonicalizeVerifiedAddedPlaces(
  proposal: TripEditProposal,
  selectedTrip: Trip,
  trustedPois: ReadonlyMap<string, VerifiedPoiCandidate> = new Map(),
): TripEditProposal | undefined {
  const operations: TripEditProposal["operations"] = [];

  for (const operation of proposal.operations) {
    if (operation.type !== "add_place_to_day") {
      operations.push(operation);
      continue;
    }

    const requestedIdentity = getPoiIdentity(
      operation.place as unknown as Record<string, unknown>,
    );
    const toolPlace = trustedPois.get(requestedIdentity);
    const localIds = [operation.place.id, operation.place.sourcePlaceId].filter(
      (value): value is string => Boolean(value),
    );
    const localPlace = selectedTrip.places.find(
      (place) =>
        (localIds.includes(place.id) ||
          Boolean(
            operation.place.provider &&
              operation.place.providerPlaceId &&
              operation.place.provider === place.provider &&
              operation.place.providerPlaceId === place.providerPlaceId,
          )) &&
        parseVerifiedPoiCandidate(place as unknown as Record<string, unknown>),
    );
    const trustedPlace =
      toolPlace ??
      (localPlace
        ? parseVerifiedPoiCandidate(
            localPlace as unknown as Record<string, unknown>,
          )
        : undefined);

    if (!trustedPlace) return undefined;

    const provider = readString(trustedPlace.provider);
    const providerPlaceId = readString(trustedPlace.providerPlaceId);
    if (!provider || !providerPlaceId) return undefined;

    operations.push({
      ...operation,
      metadata: {
        placeResolution: {
          address: readString(trustedPlace.address),
          confidence: "high",
          provider,
          providerPlaceId,
          source: provider,
        },
      },
      place: {
        address: readString(trustedPlace.address),
        area: readString(trustedPlace.area),
        category: readTripPlaceCategory(trustedPlace.category),
        id: readString(trustedPlace.id),
        latitude: readFiniteNumber(trustedPlace.latitude),
        longitude: readFiniteNumber(trustedPlace.longitude),
        name: readString(trustedPlace.name) ?? operation.place.name,
        poiType: readString(trustedPlace.poiType),
        provider,
        providerPlaceId,
        sourcePlaceId: readString(trustedPlace.id),
      },
    });
  }

  return { ...proposal, operations };
}

async function runSelectedWayLogQaSkill(input: {
  emit: (event: AgentUiEvent) => void;
  model: StreamFn;
  registerAbort?: (abort: () => void) => () => void;
  selectedTrip?: Trip;
  tools: ProposalGenerationReadTool[];
  userMessage: string;
}): Promise<WayLogQaSkillTermination> {
  const skillResult = getAgentSkill(defaultAgentSkillRegistry, "waylog.qa");

  if (!skillResult.ok) {
    throw new Error(skillResult.error.message);
  }

  const allowedToolIds = new Set(skillResult.data.allowedRuntimeTools);
  let toolCallCount = 0;
  let toolBudgetExceeded = false;
  const selectedTools = input.tools
    .filter((entry) => allowedToolIds.has(entry.id))
    .map((entry) => ({
      ...entry,
      tool: {
        ...entry.tool,
        execute: async (...args: Parameters<typeof entry.tool.execute>) => {
          toolCallCount += 1;
          if (toolCallCount > skillResult.data.maxToolCalls) {
            throw new Error(
              "waylog.qa exceeded its read-only tool-call budget.",
            );
          }
          return entry.tool.execute(...args);
        },
      },
    }));
  const sourceReferences: AgentSourceReference[] = [];
  let answer: ProposalGenerationAnswer | undefined;
  let clarificationMessage: string | undefined;
  const answerTool: AgentTool = {
    description:
      "Return the validated public WayLog answer and terminate this Skill run.",
    execute: async (_toolCallId, params) => {
      const candidate = parseAnswerToolArguments(params);
      if (isUnsafeWayLogQaAnswer(candidate.text)) {
        clarificationMessage =
          "我无法可靠区分旅行问题与可能改变权限的指令。请只保留要查询的旅行问题后再试。";

        return {
          content: [{ text: clarificationMessage, type: "text" }],
          details: { status: "clarification_required" },
          terminate: true,
        };
      }
      answer = candidate;

      return {
        content: [{ text: answer.text, type: "text" }],
        details: { answer },
        terminate: true,
      };
    },
    label: "完成回答",
    name: ANSWER_TOOL_NAME,
    parameters: createAnswerToolSchema(),
  };
  const publicToolNames = new Map(
    selectedTools.map(({ publicName, tool }) => [tool.name, publicName.trim()]),
  );
  const agent = await createWayLogPiAgent({
    beforeToolCall: async ({ toolCall }) => {
      if (
        publicToolNames.has(toolCall.name) &&
        toolCallCount >= skillResult.data.maxToolCalls
      ) {
        toolBudgetExceeded = true;
        return {
          block: true,
          reason: "waylog.qa reached its read-only tool-call budget.",
          terminate: true,
        };
      }
      return undefined;
    },
    initialState: {
      model: createSkillModelProfile(),
      systemPrompt: "",
      tools: [...selectedTools.map(({ tool }) => tool), answerTool],
    },
    streamFn: input.model,
  });

  agent.subscribe((event) => {
    if (
      event.type === "tool_execution_end" &&
      event.toolName !== ANSWER_TOOL_NAME &&
      publicToolNames.has(event.toolName)
    ) {
      sourceReferences.push(
        ...readPublicSourceReferences(event.result.details),
      );
    }

    if (
      event.type === "tool_execution_start" &&
      event.toolName !== ANSWER_TOOL_NAME &&
      publicToolNames.has(event.toolName)
    ) {
      input.emit(createStageEvent("running_tool"));
    }

    const publicEvent = projectPiAgentEvent(event, publicToolNames);

    if (publicEvent) input.emit(publicEvent);
  });
  const unregisterAbort = input.registerAbort?.(() => agent.abort());
  try {
    await agent.prompt(
      JSON.stringify({
        kind: "waylog_qa_request",
        question: input.userMessage,
        selectedTripData: input.selectedTrip
          ? createWaylogQaContext(input.selectedTrip)
          : undefined,
      }),
    );
  } finally {
    unregisterAbort?.();
  }

  if (clarificationMessage) {
    return { kind: "clarification", message: clarificationMessage };
  }

  if (!answer) {
    if (toolBudgetExceeded) {
      throw new PublicRetryableAgentError(
        "只读工具调用次数已达上限，原消息已保留，请重试。",
      );
    }
    throw new Error(
      agent.state.errorMessage ||
        "Pi Skill run ended without a valid waylog_answer terminating tool call.",
    );
  }

  const sources = readPublicSourceReferences({ sourceReferences });
  const publicAnswer: ProposalGenerationAnswer =
    sources.length > 0
      ? {
          citations: sources.map(({ title, url }) => ({ title, url })),
          sources,
          text: appendSourceReferences(answer.text, sources),
        }
      : { text: answer.text };
  if (isUnsafeWayLogQaAnswer(publicAnswer.text)) {
    return {
      kind: "clarification",
      message:
        "我无法可靠区分旅行问题与可能改变权限的指令。请只保留要查询的旅行问题后再试。",
    };
  }
  return { answer: publicAnswer, kind: "answer" };
}

async function finishBuiltInRoute(input: {
  attemptId: string;
  conversationDeps: Parameters<typeof recordAgentConversationTurn>[1];
  conversationId: string;
  emit: (event: AgentUiEvent) => void;
  events: AgentUiEvent[];
  route: CloudRouteDecision;
  turnId: string;
  userMessage: string;
}): Promise<ProposalGenerationBuiltInResult> {
  const message = input.route.publicMessage;

  if (!message || !input.route.handler) {
    throw new Error("Built-in route is missing its public response.");
  }

  const resultType =
    input.route.handler === "clarification" ? "clarification" : "out_of_scope";
  input.emit(createStageEvent("completed"));
  await appendAgentConversationMessage(
    {
      attemptId: input.attemptId,
      conversationId: input.conversationId,
      dedupeKey: `${input.turnId}:${resultType}`,
      role: "agent",
      text: message,
      turnId: input.turnId,
    },
    input.conversationDeps,
  );
  await recordAgentConversationTurn(
    {
      attemptId: input.attemptId,
      conversationId: input.conversationId,
      mode: "pi_cloud_routed",
      reply: message,
      status: resultType === "clarification" ? "failed" : "chat",
      turnId: input.turnId,
      userMessage: input.userMessage,
    },
    input.conversationDeps,
  );

  return {
    attemptId: input.attemptId,
    conversationId: input.conversationId,
    events: input.events,
    message,
    resultType,
    route: input.route,
    turnId: input.turnId,
  };
}

async function createRetryableFailure(input: {
  attemptId: string;
  conversationDeps: Parameters<typeof recordAgentConversationTurn>[1];
  conversationId: string;
  error: string;
  failure: AgentFailure;
  events: AgentUiEvent[];
  route?: CloudRouteDecision;
  retryContext?: AgentConversationRetryContext;
  turnId: string;
  userMessage: string;
}): Promise<ProposalGenerationFailureResult> {
  await recordAgentConversationTurn(
    {
      attemptId: input.attemptId,
      conversationId: input.conversationId,
      errorCode: "ROUTE_OR_SKILL_FAILED",
      failure: input.failure,
      reply: input.error,
      retryContext: input.retryContext,
      status: input.failure.kind === "cancelled" ? "cancelled" : "failed",
      turnId: input.turnId,
      userMessage: input.userMessage,
    },
    input.conversationDeps,
  );

  return {
    attemptId: input.attemptId,
    conversationId: input.conversationId,
    error: input.error,
    failure: input.failure,
    events: input.events,
    resultType: "failure",
    retryable: input.failure.retryable,
    route: input.route,
    turnId: input.turnId,
    userMessage: input.userMessage,
  };
}

function createPublicEventEmitter(
  events: AgentUiEvent[],
  onEvent?: (event: AgentUiEvent) => void,
) {
  const eventKeys = new Set<string>();
  return (event: AgentUiEvent) => {
    if (event.type === "stage.changed") {
      const previous = events.at(-1);
      if (
        previous?.type === "stage.changed" &&
        previous.stage === event.stage
      ) {
        return;
      }
    } else {
      const eventKey = `${event.type}:${event.toolCallId}:${event.status}`;
      if (eventKeys.has(eventKey)) return;
      eventKeys.add(eventKey);
    }

    events.push(event);
    onEvent?.(event);
  };
}

function createAnswerToolSchema(): Record<string, unknown> {
  return {
    additionalProperties: false,
    properties: {
      answer: {
        additionalProperties: false,
        properties: {
          citations: {
            items: {
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                url: { type: "string" },
              },
              type: "object",
            },
            type: "array",
          },
          text: { minLength: 1, type: "string" },
        },
        required: ["text"],
        type: "object",
      },
    },
    required: ["answer"],
    type: "object",
  };
}

function createSkillModelProfile() {
  return {
    api: "waylog-proxy",
    baseUrl: "",
    contextWindow: 8_000,
    cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
    id: "balanced",
    input: ["text"] as ["text"],
    maxTokens: 900,
    name: "WayLog Balanced",
    provider: "waylog",
    reasoning: false,
  };
}

function validateReadTools(tools: ProposalGenerationReadTool[]): void {
  const names = new Set<string>();

  for (const entry of tools) {
    if (
      !proposalGenerationReadToolIdSet.has(entry.id) ||
      !entry.publicName.trim() ||
      entry.tool.name !== entry.id ||
      names.has(entry.id)
    ) {
      throw new Error(
        `Invalid Proposal Generation read-only tool: ${entry.tool.name}`,
      );
    }

    names.add(entry.id);
  }
}

function parseAnswerToolArguments(value: unknown): ProposalGenerationAnswer {
  if (!isRecord(value) || !isRecord(value.answer)) {
    throw new Error("waylog_answer requires a structured answer object.");
  }

  const text = readString(value.answer.text);

  if (!text) {
    throw new Error("waylog_answer.answer.text must be a non-empty string.");
  }

  const citations = Array.isArray(value.answer.citations)
    ? value.answer.citations.flatMap((citation) => {
        if (!isRecord(citation)) return [];
        const title = readString(citation.title);
        const url = readString(citation.url);

        return title || url ? [{ title, url }] : [];
      })
    : undefined;

  return citations?.length ? { citations, text } : { text };
}

function isUnsafeWayLogQaAnswer(text: string): boolean {
  if (
    /(?:system\s*(?:prompt|instructions?)|hidden\s*(?:prompt|instructions?)|internal\s*(?:rules?|instructions?|prompt)|developer\s*(?:message|instructions?)|系统(?:提示词|指令)|隐藏(?:提示|规则|指令)|内部(?:提示|规则|指令)|开发者(?:消息|指令))/iu.test(
      text,
    )
  ) {
    return true;
  }

  if (
    /(?:调用|使用|执行|call(?:ed|ing)?|us(?:e|ed|ing))[^。！？!\n]{0,24}(?:trip\.(?:create|update|delete)|rag\.retrieve|destination\s*pack)/iu.test(
      text,
    )
  ) {
    return true;
  }

  const writeAction =
    "(?:修改|更新|写入|保存|删除|创建|新增|同步|预订|支付|应用|执行)";
  const chineseWriteClaim = new RegExp(
    `(?:(?:我|本助手|WayLog\\s*Agent|你的?行程|行程|旅行计划)[^。！？!；;\\n]{0,20}(?:已经|已|成功|刚刚|刚才|替你|为你)[^。！？!；;\\n]{0,16}${writeAction}|(?:已经|已|成功|刚刚|刚才)(?:替你|为你)?[^。！？!；;\\n]{0,16}${writeAction}[^。！？!；;\\n]{0,12}(?:你的?)?(?:行程|旅行计划|Trip)|(?:行程|旅行计划)[^。！？!；;\\n]{0,8}${writeAction}[^。！？!；;\\n]{0,8}(?:完成|成功|好了|生效))`,
    "iu",
  );
  const englishWriteClaim =
    /(?=[^.!?\n]*(?:\btrip\b|\bitinerary\b|\bchanges?\b))(?=[^.!?\n]*\b(?:saved|deleted|updated|modified|created|added|synced|booked|paid|applied|executed)\b)[^.!?\n]*|\b(?:completed|finished)\s+(?:the\s+)?(?:save|update|deletion|creation|sync|booking|payment)\b[^.!?\n]{0,32}\b(?:trip|itinerary|changes?)\b/iu;

  if (chineseWriteClaim.test(text) || englishWriteClaim.test(text)) {
    return true;
  }

  return text.split(/[。！？!?;；\n]/u).some((clause) => {
    const englishActor = /\b(?:i|we|waylog|agent)\b/iu.test(clause);
    const englishEntity =
      /\b(?:trip|itinerary|schedule|plan|changes?)\b/iu.test(clause);
    const englishMutation =
      /\b(?:add|adjust|alter|amend|appl|book|cancel|chang|creat|delet|edit|fix|insert|modif|mov|pay|persist|remov|reorder|replac|reschedul|rewrit|sav|stor|sync|updat|writ)\w*\b|\b(?:made|paid|put|set|wrote|rewrote)\b/iu.test(
        clause,
      );
    const englishCompletedMutation =
      /\b(?:added|adjusted|altered|amended|applied|booked|cancelled|canceled|changed|created|deleted|edited|fixed|inserted|modified|moved|paid|persisted|removed|reordered|replaced|rescheduled|rewritten|saved|stored|synced|updated|written|made|put|set|wrote|rewrote)\b|\b(?:already|successfully|just|done|completed|finished|has\s+been|have\s+been|had\s+been|has\s+finished|have\s+finished|had\s+finished|was|were|got)\b/iu.test(
        clause,
      );
    if (
      englishMutation &&
      englishCompletedMutation &&
      (englishActor || englishEntity)
    ) {
      return true;
    }

    const chineseActorOrEntity =
      /(?:我|我们|本助手|WayLog\s*Agent|WayLog|你的?行程|行程|旅行计划)/iu.test(
        clause,
      );
    const chineseMutation =
      /(?:修改|更新|写入|保存|删除|创建|新增|同步|预订|支付|应用|执行|改动|编辑|调整|变更|改写|重排|替换|移动|取消|提交)/u.test(
        clause,
      );
    const chineseCompletion =
      /(?:已经|已|成功|刚刚|刚才|替你|为你|完成|好了|生效|了)/u.test(clause);
    return chineseActorOrEntity && chineseMutation && chineseCompletion;
  });
}

function toAgentFailure(error: unknown): AgentFailure {
  if (error instanceof AgentRuntimeFailure) return error.failure;
  if (error instanceof PublicRetryableAgentError) {
    return createAgentFailure("internal", { message: error.message });
  }
  if (error instanceof Error && error.name === "AbortError") {
    return createAgentFailure("cancelled");
  }
  const proxyFailure = parsePiProxyPublicFailure(
    error instanceof Error ? error.message : undefined,
  );
  if (proxyFailure) {
    const kind =
      proxyFailure.kind === "quota_exceeded"
        ? "quota"
        : proxyFailure.kind === "app_version_unsupported" ||
            proxyFailure.kind === "protocol_unsupported"
          ? "protocol"
          : proxyFailure.kind === "skill_disabled"
            ? "skill_unavailable"
            : proxyFailure.kind === "runtime_disabled" ||
                proxyFailure.kind === "model_profile_disabled"
              ? "runtime_disabled"
              : "internal";
    return createAgentFailure(kind, {
      code: proxyFailure.kind,
      message: proxyFailure.message,
      retryable: proxyFailure.retryable,
    });
  }
  const code =
    isRecord(error) && typeof error.code === "string"
      ? error.code.toLowerCase()
      : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const detail = `${code} ${message}`;
  if (/\b(401|403|auth|jwt|unauthorized)\b/u.test(detail)) {
    return createAgentFailure("authentication");
  }
  if (/\b(429|quota|rate.?limit)\b/u.test(detail)) {
    return createAgentFailure("quota");
  }
  if (/\b(abort|cancel)\b/u.test(detail)) {
    return createAgentFailure("cancelled");
  }
  if (/\b(timeout|timed.?out)\b/u.test(detail)) {
    return createAgentFailure("timeout");
  }
  if (/network|fetch|sse.*(中断|ended|closed)|连接/u.test(detail)) {
    return createAgentFailure("network");
  }
  if (/protocol|schema.?version|不兼容|版本/u.test(detail)) {
    return createAgentFailure("protocol");
  }
  if (/runtime.*disabled|agent.*disabled|停用/u.test(detail)) {
    return createAgentFailure("runtime_disabled");
  }
  if (/skill.*(unavailable|disabled|not.*registered|尚未接入)/u.test(detail)) {
    return createAgentFailure("skill_unavailable");
  }
  if (/schema|validat|terminating tool|可靠性校验/u.test(detail)) {
    return createAgentFailure("schema");
  }
  if (/\btool\b|工具/u.test(detail)) {
    return createAgentFailure("tool");
  }
  if (/\b(model|provider|llm)\b|模型/u.test(detail)) {
    return createAgentFailure("model");
  }
  return createAgentFailure("internal");
}

function resolveAttemptFailure(
  attempt: { throwIfCancelled: () => void },
  error: unknown,
): AgentFailure {
  try {
    attempt.throwIfCancelled();
  } catch (cancelledError) {
    return toAgentFailure(cancelledError);
  }
  return toAgentFailure(error);
}

class PublicRetryableAgentError extends Error {}

function createSelectedTripContext(trip: Trip) {
  return {
    days: trip.days.map((day) => ({
      dayIndex: day.dayIndex,
      id: day.id,
      itemCount: day.items.length,
      items: day.items.map((item) => ({
        category: item.category,
        id: item.id,
        placeId: item.placeId,
        placeName: item.placeName,
        time: item.time,
        title: item.title,
      })),
      title: day.title,
    })),
    destination: trip.destination,
    endDate: trip.endDate,
    id: trip.id,
    startDate: trip.startDate,
    status: trip.status,
    title: trip.title,
    updatedAt: trip.updatedAt,
  };
}

function createRuntimeId(prefix: string): string {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${id}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
