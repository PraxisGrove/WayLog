import { DEFAULT_CLASSIC_PALETTE_ID } from "../palettes/classic-palettes";
import { skinSlotAdapterIds } from "../skin-slot-registry";
import type { ThemeDefinition } from "../types";

export const classicThemeDefinition: ThemeDefinition = {
  access: "free",
  agent: {
    conversationLayoutPreset: "standard",
  },
  defaultClassicPaletteId: DEFAULT_CLASSIC_PALETTE_ID,
  defaultHomeLayoutPreset: "simpleList",
  description: "保留当前白底、浅灰、基础卡片和多色调色板的简洁模式。",
  detail: {
    dayLayoutPreset: "immersiveMapSheet",
    layoutPreset: "standard",
  },
  displayName: "简洁模式",
  family: "classic",
  id: "classic",
  profile: {
    layoutPreset: "standard",
  },
  shell: {
    primaryActionPlacement: "center",
    tabBarPreset: "centerAdd",
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
      "agent.messageBubble": [skinSlotAdapterIds.agentMessageBubble.classic],
      "agent.proposalCard": [skinSlotAdapterIds.agentProposalCard.classic],
      "home.featuredTripCard": [
        skinSlotAdapterIds.homeFeaturedTripCard.classic,
      ],
      "home.todayPlan": [skinSlotAdapterIds.homeTodayPlan.classic],
      "home.tripListCard": [skinSlotAdapterIds.homeTripListCard.classic],
      "profile.profileCard": [skinSlotAdapterIds.profileProfileCard.classic],
      "shell.tabBar": [skinSlotAdapterIds.shellTabBar.classic],
      "tripDetail.checklistPreview": [
        skinSlotAdapterIds.tripDetailChecklistPreview.classic,
      ],
      "tripDetail.ledgerPreview": [
        skinSlotAdapterIds.tripDetailLedgerPreview.classic,
      ],
    },
    defaultAdapters: {
      "agent.messageBubble": skinSlotAdapterIds.agentMessageBubble.classic,
      "agent.proposalCard": skinSlotAdapterIds.agentProposalCard.classic,
      "home.featuredTripCard": skinSlotAdapterIds.homeFeaturedTripCard.classic,
      "home.todayPlan": skinSlotAdapterIds.homeTodayPlan.classic,
      "home.tripListCard": skinSlotAdapterIds.homeTripListCard.classic,
      "profile.profileCard": skinSlotAdapterIds.profileProfileCard.classic,
      "shell.tabBar": skinSlotAdapterIds.shellTabBar.classic,
      "tripDetail.checklistPreview":
        skinSlotAdapterIds.tripDetailChecklistPreview.classic,
      "tripDetail.ledgerPreview":
        skinSlotAdapterIds.tripDetailLedgerPreview.classic,
    },
  },
  tripForm: {
    layoutPreset: "standard",
  },
};
