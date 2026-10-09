export const SKIN_SLOT_IDS = [
  "home.featuredTripCard",
  "home.tripListCard",
  "home.todayPlan",
  "shell.tabBar",
  "profile.profileCard",
  "tripDetail.ledgerPreview",
  "tripDetail.ledgerSheet",
  "tripDetail.checklistPreview",
  "tripDetail.checklistSheet",
  "agent.proposalCard",
  "agent.messageBubble",
] as const;

export type SkinSlotId = (typeof SKIN_SLOT_IDS)[number];

export type SkinSlotAdapterId = string;

export type SkinSlotSurface =
  | "agent"
  | "home"
  | "profile"
  | "shell"
  | "tripDetail";

export type SkinSlotStatus = "ready" | "todo";

export type SkinSlotOverrideSource = "themeDefault" | "userOverride";

export type SkinSlotAdapterDefinition = {
  description: string;
  id: SkinSlotAdapterId;
  status: SkinSlotStatus;
  themeId: string;
  title: string;
};

export type SkinSlotDefinition = {
  adapters: readonly SkinSlotAdapterDefinition[];
  allowUserOverride: boolean;
  defaultAdapterId: SkinSlotAdapterId;
  description: string;
  id: SkinSlotId;
  owner: string;
  status: SkinSlotStatus;
  surface: SkinSlotSurface;
  title: string;
};

export type SkinSlotOverrides = Partial<Record<SkinSlotId, SkinSlotAdapterId>>;

export type ThemeSkinPackConfig = {
  allowedOverrideSlots: readonly SkinSlotId[];
  contributedAdapters: Partial<
    Record<SkinSlotId, readonly SkinSlotAdapterId[]>
  >;
  defaultAdapters: Partial<Record<SkinSlotId, SkinSlotAdapterId>>;
};

export type ResolvedSkinSlot = {
  adapter: SkinSlotAdapterDefinition;
  adapterId: SkinSlotAdapterId;
  allowedAdapterIds: readonly SkinSlotAdapterId[];
  defaultAdapterId: SkinSlotAdapterId;
  definition: SkinSlotDefinition;
  isUserConfigurable: boolean;
  source: SkinSlotOverrideSource;
};

export type ResolvedSkinSlots = Record<SkinSlotId, ResolvedSkinSlot>;
