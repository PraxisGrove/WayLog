import { THEME_COLORS } from "../../shared/theme/theme-colors";

export const APP_ICON_PATTERNS = [
  {
    id: "sunburst",
    name: "放射线",
    description: "从中心展开的放射线背景。",
  },
  {
    id: "handdrawn-check",
    name: "手绘棋盘",
    description: "带手绘起伏的棋盘背景。",
  },
  {
    id: "soft-waves",
    name: "柔和波浪",
    description: "细密柔和的波浪线背景。",
  },
  {
    id: "diagonal-bands",
    name: "斜光带",
    description: "斜向铺开的光带背景。",
  },
  {
    id: "wide-grid",
    name: "宽格纹",
    description: "留白更宽的格纹背景。",
  },
  {
    id: "tilted-check",
    name: "斜棋盘",
    description: "旋转后的棋盘格背景。",
  },
] as const;

export type AppIconPatternId = (typeof APP_ICON_PATTERNS)[number]["id"];

export const DEFAULT_APP_ICON_PATTERN: AppIconPatternId = "sunburst";

export type AppIconPalette = {
  main: string;
  soft: string;
};

export const APP_ICON_PALETTES: Record<string, AppIconPalette> = {
  warm: {
    main: "#F2CD68",
    soft: "#FFF0B8",
  },
  nature: {
    main: "#9DD6B5",
    soft: "#D3F0D7",
  },
  ocean: {
    main: "#68D6E8",
    soft: "#C8F2F4",
  },
  lavender: {
    main: "#B7A6DE",
    soft: "#DDD5F4",
  },
  cherry: {
    main: "#E99A9B",
    soft: "#FFD0C8",
  },
};

const themeColorIds = new Set(THEME_COLORS.map((color) => color.id));
const LEGACY_PATTERN_ID_MAP: Record<string, AppIconPatternId> = {
  a: "sunburst",
  f: "handdrawn-check",
  g: "soft-waves",
  h: "diagonal-bands",
  i: "wide-grid",
  j: "tilted-check",
};

export function isAppIconPatternId(
  value: string | null,
): value is AppIconPatternId {
  return APP_ICON_PATTERNS.some((pattern) => pattern.id === value);
}

export function normalizeAppIconPatternId(
  value: string | null,
): AppIconPatternId | undefined {
  if (!value) {
    return undefined;
  }

  if (isAppIconPatternId(value)) {
    return value;
  }

  return LEGACY_PATTERN_ID_MAP[value];
}

export function getAppIconName(
  themeColorId: string,
  patternId: AppIconPatternId,
): string {
  const normalizedThemeId = themeColorIds.has(themeColorId)
    ? themeColorId
    : THEME_COLORS[0].id;
  return `${normalizedThemeId}-${patternId}`;
}

export function getAppIconPalette(themeColorId: string): AppIconPalette {
  const normalizedThemeId = themeColorIds.has(themeColorId)
    ? themeColorId
    : THEME_COLORS[0].id;
  return (
    APP_ICON_PALETTES[normalizedThemeId] ??
    APP_ICON_PALETTES[THEME_COLORS[0].id]
  );
}
