import { useLocalSearchParams } from "expo-router";

import { TripNewScreen } from "@/domains/trips/screens/trip-new/trip-new-screen";

type TripNewRouteParams = {
  draftId?: string | string[];
  returnTo?: string | string[];
};

function normalizeRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function TripNewRoute() {
  const params = useLocalSearchParams<TripNewRouteParams>();

  return (
    <TripNewScreen
      draftId={normalizeRouteParam(params.draftId)}
      returnTo={normalizeRouteParam(params.returnTo)}
    />
  );
}
