import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  type AgentConversationAudit,
  type AgentConversationDebug,
  type AgentConversationMessage,
  type AgentConversationOperationReceipt,
  type AgentConversationScope,
  type AgentConversationSummary,
  type AgentConversationToolResult,
  type AgentConversationTraceEvent,
  type AgentHarnessPreviewTurn,
  type AgentServiceStatus,
  type AgentTripTargetCandidate,
  type AgentUiEvent,
  appendAgentConversationMessage,
  cancelActiveAgentTurn,
  applyTripEditProposal,
  parseTripEditProposal,
  deleteAgentTripDraft,
  getAgentConversation,
  getCurrentAgentConversation,
  getCurrentTripDraftContinuation,
  applyConfirmedTripCreate,
  createTripCreateRequest,
  listAgentConversationSummaries,
  type ProposalGenerationResult,
  recordAgentConversationTurn,
  recoverInterruptedAgentConversationTurns,
  removeAgentConversation,
  renameAgentConversation,
  requestCurrentAgentServiceStatus,
  createAgentServiceStatusRequestGate,
  requestProposalGenerationViaPi,
  requiresStrongTripEditConfirmation,
  resolveAgentAccessState,
  resumeProposalGenerationViaPi,
  resumeTripDraftProposalGenerationViaPi,
  retryProposalGenerationViaPi,
  saveAgentTripDraft,
  startNewAgentConversation,
} from "@/features/agent";
import { getCurrentAuthAccessToken } from "@/features/auth/storage";
import {
  buildTripDayRouteSegments,
  getRouteSegmentWithCache,
  getTripById,
  type Trip,
} from "@/features/trips";
import { useCurrentAuthUser } from "@/shared/hooks/use-current-auth-user";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme, useTheme } from "@/shared/theme/use-app-theme";
import { triggerHaptic } from "@/shared/ui/haptic-feedback";
import { ScreenHeader } from "@/shared/ui/screen-header";
import type {
  AgentConversationScreenProps,
  AgentDebugInfo,
  PendingAgentError,
  PendingAgentProposal,
  PendingTripDraft,
  PendingTripDraftClarification,
  PendingTripSelection,
} from "./agent-conversation.types";
import {
  canAutoApplyAgentPreview,
  createAgentOperationReceipt,
  formatAgentRouteDistance,
  formatAgentRouteMinutes,
} from "./agent-conversation-formatters";
import {
  type AgentConversationLayoutPreset,
  resolveAgentConversationLayoutPreset,
} from "./agent-conversation-layout-preset";
import { AgentConversationHistoryDrawer } from "./components/agent-conversation-history-drawer";
import { AgentConversationInputDock } from "./components/agent-conversation-input-dock";
import {
  type AgentChatMessage,
  AgentMessageList,
} from "./components/agent-message-list";
import { AgentPendingActionStack } from "./components/agent-pending-action-stack";
import { useAgentHistoryDrawerController } from "./hooks/use-agent-history-drawer-controller";
import { useAgentInputController } from "./hooks/use-agent-input-controller";
import { useAgentProgressController } from "./hooks/use-agent-progress-controller";
import { createMessageId } from "./utils";

const initialMessages: AgentChatMessage[] = [
  {
    createdAt: "1970-01-01T00:00:00.000Z",
    id: "agent-welcome",
    role: "agent",
    text: "告诉我你想去哪、玩几天，或想调整哪条行程。添加真实地点时可以直接选择候选；修改、移动和删除会先展示清晰的影响范围。",
  },
];

export function AgentConversationScreen({
  bottomChromeInset = 0,
  conversationId,
  showBackButton = true,
  tripId,
  tripTitle,
}: AgentConversationScreenProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const [authUser, isAuthLoading] = useCurrentAuthUser();
  const agentAccessState = resolveAgentAccessState(authUser, isAuthLoading);
  const resolvedTheme = useTheme();
  const conversationLayout = useMemo(
    () =>
      resolveAgentConversationLayoutPreset(
        resolvedTheme.agent.conversationLayoutPreset,
      ),
    [resolvedTheme.agent.conversationLayoutPreset],
  );
  const insets = useSafeAreaInsets();
  const bottomDockInset = insets.bottom + bottomChromeInset;
  const styles = useMemo(
    () => createStyles(theme, bottomDockInset, conversationLayout),
    [bottomDockInset, conversationLayout, theme],
  );
  const conversationScope = useMemo<AgentConversationScope>(
    () =>
      tripId
        ? {
            tripId,
            tripTitle,
            type: "trip",
          }
        : { type: "global" },
    [tripId, tripTitle],
  );
  const conversationAccountId = authUser?.user.id;
  const conversationDeps = useMemo(
    () => ({ accountId: conversationAccountId }),
    [conversationAccountId],
  );
  const appliedOperationIdsRef = useRef(new Set<string>());
  const conversationIdRef = useRef<string | undefined>(undefined);
  const conversationPromiseRef = useRef<Promise<string> | undefined>(undefined);
  const messagesDirtyRef = useRef(false);
  const pendingScrollToLatestRef = useRef<{ animated: boolean } | undefined>(
    undefined,
  );
  const scrollFallbackTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const scrollViewRef = useRef<ScrollView>(null);
  const [conversationSummaries, setConversationSummaries] = useState<
    AgentConversationSummary[]
  >([]);
  const [messages, setMessages] = useState<AgentChatMessage[]>(initialMessages);
  const [isConversationLoading, setConversationLoading] = useState(true);
  const [isSending, setSending] = useState(false);
  const [agentServiceStatusState, setAgentServiceStatusState] = useState<{
    accountId: string;
    status: AgentServiceStatus;
  }>();
  const agentServiceStatusRequestGateRef = useRef(
    createAgentServiceStatusRequestGate(),
  );
  const agentServiceStatus =
    agentServiceStatusState &&
    agentServiceStatusState.accountId === conversationAccountId
      ? agentServiceStatusState.status
      : undefined;
  const [isUsageExpanded, setUsageExpanded] = useState(false);
  const {
    draft,
    executionMode,
    executionModeLabel,
    resetDraft,
    setDraft,
    toggleExecutionMode,
  } = useAgentInputController({ isSending });
  const { closeHistoryDrawer, isHistoryVisible, openHistoryDrawer } =
    useAgentHistoryDrawerController({ isDisabled: isSending });
  const {
    failAgentProgressAt,
    handleAgentUiEvent,
    hideAgentProgress,
    progressState,
    resetAgentProgress,
  } = useAgentProgressController();
  const [pendingTripSelection, setPendingTripSelection] =
    useState<PendingTripSelection>();
  const [pendingProposal, setPendingProposal] =
    useState<PendingAgentProposal>();
  const [pendingTripDraft, setPendingTripDraft] = useState<PendingTripDraft>();
  const [pendingTripDraftClarification, setPendingTripDraftClarification] =
    useState<PendingTripDraftClarification>();
  const [pendingError, setPendingError] = useState<PendingAgentError>();

  const refreshAgentServiceStatus = useCallback(async () => {
    const accountId = conversationAccountId?.trim() ?? "";
    if (agentAccessState !== "ready" || !accountId) {
      agentServiceStatusRequestGateRef.current.invalidate();
      setAgentServiceStatusState(undefined);
      return;
    }
    const request = agentServiceStatusRequestGateRef.current.begin(accountId);
    setAgentServiceStatusState(undefined);
    const accessToken = await getCurrentAuthAccessToken();
    if (!accessToken) {
      if (agentServiceStatusRequestGateRef.current.isCurrent(request)) {
        setAgentServiceStatusState(undefined);
      }
      return;
    }
    try {
      const status = await requestCurrentAgentServiceStatus(accessToken);
      if (agentServiceStatusRequestGateRef.current.isCurrent(request)) {
        setAgentServiceStatusState({ accountId, status });
      }
    } catch (error) {
      if (agentServiceStatusRequestGateRef.current.isCurrent(request)) {
        setAgentServiceStatusState(undefined);
      }
      throw error;
    }
  }, [agentAccessState, conversationAccountId]);

  useEffect(() => {
    void refreshAgentServiceStatus().catch(() => {});
    return () => agentServiceStatusRequestGateRef.current.invalidate();
  }, [refreshAgentServiceStatus]);

  const flushPendingScrollToLatest = useCallback(() => {
    const request = pendingScrollToLatestRef.current;

    if (!request) {
      return;
    }

    const scrollView = scrollViewRef.current;

    if (!scrollView) {
      return;
    }

    scrollView.scrollToEnd({ animated: request.animated });
    pendingScrollToLatestRef.current = undefined;

    if (scrollFallbackTimerRef.current) {
      clearTimeout(scrollFallbackTimerRef.current);
      scrollFallbackTimerRef.current = undefined;
    }
  }, []);

  const requestScrollToLatest = useCallback(
    (animated: boolean) => {
      pendingScrollToLatestRef.current = { animated };

      if (scrollFallbackTimerRef.current) {
        clearTimeout(scrollFallbackTimerRef.current);
      }

      scrollFallbackTimerRef.current = setTimeout(
        flushPendingScrollToLatest,
        80,
      );
    },
    [flushPendingScrollToLatest],
  );

  const refreshConversationSummaries = () => {
    void listAgentConversationSummaries(
      { scope: conversationScope },
      conversationDeps,
    )
      .then(setConversationSummaries)
      .catch(() => {});
  };

  useEffect(() => {
    let isMounted = true;

    messagesDirtyRef.current = false;
    conversationIdRef.current = undefined;
    conversationPromiseRef.current = undefined;
    setMessages(initialMessages);
    setConversationLoading(true);
    resetDraft();
    closeHistoryDrawer();
    resetAgentProgress();
    setPendingTripSelection(undefined);
    setPendingProposal(undefined);
    setPendingTripDraft(undefined);
    setPendingTripDraftClarification(undefined);
    setPendingError(undefined);

    void (async () => {
      try {
        if (conversationAccountId) {
          await recoverInterruptedAgentConversationTurns({
            ...conversationDeps,
            accountId: conversationAccountId,
          });
        }
        const [conversation, summaries] = await Promise.all([
          conversationId
            ? getAgentConversation(conversationId, conversationDeps)
            : getCurrentAgentConversation({
                ...conversationDeps,
                scope: conversationScope,
              }),
          listAgentConversationSummaries(
            { scope: conversationScope },
            conversationDeps,
          ),
        ]);

        if (!isMounted) {
          return;
        }

        setConversationSummaries(summaries);

        if (
          conversation &&
          !messagesDirtyRef.current &&
          !conversationIdRef.current
        ) {
          conversationIdRef.current = conversation.id;
          conversationPromiseRef.current = Promise.resolve(conversation.id);
        }

        if (!messagesDirtyRef.current && conversation?.messages.length) {
          setMessages([
            ...initialMessages,
            ...conversation.messages.map(toAgentChatMessage),
          ]);
        }

        if (conversation && conversationAccountId) {
          const continuation = await getCurrentTripDraftContinuation(
            conversationAccountId,
            conversation.id,
            new Date().toISOString(),
          );
          if (isMounted && continuation) {
            setPendingTripDraftClarification({
              clarification: {
                clarificationId: continuation.clarificationId,
                continuation: {
                  conversationId: continuation.conversationId,
                  skillId: "trip.draft",
                  turnId: continuation.turnId,
                },
                question: continuation.question,
                requestedField: continuation.requestedField,
                responseContract: continuation.responseContract,
              },
              error:
                continuation.status === "resuming"
                  ? "这条澄清正在处理中，请稍后重新打开会话重试。"
                  : undefined,
              isSubmitting: continuation.status === "resuming",
              userMessage: continuation.originalInput,
            });
          }
        }
      } finally {
        if (isMounted) {
          requestScrollToLatest(false);
          setConversationLoading(false);
        }
      }
    })().catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [
    closeHistoryDrawer,
    conversationAccountId,
    conversationId,
    conversationDeps,
    conversationScope,
    resetAgentProgress,
    requestScrollToLatest,
    resetDraft,
  ]);

  useEffect(
    () => () => {
      if (scrollFallbackTimerRef.current) {
        clearTimeout(scrollFallbackTimerRef.current);
      }
    },
    [],
  );

  const ensureConversationId = () => {
    if (conversationIdRef.current) {
      return Promise.resolve(conversationIdRef.current);
    }

    if (!conversationPromiseRef.current) {
      conversationPromiseRef.current = startNewAgentConversation({
        ...conversationDeps,
        scope: conversationScope,
      })
        .then((conversation) => {
          conversationIdRef.current = conversation.id;

          return conversation.id;
        })
        .catch((error) => {
          conversationPromiseRef.current = undefined;
          throw error;
        });
    }

    return conversationPromiseRef.current;
  };

  const persistMessage = (message: AgentChatMessage) => {
    if (message.id === "agent-welcome") {
      return;
    }

    void ensureConversationId()
      .then((conversationId) =>
        appendAgentConversationMessage(
          {
            conversationId,
            message: {
              audit: message.audit,
              createdAt: message.createdAt,
              debug: message.debug,
              id: message.id,
              operationReceipt: message.operationReceipt,
              role: message.role,
              text: message.text,
              trace: message.trace,
              toolResults: message.toolResults,
            },
          },
          conversationDeps,
        ),
      )
      .then(({ conversation }) => {
        conversationIdRef.current = conversation.id;
        refreshConversationSummaries();
      })
      .catch(() => {});
  };

  const persistTurn = (
    input: Parameters<typeof recordAgentConversationTurn>[0],
  ) => {
    void ensureConversationId()
      .then((conversationId) =>
        recordAgentConversationTurn(
          {
            ...input,
            conversationId,
          },
          conversationDeps,
        ),
      )
      .then(({ conversation }) => {
        conversationIdRef.current = conversation.id;
        refreshConversationSummaries();
      })
      .catch(() => {});
  };

  const appendMessage = (
    role: AgentChatMessage["role"],
    text: string,
    audit?: AgentConversationAudit,
    toolResults?: AgentConversationToolResult[],
    trace?: AgentConversationTraceEvent[],
    debug?: AgentDebugInfo,
    operationReceipt?: AgentConversationOperationReceipt,
  ) => {
    const message: AgentChatMessage = {
      audit,
      createdAt: new Date().toISOString(),
      debug,
      id: createMessageId(role),
      operationReceipt,
      role,
      text,
      trace,
      toolResults,
    };

    messagesDirtyRef.current = true;
    setMessages((current) => [...current, message]);
    requestScrollToLatest(true);
    persistMessage(message);

    return message;
  };

  const clearPendingActions = () => {
    setPendingTripSelection(undefined);
    setPendingProposal(undefined);
    setPendingTripDraft(undefined);
    setPendingTripDraftClarification(undefined);
    setPendingError(undefined);
  };

  const createProposalDebug = (
    proposal: AgentHarnessPreviewTurn["proposal"],
    input: Partial<AgentDebugInfo> = {},
  ): AgentDebugInfo =>
    createAgentDebugInfo({
      operationIds: proposal.operations.map(
        (operation) => operation.operationId,
      ),
      proposalId: proposal.proposalId,
      resultType: "proposal",
      route: "itinerary_edit",
      ...input,
    });

  const applyConfirmedAgentTurn = async (
    _trip: Trip,
    turn: AgentHarnessPreviewTurn,
    _userMessage: string,
    authorizationKind:
      | "explicit_confirmation"
      | "quick_delegate"
      | "strong_confirmation" = "explicit_confirmation",
    auditTurnId?: string,
  ): Promise<
    | { ok: true; appliedOperationIds: string[]; trip: Trip }
    | { ok: false; errorCode?: string; message: string }
  > => {
    const parsedProposal = parseTripEditProposal(turn.proposal);
    if (!parsedProposal.ok) {
      return {
        ok: false,
        errorCode: parsedProposal.error.code,
        message: parsedProposal.error.message,
      };
    }
    const activeConversationId = await ensureConversationId();
    const applyResult = await applyTripEditProposal({
      authorization:
        authorizationKind === "quick_delegate"
          ? { enabled: true, kind: "quick_delegate" }
          : { kind: authorizationKind },
      conversationId: activeConversationId,
      proposal: parsedProposal.data,
      turnId: auditTurnId ?? turn.proposal.proposalId,
    });

    if ("error" in applyResult) {
      return {
        ok: false,
        errorCode: applyResult.error.code,
        message: applyResult.error.message,
      };
    }

    for (const operationId of applyResult.receipt.appliedOperationIds) {
      appliedOperationIdsRef.current.add(operationId);
    }

    return {
      ok: true,
      appliedOperationIds: applyResult.receipt.appliedOperationIds,
      trip: applyResult.trip,
    };
  };

  const appendRouteSuggestionAfterApply = (
    trip: Trip,
    proposal: AgentHarnessPreviewTurn["proposal"],
  ) => {
    const addOperation = [...proposal.operations]
      .reverse()
      .find((operation) => operation.type === "add_place_to_day");

    if (addOperation?.type !== "add_place_to_day") {
      return;
    }

    const targetDay = trip.days.find((day) =>
      addOperation.dayId
        ? day.id === addOperation.dayId
        : day.dayIndex === addOperation.dayIndex,
    );

    if (!targetDay || targetDay.items.length < 2) {
      return;
    }

    void (async () => {
      try {
        const segments = buildTripDayRouteSegments(trip, targetDay);
        const segment = segments.at(-1);

        if (!segment) {
          return;
        }

        const routeResult = await getRouteSegmentWithCache(segment);
        const option = routeResult.entry.modeOptions[0];

        if (!option) {
          appendMessage("agent", "路线暂时不可用，地点已经正常加入行程。");
          return;
        }

        appendMessage(
          "agent",
          `顺手查了一下路线：${segment.snapshot.fromLabel} → ${segment.snapshot.toLabel}，${option.label}约 ${formatAgentRouteMinutes(option.durationMinutes)}，${formatAgentRouteDistance(option.distanceKm)}。`,
        );
      } catch {
        appendMessage("agent", "路线暂时不可用，地点已经正常加入行程。");
      }
    })();
  };

  const resetConversation = () => {
    if (isSending) {
      return;
    }

    clearPendingActions();
    appliedOperationIdsRef.current.clear();
    hideAgentProgress();
    closeHistoryDrawer();
    messagesDirtyRef.current = true;
    resetDraft();
    setMessages(initialMessages);
    requestScrollToLatest(false);
    conversationPromiseRef.current = startNewAgentConversation({
      ...conversationDeps,
      scope: conversationScope,
    }).then((conversation) => {
      conversationIdRef.current = conversation.id;

      return conversation.id;
    });
    void conversationPromiseRef.current
      .then((conversationId) => {
        conversationIdRef.current = conversationId;
        refreshConversationSummaries();
      })
      .catch(() => {
        conversationPromiseRef.current = undefined;
        conversationIdRef.current = undefined;
      });
    triggerHaptic("light");
  };

  const openConversation = async (nextConversationId: string) => {
    if (isSending || nextConversationId === conversationIdRef.current) {
      closeHistoryDrawer();
      return;
    }

    const conversation = await getAgentConversation(
      nextConversationId,
      conversationDeps,
    );

    if (!conversation) {
      refreshConversationSummaries();
      return;
    }

    clearPendingActions();
    hideAgentProgress();
    appliedOperationIdsRef.current.clear();
    messagesDirtyRef.current = false;
    conversationIdRef.current = conversation.id;
    conversationPromiseRef.current = Promise.resolve(conversation.id);
    resetDraft();
    setMessages([
      ...initialMessages,
      ...conversation.messages.map(toAgentChatMessage),
    ]);
    requestScrollToLatest(false);
    closeHistoryDrawer();
    triggerHaptic("selection");
  };

  const renameConversation = async (
    summary: AgentConversationSummary,
    title: string,
  ) => {
    if (isSending) {
      return;
    }

    const renamedConversation = await renameAgentConversation(
      {
        conversationId: summary.id,
        title,
      },
      conversationDeps,
    );

    if (!renamedConversation) {
      refreshConversationSummaries();
      triggerHaptic("warning");
      return;
    }

    refreshConversationSummaries();
    triggerHaptic("success");
  };

  const deleteConversation = async (summary: AgentConversationSummary) => {
    if (isSending) {
      return;
    }

    const wasActive = summary.id === conversationIdRef.current;
    await removeAgentConversation(summary.id, conversationDeps);
    const nextSummaries = await listAgentConversationSummaries(
      { scope: conversationScope },
      conversationDeps,
    );

    setConversationSummaries(nextSummaries);

    if (!wasActive) {
      triggerHaptic("selection");
      return;
    }

    const nextConversation = await getCurrentAgentConversation({
      ...conversationDeps,
      scope: conversationScope,
    });

    clearPendingActions();
    hideAgentProgress();
    appliedOperationIdsRef.current.clear();
    messagesDirtyRef.current = false;
    resetDraft();

    if (nextConversation?.messages.length) {
      conversationIdRef.current = nextConversation.id;
      conversationPromiseRef.current = Promise.resolve(nextConversation.id);
      setMessages([
        ...initialMessages,
        ...nextConversation.messages.map(toAgentChatMessage),
      ]);
      requestScrollToLatest(false);
    } else {
      conversationIdRef.current = undefined;
      conversationPromiseRef.current = undefined;
      setMessages(initialMessages);
      requestScrollToLatest(false);
    }

    triggerHaptic("selection");
  };

  const handleProposalGenerationResult = async (
    result: ProposalGenerationResult,
    userMessage: string,
    selectedTrip?: Trip,
  ) => {
    const savedConversation = await getAgentConversation(
      result.conversationId,
      conversationDeps,
    );

    if (savedConversation) {
      conversationIdRef.current = savedConversation.id;
      setMessages([
        ...initialMessages,
        ...savedConversation.messages.map(toAgentChatMessage),
        ...(result.resultType === "failure"
          ? [
              {
                createdAt: new Date().toISOString(),
                id: createMessageId("agent"),
                role: "agent" as const,
                text: result.error,
              },
            ]
          : []),
      ]);
    }

    if (result.resultType === "trip_draft") {
      setPendingTripDraftClarification(undefined);
      await saveAgentTripDraft(result.draft);
      setPendingTripDraft({
        debug: {
          resultType: result.resultType,
          route: "trip_draft",
          turnId: result.turnId,
        },
        draft: result.draft,
        id: createMessageId("trip-draft"),
        isCreating: false,
        userMessage,
      });
    } else if (result.resultType === "trip_draft_clarification") {
      setPendingTripDraftClarification({
        clarification: result.clarification,
        isSubmitting: false,
        userMessage: result.userMessage,
      });
    } else if (result.resultType === "trip_edit_proposal" && selectedTrip) {
      if (
        executionMode === "auto" &&
        canAutoApplyAgentPreview(result.preview.preview)
      ) {
        const applyResult = await applyConfirmedAgentTurn(
          selectedTrip,
          result.preview,
          userMessage,
          "quick_delegate",
          result.turnId,
        );
        if (applyResult.ok) {
          const reply = `快捷代办已完成：${result.preview.proposal.summary}`;
          appendMessage(
            "agent",
            reply,
            undefined,
            undefined,
            undefined,
            createProposalDebug(result.preview.proposal, {
              operationIds: applyResult.appliedOperationIds,
              turnId: result.turnId,
            }),
          );
          persistTurn({
            operationIds: applyResult.appliedOperationIds,
            proposal: result.preview.proposal,
            reply,
            status: "applied",
            tripId: selectedTrip.id,
            tripTitle: selectedTrip.title,
            turnId: result.turnId,
            userMessage,
          });
          appendRouteSuggestionAfterApply(
            applyResult.trip,
            result.preview.proposal,
          );
        } else {
          setPendingProposal({
            debug: createProposalDebug(result.preview.proposal, {
              errorCode: applyResult.errorCode,
              turnId: result.turnId,
            }),
            id: createMessageId("proposal"),
            isApplying: false,
            notice: applyResult.message,
            preview: result.preview.preview,
            requiresRegeneration: [
              "TARGET_NOT_FOUND",
              "TRIP_MISMATCH",
              "VERSION_CONFLICT",
            ].includes(applyResult.errorCode ?? ""),
            tripId: selectedTrip.id,
            tripTitle: selectedTrip.title,
            turn: result.preview,
            userMessage,
          });
        }
      } else {
        setPendingProposal({
          debug: createProposalDebug(result.preview.proposal, {
            turnId: result.turnId,
          }),
          id: createMessageId("proposal"),
          isApplying: false,
          preview: result.preview.preview,
          tripId: selectedTrip.id,
          tripTitle: selectedTrip.title,
          turn: result.preview,
          userMessage,
        });
      }
    } else if (result.resultType === "trip_selection_required") {
      setPendingTripSelection({
        candidates: result.candidates,
        continuation: {
          conversationId: result.conversationId,
          route: result.route,
          turnId: result.turnId,
        },
        id: createMessageId("trip-selection"),
        intentLabel: "要修改哪个行程？",
        userMessage,
      });
    }

    refreshConversationSummaries();
    requestScrollToLatest(true);
    hideAgentProgress();

    if (result.resultType === "failure") {
      setDraft(result.userMessage);
      setPendingError({
        actionLabel: result.retryable ? "重试" : "知道了",
        detail: result.error,
        id: createMessageId("agent-error"),
        retry: result.retryable
          ? {
              conversationId: result.conversationId,
              selectedTripId: selectedTrip?.id,
              turnId: result.turnId,
              userMessage: result.userMessage,
            }
          : undefined,
        title: "这条消息还没有处理完成",
      });
      triggerHaptic("warning");
    } else {
      triggerHaptic("success");
    }
  };

  const runProposalGenerationTurn = async (userMessage: string) => {
    const accountId = conversationAccountId;

    if (!accountId) {
      router.push("/profile");
      return;
    }

    messagesDirtyRef.current = true;
    setMessages((current) => [
      ...current,
      {
        createdAt: new Date().toISOString(),
        id: createMessageId("user"),
        role: "user",
        text: userMessage,
      },
    ]);
    requestScrollToLatest(true);
    resetDraft();
    setSending(true);
    triggerHaptic("light");

    try {
      const [conversationId, accessToken, selectedTrip] = await Promise.all([
        ensureConversationId(),
        getCurrentAuthAccessToken(),
        tripId ? getTripById(tripId) : Promise.resolve(undefined),
      ]);
      const result = await requestProposalGenerationViaPi({
        accessToken: accessToken ?? "",
        accountId,
        conversationId,
        hasSelectedTrip: Boolean(tripId),
        onEvent: (event: AgentUiEvent) => handleAgentUiEvent(event),
        selectedTrip: selectedTrip ?? undefined,
        userMessage,
      });
      await handleProposalGenerationResult(
        result,
        userMessage,
        selectedTrip ?? undefined,
      );
    } catch (error) {
      hideAgentProgress();
      appendMessage(
        "agent",
        error instanceof Error
          ? error.message
          : "旅行助手暂时不可用，请稍后重试。",
      );
      triggerHaptic("warning");
    } finally {
      setSending(false);
      void refreshAgentServiceStatus().catch(() => {});
    }
  };

  const submitMessage = async (text: string = draft) => {
    const content = text.trim();

    if (agentAccessState !== "ready") {
      router.push("/profile");
      return;
    }

    if (agentServiceStatus && !agentServiceStatus.availability.available) {
      return;
    }

    if (!content || isSending) {
      return;
    }

    clearPendingActions();

    await runProposalGenerationTurn(content);
  };

  const cancelProposalGenerationTurn = () => {
    if (!conversationAccountId) return;
    cancelActiveAgentTurn({ accountId: conversationAccountId });
  };

  const handlePendingErrorAction = async () => {
    const retry = pendingError?.retry;
    if (!retry || !conversationAccountId || isSending) {
      setPendingError(undefined);
      return;
    }

    setPendingError(undefined);
    resetDraft();
    setSending(true);
    triggerHaptic("light");
    try {
      const [accessToken, selectedTrip] = await Promise.all([
        getCurrentAuthAccessToken(),
        retry.selectedTripId
          ? getTripById(retry.selectedTripId)
          : Promise.resolve(undefined),
      ]);
      const result = await retryProposalGenerationViaPi({
        accessToken: accessToken ?? "",
        accountId: conversationAccountId,
        conversationId: retry.conversationId,
        onEvent: (event: AgentUiEvent) => handleAgentUiEvent(event),
        selectedTrip: selectedTrip ?? undefined,
        turnId: retry.turnId,
      });
      await handleProposalGenerationResult(
        result,
        retry.userMessage,
        selectedTrip ?? undefined,
      );
    } catch (error) {
      setPendingError({
        actionLabel: "重试",
        detail:
          error instanceof Error ? error.message : "重试失败，请稍后再试。",
        id: createMessageId("agent-error"),
        retry,
        title: "这条消息还没有处理完成",
      });
      triggerHaptic("warning");
    } finally {
      setSending(false);
    }
  };

  const selectTripCandidate = async (candidate: AgentTripTargetCandidate) => {
    if (!pendingTripSelection || isSending) {
      return;
    }

    const selection = pendingTripSelection;
    const userMessage = selection.userMessage;
    setPendingTripSelection(undefined);
    appendMessage("user", `选择行程：${candidate.title}`);

    if (!selection.continuation || !conversationAccountId) {
      setPendingError({
        actionLabel: "重新描述",
        detail: "这条旧请求缺少可继续执行的云端路由信息，请重新发送。",
        id: createMessageId("agent-error"),
        title: "无法继续这条请求",
      });
      triggerHaptic("warning");
      return;
    }

    setSending(true);

    try {
      const [selectedTrip, accessToken] = await Promise.all([
        getTripById(candidate.id),
        getCurrentAuthAccessToken(),
      ]);

      if (!selectedTrip) {
        throw new Error("目标行程已不存在，请重新选择");
      }

      const result = await resumeProposalGenerationViaPi({
        accessToken: accessToken ?? "",
        accountId: conversationAccountId,
        conversationId: selection.continuation.conversationId,
        onEvent: (event: AgentUiEvent) => handleAgentUiEvent(event),
        route: selection.continuation.route,
        selectedTrip,
        turnId: selection.continuation.turnId,
        userMessage,
      });

      await handleProposalGenerationResult(result, userMessage, selectedTrip);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "继续处理行程修改失败，请重试";
      setDraft(userMessage);
      setPendingError({
        actionLabel: "重试",
        detail: message,
        id: createMessageId("agent-error"),
        title: "这条消息还没有处理完成",
      });
      triggerHaptic("warning");
    } finally {
      setSending(false);
    }
  };

  const submitTripDraftDayCount = async (dayCount: number) => {
    await submitTripDraftClarification({ dayCount, kind: "day_count" });
  };

  const submitTripDraftDestination = async (destination: string) => {
    await submitTripDraftClarification({
      destination,
      kind: "destination_text",
    });
  };

  const submitTripDraftClarification = async (
    value:
      | { dayCount: number; kind: "day_count" }
      | { destination: string; kind: "destination_text" },
  ) => {
    const pending = pendingTripDraftClarification;
    if (
      !pending ||
      pending.isSubmitting ||
      !conversationAccountId ||
      isSending
    ) {
      return;
    }
    setPendingTripDraftClarification({
      ...pending,
      error: undefined,
      isSubmitting: true,
    });
    setSending(true);

    try {
      const accessToken = await getCurrentAuthAccessToken();
      const result = await resumeTripDraftProposalGenerationViaPi({
        accessToken: accessToken ?? "",
        accountId: conversationAccountId,
        clarificationId: pending.clarification.clarificationId,
        onEvent: (event: AgentUiEvent) => handleAgentUiEvent(event),
        value,
      });
      await handleProposalGenerationResult(result, pending.userMessage);
    } catch (error) {
      setPendingTripDraftClarification({
        ...pending,
        error:
          error instanceof Error
            ? error.message
            : "继续生成行程草案失败，请稍后重试。",
        isSubmitting: false,
      });
      triggerHaptic("warning");
    } finally {
      setSending(false);
    }
  };

  const loadTripById = async (targetTripId: string) => {
    const loadedTrip = await getTripById(targetTripId);

    if (!loadedTrip) {
      const reply = "目标行程已不存在，请刷新后再试一次。";
      appendMessage("agent", reply);
      setPendingError({
        actionLabel: "知道了",
        detail: reply,
        id: createMessageId("agent-error"),
        title: "行程已不存在",
      });
    }

    return loadedTrip;
  };

  const applyPendingProposal = async () => {
    if (!pendingProposal || pendingProposal.isApplying) {
      return;
    }

    if (pendingProposal.requiresRegeneration) {
      const userMessage = pendingProposal.userMessage;
      setPendingProposal(undefined);
      await submitMessage(userMessage);
      return;
    }

    setPendingProposal((current) =>
      current ? { ...current, isApplying: true, notice: "" } : current,
    );

    try {
      const trip = await loadTripById(pendingProposal.tripId);

      if (!trip) {
        return;
      }

      const applyResult = await applyConfirmedAgentTurn(
        trip,
        pendingProposal.turn,
        pendingProposal.userMessage,
        requiresStrongTripEditConfirmation(pendingProposal.preview)
          ? "strong_confirmation"
          : "explicit_confirmation",
        pendingProposal.debug?.turnId,
      );

      if (!applyResult.ok) {
        failAgentProgressAt("await_confirmation");
        setPendingProposal((current) =>
          current
            ? {
                ...current,
                debug: createProposalDebug(pendingProposal.turn.proposal, {
                  errorCode: "APPLY_FAILED",
                }),
                isApplying: false,
                notice: applyResult.message,
                requiresRegeneration: [
                  "TARGET_NOT_FOUND",
                  "TRIP_MISMATCH",
                  "VERSION_CONFLICT",
                ].includes(applyResult.errorCode ?? ""),
              }
            : current,
        );
        persistTurn({
          errorCode: "APPLY_FAILED",
          proposal: pendingProposal.turn.proposal,
          reply: applyResult.message,
          status: "failed",
          tripId: trip.id,
          tripTitle: trip.title,
          userMessage: pendingProposal.userMessage,
        });
        triggerHaptic("warning");
        return;
      }

      setPendingProposal(undefined);
      hideAgentProgress();
      const operationReceipt = createAgentOperationReceipt(
        pendingProposal.preview,
        trip.title,
      );
      const reply = operationReceipt.title;
      appendMessage(
        "agent",
        reply,
        undefined,
        undefined,
        undefined,
        createProposalDebug(pendingProposal.turn.proposal, {
          operationIds: applyResult.appliedOperationIds,
        }),
        operationReceipt,
      );
      persistTurn({
        operationIds: applyResult.appliedOperationIds,
        proposal: pendingProposal.turn.proposal,
        reply,
        status: "applied",
        tripId: trip.id,
        tripTitle: trip.title,
        userMessage: pendingProposal.userMessage,
      });
      appendRouteSuggestionAfterApply(
        applyResult.trip,
        pendingProposal.turn.proposal,
      );
      triggerHaptic("success");
    } catch (error) {
      failAgentProgressAt("await_confirmation");
      setPendingProposal((current) =>
        current
          ? {
              ...current,
              debug: createProposalDebug(current.turn.proposal, {
                errorCode: "APPLY_FAILED",
              }),
              isApplying: false,
              notice:
                error instanceof Error
                  ? error.message
                  : "应用 Agent 提案失败，请稍后再试",
            }
          : current,
      );
      triggerHaptic("warning");
    }
  };

  const cancelPendingProposal = () => {
    if (!pendingProposal || pendingProposal.isApplying) {
      return;
    }

    setPendingProposal(undefined);
    hideAgentProgress();
    persistTurn({
      proposal: pendingProposal.turn.proposal,
      status: "cancelled",
      tripId: pendingProposal.tripId,
      tripTitle: pendingProposal.tripTitle,
      userMessage: pendingProposal.userMessage,
    });
  };

  const createPendingTripDraftDirectly = async () => {
    if (!pendingTripDraft || pendingTripDraft.isCreating) {
      return;
    }

    setPendingTripDraft((current) =>
      current
        ? {
            ...current,
            isCreating: true,
            notice: "正在创建新行程...",
          }
        : current,
    );

    try {
      const request = createTripCreateRequest({
        confirmation: { kind: "explicit_create" },
        conversationId:
          conversationIdRef.current ??
          `draft:${pendingTripDraft.draft.draftId}`,
        draft: pendingTripDraft.draft,
        turnId:
          pendingTripDraft.debug?.turnId ??
          `draft:${pendingTripDraft.draft.draftId}`,
      });
      if (!request.ok) {
        throw new Error(request.error.message);
      }
      const applyResult = await applyConfirmedTripCreate(request.data);
      if (!("trip" in applyResult)) {
        throw new Error(applyResult.error.message);
      }
      const createdTrip = applyResult.trip;
      await deleteAgentTripDraft(pendingTripDraft.draft.draftId);
      setPendingTripDraft(undefined);
      hideAgentProgress();
      const reply = `已创建「${createdTrip.title}」。`;
      appendMessage("agent", reply, undefined, undefined, undefined, {
        resultType: "trip_draft",
        route: "trip_draft",
      });
      persistTurn({
        mode: "trip_draft",
        provider: pendingTripDraft.draft.source,
        reply,
        status: "applied",
        tripId: createdTrip.id,
        tripTitle: createdTrip.title,
        userMessage: pendingTripDraft.userMessage,
      });
      triggerHaptic("success");
      router.push({
        pathname: "/trips/[id]",
        params: { id: createdTrip.id },
      });
    } catch (error) {
      setPendingTripDraft((current) =>
        current
          ? {
              ...current,
              isCreating: false,
              notice:
                error instanceof Error
                  ? error.message
                  : "创建行程失败，请稍后再试",
            }
          : current,
      );
      persistTurn({
        errorCode: "TRIP_DRAFT_CREATE_FAILED",
        mode: "trip_draft",
        provider: pendingTripDraft.draft.source,
        reply: error instanceof Error ? error.message : "创建行程失败",
        status: "failed",
        userMessage: pendingTripDraft.userMessage,
      });
      triggerHaptic("warning");
    }
  };

  const editPendingTripDraft = async () => {
    if (!pendingTripDraft || pendingTripDraft.isCreating) {
      return;
    }

    await saveAgentTripDraft(pendingTripDraft.draft);
    router.push({
      pathname: "/trips/new",
      params: { draftId: pendingTripDraft.draft.draftId },
    });
  };

  const discardPendingTripDraft = async () => {
    if (!pendingTripDraft || pendingTripDraft.isCreating) {
      return;
    }

    await deleteAgentTripDraft(pendingTripDraft.draft.draftId);
    setPendingTripDraft(undefined);
    hideAgentProgress();
    persistTurn({
      mode: "trip_draft",
      provider: pendingTripDraft.draft.source,
      status: "cancelled",
      userMessage: pendingTripDraft.userMessage,
    });
    triggerHaptic("selection");
  };

  const headerSubtitle =
    conversationScope.type === "trip"
      ? `${conversationScope.tripTitle ?? "当前行程"} · 提案确认后同步`
      : "全局对话 · 提案确认后同步";

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardWrap}
      >
        <View style={styles.topBand}>
          <ScreenHeader
            onBack={showBackButton ? () => router.back() : undefined}
            rightSlot={
              <Pressable
                accessibilityLabel="打开对话列表"
                accessibilityRole="button"
                disabled={isSending}
                hitSlop={10}
                onPress={openHistoryDrawer}
                style={({ pressed }) => [
                  styles.headerButton,
                  pressed && styles.headerButtonPressed,
                  isHistoryVisible && styles.headerButtonActive,
                  isSending && styles.disabledAction,
                ]}
              >
                <MaterialIcons
                  name="forum"
                  size={22}
                  color={theme.colors.primary}
                />
              </Pressable>
            }
            showBackButton={showBackButton}
            subtitle={headerSubtitle}
            title="旅行助手"
          />
        </View>

        <View style={styles.chatViewport}>
          {isConversationLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={theme.colors.primary} size="small" />
            </View>
          ) : (
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => flushPendingScrollToLatest()}
              onLayout={() => flushPendingScrollToLatest()}
              showsVerticalScrollIndicator={false}
              style={styles.chatScroll}
            >
              <View style={styles.chatColumn}>
                <AgentMessageList
                  messages={messages}
                  progressState={progressState}
                />

                <AgentPendingActionStack
                  onApplyProposal={applyPendingProposal}
                  onCancelProposal={cancelPendingProposal}
                  onCreateTripDraft={createPendingTripDraftDirectly}
                  onDiscardTripDraft={discardPendingTripDraft}
                  onDismissError={handlePendingErrorAction}
                  onEditTripDraft={editPendingTripDraft}
                  onSelectTripCandidate={selectTripCandidate}
                  onSubmitDayCount={submitTripDraftDayCount}
                  onSubmitDestination={submitTripDraftDestination}
                  pendingError={pendingError}
                  pendingProposal={pendingProposal}
                  pendingTripDraft={pendingTripDraft}
                  pendingTripDraftClarification={pendingTripDraftClarification}
                  pendingTripSelection={pendingTripSelection}
                />
              </View>
            </ScrollView>
          )}
        </View>

        <View pointerEvents="none" style={styles.inputDockBackdrop} />

        <AgentConversationInputDock
          accessState={agentAccessState}
          bottomInset={bottomDockInset}
          draft={draft}
          executionMode={executionMode}
          executionModeLabel={executionModeLabel}
          isSending={isSending}
          isUsageExpanded={isUsageExpanded}
          onCancel={cancelProposalGenerationTurn}
          onChangeDraft={setDraft}
          onSubmit={submitMessage}
          onLogin={() => router.push("/profile")}
          onToggleExecutionMode={toggleExecutionMode}
          onToggleUsage={() => setUsageExpanded((current) => !current)}
          serviceStatus={agentServiceStatus}
          theme={theme}
        />
      </KeyboardAvoidingView>

      <AgentConversationHistoryDrawer
        activeConversationId={conversationIdRef.current}
        isDisabled={isSending}
        onClose={closeHistoryDrawer}
        onCreateConversation={resetConversation}
        onDeleteConversation={(summary) => {
          void deleteConversation(summary);
        }}
        onRenameConversation={(summary, title) => {
          void renameConversation(summary, title);
        }}
        onSelect={(summary) => {
          void openConversation(summary.id);
        }}
        summaries={conversationSummaries}
        visible={isHistoryVisible}
      />
    </SafeAreaView>
  );
}

function toAgentChatMessage(
  message: AgentConversationMessage,
): AgentChatMessage {
  return {
    audit: message.audit,
    createdAt: message.createdAt,
    debug: message.debug,
    id: message.id,
    operationReceipt: message.operationReceipt,
    role: message.role,
    text: message.text,
    trace: message.trace,
    toolResults: message.toolResults,
  };
}

function createAgentDebugInfo(
  input: Partial<AgentConversationDebug>,
): AgentDebugInfo {
  const debug: AgentDebugInfo = {};

  if (input.errorCode) {
    debug.errorCode = input.errorCode;
  }

  if (input.operationIds?.length) {
    debug.operationIds = input.operationIds;
  }

  if (input.proposalId) {
    debug.proposalId = input.proposalId;
  }

  if (input.resultType) {
    debug.resultType = input.resultType;
  }

  if (input.route) {
    debug.route = input.route;
  }

  if (input.timing) {
    debug.timing = input.timing;
  }

  if (input.turnId) {
    debug.turnId = input.turnId;
  }

  if (input.usage) {
    debug.usage = input.usage;
  }

  return debug;
}

function getAgentCanvasColor(theme: AppTheme) {
  if (theme.mode === "dark") {
    return theme.colors.surfaceSubtle;
  }

  // Keep the Agent canvas in the active skin family without letting the tint dominate the chat.
  switch (theme.id) {
    case "nature":
      return "#F2FAF5";
    case "ocean":
      return "#F1F8FC";
    case "lavender":
      return "#F7F5FC";
    case "cherry":
      return "#FCF5F7";
    default:
      return "#FCF7F1";
  }
}

function createStyles(
  theme: AppTheme,
  bottomInset: number,
  conversationLayout: AgentConversationLayoutPreset,
) {
  const canvasColor = getAgentCanvasColor(theme);
  const inputDockBottom = Math.max(
    Platform.OS === "android" ? 16 : 22,
    bottomInset + 12,
  );
  const inputDockReservedHeight =
    inputDockBottom +
    (conversationLayout.inputDockDensity === "compact" ? 88 : 104);
  const chatColumnMaxWidth =
    conversationLayout.chatColumnWidth === "focused"
      ? Math.min(theme.layout.maxContentWidth, 560)
      : theme.layout.maxContentWidth;

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: canvasColor,
      overflow: "hidden",
    },
    keyboardWrap: {
      flex: 1,
      position: "relative",
      overflow: "hidden",
    },
    topBand: {
      paddingHorizontal: 16,
      paddingTop: 2,
      paddingBottom: 12,
      backgroundColor: canvasColor,
    },
    headerButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 20,
    },
    headerButtonActive: {
      backgroundColor: theme.colors.primarySoft,
    },
    headerButtonPressed: {
      backgroundColor: theme.colors.surfacePressed,
    },
    chatViewport: {
      flex: 1,
      marginBottom: inputDockReservedHeight,
      overflow: "hidden",
      backgroundColor: canvasColor,
    },
    chatScroll: {
      flex: 1,
      backgroundColor: canvasColor,
    },
    loadingState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: canvasColor,
    },
    content: {
      gap: conversationLayout.contentGap,
      paddingTop: 6,
      paddingBottom: Math.max(18, conversationLayout.contentGap),
    },
    chatColumn: {
      width: "100%",
      maxWidth: chatColumnMaxWidth,
      alignSelf: "center",
      gap: conversationLayout.contentGap,
    },
    disabledAction: {
      opacity: 0.58,
    },
    inputDockBackdrop: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: inputDockReservedHeight + 12,
      backgroundColor: canvasColor,
      zIndex: 1,
    },
  });
}
