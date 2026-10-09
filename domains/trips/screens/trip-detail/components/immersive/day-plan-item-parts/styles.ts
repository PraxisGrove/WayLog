import { StyleSheet } from "react-native";
import type { AppTheme } from "@/shared/theme/theme";

export function createDayPlanItemStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 6,
      borderRadius: theme.radius.sm,
    },
    draggingRow: {
      zIndex: 10,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.linkBorder,
      opacity: 0.98,
      ...theme.shadow.floating,
    },
    swipeActions: {
      flexDirection: "row",
      alignItems: "stretch",
      overflow: "hidden",
      borderRadius: theme.radius.sm,
      backgroundColor: "transparent",
      gap: 6,
      paddingVertical: 7,
      paddingLeft: 8,
    },
    swipeAction: {
      width: 58,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      borderRadius: 10,
    },
    editAction: {
      backgroundColor: theme.colors.linkSoft,
    },
    deleteAction: {
      backgroundColor: theme.colors.dangerSoft,
    },
    swipeActionPressed: {
      opacity: 0.82,
    },
    swipeActionText: {
      color: theme.colors.link,
      fontSize: 12,
      fontWeight: "700",
    },
    deleteActionText: {
      color: theme.colors.danger,
    },
    timelineCol: {
      width: 20,
      alignItems: "center",
      paddingTop: 28,
      flexShrink: 0,
    },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.textSubtle,
      zIndex: 1,
    },
    timelineDotCurrentContainer: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1,
    },
    timelineDotCurrent: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.primary,
    },
    timelineDotCompleted: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.colors.textSubtle,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1,
    },
    addressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    addressText: {
      flex: 1,
      color: theme.colors.textSubtle,
      fontSize: 12,
      lineHeight: 16,
    },
    noteRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    noteText: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    tagRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 2,
    },
    timeTag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.radius.sm,
    },
    timeTagActive: {
      backgroundColor: theme.colors.primarySoft,
    },
    timeTagEmpty: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    timeTagPressed: {
      opacity: 0.78,
    },
    timeTagText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.primary,
      fontVariant: ["tabular-nums"],
    },
    timeTagTextEmpty: {
      color: theme.colors.textSubtle,
      fontWeight: "600",
    },
    mainArea: {
      minHeight: 62,
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 0,
      borderColor: theme.colors.border,
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    rowPressed: {
      backgroundColor: theme.colors.surfacePressed,
    },
    copy: {
      flex: 1,
      gap: 3,
    },
    copyPressable: {
      gap: 3,
      borderRadius: theme.radius.sm,
    },
    copyPressed: {
      opacity: 0.78,
    },
    title: {
      flexShrink: 1,
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: "700",
    },
    costTag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.radius.sm,
    },
    costTagActive: {
      backgroundColor: theme.colors.successSoft,
    },
    costTagEmpty: {
      backgroundColor: theme.colors.successSoft,
    },
    costTagPressed: {
      opacity: 0.78,
    },
    costTagText: {
      color: theme.colors.success,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 16,
    },
    costTagTextEmpty: {
      fontWeight: "600",
    },
    reasonBox: {
      gap: 6,
      marginTop: 2,
      paddingVertical: 4,
    },
    reasonToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      borderRadius: theme.radius.xs,
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor: theme.colors.primarySoft,
    },
    reasonTogglePressed: {
      opacity: 0.78,
    },
    reasonToggleText: {
      flex: 1,
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 16,
    },
    reasonText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      paddingHorizontal: 8,
    },
  });
}

export type DayPlanItemStyles = ReturnType<typeof createDayPlanItemStyles>;
