import * as SplashScreen from "expo-splash-screen";
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";

const LIGHT_BACKGROUND = "#FFF5DA";
const DARK_BACKGROUND = "#102F33";
const ARTWORK_SIZE = 240;

const lightArtwork = require("@/assets/images/waylog-label/splash-icon-waylog-label.png");
const androidArtwork = require("@/assets/images/waylog-label/splash-icon-waylog-label-android.png");

void SplashScreen.preventAutoHideAsync();

export function StartupSplashAnimation({ children }: PropsWithChildren) {
  const colorScheme = useColorScheme();
  const [isVisible, setVisible] = useState(Platform.OS !== "web");
  const hasStartedRef = useRef(false);
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const rippleProgress = useRef(new Animated.Value(0)).current;
  const scaleX = useRef(new Animated.Value(1)).current;
  const scaleY = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const finishWithoutMotion = useCallback(() => {
    SplashScreen.hide();
    setVisible(false);
  }, []);

  const startAnimation = useCallback(async () => {
    if (hasStartedRef.current || Platform.OS === "web") {
      return;
    }

    hasStartedRef.current = true;
    const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled().catch(
      () => false,
    );

    requestAnimationFrame(() => {
      if (reduceMotion) {
        finishWithoutMotion();
        return;
      }

      SplashScreen.hide();

      Animated.parallel([
        Animated.sequence([
          Animated.delay(60),
          Animated.timing(translateY, {
            duration: 130,
            easing: Easing.out(Easing.cubic),
            toValue: -4,
            useNativeDriver: true,
          }),
          Animated.parallel([
            Animated.timing(translateY, {
              duration: 140,
              easing: Easing.in(Easing.cubic),
              toValue: 5,
              useNativeDriver: true,
            }),
            Animated.timing(scaleX, {
              duration: 140,
              easing: Easing.out(Easing.quad),
              toValue: 1.016,
              useNativeDriver: true,
            }),
            Animated.timing(scaleY, {
              duration: 140,
              easing: Easing.out(Easing.quad),
              toValue: 0.97,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(translateY, {
              duration: 145,
              easing: Easing.out(Easing.cubic),
              toValue: -3,
              useNativeDriver: true,
            }),
            Animated.timing(scaleX, {
              duration: 145,
              easing: Easing.out(Easing.cubic),
              toValue: 0.998,
              useNativeDriver: true,
            }),
            Animated.timing(scaleY, {
              duration: 145,
              easing: Easing.out(Easing.cubic),
              toValue: 1.005,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(translateY, {
              duration: 135,
              easing: Easing.inOut(Easing.quad),
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.timing(scaleX, {
              duration: 135,
              easing: Easing.inOut(Easing.quad),
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.timing(scaleY, {
              duration: 135,
              easing: Easing.inOut(Easing.quad),
              toValue: 1,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(270),
          Animated.timing(rippleProgress, {
            duration: 360,
            easing: Easing.out(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(650),
          Animated.timing(overlayOpacity, {
            duration: 180,
            easing: Easing.out(Easing.quad),
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        setVisible(false);
      });
    });
  }, [
    finishWithoutMotion,
    overlayOpacity,
    rippleProgress,
    scaleX,
    scaleY,
    translateY,
  ]);

  useEffect(() => {
    if (Platform.OS === "web") {
      SplashScreen.hide();
      return;
    }

    const fallbackTimer = setTimeout(() => {
      void startAnimation();
    }, 1000);

    return () => {
      clearTimeout(fallbackTimer);
    };
  }, [startAnimation]);

  const rippleOpacity = rippleProgress.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0.5, 0],
  });
  const rippleScale = rippleProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 2.25],
  });
  const backgroundColor =
    colorScheme === "dark" ? DARK_BACKGROUND : LIGHT_BACKGROUND;

  return (
    <View style={styles.root}>
      {children}
      {isVisible ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.overlay,
            {
              backgroundColor,
              opacity: overlayOpacity,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.artworkContainer,
              {
                transform: [{ translateY }, { scaleX }, { scaleY }],
              },
            ]}
          >
            <Image
              onLoad={() => {
                void startAnimation();
              }}
              resizeMode="contain"
              source={Platform.OS === "android" ? androidArtwork : lightArtwork}
              style={styles.artwork}
            />
            <Animated.View
              style={[
                styles.ripple,
                {
                  opacity: rippleOpacity,
                  transform: [{ scale: rippleScale }],
                },
              ]}
            />
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  artwork: {
    height: ARTWORK_SIZE,
    width: ARTWORK_SIZE,
  },
  artworkContainer: {
    height: ARTWORK_SIZE,
    position: "relative",
    width: ARTWORK_SIZE,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  ripple: {
    borderColor: "#F45E41",
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    left: ARTWORK_SIZE * 0.815 - 18,
    position: "absolute",
    top: ARTWORK_SIZE * 0.68 - 18,
    width: 36,
  },
  root: {
    flex: 1,
  },
});
