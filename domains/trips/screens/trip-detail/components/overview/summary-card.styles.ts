import type { TextStyle, ViewStyle } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";

export type SummaryCardStyleDefinitions = {
  editPlanButtonText: TextStyle;
  overviewCard: ViewStyle;
  overviewEditButtonPressed: ViewStyle;
  overviewEditTextButton: ViewStyle;
  overviewFooter: ViewStyle;
  overviewFooterActions: ViewStyle;
  overviewHeader: ViewStyle;
  overviewHeaderActions: ViewStyle;
  overviewInfoBlock: ViewStyle;
  overviewInfoCopy: ViewStyle;
  overviewInfoItem: ViewStyle;
  overviewInfoLabel: TextStyle;
  overviewInfoText: TextStyle;
  overviewKicker: TextStyle;
  overviewStatCard: ViewStyle;
  overviewStatLabel: TextStyle;
  overviewStatValue: TextStyle;
  overviewStatsGrid: ViewStyle;
  overviewTitle: TextStyle;
  overviewTitleCopy: ViewStyle;
  overviewUpdatedText: TextStyle;
};

export function createSummaryCardStyles(
  theme: AppTheme,
): SummaryCardStyleDefinitions {
  return {
    overviewCard: {
      gap: 10,
      padding: 14,
      borderRadius: 14,
    },
    overviewHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    overviewTitleCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    overviewKicker: {
      color: theme.colors.textSubtle,
      fontSize: 11,
      fontWeight: "700",
    },
    overviewTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: "800",
      lineHeight: 25,
    },
    overviewHeaderActions: {
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    overviewEditButtonPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    overviewInfoBlock: {
      gap: 8,
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceMuted,
    },
    overviewInfoItem: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    overviewInfoCopy: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    overviewInfoLabel: {
      color: theme.colors.textSubtle,
      fontSize: 10,
      fontWeight: "700",
    },
    overviewInfoText: {
      flex: 1,
      minWidth: 0,
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 18,
    },
    overviewStatsGrid: {
      flexDirection: "row",
      gap: 6,
    },
    overviewStatCard: {
      flex: 1,
      minHeight: 50,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      paddingHorizontal: 4,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: theme.colors.surfaceMuted,
    },
    overviewStatValue: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    overviewStatLabel: {
      color: theme.colors.textSubtle,
      fontSize: 10,
      fontWeight: "600",
    },
    overviewFooter: {
      minHeight: 28,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    overviewUpdatedText: {
      flex: 1,
      minWidth: 0,
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    overviewFooterActions: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 0,
      gap: 6,
    },
    overviewEditTextButton: {
      minHeight: 32,
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: theme.colors.primarySoft,
    },
    editPlanButtonText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: "800",
    },
  };
}
