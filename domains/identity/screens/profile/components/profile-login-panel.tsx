import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  Animated,
  Image,
  type ImageSourcePropType,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  type getProfileLoginAccountVisualKind,
  profileLoginInputWebFocusStyle,
} from "@/features/auth";
import type { getProfileGlassSurface } from "@/shared/account/profile-visuals";
import type { AppTheme } from "@/shared/theme/theme";

import { ProfileGlassCard } from "../../../components/profile-glass-card";
import type { createProfileScreenStyles } from "../styles/profile-screen.styles";
import type { LoginMascotFocus, LoginMethod } from "../types";

type ProfileLoginPanelProps = {
  agreementChecked: boolean;
  agreementShakeAnim: Animated.Value;
  code: string;
  codeSendDisabled: boolean;
  codeSendLabel: string;
  inputMode:
    | "email"
    | "none"
    | "numeric"
    | "search"
    | "tel"
    | "text"
    | "url"
    | undefined;
  isBusy: boolean;
  keyboardType: "default" | "email-address" | "phone-pad";
  loginAccountVisualKind: ReturnType<typeof getProfileLoginAccountVisualKind>;
  loginMethod: LoginMethod;
  loginMethodDisplayText: string;
  loginMethodNoticeActive: boolean;
  mascotSource: ImageSourcePropType;
  onAppleLogin: () => void;
  onBlurField: (field: Exclude<LoginMascotFocus, null>) => void;
  onChangeAccount: (value: string) => void;
  onChangeCode: (value: string) => void;
  onChangePassword: (value: string) => void;
  onFocusField: (field: Exclude<LoginMascotFocus, null>) => void;
  onGuestLogin: () => void;
  onOpenAgreement: () => void;
  onOpenPrivacy: () => void;
  onRequestCode: () => void;
  onSelectLoginMethod: (method: LoginMethod) => void;
  onSignInWithCode: () => void;
  onSignInWithPassword: () => void;
  onToggleAgreement: () => void;
  onWechatLogin: () => void;
  password: string;
  profileGlassTone: ReturnType<typeof getProfileGlassSurface>;
  resolvedThemeMode: "dark" | "light";
  styles: ReturnType<typeof createProfileScreenStyles>;
  theme: AppTheme;
  value: string;
};

export function ProfileLoginPanel({
  agreementChecked,
  agreementShakeAnim,
  code,
  codeSendDisabled,
  codeSendLabel,
  inputMode,
  isBusy,
  keyboardType,
  loginAccountVisualKind,
  loginMethod,
  loginMethodDisplayText,
  loginMethodNoticeActive,
  mascotSource,
  onAppleLogin,
  onBlurField,
  onChangeAccount,
  onChangeCode,
  onChangePassword,
  onFocusField,
  onGuestLogin,
  onOpenAgreement,
  onOpenPrivacy,
  onRequestCode,
  onSelectLoginMethod,
  onSignInWithCode,
  onSignInWithPassword,
  onToggleAgreement,
  onWechatLogin,
  password,
  profileGlassTone,
  resolvedThemeMode,
  styles,
  theme,
  value,
}: ProfileLoginPanelProps) {
  const methodOptions = [
    { label: "验证码登录", value: "code" as const },
    { label: "密码登录", value: "password" as const },
  ];

  return (
    <ProfileGlassCard
      tone={profileGlassTone}
      style={[
        styles.accountCard,
        styles.profileGlassCard,
        resolvedThemeMode === "light" && styles.loginLightAccountCard,
      ]}
    >
      <View style={styles.loginPanel}>
        <View style={styles.loginHero}>
          <View style={styles.logoStage}>
            <Image
              accessibilityIgnoresInvertColors
              source={mascotSource}
              style={styles.logoImage}
            />
          </View>
          <View style={styles.loginBrandCopy}>
            <Text style={[styles.loginBrand, { color: theme.colors.text }]}>
              一路记
            </Text>
            <Text
              style={[styles.loginTitle, { color: theme.colors.textMuted }]}
            >
              一路有迹，旅程有序
            </Text>
          </View>
        </View>

        <View style={styles.emailForm}>
          <View
            style={[
              styles.loginMethodTabs,
              {
                backgroundColor: profileGlassTone.controlBackgroundColor,
                borderColor: theme.colors.border,
              },
            ]}
          >
            {methodOptions.map((option) => {
              const isSelected = loginMethod === option.value;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={option.value}
                  onPress={() => onSelectLoginMethod(option.value)}
                  style={({ pressed }) => [
                    styles.loginMethodTab,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.primary
                        : "transparent",
                      borderColor: isSelected
                        ? profileGlassTone.selectedBorderColor
                        : "transparent",
                    },
                    pressed && {
                      backgroundColor: profileGlassTone.pressedBackgroundColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.loginMethodTabText,
                      {
                        color: isSelected
                          ? theme.colors.onPrimary
                          : theme.colors.textMuted,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text
            numberOfLines={1}
            style={[
              styles.loginMethodHint,
              {
                color: loginMethodNoticeActive
                  ? theme.colors.danger
                  : theme.colors.textMuted,
              },
            ]}
          >
            {loginMethodDisplayText}
          </Text>
          <View
            style={[
              styles.loginInputShell,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <MaterialIcons
              accessibilityLabel={
                loginAccountVisualKind === "phone" ? "手机号输入" : "邮箱输入"
              }
              name={
                loginAccountVisualKind === "phone"
                  ? "phone-android"
                  : "alternate-email"
              }
              size={19}
              color={theme.colors.textSubtle}
            />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              inputMode={inputMode}
              keyboardType={keyboardType}
              onBlur={() => onBlurField("account")}
              onChangeText={onChangeAccount}
              onFocus={() => onFocusField("account")}
              placeholder="邮箱账号或手机号"
              placeholderTextColor={theme.colors.textSubtle}
              style={[
                styles.loginTextInput,
                profileLoginInputWebFocusStyle,
                {
                  color: theme.colors.text,
                },
              ]}
              value={value}
            />
          </View>

          {loginMethod === "code" ? (
            <View style={styles.loginMethodForm}>
              <View
                style={[
                  styles.codeRow,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <MaterialIcons
                  name="pin"
                  size={19}
                  color={theme.colors.textSubtle}
                />
                <TextInput
                  autoCapitalize="none"
                  keyboardType="number-pad"
                  onBlur={() => onBlurField("code")}
                  onChangeText={onChangeCode}
                  onFocus={() => onFocusField("code")}
                  placeholder="请输入验证码"
                  placeholderTextColor={theme.colors.textSubtle}
                  style={[
                    styles.codeInlineInput,
                    profileLoginInputWebFocusStyle,
                    {
                      color: theme.colors.text,
                    },
                  ]}
                  value={code}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={codeSendDisabled}
                  onPress={onRequestCode}
                  style={({ pressed }) => [
                    styles.codeTextButton,
                    pressed &&
                      !codeSendDisabled && {
                        backgroundColor: theme.colors.primarySoft,
                      },
                  ]}
                >
                  <Text
                    style={[
                      styles.codeTextButtonText,
                      {
                        color: codeSendDisabled
                          ? theme.colors.textSubtle
                          : theme.colors.primary,
                      },
                    ]}
                  >
                    {codeSendLabel}
                  </Text>
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={isBusy}
                onPress={onSignInWithCode}
                style={({ pressed }) => [
                  styles.loginButton,
                  { backgroundColor: theme.colors.primary },
                  pressed && { backgroundColor: theme.colors.primaryPressed },
                  isBusy && { opacity: 0.64 },
                ]}
              >
                <MaterialIcons
                  name="verified-user"
                  size={19}
                  color={theme.colors.onPrimary}
                />
                <Text
                  style={[
                    styles.loginButtonText,
                    { color: theme.colors.onPrimary },
                  ]}
                >
                  {isBusy ? "登录中" : "验证并登录"}
                </Text>
              </Pressable>
              <View pointerEvents="none" style={styles.loginLinkPlaceholder} />
            </View>
          ) : (
            <View style={styles.loginMethodForm}>
              <View
                style={[
                  styles.loginInputShell,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <MaterialIcons
                  name="lock-outline"
                  size={19}
                  color={theme.colors.textSubtle}
                />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onBlur={() => onBlurField("password")}
                  onChangeText={onChangePassword}
                  onFocus={() => onFocusField("password")}
                  placeholder="登录密码"
                  placeholderTextColor={theme.colors.textSubtle}
                  secureTextEntry
                  style={[
                    styles.loginTextInput,
                    profileLoginInputWebFocusStyle,
                    {
                      color: theme.colors.text,
                    },
                  ]}
                  value={password}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={isBusy}
                onPress={onSignInWithPassword}
                style={({ pressed }) => [
                  styles.loginButton,
                  { backgroundColor: theme.colors.primary },
                  pressed && { backgroundColor: theme.colors.primaryPressed },
                  isBusy && { opacity: 0.64 },
                ]}
              >
                <MaterialIcons
                  name="login"
                  size={19}
                  color={theme.colors.onPrimary}
                />
                <Text
                  style={[
                    styles.loginButtonText,
                    { color: theme.colors.onPrimary },
                  ]}
                >
                  {isBusy ? "登录中" : "密码登录"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="切换到验证码登录"
                accessibilityRole="button"
                onPress={() => onSelectLoginMethod("code")}
                style={({ pressed }) => [
                  styles.loginLinkButton,
                  pressed && { backgroundColor: theme.colors.primarySoft },
                ]}
              >
                <Text
                  style={[
                    styles.loginLinkButtonText,
                    { color: theme.colors.primary },
                  ]}
                >
                  忘记密码？用验证码登录
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <Animated.View
          style={{ transform: [{ translateX: agreementShakeAnim }] }}
        >
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreementChecked }}
            onPress={onToggleAgreement}
            style={styles.agreementRow}
          >
            <View
              style={[
                styles.agreementCheck,
                agreementChecked
                  ? { backgroundColor: theme.colors.primary }
                  : {
                      backgroundColor: "transparent",
                      borderColor: theme.colors.border,
                      borderWidth: 1.5,
                    },
              ]}
            >
              {agreementChecked ? (
                <MaterialIcons
                  name="check"
                  size={13}
                  color={theme.colors.onPrimary}
                />
              ) : null}
            </View>
            <Text
              style={[styles.agreementText, { color: theme.colors.textMuted }]}
            >
              我已阅读并同意
              <Text
                onPress={(event) => {
                  event.stopPropagation();
                  onOpenAgreement();
                }}
                style={{ color: theme.colors.primary, fontWeight: "700" }}
              >
                《用户协议》
              </Text>
              和
              <Text
                onPress={(event) => {
                  event.stopPropagation();
                  onOpenPrivacy();
                }}
                style={{ color: theme.colors.primary, fontWeight: "700" }}
              >
                《隐私政策》
              </Text>
            </Text>
          </Pressable>
        </Animated.View>

        <View style={styles.socialLoginSection}>
          <View style={styles.socialLoginDividerRow}>
            <View
              style={[
                styles.socialLoginDividerLine,
                { backgroundColor: theme.colors.border },
              ]}
            />
            <Text
              style={[
                styles.socialLoginDividerText,
                { color: theme.colors.textSubtle },
              ]}
            >
              其他方式登录
            </Text>
            <View
              style={[
                styles.socialLoginDividerLine,
                { backgroundColor: theme.colors.border },
              ]}
            />
          </View>
          <View style={styles.socialLoginIcons}>
            <Pressable
              accessibilityLabel="微信登录"
              accessibilityRole="button"
              disabled={isBusy}
              onPress={onWechatLogin}
              style={({ pressed }) => [
                styles.socialLoginIconWrap,
                pressed && { opacity: 0.7 },
              ]}
            >
              <View
                style={[styles.socialLoginIcon, { backgroundColor: "#07C160" }]}
              >
                <FontAwesome name="wechat" size={24} color="#FFFFFF" />
              </View>
              <Text
                style={[
                  styles.socialLoginLabel,
                  { color: theme.colors.textMuted },
                ]}
              >
                微信
              </Text>
            </Pressable>
            {Platform.OS === "ios" ? (
              <Pressable
                accessibilityLabel="通过 Apple 登录"
                accessibilityRole="button"
                disabled={isBusy}
                onPress={onAppleLogin}
                style={({ pressed }) => [
                  styles.socialLoginIconWrap,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View
                  style={[
                    styles.socialLoginIcon,
                    { backgroundColor: "#000000" },
                  ]}
                >
                  <MaterialIcons name="apple" size={24} color="#FFFFFF" />
                </View>
                <Text
                  style={[
                    styles.socialLoginLabel,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  Apple
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityLabel="游客模式进入"
              accessibilityRole="button"
              disabled={isBusy}
              onPress={onGuestLogin}
              style={({ pressed }) => [
                styles.socialLoginIconWrap,
                (pressed || isBusy) && { opacity: isBusy ? 0.5 : 0.7 },
              ]}
            >
              <View
                style={[
                  styles.socialLoginIcon,
                  styles.guestLoginIcon,
                  {
                    backgroundColor: theme.colors.primarySoft,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <MaterialIcons
                  name="person-outline"
                  size={25}
                  color={theme.colors.primary}
                />
              </View>
              <Text
                style={[
                  styles.socialLoginLabel,
                  { color: theme.colors.textMuted },
                ]}
              >
                游客
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ProfileGlassCard>
  );
}
