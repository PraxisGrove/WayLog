import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

import {
  type ProfileLoginStatusTone,
  profileLoginInputWebFocusStyle,
} from "@/features/auth";
import type { AppTheme } from "@/shared/theme/theme";

import type { createProfileScreenStyles } from "../styles/profile-screen.styles";

type PasswordSetupPromptModalProps = {
  confirmPassword: string;
  defaultStatusMessage: string;
  isBusy: boolean;
  onChangeConfirmPassword: (value: string) => void;
  onChangePassword: (value: string) => void;
  onDismiss: () => void;
  onSubmit: () => void;
  password: string;
  pendingGuestMigration: boolean;
  statusMessage: string;
  statusTone: ProfileLoginStatusTone;
  styles: ReturnType<typeof createProfileScreenStyles>;
  theme: AppTheme;
  visible: boolean;
};

export function PasswordSetupPromptModal({
  confirmPassword,
  defaultStatusMessage,
  isBusy,
  onChangeConfirmPassword,
  onChangePassword,
  onDismiss,
  onSubmit,
  password,
  pendingGuestMigration,
  statusMessage,
  statusTone,
  styles,
  theme,
  visible,
}: PasswordSetupPromptModalProps) {
  const showError =
    statusTone === "error" && statusMessage !== defaultStatusMessage;

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => {
        if (!isBusy && !pendingGuestMigration) {
          onDismiss();
        }
      }}
      transparent
      visible={visible && !pendingGuestMigration}
    >
      <View
        style={[
          styles.passwordPromptOverlay,
          { backgroundColor: theme.colors.overlay },
        ]}
      >
        <View
          style={[
            styles.passwordPromptCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Pressable
            accessibilityLabel="关闭设置密码提示"
            accessibilityRole="button"
            disabled={isBusy}
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.passwordPromptCloseButton,
              {
                backgroundColor: theme.colors.surfaceMuted,
              },
              pressed && { backgroundColor: theme.colors.surfacePressed },
              isBusy && { opacity: 0.56 },
            ]}
          >
            <MaterialIcons
              name="close"
              size={18}
              color={theme.colors.textMuted}
            />
          </Pressable>
          <View
            style={[
              styles.passwordPromptIcon,
              { backgroundColor: theme.colors.primarySoft },
            ]}
          >
            <MaterialIcons
              name="lock-outline"
              size={28}
              color={theme.colors.primary}
            />
          </View>
          <Text
            style={[styles.passwordPromptTitle, { color: theme.colors.text }]}
          >
            设置登录密码
          </Text>
          <Text
            style={[
              styles.passwordPromptBody,
              { color: theme.colors.textMuted },
            ]}
          >
            这次已经用邮箱验证码创建账号。设置密码后，下次可以直接用邮箱和密码登录。
          </Text>
          <View style={styles.passwordPromptForm}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={onChangePassword}
              placeholder="至少 8 位密码"
              placeholderTextColor={theme.colors.textSubtle}
              secureTextEntry
              style={[
                styles.input,
                profileLoginInputWebFocusStyle,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              value={password}
            />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={onChangeConfirmPassword}
              placeholder="再次输入密码"
              placeholderTextColor={theme.colors.textSubtle}
              secureTextEntry
              style={[
                styles.input,
                profileLoginInputWebFocusStyle,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              value={confirmPassword}
            />
          </View>
          {showError ? (
            <Text
              style={[styles.statusMessage, { color: theme.colors.danger }]}
            >
              {statusMessage}
            </Text>
          ) : null}
          <View style={styles.passwordPromptActions}>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={onDismiss}
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.passwordPromptAction,
                { borderColor: theme.colors.border },
                pressed && { backgroundColor: theme.colors.surfacePressed },
              ]}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: theme.colors.text },
                ]}
              >
                稍后再说
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={onSubmit}
              style={({ pressed }) => [
                styles.primaryButton,
                styles.passwordPromptAction,
                { backgroundColor: theme.colors.primary },
                pressed && { backgroundColor: theme.colors.primaryPressed },
                isBusy && { opacity: 0.64 },
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: theme.colors.onPrimary },
                ]}
              >
                {isBusy ? "设置中" : "设置密码"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
