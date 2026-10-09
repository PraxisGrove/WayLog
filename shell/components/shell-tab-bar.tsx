import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { BlurView } from "expo-blur";
import { type Href, usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getFeaturedTrip,
  getTripsWithSeed,
  quickActions,
  type TripQuickAction,
} from "@/features/trips";
import { getProfileGlassSurface } from "@/shared/account/profile-visuals";
import { useCurrentAuthUser } from "@/shared/hooks/use-current-auth-user";
import type { ShellTabBarPresetId } from "@/shared/theme/types";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { triggerHaptic } from "@/shared/ui/haptic-feedback";

const webGlassBackdropStyle = {
  backdropFilter: "blur(28px) saturate(160%)",
  WebkitBackdropFilter: "blur(28px) saturate(160%)",
} as ViewStyle;

type ThemeLabQuickAction = {
  title: string;
  detail: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  colorToken: TripQuickAction["colorToken"];
  backgroundColorToken: TripQuickAction["backgroundColorToken"];
  route: "themeLab";
};

type AddSheetQuickAction = TripQuickAction | ThemeLabQuickAction;

const themeLabQuickAction: ThemeLabQuickAction = {
  title: "Theme Lab",
  detail: "临时预览新皮肤组件",
  icon: "palette",
  colorToken: "violet",
  backgroundColorToken: "violetSoft",
  route: "themeLab",
};

const addSheetQuickActions: AddSheetQuickAction[] = [
  ...quickActions,
  themeLabQuickAction,
];

type ShellTabBarProps = {
  preset?: ShellTabBarPresetId;
};

export function ShellTabBar({ preset = "centerAdd" }: ShellTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useAppTheme();
  const [authUser] = useCurrentAuthUser();
  const isLoggedIn = authUser !== null;
  const [isAddSheetVisible, setAddSheetVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const isCompactViewport = windowWidth <= 375;
  const tabBarHorizontalMargin = theme.layout.contentPadding;
  const availableTabBarWidth = windowWidth - tabBarHorizontalMargin * 2;
  const addButtonSize = isCompactViewport ? 44 : 46;
  const tabBarHeight = addButtonSize + 6;
  const tabControlHeight = tabBarHeight - 6;
  const isRightFabPreset = preset === "rightFab";
  const rightFabGap = isCompactViewport ? 10 : 12;
  const rightFabClearance = isRightFabPreset ? addButtonSize + rightFabGap : 0;
  const tabBarWidth = isRightFabPreset
    ? Math.max(0, availableTabBarWidth - rightFabClearance)
    : availableTabBarWidth;
  const tabControlWidth = isRightFabPreset
    ? Math.min(Math.max((tabBarWidth - 24) / 3, 72), 118)
    : Math.min(Math.max((tabBarWidth - addButtonSize - 44) / 3, 70), 112);
  const tabBarBottom =
    Platform.OS === "android" ? 10 : Math.max(insets.bottom, 8) + 6;
  const fabLeft = windowWidth - tabBarHorizontalMargin - addButtonSize;

  const isDark = theme.mode === "dark";
  const isPrototypeSkin = theme.id === "default";
  const isProfileRoute = !isPrototypeSkin && pathname.startsWith("/profile");
  const profileGlassTone = isProfileRoute
    ? getProfileGlassSurface(theme)
    : undefined;
  const tabBarSurface = isProfileRoute
    ? Platform.OS === "android"
      ? profileGlassTone?.androidCardBackgroundColor
      : profileGlassTone?.tabBarBackgroundColor
    : Platform.OS === "android"
      ? theme.colors.glassStrong
      : theme.colors.glass;
  const tabBarBorder = isProfileRoute
    ? profileGlassTone?.tabBarBorderColor
    : isPrototypeSkin
      ? "transparent"
      : theme.colors.glassBorder;
  const activeTabSurface = theme.colors.navigation.activeBackground;
  const activeTabContent = theme.colors.primary;
  const activeTabBorder = isPrototypeSkin
    ? "transparent"
    : theme.colors.navigation.activeBorder;
  const shouldHideTabBar = pathname.startsWith("/agent");

  const sheetTranslateY = useSharedValue(0);
  const sheetShadowOpacity = useSharedValue(0.12);
  const backdropOpacity = useSharedValue(1);

  const openSheet = () => {
    sheetTranslateY.value = 0;
    sheetShadowOpacity.value = 0.12;
    backdropOpacity.value = 1;
    setAddSheetVisible(true);
  };

  const finishGestureDismiss = () => {
    triggerHaptic("light");
    setAddSheetVisible(false);
  };

  const closeSheet = () => {
    setAddSheetVisible(false);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      const translationY = Math.max(0, event.translationY);

      sheetTranslateY.value = translationY;
      sheetShadowOpacity.value = Math.max(0.03, 0.12 - translationY * 0.0007);
      backdropOpacity.value = Math.max(
        0,
        1 - translationY / Math.max(windowHeight * 0.55, 320),
      );
    })
    .onEnd((event) => {
      const draggedFarEnough = event.translationY >= 96;
      const flickedDown = event.velocityY >= 850 && event.translationY >= 24;

      if (draggedFarEnough || flickedDown) {
        sheetTranslateY.value = withTiming(
          windowHeight,
          { duration: 180 },
          (finished) => {
            if (finished) {
              runOnJS(finishGestureDismiss)();
            }
          },
        );
        sheetShadowOpacity.value = withTiming(0, { duration: 150 });
        backdropOpacity.value = withTiming(0, { duration: 150 });
      } else {
        sheetTranslateY.value = withSpring(0, {
          damping: 22,
          mass: 0.8,
          overshootClamping: true,
          stiffness: 280,
        });
        sheetShadowOpacity.value = withTiming(0.12, { duration: 160 });
        backdropOpacity.value = withTiming(1, { duration: 160 });
      }
    })
    .onFinalize((_event, success) => {
      if (!success) {
        sheetTranslateY.value = withSpring(0, {
          damping: 22,
          mass: 0.8,
          overshootClamping: true,
          stiffness: 280,
        });
        sheetShadowOpacity.value = withTiming(0.12, { duration: 160 });
        backdropOpacity.value = withTiming(1, { duration: 160 });
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
    shadowOpacity: sheetShadowOpacity.value,
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const renderNavTab = (
    iconName: keyof typeof MaterialIcons.glyphMap,
    label: string,
    route: "/" | "/agent" | "/profile",
  ) => {
    const focused =
      route === "/" ? pathname === "/" : pathname.startsWith(route);
    const color = focused ? activeTabContent : theme.colors.textSubtle;

    return (
      <AnimatedNavTabButton
        activeBackgroundColor={activeTabSurface}
        activeBorderColor={activeTabBorder}
        color={color}
        controlHeight={tabControlHeight}
        controlWidth={tabControlWidth}
        focused={focused}
        iconName={iconName}
        isPrototypeSkin={isPrototypeSkin}
        label={label}
        key={route}
        onPress={() => {
          if (!focused) {
            router.push(route);
          }
        }}
      />
    );
  };

  const handleQuickActionPress = async (action: AddSheetQuickAction) => {
    setAddSheetVisible(false);

    if (action.route === "themeLab") {
      router.push("/theme-lab" as Href);
      return;
    }

    if (!isLoggedIn) {
      router.push("/profile");
      return;
    }

    if (action.route === "newTrip") {
      router.push("/trips/new");
      return;
    }

    if (action.route === "importGuide") {
      router.push("/trips/import");
      return;
    }

    if (action.route === "recordExpense") {
      const trips = await getTripsWithSeed();
      const primaryTrip = getFeaturedTrip(trips);

      if (primaryTrip) {
        router.push({
          pathname: "/trips/[id]",
          params: { id: primaryTrip.id, action: "expense" },
        });
        return;
      }

      router.push("/trips/new");
    }
  };

  const handleAddButtonPress = () => {
    if (!isLoggedIn) {
      router.push("/profile");
      return;
    }
    openSheet();
  };

  const addButton = (
    <AnimatedAddButton
      accessibilityLabel="打开快速添加"
      borderColor={theme.colors.navigation.floatingBorder}
      color={theme.colors.primary}
      iconColor={theme.colors.onPrimary}
      isPrototypeSkin={isPrototypeSkin}
      onPress={handleAddButtonPress}
      size={addButtonSize}
      style={isRightFabPreset ? undefined : styles.centerAddButtonSpacing}
    />
  );

  return (
    <>
      {shouldHideTabBar ? null : (
        <View
          pointerEvents="box-none"
          style={[
            styles.glassTabBarWrap,
            {
              bottom: tabBarBottom,
              left: tabBarHorizontalMargin,
              width: tabBarWidth,
            },
          ]}
        >
          <View
            style={[
              styles.glassTabBar,
              isPrototypeSkin && styles.glassTabBarPrototype,
              isPrototypeSkin ? null : theme.shadow.floating,
              {
                height: tabBarHeight,
                borderColor: tabBarBorder,
                borderRadius: tabBarHeight / 2,
                backgroundColor:
                  Platform.OS === "ios" ? "transparent" : tabBarSurface,
              },
              Platform.OS === "web" && !isPrototypeSkin
                ? webGlassBackdropStyle
                : null,
            ]}
          >
            {Platform.OS === "ios" && !isPrototypeSkin ? (
              <BlurView
                intensity={86}
                pointerEvents="none"
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            {renderNavTab("map", "行程", "/")}
            {renderNavTab("auto-awesome", "规划", "/agent")}
            {isRightFabPreset ? null : addButton}
            {renderNavTab("person-outline", "我的", "/profile")}
          </View>
        </View>
      )}

      {!shouldHideTabBar && isRightFabPreset ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.detachedAddButtonWrap,
            {
              bottom: tabBarBottom + 3,
              left: fabLeft,
              width: addButtonSize,
              height: addButtonSize,
            },
          ]}
        >
          {addButton}
        </View>
      ) : null}

      {/*
       * 底部动作面板 Modal
       * - 半透明遮罩（点击可关闭）
       * - 从底部弹出的卡片式面板
       * - 包含常用快捷操作列表
       */}
      <Modal
        animationType="none"
        hardwareAccelerated
        onRequestClose={closeSheet}
        statusBarTranslucent
        transparent
        visible={!shouldHideTabBar && isAddSheetVisible}
      >
        <View style={styles.modalRoot}>
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              backdropAnimatedStyle,
              { backgroundColor: theme.colors.overlay },
            ]}
          />

          <Pressable
            accessibilityLabel="关闭快速添加"
            accessibilityRole="button"
            onPress={closeSheet}
            style={StyleSheet.absoluteFill}
          />

          <Animated.View
            style={[
              styles.sheet,
              theme.shadow.sheet,
              sheetAnimatedStyle,
              {
                backgroundColor: theme.colors.surface,
                borderTopLeftRadius: theme.radius.lg,
                borderTopRightRadius: theme.radius.lg,
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
          >
            <GestureDetector gesture={panGesture}>
              <View
                accessibilityLabel="下拉关闭快速添加"
                style={styles.sheetDragRegion}
              >
                <View
                  style={[
                    styles.sheetHandle,
                    { backgroundColor: theme.colors.borderStrong },
                  ]}
                />

                <View style={styles.sheetTitleContainer}>
                  <Text
                    style={[styles.sheetTitle, { color: theme.colors.text }]}
                  >
                    想做什么？
                  </Text>
                  <Text
                    style={[
                      styles.sheetSubtitle,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    从一个动作开始整理这次旅程
                  </Text>
                </View>
              </View>
            </GestureDetector>

            <View style={styles.actionStack}>
              <Text
                style={[
                  styles.sectionLabel,
                  { color: theme.colors.textSubtle },
                ]}
              >
                快捷添加
              </Text>

              <View
                style={[
                  styles.quickActionList,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                {addSheetQuickActions.map((action, index) => (
                  <Pressable
                    accessibilityRole="button"
                    key={action.title}
                    onPress={() => void handleQuickActionPress(action)}
                    style={({ pressed }) => [
                      styles.quickActionRow,
                      index < addSheetQuickActions.length - 1 && {
                        borderBottomColor: theme.colors.border,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                      },
                      pressed && {
                        backgroundColor: theme.colors.surfacePressed,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.actionIconContainerSmall,
                        {
                          backgroundColor: theme.colors[
                            action.backgroundColorToken
                          ] as string,
                          borderRadius: theme.radius.sm,
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={action.icon}
                        size={21}
                        color={theme.colors[action.colorToken] as string}
                      />
                    </View>
                    <View style={styles.actionContent}>
                      <Text
                        style={[
                          styles.actionTitleSmall,
                          { color: theme.colors.text },
                        ]}
                      >
                        {action.title}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.actionDetailSmall,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        {action.detail}
                      </Text>
                    </View>
                    <MaterialIcons
                      name="chevron-right"
                      size={22}
                      color={theme.colors.textSubtle}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

type AnimatedNavTabButtonProps = {
  activeBackgroundColor: string;
  activeBorderColor: string;
  color: string;
  controlHeight: number;
  controlWidth: number;
  focused: boolean;
  iconName: keyof typeof MaterialIcons.glyphMap;
  isPrototypeSkin: boolean;
  label: string;
  onPress: () => void;
};

function AnimatedNavTabButton({
  activeBackgroundColor,
  activeBorderColor,
  color,
  controlHeight,
  controlWidth,
  focused,
  iconName,
  isPrototypeSkin,
  label,
  onPress,
}: AnimatedNavTabButtonProps) {
  const pressProgress = useSharedValue(0);
  const activeProgress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    activeProgress.value = withTiming(focused ? 1 : 0, { duration: 180 });
  }, [activeProgress, focused]);

  const tabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressProgress.value * 0.035 }],
  }));

  const activePillAnimatedStyle = useAnimatedStyle(() => ({
    opacity: activeProgress.value,
  }));

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onPressIn={() => {
        pressProgress.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        pressProgress.value = withTiming(0, { duration: 150 });
      }}
      style={styles.tabButton}
    >
      <Animated.View style={[styles.tabButtonAnimated, tabAnimatedStyle]}>
        <Animated.View
          style={[
            styles.tabPill,
            isPrototypeSkin && styles.tabPillPrototype,
            {
              height: controlHeight,
              width: controlWidth,
              borderRadius: controlHeight / 2,
            },
            focused && styles.tabPillFocused,
            focused && isPrototypeSkin && styles.tabPillFocusedPrototype,
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.activeTabPillBackground,
              isPrototypeSkin && styles.activeTabPillBackgroundPrototype,
              {
                backgroundColor: activeBackgroundColor,
                borderColor: activeBorderColor,
                borderRadius: controlHeight / 2,
              },
              activePillAnimatedStyle,
            ]}
          />
          <View style={styles.tabPillContent}>
            <MaterialIcons name={iconName} size={20} color={color} />
            <Text numberOfLines={1} style={[styles.tabLabel, { color }]}>
              {label}
            </Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

type AnimatedAddButtonProps = {
  accessibilityLabel: string;
  borderColor: string;
  color: string;
  iconColor: string;
  isPrototypeSkin: boolean;
  onPress: () => void;
  size: number;
  style?: StyleProp<ViewStyle>;
};

function AnimatedAddButton({
  accessibilityLabel,
  borderColor,
  color,
  iconColor,
  isPrototypeSkin,
  onPress,
  size,
  style,
}: AnimatedAddButtonProps) {
  const pressProgress = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressProgress.value * 0.08,
    transform: [
      { translateY: pressProgress.value * 1.5 },
      { scale: 1 - pressProgress.value * 0.055 },
    ],
  }));

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => {
        pressProgress.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        pressProgress.value = withTiming(0, { duration: 150 });
      }}
      style={[
        styles.addButtonContainer,
        style,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.addButton,
          isPrototypeSkin && styles.addButtonPrototype,
          animatedStyle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            borderColor,
          },
        ]}
      >
        <MaterialIcons name="add" size={24} color={iconColor} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glassTabBarWrap: {
    position: "absolute",
    zIndex: 10,
  },
  detachedAddButtonWrap: {
    position: "absolute",
    zIndex: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  glassTabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
    borderWidth: 1,
    paddingHorizontal: 4,
  },
  glassTabBarPrototype: {
    borderWidth: 0,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  tabButtonAnimated: {
    alignItems: "center",
    justifyContent: "center",
  },
  tabPill: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
  },
  tabPillPrototype: {
    borderWidth: 0,
  },
  activeTabPillBackground: {
    borderWidth: 1,
  },
  activeTabPillBackgroundPrototype: {
    borderWidth: 0,
  },
  tabPillContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
  },
  tabPillFocused: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 1,
  },
  tabPillFocusedPrototype: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  tabLabel: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  addButtonContainer: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginHorizontal: 0,
  },
  centerAddButtonSpacing: {
    marginHorizontal: 8,
  },
  addButton: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    elevation: 4,
  },
  addButtonPrototype: {
    borderWidth: 0,
    elevation: 0,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 680,
    maxHeight: "88%",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 12,
    marginBottom: 8,
  },
  sheetDragRegion: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  sheetTitleContainer: {
    paddingBottom: 18,
    paddingHorizontal: 4,
    paddingTop: 12,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28,
  },
  sheetSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  actionStack: {
    gap: 14,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    lineHeight: 16,
    marginBottom: -5,
    marginLeft: 4,
  },
  quickActionList: {
    borderWidth: 1,
    overflow: "hidden",
  },
  quickActionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionIconContainerSmall: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  actionContent: {
    flex: 1,
    gap: 4,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 22,
  },
  actionDetail: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionTitleSmall: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  actionDetailSmall: {
    fontSize: 12,
    lineHeight: 16,
  },
});
