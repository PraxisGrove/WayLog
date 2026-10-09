import type { AppTheme } from "@/shared/theme/theme";

// 原型稿阶段先关闭个人/设置页的旅行纸张背景，避免装饰层干扰布局判断。
export const ENABLE_PROFILE_TRAVEL_BACKGROUND = false;

const profileTravelRoutePaths = [
  "M-24 188 C64 128, 115 230, 196 172 S333 106, 420 164",
  "M-18 520 C72 455, 124 596, 221 512 S341 438, 414 494",
] as const;

const profileTravelRouteMarkers = [
  { cx: 53, cy: 168, kind: "reusable-booster", rotation: 7, scale: 0.9 },
  { cx: 332, cy: 126, kind: "saturn-beacon", rotation: -12, scale: 0.9 },
  { cx: 370, cy: 488, kind: "landing-burn", rotation: 0, scale: 0.9 },
] as const;

export const profileTravelPaperBackground = {
  dark: {
    annotationPrefix: "FIELD NOTE",
    baseColor: "#171513",
    glowIntensity: 0.24,
    gridColor: "#E9DED2",
    gridOpacity: 0.052,
    horizontalLineCount: 24,
    horizontalLineGap: 36,
    horizontalLineStart: 0,
    marginLineOffset: 42,
    marginLineOpacity: 0.16,
    pinColors: ["#6E4530", "#655D56", "#FB923C"],
    pinOpacity: 0.58,
    routeColor: "#FB923C",
    routePaths: profileTravelRoutePaths,
    routeMarkers: profileTravelRouteMarkers,
    sheenOpacity: 0.08,
    variant: "field-notes",
    verticalLineCount: 0,
    verticalLineGap: 0,
    verticalLineStart: 0,
  },
  light: {
    annotationPrefix: "FIELD NOTE",
    baseColor: "#F0ECE2",
    glowIntensity: 0.32,
    gridColor: "#4F4438",
    gridOpacity: 0.052,
    horizontalLineCount: 24,
    horizontalLineGap: 36,
    horizontalLineStart: 0,
    marginLineOffset: 42,
    marginLineOpacity: 0.12,
    pinColors: ["#D8A787", "#A8A099", "#C2410C"],
    pinOpacity: 0.58,
    routeColor: "#C2410C",
    routePaths: profileTravelRoutePaths,
    routeMarkers: profileTravelRouteMarkers,
    sheenOpacity: 0.4,
    variant: "field-notes",
    verticalLineCount: 0,
    verticalLineGap: 0,
    verticalLineStart: 0,
  },
} as const;

export const profileGlassSurface = {
  dark: {
    androidCardBackgroundColor: "#211E1B",
    blur: 16,
    cardBackgroundColor: "rgba(33, 30, 27, 0.94)",
    cardBorderColor: "rgba(235, 227, 216, 0.10)",
    controlBackgroundColor: "#2A2622",
    pressedBackgroundColor: "#342F2A",
    selectedBackgroundColor: "rgba(251, 146, 60, 0.12)",
    selectedBorderColor: "rgba(251, 146, 60, 0.24)",
    tabBarBackgroundColor: "rgba(29, 26, 23, 0.94)",
    tabBarBorderColor: "rgba(235, 227, 216, 0.11)",
    tabBarBottom: 10,
    tabBarHorizontalMargin: 18,
    tabBarRadius: 20,
  },
  light: {
    androidCardBackgroundColor: "#FBFAF7",
    blur: 16,
    cardBackgroundColor: "rgba(251, 250, 247, 0.94)",
    cardBorderColor: "rgba(82, 70, 58, 0.11)",
    controlBackgroundColor: "#F3F0EA",
    pressedBackgroundColor: "#ECE8E1",
    selectedBackgroundColor: "rgba(194, 65, 12, 0.08)",
    selectedBorderColor: "rgba(194, 65, 12, 0.18)",
    tabBarBackgroundColor: "rgba(251, 250, 247, 0.92)",
    tabBarBorderColor: "rgba(82, 70, 58, 0.12)",
    tabBarBottom: 10,
    tabBarHorizontalMargin: 18,
    tabBarRadius: 20,
  },
} as const;

export function getProfileTravelPaperBackground(theme: AppTheme) {
  if (theme.id === "default") {
    return {
      annotationPrefix: "FIELD NOTE",
      baseColor: theme.colors.background,
      annotationColor: theme.colors.textSubtle,
      glowColor: theme.colors.surfaceMuted,
      glowIntensity: 0,
      glowSecondaryColor: theme.colors.surfaceMuted,
      gridColor: theme.colors.border,
      gridOpacity: theme.mode === "dark" ? 0.28 : 0.42,
      horizontalLineCount: 24,
      horizontalLineGap: 36,
      horizontalLineStart: 0,
      marginLineOffset: 42,
      marginLineOpacity: 0.5,
      paperSheenColor: theme.colors.background,
      pinColors: [
        theme.colors.borderStrong,
        theme.colors.borderStrong,
        theme.colors.textMuted,
      ] as const,
      pinOpacity: 0.5,
      routeColor: theme.colors.borderStrong,
      routePaths: profileTravelRoutePaths,
      routeMarkers: profileTravelRouteMarkers,
      sheenOpacity: 0,
      variant: "wireframe",
      verticalLineCount: 0,
      verticalLineGap: 0,
      verticalLineStart: 0,
      washColor: theme.colors.surfaceMuted,
    };
  }

  const background = profileTravelPaperBackground[theme.mode];

  return {
    ...background,
    annotationColor: theme.colors.textSubtle,
    glowColor: theme.colors.primary,
    glowSecondaryColor: theme.colors.slate,
    paperSheenColor: theme.colors.surface,
    pinColors: [
      theme.colors.primaryBorder,
      theme.colors.borderStrong,
      theme.colors.primary,
    ] as const,
    routeColor: theme.colors.primary,
    washColor: theme.colors.primarySoft,
  };
}

export function getProfileGlassSurface(theme: AppTheme) {
  if (theme.id === "default") {
    return {
      androidCardBackgroundColor: theme.colors.surface,
      blur: 0,
      cardBackgroundColor: theme.colors.surface,
      cardBorderColor: "transparent",
      controlBackgroundColor: theme.colors.surfaceMuted,
      pressedBackgroundColor: theme.colors.surfacePressed,
      selectedBackgroundColor: theme.colors.primarySoft,
      selectedBorderColor: theme.colors.primaryBorder,
      tabBarBackgroundColor: theme.colors.surface,
      tabBarBorderColor: "transparent",
      tabBarBottom: 10,
      tabBarHorizontalMargin: 18,
      tabBarRadius: theme.radius.lg,
    };
  }

  const surface = profileGlassSurface[theme.mode];

  return {
    ...surface,
    selectedBackgroundColor: theme.colors.primarySoft,
    selectedBorderColor: theme.colors.primaryBorder,
  };
}

export function formatProfileFieldNoteDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `FIELD NOTE  ${month} / ${day}`;
}

export const mainTabRoutes = ["/", "/create", "/profile"] as const;

export function shouldUseProfileGlassTabBar(pathname: string) {
  return mainTabRoutes.includes(pathname as (typeof mainTabRoutes)[number]);
}
