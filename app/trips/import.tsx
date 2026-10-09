import { useLocalSearchParams } from "expo-router";

import { TripImportScreen } from "@/domains/trips/screens/trip-import/trip-import-screen";

type TripImportRouteParams = {
  createdTripId?: string | string[];
};

function normalizeRouteParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function TripImportRoute() {
  const params = useLocalSearchParams<TripImportRouteParams>();

  return (
    <TripImportScreen
      createdTripId={normalizeRouteParam(params.createdTripId)}
    />
  );
}
