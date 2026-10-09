import type { Dispatch, SetStateAction } from "react";
import type {
  PlaceSearchCenter,
  PlaceSuggestion,
  TripDay,
} from "@/features/trips";
import { PlaceSearchSheet } from "@/shared/places/place-search-sheet";

type PoiSheetsProps = {
  activePlaceSearchCenter?: PlaceSearchCenter;
  activePlaceSearchDay?: TripDay;
  activePlaceSearchRegionText?: string;
  addPlaceToActiveDay: (suggestion: PlaceSuggestion) => void;
  setActivePlaceSearchDayId: Dispatch<SetStateAction<string | undefined>>;
};

export function PoiSheets({
  activePlaceSearchCenter,
  activePlaceSearchDay,
  activePlaceSearchRegionText,
  addPlaceToActiveDay,
  setActivePlaceSearchDayId,
}: PoiSheetsProps) {
  return (
    <PlaceSearchSheet
      dayTitle={activePlaceSearchDay?.title}
      nearbyCenter={activePlaceSearchCenter}
      onClose={() => setActivePlaceSearchDayId(undefined)}
      onSelect={addPlaceToActiveDay}
      regionText={activePlaceSearchRegionText}
      visible={Boolean(activePlaceSearchDay)}
    />
  );
}
