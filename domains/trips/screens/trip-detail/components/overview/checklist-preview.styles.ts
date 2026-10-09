import type { TextStyle, ViewStyle } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";

export type ChecklistPreviewStyleDefinitions = {
  notebookPreviewBinding: ViewStyle;
  notebookPreviewCard: ViewStyle;
  notebookPreviewCount: TextStyle;
  notebookPreviewEmpty: TextStyle;
  notebookPreviewHeaderButton: ViewStyle;
  notebookPreviewItem: TextStyle;
  notebookPreviewItemDone: TextStyle;
  notebookPreviewLines: ViewStyle;
  notebookPreviewLinesContent: ViewStyle;
  notebookPreviewRow: ViewStyle;
  notebookPreviewRowPressed: ViewStyle;
  notebookPreviewTitle: TextStyle;
  wireframeNotebookPreviewCard: ViewStyle;
  wireframeNotebookPreviewCount: TextStyle;
  wireframeNotebookPreviewHeaderButton: ViewStyle;
  wireframeNotebookPreviewItem: TextStyle;
  wireframeNotebookPreviewItemDone: TextStyle;
  wireframeNotebookPreviewLines: ViewStyle;
  wireframeNotebookPreviewRow: ViewStyle;
  wireframeNotebookPreviewTitle: TextStyle;
};

export function createChecklistPreviewStyles(
  theme: AppTheme,
): ChecklistPreviewStyleDefinitions {
  return {
    notebookPreviewCard: {
      gap: 8,
      backgroundColor: "#fff8df",
    },
    notebookPreviewBinding: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 16,
      backgroundColor: "#f0d27a",
    },
    notebookPreviewHeaderButton: {
      minHeight: 24,
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 8,
      paddingLeft: 8,
      borderRadius: 10,
    },
    notebookPreviewTitle: {
      color: "#5f4720",
      fontSize: 15,
      fontWeight: "900",
    },
    notebookPreviewCount: {
      color: "#7f642a",
      fontSize: 12,
      fontWeight: "900",
    },
    notebookPreviewLines: {
      flex: 1,
      minHeight: 0,
      paddingLeft: 8,
    },
    notebookPreviewLinesContent: {
      gap: 4,
      paddingVertical: 1,
    },
    notebookPreviewRow: {
      minHeight: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(127, 100, 42, 0.18)",
    },
    notebookPreviewRowPressed: {
      opacity: 0.72,
    },
    notebookPreviewItem: {
      flex: 1,
      minWidth: 0,
      color: "#5f4720",
      fontSize: 12,
      fontWeight: "700",
    },
    notebookPreviewItemDone: {
      color: "#9b8350",
      textDecorationLine: "line-through",
    },
    notebookPreviewEmpty: {
      color: "#9b8350",
      fontSize: 12,
      fontWeight: "700",
    },
    wireframeNotebookPreviewCard: {
      gap: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    wireframeNotebookPreviewHeaderButton: {
      paddingLeft: 0,
    },
    wireframeNotebookPreviewTitle: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    wireframeNotebookPreviewCount: {
      color: theme.colors.textMuted,
      fontWeight: "600",
    },
    wireframeNotebookPreviewLines: {
      paddingLeft: 0,
    },
    wireframeNotebookPreviewRow: {
      borderBottomColor: theme.colors.border,
    },
    wireframeNotebookPreviewItem: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    wireframeNotebookPreviewItemDone: {
      color: theme.colors.textMuted,
    },
  };
}
