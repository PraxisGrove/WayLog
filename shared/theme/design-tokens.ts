import { baseDesignTokens } from "./base-design-tokens";
import type { ResolvedColorScheme } from "./color-scheme";
import { getNeutralColors } from "./neutral-colors";
import {
  type ClassicPalette,
  type ClassicPaletteModeColors,
  DEFAULT_CLASSIC_PALETTE_ID,
  getClassicPaletteById,
  getClassicPaletteMode,
} from "./palettes/classic-palettes";
import { getSemanticColors } from "./semantic-colors";

export type ResolveDesignTokensOptions = {
  colorScheme: ResolvedColorScheme;
  palette: ClassicPalette;
};

type DesignTokenShadow = {
  elevation: number;
  shadowColor: string;
  shadowOffset: {
    height: number;
    width: number;
  };
  shadowOpacity: number;
  shadowRadius: number;
};

export type RouteMapVisualTokens = {
  area: {
    fillOpacity: number;
    strokeOpacity: number;
    strokeWidth: number;
  };
  marker: {
    desktopNameMaxLength: number;
    mobileNameMaxLength: number;
    palette: readonly [
      { background: string; text: string },
      ...{ background: string; text: string }[],
    ];
  };
  route: {
    color: string;
    estimatedOpacity: number;
    estimatedPattern: readonly number[];
    normalOpacity: number;
    normalWidth: number;
    outlineColor: string;
    outlineWidth: number;
    selectedOpacity: number;
    selectedWidth: number;
  };
};

export type ResolvedDesignTokens = {
  colors: {
    background: string;
    border: string;
    borderStrong: string;
    cyan: string;
    cyanSoft: string;
    danger: string;
    dangerBorder: string;
    dangerPressed: string;
    dangerSoft: string;
    disabled: string;
    disabledText: string;
    focusRing: string;
    glass: string;
    glassBorder: string;
    glassStrong: string;
    info: string;
    infoBorder: string;
    infoSoft: string;
    link: string;
    linkBorder: string;
    linkSoft: string;
    navigation: {
      activeBackground: string;
      activeBorder: string;
      floatingBorder: string;
    };
    onPrimary: string;
    orange: string;
    orangeSoft: string;
    overlay: string;
    placeholder: string;
    primary: string;
    primaryBorder: string;
    primaryPressed: string;
    primarySoft: string;
    shadow: string;
    slate: string;
    slateSoft: string;
    status: {
      completed: { background: string; border: string; text: string };
      planned: { background: string; border: string; text: string };
      traveling: { background: string; border: string; text: string };
    };
    success: string;
    successBorder: string;
    successSoft: string;
    surface: string;
    surfaceMuted: string;
    surfacePressed: string;
    surfaceSubtle: string;
    text: string;
    textMuted: string;
    textSubtle: string;
    ticket: ClassicPaletteModeColors["ticket"] & {
      featured: ClassicPaletteModeColors["ticket"]["featured"] & {
        dashSegmentLength: number;
        dashSegmentThickness: number;
        seamHeight: number;
        seamSplitY: number;
      };
      notch: string;
    };
    violet: string;
    violetSoft: string;
    warning: string;
    warningBorder: string;
    warningSoft: string;
  };
  id: string;
  layout: {
    bottomActionClearance: number;
    contentPadding: number;
    maxContentWidth: number;
    tabBarBaseHeight: number;
  };
  mode: ResolvedColorScheme;
  motion: typeof baseDesignTokens.motion;
  name: string;
  radius: {
    lg: number;
    md: number;
    pill: number;
    sm: number;
    xl: number;
    xs: number;
  };
  routeMap: RouteMapVisualTokens;
  shadow: {
    card: DesignTokenShadow;
    floating: DesignTokenShadow;
    sheet: DesignTokenShadow;
  };
  spacing: {
    lg: number;
    md: number;
    sm: number;
    xl: number;
    xs: number;
    xxl: number;
  };
  typography: typeof baseDesignTokens.typography;
};

export function resolveDesignTokens({
  colorScheme,
  palette,
}: ResolveDesignTokensOptions): ResolvedDesignTokens {
  const isDark = colorScheme === "dark";
  const paletteMode = getClassicPaletteMode(palette, colorScheme);
  const neutral = getNeutralColors(colorScheme);
  const semantic = getSemanticColors(colorScheme);
  const routeColor = paletteMode.primary;

  return {
    id: palette.id,
    name: palette.name,
    mode: colorScheme,
    colors: {
      ...neutral,
      ...semantic,
      primary: paletteMode.primary,
      primaryPressed: paletteMode.primaryPressed,
      primarySoft: paletteMode.primarySoft,
      primaryBorder: paletteMode.primaryBorder,
      onPrimary: paletteMode.onPrimary,
      focusRing: paletteMode.focusRing,
      navigation: paletteMode.navigation,
      ticket: {
        ...paletteMode.ticket,
        notch: neutral.background,
      },
    },
    ...baseDesignTokens,
    routeMap: {
      area: {
        fillOpacity: 0.06,
        strokeOpacity: 0.28,
        strokeWidth: 1.5,
      },
      marker: {
        desktopNameMaxLength: 10,
        mobileNameMaxLength: 8,
        palette: [
          { background: routeColor, text: paletteMode.onPrimary },
          { background: "#2563EB", text: "#FFFFFF" },
          { background: "#DB2777", text: "#FFFFFF" },
          { background: "#7C3AED", text: "#FFFFFF" },
        ],
      },
      route: {
        color: routeColor,
        estimatedOpacity: 0.58,
        estimatedPattern: [10, 8],
        normalOpacity: 0.76,
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
        shadowColor: neutral.shadow,
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: isDark ? 0.48 : 0.1,
        shadowRadius: 24,
        elevation: isDark ? 18 : 14,
      },
      card: {
        shadowColor: neutral.shadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.32 : 0.07,
        shadowRadius: 12,
        elevation: 4,
      },
      floating: {
        shadowColor: neutral.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.3 : 0.13,
        shadowRadius: 22,
        elevation: 10,
      },
    },
  };
}

const defaultClassicPalette = getClassicPaletteById(DEFAULT_CLASSIC_PALETTE_ID);

export const lightDesignTokens = resolveDesignTokens({
  colorScheme: "light",
  palette: defaultClassicPalette,
});

export const darkDesignTokens = resolveDesignTokens({
  colorScheme: "dark",
  palette: defaultClassicPalette,
});
