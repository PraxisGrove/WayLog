import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { AgentAccessState, AgentServiceStatus } from "@/features/agent";
import type { AppTheme } from "@/shared/theme/theme";
import { ToggleSwitch } from "@/shared/ui/toggle-switch";

import type { AgentExecutionMode } from "../agent-conversation.types";
import { AgentUsageStatus } from "./agent-usage-status";

export type AgentConversationInputDockProps = {
  accessState: AgentAccessState;
  bottomInset: number;
  draft: string;
  executionMode: AgentExecutionMode;
  executionModeLabel: string;
  isSending: boolean;
  isUsageExpanded: boolean;
  onCancel: () => void;
  onChangeDraft: (value: string) => void;
  onLogin: () => void;
  onSubmit: () => void;
  onToggleExecutionMode: (nextAuto: boolean) => void;
  onToggleUsage: () => void;
  serviceStatus?: AgentServiceStatus;
  theme: AppTheme;
};

export function AgentConversationInputDock({
  accessState,
  bottomInset,
  draft,
  executionMode,
  executionModeLabel,
  isSending,
  isUsageExpanded,
  onChangeDraft,
  onLogin,
  onCancel,
  onSubmit,
  onToggleExecutionMode,
  onToggleUsage,
  serviceStatus,
  theme,
}: AgentConversationInputDockProps) {
  const styles = createStyles(theme, bottomInset);
  const isSignedIn = accessState === "ready";
  const isReady = isSignedIn && (serviceStatus?.availability.available ?? true);
  const isSendDisabled = !isReady || (!isSending && draft.trim().length === 0);

  return (
    <View style={styles.inputDock}>
      <AgentUsageStatus
        expanded={isUsageExpanded}
        onToggle={onToggleUsage}
        status={serviceStatus}
      />
      <View style={styles.inputCard}>
        <TextInput
          accessibilityLabel="输入给旅行助手的消息"
          editable={isReady && !isSending}
          multiline
          onChangeText={onChangeDraft}
          onSubmitEditing={() => onSubmit()}
          placeholder={
            accessState === "loading"
              ? "正在检查登录状态..."
              : !isSignedIn
                ? "登录后使用旅行助手"
                : isReady
                  ? "说说你想规划或调整什么..."
                  : "旅行助手当前不可用"
          }
          placeholderTextColor={theme.colors.placeholder}
          returnKeyType="send"
          style={styles.input}
          value={draft}
        />
        <View style={styles.inputToolbar}>
          {isSignedIn ? (
            <View style={styles.modeToggle}>
              <Text style={styles.modeToggleText} numberOfLines={1}>
                {executionModeLabel}
              </Text>
              <ToggleSwitch
                accessibilityLabel={`切换到${executionMode === "confirm" ? "快捷代办" : "安心确认"}`}
                disabled={isSending || !isReady}
                onValueChange={onToggleExecutionMode}
                value={executionMode === "auto"}
                variant="accent"
              />
            </View>
          ) : (
            <Pressable
              accessibilityLabel="前往登录"
              accessibilityRole="button"
              disabled={accessState === "loading"}
              onPress={onLogin}
              style={({ pressed }) => [
                styles.loginButton,
                pressed && styles.loginButtonPressed,
              ]}
            >
              <MaterialIcons
                name="login"
                size={16}
                color={theme.colors.primary}
              />
              <Text style={styles.loginButtonText}>登录后使用旅行助手</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityLabel={isSending ? "取消当前处理" : "发送消息"}
            accessibilityRole="button"
            disabled={isSendDisabled}
            hitSlop={6}
            onPress={() => (isSending ? onCancel() : onSubmit())}
            style={({ pressed }) => [
              styles.sendButton,
              isSendDisabled && styles.sendButtonDisabled,
              pressed && !isSendDisabled && styles.sendButtonPressed,
            ]}
          >
            {isSending ? (
              <MaterialIcons
                name="stop"
                size={20}
                color={theme.colors.onPrimary}
              />
            ) : (
              <MaterialIcons
                name="near-me"
                size={20}
                color={theme.colors.onPrimary}
              />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme, bottomInset: number) {
  const inputDockBottom = Math.max(
    Platform.OS === "android" ? 16 : 22,
    bottomInset + 12,
  );

  return StyleSheet.create({
    inputDock: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: inputDockBottom,
      width: "100%",
      paddingHorizontal: theme.layout.contentPadding,
      alignItems: "center",
      zIndex: 2,
    },
    inputCard: {
      width: "100%",
      maxWidth: theme.layout.maxContentWidth,
      borderWidth: 0,
      borderColor: "transparent",
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surface,
      ...theme.shadow.card,
    },
    input: {
      width: "100%",
      minHeight: 56,
      maxHeight: 112,
      paddingHorizontal: 14,
      paddingTop: Platform.OS === "ios" ? 14 : 12,
      paddingBottom: 6,
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 21,
      ...(Platform.OS === "web"
        ? {
            outlineStyle: "solid",
            outlineWidth: 0,
          }
        : null),
    },
    inputToolbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      paddingRight: 8,
      paddingBottom: 7,
      paddingTop: 2,
    },
    modeToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingLeft: 6,
    },
    modeToggleText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 16,
    },
    loginButton: {
      minHeight: 30,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 6,
    },
    loginButtonPressed: {
      opacity: 0.7,
    },
    loginButtonText: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 16,
    },
    sendButton: {
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
    },
    sendButtonPressed: {
      backgroundColor: theme.colors.primaryPressed,
    },
    sendButtonDisabled: {
      backgroundColor: theme.colors.disabled,
    },
  });
}
