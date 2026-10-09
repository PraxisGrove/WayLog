import { useLocalSearchParams } from "expo-router";

import { PlaceDetailScreen } from "@/domains/trips/screens/place-detail/place-detail-screen";

type TripPlaceDetailRouteParams = {
  dayId?: string | string[];
  favoritePlaceId?: string | string[];
  itemId?: string | string[];
  localPlaceId?: string | string[];
  placeId?: string | string[];
  returnTo?: string | string[];
  tripId?: string | string[];
};

function normalizeRouteParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function TripPlaceDetailRoute() {
  const params = useLocalSearchParams<TripPlaceDetailRouteParams>();

  return (
    <PlaceDetailScreen
      dayId={normalizeRouteParam(params.dayId)}
      favoritePlaceId={normalizeRouteParam(params.favoritePlaceId)}
      itemId={normalizeRouteParam(params.itemId)}
      localPlaceId={normalizeRouteParam(params.localPlaceId)}
      placeId={normalizeRouteParam(params.placeId)}
      returnTo={normalizeRouteParam(params.returnTo)}
      tripId={normalizeRouteParam(params.tripId)}
    />
  );
}
