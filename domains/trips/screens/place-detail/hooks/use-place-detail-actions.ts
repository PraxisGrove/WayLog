import type { Dispatch, SetStateAction } from "react";
import { useCallback, useState } from "react";
import { Platform } from "react-native";
import {
  buildNativeMapNavigationUrls,
  buildNativeMapPlaceUrls,
  createTripPlaceFromFavoritePlace,
  formatExpenseInputValue,
  getFavoritePlaces,
  inferPlaceKind,
  type PlaceSuggestion,
  parseExpenseAmountInput,
  queryAmapPlaceDetail,
  removeFavoritePlaceById,
  setTripDayItemCost as setTripDayItemCostCommand,
  setTripDayItemNote as setTripDayItemNoteCommand,
  type Trip,
  type TripPlace,
  updateFavoritePlaceById,
  updateTrip,
  upsertFavoritePlace,
} from "@/features/trips";
import {
  fetchFreshPoiFromCloudCache,
  syncPoiToCloud,
} from "@/features/trips/poi-cache";
import { triggerHaptic } from "@/shared/ui/haptic-feedback";
import {
  createPlaceFromAmapDetail,
  getScheduleEntryKey,
  mergePublicPoiFields,
  openFirstMapUrl,
  openPreparedWebWindow,
  PLACE_NAVIGATION_MODE,
} from "../place-detail-utils";
import { createDiagnosticLogger } from "@/features/diagnostics";
const placeDetailActionsLogger = createDiagnosticLogger("place-detail-actions");
type PlaceScheduleEntry = {
  day: Trip["days"][number];
  item: Trip["days"][number]["items"][number];
};

type UsePlaceDetailActionsParams = {
  activeScheduleEntry?: PlaceScheduleEntry;
  canRefreshAmapDetails: boolean;
  favoritePlaceId?: string;
  isCurrentPlaceFavorited: boolean;
  isFavoritePlaceDetail: boolean;
  onFavoritePlaceRemoved: () => void;
  place?: TripPlace;
  setCostDraftErrors: Dispatch<SetStateAction<Record<string, string>>>;
  setCostDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setFavoritePlace: Dispatch<SetStateAction<TripPlace | undefined>>;
  setIsCurrentPlaceFavorited: (value: boolean) => void;
  setIsPlaceNoteExpanded: (value: boolean) => void;
  setLinkError: (message: string) => void;
  setNoteDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setTrip: Dispatch<SetStateAction<Trip | null>>;
  trip: Trip | null;
};

export function usePlaceDetailActions({
  activeScheduleEntry,
  canRefreshAmapDetails,
  favoritePlaceId,
  isCurrentPlaceFavorited,
  isFavoritePlaceDetail,
  onFavoritePlaceRemoved,
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
}: UsePlaceDetailActionsParams) {
  const [actionError, setActionError] = useState("");
  const [isFavoriteToggling, setIsFavoriteToggling] = useState(false);
  const [isRefreshingAmap, setIsRefreshingAmap] = useState(false);
  const [savingCostKey, setSavingCostKey] = useState("");
  const [savingNoteKey, setSavingNoteKey] = useState("");

  const handleFavoriteToggle = async () => {
    if (!place || isFavoriteToggling) {
      return;
    }

    setIsFavoriteToggling(true);
    setActionError("");

    try {
      if (isCurrentPlaceFavorited) {
        triggerHaptic("light");
        if (isFavoritePlaceDetail && favoritePlaceId) {
          await removeFavoritePlaceById(favoritePlaceId);
        } else {
          const favorites = await getFavoritePlaces();
          const providerId = place.providerPlaceId ?? place.id;
          const match = favorites.find(
            (favorite) => favorite.providerPlaceId === providerId,
          );

          if (match) {
            await removeFavoritePlaceById(match.id);
          }
        }

        setIsCurrentPlaceFavorited(false);

        if (isFavoritePlaceDetail) {
          onFavoritePlaceRemoved();
          return;
        }
      } else {
        triggerHaptic("medium");
        const kind = inferPlaceKind({
          category: place.category,
          name: place.name,
          osmKey: place.osmKey,
          osmValue: place.osmValue,
        });

        const suggestion: PlaceSuggestion = {
          id: place.id,
          name: place.name,
          category: place.category,
          address: place.address ?? "地址待补充",
          area: place.area ?? "未知区域",
          latitude: place.latitude,
          longitude: place.longitude,
          iconKey: place.iconKey ?? kind.iconKey,
          osmKey: place.osmKey,
          osmValue: place.osmValue,
          poiGroup: place.poiGroup ?? kind.poiGroup,
          poiType: place.poiType ?? kind.poiType,
          providerPlaceId: place.providerPlaceId ?? place.id,
          externalRefs: place.externalRefs,
          provider: "mock",
          rating: place.details?.rating,
          phone: place.details?.phone,
          openingHoursToday: place.details?.openingHours,
          costPerPerson: place.details?.priceLevel,
          photos: place.photos?.map((photo) => ({
            url: photo.url,
            title: photo.credit,
          })),
        };
        await upsertFavoritePlace(suggestion);
        setIsCurrentPlaceFavorited(true);
      }
    } catch (toggleError) {
      placeDetailActionsLogger.warn(
        "legacy.warn",
        { args: ["Failed to toggle favorite from place detail.", toggleError] },
        "Legacy warning captured",
      );
      setActionError("操作收藏失败，请稍后再试");
    } finally {
      setIsFavoriteToggling(false);
    }
  };

  const handleInfoLinkOpenError = useCallback(
    (openError: unknown) => {
      placeDetailActionsLogger.warn(
        "legacy.warn",
        { args: ["Failed to open place info link.", openError] },
        "Legacy warning captured",
      );
      setLinkError("外部链接暂时打不开，请稍后再试");
    },
    [setLinkError],
  );

  const openPlaceNavigation = useCallback(
    async (targetPlace: TripPlace) => {
      const preparedWindow = openPreparedWebWindow();

      setLinkError("");

      const openedCandidate = await openFirstMapUrl(
        buildNativeMapNavigationUrls(
          targetPlace,
          PLACE_NAVIGATION_MODE,
          Platform.OS,
        ),
        preparedWindow,
      );

      setLinkError(
        openedCandidate
          ? ""
          : Platform.OS === "web"
            ? "地图暂时打不开，请稍后再试"
            : "没有找到可用的地图 App，请先安装高德地图，或尝试苹果/百度地图",
      );
    },
    [setLinkError],
  );

  const saveEditedScheduleCost = async (
    dayId: string,
    itemId: string,
    costDraft: string,
  ): Promise<boolean> => {
    if (!trip) {
      return false;
    }

    const costKey = getScheduleEntryKey(dayId, itemId);
    const parsedCost = parseExpenseAmountInput(costDraft);

    if (parsedCost.error) {
      setCostDraftErrors((currentErrors) => ({
        ...currentErrors,
        [costKey]: parsedCost.error ?? "",
      }));
      return false;
    }

    const fallbackTrip = trip;
    const result = setTripDayItemCostCommand(trip, {
      amount: parsedCost.amount,
      dayId,
      itemId,
    });

    if (!result.ok) {
      setCostDraftErrors((currentErrors) => ({
        ...currentErrors,
        [costKey]: result.error.message,
      }));
      return false;
    }

    const nextTrip = result.data.trip;

    setSavingCostKey(costKey);
    setCostDraftErrors((currentErrors) => ({
      ...currentErrors,
      [costKey]: "",
    }));
    setTrip(nextTrip);
    setActionError("");

    try {
      const nextTrips = await updateTrip(nextTrip, {
        expectedUpdatedAt: fallbackTrip.updatedAt,
      });
      const savedTrip = nextTrips.find(
        (nextSavedTrip) => nextSavedTrip.id === nextTrip.id,
      );

      if (savedTrip) {
        setTrip(savedTrip);
      }
      triggerHaptic("success");
      return true;
    } catch (costError) {
      placeDetailActionsLogger.warn(
        "legacy.warn",
        { args: ["Failed to update item cost from place detail.", costError] },
        "Legacy warning captured",
      );
      setTrip(fallbackTrip);
      setCostDrafts((currentDrafts) => ({
        ...currentDrafts,
        [costKey]: formatExpenseInputValue(
          fallbackTrip.days
            .find((day) => day.id === dayId)
            ?.items.find((item) => item.id === itemId)?.cost,
        ),
      }));
      setActionError("更新花费失败，请稍后再试");
      return false;
    } finally {
      setSavingCostKey("");
    }
  };

  const saveEditedScheduleNote = async (
    dayId: string,
    itemId: string,
    note: string,
  ) => {
    if (!trip) {
      return;
    }

    const noteKey = getScheduleEntryKey(dayId, itemId);
    const fallbackTrip = trip;
    const result = setTripDayItemNoteCommand(trip, { dayId, itemId, note });

    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }

    const nextTrip = result.data.trip;
    const nextNote =
      nextTrip.days
        .find((day) => day.id === dayId)
        ?.items.find((item) => item.id === itemId)?.note ?? "";

    setSavingNoteKey(noteKey);
    setNoteDrafts((currentDrafts) => ({
      ...currentDrafts,
      [noteKey]: nextNote,
    }));
    setTrip(nextTrip);
    setActionError("");

    try {
      const nextTrips = await updateTrip(nextTrip, {
        expectedUpdatedAt: fallbackTrip.updatedAt,
      });
      const savedTrip = nextTrips.find(
        (nextSavedTrip) => nextSavedTrip.id === nextTrip.id,
      );

      if (savedTrip) {
        setTrip(savedTrip);
      }
    } catch (noteError) {
      placeDetailActionsLogger.warn(
        "legacy.warn",
        { args: ["Failed to update item note from place detail.", noteError] },
        "Legacy warning captured",
      );
      setTrip(fallbackTrip);
      setNoteDrafts((currentDrafts) => ({
        ...currentDrafts,
        [noteKey]:
          fallbackTrip.days
            .find((day) => day.id === dayId)
            ?.items.find((item) => item.id === itemId)?.note ?? "",
      }));
      setActionError("更新备注失败，请稍后再试");
    } finally {
      setSavingNoteKey("");
    }
  };

  const applyRefreshedPlace = async (refreshedPlace: TripPlace) => {
    if (trip) {
      const nextTrip: Trip = {
        ...trip,
        places: trip.places.map((candidate) =>
          candidate.id === place?.id ? refreshedPlace : candidate,
        ),
        updatedAt: new Date().toISOString(),
      };

      setTrip(nextTrip);
      const nextTrips = await updateTrip(nextTrip, {
        expectedUpdatedAt: trip.updatedAt,
      });
      const savedTrip = nextTrips.find(
        (candidate) => candidate.id === nextTrip.id,
      );
      if (savedTrip) setTrip(savedTrip);
      return;
    }

    if (isFavoritePlaceDetail && favoritePlaceId) {
      setFavoritePlace(refreshedPlace);
      const updatedFavorite = await updateFavoritePlaceById(
        favoritePlaceId,
        (currentPlace) => ({
          ...currentPlace,
          address: refreshedPlace.address,
          area: refreshedPlace.area,
          latitude: refreshedPlace.latitude,
          longitude: refreshedPlace.longitude,
          iconKey: refreshedPlace.iconKey,
          osmKey: refreshedPlace.osmKey,
          osmValue: refreshedPlace.osmValue,
          poiGroup: refreshedPlace.poiGroup,
          poiType: refreshedPlace.poiType,
          providerPlaceId: refreshedPlace.providerPlaceId,
          externalRefs: refreshedPlace.externalRefs,
          details: refreshedPlace.details,
          photos: refreshedPlace.photos,
        }),
      );

      if (updatedFavorite) {
        setFavoritePlace(createTripPlaceFromFavoritePlace(updatedFavorite));
      }
    }
  };

  const refreshAmapDetails = async () => {
    if (!place || isRefreshingAmap || !canRefreshAmapDetails) return;
    const amapPoiId = place.externalRefs?.amapPoiId;
    if (!amapPoiId) {
      setActionError("该地点没有高德 POI ID，无法刷新");
      return;
    }

    setIsRefreshingAmap(true);
    setActionError("");

    try {
      const cachedPlace = await fetchFreshPoiFromCloudCache(amapPoiId);
      if (cachedPlace?.photos?.length) {
        await applyRefreshedPlace(mergePublicPoiFields(place, cachedPlace));
        return;
      }

      const detail = await queryAmapPlaceDetail(amapPoiId);
      if (!detail) {
        setActionError("高德未返回该地点的详情数据");
        return;
      }

      const refreshedPlace = createPlaceFromAmapDetail(
        place,
        amapPoiId,
        detail,
      );
      await applyRefreshedPlace(refreshedPlace);
      syncPoiToCloud(refreshedPlace).catch(() => {});
    } catch (refreshError) {
      placeDetailActionsLogger.warn(
        "legacy.warn",
        { args: ["Failed to refresh Amap details.", refreshError] },
        "Legacy warning captured",
      );
      setActionError("刷新高德数据失败，请稍后再试");
    } finally {
      setIsRefreshingAmap(false);
    }
  };

  const openPlaceNoteEditor = () => {
    if (!activeScheduleEntry && !place?.note) {
      setActionError("这个地点需要先加入行程后才能记录地点备注");
      return;
    }

    setIsPlaceNoteExpanded(true);
    setActionError("");
    triggerHaptic("light");
  };

  const openBottomNavigation = () => {
    if (!place) {
      return;
    }

    void openPlaceNavigation(place);
  };

  const openPlaceMapPreview = useCallback(async () => {
    if (!place) return;

    const preparedWindow = openPreparedWebWindow();

    setLinkError("");

    const openedCandidate = await openFirstMapUrl(
      buildNativeMapPlaceUrls(place, Platform.OS),
      preparedWindow,
    );

    setLinkError(
      openedCandidate
        ? ""
        : Platform.OS === "web"
          ? "地图暂时打不开，请稍后再试"
          : "没有找到可用的地图 App，请先安装高德地图，或尝试苹果/百度地图",
    );
  }, [place, setLinkError]);

  return {
    actionError,
    handleFavoriteToggle,
    handleInfoLinkOpenError,
    isFavoriteToggling,
    isRefreshingAmap,
    openBottomNavigation,
    openPlaceMapPreview,
    openPlaceNoteEditor,
    refreshAmapDetails,
    saveEditedScheduleCost,
    saveEditedScheduleNote,
    savingCostKey,
    savingNoteKey,
  };
}
