import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearPendingPlaceDetail,
  createTripPlaceFromFavoritePlace,
  findTripPlace,
  getFavoritePlaceById,
  getPendingPlaceDetail,
  getTripById,
  type Trip,
  type TripPlace,
} from "@/features/trips";
import { createDiagnosticLogger } from "@/features/diagnostics";
const placeDetailDataLogger = createDiagnosticLogger("place-detail-data");
type UsePlaceDetailDataParams = {
  favoritePlaceId?: string;
  localPlaceId?: string;
  tripId?: string;
};

export function usePlaceDetailData({
  favoritePlaceId,
  localPlaceId,
  tripId,
}: UsePlaceDetailDataParams) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [favoritePlace, setFavoritePlace] = useState<TripPlace | undefined>();
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const place = useMemo(
    () =>
      trip && localPlaceId ? findTripPlace(trip, localPlaceId) : favoritePlace,
    [favoritePlace, localPlaceId, trip],
  );

  const loadPlace = useCallback(async () => {
    const favoriteDetailPlaceId =
      favoritePlaceId ?? (!tripId ? localPlaceId : undefined);

    if (!tripId && !favoriteDetailPlaceId) {
      const pendingPlace = getPendingPlaceDetail();

      if (pendingPlace) {
        setTrip(null);
        setFavoritePlace(pendingPlace);
        setLoading(false);
        return;
      }

      setError("没有找到这个地点");
      setLoading(false);
      return;
    }

    if (!tripId && favoriteDetailPlaceId) {
      const pendingPlace = getPendingPlaceDetail();
      if (pendingPlace?.id === favoriteDetailPlaceId) {
        setTrip(null);
        setFavoritePlace(pendingPlace);
        setLoading(false);
        setError("");
      } else {
        setLoading(true);
        setError("");
      }

      try {
        const localFavoritePlace = await getFavoritePlaceById(
          favoriteDetailPlaceId,
        );

        if (!localFavoritePlace) {
          setTrip(null);
          setFavoritePlace(undefined);
          setError("没有找到这个收藏地点");
          return;
        }

        setTrip(null);
        setFavoritePlace(createTripPlaceFromFavoritePlace(localFavoritePlace));
      } catch (loadError) {
        placeDetailDataLogger.warn(
          "legacy.warn",
          { args: ["Failed to load favorite place detail.", loadError] },
          "Legacy warning captured",
        );
        setTrip(null);
        setFavoritePlace(undefined);
        setError("读取收藏地点失败，请稍后再试");
      } finally {
        setLoading(false);
      }

      return;
    }

    if (!tripId || !localPlaceId) {
      setError("没有找到这个地点");
      setLoading(false);
      return;
    }

    const pendingPlace = getPendingPlaceDetail();
    if (pendingPlace?.id === localPlaceId) {
      setTrip(null);
      setFavoritePlace(pendingPlace);
      setLoading(false);
      setError("");
    } else {
      setLoading(true);
      setError("");
    }

    try {
      const localTrip = await getTripById(tripId);

      if (!localTrip) {
        setTrip(null);
        setFavoritePlace(undefined);
        setError("没有找到这趟行程");
        return;
      }

      if (!findTripPlace(localTrip, localPlaceId)) {
        setTrip(localTrip);
        setFavoritePlace(undefined);
        setError("没有找到这个地点");
        return;
      }

      setTrip(localTrip);
      setFavoritePlace(undefined);
    } catch (loadError) {
      placeDetailDataLogger.warn(
        "legacy.warn",
        { args: ["Failed to load place detail.", loadError] },
        "Legacy warning captured",
      );
      setTrip(null);
      setFavoritePlace(undefined);
      setError("读取地点详情失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }, [favoritePlaceId, localPlaceId, tripId]);

  useEffect(() => {
    void loadPlace();
  }, [loadPlace]);

  useEffect(() => {
    return () => {
      clearPendingPlaceDetail();
    };
  }, []);

  return {
    error,
    favoritePlace,
    isLoading,
    loadPlace,
    place,
    setFavoritePlace,
    setTrip,
    trip,
  };
}
