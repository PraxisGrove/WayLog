import { StyleSheet, View } from "react-native";

import { AppButton } from "./app-button";
import { AppDialog } from "./app-dialog";

type ConfirmDialogProps = {
  cancelLabel?: string;
  confirmButtonTone?: "danger" | "primary";
  confirmLabel?: string;
  dismissOnBackdropPress?: boolean;
  isProcessing?: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  onRequestClose?: () => void;
  processingLabel?: string;
  title: string;
  visible: boolean;
};

export function ConfirmDialog({
  cancelLabel = "取消",
  confirmButtonTone = "danger",
  confirmLabel = "确认删除",
  dismissOnBackdropPress = true,
  isProcessing = false,
  message,
  onCancel,
  onConfirm,
  onRequestClose,
  processingLabel = "处理中",
  title,
  visible,
}: ConfirmDialogProps) {
  const handleRequestClose = onRequestClose ?? onCancel;

  return (
    <AppDialog
      description={message}
      dismissOnBackdropPress={dismissOnBackdropPress}
      isDismissDisabled={isProcessing}
      onRequestClose={handleRequestClose}
      title={title}
      visible={visible}
    >
      <View style={styles.actions}>
        <AppButton
          disabled={isProcessing}
          onPress={onCancel}
          style={styles.actionButton}
          title={cancelLabel}
          variant="secondary"
        />
        <AppButton
          disabled={isProcessing}
          loading={isProcessing}
          onPress={onConfirm}
          style={styles.actionButton}
          title={isProcessing ? processingLabel : confirmLabel}
          variant={confirmButtonTone === "primary" ? "primary" : "danger"}
        />
      </View>
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 6,
  },
});
