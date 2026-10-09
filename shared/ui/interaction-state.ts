import type { ViewStyle } from "react-native";

export type AppInteractionState =
  | "disabled"
  | "empty"
  | "error"
  | "loading"
  | "pressed"
  | "selected"
  | "skeleton";

export type PressedStateStyleOptions = {
  opacity?: number;
  scale?: number;
};

export function getPressedStateStyle({
  opacity = 0.78,
  scale = 0.98,
}: PressedStateStyleOptions = {}): ViewStyle {
  return {
    opacity,
    transform: [{ scale }],
  };
}

export function getDisabledStateStyle(opacity = 0.52): ViewStyle {
  return { opacity };
}

export function getLoadingStateStyle(opacity = 0.68): ViewStyle {
  return { opacity };
}
