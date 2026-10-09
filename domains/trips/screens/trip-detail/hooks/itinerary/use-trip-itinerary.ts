import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useMemo,
  useState,
} from "react";
import { OVERVIEW_PAGE_ID } from "@/domains/trips/screens/trip-detail/constants";
import {
  addTripDay as addTripDayCommand,
  createScheduledTripPlaceFromSuggestion,
  createTripDayItemFromPlaceSuggestion,
  formatExpenseInputValue,
  formatTripDayTitle,
  getPlaceForTripDayItem,
  getTripDayPlaceSearchCenter,
  normalizeDayItemTime,
  type PlaceSuggestion,
  parseExpenseAmountInput,
  removeDayItem as removeDayItemCommand,
  removeTripDay as removeTripDayCommand,
  resolveTripDayTitle,
  resolveTripDestination,
  setTripDayItemCost as setTripDayItemCostCommand,
  type Trip,
  type TripPlace,
  updateDayItem as updateDayItemCommand,
  updateTripDayTitle as updateTripDayTitleCommand,
} from "@/features/trips";
import type {
  DayActionTarget,
  DayItemActionTarget,
} from "../../itinerary/types";

type PersistTripUpdate = (
  nextTrip: Trip,
  fallbackTrip: Trip,
  errorMessage?: string,
) => Promise<boolean>;

type UseTripItineraryParams = {
  longPressHandledDayIdRef: MutableRefObject<string>;
  pendingDaySheetScrollRef: MutableRefObject<string | undefined>;
  persistTripUpdate: PersistTripUpdate;
  scrollDaySheetToDay: (dayId: string, animated?: boolean) => void;
  scrollDayTabsToEnd: () => void;
  selectedPageId: string;
  selectedPageIdRef: MutableRefObject<string>;
  setActionError: Dispatch<SetStateAction<string>>;
  setSelectedPageId: Dispatch<SetStateAction<string>>;
  trip: Trip | null;
};

export function useTripItinerary({
  longPressHandledDayIdRef,
  pendingDaySheetScrollRef,
  persistTripUpdate,
  scrollDaySheetToDay,
  scrollDayTabsToEnd,
  selectedPageId,
  selectedPageIdRef,
  setActionError,
  setSelectedPageId,
  trip,
}: UseTripItineraryParams) {
  const [activePlaceSearchDayId, setActivePlaceSearchDayId] = useState<
    string | undefined
  >();
  const [activeDayTarget, setActiveDayTarget] = useState<
    DayActionTarget | undefined
  >();
  const [isEditingDay, setEditingDay] = useState(false);
  const [isConfirmingDayDelete, setConfirmingDayDelete] = useState(false);
  const [editDayTitle, setEditDayTitle] = useState("");

  const [activeDayItemTarget, setActiveDayItemTarget] = useState<
    DayItemActionTarget | undefined
  >();
  const [isConfirmingDayItemDelete, setConfirmingDayItemDelete] =
    useState(false);
  const [isEditingDayItem, setEditingDayItem] = useState(false);
  const [isEditingDayItemTime, setEditingDayItemTime] = useState(false);
  const [isPickingDayItemFormTime, setPickingDayItemFormTime] = useState(false);

  const [editPlaceName, setEditPlaceName] = useState("");
  const [editPlaceTime, setEditPlaceTime] = useState("");
  const [editPlaceTimeError, setEditPlaceTimeError] = useState("");
  const [editPlaceCost, setEditPlaceCost] = useState("");
  const [editPlaceCostError, setEditPlaceCostError] = useState("");
  const [editPlaceNote, setEditPlaceNote] = useState("");

  const activePlaceSearchDay = useMemo(
    () => trip?.days.find((day) => day.id === activePlaceSearchDayId),
    [activePlaceSearchDayId, trip],
  );
  const activePlaceSearchCenter = useMemo(
    () =>
      activePlaceSearchDay && trip
        ? getTripDayPlaceSearchCenter(activePlaceSearchDay, trip.places)
        : undefined,
    [activePlaceSearchDay, trip],
  );
  const activePlaceSearchRegionText = useMemo(
    () => (trip ? resolveTripDestination(trip) : undefined),
    [trip],
  );

  const activeDayAction = useMemo(() => {
    if (!trip || !activeDayTarget) {
      return undefined;
    }

    return trip.days.find((day) => day.id === activeDayTarget.dayId);
  }, [activeDayTarget, trip]);

  const activeDayItemAction = useMemo(() => {
    if (!trip || !activeDayItemTarget) {
      return undefined;
    }

    const day = trip.days.find(
      (tripDay) => tripDay.id === activeDayItemTarget.dayId,
    );
    const item = day?.items.find(
      (dayItem) => dayItem.id === activeDayItemTarget.itemId,
    );

    if (!day || !item) {
      return undefined;
    }

    return {
      day,
      item,
      place: getPlaceForTripDayItem(trip, item),
    };
  }, [activeDayItemTarget, trip]);

  const addDayPlan = async () => {
    if (!trip) {
      return;
    }

    const result = addTripDayCommand(trip);

    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }

    const previousPageId = selectedPageId;
    const nextDay = result.data.day;

    pendingDaySheetScrollRef.current = nextDay.id;
    selectedPageIdRef.current = nextDay.id;
    setSelectedPageId(nextDay.id);
    const didPersist = await persistTripUpdate(
      result.data.trip,
      trip,
      "新增一天失败，请稍后再试",
    );

    if (!didPersist) {
      pendingDaySheetScrollRef.current = undefined;
      selectedPageIdRef.current = previousPageId;
      setSelectedPageId(previousPageId);
      return;
    }

    setTimeout(() => {
      scrollDayTabsToEnd();
      scrollDaySheetToDay(nextDay.id);
    }, 0);
  };

  const addPlaceToDay = async (dayId: string, suggestion: PlaceSuggestion) => {
    if (!trip) {
      return;
    }

    const nextPlace = createScheduledTripPlaceFromSuggestion(suggestion);
    const nextItem = createTripDayItemFromPlaceSuggestion(
      suggestion,
      nextPlace.id,
    );
    const nextTrip: Trip = {
      ...trip,
      days: trip.days.map((day) =>
        day.id === dayId
          ? {
              ...day,
              items: [...day.items, nextItem],
            }
          : day,
      ),
      places: [...trip.places, nextPlace],
      updatedAt: new Date().toISOString(),
    };

    setActivePlaceSearchDayId(undefined);
    await persistTripUpdate(nextTrip, trip);
  };

  const addPlaceToActiveDay = (suggestion: PlaceSuggestion) => {
    if (!activePlaceSearchDayId) {
      return;
    }

    void addPlaceToDay(activePlaceSearchDayId, suggestion);
  };

  const closeDayActions = () => {
    longPressHandledDayIdRef.current = "";
    setActiveDayTarget(undefined);
    setEditingDay(false);
    setConfirmingDayDelete(false);
    setEditDayTitle("");
  };

  const openDayActions = (dayId: string) => {
    longPressHandledDayIdRef.current = dayId;
    setActiveDayTarget({ dayId });
    setEditingDay(false);
    setConfirmingDayDelete(false);
    setEditDayTitle("");
    setActionError("");
  };

  const openDayTitleEditor = (dayId: string) => {
    if (!trip) {
      return;
    }

    const day = trip.days.find((candidate) => candidate.id === dayId);

    if (!day) {
      return;
    }

    longPressHandledDayIdRef.current = dayId;
    setActiveDayTarget({ dayId });
    setEditDayTitle(resolveTripDayTitle(day));
    setConfirmingDayDelete(false);
    setEditingDay(true);
    setActionError("");
  };

  const startEditingDay = () => {
    if (!activeDayAction) {
      return;
    }

    setEditDayTitle(resolveTripDayTitle(activeDayAction));
    setConfirmingDayDelete(false);
    setEditingDay(true);
  };

  const saveEditedDay = async () => {
    if (!trip || !activeDayAction) {
      return;
    }

    const result = updateTripDayTitleCommand(trip, {
      dayId: activeDayAction.id,
      title:
        editDayTitle.trim() || formatTripDayTitle(activeDayAction.dayIndex),
    });

    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }

    closeDayActions();
    await persistTripUpdate(
      result.data.trip,
      trip,
      "更新这一天失败，请稍后再试",
    );
  };

  const deleteActiveDay = async () => {
    if (!trip || !activeDayAction) {
      return;
    }

    const result = removeTripDayCommand(trip, { dayId: activeDayAction.id });

    if (!result.ok) {
      setConfirmingDayDelete(false);
      setActionError(result.error.message);
      return;
    }

    const nextDays = result.data.trip.days;
    const previousPageId = selectedPageId;
    const nextSelectedPageId =
      selectedPageId === activeDayAction.id
        ? (nextDays[
            Math.min(
              Math.max(result.data.removedDayIndex, 0),
              nextDays.length - 1,
            )
          ]?.id ?? OVERVIEW_PAGE_ID)
        : selectedPageId;

    closeDayActions();
    setSelectedPageId(nextSelectedPageId);

    const didPersist = await persistTripUpdate(
      result.data.trip,
      trip,
      "删除这一天失败，请稍后再试",
    );

    if (!didPersist) {
      setSelectedPageId(previousPageId);
    }
  };

  const closeDayItemActions = () => {
    setActiveDayItemTarget(undefined);
    setConfirmingDayItemDelete(false);
    setEditingDayItem(false);
    setEditingDayItemTime(false);
    setPickingDayItemFormTime(false);
    setEditPlaceTimeError("");
    setEditPlaceCostError("");
  };

  const openDayItemEditor = (dayId: string, itemId: string) => {
    if (!trip) {
      return;
    }

    const day = trip.days.find((tripDay) => tripDay.id === dayId);
    const item = day?.items.find((dayItem) => dayItem.id === itemId);

    if (!day || !item) {
      return;
    }

    const place = getPlaceForTripDayItem(trip, item);
    const placeName = item.placeName ?? place?.name ?? item.title;

    setActiveDayItemTarget({ dayId, itemId });
    setEditPlaceName(placeName);
    setEditPlaceTime(item.time ?? "");
    setEditPlaceTimeError("");
    setEditPlaceCost(formatExpenseInputValue(item.cost));
    setEditPlaceCostError("");
    setEditPlaceNote(item.note ?? place?.note ?? "");
    setConfirmingDayItemDelete(false);
    setEditingDayItemTime(false);
    setPickingDayItemFormTime(false);
    setEditingDayItem(true);
    setActionError("");
  };

  const confirmDayItemDelete = (dayId: string, itemId: string) => {
    setActiveDayItemTarget({ dayId, itemId });
    setEditingDayItem(false);
    setEditingDayItemTime(false);
    setConfirmingDayItemDelete(true);
    setActionError("");
  };

  const openDayItemTimeEditor = (
    dayId: string,
    itemId: string,
    currentTime?: string,
  ) => {
    setActiveDayItemTarget({ dayId, itemId });
    setEditPlaceTime(currentTime ?? "");
    setEditPlaceTimeError("");
    setConfirmingDayItemDelete(false);
    setEditingDayItem(false);
    setPickingDayItemFormTime(false);
    setEditingDayItemTime(true);
    setActionError("");
  };

  const startEditingDayItem = () => {
    if (!activeDayItemAction) {
      return;
    }

    const placeName =
      activeDayItemAction.item.placeName ??
      activeDayItemAction.place?.name ??
      activeDayItemAction.item.title;

    setEditPlaceName(placeName);
    setEditPlaceTime(activeDayItemAction.item.time ?? "");
    setEditPlaceTimeError("");
    setEditPlaceCost(formatExpenseInputValue(activeDayItemAction.item.cost));
    setEditPlaceCostError("");
    setEditPlaceNote(
      activeDayItemAction.item.note ?? activeDayItemAction.place?.note ?? "",
    );
    setConfirmingDayItemDelete(false);
    setEditingDayItemTime(false);
    setPickingDayItemFormTime(false);
    setEditingDayItem(true);
  };

  const saveEditedDayItem = async () => {
    if (!trip || !activeDayItemAction) {
      return;
    }

    const trimmedName = editPlaceName.trim();

    if (!trimmedName) {
      setActionError("请先填写地点名称");
      return;
    }

    const normalizedTime = normalizeDayItemTime(editPlaceTime);

    if (normalizedTime.error) {
      setEditPlaceTimeError(normalizedTime.error);
      return;
    }

    const parsedCost = parseExpenseAmountInput(editPlaceCost);

    if (parsedCost.error) {
      setEditPlaceCostError(parsedCost.error);
      return;
    }

    const trimmedNote = editPlaceNote.trim();
    const nextPlaceId =
      activeDayItemAction.place?.id ??
      activeDayItemAction.item.placeId ??
      `place-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextPlace: TripPlace = activeDayItemAction.place
      ? {
          ...activeDayItemAction.place,
          name: trimmedName,
          note: trimmedNote || undefined,
          isScheduled: true,
        }
      : {
          id: nextPlaceId,
          name: trimmedName,
          category: activeDayItemAction.item.category ?? "其他",
          isScheduled: true,
          note: trimmedNote || undefined,
          iconKey: activeDayItemAction.item.iconKey,
        };
    const hasPlace = trip.places.some((place) => place.id === nextPlace.id);
    let nextTrip: Trip = {
      ...trip,
      days: trip.days.map((day) =>
        day.id === activeDayItemAction.day.id
          ? {
              ...day,
              items: day.items.map((item) =>
                item.id === activeDayItemAction.item.id
                  ? {
                      ...item,
                      title: trimmedName,
                      category: item.category ?? nextPlace.category,
                      iconKey: item.iconKey ?? nextPlace.iconKey,
                      placeId: nextPlace.id,
                      placeName: trimmedName,
                      time: normalizedTime.time,
                      cost: item.cost,
                      costRecordedAt: item.costRecordedAt,
                      note: trimmedNote || undefined,
                    }
                  : item,
              ),
            }
          : day,
      ),
      places: hasPlace
        ? trip.places.map((place) =>
            place.id === nextPlace.id ? nextPlace : place,
          )
        : [...trip.places, nextPlace],
      updatedAt: new Date().toISOString(),
    };
    const costResult = setTripDayItemCostCommand(nextTrip, {
      amount: parsedCost.amount,
      dayId: activeDayItemAction.day.id,
      itemId: activeDayItemAction.item.id,
    });

    if (!costResult.ok) {
      setEditPlaceCostError(costResult.error.message);
      return;
    }

    nextTrip = costResult.data.trip;

    closeDayItemActions();
    await persistTripUpdate(nextTrip, trip);
  };

  const saveEditedDayItemTime = async (nextTime: string) => {
    if (!trip || !activeDayItemAction) {
      return;
    }

    const result = updateDayItemCommand(trip, {
      dayId: activeDayItemAction.day.id,
      itemId: activeDayItemAction.item.id,
      changes: { time: nextTime },
    });

    if (!result.ok) {
      setEditPlaceTimeError(result.error.message);
      return;
    }

    closeDayItemActions();
    await persistTripUpdate(result.data.trip, trip, "更新时间失败，请稍后再试");
  };

  const deleteActiveDayItem = async () => {
    if (!trip || !activeDayItemAction) {
      return;
    }

    const result = removeDayItemCommand(trip, {
      dayId: activeDayItemAction.day.id,
      itemId: activeDayItemAction.item.id,
    });

    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }

    closeDayItemActions();
    await persistTripUpdate(result.data.trip, trip);
  };

  return {
    activeDayAction,
    activeDayItemAction,
    activePlaceSearchCenter,
    activePlaceSearchDay,
    activePlaceSearchRegionText,
    addDayPlan,
    addPlaceToActiveDay,
    closeDayActions,
    closeDayItemActions,
    confirmDayItemDelete,
    deleteActiveDay,
    deleteActiveDayItem,
    editDayTitle,
    editPlaceCost,
    editPlaceCostError,
    editPlaceName,
    editPlaceNote,
    editPlaceTime,
    editPlaceTimeError,
    isConfirmingDayDelete,
    isConfirmingDayItemDelete,
    isEditingDay,
    isEditingDayItem,
    isEditingDayItemTime,
    isPickingDayItemFormTime,
    openDayActions,
    openDayTitleEditor,
    openDayItemEditor,
    openDayItemTimeEditor,
    saveEditedDay,
    saveEditedDayItem,
    saveEditedDayItemTime,
    setActivePlaceSearchDayId,
    setConfirmingDayDelete,
    setConfirmingDayItemDelete,
    setEditDayTitle,
    setEditPlaceCost,
    setEditPlaceCostError,
    setEditPlaceName,
    setEditPlaceNote,
    setEditPlaceTime,
    setEditPlaceTimeError,
    setPickingDayItemFormTime,
    startEditingDay,
    startEditingDayItem,
  };
}
