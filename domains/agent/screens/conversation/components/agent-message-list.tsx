import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps } from "react";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type {
  AgentConversationAudit,
  AgentConversationOperationReceipt,
  AgentConversationToolResult,
  AgentConversationTraceEvent,
} from "@/features/agent";
import { createAgentConversationTraceEventKey } from "@/features/agent";
import {
  AgentToolResultStack,
  createAgentToolResultCardItemsFromResults,
  createAgentToolResultPreviewItems,
} from "@/shared/agent/agent-tool-result-cards";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme, useSkinSlot } from "@/shared/theme/use-app-theme";

import type { AgentDebugInfo } from "../agent-conversation.types";
import { AgentAuditRow } from "./agent-audit-row";
import { AgentDebugDetails } from "./agent-debug-details";
import {
  AgentProgressCard,
  type AgentProgressState,
} from "./agent-progress-card";
import { AgentPromptSuggestionList } from "./agent-prompt-suggestion-list";

export type AgentChatMessage = {
  audit?: AgentConversationAudit;
  createdAt: string;
  debug?: AgentDebugInfo;
  id: string;
  operationReceipt?: AgentConversationOperationReceipt;
  role: "agent" | "user";
  text: string;
  trace?: AgentConversationTraceEvent[];
  toolResults?: AgentConversationToolResult[];
};

export type AgentMessageListProps = {
  messages: AgentChatMessage[];
  progressState: AgentProgressState;
};

const toolResultPreviewItems = createAgentToolResultPreviewItems();

export function AgentMessageList({
  messages,
  progressState,
}: AgentMessageListProps) {
  const theme = useAppTheme();
  const messageBubbleSlot = useSkinSlot("agent.messageBubble");
  const styles = createStyles(theme);
  const [expandedAuditMessageIds, setExpandedAuditMessageIds] = useState(
    () => new Set<string>(),
  );
  const [expandedDebugMessageIds, setExpandedDebugMessageIds] = useState(
    () => new Set<string>(),
  );

  const toggleAuditDetails = (messageId: string) => {
    setExpandedAuditMessageIds((current) => {
      const next = new Set(current);

      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }

      return next;
    });
  };

  const toggleDebugDetails = (messageId: string) => {
    setExpandedDebugMessageIds((current) => {
      const next = new Set(current);

      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }

      return next;
    });
  };

  return (
    <View style={styles.messageList}>
      {messages.map((message) => {
        const isUser = message.role === "user";
        const isWelcomeMessage = message.id === "agent-welcome";
        const toolResults = createAgentToolResultCardItemsFromResults(
          message.toolResults,
        );
        const traceEvents = message.trace ?? [];
        const shouldShowAudit =
          !isUser && !isWelcomeMessage && Boolean(message.audit);
        const shouldShowDebug =
          !isUser && !isWelcomeMessage && Boolean(message.debug);

        return (
          <View
            key={`${messageBubbleSlot.adapterId}-${message.id}`}
            style={[
              styles.messageRow,
              isUser ? styles.messageRowUser : styles.messageRowAgent,
              isWelcomeMessage && styles.welcomeRow,
            ]}
          >
            {!isUser && !isWelcomeMessage ? (
              <View style={styles.avatar}>
                <MaterialIcons
                  name="auto-awesome"
                  size={15}
                  color={theme.colors.primary}
                />
              </View>
            ) : null}
            <View
              style={[
                styles.bubble,
                isUser ? styles.userBubble : styles.agentBubble,
                isWelcomeMessage && styles.welcomeBubble,
                message.operationReceipt && styles.receiptBubble,
              ]}
            >
              {isWelcomeMessage ? (
                <View style={styles.welcomeHeader}>
                  <View style={styles.welcomeStub}>
                    <MaterialIcons
                      name="school"
                      size={15}
                      color={theme.colors.primary}
                    />
                    <Text style={styles.welcomeStubText}>使用引导</Text>
                  </View>
                  <Text style={styles.welcomeTitle}>一路记旅行助手</Text>
                  <Text style={styles.welcomeText}>{message.text}</Text>
                </View>
              ) : message.operationReceipt ? (
                <View style={styles.operationReceipt}>
                  <View style={styles.operationReceiptIcon}>
                    <MaterialIcons
                      name="check"
                      size={15}
                      color={theme.colors.success}
                    />
                  </View>
                  <View style={styles.operationReceiptCopy}>
                    <Text style={styles.operationReceiptTitle}>
                      {message.operationReceipt.title}
                    </Text>
                    {message.operationReceipt.detail ? (
                      <Text style={styles.operationReceiptDetail}>
                        {message.operationReceipt.detail}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : (
                <>
                  <Text
                    style={[
                      styles.messageText,
                      isUser ? styles.userMessageText : styles.agentMessageText,
                    ]}
                  >
                    {message.text}
                  </Text>
                  {toolResults.length > 0 ? (
                    <View style={styles.messageToolResults}>
                      <AgentToolResultStack items={toolResults} />
                    </View>
                  ) : null}
                  {traceEvents.length > 0 ? (
                    <AgentTraceRow events={traceEvents} />
                  ) : null}
                  {shouldShowAudit ? (
                    <AgentAuditRow
                      audit={message.audit}
                      expanded={expandedAuditMessageIds.has(message.id)}
                      onToggle={() => toggleAuditDetails(message.id)}
                    />
                  ) : null}
                  {shouldShowDebug ? (
                    <AgentDebugDetails
                      debug={message.debug}
                      expanded={expandedDebugMessageIds.has(message.id)}
                      onToggle={() => toggleDebugDetails(message.id)}
                    />
                  ) : null}
                </>
              )}
              {isWelcomeMessage ? (
                <>
                  <AgentPromptSuggestionList />
                  {__DEV__ ? (
                    <View style={styles.toolPreviewSection}>
                      <View style={styles.toolPreviewHeader}>
                        <View style={styles.toolPreviewIcon}>
                          <MaterialIcons
                            name="developer-mode"
                            size={15}
                            color={theme.colors.primary}
                          />
                        </View>
                        <View style={styles.toolPreviewCopy}>
                          <Text style={styles.toolPreviewLabel}>
                            开发预览 · 工具结果
                          </Text>
                          <Text style={styles.toolPreviewText}>
                            仅开发环境显示，不会出现在正式用户的引导页。
                          </Text>
                        </View>
                      </View>
                      <AgentToolResultStack items={toolResultPreviewItems} />
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>
          </View>
        );
      })}

      <AgentProgressCard state={progressState} />
    </View>
  );
}

function AgentTraceRow({ events }: { events: AgentConversationTraceEvent[] }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.traceWrap}>
      {events.slice(0, 4).map((event, index) => (
        <View
          key={createAgentConversationTraceEventKey(event, index)}
          style={[
            styles.tracePill,
            event.status === "warning" && styles.tracePillWarning,
          ]}
        >
          <MaterialIcons
            name={getTraceIcon(event)}
            size={12}
            color={
              event.status === "warning"
                ? theme.colors.warning
                : theme.colors.textMuted
            }
          />
          <Text numberOfLines={1} style={styles.traceText}>
            {event.label}
          </Text>
        </View>
      ))}
      {events.length > 4 ? (
        <Text style={styles.traceMoreText}>+{events.length - 4}</Text>
      ) : null}
    </View>
  );
}

function getTraceIcon(
  event: AgentConversationTraceEvent,
): ComponentProps<typeof MaterialIcons>["name"] {
  if (event.status === "warning") {
    return "error-outline";
  }

  switch (event.kind) {
    case "route_selector":
      return "alt-route";
    case "planner":
      return "fact-check";
    case "skill":
      return "extension";
    case "tool":
      return "build-circle";
    case "trip_context":
      return "folder-open";
    default:
      return "check-circle";
  }
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    messageList: {
      gap: 14,
      paddingHorizontal: theme.layout.contentPadding,
    },
    messageRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
    },
    messageRowAgent: {
      justifyContent: "flex-start",
    },
    messageRowUser: {
      justifyContent: "flex-end",
    },
    avatar: {
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 7,
      backgroundColor: "#A3E635",
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      ...theme.shadow.card,
    },
    bubble: {
      maxWidth: "84%",
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderRadius: theme.radius.lg,
      borderWidth: 0,
    },
    agentBubble: {
      borderBottomLeftRadius: theme.radius.xs,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    userBubble: {
      borderBottomRightRadius: theme.radius.xs,
      borderColor: theme.colors.primaryBorder,
      backgroundColor: theme.colors.primarySoft,
    },
    messageText: {
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 22,
    },
    messageToolResults: {
      marginTop: 11,
    },
    traceWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 10,
    },
    tracePill: {
      maxWidth: "100%",
      minHeight: 24,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
      borderWidth: 0,
      borderColor: theme.colors.border,
    },
    tracePillWarning: {
      backgroundColor: theme.colors.warningSoft,
      borderColor: theme.colors.warningBorder,
    },
    traceText: {
      maxWidth: 170,
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
      lineHeight: 13,
    },
    traceMoreText: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
      lineHeight: 24,
    },
    agentMessageText: {
      color: theme.colors.text,
    },
    operationReceipt: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.success,
      borderRadius: 6,
      backgroundColor: theme.colors.successSoft,
    },
    operationReceiptIcon: {
      width: 26,
      height: 26,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 13,
      backgroundColor: theme.colors.successSoft,
    },
    operationReceiptCopy: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    operationReceiptTitle: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "900",
      lineHeight: 18,
    },
    operationReceiptDetail: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 15,
    },
    receiptBubble: {
      paddingHorizontal: 0,
      paddingVertical: 0,
      backgroundColor: "transparent",
    },
    userMessageText: {
      color: theme.mode === "dark" ? theme.colors.text : "#1C2A31",
    },
    welcomeBubble: {
      width: "100%",
      maxWidth: 560,
      gap: 16,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      borderBottomLeftRadius: theme.radius.sm,
      overflow: "hidden",
    },
    welcomeRow: {
      width: "100%",
      justifyContent: "center",
      marginHorizontal: -theme.layout.contentPadding,
      paddingHorizontal: theme.layout.contentPadding + 2,
    },
    welcomeHeader: {
      gap: 8,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 4,
    },
    welcomeStub: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
    },
    welcomeStubText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: "900",
      lineHeight: 14,
    },
    welcomeTitle: {
      color: theme.colors.text,
      fontSize: 21,
      fontWeight: "900",
      lineHeight: 27,
    },
    welcomeText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 21,
    },
    toolPreviewSection: {
      gap: 11,
      paddingHorizontal: 14,
      paddingBottom: 14,
    },
    toolPreviewHeader: {
      minHeight: 38,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 2,
    },
    toolPreviewIcon: {
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      backgroundColor: theme.colors.primarySoft,
    },
    toolPreviewCopy: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    toolPreviewLabel: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "900",
      lineHeight: 17,
    },
    toolPreviewText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 15,
    },
  });
}
