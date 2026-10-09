import { StyleSheet, type TextStyle, type ViewStyle } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";

import {
  DAY_DETAIL_HANDLE_ZONE_HEIGHT,
  DAY_MAP_PREVIEW_SURFACE_GAP,
} from "./constants";

type ImmersiveStyleDefinitions = {
  addDayTab: ViewStyle;
  dayDetailHandleZone: ViewStyle;
  dayDetailSheetContent: ViewStyle;
  dayDetailSheetOverlay: ViewStyle;
  dayDetailSheetScroll: ViewStyle;
  dayDetailSheetStage: ViewStyle;
  dayFloatingGrabber: ViewStyle;
  dayTab: ViewStyle;
  dayTabDateText: TextStyle;
  dayTabPressed: ViewStyle;
  dayTabs: ViewStyle;
  dayTabsRow: ViewStyle;
  dayTabsScroller: ViewStyle;
  dayTabSelected: ViewStyle;
  dayTabText: TextStyle;
  dayTabTextSelected: TextStyle;
  immersiveInlineError: ViewStyle;
  immersiveMap: ViewStyle;
  immersiveMapLayer: ViewStyle;
  immersiveMapTouchLayer: ViewStyle;
  immersiveOverviewReturnButton: ViewStyle;
  immersiveScreen: ViewStyle;
  immersiveSheetHeaderBlock: ViewStyle;
  immersiveSheetSurface: ViewStyle;
  immersiveTopBar: ViewStyle;
  immersiveTopBarLeft: ViewStyle;
  overviewDayTabPressed: ViewStyle;
  overviewDayTabSelected: ViewStyle;
  overviewDayTabTextSelected: TextStyle;
};

export function createImmersiveStyles(
  theme: AppTheme,
): ImmersiveStyleDefinitions {
  const immersiveSheetColor = theme.colors.surface;

  return {
    immersiveScreen: {
      flex: 1,
      backgroundColor: theme.colors.surfaceSubtle,
    },
    immersiveMapLayer: {
      ...StyleSheet.absoluteFillObject,
    },
    immersiveMapTouchLayer: {
      ...StyleSheet.absoluteFillObject,
    },
    immersiveMap: {
      flex: 1,
      minHeight: "100%",
      borderRadius: 0,
      borderWidth: 0,
    },
    immersiveTopBar: {
      position: "absolute",
      top: 12,
      right: 16,
      left: 16,
      zIndex: 8,
      elevation: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    immersiveTopBarLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    immersiveOverviewReturnButton: {
      minHeight: 36,
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.colors.glassStrong,
      borderWidth: 1,
      borderColor: theme.colors.primarySoft,
    },
    immersiveInlineError: {
      position: "absolute",
      top: 68,
      right: 16,
      left: 16,
      zIndex: 2,
    },
    dayDetailSheetStage: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 12,
      elevation: 12,
      overflow: "hidden",
    },
    dayDetailSheetOverlay: {
      overflow: "hidden",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: immersiveSheetColor,
      borderWidth: 0,
    },
    dayDetailHandleZone: {
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1,
      minHeight: DAY_DETAIL_HANDLE_ZONE_HEIGHT,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
      backgroundColor: immersiveSheetColor,
    },
    immersiveSheetSurface: {
      flex: 1,
      gap: DAY_MAP_PREVIEW_SURFACE_GAP,
      zIndex: 1,
      elevation: 1,
      paddingHorizontal: 16,
      paddingTop: 0,
      paddingBottom: 24,
      overflow: "hidden",
      backgroundColor: immersiveSheetColor,
    },
    immersiveSheetHeaderBlock: {
      gap: 14,
      flexShrink: 0,
    },
    dayDetailSheetScroll: {
      flex: 1,
      minHeight: 0,
      backgroundColor: immersiveSheetColor,
    },
    dayDetailSheetContent: {
      gap: 12,
      paddingTop: 4,
      paddingBottom: 32,
      backgroundColor: immersiveSheetColor,
    },
    dayFloatingGrabber: {
      alignSelf: "center",
      width: 44,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.colors.borderStrong,
    },
    dayTabs: {
      alignItems: "center",
      gap: 8,
      paddingLeft: 2,
      paddingRight: 20,
      paddingVertical: 2,
    },
    dayTabsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minWidth: 0,
    },
    dayTabsScroller: {
      flex: 1,
      minWidth: 0,
      maxWidth: "100%",
      overflow: "visible",
    },
    dayTab: {
      height: 40,
      minWidth: 70,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      paddingHorizontal: 13,
      paddingVertical: 0,
      borderRadius: 20,
    },
    addDayTab: {
      width: 42,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 20,
    },
    dayTabSelected: {
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.colors.surfacePressed,
    },
    overviewDayTabSelected: {
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.colors.primary,
    },
    overviewDayTabPressed: {
      backgroundColor: theme.colors.primaryPressed,
    },
    dayTabPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    dayTabText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    dayTabDateText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    dayTabTextSelected: {
      color: theme.colors.primary,
    },
    overviewDayTabTextSelected: {
      color: theme.colors.onPrimary,
    },
  };
}
