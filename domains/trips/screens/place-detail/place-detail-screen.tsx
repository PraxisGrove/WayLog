import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  formatExpenseInputValue,
  formatTripDateRange,
  getFavoritePlaces,
  getPlaceInfoLinks,
  getPlaceScheduleEntries,
  getTripExpenseEntriesForPlace,
} from "@/features/trips";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { BackButton } from "@/shared/ui/back-button";
import { triggerHaptic } from "@/shared/ui/haptic-feedback";
import { PlaceDetailActionBar } from "./components/place-detail-action-bar";
import { PlaceDetailContent } from "./components/place-detail-content";
import { usePlaceDetailActions } from "./hooks/use-place-detail-actions";
import { usePlaceDetailData } from "./hooks/use-place-detail-data";
import { usePlaceDetailEnrichment } from "./hooks/use-place-detail-enrichment";
import {
  getExpenseEntrySortValue,
  getPlaceCoverPhoto,
  getPlaceIntro,
  getPlaceRecordTags,
  getScheduleEntryKey,
  isSeedTripId,
} from "./place-detail-utils";
import {
  createPlaceDetailStyles,
  getPlaceDashboardCardSize,
  getPlaceWeatherContentScale,
  PLACE_BOTTOM_ACTION_BAR_MAX_WIDTH,
  PLACE_BOTTOM_ACTION_BAR_WIDTH_RATIO,
  PLACE_DASHBOARD_BASE_CARD_SIZE,
} from "./trip-place-detail.styles";

export type PlaceDetailScreenProps = {
  dayId?: string;
  favoritePlaceId?: string;
  itemId?: string;
  localPlaceId?: string;
  placeId?: string;
  returnTo?: string;
  tripId?: string;
};

export function PlaceDetailScreen({
  dayId: returnDayId,
  favoritePlaceId,
  itemId: returnItemId,
  localPlaceId: localPlaceIdParam,
  placeId,
  returnTo,
  tripId,
}: PlaceDetailScreenProps) {
  const theme = useAppTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const dashboardCardSize = getPlaceDashboardCardSize(viewportWidth);
  const dashboardScale = dashboardCardSize / PLACE_DASHBOARD_BASE_CARD_SIZE;
  const weatherContentScale = getPlaceWeatherContentScale(dashboardCardSize);
  const bottomActionBarWidth = Math.min(
    viewportWidth * PLACE_BOTTOM_ACTION_BAR_WIDTH_RATIO,
    PLACE_BOTTOM_ACTION_BAR_MAX_WIDTH,
  );
  const moreMenuRight = Math.max(
    (viewportWidth - bottomActionBarWidth) / 2,
    12,
  );
  const styles = useMemo(
    () => createPlaceDetailStyles(theme, dashboardCardSize),
    [dashboardCardSize, theme],
  );
  const router = useRouter();
  const localPlaceId = localPlaceIdParam ?? placeId;

  const { error, isLoading, place, setFavoritePlace, setTrip, trip } =
    usePlaceDetailData({
      favoritePlaceId,
      localPlaceId,
      tripId,
    });
  const [linkError, setLinkError] = useState("");
  const [costDrafts, setCostDrafts] = useState<Record<string, string>>({});
  const [costDraftErrors, setCostDraftErrors] = useState<
    Record<string, string>
  >({});
  const [areExpenseRecordsExpanded, setAreExpenseRecordsExpanded] =
    useState(false);
  const [isReviewExpanded, setIsReviewExpanded] = useState(false);
  const [isPlaceNoteExpanded, setIsPlaceNoteExpanded] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [isCurrentPlaceFavorited, setIsCurrentPlaceFavorited] = useState(false);
  const [isMoreMenuMounted, setIsMoreMenuMounted] = useState(false);
  const moreMenuProgress = useRef(new Animated.Value(0)).current;
  const [isIntroCollapsed, setIsIntroCollapsed] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null,
  );

  const shouldUseStaticSeedIntro = Boolean(trip && isSeedTripId(trip.id));
  const isFavoritePlaceDetail = Boolean(!trip && favoritePlaceId && place);
  const canRefreshAmapDetails = Boolean(
    place?.externalRefs?.amapPoiId && (trip || isFavoritePlaceDetail),
  );
  const scheduleEntries = useMemo(
    () => (trip && place ? getPlaceScheduleEntries(trip, place) : []),
    [place, trip],
  );
  const expenseRecordEntries = useMemo(
    () =>
      trip && place
        ? getTripExpenseEntriesForPlace(trip, place).sort(
            (left, right) =>
              getExpenseEntrySortValue(right) - getExpenseEntrySortValue(left),
          )
        : [],
    [place, trip],
  );
  const placeExpenseTotal = useMemo(
    () =>
      expenseRecordEntries.reduce((total, entry) => total + entry.amount, 0),
    [expenseRecordEntries],
  );
  const placeInfoLinks = useMemo(
    () => (place ? getPlaceInfoLinks(place) : []),
    [place],
  );
  const externalInfoLinks = useMemo(
    () => placeInfoLinks.filter((link) => link.id !== "map"),
    [placeInfoLinks],
  );
  const recordTags = useMemo(
    () =>
      place
        ? getPlaceRecordTags(
            place,
            scheduleEntries.length,
            isFavoritePlaceDetail,
          )
        : [],
    [isFavoritePlaceDetail, place, scheduleEntries.length],
  );
  const coverPhoto = useMemo(
    () => (place ? getPlaceCoverPhoto(place) : undefined),
    [place],
  );
  const placeIntro = useMemo(
    () => (place ? getPlaceIntro(place, trip) : ""),
    [place, trip],
  );
  const activeScheduleEntry = useMemo(() => {
    if (scheduleEntries.length === 0) {
      return undefined;
    }

    if (returnItemId) {
      const itemEntry = scheduleEntries.find(
        ({ item }) => item.id === returnItemId,
      );

      if (itemEntry) {
        return itemEntry;
      }
    }

    if (!returnDayId) {
      return scheduleEntries[0];
    }

    return (
      scheduleEntries.find(({ day }) => day.id === returnDayId) ??
      scheduleEntries[0]
    );
  }, [returnDayId, returnItemId, scheduleEntries]);
  const placeNotePreview = activeScheduleEntry?.item.note ?? place?.note ?? "";
  const fallbackReturnDayId = scheduleEntries[0]?.day.id;
  const _scheduleNoteSnapshot = useMemo(
    () =>
      scheduleEntries
        .map(
          ({ day, item }) =>
            `${getScheduleEntryKey(day.id, item.id)}=${item.note ?? ""}`,
        )
        .join("|"),
    [scheduleEntries],
  );
  const _scheduleCostSnapshot = useMemo(
    () =>
      scheduleEntries
        .map(
          ({ day, item }) =>
            `${getScheduleEntryKey(day.id, item.id)}=${formatExpenseInputValue(item.cost)}`,
        )
        .join("|"),
    [scheduleEntries],
  );
  const {
    externalImages,
    isLlmLoading,
    isLoadingImages,
    isPostTransitionReady,
    isWeatherLoading,
    llmSummary,
    placeWeatherForecast,
  } = usePlaceDetailEnrichment({
    activeScheduleEntry,
    isSeedIntro: shouldUseStaticSeedIntro,
    place,
    setFavoritePlace,
    setTrip,
    trip,
  });

  useEffect(() => {
    if (!place) {
      setIsCurrentPlaceFavorited(false);
      return;
    }

    if (isFavoritePlaceDetail) {
      setIsCurrentPlaceFavorited(true);
      return;
    }

    if (!isPostTransitionReady) {
      return;
    }

    let isActive = true;

    const checkFavorite = async () => {
      try {
        const favorites = await getFavoritePlaces();
        const providerId = place.providerPlaceId ?? place.id;

        if (isActive) {
          setIsCurrentPlaceFavorited(
            favorites.some((f) => f.providerPlaceId === providerId),
          );
        }
      } catch {
        if (isActive) {
          setIsCurrentPlaceFavorited(false);
        }
      }
    };

    void checkFavorite();

    return () => {
      isActive = false;
    };
  }, [isFavoritePlaceDetail, isPostTransitionReady, place]);

  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    const nextCostDrafts: Record<string, string> = {};

    scheduleEntries.forEach(({ day, item }) => {
      const entryKey = getScheduleEntryKey(day.id, item.id);
      nextDrafts[entryKey] = item.note ?? "";
      nextCostDrafts[entryKey] = formatExpenseInputValue(item.cost);
    });

    setNoteDrafts(nextDrafts);
    setCostDrafts(nextCostDrafts);
    setCostDraftErrors({});
  }, [scheduleEntries]);

  const goBackToPrevious = () => {
    const routerWithHistory = router as typeof router & {
      canGoBack?: () => boolean;
    };

    if (routerWithHistory.canGoBack?.()) {
      router.back();
      return;
    }

    if (returnTo === "home") {
      router.replace("/");
      return;
    }

    if (returnTo === "favorite-places") {
      router.replace("/trips/favorite-places");
      return;
    }

    if (returnTo === "search") {
      router.replace("/search");
      return;
    }

    if (tripId) {
      router.replace({
        pathname: "/trips/[id]",
        params: {
          id: tripId,
          ...(returnDayId || fallbackReturnDayId
            ? { dayId: returnDayId ?? fallbackReturnDayId }
            : {}),
        },
      });
      return;
    }

    router.replace("/");
  };

  const {
    actionError,
    handleFavoriteToggle,
    handleInfoLinkOpenError,
    isRefreshingAmap,
    openBottomNavigation,
    openPlaceMapPreview,
    openPlaceNoteEditor,
    refreshAmapDetails,
    saveEditedScheduleCost,
    saveEditedScheduleNote,
    savingCostKey,
    savingNoteKey,
  } = usePlaceDetailActions({
    activeScheduleEntry,
    canRefreshAmapDetails,
    favoritePlaceId,
    isCurrentPlaceFavorited,
    isFavoritePlaceDetail,
    onFavoritePlaceRemoved: goBackToPrevious,
    place,
    setCostDraftErrors,
    setCostDrafts,
    setFavoritePlace,
    setIsCurrentPlaceFavorited,
    setIsPlaceNoteExpanded,
    setLinkError,
    setNoteDrafts,
    setTrip,
    trip,
  });

  const closeMoreMenu = useCallback(() => {
    Animated.timing(moreMenuProgress, {
      duration: 140,
      easing: Easing.in(Easing.quad),
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsMoreMenuMounted(false);
      }
    });
  }, [moreMenuProgress]);

  const openMoreMenu = useCallback(() => {
    setIsMoreMenuMounted(true);
    moreMenuProgress.setValue(0);
    triggerHaptic("light");
    Animated.spring(moreMenuProgress, {
      damping: 18,
      mass: 0.8,
      stiffness: 240,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [moreMenuProgress]);

  const toggleMoreMenu = () => {
    if (isMoreMenuMounted) {
      closeMoreMenu();
      return;
    }

    openMoreMenu();
  };

  const refreshAmapDetailsFromMoreMenu = () => {
    closeMoreMenu();
    void refreshAmapDetails();
  };

  const openPlaceNoteFromMoreMenu = () => {
    closeMoreMenu();
    openPlaceNoteEditor();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <BackButton
            accessibilityLabel="返回行程详情"
            onPress={goBackToPrevious}
          />
          <Text numberOfLines={1} style={styles.subtitle}>
            {trip ? `${trip.title} · ${formatTripDateRange(trip)}` : "收藏地点"}
          </Text>
        </View>

        {isLoading ? (
          <View style={[styles.card, styles.loadingCard]}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.mutedText}>正在读取地点信息</Text>
          </View>
        ) : error || !place ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>加载失败</Text>
            <Text style={styles.mutedText}>{error || "没有找到这个地点"}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={goBackToPrevious}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>
                {returnTo === "favorite-places" ? "返回收藏" : "返回行程"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <PlaceDetailContent
            activeScheduleEntry={activeScheduleEntry}
            actionError={actionError}
            areExpenseRecordsExpanded={areExpenseRecordsExpanded}
            coverPhoto={coverPhoto}
            costDraftErrors={costDraftErrors}
            costDrafts={costDrafts}
            dashboardScale={dashboardScale}
            expenseRecordEntries={expenseRecordEntries}
            externalImages={externalImages}
            externalInfoLinks={externalInfoLinks}
            isFavoritePlaceDetail={isFavoritePlaceDetail}
            isIntroCollapsed={isIntroCollapsed}
            isLlmLoading={isLlmLoading}
            isLoadingImages={isLoadingImages}
            isPlaceNoteExpanded={isPlaceNoteExpanded}
            isPostTransitionReady={isPostTransitionReady}
            isReviewExpanded={isReviewExpanded}
            isWeatherLoading={isWeatherLoading}
            linkError={linkError}
            llmSummary={llmSummary}
            noteDrafts={noteDrafts}
            onCostCancel={(costKey, savedCostDraft) => {
              setCostDrafts((currentDrafts) => ({
                ...currentDrafts,
                [costKey]: savedCostDraft,
              }));
              setCostDraftErrors((currentErrors) => ({
                ...currentErrors,
                [costKey]: "",
              }));
            }}
            onCostChange={(costKey, value) => {
              setCostDrafts((currentDrafts) => ({
                ...currentDrafts,
                [costKey]: value,
              }));
              setCostDraftErrors((currentErrors) => ({
                ...currentErrors,
                [costKey]: "",
              }));
            }}
            onExpenseRecordsExpandedChange={setAreExpenseRecordsExpanded}
            onImageViewerClose={() => setSelectedImageIndex(null)}
            onInfoLinkOpenError={handleInfoLinkOpenError}
            onInfoLinkPress={() => {
              setLinkError("");
            }}
            onIntroCollapsedChange={setIsIntroCollapsed}
            onMapPreviewPress={openPlaceMapPreview}
            onNoteChange={(noteKey, value) =>
              setNoteDrafts((currentDrafts) => ({
                ...currentDrafts,
                [noteKey]: value,
              }))
            }
            onOpenPlaceNoteEditor={openPlaceNoteEditor}
            onReviewExpandedChange={setIsReviewExpanded}
            onSaveCost={saveEditedScheduleCost}
            onSaveNote={(dayId, itemId, note) => {
              void saveEditedScheduleNote(dayId, itemId, note);
            }}
            onSelectImage={setSelectedImageIndex}
            place={place}
            placeExpenseTotal={placeExpenseTotal}
            placeIntro={placeIntro}
            placeNotePreview={placeNotePreview}
            placeWeatherForecast={placeWeatherForecast}
            recordTags={recordTags}
            savingCostKey={savingCostKey}
            savingNoteKey={savingNoteKey}
            selectedImageIndex={selectedImageIndex}
            statusLabel={
              isFavoritePlaceDetail
                ? "已收藏"
                : place.isScheduled
                  ? "已放入行程"
                  : "待安排"
            }
            styles={styles}
            weatherContentScale={weatherContentScale}
          />
        )}
      </ScrollView>
      {!isLoading && !error && place ? (
        <PlaceDetailActionBar
          canRefreshAmapDetails={canRefreshAmapDetails}
          isCurrentPlaceFavorited={isCurrentPlaceFavorited}
          isFavoritePlaceDetail={isFavoritePlaceDetail}
          isMoreMenuMounted={isMoreMenuMounted}
          isRefreshingAmap={isRefreshingAmap}
          moreMenuProgress={moreMenuProgress}
          moreMenuRight={moreMenuRight}
          onCloseMoreMenu={closeMoreMenu}
          onFavoriteToggle={handleFavoriteToggle}
          onOpenExpenses={() => setAreExpenseRecordsExpanded(true)}
          onOpenNavigation={openBottomNavigation}
          onOpenPlaceNoteFromMenu={openPlaceNoteFromMoreMenu}
          onRefreshAmapFromMenu={refreshAmapDetailsFromMoreMenu}
          onToggleMoreMenu={toggleMoreMenu}
          placeNotePreview={placeNotePreview}
          styles={styles}
        />
      ) : null}
    </SafeAreaView>
  );
}
