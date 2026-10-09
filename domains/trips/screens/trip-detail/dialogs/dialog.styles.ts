import { StyleSheet, type TextStyle, type ViewStyle } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";

type DialogStyleDefinitions = {
  animatedModalBackdrop: ViewStyle;
  modalOverlay: ViewStyle;
  modalBackdrop: ViewStyle;
  actionSheet: ViewStyle;
  editSheet: ViewStyle;
  sheetEyebrow: TextStyle;
  sheetTitle: TextStyle;
  sheetActionList: ViewStyle;
  sheetAction: ViewStyle;
  sheetActionPressed: ViewStyle;
  sheetActionDanger: ViewStyle;
  sheetActionDangerPressed: ViewStyle;
  sheetActionDisabled: ViewStyle;
  sheetActionCopy: ViewStyle;
  sheetActionTitle: TextStyle;
  destructiveActionTitle: TextStyle;
  sheetActionDetail: TextStyle;
  formGroup: ViewStyle;
  inputLabel: TextStyle;
  textInput: TextStyle;
  textArea: TextStyle;
  editActions: ViewStyle;
  secondaryActionButton: ViewStyle;
  secondaryActionButtonPressed: ViewStyle;
  secondaryActionText: TextStyle;
  primaryActionButton: ViewStyle;
  primaryActionButtonPressed: ViewStyle;
  primaryActionText: TextStyle;
};

export function createDialogStyles(theme: AppTheme): DialogStyleDefinitions {
  return {
    animatedModalBackdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(17, 24, 39, 0.32)",
    },
    actionSheet: {
      gap: 12,
      margin: 12,
      padding: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
    },
    editSheet: {
      gap: 14,
      margin: 12,
      padding: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
    },
    sheetEyebrow: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    sheetTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    sheetActionList: {
      gap: 8,
    },
    sheetAction: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceMuted,
    },
    sheetActionPressed: {
      backgroundColor: theme.colors.primarySoft,
    },
    sheetActionDanger: {
      backgroundColor: theme.colors.dangerSoft,
    },
    sheetActionDangerPressed: {
      backgroundColor: theme.colors.dangerSoft,
    },
    sheetActionDisabled: {
      opacity: 0.55,
    },
    sheetActionCopy: {
      flex: 1,
      gap: 2,
    },
    sheetActionTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    destructiveActionTitle: {
      color: theme.colors.danger,
      fontSize: 15,
      fontWeight: "700",
    },
    sheetActionDetail: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    formGroup: {
      gap: 7,
    },
    inputLabel: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    textInput: {
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.surface,
      color: theme.colors.text,
      fontSize: 15,
    },
    textArea: {
      minHeight: 86,
      textAlignVertical: "top",
    },
    editActions: {
      flexDirection: "row",
      gap: 10,
    },
    secondaryActionButton: {
      minHeight: 44,
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.surface,
    },
    secondaryActionButtonPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    secondaryActionText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: "700",
    },
    primaryActionButton: {
      minHeight: 44,
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      backgroundColor: theme.colors.primary,
    },
    primaryActionButtonPressed: {
      backgroundColor: theme.colors.primaryPressed,
    },
    primaryActionText: {
      color: theme.colors.surface,
      fontSize: 14,
      fontWeight: "700",
    },
  };
}
