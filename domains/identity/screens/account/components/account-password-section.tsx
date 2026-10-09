import { Pressable, Text, TextInput, View } from "react-native";
import { profileLoginInputWebFocusStyle } from "@/features/auth";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import { accountScreenStyles as styles } from "../account-screen.styles";
import type { useAccountController } from "../hooks/use-account-controller";
import {
  AccountSettingRow,
  AccountSettingSection,
} from "./account-setting-section";

type AccountController = ReturnType<typeof useAccountController>;

export function AccountPasswordSection({
  isBusy,
  isPasswordEditorVisible,
  onCancelPasswordEdit,
  onPasswordPress,
  onSavePassword,
  passwordConfirmValue,
  passwordState,
  passwordValue,
  profileGlassTone,
  setPasswordConfirmValue,
  setPasswordValue,
}: {
  isBusy: boolean;
  isPasswordEditorVisible: boolean;
  onCancelPasswordEdit: () => void;
  onPasswordPress: () => void;
  onSavePassword: () => void;
  passwordConfirmValue: string;
  passwordState: AccountController["passwordState"];
  passwordValue: string;
  profileGlassTone: AccountController["profileGlassTone"];
  setPasswordConfirmValue: (value: string) => void;
  setPasswordValue: (value: string) => void;
}) {
  const theme = useAppTheme();

  return (
    <AccountSettingSection title="密码与安全" tone={profileGlassTone}>
      <AccountSettingRow
        description={passwordState.description}
        icon="lock-outline"
        isLast={!isPasswordEditorVisible}
        onPress={onPasswordPress}
        status={passwordState.statusLabel}
        title="登录密码"
        tone={profileGlassTone}
      />
      {isPasswordEditorVisible ? (
        <View style={styles.passwordEditor}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isBusy}
            onChangeText={setPasswordValue}
            placeholder={passwordState.actionLabel}
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
            value={passwordValue}
          />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isBusy}
            onChangeText={setPasswordConfirmValue}
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
            value={passwordConfirmValue}
          />
          <View style={styles.passwordActions}>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={onCancelPasswordEdit}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.colors.border },
                pressed && {
                  backgroundColor: theme.colors.surfacePressed,
                },
              ]}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: theme.colors.text },
                ]}
              >
                取消
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={onSavePassword}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.colors.primary },
                pressed && {
                  backgroundColor: theme.colors.primaryPressed,
                },
                isBusy && { opacity: 0.64 },
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: theme.colors.onPrimary },
                ]}
              >
                {isBusy ? "保存中" : passwordState.actionLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </AccountSettingSection>
  );
}
