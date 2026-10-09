import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/shared/theme/use-app-theme";
import { useReducedMotion } from "@/shared/ui/use-reduced-motion";

export type ModalMotionPreset = "dialog" | "drawer" | "sheet";

type ModalTransitionProps = {
  backdropAccessibilityLabel?: string;
  children?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  dismissOnBackdropPress?: boolean;
  drawerOffset?: number;
  drawerSide?: "left" | "right";
  isDismissDisabled?: boolean;
  keyboardAvoiding?: boolean;
  keyboardVerticalOffset?: number;
  onRequestClose?: () => void;
  overlayChildren?: ReactNode;
  overlayColor?: string;
  preset: ModalMotionPreset;
  rootStyle?: StyleProp<ViewStyle>;
  statusBarTranslucent?: boolean;
  visible: boolean;
};

const motionDuration = {
  dialog: {
    close: 130,
    open: 170,
  },
  drawer: {
    close: 180,
    open: 240,
  },
  sheet: {
    close: 150,
    open: 220,
  },
} satisfies Record<ModalMotionPreset, { close: number; open: number }>;

export function ModalTransition({
  backdropAccessibilityLabel = "关闭弹层",
  children,
  contentStyle,
  dismissOnBackdropPress = true,
  drawerOffset = 420,
  drawerSide = "right",
  isDismissDisabled = false,
  keyboardAvoiding = false,
  keyboardVerticalOffset = 0,
  onRequestClose,
  overlayChildren,
  overlayColor,
  preset,
  rootStyle,
  statusBarTranslucent = true,
  visible,
}: ModalTransitionProps) {
  const theme = useTheme();
  const isReducedMotionEnabled = useReducedMotion();
  const [isMounted, setIsMounted] = useState(visible);
  const transition = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    let cancelled = false;

    if (visible) {
      setIsMounted(true);
      transition.stopAnimation();
      Animated.timing(transition, {
        duration: isReducedMotionEnabled
          ? theme.tokens.motion.duration.fast
          : motionDuration[preset].open,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }).start();
      return () => {
        cancelled = true;
      };
    }

    transition.stopAnimation();
    Animated.timing(transition, {
      duration: isReducedMotionEnabled
        ? theme.tokens.motion.duration.fast
        : motionDuration[preset].close,
      easing: Easing.in(Easing.cubic),
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!cancelled && finished) {
        setIsMounted(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    isReducedMotionEnabled,
    preset,
    theme.tokens.motion.duration.fast,
    transition,
    visible,
  ]);

  if (!isMounted) {
    return null;
  }

  const handleBackdropPress = () => {
    if (!dismissOnBackdropPress || isDismissDisabled) {
      return;
    }

    onRequestClose?.();
  };

  const modalContent = (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.backdrop,
          { backgroundColor: overlayColor ?? theme.tokens.colors.overlay },
          { opacity: transition },
        ]}
      />
      <Pressable
        accessibilityLabel={backdropAccessibilityLabel}
        accessibilityRole="button"
        disabled={isDismissDisabled || !dismissOnBackdropPress}
        onPress={handleBackdropPress}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[
          contentStyle,
          getContentMotionStyle({
            drawerOffset,
            drawerSide,
            isReducedMotionEnabled,
            preset,
            transition,
          }),
        ]}
      >
        {children}
      </Animated.View>
      {overlayChildren}
    </>
  );

  return (
    <Modal
      animationType="none"
      onRequestClose={onRequestClose}
      statusBarTranslucent={statusBarTranslucent}
      transparent
      visible={isMounted}
    >
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={keyboardVerticalOffset}
          style={[styles.root, rootStyle]}
        >
          {modalContent}
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.root, rootStyle]}>{modalContent}</View>
      )}
    </Modal>
  );
}

function getContentMotionStyle({
  drawerOffset,
  drawerSide,
  isReducedMotionEnabled,
  preset,
  transition,
}: {
  drawerOffset: number;
  drawerSide: "left" | "right";
  isReducedMotionEnabled: boolean;
  preset: ModalMotionPreset;
  transition: Animated.Value;
}) {
  if (isReducedMotionEnabled) {
    return { opacity: transition };
  }

  if (preset === "dialog") {
    return {
      opacity: transition,
      transform: [
        {
          scale: transition.interpolate({
            inputRange: [0, 1],
            outputRange: [0.98, 1],
          }),
        },
      ],
    };
  }

  if (preset === "drawer") {
    const closedOffset = drawerSide === "left" ? -drawerOffset : drawerOffset;

    return {
      opacity: transition.interpolate({
        inputRange: [0, 1],
        outputRange: [0.98, 1],
      }),
      transform: [
        {
          translateX: transition.interpolate({
            inputRange: [0, 1],
            outputRange: [closedOffset, 0],
          }),
        },
      ],
    };
  }

  return {
    opacity: transition.interpolate({
      inputRange: [0, 1],
      outputRange: [0.94, 1],
    }),
    transform: [
      {
        translateY: transition.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
    ],
  };
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  root: {
    flex: 1,
  },
});
