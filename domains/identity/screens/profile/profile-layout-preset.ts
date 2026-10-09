import type { ProfileLayoutPresetId } from "@/shared/theme/types";

export type ProfileQuickActionDensity = "compact" | "standard";
export type ProfileHeroTreatment = "compact" | "standard" | "featured";

export type ProfileLayoutPreset = {
  heroTreatment: ProfileHeroTreatment;
  loginPanelPlacement: "afterHero" | "top";
  presetId: ProfileLayoutPresetId;
  quickActionDensity: ProfileQuickActionDensity;
};

const profileLayoutPresets: Record<ProfileLayoutPresetId, ProfileLayoutPreset> =
  {
    compact: {
      heroTreatment: "compact",
      loginPanelPlacement: "top",
      presetId: "compact",
      quickActionDensity: "compact",
    },
    heroFirst: {
      heroTreatment: "featured",
      loginPanelPlacement: "afterHero",
      presetId: "heroFirst",
      quickActionDensity: "standard",
    },
    standard: {
      heroTreatment: "standard",
      loginPanelPlacement: "afterHero",
      presetId: "standard",
      quickActionDensity: "standard",
    },
  };

export function resolveProfileLayoutPreset(
  presetId: ProfileLayoutPresetId,
): ProfileLayoutPreset {
  return profileLayoutPresets[presetId] ?? profileLayoutPresets.standard;
}
