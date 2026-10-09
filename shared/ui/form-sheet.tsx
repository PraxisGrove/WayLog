import type { ReactNode } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { AppButton } from "./app-button";
import { AppSheet, type AppSheetVariant } from "./app-sheet";

type FormSheetProps = {
  cancelLabel?: string;
  children?: ReactNode;
  confirmLabel?: string;
  contentStyle?: StyleProp<ViewStyle>;
  description?: string;
  isConfirmDisabled?: boolean;
  isProcessing?: boolean;
  onCancel: () => void;
  onConfirm?: () => void;
  onRequestClose?: () => void;
  processingLabel?: string;
  title: string;
  variant?: AppSheetVariant;
  visible: boolean;
};

export function FormSheet({
  cancelLabel = "取消",
  children,
  confirmLabel = "保存",
  contentStyle,
  description,
  isConfirmDisabled = false,
  isProcessing = false,
  onCancel,
  onConfirm,
  onRequestClose,
  processingLabel = "保存中",
  title,
  variant,
  visible,
}: FormSheetProps) {
  const handleRequestClose = onRequestClose ?? onCancel;

  return (
    <AppSheet
      isDismissDisabled={isProcessing}
      onRequestClose={handleRequestClose}
      title={title}
      description={description}
      variant={variant}
      visible={visible}
    >
      {children ? (
        <View style={[styles.content, contentStyle]}>{children}</View>
      ) : null}
      <View style={styles.actions}>
        <AppButton
          disabled={isProcessing}
          onPress={onCancel}
          style={styles.actionButton}
          title={cancelLabel}
          variant="secondary"
        />
        {onConfirm ? (
          <AppButton
            disabled={isProcessing || isConfirmDisabled}
            loading={isProcessing}
            onPress={onConfirm}
            style={styles.actionButton}
            title={isProcessing ? processingLabel : confirmLabel}
            variant="primary"
          />
        ) : null}
      </View>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  content: {
    gap: 12,
  },
});
