export type AndroidNavigationBarRequestedStyle =
  | "auto"
  | "dark"
  | "inverted"
  | "light";

export type AndroidNavigationBarButtonStyle = "dark" | "light";

export function resolveAndroidNavigationBarButtonStyle(
  requestedStyle: AndroidNavigationBarRequestedStyle,
  systemColorScheme: string | null | undefined,
): AndroidNavigationBarButtonStyle {
  switch (requestedStyle) {
    case "dark":
      return "light";
    case "light":
      return "dark";
    case "inverted":
      return systemColorScheme === "dark" ? "dark" : "light";
    default:
      return systemColorScheme === "dark" ? "light" : "dark";
  }
}
