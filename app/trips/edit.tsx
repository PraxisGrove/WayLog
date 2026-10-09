import { useLocalSearchParams } from "expo-router";

import { TripEditScreen } from "@/domains/trips/screens/trip-edit/trip-edit-screen";

type TripEditRouteParams = {
  id?: string | string[];
};

function normalizeRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function TripEditRoute() {
  const params = useLocalSearchParams<TripEditRouteParams>();

  return <TripEditScreen tripId={normalizeRouteParam(params.id)} />;
}
