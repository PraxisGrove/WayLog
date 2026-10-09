import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import type {
  AppTheme,
  ResolvedThemeMode,
  ThemePreference,
} from "@/shared/theme/theme";
import { useReducedMotion } from "@/shared/ui/use-reduced-motion";

type ThemeModeSelectorProps = {
  onChange: (preference: ThemePreference) => void;
  resolvedThemeMode: ResolvedThemeMode;
  theme: AppTheme;
  themePreference: ThemePreference;
};

type SparkleProps = {
  left: number;
  size: number;
  top: number;
  twinkle: Animated.Value;
};

function Sparkle({ left, size, top, twinkle }: SparkleProps) {
  const scale = twinkle.interpolate({
    inputRange: [0, 0.4, 0.8, 1],
    outputRange: [1, 1.2, 0.8, 1],
  });
  const opacity = twinkle.interpolate({
    inputRange: [0, 0.4, 0.8, 1],
    outputRange: [1, 0.78, 1, 0.88],
  });

  return (
    <Animated.View
      style={[styles.star, { left, opacity, top, transform: [{ scale }] }]}
    >
      <Svg height={size} viewBox="0 0 20 20" width={size}>
        <Path
          d="M 0 10 C 10 10,10 10,0 10 C 10 10,10 10,10 20 C 10 10,10 10,20 10 C 10 10,10 10,10 0 C 10 10,10 10,0 10 Z"
          fill="#FFFFFF"
        />
      </Svg>
    </Animated.View>
  );
}

function DayNightSwitch({
  isDark,
  onPress,
}: {
  isDark: boolean;
  onPress: () => void;
}) {
  const isReducedMotionEnabled = useReducedMotion();
  const progress = useRef(new Animated.Value(isDark ? 1 : 0)).current;
  const cloudDrift = useRef(new Animated.Value(0)).current;
  const starTwinkles = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: isDark ? 1 : 0,
      duration: isReducedMotionEnabled ? 120 : 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [isDark, isReducedMotionEnabled, progress]);

  useEffect(() => {
    if (isReducedMotionEnabled) {
      cloudDrift.setValue(0);
      starTwinkles.forEach((twinkle) => {
        twinkle.setValue(0);
      });
      return;
    }

    cloudDrift.setValue(0);
    const cloudLoop = Animated.loop(
      Animated.timing(cloudDrift, {
        toValue: 1,
        duration: 6000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
    );
    cloudLoop.start();

    const starDelays = [300, 0, 600, 1300];
    const starLoops: Animated.CompositeAnimation[] = [];
    const timers = starTwinkles.map((twinkle, index) =>
      setTimeout(() => {
        twinkle.setValue(0);
        const loop = Animated.loop(
          Animated.timing(twinkle, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        );
        starLoops.push(loop);
        loop.start();
      }, starDelays[index]),
    );

    return () => {
      cloudLoop.stop();
      timers.forEach(clearTimeout);
      starLoops.forEach((loop) => {
        loop.stop();
      });
    };
  }, [cloudDrift, isReducedMotionEnabled, starTwinkles]);

  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["#2196F3", "#050505"],
  });
  const knobColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["#FFFF00", "#FFFFFF"],
  });
  const knobTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 26],
  });
  const knobRotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: isReducedMotionEnabled ? ["0deg", "0deg"] : ["0deg", "360deg"],
  });
  const cloudOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const starOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const moonDotOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const lightRayOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0],
  });
  const cloudTranslateX = cloudDrift.interpolate({
    inputRange: [0, 0.4, 0.8, 1],
    outputRange: [0, 4, -4, 0],
  });

  return (
    <Pressable
      accessibilityLabel={isDark ? "切换为浅色外观" : "切换为深色外观"}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      onPress={onPress}
      style={({ pressed }) => [styles.switch, pressed && styles.switchPressed]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          styles.switchBackground,
          { backgroundColor: trackColor },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[styles.stars, { opacity: starOpacity }]}
      >
        <Sparkle left={3} size={20} top={2} twinkle={starTwinkles[0]} />
        <Sparkle left={3} size={6} top={16} twinkle={starTwinkles[1]} />
        <Sparkle left={10} size={12} top={20} twinkle={starTwinkles[2]} />
        <Sparkle left={18} size={18} top={0} twinkle={starTwinkles[3]} />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.clouds,
          {
            opacity: cloudOpacity,
            transform: [{ translateX: cloudTranslateX }],
          },
        ]}
      >
        <View style={[styles.cloudCircle, styles.cloudOne]} />
        <View style={[styles.cloudCircle, styles.cloudTwo]} />
        <View style={[styles.cloudCircle, styles.cloudThree]} />
        <View style={[styles.cloudCircle, styles.cloudFour]} />
        <View style={[styles.cloudCircle, styles.cloudFive]} />
        <View style={[styles.cloudCircle, styles.cloudSix]} />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.sunMoon,
          {
            backgroundColor: knobColor,
            transform: [{ translateX: knobTranslateX }, { rotate: knobRotate }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.lightRay,
            styles.lightRayOne,
            { opacity: lightRayOpacity },
          ]}
        />
        <Animated.View
          style={[
            styles.lightRay,
            styles.lightRayTwo,
            { opacity: lightRayOpacity },
          ]}
        />
        <Animated.View
          style={[
            styles.lightRay,
            styles.lightRayThree,
            { opacity: lightRayOpacity },
          ]}
        />

        <Animated.View
          style={[
            styles.moonDot,
            styles.moonDotOne,
            { opacity: moonDotOpacity },
          ]}
        />
        <Animated.View
          style={[
            styles.moonDot,
            styles.moonDotTwo,
            { opacity: moonDotOpacity },
          ]}
        />
        <Animated.View
          style={[
            styles.moonDot,
            styles.moonDotThree,
            { opacity: moonDotOpacity },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

export function ThemeModeSelector({
  onChange,
  resolvedThemeMode,
  theme,
  themePreference,
}: ThemeModeSelectorProps) {
  const isDark = resolvedThemeMode === "dark";
  const isSystem = themePreference === "system";
  const modeLabel = isDark ? "深色" : "浅色";
  const systemContentColor = isSystem
    ? theme.colors.onPrimary
    : theme.colors.textMuted;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      <View style={styles.controlRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: isSystem }}
          onPress={() => onChange("system")}
          style={({ pressed }) => [
            styles.systemButton,
            {
              backgroundColor: isSystem
                ? theme.colors.primary
                : theme.colors.surfaceSubtle,
            },
            pressed && styles.pressed,
          ]}
        >
          <MaterialIcons
            name="settings-brightness"
            size={16}
            color={systemContentColor}
          />
          <Text
            numberOfLines={1}
            style={[styles.systemTitle, { color: systemContentColor }]}
          >
            跟随系统
          </Text>
        </Pressable>

        <View style={styles.manualGroup}>
          <DayNightSwitch
            isDark={isDark}
            onPress={() => onChange(isDark ? "light" : "dark")}
          />
          <Pressable
            accessibilityLabel={`当前${modeLabel}，点击切换`}
            accessibilityRole="button"
            onPress={() => onChange(isDark ? "light" : "dark")}
            style={({ pressed }) => [
              styles.modeLabelButton,
              pressed && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.modeText, { color: theme.colors.primary }]}
            >
              {modeLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 8,
    padding: 10,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  controlRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  systemButton: {
    minWidth: 0,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  systemTitle: {
    minWidth: 0,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
  },
  manualGroup: {
    minHeight: 44,
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  modeLabelButton: {
    minWidth: 44,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  modeText: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.72,
  },
  switch: {
    position: "relative",
    width: 60,
    height: 34,
    overflow: "hidden",
    borderRadius: 34,
  },
  switchBackground: {
    borderRadius: 34,
  },
  switchPressed: {
    transform: [{ scale: 0.97 }],
  },
  sunMoon: {
    position: "absolute",
    left: 4,
    bottom: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    zIndex: 3,
  },
  moonDot: {
    position: "absolute",
    backgroundColor: "#808080",
    zIndex: 4,
  },
  moonDotOne: {
    left: 10,
    top: 3,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  moonDotTwo: {
    left: 2,
    top: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  moonDotThree: {
    left: 16,
    top: 18,
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  lightRay: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    zIndex: -1,
  },
  lightRayOne: {
    left: -8,
    top: -8,
    width: 43,
    height: 43,
  },
  lightRayTwo: {
    left: -14,
    top: -14,
    width: 55,
    height: 55,
  },
  lightRayThree: {
    left: -18,
    top: -18,
    width: 60,
    height: 60,
  },
  clouds: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  cloudCircle: {
    position: "absolute",
    backgroundColor: "#EEEEEE",
    borderRadius: 999,
  },
  cloudOne: {
    left: 30,
    top: 15,
    width: 40,
    height: 40,
  },
  cloudTwo: {
    left: 44,
    top: 10,
    width: 20,
    height: 20,
  },
  cloudThree: {
    left: 18,
    top: 24,
    width: 30,
    height: 30,
    backgroundColor: "#CCCCCC",
  },
  cloudFour: {
    left: 36,
    top: 18,
    width: 40,
    height: 40,
  },
  cloudFive: {
    left: 48,
    top: 14,
    width: 20,
    height: 20,
  },
  cloudSix: {
    left: 22,
    top: 26,
    width: 30,
    height: 30,
  },
  stars: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
  },
  star: {
    position: "absolute",
  },
});
