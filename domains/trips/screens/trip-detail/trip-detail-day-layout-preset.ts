import type { TripDetailDayLayoutPresetId } from "@/shared/theme/types";

export type TripDetailDaySheetContentMode = "auto" | "mapPreview" | "timeline";

export type TripDetailDayLayoutPreset = {
  mapLayer: "immersiveBackground" | "headerCard";
  presetId: TripDetailDayLayoutPresetId;
  sheetContentMode: TripDetailDaySheetContentMode;
  timelineDensity: "compact" | "standard";
};

const tripDetailDayLayoutPresets: Record<
  TripDetailDayLayoutPresetId,
  TripDetailDayLayoutPreset
> = {
  compactTimeline: {
    mapLayer: "immersiveBackground",
    presetId: "compactTimeline",
    sheetContentMode: "timeline",
    timelineDensity: "compact",
  },
  immersiveMapSheet: {
    mapLayer: "immersiveBackground",
    presetId: "immersiveMapSheet",
    sheetContentMode: "auto",
    timelineDensity: "standard",
  },
  timelineFirst: {
    mapLayer: "immersiveBackground",
    presetId: "timelineFirst",
    sheetContentMode: "timeline",
    timelineDensity: "standard",
  },
};

export function resolveTripDetailDayLayoutPreset(
  presetId: TripDetailDayLayoutPresetId,
): TripDetailDayLayoutPreset {
  return (
    tripDetailDayLayoutPresets[presetId] ??
    tripDetailDayLayoutPresets.immersiveMapSheet
  );
}
