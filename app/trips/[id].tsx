import { useLocalSearchParams } from "expo-router";

import { TripDetailScreen } from "@/domains/trips/screens/trip-detail/trip-detail-screen";

type TripDetailRouteParams = {
  action?: string | string[];
  dayId?: string | string[];
  id?: string | string[];
};

function normalizeRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function TripDetailRoute() {
  const params = useLocalSearchParams<TripDetailRouteParams>();

  return (
    <TripDetailScreen
      requestedAction={normalizeRouteParam(params.action)}
      requestedDayId={normalizeRouteParam(params.dayId)}
      tripId={normalizeRouteParam(params.id)}
    />
  );
}
