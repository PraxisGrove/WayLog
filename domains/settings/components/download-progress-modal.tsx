import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAppTheme } from "@/shared/theme/use-app-theme";

export type DownloadProgressModalProps = {
  errorMessage?: string;
  onCancel: () => void;
  onInstall: () => void;
  onRetry: () => void;
  progress: number;
  status: "done" | "downloading" | "error" | "idle" | "installing";
  versionLabel?: string;
  visible: boolean;
};

export function DownloadProgressModal({
  errorMessage,
  onCancel,
  onInstall,
  onRetry,
  progress,
  status,
  versionLabel,
  visible,
}: DownloadProgressModalProps) {
  const theme = useAppTheme();
  const { colors, radius, shadow } = theme;
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
      toValue: progress,
      useNativeDriver: false,
    }).start();
  }, [animatedWidth, progress]);

  const isDownloading = status === "downloading";
  const isInstalling = status === "installing";
  const isError = status === "error";
  const isDone = status === "done";
  const isBusy = isDownloading || isInstalling;

  const statusIcon = isDone
    ? "check-circle"
    : isError
      ? "error-outline"
      : "system-update";
  const statusIconColor = isDone
    ? colors.success
    : isError
      ? colors.danger
      : colors.primary;

  return (
    <Modal
      animationType="fade"
      onRequestClose={isBusy ? undefined : onCancel}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={[styles.root, { backgroundColor: colors.overlay }]}>
        {!isBusy ? (
          <Pressable
            accessibilityLabel="关闭弹窗"
            accessibilityRole="button"
            onPress={isError ? onCancel : undefined}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View
          style={[
            styles.dialog,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              ...shadow.sheet,
            },
          ]}
        >
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDone
                  ? colors.successSoft
                  : isError
                    ? colors.dangerSoft
                    : colors.primarySoft,
              },
            ]}
          >
            {isBusy ? (
              <ActivityIndicator color={colors.primary} size="large" />
            ) : (
              <MaterialIcons
                name={statusIcon}
                size={36}
                color={statusIconColor}
              />
            )}
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            {isDownloading
              ? "正在下载"
              : isInstalling
                ? "正在安装"
                : isDone
                  ? "下载完成"
                  : "下载失败"}
          </Text>

          {versionLabel ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              新版本 {versionLabel}
            </Text>
          ) : null}

          {isDownloading ? (
            <View style={styles.progressSection}>
              <View
                style={[
                  styles.progressTrack,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderRadius: radius.xs,
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.primary,
                      borderRadius: radius.xs,
                      width: animatedWidth.interpolate({
                        inputRange: [0, 100],
                        outputRange: ["0%", "100%"],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: colors.textMuted }]}>
                {progress}%
              </Text>
            </View>
          ) : null}

          {isError && errorMessage ? (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: colors.dangerSoft,
                  borderColor: colors.dangerBorder,
                },
              ]}
            >
              <MaterialIcons
                name="info-outline"
                size={16}
                color={colors.danger}
              />
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {isDone && Platform.OS === "android" ? (
            <Text style={[styles.hintText, { color: colors.textMuted }]}>
              下载完成，点击下方按钮开始安装。安装时请允许来自此来源的应用。
            </Text>
          ) : null}

          <View style={styles.actions}>
            {isDownloading ? (
              <Pressable
                accessibilityRole="button"
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.cancelButton,
                  {
                    borderRadius: radius.sm,
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.surface,
                  },
                  pressed && { backgroundColor: colors.surfacePressed },
                ]}
              >
                <Text style={[styles.cancelText, { color: colors.textMuted }]}>
                  取消下载
                </Text>
              </Pressable>
            ) : null}

            {isDone ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={onCancel}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    {
                      borderRadius: radius.sm,
                      borderColor: colors.borderStrong,
                      backgroundColor: colors.surface,
                    },
                    pressed && { backgroundColor: colors.surfacePressed },
                  ]}
                >
                  <Text
                    style={[styles.cancelText, { color: colors.textMuted }]}
                  >
                    稍后安装
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={onInstall}
                  style={({ pressed }) => [
                    styles.confirmButton,
                    {
                      borderRadius: radius.sm,
                      backgroundColor: colors.primary,
                    },
                    pressed && { backgroundColor: colors.primaryPressed },
                  ]}
                >
                  <MaterialIcons
                    name="install-mobile"
                    size={20}
                    color={colors.onPrimary}
                  />
                  <Text
                    style={[styles.confirmText, { color: colors.onPrimary }]}
                  >
                    立即安装
                  </Text>
                </Pressable>
              </>
            ) : null}

            {isError ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={onCancel}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    {
                      borderRadius: radius.sm,
                      borderColor: colors.borderStrong,
                      backgroundColor: colors.surface,
                    },
                    pressed && { backgroundColor: colors.surfacePressed },
                  ]}
                >
                  <Text
                    style={[styles.cancelText, { color: colors.textMuted }]}
                  >
                    关闭
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={onRetry}
                  style={({ pressed }) => [
                    styles.confirmButton,
                    {
                      borderRadius: radius.sm,
                      backgroundColor: colors.primary,
                    },
                    pressed && { backgroundColor: colors.primaryPressed },
                  ]}
                >
                  <MaterialIcons
                    name="refresh"
                    size={20}
                    color={colors.onPrimary}
                  />
                  <Text
                    style={[styles.confirmText, { color: colors.onPrimary }]}
                  >
                    重试
                  </Text>
                </Pressable>
              </>
            ) : null}

            {isInstalling ? (
              <Text
                style={[styles.installingHint, { color: colors.textMuted }]}
              >
                请在系统安装器中完成安装
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    gap: 16,
    padding: 28,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: -8,
  },
  progressSection: {
    width: "100%",
    gap: 10,
  },
  progressTrack: {
    height: 8,
    width: "100%",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
  },
  progressText: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    textAlign: "center",
  },
  errorBanner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  actions: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    paddingTop: 4,
  },
  cancelButton: {
    minHeight: 46,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "700",
  },
  confirmButton: {
    minHeight: 46,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: "700",
  },
  installingHint: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
});
