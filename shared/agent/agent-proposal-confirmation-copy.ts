import { requiresStrongTripEditConfirmation } from "../../features/agent/approval/trip-edit-approval-gate";
import type { AgentProposalPreviewItem } from "../../features/agent/types";

export function resolveAgentProposalConfirmationCopy(
  preview: AgentProposalPreviewItem[],
): {
  confirmLabel: string;
  description: string;
} {
  if (preview.some((item) => item.action === "remove_day_item")) {
    return {
      confirmLabel: "强确认删除",
      description:
        "这次会移除行程安排，不能快捷代办；确认后才会写入本地行程并触发同步。",
    };
  }

  if (preview.some((item) => item.action === "move_day_item")) {
    return {
      confirmLabel: "强确认调整",
      description:
        "这次会改变地点所在日期或顺序，确认后才会写入本地行程并触发同步。",
    };
  }

  if (preview.some((item) => item.action === "update_day_item")) {
    if (requiresStrongTripEditConfirmation(preview)) {
      return {
        confirmLabel: "强确认应用",
        description:
          "这张提案会同时修改多处安排，需要强确认后才会一次性写入本地行程。",
      };
    }
    return {
      confirmLabel: "确认更新",
      description:
        "这次会更新地点标题、时间或备注，确认后才会写入本地行程并触发同步。",
    };
  }

  if (requiresStrongTripEditConfirmation(preview)) {
    return {
      confirmLabel: "强确认应用",
      description:
        "这张提案影响多处或包含中高风险操作，需要强确认后才会一次性写入本地行程。",
    };
  }

  return {
    confirmLabel: "确认应用",
    description: "我只会在你确认后写入本地行程并触发同步。",
  };
}
