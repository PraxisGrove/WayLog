import {
  type AgentConversationOperationReceipt,
  type AgentProposalPreviewItem,
  canQuickDelegateTripEdit,
} from "@/features/agent";

import type { AgentExecutionMode } from "./agent-conversation.types";

export function canAutoApplyAgentPreview(preview: AgentProposalPreviewItem[]) {
  return canQuickDelegateTripEdit(preview);
}

export function createAgentOperationReceipt(
  preview: AgentProposalPreviewItem[],
  tripTitle: string,
): AgentConversationOperationReceipt {
  if (preview.length !== 1) {
    return {
      detail: `已同步到「${tripTitle}」`,
      kind: "operation_receipt",
      title: `已完成 ${preview.length} 项行程调整`,
    };
  }

  const { display } = preview[0];
  switch (display.kind) {
    case "update_day_item":
      return {
        detail: `已同步到「${tripTitle}」`,
        kind: "operation_receipt",
        title: `已更新${display.targetName}${display.changes.length === 1 ? display.changes[0].label : "信息"}`,
      };
    case "move_day_item":
      return {
        detail: display.targetName,
        kind: "operation_receipt",
        title: `已移动到${display.to.dayLabel}第 ${display.to.position} 项`,
      };
    case "remove_day_item":
      return {
        detail: display.dayLabel,
        kind: "operation_receipt",
        title: `已删除${display.targetName}`,
      };
    case "add_place_to_day":
      return {
        detail: display.dayLabel,
        kind: "operation_receipt",
        title: `已加入${display.placeName}`,
      };
    case "update_trip_day_title":
      return {
        detail: display.afterValue,
        kind: "operation_receipt",
        title: `已更新${display.dayLabel}标题`,
      };
    case "ensure_trip_day_count":
      return {
        detail: display.addedDayLabels.join("、"),
        kind: "operation_receipt",
        title: `行程已增加到 ${display.targetDayCount} 天`,
      };
  }
}

export function formatAgentRouteMinutes(durationMinutes: number) {
  if (durationMinutes >= 60) {
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
  }

  return `${durationMinutes}分钟`;
}

export function formatAgentRouteDistance(distanceKm: number) {
  if (distanceKm >= 10) {
    return `${distanceKm.toFixed(distanceKm >= 100 ? 0 : 1)}公里`;
  }

  return `${distanceKm.toFixed(1)}公里`;
}

export function getAgentExecutionModeLabel(mode: AgentExecutionMode) {
  return mode === "auto" ? "快捷代办" : "安心确认";
}
