import type { TextStyle, ViewStyle } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";

export type OverviewShellStyleDefinitions = {
  infoGrid: ViewStyle;
  overviewBackButton: ViewStyle;
  overviewBaseCard: ViewStyle;
  overviewContentStage: ViewStyle;
  overviewErrorTitle: TextStyle;
  overviewLoadingCard: ViewStyle;
  overviewPage: ViewStyle;
  overviewScrollContent: ViewStyle;
  overviewSquareGrid: ViewStyle;
  overviewTripToolbar: ViewStyle;
  overviewTripToolbarCopy: ViewStyle;
  primaryButton: ViewStyle;
  primaryButtonText: TextStyle;
  sectionActionButton: ViewStyle;
  sectionActionButtonPressed: ViewStyle;
  sectionActionText: TextStyle;
  sectionHeader: ViewStyle;
  sectionHeaderCopy: ViewStyle;
  sectionHint: TextStyle;
  sectionTitle: TextStyle;
  squareOverviewCard: ViewStyle;
  squareOverviewCardPressed: ViewStyle;
  squareOverviewHeaderPressed: ViewStyle;
  travelInfoSection: ViewStyle;
};

export function createOverviewShellStyles(
  theme: AppTheme,
): OverviewShellStyleDefinitions {
  return {
    overviewScrollContent: {
      alignSelf: "center",
      width: "100%",
      maxWidth: 620,
      padding: 20,
      paddingBottom: 32,
      gap: 16,
    },
    overviewTripToolbar: {
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    overviewTripToolbarCopy: {
      flex: 1,
      minWidth: 0,
    },
    overviewBackButton: {
      marginLeft: -6,
    },
    overviewBaseCard: {
      gap: 10,
      padding: 16,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    overviewLoadingCard: {
      minHeight: 112,
      alignItems: "center",
      justifyContent: "center",
    },
    overviewErrorTitle: {
      color: theme.colors.text,
      fontSize: 22,
      fontWeight: "700",
      letterSpacing: -0.4,
      lineHeight: 28,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 4,
    },
    sectionHeaderCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: -0.2,
    },
    sectionHint: {
      color: theme.colors.textSubtle,
      fontSize: 12,
      fontWeight: "500",
    },
    sectionActionButton: {
      minHeight: 34,
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.colors.primarySoft,
    },
    sectionActionButtonPressed: {
      backgroundColor: theme.colors.surfacePressed,
    },
    sectionActionText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: "700",
    },
    overviewContentStage: {
      flex: 1,
      minHeight: 480,
    },
    primaryButton: {
      alignSelf: "flex-start",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.primary,
    },
    primaryButtonText: {
      color: theme.colors.surface,
      fontSize: 14,
      fontWeight: "600",
    },
    infoGrid: {
      gap: 8,
    },
    travelInfoSection: {
      gap: 12,
    },
    overviewPage: {
      gap: 16,
    },
    overviewSquareGrid: {
      flexDirection: "row",
      gap: 12,
    },
    squareOverviewCard: {
      flex: 1,
      aspectRatio: 1,
      minWidth: 0,
      overflow: "hidden",
      padding: 14,
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 2,
    },
    squareOverviewCardPressed: {
      transform: [{ scale: 0.985 }],
      backgroundColor: theme.colors.surfaceSubtle,
    },
    squareOverviewHeaderPressed: {
      opacity: 0.72,
    },
  };
}
