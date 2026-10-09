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

export function DeleteAccountDialog({
  confirmText,
  error,
  inputValue,
  isDeleting,
  onCancel,
  onChangeInput,
  onConfirm,
  visible,
}: {
  confirmText: string;
  error: string;
  inputValue: string;
  isDeleting: boolean;
  onCancel: () => void;
  onChangeInput: (value: string) => void;
  onConfirm: () => void;
  visible: boolean;
}) {
  const theme = useAppTheme();
  const isConfirmDisabled = isDeleting || inputValue.trim() !== confirmText;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}
      >
        <Pressable
          accessibilityLabel="关闭确认弹窗"
          accessibilityRole="button"
          disabled={isDeleting}
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.deleteDialog,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.md,
              ...theme.shadow.sheet,
            },
          ]}
        >
          <View style={styles.deleteDialogHeader}>
            <View
              style={[
                styles.deleteDialogIcon,
                { backgroundColor: theme.colors.dangerSoft },
              ]}
            >
              <MaterialIcons
                name="warning"
                size={28}
                color={theme.colors.danger}
              />
            </View>
            <Text
              style={[styles.deleteDialogTitle, { color: theme.colors.text }]}
            >
              注销账号
            </Text>
          </View>

          <View
            style={[
              styles.deleteDialogWarning,
              {
                backgroundColor: theme.colors.dangerSoft,
                borderColor: theme.colors.dangerBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.deleteDialogWarningText,
                { color: theme.colors.danger },
              ]}
            >
              此操作不可撤销，以下数据将被永久删除：
            </Text>
            <Text
              style={[
                styles.deleteDialogWarningItem,
                { color: theme.colors.textMuted },
              ]}
            >
              所有行程和日程安排
            </Text>
            <Text
              style={[
                styles.deleteDialogWarningItem,
                { color: theme.colors.textMuted },
              ]}
            >
              收藏的地点
            </Text>
            <Text
              style={[
                styles.deleteDialogWarningItem,
                { color: theme.colors.textMuted },
              ]}
            >
              个人资料和头像
            </Text>
            <Text
              style={[
                styles.deleteDialogWarningItem,
                { color: theme.colors.textMuted },
              ]}
            >
              登录身份（邮箱、手机、微信）
            </Text>
          </View>

          <View style={styles.deleteDialogInputSection}>
            <Text
              style={[
                styles.deleteDialogInputLabel,
                { color: theme.colors.text },
              ]}
            >
              请输入 <Text style={{ fontWeight: "900" }}>“{confirmText}”</Text>{" "}
              以确认注销：
            </Text>
            <TextInput
              editable={!isDeleting}
              onChangeText={onChangeInput}
              placeholder={confirmText}
              placeholderTextColor={theme.colors.textSubtle}
              style={[
                styles.deleteDialogInput,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: error
                    ? theme.colors.danger
                    : theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              value={inputValue}
            />
            {error ? (
              <Text
                style={[
                  styles.deleteDialogError,
                  { color: theme.colors.danger },
                ]}
              >
                {error}
              </Text>
            ) : null}
          </View>

          <View style={styles.deleteDialogActions}>
            <Pressable
              accessibilityRole="button"
              disabled={isDeleting}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.deleteDialogCancelButton,
                {
                  borderRadius: theme.radius.sm,
                  borderColor: theme.colors.borderStrong,
                  backgroundColor: theme.colors.surface,
                },
                pressed && { backgroundColor: theme.colors.surfacePressed },
              ]}
            >
              <Text
                style={[
                  styles.deleteDialogCancelText,
                  { color: theme.colors.textMuted },
                ]}
              >
                取消
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isConfirmDisabled}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.deleteDialogConfirmButton,
                { borderRadius: theme.radius.sm },
                {
                  backgroundColor: isConfirmDisabled
                    ? theme.colors.textSubtle
                    : theme.colors.danger,
                },
                pressed &&
                  !isConfirmDisabled && {
                    backgroundColor: theme.colors.dangerPressed,
                  },
              ]}
            >
              {isDeleting ? (
                <ActivityIndicator
                  color={theme.colors.onPrimary}
                  size="small"
                />
              ) : (
                <Text
                  style={[
                    styles.deleteDialogConfirmText,
                    { color: theme.colors.onPrimary },
                  ]}
                >
                  确认注销
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
  deleteDialog: {
    width: "100%",
    maxWidth: 400,
    gap: 16,
    padding: 24,
  },
  deleteDialogHeader: {
    alignItems: "center",
    gap: 12,
  },
  deleteDialogIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteDialogTitle: {
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 28,
  },
  deleteDialogWarning: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  deleteDialogWarningText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  deleteDialogWarningItem: {
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 8,
  },
  deleteDialogInputSection: {
    gap: 8,
  },
  deleteDialogInputLabel: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  deleteDialogInput: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "600",
  },
  deleteDialogError: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  deleteDialogActions: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 4,
  },
  deleteDialogCancelButton: {
    minHeight: 48,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  deleteDialogCancelText: {
    fontSize: 15,
    fontWeight: "700",
  },
  deleteDialogConfirmButton: {
    minHeight: 48,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteDialogConfirmText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
