import { useRouter } from "expo-router";
import { useCallback } from "react";
import { InteractionManager } from "react-native";

import {
  setPendingPlaceDetail,
  type Trip,
  type TripDay,
  type TripDayItem,
  type TripPlace,
} from "@/features/trips";
import type { DayDetailSheetReturnSnapshot } from "../../immersive/types";
import { saveDayDetailSheetReturnSnapshot } from "../../sheet-return-snapshots";

type UseTripDetailNavigationParams = {
  dayDetailSheetSnapKey: DayDetailSheetReturnSnapshot["snapKey"];
  selectedDay?: TripDay;
  selectedMapPreviewItemId?: string;
  trip: Trip | null;
};

export function useImmersiveNavigation({
  dayDetailSheetSnapKey,
  selectedDay,
  selectedMapPreviewItemId,
  trip,
}: UseTripDetailNavigationParams) {
  const router = useRouter();

  const goBackToList = useCallback(() => {
    router.replace("/");
  }, [router]);

  const openEditTrip = useCallback(() => {
    if (!trip) {
      return;
    }

    InteractionManager.runAfterInteractions(() => {
      router.push({
        pathname: "/trips/edit",
        params: { id: trip.id },
      });
    });
  }, [router, trip]);

  const openTripAgent = useCallback(() => {
    if (!trip) {
      return;
    }

    InteractionManager.runAfterInteractions(() => {
      router.push({
        pathname: "/agent",
        params: {
          tripId: trip.id,
          tripTitle: trip.title,
        },
      });
    });
  }, [router, trip]);

  const getDayIdForPlace = useCallback(
    (placeId?: string) => {
      if (!trip || !placeId) {
        return undefined;
      }

      const place = trip.places.find((tripPlace) => tripPlace.id === placeId);
      const day = trip.days.find((tripDay) =>
        tripDay.items.some(
          (item) =>
            item.placeId === placeId ||
            (place
              ? item.placeName === place.name || item.title === place.name
              : false),
        ),
      );

      return day?.id;
    },
    [trip],
  );

  const openPlaceDetail = useCallback(
    (localPlaceId?: string, dayId?: string, itemId?: string) => {
      if (!trip || !localPlaceId) {
        return;
      }

      const returnDayId = dayId ?? getDayIdForPlace(localPlaceId);
      const previewItemId =
        itemId ??
        (returnDayId && selectedDay?.id === returnDayId
          ? selectedMapPreviewItemId
          : undefined);

      if (returnDayId) {
        saveDayDetailSheetReturnSnapshot(trip.id, {
          dayId: returnDayId,
          previewItemId,
          snapKey: dayDetailSheetSnapKey,
        });
      }

      const previewPlace = trip.places.find(
        (candidate) => candidate.id === localPlaceId,
      );
      if (previewPlace) {
        setPendingPlaceDetail(previewPlace);
      }

      InteractionManager.runAfterInteractions(() => {
        router.push({
          pathname: "/trips/place",
          params: {
            ...(returnDayId ? { dayId: returnDayId } : {}),
            ...(itemId ? { itemId } : {}),
            localPlaceId,
            placeId: localPlaceId,
            returnTo: "trip",
            tripId: trip.id,
          },
        });
      });
    },
    [
      dayDetailSheetSnapKey,
      getDayIdForPlace,
      router,
      selectedDay?.id,
      selectedMapPreviewItemId,
      trip,
    ],
  );

  const handleDayItemPress = useCallback(
    (item: TripDayItem, place?: TripPlace, dayId?: string) => {
      openPlaceDetail(place?.id ?? item.placeId, dayId, item.id);
    },
    [openPlaceDetail],
  );

  return {
    goBackToList,
    handleDayItemPress,
    openEditTrip,
    openTripAgent,
    openPlaceDetail,
  };
}
