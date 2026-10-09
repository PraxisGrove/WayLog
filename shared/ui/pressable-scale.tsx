import type { ComponentProps, ReactNode } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import {
  type HapticFeedback,
  triggerHaptic,
} from "@/shared/ui/haptic-feedback";

type PressableScaleProps = {
  accessibilityHint?: ComponentProps<typeof Pressable>["accessibilityHint"];
  accessibilityLabel?: ComponentProps<typeof Pressable>["accessibilityLabel"];
  accessibilityRole?: ComponentProps<typeof Pressable>["accessibilityRole"];
  accessibilityState?: ComponentProps<typeof Pressable>["accessibilityState"];
  children: ReactNode;
  disabled?: boolean;
  haptic?: HapticFeedback;
  pressedScale?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function PressableScale({
  children,
  pressedScale = 0.97,
  onPress,
  onLongPress,
  style,
  accessibilityHint,
  accessibilityLabel,
  accessibilityRole = "button",
  accessibilityState,
  disabled = false,
  haptic,
}: PressableScaleProps) {
  const theme = useAppTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      delayLongPress={350}
      disabled={disabled}
      onLongPress={onLongPress}
      onPress={() => {
        if (haptic) {
          triggerHaptic(haptic);
        }
        onPress?.();
      }}
      onPressIn={() => {
        if (disabled) return;
        scale.value = withSpring(pressedScale, theme.motion.spring.responsive);
      }}
      onPressOut={() => {
        if (disabled) return;
        scale.value = withSpring(1, theme.motion.spring.responsive);
      }}
      style={style}
    >
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </Pressable>
  );
}
