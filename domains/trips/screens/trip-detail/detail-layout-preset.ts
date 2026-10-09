import type { TripDetailLayoutPresetId } from "@/shared/theme/types";

export type TripDetailOverviewModuleId =
  | "summary"
  | "quickStats"
  | "notebook"
  | "route"
  | "travelInfo";

export type TripDetailOverviewLayout = {
  moduleOrder: TripDetailOverviewModuleId[];
  presetId: TripDetailLayoutPresetId;
};

const TRIP_DETAIL_OVERVIEW_LAYOUT_PRESETS: Record<
  TripDetailLayoutPresetId,
  TripDetailOverviewLayout
> = {
  standard: {
    moduleOrder: ["summary", "quickStats", "notebook", "route", "travelInfo"],
    presetId: "standard",
  },
  itineraryFirst: {
    moduleOrder: ["summary", "route", "quickStats", "notebook", "travelInfo"],
    presetId: "itineraryFirst",
  },
  journalFirst: {
    moduleOrder: ["summary", "notebook", "route", "quickStats", "travelInfo"],
    presetId: "journalFirst",
  },
};

export function resolveTripDetailOverviewLayout(
  presetId: TripDetailLayoutPresetId,
): TripDetailOverviewLayout {
  return (
    TRIP_DETAIL_OVERVIEW_LAYOUT_PRESETS[presetId] ??
    TRIP_DETAIL_OVERVIEW_LAYOUT_PRESETS.standard
  );
}
