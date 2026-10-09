import type { AgentConversationLayoutPresetId } from "@/shared/theme/types";

export type AgentConversationLayoutPreset = {
  chatColumnWidth: "standard" | "focused";
  contentGap: number;
  inputDockDensity: "compact" | "standard";
  presetId: AgentConversationLayoutPresetId;
};

const agentConversationLayoutPresets: Record<
  AgentConversationLayoutPresetId,
  AgentConversationLayoutPreset
> = {
  dense: {
    chatColumnWidth: "standard",
    contentGap: 10,
    inputDockDensity: "compact",
    presetId: "dense",
  },
  focused: {
    chatColumnWidth: "focused",
    contentGap: 16,
    inputDockDensity: "standard",
    presetId: "focused",
  },
  standard: {
    chatColumnWidth: "standard",
    contentGap: 14,
    inputDockDensity: "standard",
    presetId: "standard",
  },
};

export function resolveAgentConversationLayoutPreset(
  presetId: AgentConversationLayoutPresetId,
): AgentConversationLayoutPreset {
  return (
    agentConversationLayoutPresets[presetId] ??
    agentConversationLayoutPresets.standard
  );
}
