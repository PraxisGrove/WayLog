import { DEFAULT_CLASSIC_PALETTE_ID } from "../palettes/classic-palettes";
import { skinSlotAdapterIds } from "../skin-slot-registry";
import type { ThemeDefinition } from "../types";

export const defaultThemeDefinition: ThemeDefinition = {
  access: "free",
  agent: {
    conversationLayoutPreset: "standard",
  },
  defaultClassicPaletteId: DEFAULT_CLASSIC_PALETTE_ID,
  defaultHomeLayoutPreset: "simpleList",
  description: "极简无装饰骨架，用来直接打磨未来正式默认皮肤。",
  detail: {
    dayLayoutPreset: "immersiveMapSheet",
    layoutPreset: "standard",
  },
  displayName: "默认模式",
  family: "waylog",
  id: "default",
  profile: {
    layoutPreset: "standard",
  },
  shell: {
    primaryActionPlacement: "bottomRight",
    tabBarPreset: "rightFab",
  },
  skin: {
    allowedOverrideSlots: [
      "home.featuredTripCard",
      "home.tripListCard",
      "home.todayPlan",
      "shell.tabBar",
      "profile.profileCard",
      "tripDetail.ledgerPreview",
      "tripDetail.checklistPreview",
      "agent.proposalCard",
      "agent.messageBubble",
    ],
    contributedAdapters: {
      "agent.messageBubble": [skinSlotAdapterIds.agentMessageBubble.default],
      "agent.proposalCard": [skinSlotAdapterIds.agentProposalCard.default],
      "home.featuredTripCard": [
        skinSlotAdapterIds.homeFeaturedTripCard.default,
      ],
      "home.todayPlan": [skinSlotAdapterIds.homeTodayPlan.default],
      "home.tripListCard": [skinSlotAdapterIds.homeTripListCard.default],
      "profile.profileCard": [skinSlotAdapterIds.profileProfileCard.default],
      "shell.tabBar": [skinSlotAdapterIds.shellTabBar.default],
      "tripDetail.checklistPreview": [
        skinSlotAdapterIds.tripDetailChecklistPreview.default,
      ],
      "tripDetail.ledgerPreview": [
        skinSlotAdapterIds.tripDetailLedgerPreview.default,
      ],
    },
    defaultAdapters: {
      "agent.messageBubble": skinSlotAdapterIds.agentMessageBubble.default,
      "agent.proposalCard": skinSlotAdapterIds.agentProposalCard.default,
      "home.featuredTripCard": skinSlotAdapterIds.homeFeaturedTripCard.default,
      "home.todayPlan": skinSlotAdapterIds.homeTodayPlan.default,
      "home.tripListCard": skinSlotAdapterIds.homeTripListCard.default,
      "profile.profileCard": skinSlotAdapterIds.profileProfileCard.default,
      "shell.tabBar": skinSlotAdapterIds.shellTabBar.default,
      "tripDetail.checklistPreview":
        skinSlotAdapterIds.tripDetailChecklistPreview.default,
      "tripDetail.ledgerPreview":
        skinSlotAdapterIds.tripDetailLedgerPreview.default,
    },
  },
  tripForm: {
    layoutPreset: "standard",
  },
};
