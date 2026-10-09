import type { TripFormLayoutPresetId } from "@/shared/theme/types";

export type TripFormLayoutPreset = {
  cardDensity: "compact" | "standard";
  contentGap: number;
  presetId: TripFormLayoutPresetId;
  sectionGap: number;
};

const tripFormLayoutPresets: Record<
  TripFormLayoutPresetId,
  TripFormLayoutPreset
> = {
  compact: {
    cardDensity: "compact",
    contentGap: 14,
    presetId: "compact",
    sectionGap: 12,
  },
  guided: {
    cardDensity: "standard",
    contentGap: 18,
    presetId: "guided",
    sectionGap: 16,
  },
  standard: {
    cardDensity: "standard",
    contentGap: 16,
    presetId: "standard",
    sectionGap: 16,
  },
};

export function resolveTripFormLayoutPreset(
  presetId: TripFormLayoutPresetId,
): TripFormLayoutPreset {
  return tripFormLayoutPresets[presetId] ?? tripFormLayoutPresets.standard;
}
