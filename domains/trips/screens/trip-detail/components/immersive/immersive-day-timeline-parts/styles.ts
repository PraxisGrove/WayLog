import { StyleSheet } from "react-native";
import type { AppTheme } from "@/shared/theme/theme";
export function createImmersiveDayTimelineStyles(theme: AppTheme) {
  return StyleSheet.create({
    dayDetailSheetScroll: {
      flex: 1,
      minHeight: 0,
      backgroundColor: theme.colors.surface,
    },
    dayDetailSheetContent: {
      paddingTop: 4,
      paddingBottom: 32,
      backgroundColor: theme.colors.surface,
    },
    dayItemDragSlot: {
      position: "relative",
    },
    dayTimelineSection: {
      gap: 10,
      paddingBottom: 16,
    },
    timelineContainer: {
      position: "relative",
    },
    timelineVerticalLine: {
      position: "absolute",
      left: 9,
      top: 38,
      width: 1.5,
      backgroundColor: theme.colors.borderStrong,
    },
    dayTimelineSectionActive: {},
    dayTimelineSectionCollapsed: {
      paddingBottom: 12,
    },
    dayTimelineHeaderButton: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 2,
      paddingVertical: 5,
      borderRadius: 8,
    },
    dayTimelineHeaderButtonPressed: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    dayTimelineHeaderCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    dayTimelineTitleRow: {
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    dayTimelineTitleButton: {
      flex: 1,
      minWidth: 0,
      borderRadius: 6,
    },
    dayTimelineMetaButton: {
      width: "100%",
      borderRadius: 6,
    },
    dayTitleEditButton: {
      width: 24,
      height: 24,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
    },
    dayTitleEditButtonPressed: {
      backgroundColor: theme.colors.surfacePressed,
    },
    dayCollapseButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 34,
      height: 34,
      borderRadius: 17,
    },
    dayCollapseButtonActive: {
      backgroundColor: theme.colors.primarySoft,
    },
    dayTimelineMetaLine: {
      width: "100%",
      color: theme.colors.textMuted,
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 21,
    },
    dayTimelineEyebrow: {
      color: theme.colors.textMuted,
      fontSize: 15,
      fontWeight: "700",
    },
    dayTimelineTitle: {
      flexShrink: 1,
      minWidth: 0,
      color: theme.colors.text,
      fontSize: 19,
      fontWeight: "800",
      lineHeight: 25,
    },
    dayTimelineCostText: {
      color: theme.colors.success,
      fontSize: 15,
      fontWeight: "800",
    },
    dayTimelineWeatherText: {
      color: theme.colors.link,
      fontSize: 15,
      fontWeight: "800",
    },
    itemTitle: {
      flexShrink: 1,
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: "700",
    },
    mutedText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    emptyBlock: {
      alignItems: "flex-start",
      gap: 6,
      paddingHorizontal: 2,
      paddingVertical: 14,
    },
    addPlaceButton: {
      minHeight: 42,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 8,
      borderWidth: 0,
      backgroundColor: theme.colors.primarySoft,
    },
    addPlaceButtonPressed: {
      backgroundColor: theme.colors.primarySoft,
    },
    addPlaceText: {
      color: theme.colors.primary,
      fontSize: 15,
      fontWeight: "700",
    },
    routeConnector: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingLeft: 86,
      paddingRight: 8,
      paddingVertical: 5,
      borderRadius: 8,
    },
    routeConnectorPressed: {},
    routeConnectorMuted: {},
    routeConnectorMain: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    routeConnectorLabel: {
      flexShrink: 0,
      fontSize: 13,
      fontWeight: "800",
    },
    routeConnectorLabelMuted: {
      fontWeight: "700",
    },
    routeConnectorMeta: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      fontWeight: "600",
    },
    routeConnectorAction: {
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
    },
    routeConnectorActionText: {
      fontSize: 13,
      fontWeight: "800",
    },
  });
}

export type ImmersiveDayTimelineStyles = ReturnType<
  typeof createImmersiveDayTimelineStyles
>;
