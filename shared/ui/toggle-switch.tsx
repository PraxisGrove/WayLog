import {
  type ComponentProps,
  type ComponentType,
  useEffect,
  useRef,
} from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  Switch,
  type ViewStyle,
} from "react-native";

import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";

export type ToggleSwitchVariant = "setting" | "accent";

type SwitchProps = ComponentProps<typeof Switch>;

type CrossPlatformSwitchExtraProps = {
  activeThumbColor?: SwitchProps["thumbColor"];
};

const CrossPlatformSwitch = Switch as ComponentType<
  SwitchProps & CrossPlatformSwitchExtraProps
>;

type ToggleSwitchProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
  scale?: number;
  style?: StyleProp<ViewStyle>;
  value: boolean;
  variant?: ToggleSwitchVariant;
};

export function ToggleSwitch({
  accessibilityLabel,
  disabled = false,
  onValueChange,
  scale = 1,
  style,
  value,
  variant = "setting",
}: ToggleSwitchProps) {
  const theme = useAppTheme();
  const colors = getToggleColors(theme, variant);

  if (variant === "accent") {
    return (
      <UiWorldToggleSwitch
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onValueChange={onValueChange}
        scale={scale}
        style={style}
        theme={theme}
        value={value}
      />
    );
  }

  return (
    <CrossPlatformSwitch
      {...(Platform.OS === "web" ? { activeThumbColor: colors.thumbOn } : {})}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      disabled={disabled}
      ios_backgroundColor={colors.trackOff}
      onValueChange={onValueChange}
      style={[scale !== 1 ? { transform: [{ scale }] } : null, style]}
      thumbColor={value ? colors.thumbOn : colors.thumbOff}
      trackColor={{ false: colors.trackOff, true: colors.trackOn }}
      value={value}
    />
  );
}

function UiWorldToggleSwitch({
  accessibilityLabel,
  disabled,
  onValueChange,
  scale = 1,
  style,
  theme,
  value,
}: ToggleSwitchProps & { theme: AppTheme }) {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;
  const isPrototypeSkin = theme.id === "default";

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [progress, value]);

  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.surfacePressed, theme.colors.primary],
  });
  const knobTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 18],
  });
  const knobFill = progress.interpolate({
    inputRange: [0, 1],
    outputRange: isPrototypeSkin
      ? [theme.colors.surface, theme.colors.surface]
      : ["rgba(255, 255, 255, 0)", "rgb(255, 255, 255)"],
  });

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={() => onValueChange(!value)}
      style={[
        scale !== 1 ? { transform: [{ scale }] } : null,
        disabled && styles.disabledSwitch,
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.uiWorldTrack,
          isPrototypeSkin && {
            borderWidth: 0,
          },
          { backgroundColor: trackColor },
        ]}
      >
        <Animated.View
          style={[
            styles.uiWorldKnob,
            isPrototypeSkin && {
              borderWidth: 0,
              elevation: 0,
              shadowOpacity: 0,
              shadowRadius: 0,
            },
            {
              backgroundColor: knobFill,
              transform: [{ translateX: knobTranslateX }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

type ToggleColorSet = {
  thumbOff: string;
  thumbOn: string;
  trackOff: string;
  trackOn: string;
};

function getToggleColors(
  theme: AppTheme,
  variant: ToggleSwitchVariant,
): ToggleColorSet {
  if (variant === "accent") {
    return {
      thumbOff: theme.colors.primary,
      thumbOn: theme.colors.primary,
      trackOff: theme.colors.surfaceMuted,
      trackOn: theme.colors.primarySoft,
    };
  }

  return {
    thumbOff: theme.colors.surface,
    thumbOn: theme.colors.onPrimary,
    trackOff: theme.colors.borderStrong,
    trackOn: theme.colors.primary,
  };
}

const styles = StyleSheet.create({
  disabledSwitch: {
    opacity: 0.5,
  },
  uiWorldTrack: {
    position: "relative",
    width: 42,
    height: 24,
    alignItems: "flex-start",
    justifyContent: "center",
    borderRadius: 20,
  },
  uiWorldKnob: {
    width: 16,
    height: 16,
    marginLeft: 4,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    borderRadius: 8,
    shadowColor: "#080808",
    shadowOffset: { width: 5, height: 2 },
    shadowOpacity: 0.26,
    shadowRadius: 7,
    elevation: 3,
  },
});
