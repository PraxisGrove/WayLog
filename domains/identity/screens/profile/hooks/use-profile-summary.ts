import { useCallback, useMemo, useState } from "react";

import type { CurrentAuthUser } from "@/features/auth";
import { profilePostLoginCopy } from "@/features/auth";
import { getLocalTripsSnapshot, getTripsWithSeed } from "@/features/trips";

function getTripSummaryItems(
  trips: Awaited<ReturnType<typeof getTripsWithSeed>>,
) {
  return {
    tripCount: trips.length,
    tripDayCount: trips.reduce((total, trip) => total + trip.days.length, 0),
    tripPlaceCount: trips.reduce(
      (total, trip) => total + trip.places.length,
      0,
    ),
  };
}

export function useProfileSummary() {
  const [tripPlaceCount, setTripPlaceCount] = useState(0);
  const [tripCount, setTripCount] = useState(0);
  const [tripDayCount, setTripDayCount] = useState(0);

  const resetProfileSummary = useCallback(() => {
    setTripCount(0);
    setTripDayCount(0);
    setTripPlaceCount(0);
  }, []);

  const applyTripSummary = useCallback(
    (trips: Awaited<ReturnType<typeof getTripsWithSeed>>) => {
      const nextSummary = getTripSummaryItems(trips);

      setTripCount(nextSummary.tripCount);
      setTripDayCount(nextSummary.tripDayCount);
      setTripPlaceCount(nextSummary.tripPlaceCount);
    },
    [],
  );

  const refreshProfileSummary = useCallback(
    async (nextAuthUser: CurrentAuthUser | null) => {
      if (!nextAuthUser) {
        resetProfileSummary();
        return;
      }

      applyTripSummary(await getTripsWithSeed());
    },
    [applyTripSummary, resetProfileSummary],
  );

  const refreshProfileSummaryFromLocal = useCallback(
    async (nextAuthUser: CurrentAuthUser | null) => {
      if (!nextAuthUser) {
        resetProfileSummary();
        return;
      }

      applyTripSummary(await getLocalTripsSnapshot());
    },
    [applyTripSummary, resetProfileSummary],
  );

  const summary = useMemo(
    () => [
      {
        value: tripCount.toString(),
        label: profilePostLoginCopy.summaryLabels[0],
      },
      {
        value: tripDayCount.toString(),
        label: profilePostLoginCopy.summaryLabels[1],
      },
      {
        value: tripPlaceCount.toString(),
        label: profilePostLoginCopy.summaryLabels[2],
      },
    ],
    [tripCount, tripDayCount, tripPlaceCount],
  );

  return {
    refreshProfileSummary,
    refreshProfileSummaryFromLocal,
    summary,
  };
}
