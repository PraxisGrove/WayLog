import type { ComponentProps, ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Platform, View } from "react-native";

import type { getProfileGlassSurface } from "@/shared/account/profile-visuals";

export type ProfileGlassSurfaceTone = ReturnType<typeof getProfileGlassSurface>;

export function getProfileGlassCardStyle(tone: ProfileGlassSurfaceTone) {
  return {
    backgroundColor:
      Platform.OS === "android"
        ? tone.androidCardBackgroundColor
        : tone.cardBackgroundColor,
    borderColor: tone.cardBorderColor,
  };
}

export function ProfileGlassCard({
  children,
  style,
  tone,
  ...restProps
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone: ProfileGlassSurfaceTone;
} & Omit<ComponentProps<typeof View>, "style">) {
  return (
    <View style={[style, getProfileGlassCardStyle(tone)]} {...restProps}>
      {children}
    </View>
  );
}
