import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import {
  type AgentProgressState,
  type AgentProgressStepId,
  defaultAgentProgressSteps,
  getAgentProgressStepIndex,
} from "../agent-progress-steps";

export type {
  AgentProgressState,
  AgentProgressStepId,
} from "../agent-progress-steps";

type AgentProgressStatus = "active" | "completed" | "failed" | "idle";

export type AgentProgressCardProps = {
  state: AgentProgressState;
};

export function AgentProgressCard({ state }: AgentProgressCardProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const visibleProgressSteps = state.liveLabel
    ? defaultAgentProgressSteps.filter((step) => step.id === state.activeStepId)
    : defaultAgentProgressSteps;

  if (!state.isVisible) {
    return null;
  }

  return (
    <View style={[styles.messageRow, styles.messageRowAgent]}>
      <View style={styles.avatar}>
        <MaterialIcons
          name="auto-awesome"
          size={15}
          color={theme.colors.primary}
        />
      </View>
      <View style={[styles.bubble, styles.agentBubble, styles.progressBubble]}>
        <Text style={styles.progressTitle}>处理进度</Text>
        {visibleProgressSteps.map((step) => {
          const status = getAgentProgressStepStatus(step.id, state);

          return (
            <View key={step.id} style={styles.progressStepRow}>
              <View style={styles.progressStepIcon}>
                {status === "active" ? (
                  <ActivityIndicator
                    color={theme.colors.primary}
                    size="small"
                  />
                ) : (
                  <MaterialIcons
                    name={getAgentProgressStepIcon(status)}
                    size={16}
                    color={getAgentProgressStepColor(status, theme)}
                  />
                )}
              </View>
              <View style={styles.progressStepCopy}>
                <Text
                  style={[
                    styles.progressStepLabel,
                    status === "active" && styles.progressStepLabelActive,
                    status === "completed" && styles.progressStepLabelCompleted,
                    status === "failed" && styles.progressStepLabelFailed,
                  ]}
                >
                  {status === "active" && state.liveLabel
                    ? state.liveLabel
                    : step.label}
                </Text>
                {!state.liveLabel ? (
                  <Text style={styles.progressStepDescription}>
                    {step.description}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function getAgentProgressStepStatus(
  stepId: AgentProgressStepId,
  state: AgentProgressState,
): AgentProgressStatus {
  if (state.failedStepId === stepId) {
    return "failed";
  }

  if (state.failedStepId) {
    return getAgentProgressStepIndex(stepId) <
      getAgentProgressStepIndex(state.failedStepId)
      ? "completed"
      : "idle";
  }

  if (state.activeStepId === stepId) {
    return "active";
  }

  return getAgentProgressStepIndex(stepId) <
    getAgentProgressStepIndex(state.activeStepId)
    ? "completed"
    : "idle";
}

function getAgentProgressStepIcon(
  status: AgentProgressStatus,
): ComponentProps<typeof MaterialIcons>["name"] {
  switch (status) {
    case "completed":
      return "check-circle";
    case "failed":
      return "error";
    default:
      return "radio-button-unchecked";
  }
}

function getAgentProgressStepColor(
  status: AgentProgressStatus,
  theme: AppTheme,
): string {
  switch (status) {
    case "completed":
      return theme.colors.success;
    case "failed":
      return theme.colors.danger;
    case "active":
      return theme.colors.primary;
    default:
      return theme.colors.textSubtle;
  }
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    messageRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
    },
    messageRowAgent: {
      justifyContent: "flex-start",
    },
    avatar: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      borderWidth: 0,
      borderColor: theme.colors.border,
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
    progressBubble: {
      gap: 12,
      minWidth: 260,
      paddingVertical: 14,
    },
    progressTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 18,
    },
    progressStepRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    progressStepIcon: {
      width: 24,
      height: 24,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceMuted,
    },
    progressStepCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    progressStepLabel: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "800",
      lineHeight: 17,
    },
    progressStepLabelActive: {
      color: theme.colors.primary,
      fontWeight: "900",
    },
    progressStepLabelCompleted: {
      color: theme.colors.text,
    },
    progressStepLabelFailed: {
      color: theme.colors.danger,
    },
    progressStepDescription: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 15,
    },
  });
}
