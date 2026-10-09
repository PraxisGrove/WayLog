import type { TextStyle, ViewStyle } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";

type LedgerStyleDefinitions = {
  expenseLedgerEmpty: ViewStyle;
  expenseLedgerEmptyTitle: TextStyle;
  expenseLedgerEmptyText: TextStyle;
  expenseLedgerModal: ViewStyle;
  expenseLedgerModalHeader: ViewStyle;
  expenseLedgerModalTitleWrap: ViewStyle;
  expenseLedgerTitleRow: ViewStyle;
  expenseLedgerModalEyebrow: TextStyle;
  expenseLedgerModalTitle: TextStyle;
  expenseLedgerHeadingLine: ViewStyle;
  expenseLedgerBalancePill: ViewStyle;
  expenseLedgerBalanceText: TextStyle;
  expenseLedgerBalanceTextOver: TextStyle;
  expenseLedgerModalMeta: TextStyle;
  expenseLedgerIconButton: ViewStyle;
  expenseLedgerIconButtonPressed: ViewStyle;
  expenseLedgerSummaryCard: ViewStyle;
  expenseLedgerSummaryTop: ViewStyle;
  expenseLedgerTotalBlock: ViewStyle;
  expenseLedgerHeroLabel: TextStyle;
  expenseLedgerHeroAmount: TextStyle;
  expenseLedgerMetricGroup: ViewStyle;
  expenseLedgerMiniMetric: ViewStyle;
  expenseLedgerMiniMetricValue: TextStyle;
  expenseLedgerMiniMetricLabel: TextStyle;
  expenseLedgerSummaryBottom: ViewStyle;
  expenseLedgerBudgetCompact: ViewStyle;
  expenseLedgerBudgetTrack: ViewStyle;
  expenseLedgerBudgetFill: ViewStyle;
  expenseLedgerBudgetFillOver: ViewStyle;
  expenseLedgerBudgetMeta: TextStyle;
  expenseLedgerToolbar: ViewStyle;
  expenseLedgerToolbarButton: ViewStyle;
  expenseLedgerPrimaryToolbarButton: ViewStyle;
  expenseLedgerSecondaryToolbarButton: ViewStyle;
  expenseLedgerToolbarButtonPressed: ViewStyle;
  expenseLedgerToolbarText: TextStyle;
  expenseLedgerPrimaryToolbarText: TextStyle;
  expenseLedgerList: ViewStyle;
  expenseLedgerListContent: ViewStyle;
  expenseLedgerCategoryGrid: ViewStyle;
  expenseLedgerCategoryPill: ViewStyle;
  expenseLedgerCategoryPillPressed: ViewStyle;
  expenseLedgerCategoryPillActive: ViewStyle;
  expenseLedgerCategoryText: TextStyle;
  expenseLedgerCategoryAmount: TextStyle;
  expenseLedgerCategoryTextActive: TextStyle;
  expenseLedgerFilterNotice: ViewStyle;
  expenseLedgerFilterNoticeText: TextStyle;
  expenseLedgerFilterClearButton: ViewStyle;
  expenseLedgerFilterClearText: TextStyle;
  expenseLedgerDayGroup: ViewStyle;
  expenseLedgerDayRow: ViewStyle;
  expenseLedgerDayRowPressed: ViewStyle;
  expenseLedgerDayCopy: ViewStyle;
  expenseLedgerDayTitle: TextStyle;
  expenseLedgerDayMeta: TextStyle;
  expenseLedgerDayAmountWrap: ViewStyle;
  expenseLedgerDayAmount: TextStyle;
  expenseLedgerItemList: ViewStyle;
  expenseLedgerItemRow: ViewStyle;
  expenseLedgerItemRowPressed: ViewStyle;
  expenseLedgerItemIcon: ViewStyle;
  expenseLedgerItemCopy: ViewStyle;
  expenseLedgerItemTitle: TextStyle;
  expenseLedgerItemMeta: TextStyle;
  expenseLedgerItemNote: TextStyle;
  expenseLedgerItemAmount: TextStyle;
  expenseLedgerEmptyTextInline: TextStyle;
  expenseCategorySelector: ViewStyle;
  expenseCategoryOption: ViewStyle;
  expenseCategoryOptionSelected: ViewStyle;
  expenseCategoryOptionPressed: ViewStyle;
  expenseCategoryOptionText: TextStyle;
  expenseCategoryOptionTextSelected: TextStyle;
  expenseDaySelector: ViewStyle;
  expenseDayOption: ViewStyle;
  expenseDayOptionSelected: ViewStyle;
  expenseDayOptionPressed: ViewStyle;
  expenseDayOptionText: TextStyle;
  expenseDayOptionTextSelected: TextStyle;
  expensePlaceSelector: ViewStyle;
  expensePlaceOption: ViewStyle;
  expensePlaceOptionSelected: ViewStyle;
  expensePlaceOptionPressed: ViewStyle;
  expensePlaceOptionText: TextStyle;
  expensePlaceOptionTextSelected: TextStyle;
  expensePlaceDayBadge: TextStyle;
  expensePlaceHint: TextStyle;
  dangerOutlineButton: ViewStyle;
  dangerOutlineButtonPressed: ViewStyle;
  dangerOutlineText: TextStyle;
};

export function createLedgerStyles(theme: AppTheme): LedgerStyleDefinitions {
  return {
    expenseLedgerEmpty: {
      minHeight: 126,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 18,
      paddingVertical: 20,
    },
    expenseLedgerEmptyTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    expenseLedgerEmptyText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      textAlign: "center",
    },
    expenseLedgerModal: {
      alignSelf: "center",
      width: "100%",
      maxWidth: 520,
      maxHeight: "82%",
      overflow: "hidden",
      padding: 18,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderWidth: 0,
      borderColor: "#9fd7df",
      backgroundColor: "#eafbff",
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.16,
      shadowRadius: 28,
      elevation: 8,
    },
    expenseLedgerModalHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 10,
    },
    expenseLedgerModalTitleWrap: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    expenseLedgerTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
    },
    expenseLedgerModalEyebrow: {
      color: "#2c7583",
      fontSize: 11,
      fontWeight: "900",
    },
    expenseLedgerModalTitle: {
      color: "#064c61",
      fontSize: 22,
      fontWeight: "900",
      lineHeight: 27,
    },
    expenseLedgerHeadingLine: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
    },
    expenseLedgerBalancePill: {
      maxWidth: 150,
      minHeight: 24,
      justifyContent: "center",
      paddingHorizontal: 9,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.66)",
      borderWidth: 0,
      borderColor: "rgba(0,120,146,0.1)",
    },
    expenseLedgerBalanceText: {
      color: "#236779",
      fontSize: 12,
      fontWeight: "900",
    },
    expenseLedgerBalanceTextOver: {
      color: theme.colors.danger,
    },
    expenseLedgerModalMeta: {
      color: "#236779",
      fontSize: 12,
      fontWeight: "800",
      lineHeight: 16,
    },
    expenseLedgerIconButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.72)",
    },
    expenseLedgerIconButtonPressed: {
      backgroundColor: "rgba(119,207,222,0.35)",
    },
    expenseLedgerSummaryCard: {
      gap: 9,
      marginBottom: 9,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 0,
      borderColor: "rgba(0,120,146,0.1)",
      backgroundColor: "rgba(255,255,255,0.58)",
    },
    expenseLedgerSummaryTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    expenseLedgerTotalBlock: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    expenseLedgerHeroLabel: {
      color: "#3a8290",
      fontSize: 12,
      fontWeight: "800",
    },
    expenseLedgerHeroAmount: {
      color: "#006b84",
      fontSize: 28,
      fontWeight: "900",
      lineHeight: 32,
    },
    expenseLedgerMetricGroup: {
      flexDirection: "row",
      gap: 7,
    },
    expenseLedgerMiniMetric: {
      alignItems: "center",
      justifyContent: "center",
      minWidth: 62,
      minHeight: 46,
      paddingHorizontal: 8,
      borderRadius: 12,
      backgroundColor: "#d4f5fa",
    },
    expenseLedgerMiniMetricValue: {
      color: "#006b84",
      fontSize: 15,
      fontWeight: "900",
      lineHeight: 18,
    },
    expenseLedgerMiniMetricLabel: {
      color: "#3a8290",
      fontSize: 11,
      fontWeight: "800",
    },
    expenseLedgerSummaryBottom: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 10,
    },
    expenseLedgerBudgetCompact: {
      flex: 1,
      minWidth: 0,
      gap: 5,
    },
    expenseLedgerBudgetTrack: {
      height: 6,
      overflow: "hidden",
      borderRadius: 999,
      backgroundColor: "#c5e7ee",
    },
    expenseLedgerBudgetFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: "#00a4bd",
    },
    expenseLedgerBudgetFillOver: {
      backgroundColor: theme.colors.danger,
    },
    expenseLedgerBudgetMeta: {
      color: "#3a8290",
      fontSize: 12,
      fontWeight: "800",
    },
    expenseLedgerToolbar: {
      flexDirection: "row",
      flexShrink: 0,
      alignItems: "center",
      gap: 6,
    },
    expenseLedgerToolbarButton: {
      minHeight: 32,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingHorizontal: 9,
      borderRadius: 11,
      backgroundColor: "rgba(255,255,255,0.72)",
      borderWidth: 0,
      borderColor: "rgba(0,120,146,0.14)",
    },
    expenseLedgerPrimaryToolbarButton: {
      minWidth: 88,
      minHeight: 36,
      paddingHorizontal: 12,
      backgroundColor: "#007892",
      borderColor: "#007892",
      shadowColor: "#006b84",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.16,
      shadowRadius: 10,
      elevation: 2,
    },
    expenseLedgerSecondaryToolbarButton: {
      minWidth: 58,
    },
    expenseLedgerToolbarButtonPressed: {
      backgroundColor: "rgba(119,207,222,0.35)",
    },
    expenseLedgerToolbarText: {
      color: "#007892",
      fontSize: 13,
      fontWeight: "800",
    },
    expenseLedgerPrimaryToolbarText: {
      color: "#ecfbff",
      fontWeight: "900",
    },
    expenseLedgerList: {
      maxHeight: 430,
    },
    expenseLedgerListContent: {
      paddingBottom: 6,
    },
    expenseLedgerCategoryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
      paddingBottom: 8,
    },
    expenseLedgerCategoryPill: {
      minHeight: 32,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      borderRadius: 10,
      backgroundColor: "rgba(255,255,255,0.68)",
      borderWidth: 0,
      borderColor: "rgba(0,120,146,0.12)",
    },
    expenseLedgerCategoryPillPressed: {
      backgroundColor: "rgba(119,207,222,0.24)",
    },
    expenseLedgerCategoryPillActive: {
      backgroundColor: "#007892",
      borderColor: "#007892",
    },
    expenseLedgerCategoryText: {
      color: "#236779",
      fontSize: 12,
      fontWeight: "800",
    },
    expenseLedgerCategoryAmount: {
      color: "#007892",
      fontSize: 12,
      fontWeight: "900",
    },
    expenseLedgerCategoryTextActive: {
      color: "#ecfbff",
    },
    expenseLedgerFilterNotice: {
      minHeight: 32,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: "rgba(0,120,146,0.08)",
    },
    expenseLedgerFilterNoticeText: {
      flex: 1,
      minWidth: 0,
      color: "#236779",
      fontSize: 12,
      fontWeight: "800",
    },
    expenseLedgerFilterClearButton: {
      minHeight: 24,
      justifyContent: "center",
      paddingHorizontal: 9,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.72)",
      borderWidth: 0,
      borderColor: "rgba(0,120,146,0.14)",
    },
    expenseLedgerFilterClearText: {
      color: "#007892",
      fontSize: 12,
      fontWeight: "900",
    },
    expenseLedgerDayGroup: {
      borderBottomWidth: 1,
      borderBottomColor: "rgba(35,103,121,0.16)",
    },
    expenseLedgerDayRow: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 9,
      paddingRight: 2,
      borderRadius: 10,
    },
    expenseLedgerDayRowPressed: {
      backgroundColor: "rgba(119,207,222,0.22)",
    },
    expenseLedgerDayCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    expenseLedgerDayTitle: {
      color: "#064c61",
      fontSize: 15,
      fontWeight: "900",
    },
    expenseLedgerDayMeta: {
      color: "#4a8795",
      fontSize: 12,
      fontWeight: "700",
    },
    expenseLedgerDayAmountWrap: {
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    expenseLedgerDayAmount: {
      color: "#007892",
      fontSize: 15,
      fontWeight: "900",
    },
    expenseLedgerItemList: {
      gap: 6,
      paddingBottom: 10,
    },
    expenseLedgerItemRow: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 9,
      paddingVertical: 8,
      borderRadius: 11,
      backgroundColor: "rgba(255,255,255,0.66)",
    },
    expenseLedgerItemRowPressed: {
      backgroundColor: "rgba(119,207,222,0.28)",
    },
    expenseLedgerItemIcon: {
      alignItems: "center",
      justifyContent: "center",
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: "#d4f5fa",
    },
    expenseLedgerItemCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    expenseLedgerItemTitle: {
      color: "#064c61",
      fontSize: 14,
      fontWeight: "800",
    },
    expenseLedgerItemMeta: {
      color: "#4a8795",
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "600",
    },
    expenseLedgerItemNote: {
      color: "#4a8795",
      fontSize: 12,
      lineHeight: 16,
    },
    expenseLedgerItemAmount: {
      flexShrink: 0,
      color: "#007892",
      fontSize: 14,
      fontWeight: "900",
    },
    expenseLedgerEmptyTextInline: {
      paddingVertical: 8,
      color: "#4a8795",
      fontSize: 13,
      lineHeight: 18,
    },
    expenseCategorySelector: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    expenseCategoryOption: {
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 0,
      borderColor: theme.colors.borderStrong,
    },
    expenseCategoryOptionSelected: {
      backgroundColor: theme.colors.successSoft,
      borderColor: theme.colors.successBorder,
    },
    expenseCategoryOptionPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    expenseCategoryOptionText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    expenseCategoryOptionTextSelected: {
      color: theme.colors.success,
    },
    expenseDaySelector: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    expenseDayOption: {
      minHeight: 34,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 11,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 0,
      borderColor: theme.colors.borderStrong,
    },
    expenseDayOptionSelected: {
      backgroundColor: theme.colors.primarySoft,
      borderColor: theme.colors.primary,
    },
    expenseDayOptionPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    expenseDayOptionText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    expenseDayOptionTextSelected: {
      color: theme.colors.primary,
    },
    expensePlaceSelector: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    expensePlaceOption: {
      maxWidth: "100%",
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 0,
      borderColor: theme.colors.borderStrong,
    },
    expensePlaceOptionSelected: {
      backgroundColor: theme.colors.primarySoft,
      borderColor: theme.colors.primary,
    },
    expensePlaceOptionPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    expensePlaceOptionText: {
      minWidth: 0,
      maxWidth: 170,
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    expensePlaceOptionTextSelected: {
      color: theme.colors.primary,
    },
    expensePlaceDayBadge: {
      overflow: "hidden",
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: theme.colors.surfaceMuted,
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
    },
    expensePlaceHint: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    dangerOutlineButton: {
      minHeight: 44,
      flex: 0.9,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.dangerBorder,
      backgroundColor: theme.colors.dangerSoft,
    },
    dangerOutlineButtonPressed: {
      backgroundColor: theme.colors.dangerSoft,
    },
    dangerOutlineText: {
      color: theme.colors.danger,
      fontSize: 14,
      fontWeight: "700",
    },
  };
}
