import type { ResolvedColorScheme } from "./color-scheme";
import {
  type ResolvedDesignTokens,
  resolveDesignTokens,
} from "./design-tokens";
import {
  DEFAULT_CLASSIC_PALETTE_ID,
  getClassicPaletteById,
} from "./palettes/classic-palettes";

type ResolveDefaultDesignTokensOptions = {
  colorScheme: ResolvedColorScheme;
};

export function resolveDefaultDesignTokens({
  colorScheme,
}: ResolveDefaultDesignTokensOptions): ResolvedDesignTokens {
  const baseTokens = resolveDesignTokens({
    colorScheme,
    palette: getClassicPaletteById(DEFAULT_CLASSIC_PALETTE_ID),
  });
  const isDark = colorScheme === "dark";
  const background = isDark ? "#0F0F0F" : "#F3F4F6";
  const surface = isDark ? "#171717" : "#FFFFFF";
  const surfaceMuted = isDark ? "#242424" : "#EDEFF2";
  const surfaceSubtle = isDark ? "#1D1D1D" : "#F8F9FA";
  const surfacePressed = isDark ? "#303030" : "#E2E5E9";
  const text = isDark ? "#F5F5F5" : "#111111";
  const textMuted = isDark ? "#C8C8C8" : "#565656";
  const textSubtle = isDark ? "#9C9C9C" : "#787878";
  const border = "transparent";
  const borderStrong = isDark ? "#777777" : "#8A9099";
  const primary = isDark ? "#F5F5F5" : "#111111";
  const onPrimary = isDark ? "#111111" : "#FFFFFF";
  const primarySoft = isDark ? "#262626" : "#E7E9EC";
  const semanticSoft = isDark ? "#222222" : "#F2F3F5";
  const placeholder = isDark ? "#8F8F8F" : "#8B8B8B";

  return {
    ...baseTokens,
    id: "default",
    name: "默认骨架",
    colors: {
      ...baseTokens.colors,
      background,
      surface,
      surfaceMuted,
      surfaceSubtle,
      surfacePressed,
      text,
      textMuted,
      textSubtle,
      border,
      borderStrong,
      danger: text,
      dangerBorder: borderStrong,
      dangerPressed: isDark ? "#FFFFFF" : "#000000",
      dangerSoft: semanticSoft,
      success: text,
      successBorder: borderStrong,
      successSoft: semanticSoft,
      warning: text,
      warningBorder: borderStrong,
      warningSoft: semanticSoft,
      info: text,
      infoBorder: borderStrong,
      infoSoft: semanticSoft,
      link: text,
      linkBorder: border,
      linkSoft: semanticSoft,
      cyan: text,
      cyanSoft: semanticSoft,
      orange: text,
      orangeSoft: semanticSoft,
      violet: text,
      violetSoft: semanticSoft,
      slate: textMuted,
      slateSoft: semanticSoft,
      disabled: isDark ? "#252525" : "#E1E3E6",
      disabledText: placeholder,
      placeholder,
      overlay: isDark ? "rgba(0, 0, 0, 0.72)" : "rgba(17, 17, 17, 0.32)",
      glass: surface,
      glassStrong: surface,
      glassBorder: border,
      shadow: "#000000",
      primary,
      primaryPressed: isDark ? "#E5E5E5" : "#000000",
      primarySoft,
      primaryBorder: border,
      onPrimary,
      focusRing: isDark
        ? "rgba(245, 245, 245, 0.22)"
        : "rgba(17, 17, 17, 0.16)",
      navigation: {
        activeBackground: surfaceMuted,
        activeBorder: border,
        floatingBorder: background,
      },
      status: {
        planned: {
          background: semanticSoft,
          border: border,
          text,
        },
        traveling: {
          background: semanticSoft,
          border: border,
          text,
        },
        completed: {
          background: surfaceSubtle,
          border: border,
          text: textMuted,
        },
      },
      ticket: {
        ...baseTokens.colors.ticket,
        background: surface,
        pressed: surfacePressed,
        stub: surfaceMuted,
        stubPressed: surfacePressed,
        dash: borderStrong,
        notch: background,
        featured: {
          ...baseTokens.colors.ticket.featured,
          heroBackground: background,
          heroMutedText: textMuted,
          heroPattern: border,
          heroText: text,
          paperBackground: surface,
          paperPressed: surfacePressed,
          paperText: text,
          statBackground: surfaceMuted,
          accentText: textMuted,
          dashColor: borderStrong,
          punchBorder: border,
        },
      },
    },
    radius: {
      ...baseTokens.radius,
      xs: 6,
      sm: 8,
      md: 10,
      lg: 12,
      xl: 16,
      pill: 999,
    },
    routeMap: {
      area: {
        fillOpacity: 0.05,
        strokeOpacity: 0.24,
        strokeWidth: 1.5,
      },
      marker: {
        desktopNameMaxLength: 10,
        mobileNameMaxLength: 8,
        palette: isDark
          ? [
              { background: "#F5F5F5", text: "#111111" },
              { background: "#60A5FA", text: "#111111" },
              { background: "#34D399", text: "#111111" },
              { background: "#F472B6", text: "#111111" },
            ]
          : [
              { background: "#111111", text: "#FFFFFF" },
              { background: "#2563EB", text: "#FFFFFF" },
              { background: "#047857", text: "#FFFFFF" },
              { background: "#BE185D", text: "#FFFFFF" },
            ],
      },
      route: {
        color: isDark ? "#60A5FA" : "#2563EB",
        estimatedOpacity: 0.5,
        estimatedPattern: [10, 8],
        normalOpacity: 0.72,
        normalWidth: 5,
        outlineColor: isDark
          ? "rgba(15, 15, 15, 0.72)"
          : "rgba(255, 255, 255, 0.82)",
        outlineWidth: 2,
        selectedOpacity: 0.96,
        selectedWidth: 7,
      },
    },
    shadow: {
      sheet: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
      },
      card: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
      },
      floating: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
      },
    },
  };
}
