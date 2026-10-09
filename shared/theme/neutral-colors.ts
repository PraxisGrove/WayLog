import type { ResolvedColorScheme } from "./color-scheme";

export const lightNeutralColors = {
  background: "#FCFCFB",
  surface: "#FFFFFF",
  surfaceMuted: "#FAFAF9",
  surfaceSubtle: "#F5F5F3",
  surfacePressed: "#EFEEEB",
  text: "#1C1917",
  textMuted: "#6F6964",
  textSubtle: "#827C76",
  border: "#E8E5E1",
  borderStrong: "#D8D4CF",
  overlay: "rgba(28, 25, 23, 0.38)",
  glass: "rgba(255, 255, 255, 0.82)",
  glassStrong: "rgba(255, 255, 255, 0.94)",
  glassBorder: "rgba(255, 255, 255, 0.90)",
  shadow: "#292524",
} as const;

export const darkNeutralColors = {
  background: "#0D1525",
  surface: "#182338",
  surfaceMuted: "#223149",
  surfaceSubtle: "#1D2A40",
  surfacePressed: "#30415B",
  text: "#F5F7FA",
  textMuted: "#B1BDCC",
  textSubtle: "#8B9AB0",
  border: "#30415A",
  borderStrong: "#435570",
  overlay: "rgba(2, 6, 23, 0.72)",
  glass: "rgba(24, 35, 56, 0.88)",
  glassStrong: "rgba(24, 35, 56, 0.96)",
  glassBorder: "rgba(148, 163, 184, 0.18)",
  shadow: "#000000",
} as const;

export function getNeutralColors(colorScheme: ResolvedColorScheme) {
  return colorScheme === "dark" ? darkNeutralColors : lightNeutralColors;
}
