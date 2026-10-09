export type ColorSchemePreference = "dark" | "light" | "system";

export type ResolvedColorScheme = "dark" | "light";

export const colorSchemePreferences: ColorSchemePreference[] = [
  "light",
  "dark",
  "system",
];

export function isColorSchemePreference(
  value: string | null,
): value is ColorSchemePreference {
  return colorSchemePreferences.includes(value as ColorSchemePreference);
}

export function resolveColorScheme(
  preference: ColorSchemePreference,
  systemColorScheme: string | null | undefined,
): ResolvedColorScheme {
  if (preference === "system") {
    return systemColorScheme === "dark" ? "dark" : "light";
  }

  return preference;
}
