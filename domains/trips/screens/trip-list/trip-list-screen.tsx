import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createDiagnosticLogger } from "@/features/diagnostics";
import {
  addTripsUpdateListener,
  deleteTrip,
  getFeaturedTrip,
  getLocalTripsSnapshot,
  getPlaceForTripDayItem,
  getSortedTripDayItems,
  getTrips,
  getTripsWithSeed,
  getTripTodayDay,
  setPendingPlaceDetail,
  type Trip,
  type TripDayItem,
  toggleTripPinned,
} from "@/features/trips";
import { getTripWeather, type TripWeatherOverview } from "@/features/weather";
import { useCurrentAuthUser } from "@/shared/hooks/use-current-auth-user";
import { syncAll } from "@/shared/hooks/use-multi-device-sync";
import { useScrollPosition } from "@/shared/hooks/use-scroll-position";
import { skinSlotAdapterIds } from "@/shared/theme/skin-slot-registry";
import type { AppTheme } from "@/shared/theme/theme";
import {
  useAppTheme,
  useHomeLayoutPreset,
  useSkinSlot,
} from "@/shared/theme/use-app-theme";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { EmptyState } from "@/shared/ui/empty-state";
import { triggerHaptic } from "@/shared/ui/haptic-feedback";
import { ModalTransition } from "@/shared/ui/modal-transition";
import { TripListSkeleton } from "@/shared/ui/skeleton";
import { TodayRoutePills } from "./components/today-route-pills";
import { TripCard } from "./components/trip-card";
import {
  resolveTripListHomeLayout,
  type TripListHomeModuleId,
} from "./home-layout-preset";

const tripListScreenLogger = createDiagnosticLogger("trip-list-screen");
export function TripListScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { resolvedHomeLayoutPreset } = useHomeLayoutPreset();
  const featuredTripCardSlot = useSkinSlot("home.featuredTripCard");
  const tripListCardSlot = useSkinSlot("home.tripListCard");
  const todayPlanSlot = useSkinSlot("home.todayPlan");
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [authUser] = useCurrentAuthUser();
  const isLoggedIn = authUser !== null;

  const longPressHandledTripIdRef = useRef("");
  const hasAnimatedRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isRefreshing, setRefreshing] = useState(false);

  const [updatingTripId, setUpdatingTripId] = useState("");
  const [activeTripId, setActiveTripId] = useState("");
  const [isConfirmingDelete, setConfirmingDelete] = useState(false);

  const [primaryTripWeather, setPrimaryTripWeather] = useState<
    TripWeatherOverview | undefined
  >();

  const primaryTrip = useMemo(() => getFeaturedTrip(trips), [trips]);
  const todayDay = useMemo(
    () => (primaryTrip ? getTripTodayDay(primaryTrip) : undefined),
    [primaryTrip],
  );
  const todayItems = useMemo(
    () => getSortedTripDayItems(todayDay?.items ?? []),
    [todayDay],
  );
  const showTodaySection =
    primaryTrip?.status === "旅途中" && todayItems.length > 0;
  const homeLayout = useMemo(
    () => resolveTripListHomeLayout(resolvedHomeLayoutPreset),
    [resolvedHomeLayoutPreset],
  );
  const todayWeather = useMemo(
    () =>
      primaryTripWeather?.days.find(
        (forecast) => forecast.dayId === todayDay?.id,
      ),
    [primaryTripWeather, todayDay?.id],
  );
  const activeTrip = useMemo(
    () => trips.find((trip) => trip.id === activeTripId),
    [activeTripId, trips],
  );

  const loadTrips = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const localTrips = await getTripsWithSeed();
      setTrips(localTrips);
    } catch (loadError) {
      tripListScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to load trips.", loadError] },
        "Legacy warning captured",
      );
      setError("读取本地行程失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setStatusMessage("");
    setStatusError("");

    try {
      await syncAll();
      const latestTrips = await getTrips();
      setTrips(latestTrips);
      setStatusMessage("同步成功");
      setTimeout(() => setStatusMessage(""), 2000);
    } catch (refreshError) {
      tripListScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to refresh trips.", refreshError] },
        "Legacy warning captured",
      );
      setStatusError("同步失败，请稍后再试");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const refreshTrips = async () => {
        setLoading(true);
        setError("");

        try {
          const localTrips = await getTripsWithSeed();

          if (isActive) {
            setTrips(localTrips);
            setStatusError("");

            if (!hasAnimatedRef.current && localTrips.length > 0) {
              hasAnimatedRef.current = true;
              fadeAnim.setValue(0);
              Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
              }).start();
            }
          }
        } catch (loadError) {
          tripListScreenLogger.warn(
            "legacy.warn",
            { args: ["Failed to load trips.", loadError] },
            "Legacy warning captured",
          );

          if (isActive) {
            setError("读取本地行程失败，请稍后再试");
          }
        } finally {
          if (isActive) {
            setLoading(false);
          }
        }
      };

      const refreshStatuses = async () => {
        try {
          const localTrips = await getTripsWithSeed();

          if (isActive) {
            setTrips(localTrips);
          }
        } catch (loadError) {
          tripListScreenLogger.warn(
            "legacy.warn",
            { args: ["Failed to refresh trip statuses.", loadError] },
            "Legacy warning captured",
          );
        }
      };

      refreshTrips();
      const statusRefreshTimer = setInterval(refreshStatuses, 60 * 1000);

      return () => {
        isActive = false;
        clearInterval(statusRefreshTimer);
      };
    }, [fadeAnim]),
  );

  useEffect(() => {
    if (authUser === null && !isLoading) {
      void getTripsWithSeed().then(setTrips);
    }
  }, [authUser, isLoading]);

  useEffect(() => {
    const unsubscribe = addTripsUpdateListener(async () => {
      try {
        const latestTrips = await getLocalTripsSnapshot();
        setTrips(latestTrips);
      } catch (error) {
        tripListScreenLogger.warn(
          "legacy.warn",
          { args: ["Failed to refresh trips after sync.", error] },
          "Legacy warning captured",
        );
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!primaryTrip) {
      setPrimaryTripWeather(undefined);
      return undefined;
    }

    let isActive = true;

    const loadPrimaryTripWeather = async () => {
      const weather = await getTripWeather(primaryTrip);

      if (isActive) {
        setPrimaryTripWeather(weather);
      }
    };

    void loadPrimaryTripWeather();

    return () => {
      isActive = false;
    };
  }, [primaryTrip]);

  const openNewTrip = () => {
    if (!isLoggedIn) {
      router.push("/profile");
      return;
    }
    router.push("/trips/new");
  };

  const openGlobalSearch = () => {
    router.push({
      pathname: "/search",
      params: { scope: "places" },
    });
  };

  const openTripDetail = useCallback(
    (tripId: string) => {
      router.push({
        pathname: "/trips/[id]",
        params: { id: tripId },
      });
    },
    [router],
  );

  const openTodayDayDetail = useCallback(() => {
    if (!primaryTrip) {
      return;
    }

    router.push({
      pathname: "/trips/[id]",
      params: {
        ...(todayDay ? { dayId: todayDay.id } : {}),
        id: primaryTrip.id,
      },
    });
  }, [primaryTrip, todayDay, router]);

  const handleTodayItemPress = (item: TripDayItem) => {
    if (!primaryTrip) {
      return;
    }

    const place = getPlaceForTripDayItem(primaryTrip, item);
    const localPlaceId = place?.id ?? item.placeId;

    if (!localPlaceId) {
      return;
    }

    const dayId = primaryTrip.days.find((day) =>
      day.items.some((dayItem) => dayItem.id === item.id),
    )?.id;
    if (place) {
      setPendingPlaceDetail(place);
    }

    router.push({
      pathname: "/trips/place",
      params: {
        dayId,
        itemId: item.id,
        localPlaceId,
        placeId: localPlaceId,
        returnTo: "home",
        tripId: primaryTrip.id,
      },
    });
  };

  const openTripActions = useCallback(
    (tripId: string) => {
      if (!isLoggedIn) {
        setStatusError("请先登录后再操作行程");
        return;
      }
      triggerHaptic("heavy");
      longPressHandledTripIdRef.current = tripId;
      setActiveTripId(tripId);
      setConfirmingDelete(false);
      setStatusError("");
    },
    [isLoggedIn],
  );

  const closeTripActions = useCallback(() => {
    longPressHandledTripIdRef.current = "";
    setActiveTripId("");
    setConfirmingDelete(false);
  }, []);

  const handleTripPress = useCallback(
    (tripId: string) => {
      if (longPressHandledTripIdRef.current === tripId) {
        longPressHandledTripIdRef.current = "";
        return;
      }

      openTripDetail(tripId);
    },
    [openTripDetail],
  );

  const editActiveTrip = () => {
    if (!activeTrip) {
      return;
    }

    const tripId = activeTrip.id;
    closeTripActions();
    router.push({
      pathname: "/trips/edit",
      params: { id: tripId },
    });
  };

  const handleToggleTripPinned = async () => {
    if (!isLoggedIn) {
      setStatusError("请先登录后再操作行程");
      return;
    }
    if (!activeTrip || updatingTripId) {
      return;
    }

    setUpdatingTripId(activeTrip.id);
    setStatusError("");

    try {
      const nextTrips = await toggleTripPinned(activeTrip.id);
      setTrips(nextTrips);
      closeTripActions();
    } catch (pinError) {
      tripListScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to update trip pin state.", pinError] },
        "Legacy warning captured",
      );
      setStatusError("更新置顶状态失败，请稍后再试");
    } finally {
      setUpdatingTripId("");
    }
  };

  const handleDeleteTrip = async () => {
    if (!isLoggedIn) {
      setStatusError("请先登录后再操作行程");
      return;
    }
    if (!activeTrip || updatingTripId) {
      return;
    }

    triggerHaptic("warning");
    setUpdatingTripId(activeTrip.id);
    setStatusError("");

    try {
      const nextTrips = await deleteTrip(activeTrip.id);
      setTrips(nextTrips);
      closeTripActions();
    } catch (deleteError) {
      tripListScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to delete trip.", deleteError] },
        "Legacy warning captured",
      );
      setStatusError("删除行程失败，请稍后再试");
    } finally {
      setUpdatingTripId("");
    }
  };

  const { scrollViewRef, saveScrollPosition, contentOffset } =
    useScrollPosition("/");

  const renderFeaturedTripModule = () => {
    if (primaryTrip) {
      return (
        <TripCard
          trip={primaryTrip}
          variant={resolveTripCardVariant(
            featuredTripCardSlot.adapterId,
            "featured",
          )}
          onLongPress={() => openTripActions(primaryTrip.id)}
          onPress={() => handleTripPress(primaryTrip.id)}
        />
      );
    }

    if (trips.length === 0) {
      return (
        <View style={[styles.card]}>
          <EmptyState
            actionLabel={isLoggedIn ? "新建行程" : "登录后创建行程"}
            description={
              isLoggedIn
                ? "新建一趟行程后，这里会显示最近的计划。"
                : "登录或进入游客模式后，即可创建和管理行程。"
            }
            icon="flight-takeoff"
            onActionPress={
              isLoggedIn ? openNewTrip : () => router.push("/profile")
            }
            title={isLoggedIn ? "还没有行程" : "登录后开始规划"}
          />
        </View>
      );
    }

    return null;
  };

  const renderTodayPlanModule = () => {
    if (!primaryTrip || !showTodaySection) {
      return null;
    }

    const todayPlanAdapterId = todayPlanSlot.adapterId;

    return (
      <View key={todayPlanAdapterId} style={styles.todayPlanSlot}>
        <Pressable
          accessibilityHint="点击打开当前行程当天的完整行程"
          accessibilityRole="button"
          hitSlop={8}
          onPress={openTodayDayDetail}
          style={({ pressed }) => [
            styles.sectionHeader,
            pressed && styles.sectionHeaderPressed,
          ]}
        >
          <Text style={styles.sectionTitle}>今日安排</Text>
          <MaterialIcons
            name="chevron-right"
            size={20}
            color={theme.colors.textSubtle}
          />
        </Pressable>

        <TodayRoutePills
          items={todayItems}
          trip={primaryTrip}
          onItemPress={handleTodayItemPress}
          weather={todayWeather}
        />
      </View>
    );
  };

  const renderAllTripsModule = () => (
    <Animated.View
      style={[
        styles.listSection,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>全部行程</Text>
      </View>

      <View style={styles.list}>
        {trips.map((trip) => (
          <TripCard
            key={trip.id}
            accessibilityHint="长按可编辑、删除或置顶"
            trip={trip}
            variant={resolveTripCardVariant(
              tripListCardSlot.adapterId,
              "ticket",
            )}
            onLongPress={() => openTripActions(trip.id)}
            onPress={() => handleTripPress(trip.id)}
          />
        ))}
      </View>
    </Animated.View>
  );

  const renderHomeModule = (moduleId: TripListHomeModuleId) => {
    switch (moduleId) {
      case "featuredTrip":
        return renderFeaturedTripModule();
      case "todayPlan":
        return renderTodayPlanModule();
      case "allTrips":
        return renderAllTripsModule();
    }
  };

  return (
    <View style={styles.safeArea}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: 176 + insets.bottom,
            paddingTop: Math.max(20, insets.top + 8),
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          saveScrollPosition(event.nativeEvent.contentOffset.y);
        }}
        scrollEventThrottle={100}
        contentOffset={contentOffset}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>行程列表</Text>
          <Pressable
            accessibilityLabel="搜索"
            accessibilityRole="button"
            onPress={openGlobalSearch}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && { backgroundColor: theme.colors.linkSoft },
            ]}
          >
            <MaterialIcons
              name="search"
              size={18}
              color={theme.colors.primary}
            />
            <Text style={styles.headerButtonText}>搜索</Text>
          </Pressable>
        </View>

        {statusError ? (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{statusError}</Text>
          </View>
        ) : null}

        {statusMessage ? (
          <View style={styles.inlineSuccess}>
            <Text style={styles.inlineSuccessText}>{statusMessage}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <TripListSkeleton />
        ) : error ? (
          <View style={[styles.card]}>
            <Text style={styles.cardTitle}>加载失败</Text>
            <Text style={styles.mutedText}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={loadTrips}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>重新加载</Text>
            </Pressable>
          </View>
        ) : (
          homeLayout.moduleOrder.map((moduleId) => {
            const module = renderHomeModule(moduleId);

            return module ? (
              <View key={moduleId} style={styles.homeModule}>
                {module}
              </View>
            ) : null;
          })
        )}
      </ScrollView>

      <TripActionSheet
        bottomInset={insets.bottom}
        isProcessing={Boolean(activeTrip && updatingTripId === activeTrip.id)}
        onAskDelete={() => setConfirmingDelete(true)}
        onClose={closeTripActions}
        onEdit={editActiveTrip}
        onTogglePin={handleToggleTripPinned}
        trip={isConfirmingDelete ? undefined : activeTrip}
      />

      <ConfirmDialog
        isProcessing={Boolean(activeTrip && updatingTripId === activeTrip.id)}
        message={`确认删除「${activeTrip?.title ?? "这趟行程"}」吗？已有每日安排、地点和相关记录都会一起移除。`}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDeleteTrip}
        title="删除行程"
        visible={Boolean(activeTrip) && isConfirmingDelete}
      />
    </View>
  );
}

function resolveTripCardVariant(
  adapterId: string,
  fallback: "compact" | "featured" | "ticket",
) {
  switch (adapterId) {
    case skinSlotAdapterIds.homeFeaturedTripCard.default:
    case skinSlotAdapterIds.homeTripListCard.default:
    case skinSlotAdapterIds.homeFeaturedTripCard.classic:
    case skinSlotAdapterIds.homeTripListCard.classic:
      return "compact";
    default:
      return fallback;
  }
}

type TripActionSheetProps = {
  bottomInset: number;
  isProcessing: boolean;
  onAskDelete: () => void;
  onClose: () => void;
  onEdit: () => void;
  onTogglePin: () => void;
  trip?: Trip;
};

function TripActionSheet({
  bottomInset,
  isProcessing,
  onAskDelete,
  onClose,
  onEdit,
  onTogglePin,
  trip,
}: TripActionSheetProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [renderedTrip, setRenderedTrip] = useState(trip);
  const isVisible = Boolean(trip);
  const sheetTrip = trip ?? renderedTrip;
  const pinActionTitle = sheetTrip?.pinnedAt ? "取消置顶" : "置顶行程";
  const pinActionDetail = sheetTrip?.pinnedAt
    ? "恢复到普通列表顺序"
    : "固定在全部行程顶部";

  useEffect(() => {
    if (trip) {
      setRenderedTrip(trip);
      return;
    }

    const timeoutId = setTimeout(() => setRenderedTrip(undefined), 200);

    return () => clearTimeout(timeoutId);
  }, [trip]);

  return (
    <ModalTransition
      backdropAccessibilityLabel="关闭行程操作"
      contentStyle={[
        styles.sheet,
        { paddingBottom: Math.max(bottomInset, 16) },
      ]}
      dismissOnBackdropPress={!isProcessing}
      isDismissDisabled={isProcessing}
      onRequestClose={onClose}
      overlayColor={theme.colors.overlay}
      preset="sheet"
      rootStyle={styles.modalRoot}
      visible={isVisible}
    >
      {sheetTrip ? (
        <>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderCopy}>
              <Text style={styles.sheetTitle}>{sheetTrip.title}</Text>
              <Text style={styles.sheetSubtitle}>
                选择要对这趟行程执行的操作
              </Text>
            </View>
            <Pressable
              accessibilityLabel="关闭"
              accessibilityRole="button"
              disabled={isProcessing}
              hitSlop={12}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && { backgroundColor: theme.colors.surfaceSubtle },
              ]}
            >
              <MaterialIcons
                name="close"
                size={22}
                color={theme.colors.textSubtle}
              />
            </Pressable>
          </View>

          <View style={styles.sheetActionStack}>
            <Pressable
              accessibilityRole="button"
              disabled={isProcessing}
              onPress={onEdit}
              style={({ pressed }) => [
                styles.sheetActionButton,
                pressed && styles.sheetActionButtonPressed,
              ]}
            >
              <View style={styles.sheetActionIcon}>
                <MaterialIcons
                  name="edit"
                  size={22}
                  color={theme.colors.link}
                />
              </View>
              <View style={styles.sheetActionCopy}>
                <Text style={styles.sheetActionTitle}>编辑行程</Text>
                <Text style={styles.sheetActionDetail}>
                  修改名称、日期和每日安排
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={22}
                color={theme.colors.textSubtle}
              />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={isProcessing}
              onPress={onTogglePin}
              style={({ pressed }) => [
                styles.sheetActionButton,
                isProcessing && styles.actionButtonDisabled,
                pressed && styles.sheetActionButtonPressed,
              ]}
            >
              <View style={styles.sheetActionIcon}>
                <MaterialIcons
                  name="push-pin"
                  size={22}
                  color={theme.colors.link}
                />
              </View>
              <View style={styles.sheetActionCopy}>
                <Text style={styles.sheetActionTitle}>{pinActionTitle}</Text>
                <Text style={styles.sheetActionDetail}>{pinActionDetail}</Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={22}
                color={theme.colors.textSubtle}
              />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={isProcessing}
              onPress={onAskDelete}
              style={({ pressed }) => [
                styles.sheetActionButton,
                pressed && styles.sheetActionButtonPressed,
              ]}
            >
              <View
                style={[styles.sheetActionIcon, styles.sheetActionIconDanger]}
              >
                <MaterialIcons
                  name="delete-outline"
                  size={22}
                  color={theme.colors.danger}
                />
              </View>
              <View style={styles.sheetActionCopy}>
                <Text style={styles.destructiveActionTitle}>删除行程</Text>
                <Text style={styles.sheetActionDetail}>
                  移除这趟行程和已保存内容
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={22}
                color={theme.colors.dangerBorder}
              />
            </Pressable>
          </View>
        </>
      ) : null}
    </ModalTransition>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: 20,
      paddingBottom: 176,
      gap: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 8,
    },
    title: {
      color: theme.colors.text,
      fontSize: 30,
      fontWeight: "700",
    },
    headerButton: {
      minHeight: 38,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    headerButtonText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: "600",
    },
    homeModule: {
      gap: 12,
    },
    todayPlanSlot: {
      gap: 12,
    },
    inlineError: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.dangerSoft,
      borderWidth: 1,
      borderColor: theme.colors.dangerBorder,
    },
    inlineErrorText: {
      color: theme.colors.danger,
      fontSize: 13,
      fontWeight: "600",
    },
    inlineSuccess: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.successSoft,
      borderWidth: 1,
      borderColor: theme.colors.successBorder,
    },
    inlineSuccessText: {
      color: theme.colors.success,
      fontSize: 13,
      fontWeight: "600",
    },
    card: {
      gap: 10,
      padding: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 0,
      borderColor: "transparent",
    },
    cardPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    primaryTripCard: {
      gap: 14,
    },
    loadingCard: {
      minHeight: 112,
      alignItems: "center",
      justifyContent: "center",
    },
    rowBetween: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    tripOverviewHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    tripOverviewTitleCopy: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    tripOverviewKicker: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    badgeRow: {
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    label: {
      flex: 1,
      minWidth: 0,
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    badge: {
      overflow: "hidden",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      fontSize: 12,
      fontWeight: "600",
    },
    statusBadge: {
      minWidth: 64,
      minHeight: 34,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: "600",
    },
    pinBadge: {
      minHeight: 28,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: theme.colors.linkSoft,
    },
    pinBadgeText: {
      color: theme.colors.link,
      fontSize: 12,
      fontWeight: "700",
    },
    cardTitle: {
      color: theme.colors.text,
      fontSize: 22,
      fontWeight: "700",
    },
    tripOverviewInfoBlock: {
      gap: 8,
      padding: 12,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceMuted,
    },
    tripOverviewInfoRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    tripOverviewInfoText: {
      flex: 1,
      minWidth: 0,
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 20,
    },
    tripOverviewStatsGrid: {
      flexDirection: "row",
      gap: 8,
    },
    tripOverviewStatCard: {
      flex: 1,
      minHeight: 58,
      justifyContent: "center",
      gap: 3,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.linkSoft,
    },
    tripOverviewStatValue: {
      color: theme.colors.link,
      fontSize: 19,
      fontWeight: "700",
    },
    tripOverviewStatLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    tripOverviewUpdatedText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    mutedText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    tripMetaStack: {
      gap: 2,
    },
    primaryButton: {
      alignSelf: "flex-start",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.primary,
    },
    primaryButtonText: {
      color: theme.colors.surface,
      fontSize: 14,
      fontWeight: "600",
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    sectionHeaderPressed: {
      opacity: 0.7,
    },
    sectionTitle: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    linkText: {
      flexShrink: 0,
      color: theme.colors.link,
      fontSize: 14,
      fontWeight: "600",
    },
    linkButton: {
      flexShrink: 0,
      minHeight: 34,
      justifyContent: "center",
      paddingHorizontal: 4,
      borderRadius: 8,
    },
    linkButtonPressed: {
      backgroundColor: theme.colors.linkSoft,
    },
    listSection: {
      gap: 12,
    },
    list: {
      gap: 12,
    },
    modalRoot: {
      flex: 1,
      justifyContent: "flex-end",
    },
    sheet: {
      alignSelf: "center",
      width: "100%",
      maxWidth: 560,
      paddingHorizontal: 20,
      paddingTop: 12,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      backgroundColor: theme.colors.surface,
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.12,
      shadowRadius: 22,
      elevation: 16,
    },
    sheetHandle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.borderStrong,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      paddingBottom: 14,
      paddingTop: 16,
    },
    sheetHeaderCopy: {
      flex: 1,
      gap: 4,
    },
    sheetTitle: {
      color: theme.colors.text,
      fontSize: 19,
      fontWeight: "700",
    },
    sheetSubtitle: {
      color: theme.colors.textSubtle,
      fontSize: 13,
      lineHeight: 18,
    },
    closeButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 34,
      height: 34,
      borderRadius: 17,
    },
    iconButtonPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    sheetActionStack: {
      gap: 8,
    },
    sheetActionButton: {
      minHeight: 70,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 8,
      borderWidth: 0,
      borderColor: "transparent",
      backgroundColor: theme.colors.surface,
    },
    sheetActionButtonPressed: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    actionButtonDisabled: {
      opacity: 0.65,
    },
    sheetActionIcon: {
      alignItems: "center",
      justifyContent: "center",
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.colors.linkSoft,
    },
    sheetActionIconDanger: {
      backgroundColor: theme.colors.dangerSoft,
    },
    sheetActionCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    sheetActionTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    destructiveActionTitle: {
      color: theme.colors.danger,
      fontSize: 16,
      fontWeight: "700",
    },
    sheetActionDetail: {
      color: theme.colors.textSubtle,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}
