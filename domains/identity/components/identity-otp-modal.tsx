import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAppTheme } from "@/shared/theme/use-app-theme";

type IdentityOtpModalKind = "email" | "phone";

export function IdentityOtpModal({
  code,
  cooldownSeconds,
  isSending,
  isVerifying,
  kind,
  onChangeCode,
  onChangeTarget,
  onClose,
  onSendCode,
  onVerify,
  subtitle,
  target,
  title,
  verifyLabel,
  visible,
}: {
  code: string;
  cooldownSeconds: number;
  isSending: boolean;
  isVerifying: boolean;
  kind: IdentityOtpModalKind;
  onChangeCode: (value: string) => void;
  onChangeTarget: (value: string) => void;
  onClose: () => void;
  onSendCode: () => void;
  onVerify: () => void;
  subtitle?: string;
  target: string;
  title?: string;
  verifyLabel?: string;
  visible: boolean;
}) {
  const theme = useAppTheme();
  const isEmail = kind === "email";
  const resolvedTitle = title ?? (isEmail ? "绑定邮箱" : "绑定手机号");
  const resolvedSubtitle =
    subtitle ??
    (isEmail
      ? "输入邮箱地址，获取验证码绑定"
      : "输入手机号，获取短信验证码绑定");
  const resolvedVerifyLabel = verifyLabel ?? "验证并绑定";
  const targetPlaceholder = isEmail ? "邮箱地址" : "手机号";

  const handleRequestClose = () => {
    if (!isSending && !isVerifying) {
      onClose();
    }
  };

  return (
    <Modal
      animationType={isEmail ? "fade" : "slide"}
      onRequestClose={handleRequestClose}
      transparent
      visible={visible}
    >
      <View
        style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}
      >
        <View
          style={[
            styles.otpModalCard,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.md,
              ...theme.shadow.sheet,
            },
          ]}
        >
          <Pressable
            accessibilityLabel="关闭"
            accessibilityRole="button"
            disabled={isSending || isVerifying}
            onPress={onClose}
            style={({ pressed }) => [
              styles.otpModalCloseButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <MaterialIcons
              name="close"
              size={20}
              color={theme.colors.textMuted}
            />
          </Pressable>

          <View
            style={[
              styles.otpModalIcon,
              { backgroundColor: theme.colors.primarySoft },
            ]}
          >
            <MaterialIcons
              name={isEmail ? "email" : "sms"}
              size={28}
              color={theme.colors.primary}
            />
          </View>
          <Text style={[styles.otpModalTitle, { color: theme.colors.text }]}>
            {resolvedTitle}
          </Text>
          <Text
            style={[styles.otpModalSubtitle, { color: theme.colors.textMuted }]}
          >
            {resolvedSubtitle}
          </Text>

          <View style={styles.otpModalForm}>
            <View style={styles.otpTargetRow}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={isEmail ? "email-address" : "phone-pad"}
                onChangeText={onChangeTarget}
                placeholder={targetPlaceholder}
                placeholderTextColor={theme.colors.textSubtle}
                style={[
                  styles.otpTargetInput,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                value={target}
              />
              <Pressable
                accessibilityRole="button"
                disabled={isSending || cooldownSeconds > 0}
                onPress={onSendCode}
                style={({ pressed }) => [
                  styles.otpSendButton,
                  { backgroundColor: theme.colors.primary },
                  (isSending || cooldownSeconds > 0) && { opacity: 0.6 },
                  pressed && { backgroundColor: theme.colors.primaryPressed },
                ]}
              >
                <Text
                  style={[
                    styles.otpSendButtonText,
                    { color: theme.colors.onPrimary },
                  ]}
                >
                  {isSending
                    ? "发送中"
                    : cooldownSeconds > 0
                      ? `${cooldownSeconds}s`
                      : "获取验证码"}
                </Text>
              </Pressable>
            </View>

            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              onChangeText={(text) =>
                onChangeCode(text.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="请输入验证码"
              placeholderTextColor={theme.colors.textSubtle}
              style={[
                styles.otpCodeInput,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              value={code}
            />

            <Pressable
              accessibilityRole="button"
              disabled={isVerifying || !code}
              onPress={onVerify}
              style={({ pressed }) => [
                styles.otpVerifyButton,
                { backgroundColor: theme.colors.primary },
                (isVerifying || !code) && { opacity: 0.6 },
                pressed && { backgroundColor: theme.colors.primaryPressed },
              ]}
            >
              {isVerifying ? (
                <ActivityIndicator
                  color={theme.colors.onPrimary}
                  size="small"
                />
              ) : (
                <Text
                  style={[
                    styles.otpVerifyButtonText,
                    { color: theme.colors.onPrimary },
                  ]}
                >
                  {resolvedVerifyLabel}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  otpModalCard: {
    width: "90%",
    maxWidth: 400,
    padding: 24,
    alignItems: "center",
  },
  otpModalCloseButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  otpModalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  otpModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  otpModalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
    textAlign: "center",
  },
  otpModalForm: {
    width: "100%",
    gap: 12,
  },
  otpTargetRow: {
    flexDirection: "row",
    gap: 8,
  },
  otpTargetInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "600",
  },
  otpSendButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  otpSendButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  otpCodeInput: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "600",
  },
  otpVerifyButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  otpVerifyButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
