import { useCallback, useState } from "react";

import {
  appendTripMemo,
  setTripGeneralNote as setTripGeneralNoteCommand,
  type Trip,
} from "@/features/trips";

type PersistTripUpdate = (
  nextTrip: Trip,
  fallbackTrip: Trip,
  errorMessage?: string,
) => Promise<boolean>;

type UseTripInfoActionsParams = {
  persistTripUpdate: PersistTripUpdate;
  setActionError: (message: string) => void;
  trip: Trip | null;
};

export function useTripInfoActions({
  persistTripUpdate,
  setActionError,
  trip,
}: UseTripInfoActionsParams) {
  const [isTripNotebookOpen, setTripNotebookOpen] = useState(false);
  const [isAddingMemo, setAddingMemo] = useState(false);
  const [customMemoTitle, setCustomMemoTitle] = useState("");
  const [customMemoDetail, setCustomMemoDetail] = useState("");
  const [customMemoError, setCustomMemoError] = useState("");

  const openTripNotebook = useCallback(() => {
    if (!trip) {
      return;
    }

    setTripNotebookOpen(true);
    setActionError("");
  }, [setActionError, trip]);

  const closeTripNotebook = useCallback(() => {
    setTripNotebookOpen(false);
  }, []);

  const saveTripNotebook = useCallback(
    async (note: string) => {
      if (!trip) {
        return "行程数据尚未加载，请稍后再试";
      }

      const result = setTripGeneralNoteCommand(trip, { note });

      if (!result.ok) {
        return result.error.message;
      }

      const didSave = await persistTripUpdate(
        result.data.trip,
        trip,
        "保存行程记事本失败，请稍后再试",
      );

      return didSave ? undefined : "保存行程记事本失败，请稍后再试";
    },
    [persistTripUpdate, trip],
  );

  const openMemoInput = useCallback(() => {
    setCustomMemoTitle("");
    setCustomMemoDetail("");
    setCustomMemoError("");
    setAddingMemo(true);
    setActionError("");
  }, [setActionError]);

  const closeMemoInput = useCallback(() => {
    setCustomMemoTitle("");
    setCustomMemoDetail("");
    setCustomMemoError("");
    setAddingMemo(false);
  }, []);

  const addCustomMemo = useCallback(async () => {
    if (!trip) {
      return;
    }

    const title = customMemoTitle.trim();
    const detail = customMemoDetail.trim();

    if (!title && !detail) {
      setCustomMemoError("请先填写备忘内容");
      return;
    }

    const nextTrip = appendTripMemo(trip, { title, detail });

    closeMemoInput();
    await persistTripUpdate(nextTrip, trip, "添加备忘失败，请稍后再试");
  }, [
    closeMemoInput,
    customMemoDetail,
    customMemoTitle,
    persistTripUpdate,
    trip,
  ]);

  return {
    addCustomMemo,
    closeMemoInput,
    closeTripNotebook,
    customMemoDetail,
    customMemoError,
    customMemoTitle,
    isAddingMemo,
    isTripNotebookOpen,
    openMemoInput,
    openTripNotebook,
    saveTripNotebook,
    setCustomMemoDetail,
    setCustomMemoError,
    setCustomMemoTitle,
  };
}
