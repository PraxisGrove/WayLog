import type { TextStyle, ViewStyle } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";

export type LedgerPreviewStyleDefinitions = {
  expensePreviewAddButton: ViewStyle;
  expensePreviewAddButtonPressed: ViewStyle;
  expensePreviewAddText: TextStyle;
  expensePreviewAmount: TextStyle;
  expensePreviewCount: TextStyle;
  expensePreviewDot: ViewStyle;
  expensePreviewEmpty: TextStyle;
  expensePreviewFooter: ViewStyle;
  expensePreviewHeaderButton: ViewStyle;
  expensePreviewLines: ViewStyle;
  expensePreviewLinesContent: ViewStyle;
  expensePreviewName: TextStyle;
  expensePreviewRow: ViewStyle;
  expensePreviewTitle: TextStyle;
  expensePreviewTitleWrap: ViewStyle;
  expensePreviewTotal: TextStyle;
  expenseSquareCard: ViewStyle;
  wireframeExpensePreviewAddButton: ViewStyle;
  wireframeExpensePreviewAddButtonPressed: ViewStyle;
  wireframeExpensePreviewAddText: TextStyle;
  wireframeExpensePreviewAmount: TextStyle;
  wireframeExpensePreviewCount: TextStyle;
  wireframeExpensePreviewDot: ViewStyle;
  wireframeExpensePreviewName: TextStyle;
  wireframeExpensePreviewRow: ViewStyle;
  wireframeExpensePreviewTitle: TextStyle;
  wireframeExpensePreviewTotal: TextStyle;
  wireframeExpenseSquareCard: ViewStyle;
};

export function createLedgerPreviewStyles(
  theme: AppTheme,
): LedgerPreviewStyleDefinitions {
  return {
    expenseSquareCard: {
      gap: 8,
      backgroundColor: "#ecfbff",
    },
    expensePreviewHeaderButton: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 8,
      borderRadius: 10,
    },
    expensePreviewTitleWrap: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    expensePreviewTitle: {
      color: "#145766",
      fontSize: 15,
      fontWeight: "900",
    },
    expensePreviewTotal: {
      color: "#08798a",
      fontSize: 21,
      fontWeight: "900",
      lineHeight: 26,
    },
    expensePreviewCount: {
      color: "#276878",
      fontSize: 12,
      fontWeight: "900",
    },
    expensePreviewLines: {
      flex: 1,
      minHeight: 0,
    },
    expensePreviewLinesContent: {
      gap: 4,
      paddingVertical: 1,
    },
    expensePreviewRow: {
      minHeight: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(8, 121, 138, 0.16)",
    },
    expensePreviewDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#08798a",
    },
    expensePreviewName: {
      flex: 1,
      minWidth: 0,
      color: "#145766",
      fontSize: 12,
      fontWeight: "800",
    },
    expensePreviewAmount: {
      flexShrink: 0,
      color: "#08798a",
      fontSize: 12,
      fontWeight: "900",
    },
    expensePreviewEmpty: {
      color: "#5a8390",
      fontSize: 12,
      fontWeight: "800",
    },
    expensePreviewFooter: {
      minHeight: 28,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 8,
    },
    expensePreviewAddButton: {
      minHeight: 28,
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingHorizontal: 9,
      borderRadius: 10,
      backgroundColor: "#08798a",
    },
    expensePreviewAddButtonPressed: {
      backgroundColor: "#056777",
    },
    expensePreviewAddText: {
      color: "#ecfbff",
      fontSize: 11,
      fontWeight: "900",
    },
    wireframeExpenseSquareCard: {
      gap: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    wireframeExpensePreviewTitle: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    wireframeExpensePreviewTotal: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    wireframeExpensePreviewCount: {
      color: theme.colors.textMuted,
      fontWeight: "600",
    },
    wireframeExpensePreviewRow: {
      borderBottomColor: theme.colors.border,
    },
    wireframeExpensePreviewDot: {
      backgroundColor: theme.colors.textSubtle,
    },
    wireframeExpensePreviewName: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    wireframeExpensePreviewAmount: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    wireframeExpensePreviewAddButton: {
      borderWidth: 0,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    wireframeExpensePreviewAddButtonPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    wireframeExpensePreviewAddText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
  };
}
