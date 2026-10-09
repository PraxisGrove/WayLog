import type { TextStyle, ViewStyle } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";

type RouteDialogStyleDefinitions = {
  routeActionSheet: ViewStyle;
  sheetGrabber: ViewStyle;
  routeSheetHeader: ViewStyle;
  routeSheetTitleRow: ViewStyle;
  routeSheetTitle: TextStyle;
  routePreferenceChip: ViewStyle;
  routePreferenceChipPressed: ViewStyle;
  routePreferenceText: TextStyle;
  routePreferenceModeGrid: ViewStyle;
  routePreferenceModeOption: ViewStyle;
  routePreferenceModeOptionSelected: ViewStyle;
  routePreferenceModeOptionPressed: ViewStyle;
  routePreferenceModeText: TextStyle;
  routePreferenceModeTextSelected: TextStyle;
  routePreferenceToggleGroup: ViewStyle;
  routePreferenceToggle: ViewStyle;
  routePreferenceToggleSelected: ViewStyle;
  routePreferenceToggleText: TextStyle;
  routeSheetCloseButton: ViewStyle;
  routeSheetCloseButtonPressed: ViewStyle;
  routeEndpointsPanel: ViewStyle;
  routeEndpointRail: ViewStyle;
  routeEndpointDot: ViewStyle;
  routeEndpointDotEnd: ViewStyle;
  routeEndpointLine: ViewStyle;
  routeEndpointCopy: ViewStyle;
  routeEndpointText: TextStyle;
  routeModeSectionTitle: TextStyle;
  routeModeList: ViewStyle;
  routeModeOption: ViewStyle;
  routeModeOptionSelected: ViewStyle;
  routeModeOptionPressed: ViewStyle;
  routeModeLabel: TextStyle;
  routeModeLabelSelected: TextStyle;
  routeModeMetric: TextStyle;
  routeModeMetricSelected: TextStyle;
  routeSheetError: ViewStyle;
  routeSheetNotice: ViewStyle;
  routeSheetNoticeText: TextStyle;
  routeSheetFooter: ViewStyle;
  routeDepartCopy: ViewStyle;
  routeDepartLabel: TextStyle;
  routeDepartTime: TextStyle;
  routePrimaryButton: ViewStyle;
  routePrimaryButtonPressed: ViewStyle;
  routePrimaryButtonText: TextStyle;
};

export function createRouteDialogStyles(
  theme: AppTheme,
): RouteDialogStyleDefinitions {
  return {
    routeActionSheet: {
      gap: 16,
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 18,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: theme.colors.surface,
    },
    sheetGrabber: {
      alignSelf: "center",
      width: 42,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.colors.borderStrong,
    },
    routeSheetHeader: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    routeSheetTitleRow: {
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    routeSheetTitle: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: "800",
    },
    routePreferenceChip: {
      minHeight: 34,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 11,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    routePreferenceChipPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    routePreferenceText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    routePreferenceModeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    routePreferenceModeOption: {
      minHeight: 42,
      flexGrow: 1,
      flexBasis: "30%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    routePreferenceModeOptionSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primarySoft,
    },
    routePreferenceModeOptionPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    routePreferenceModeText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: "800",
    },
    routePreferenceModeTextSelected: {
      color: theme.colors.primary,
    },
    routePreferenceToggleGroup: {
      flexDirection: "row",
      gap: 8,
    },
    routePreferenceToggle: {
      minHeight: 42,
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    routePreferenceToggleSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primarySoft,
    },
    routePreferenceToggleText: {
      color: theme.colors.textMuted,
      fontSize: 15,
      fontWeight: "800",
    },
    routeSheetCloseButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: theme.colors.surfaceSubtle,
    },
    routeSheetCloseButtonPressed: {
      backgroundColor: theme.colors.border,
    },
    routeEndpointsPanel: {
      minHeight: 90,
      flexDirection: "row",
      gap: 12,
      padding: 14,
      borderRadius: 8,
      backgroundColor: theme.colors.linkSoft,
    },
    routeEndpointRail: {
      alignItems: "center",
      paddingTop: 5,
      paddingBottom: 5,
    },
    routeEndpointDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: theme.colors.link,
      backgroundColor: theme.colors.surface,
    },
    routeEndpointDotEnd: {
      backgroundColor: theme.colors.link,
    },
    routeEndpointLine: {
      flex: 1,
      width: 2,
      minHeight: 28,
      marginVertical: 3,
      backgroundColor: theme.colors.linkSoft,
    },
    routeEndpointCopy: {
      flex: 1,
      justifyContent: "space-between",
      gap: 14,
    },
    routeEndpointText: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: "800",
    },
    routeModeSectionTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "800",
    },
    routeModeList: {
      gap: 10,
    },
    routeModeOption: {
      minHeight: 62,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    routeModeOptionSelected: {},
    routeModeOptionPressed: {},
    routeModeLabel: {
      color: theme.colors.textMuted,
      fontSize: 16,
      fontWeight: "800",
    },
    routeModeLabelSelected: {
      color: theme.colors.text,
    },
    routeModeMetric: {
      marginLeft: "auto",
      color: theme.colors.textMuted,
      fontSize: 15,
      fontWeight: "700",
    },
    routeModeMetricSelected: {
      color: theme.colors.text,
    },
    routeSheetError: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.dangerSoft,
    },
    routeSheetNotice: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.infoBorder,
      backgroundColor: theme.colors.infoSoft,
    },
    routeSheetNoticeText: {
      color: theme.colors.info,
      fontSize: 13,
      lineHeight: 18,
    },
    routeSheetFooter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    routeDepartCopy: {
      width: 78,
      gap: 3,
    },
    routeDepartLabel: {
      color: theme.colors.textSubtle,
      fontSize: 13,
      fontWeight: "700",
    },
    routeDepartTime: {
      color: theme.colors.textMuted,
      fontSize: 16,
      fontWeight: "800",
    },
    routePrimaryButton: {
      minHeight: 56,
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 999,
      backgroundColor: theme.colors.primary,
    },
    routePrimaryButtonPressed: {
      backgroundColor: theme.colors.primaryPressed,
    },
    routePrimaryButtonText: {
      color: theme.colors.onPrimary,
      fontSize: 17,
      fontWeight: "800",
    },
  };
}
