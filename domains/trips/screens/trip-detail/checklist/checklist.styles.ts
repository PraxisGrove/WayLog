import type { TextStyle, ViewStyle } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";

type ChecklistStyleDefinitions = {
  notebookModal: ViewStyle;
  notebookModalBinding: ViewStyle;
  notebookModalHeader: ViewStyle;
  notebookModalTitleWrap: ViewStyle;
  notebookModalEyebrow: TextStyle;
  notebookModalTitle: TextStyle;
  notebookModalMeta: TextStyle;
  notebookIconButton: ViewStyle;
  notebookIconButtonPressed: ViewStyle;
  notebookToolbar: ViewStyle;
  notebookToolbarButton: ViewStyle;
  notebookToolbarButtonActive: ViewStyle;
  notebookToolbarButtonPressed: ViewStyle;
  notebookToolbarText: TextStyle;
  notebookToolbarDanger: ViewStyle;
  notebookToolbarDangerText: TextStyle;
  notebookToolbarDisabled: ViewStyle;
  notebookEditBox: ViewStyle;
  notebookEditActions: ViewStyle;
  notebookInlineError: TextStyle;
  notebookList: ViewStyle;
  notebookListContent: ViewStyle;
  notebookLineWrap: ViewStyle;
  notebookChecklistRow: ViewStyle;
  notebookChecklistRowDone: ViewStyle;
  notebookChecklistRowSelected: ViewStyle;
  notebookChecklistRowPressed: ViewStyle;
  notebookChecklistTitle: TextStyle;
  notebookChecklistTitleDone: TextStyle;
  notebookRowActions: ViewStyle;
  notebookRowActionButton: ViewStyle;
  notebookRowActionDisabled: ViewStyle;
  notebookEmpty: ViewStyle;
  notebookEmptyTitle: TextStyle;
  notebookEmptyText: TextStyle;
};

export function createChecklistStyles(
  theme: AppTheme,
): ChecklistStyleDefinitions {
  return {
    notebookModal: {
      alignSelf: "center",
      width: "100%",
      maxWidth: 520,
      maxHeight: "78%",
      overflow: "hidden",
      padding: 18,
      paddingLeft: 24,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderWidth: 0,
      borderColor: "#e3cf91",
      backgroundColor: "#fff8df",
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.16,
      shadowRadius: 28,
      elevation: 8,
    },
    notebookModalBinding: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 18,
      backgroundColor: "#f0d27a",
    },
    notebookModalHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 12,
    },
    notebookModalTitleWrap: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    notebookModalEyebrow: {
      color: "#8a6d2d",
      fontSize: 11,
      fontWeight: "900",
    },
    notebookModalTitle: {
      color: "#4d3a19",
      fontSize: 24,
      fontWeight: "900",
      lineHeight: 30,
    },
    notebookModalMeta: {
      color: "#80622b",
      fontSize: 12,
      fontWeight: "700",
    },
    notebookIconButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.66)",
    },
    notebookIconButtonPressed: {
      backgroundColor: "rgba(240,210,122,0.35)",
    },
    notebookToolbar: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 10,
    },
    notebookToolbarButton: {
      minHeight: 34,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingHorizontal: 11,
      borderRadius: 10,
      backgroundColor: "rgba(255,255,255,0.7)",
      borderWidth: 0,
      borderColor: "rgba(138,109,45,0.16)",
    },
    notebookToolbarButtonActive: {
      backgroundColor: theme.colors.primarySoft,
      borderColor: theme.colors.primary,
    },
    notebookToolbarButtonPressed: {
      backgroundColor: "rgba(240,210,122,0.45)",
    },
    notebookToolbarText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: "800",
    },
    notebookToolbarDanger: {
      borderColor: theme.colors.dangerBorder,
      backgroundColor: theme.colors.dangerSoft,
    },
    notebookToolbarDangerText: {
      color: theme.colors.danger,
      fontSize: 13,
      fontWeight: "800",
    },
    notebookToolbarDisabled: {
      opacity: 0.45,
    },
    notebookEditBox: {
      gap: 8,
      marginBottom: 10,
      padding: 10,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.72)",
      borderWidth: 0,
      borderColor: "rgba(138,109,45,0.16)",
    },
    notebookEditActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
    },
    notebookInlineError: {
      color: theme.colors.danger,
      fontSize: 12,
      fontWeight: "700",
    },
    notebookList: {
      maxHeight: 430,
    },
    notebookListContent: {
      paddingBottom: 6,
    },
    notebookLineWrap: {
      borderBottomWidth: 1,
      borderBottomColor: "rgba(128,98,43,0.18)",
    },
    notebookChecklistRow: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 7,
      paddingRight: 4,
      borderRadius: 10,
    },
    notebookChecklistRowDone: {
      opacity: 0.72,
    },
    notebookChecklistRowSelected: {
      backgroundColor: theme.colors.dangerSoft,
    },
    notebookChecklistRowPressed: {
      backgroundColor: "rgba(240,210,122,0.28)",
    },
    notebookChecklistTitle: {
      flex: 1,
      minWidth: 0,
      color: "#4d3a19",
      fontSize: 15,
      fontWeight: "800",
      lineHeight: 20,
    },
    notebookChecklistTitleDone: {
      color: "#9b8350",
      textDecorationLine: "line-through",
    },
    notebookRowActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 6,
      paddingBottom: 8,
    },
    notebookRowActionButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 32,
      height: 30,
      borderRadius: 10,
      backgroundColor: "rgba(255,255,255,0.68)",
    },
    notebookRowActionDisabled: {
      opacity: 0.36,
    },
    notebookEmpty: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 30,
    },
    notebookEmptyTitle: {
      color: "#4d3a19",
      fontSize: 16,
      fontWeight: "900",
    },
    notebookEmptyText: {
      maxWidth: 260,
      color: "#80622b",
      fontSize: 13,
      lineHeight: 18,
      textAlign: "center",
    },
  };
}
