import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Easing, type GestureResponderEvent } from "react-native";
import {
  addChecklistItem as addChecklistItemCommand,
  moveChecklistItem as moveChecklistItemCommand,
  removeChecklistItem as removeChecklistItemCommand,
  removeChecklistItems as removeChecklistItemsCommand,
  type Trip,
  type TripChecklistItem,
  toggleChecklistItem as toggleChecklistItemCommand,
  updateChecklistItemTitle as updateChecklistItemTitleCommand,
} from "@/features/trips";
import { triggerHaptic } from "@/shared/ui/haptic-feedback";
import { PREVIEW_TAP_MOVE_THRESHOLD } from "../../checklist/constants";

type ChecklistCommandResult =
  | ReturnType<typeof addChecklistItemCommand>
  | ReturnType<typeof toggleChecklistItemCommand>
  | ReturnType<typeof removeChecklistItemCommand>
  | ReturnType<typeof removeChecklistItemsCommand>
  | ReturnType<typeof updateChecklistItemTitleCommand>
  | ReturnType<typeof moveChecklistItemCommand>;

type PersistTripUpdate = (
  nextTrip: Trip,
  fallbackTrip: Trip,
  errorMessage?: string,
) => Promise<boolean>;

type UseTripChecklistParams = {
  persistTripUpdate: PersistTripUpdate;
  setActionError: Dispatch<SetStateAction<string>>;
  trip: Trip | null;
};

export function useTripChecklist({
  persistTripUpdate,
  setActionError,
  trip,
}: UseTripChecklistParams) {
  const notebookPreviewTouchRef = useRef<
    { didDrag: boolean; startX: number; startY: number } | undefined
  >(undefined);
  const checklistModalAnim = useRef(new Animated.Value(0)).current;

  const [isAddingChecklistItem, setAddingChecklistItem] = useState(false);
  const [isChecklistNotebookOpen, setChecklistNotebookOpen] = useState(false);
  const [isChecklistManageMode, setChecklistManageMode] = useState(false);
  const [editingChecklistItemId, setEditingChecklistItemId] = useState<
    string | undefined
  >();
  const [selectedChecklistItemIds, setSelectedChecklistItemIds] = useState<
    string[]
  >([]);
  const [isConfirmingChecklistDelete, setConfirmingChecklistDelete] =
    useState(false);
  const [customChecklistTitle, setCustomChecklistTitle] = useState("");
  const [customChecklistError, setCustomChecklistError] = useState("");
  const [editingChecklistTitle, setEditingChecklistTitle] = useState("");
  const [editingChecklistError, setEditingChecklistError] = useState("");

  const completedChecklistCount = useMemo(
    () => trip?.checklistItems.filter((item) => item.isCompleted).length ?? 0,
    [trip],
  );

  useEffect(() => {
    if (!isChecklistNotebookOpen) {
      return;
    }

    checklistModalAnim.setValue(0);
    Animated.timing(checklistModalAnim, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [checklistModalAnim, isChecklistNotebookOpen]);

  useEffect(() => {
    if (!trip) {
      return;
    }

    const checklistItemIds = new Set(
      trip.checklistItems.map((item) => item.id),
    );

    setSelectedChecklistItemIds((itemIds) =>
      itemIds.filter((itemId) => checklistItemIds.has(itemId)),
    );

    if (
      editingChecklistItemId &&
      !checklistItemIds.has(editingChecklistItemId)
    ) {
      setEditingChecklistItemId(undefined);
      setEditingChecklistTitle("");
      setEditingChecklistError("");
    }
  }, [editingChecklistItemId, trip]);

  const closeChecklistNotebook = () => {
    Animated.timing(checklistModalAnim, {
      duration: 160,
      easing: Easing.in(Easing.cubic),
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        return;
      }

      setChecklistNotebookOpen(false);
      setChecklistManageMode(false);
      setSelectedChecklistItemIds([]);
      setConfirmingChecklistDelete(false);
      setEditingChecklistItemId(undefined);
      setEditingChecklistTitle("");
      setEditingChecklistError("");
    });
  };

  const openChecklistNotebook = () => {
    setChecklistNotebookOpen(true);
    setActionError("");
  };

  const handleNotebookPreviewTouchStart = (event: GestureResponderEvent) => {
    notebookPreviewTouchRef.current = {
      didDrag: false,
      startX: event.nativeEvent.pageX,
      startY: event.nativeEvent.pageY,
    };
  };

  const handleNotebookPreviewTouchMove = (event: GestureResponderEvent) => {
    const touchState = notebookPreviewTouchRef.current;

    if (!touchState) {
      return;
    }

    const deltaX = Math.abs(event.nativeEvent.pageX - touchState.startX);
    const deltaY = Math.abs(event.nativeEvent.pageY - touchState.startY);

    if (
      deltaX > PREVIEW_TAP_MOVE_THRESHOLD ||
      deltaY > PREVIEW_TAP_MOVE_THRESHOLD
    ) {
      touchState.didDrag = true;
    }
  };

  const handleNotebookPreviewTouchCancel = () => {
    notebookPreviewTouchRef.current = undefined;
  };

  const handleNotebookPreviewTouchEnd = () => {
    const touchState = notebookPreviewTouchRef.current;
    notebookPreviewTouchRef.current = undefined;

    if (!touchState || touchState.didDrag) {
      return;
    }

    openChecklistNotebook();
  };

  const applyChecklistTripUpdate = async (
    result: ChecklistCommandResult,
    fallbackTrip: Trip,
    errorMessage: string,
  ) => {
    if (!result.ok) {
      setActionError(result.error.message);
      return false;
    }

    await persistTripUpdate(result.data.trip, fallbackTrip, errorMessage);
    return true;
  };

  const toggleChecklistItem = async (itemId: string) => {
    if (!trip) {
      return;
    }

    const item = trip.checklistItems.find(
      (candidate) => candidate.id === itemId,
    );
    if (item) {
      triggerHaptic(item.isCompleted ? "light" : "success");
    }

    await applyChecklistTripUpdate(
      toggleChecklistItemCommand(trip, { itemId }),
      trip,
      "更新清单失败，请稍后再试",
    );
  };

  const openChecklistInput = () => {
    setCustomChecklistTitle("");
    setCustomChecklistError("");
    setAddingChecklistItem(true);
    setActionError("");
  };

  const closeChecklistInput = () => {
    setCustomChecklistTitle("");
    setCustomChecklistError("");
    setAddingChecklistItem(false);
  };

  const addCustomChecklistItem = async () => {
    if (!trip) {
      return;
    }

    const result = addChecklistItemCommand(trip, {
      title: customChecklistTitle,
    });

    if (!result.ok) {
      setCustomChecklistError(result.error.message);
      return;
    }

    closeChecklistInput();
    await persistTripUpdate(result.data.trip, trip, "添加清单失败，请稍后再试");
  };

  const startEditingChecklistItem = (item: TripChecklistItem) => {
    setEditingChecklistItemId(item.id);
    setEditingChecklistTitle(item.title);
    setEditingChecklistError("");
    setChecklistManageMode(true);
  };

  const cancelEditingChecklistItem = () => {
    setEditingChecklistItemId(undefined);
    setEditingChecklistTitle("");
    setEditingChecklistError("");
  };

  const saveEditingChecklistItem = async () => {
    if (!trip || !editingChecklistItemId) {
      return;
    }

    const result = updateChecklistItemTitleCommand(trip, {
      itemId: editingChecklistItemId,
      title: editingChecklistTitle,
    });

    if (!result.ok) {
      setEditingChecklistError(result.error.message);
      return;
    }

    cancelEditingChecklistItem();
    await persistTripUpdate(result.data.trip, trip, "更新清单失败，请稍后再试");
  };

  const deleteChecklistItem = async (itemId: string) => {
    if (!trip) {
      return;
    }

    await applyChecklistTripUpdate(
      removeChecklistItemCommand(trip, { itemId }),
      trip,
      "删除清单失败，请稍后再试",
    );
  };

  const moveChecklistItem = async (
    itemId: string,
    direction: "down" | "up",
  ) => {
    if (!trip) {
      return;
    }

    await applyChecklistTripUpdate(
      moveChecklistItemCommand(trip, { itemId, direction }),
      trip,
      "调整清单顺序失败，请稍后再试",
    );
  };

  const toggleChecklistSelection = (itemId: string) => {
    setSelectedChecklistItemIds((itemIds) =>
      itemIds.includes(itemId)
        ? itemIds.filter((id) => id !== itemId)
        : [...itemIds, itemId],
    );
  };

  const deleteSelectedChecklistItems = async () => {
    if (!trip) {
      return;
    }

    const result = removeChecklistItemsCommand(trip, {
      itemIds: selectedChecklistItemIds,
    });

    if (!result.ok) {
      setActionError(result.error.message);
      setConfirmingChecklistDelete(false);
      return;
    }

    setSelectedChecklistItemIds([]);
    setConfirmingChecklistDelete(false);
    await persistTripUpdate(result.data.trip, trip, "删除清单失败，请稍后再试");
  };

  return {
    addCustomChecklistItem,
    cancelEditingChecklistItem,
    checklistModalAnim,
    closeChecklistInput,
    closeChecklistNotebook,
    completedChecklistCount,
    customChecklistError,
    customChecklistTitle,
    deleteChecklistItem,
    deleteSelectedChecklistItems,
    editingChecklistError,
    editingChecklistItemId,
    editingChecklistTitle,
    handleNotebookPreviewTouchCancel,
    handleNotebookPreviewTouchEnd,
    handleNotebookPreviewTouchMove,
    handleNotebookPreviewTouchStart,
    isAddingChecklistItem,
    isChecklistManageMode,
    isChecklistNotebookOpen,
    isConfirmingChecklistDelete,
    moveChecklistItem,
    openChecklistInput,
    openChecklistNotebook,
    saveEditingChecklistItem,
    selectedChecklistItemIds,
    setChecklistManageMode,
    setConfirmingChecklistDelete,
    setCustomChecklistError,
    setCustomChecklistTitle,
    setEditingChecklistError,
    setEditingChecklistTitle,
    setSelectedChecklistItemIds,
    startEditingChecklistItem,
    toggleChecklistItem,
    toggleChecklistSelection,
  };
}
