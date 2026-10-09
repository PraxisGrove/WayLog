import { useFocusEffect } from "@react-navigation/native";
import { type MutableRefObject, useCallback, useEffect } from "react";
import {
  addTripsUpdateListener,
  getTripById,
  type Trip,
} from "@/features/trips";
import { createDiagnosticLogger } from "@/features/diagnostics";
const tripDetailBackgroundRefreshLogger = createDiagnosticLogger(
  "trip-detail-background-refresh",
);
type UseTripDetailBackgroundRefreshParams = {
  isSavingTripRef: MutableRefObject<boolean>;
  setTrip: (trip: Trip) => void;
  tripId?: string;
};

type ShouldApplyTripRefresh = () => boolean;

export function useTripDetailBackgroundRefresh({
  isSavingTripRef,
  setTrip,
  tripId,
}: UseTripDetailBackgroundRefreshParams) {
  const refreshTrip = useCallback(
    async (shouldApply: ShouldApplyTripRefresh = () => true) => {
      if (!tripId) {
        return;
      }

      if (isSavingTripRef.current) {
        return;
      }

      try {
        const localTrip = await getTripById(tripId);

        if (shouldApply() && localTrip && !isSavingTripRef.current) {
          setTrip(localTrip);
        }
      } catch (loadError) {
        tripDetailBackgroundRefreshLogger.warn(
          "legacy.warn",
          { args: ["Failed to refresh trip status.", loadError] },
          "Legacy warning captured",
        );
      }
    },
    [isSavingTripRef, setTrip, tripId],
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      void refreshTrip(() => isActive);

      return () => {
        isActive = false;
      };
    }, [refreshTrip]),
  );

  useEffect(() => {
    if (!tripId) {
      return undefined;
    }

    let isActive = true;
    const unsubscribe = addTripsUpdateListener(() => {
      void refreshTrip(() => isActive);
    });
    const statusRefreshTimer = setInterval(() => {
      void refreshTrip(() => isActive);
    }, 60 * 1000);

    return () => {
      isActive = false;
      unsubscribe();
      clearInterval(statusRefreshTimer);
    };
  }, [refreshTrip, tripId]);
}
