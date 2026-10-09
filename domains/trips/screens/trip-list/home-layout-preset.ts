import type { HomeLayoutPresetId } from "@/shared/theme/types";

export type TripListHomeModuleId = "featuredTrip" | "todayPlan" | "allTrips";

export type TripListHomeLayout = {
  defaultExpandedModules: TripListHomeModuleId[];
  moduleOrder: TripListHomeModuleId[];
  presetId: HomeLayoutPresetId;
};

const HOME_LAYOUT_PRESETS: Record<HomeLayoutPresetId, TripListHomeLayout> = {
  simpleList: {
    defaultExpandedModules: ["featuredTrip", "todayPlan", "allTrips"],
    moduleOrder: ["featuredTrip", "todayPlan", "allTrips"],
    presetId: "simpleList",
  },
  todayFirst: {
    defaultExpandedModules: ["todayPlan", "featuredTrip", "allTrips"],
    moduleOrder: ["todayPlan", "featuredTrip", "allTrips"],
    presetId: "todayFirst",
  },
  dashboard: {
    defaultExpandedModules: ["todayPlan", "featuredTrip", "allTrips"],
    moduleOrder: ["todayPlan", "featuredTrip", "allTrips"],
    presetId: "dashboard",
  },
};

export function resolveTripListHomeLayout(
  presetId: HomeLayoutPresetId,
): TripListHomeLayout {
  return HOME_LAYOUT_PRESETS[presetId] ?? HOME_LAYOUT_PRESETS.simpleList;
}
