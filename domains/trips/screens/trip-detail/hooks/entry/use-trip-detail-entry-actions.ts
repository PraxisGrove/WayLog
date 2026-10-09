import { type MutableRefObject, useCallback, useEffect } from "react";
import {
  getTripById,
  reInferTripPlaceKinds,
  type Trip,
  updateTrip,
} from "@/features/trips";
import { OVERVIEW_PAGE_ID } from "../../constants";
import type { DayDetailSheetReturnSnapshot } from "../../immersive/types";
import { takeDayDetailSheetReturnSnapshot } from "../../sheet-return-snapshots";
import { createDiagnosticLogger } from "@/features/diagnostics";
const tripDetailEntryActionsLogger = createDiagnosticLogger(
  "trip-detail-entry-actions",
);
type UseTripDetailEntryActionsParams = {
  pendingDayDetailReturnSnapshotRef: MutableRefObject<
    DayDetailSheetReturnSnapshot | undefined
  >;
  pendingDaySheetScrollRef: MutableRefObject<string | undefined>;
  requestedDayId?: string;
  setError: (message: string) => void;
  setLoading: (isLoading: boolean) => void;
  setSelectedMapPreviewItemId: (itemId?: string) => void;
  setSelectedPageId: (
    updater: string | ((currentPageId: string) => string),
  ) => void;
  setTrip: (trip: Trip | null) => void;
  tripId?: string;
};

export function useTripDetailEntryActions({
  pendingDayDetailReturnSnapshotRef,
  pendingDaySheetScrollRef,
  requestedDayId,
  setError,
  setLoading,
  setSelectedMapPreviewItemId,
  setSelectedPageId,
  setTrip,
  tripId,
}: UseTripDetailEntryActionsParams) {
  const loadTrip = useCallback(async () => {
    if (!tripId) {
      setError("没有找到这趟行程");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const localTrip = await getTripById(tripId);

      if (!localTrip) {
        setTrip(null);
        setError("没有找到这趟行程");
        return;
      }

      const routeRequestedDayId =
        requestedDayId &&
        localTrip.days.some((day) => day.id === requestedDayId)
          ? requestedDayId
          : undefined;
      const returnSnapshot = takeDayDetailSheetReturnSnapshot(
        tripId,
        localTrip,
      );
      const shouldApplyReturnSnapshot =
        Boolean(returnSnapshot) &&
        (!routeRequestedDayId || routeRequestedDayId === returnSnapshot?.dayId);
      const requestedDayIdForTrip =
        routeRequestedDayId ?? returnSnapshot?.dayId;

      pendingDayDetailReturnSnapshotRef.current = shouldApplyReturnSnapshot
        ? returnSnapshot
        : undefined;

      if (requestedDayIdForTrip) {
        pendingDaySheetScrollRef.current = requestedDayIdForTrip;
      }

      if (shouldApplyReturnSnapshot) {
        setSelectedMapPreviewItemId(returnSnapshot?.previewItemId);
      }

      const reInferredTrip = reInferTripPlaceKinds(localTrip);
      setTrip(reInferredTrip);
      if (reInferredTrip !== localTrip) {
        void updateTrip(reInferredTrip, {
          expectedUpdatedAt: localTrip.updatedAt,
        }).catch((error) =>
          tripDetailEntryActionsLogger.warn(
            "legacy.warn",
            { args: ["Failed to update place kinds.", error] },
            "Legacy warning captured",
          ),
        );
      }

      tripDetailEntryActionsLogger.debug(
        "legacy.debug",
        {
          args: [
            "[loadTrip] loaded trip:",
            {
              id: localTrip.id,
              expenseCount: localTrip.expenses?.length ?? 0,
              expenses: localTrip.expenses?.map((expense) => ({
                amount: expense.amount,
                id: expense.id,
                title: expense.title,
              })),
              dayItemCosts: localTrip.days.flatMap((day) =>
                day.items
                  .filter((item) => typeof item.cost === "number")
                  .map((item) => ({
                    cost: item.cost,
                    dayId: day.id,
                    title: item.title,
                  })),
              ),
            },
          ],
        },
        "Legacy debug log captured",
      );

      setSelectedPageId((currentPageId) => {
        if (requestedDayIdForTrip) {
          return requestedDayIdForTrip;
        }

        if (currentPageId === OVERVIEW_PAGE_ID) {
          return OVERVIEW_PAGE_ID;
        }

        const hasCurrentDay = localTrip.days.some(
          (day) => day.id === currentPageId,
        );
        return hasCurrentDay ? currentPageId : OVERVIEW_PAGE_ID;
      });
    } catch (loadError) {
      tripDetailEntryActionsLogger.warn(
        "legacy.warn",
        { args: ["Failed to load trip detail.", loadError] },
        "Legacy warning captured",
      );
      setTrip(null);
      setError("读取行程详情失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }, [
    pendingDayDetailReturnSnapshotRef,
    pendingDaySheetScrollRef,
    requestedDayId,
    setError,
    setLoading,
    setSelectedMapPreviewItemId,
    setSelectedPageId,
    setTrip,
    tripId,
  ]);

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  return {
    loadTrip,
  };
}
