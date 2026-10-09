import type MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { createDiagnosticLogger } from "@/features/diagnostics";
import {
  createPreviewTripPlaceFromSuggestion,
  createScheduledTripPlaceFromSuggestion,
  createTripDayItemFromPlaceSuggestion,
  createTripPlaceFromFavoritePlace,
  type FavoritePlaceRecord,
  formatPlaceSearchDistance,
  getCurrentDeviceCoordinates,
  getFavoritePlaces,
  getTripById,
  isFavoritePlaceSuggestion,
  type PlaceSearchCenter,
  type PlaceSuggestion,
  removeFavoritePlace,
  setPendingPlaceDetail,
  type Trip,
  updateTrip,
  upsertFavoritePlace,
} from "@/features/trips";
import {
  type PlaceSearchChromeRenderer,
  PlaceSearchContent,
} from "@/shared/places/place-search-sheet";
import { TripDayPickerSheet } from "@/shared/places/trip-day-picker-sheet";
import { useAppTheme } from "@/shared/theme/use-app-theme";

const favoritePlaceSearchPanelLogger = createDiagnosticLogger(
  "favorite-place-search-panel",
);
type FavoritePlaceSearchPanelProps = {
  backLabel?: string;
  closeIcon?: keyof typeof MaterialIcons.glyphMap;
  headerExtra?: ReactNode;
  onClose: () => void;
  renderSearchChrome?: PlaceSearchChromeRenderer;
  searchPrefix?: ReactNode;
  showHeader?: boolean;
  subtitle?: string;
  title?: string;
};

function formatFavoriteSuggestionMeta(suggestion: PlaceSuggestion): string {
  return [
    formatPlaceSearchDistance(suggestion.distanceKm),
    suggestion.category,
    suggestion.area,
    suggestion.address,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function FavoritePlaceSearchPanel({
  backLabel = "返回",
  closeIcon = "close",
  headerExtra,
  onClose,
  renderSearchChrome,
  searchPrefix,
  showHeader,
  subtitle = "景点 / 餐厅 / 酒店 / 交通",
  title = "收藏地点",
}: FavoritePlaceSearchPanelProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const [favoritePlaces, setFavoritePlaces] = useState<FavoritePlaceRecord[]>(
    [],
  );
  const [isSaving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"error" | "success">("success");
  const [deviceSearchCenter, setDeviceSearchCenter] = useState<
    PlaceSearchCenter | undefined
  >();
  const [showTripPicker, setShowTripPicker] = useState(false);
  const [addToTripSuggestion, setAddToTripSuggestion] = useState<
    PlaceSuggestion | undefined
  >();
  const [addedPlaceIds, setAddedPlaceIds] = useState<Set<string>>(new Set());

  const loadFavoritePlaces = useCallback(async () => {
    try {
      const localFavoritePlaces = await getFavoritePlaces();
      setFavoritePlaces(localFavoritePlaces);
    } catch (loadError) {
      favoritePlaceSearchPanelLogger.warn(
        "legacy.warn",
        { args: ["Failed to load favorite places.", loadError] },
        "Legacy warning captured",
      );
      setNotice("读取已收藏地点失败，请稍后再试");
      setNoticeTone("error");
    }
  }, []);

  useEffect(() => {
    void loadFavoritePlaces();
  }, [loadFavoritePlaces]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = setTimeout(() => {
      setNotice("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let isActive = true;

    void getCurrentDeviceCoordinates()
      .then((coordinates) => {
        if (isActive) {
          setDeviceSearchCenter({
            ...coordinates,
            label: "当前位置",
          });
        }
      })
      .catch(() => {
        if (isActive) {
          setDeviceSearchCenter(undefined);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const isSuggestionFavorited = (suggestion: PlaceSuggestion) =>
    isFavoritePlaceSuggestion(favoritePlaces, suggestion);

  const favoritePlace = async (suggestion: PlaceSuggestion) => {
    if (isSaving) {
      return;
    }

    const isCurrentlyFavorited = isSuggestionFavorited(suggestion);

    setSaving(true);
    setNotice(isCurrentlyFavorited ? "正在取消收藏..." : "正在收藏...");
    setNoticeTone("success");

    try {
      if (isCurrentlyFavorited) {
        const nextPlaces = await removeFavoritePlace(suggestion);
        setFavoritePlaces(nextPlaces);
        setNotice(`已取消收藏「${suggestion.name}」`);
      } else {
        const favoriteResult = await upsertFavoritePlace(suggestion);
        setFavoritePlaces(favoriteResult.places);
        setNotice(
          favoriteResult.added
            ? `已收藏「${favoriteResult.place.name}」`
            : `「${favoriteResult.place.name}」已收藏`,
        );
      }
      setNoticeTone("success");
    } catch (saveError) {
      favoritePlaceSearchPanelLogger.warn(
        "legacy.warn",
        { args: ["Failed to toggle favorite place.", saveError] },
        "Legacy warning captured",
      );
      setNotice(
        isCurrentlyFavorited
          ? "取消收藏失败，请稍后再试"
          : "收藏地点失败，请稍后再试",
      );
      setNoticeTone("error");
    } finally {
      setSaving(false);
    }
  };

  const navigateToPlaceDetail = async (suggestion: PlaceSuggestion) => {
    if (isSaving) {
      return;
    }

    const existingIndex = favoritePlaces.findIndex(
      (place) =>
        place.providerPlaceId === (suggestion.providerPlaceId ?? suggestion.id),
    );

    if (existingIndex >= 0) {
      setPendingPlaceDetail(
        createTripPlaceFromFavoritePlace(favoritePlaces[existingIndex]),
      );
      router.push({
        pathname: "/trips/place",
        params: {
          favoritePlaceId: favoritePlaces[existingIndex].id,
          returnTo: "search",
        },
      });
      return;
    }

    setPendingPlaceDetail(createPreviewTripPlaceFromSuggestion(suggestion));
    router.push({
      pathname: "/trips/place",
      params: { returnTo: "search" },
    });
  };

  const handleAddToTripPress = (suggestion: PlaceSuggestion) => {
    setAddToTripSuggestion(suggestion);
    setShowTripPicker(true);
  };

  const handleConfirmAddToTrip = async (tripId: string, dayId: string) => {
    const suggestion = addToTripSuggestion;
    if (!suggestion) {
      return;
    }

    const placeIdKey = suggestion.providerPlaceId ?? suggestion.id;

    setSaving(true);
    setNotice(`正在添加「${suggestion.name}」到行程...`);
    setNoticeTone("success");

    try {
      const targetTrip = await getTripById(tripId);
      if (!targetTrip) {
        throw new Error("目标行程不存在");
      }

      const nextPlace = createScheduledTripPlaceFromSuggestion(suggestion);
      const nextItem = createTripDayItemFromPlaceSuggestion(
        suggestion,
        nextPlace.id,
      );
      const nextTrip: Trip = {
        ...targetTrip,
        days: targetTrip.days.map((day) =>
          day.id === dayId ? { ...day, items: [...day.items, nextItem] } : day,
        ),
        places: [...targetTrip.places, nextPlace],
        updatedAt: new Date().toISOString(),
      };

      await updateTrip(nextTrip, {
        expectedUpdatedAt: targetTrip.updatedAt,
      });

      setAddedPlaceIds((prev) => {
        const next = new Set(prev);
        next.add(placeIdKey);
        return next;
      });

      const targetDay = targetTrip.days.find((d) => d.id === dayId);
      const dayLabel = targetDay ? `第${targetDay.dayIndex}天` : "行程";
      setNotice(`已添加到「${targetTrip.title}」${dayLabel}`);
      setNoticeTone("success");
    } catch (error) {
      favoritePlaceSearchPanelLogger.warn(
        "legacy.warn",
        { args: ["Failed to add place to trip.", error] },
        "Legacy warning captured",
      );
      setNotice("添加到行程失败，请稍后再试");
      setNoticeTone("error");
    } finally {
      setSaving(false);
    }
  };

  const isPlaceAddedToTrip = (suggestion: PlaceSuggestion) => {
    return addedPlaceIds.has(suggestion.providerPlaceId ?? suggestion.id);
  };

  return (
    <>
      <PlaceSearchContent
        actionColor={theme.colors.primary}
        actionDisabledColor={theme.colors.textSubtle}
        actionMutedColor={theme.colors.textMuted}
        actionSelectedColor={theme.colors.danger}
        backLabel={backLabel}
        closeIcon={closeIcon}
        customActionVerb="收藏"
        emptyText="换个关键词，或把当前输入保存为自定义收藏。"
        emptyTitle="没有找到这个地点"
        formatSuggestionMeta={formatFavoriteSuggestionMeta}
        getResultActionLabel={(suggestion) =>
          isSuggestionFavorited(suggestion) ? "已收藏" : "收藏"
        }
        headerExtra={headerExtra}
        isSecondActionDisabled={isPlaceAddedToTrip}
        isSelecting={isSaving}
        isSuggestionSelected={isSuggestionFavorited}
        nearbyCenter={deviceSearchCenter}
        notice={notice}
        noticeTone={noticeTone}
        onClose={onClose}
        onResultAction={favoritePlace}
        onSecondAction={handleAddToTripPress}
        onSelect={navigateToPlaceDetail}
        resetOnSelect={false}
        resultActionIcon="favorite"
        renderSearchChrome={renderSearchChrome}
        searchContext="favorite"
        searchPrefix={searchPrefix}
        searchPlaceholder="搜索景点、餐厅、酒店"
        secondActionDisabledLabel="已添加"
        secondActionIcon="event"
        secondActionLabel="添加"
        showHeader={showHeader}
        showProviderNote={false}
        subtitle={subtitle}
        title={title}
        useNearbySuggestionsOnEmptyQuery
        variant="page"
      />
      <TripDayPickerSheet
        onClose={() => {
          setShowTripPicker(false);
          setAddToTripSuggestion(undefined);
        }}
        onSelect={handleConfirmAddToTrip}
        placeName={addToTripSuggestion?.name}
        visible={showTripPicker}
      />
    </>
  );
}
