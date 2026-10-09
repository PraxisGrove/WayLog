import type { TextStyle, ViewStyle } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";

export type TripNotebookPreviewStyleDefinitions = {
  tripNotebookPreviewArrow: ViewStyle;
  tripNotebookPreviewCard: ViewStyle;
  tripNotebookPreviewCardPressed: ViewStyle;
  tripNotebookPreviewCopy: ViewStyle;
  tripNotebookPreviewCount: TextStyle;
  tripNotebookPreviewEmpty: TextStyle;
  tripNotebookPreviewFooter: ViewStyle;
  tripNotebookPreviewHeader: ViewStyle;
  tripNotebookPreviewHint: TextStyle;
  tripNotebookPreviewIcon: ViewStyle;
  tripNotebookPreviewLine: TextStyle;
  tripNotebookPreviewLineRow: ViewStyle;
  tripNotebookPreviewLines: ViewStyle;
  tripNotebookPreviewMeta: TextStyle;
  tripNotebookPreviewPaper: ViewStyle;
  tripNotebookPreviewTitle: TextStyle;
};

export function createTripNotebookPreviewStyles(
  theme: AppTheme,
): TripNotebookPreviewStyleDefinitions {
  return {
    tripNotebookPreviewCard: {
      position: "relative",
      overflow: "hidden",
      borderRadius: 20,
      backgroundColor: "#fff6df",
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 18,
      elevation: 3,
    },
    tripNotebookPreviewCardPressed: {
      transform: [{ scale: 0.992 }],
      backgroundColor: "#edd48c",
    },
    tripNotebookPreviewPaper: {
      gap: 12,
      minHeight: 136,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: 19,
      backgroundColor: "#fff6df",
    },
    tripNotebookPreviewHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    tripNotebookPreviewIcon: {
      alignItems: "center",
      justifyContent: "center",
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: "#efe2ac",
    },
    tripNotebookPreviewCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    tripNotebookPreviewTitle: {
      color: "#443625",
      fontSize: 17,
      fontWeight: "900",
    },
    tripNotebookPreviewMeta: {
      color: "#765b3b",
      fontSize: 12,
      fontWeight: "800",
    },
    tripNotebookPreviewArrow: {
      alignItems: "center",
      justifyContent: "center",
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "rgba(239, 226, 172, 0.58)",
    },
    tripNotebookPreviewLines: {
      gap: 0,
      minHeight: 47,
      paddingTop: 2,
      backgroundColor: "#fff6df",
    },
    tripNotebookPreviewLineRow: {
      minHeight: 24,
      justifyContent: "center",
      borderBottomWidth: 1,
      borderBottomColor: "rgba(151, 103, 47, 0.17)",
    },
    tripNotebookPreviewLine: {
      color: "#60482f",
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
    },
    tripNotebookPreviewEmpty: {
      color: "#7d6448",
      fontSize: 13,
      lineHeight: 20,
      fontWeight: "600",
    },
    tripNotebookPreviewFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    tripNotebookPreviewHint: {
      color: "#8c662e",
      fontSize: 12,
      fontWeight: "900",
    },
    tripNotebookPreviewCount: {
      color: "#9b7844",
      fontSize: 12,
      fontWeight: "800",
    },
  };
}
