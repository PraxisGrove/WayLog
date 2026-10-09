import type { TextStyle, ViewStyle } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";

export type RouteOverviewStyleDefinitions = {
  routeArrow: TextStyle;
  routeDayDivider: ViewStyle;
  routeDayHeader: ViewStyle;
  routeDayLabel: TextStyle;
  routeDayList: ViewStyle;
  routeDayMeta: TextStyle;
  routeDayPills: ViewStyle;
  routeDayRow: ViewStyle;
  routeOverviewCard: ViewStyle;
  routeOverviewEmpty: ViewStyle;
  routeOverviewHeader: ViewStyle;
  routePill: ViewStyle;
  routePillPressed: ViewStyle;
  routePillText: TextStyle;
};

export function createRouteOverviewStyles(
  theme: AppTheme,
): RouteOverviewStyleDefinitions {
  return {
    routeOverviewCard: {
      gap: 12,
      padding: 14,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    routeOverviewHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    routeDayList: {
      gap: 16,
    },
    routeDayRow: {
      gap: 10,
      paddingVertical: 2,
    },
    routeDayHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    routeDayLabel: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
    routeDayDivider: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    routeDayMeta: {
      color: theme.colors.textSubtle,
      fontSize: 11,
      fontWeight: "500",
    },
    routeDayPills: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 4,
    },
    routePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor: theme.colors.surfaceMuted,
    },
    routePillPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    routePillText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "600",
      maxWidth: 120,
    },
    routeArrow: {
      color: theme.colors.textSubtle,
      fontSize: 11,
    },
    routeOverviewEmpty: {
      minHeight: 112,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 18,
      paddingVertical: 18,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceMuted,
    },
  };
}
