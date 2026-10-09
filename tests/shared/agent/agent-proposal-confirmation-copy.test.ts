import { strict as assert } from "node:assert";
import test from "node:test";

import type { AgentProposalPreviewItem } from "../../../features/agent";
import { resolveAgentProposalConfirmationCopy } from "../../../shared/agent/agent-proposal-confirmation-copy";

function makePreview(
  action: AgentProposalPreviewItem["action"],
  risk: AgentProposalPreviewItem["risk"],
): AgentProposalPreviewItem[] {
  return [
    {
      action,
      description: "测试操作",
      display: makeDisplay(action),
      impact: ["测试影响"],
      operationId: `op-${action}`,
      risk,
    },
  ];
}

function makeDisplay(
  action: AgentProposalPreviewItem["action"],
): AgentProposalPreviewItem["display"] {
  switch (action) {
    case "add_place_to_day":
      return {
        dayLabel: "第一天",
        kind: action,
        placeName: "测试地点",
      };
    case "ensure_trip_day_count":
      return {
        addedDayLabels: ["第二天"],
        currentDayCount: 1,
        kind: action,
        targetDayCount: 2,
      };
    case "update_day_item":
      return {
        changes: [],
        kind: action,
        targetName: "测试地点",
      };
    case "update_trip_day_title":
      return {
        afterValue: "新标题",
        beforeValue: "旧标题",
        dayLabel: "第一天",
        kind: action,
      };
    case "move_day_item":
      return {
        from: { dayId: "day-1", dayLabel: "第一天", position: 1 },
        kind: action,
        targetName: "测试地点",
        to: { dayId: "day-2", dayLabel: "第二天", position: 1 },
      };
    case "remove_day_item":
      return {
        dayLabel: "第一天",
        kind: action,
        placeImpact: "测试影响",
        targetName: "测试地点",
      };
  }
}

test("resolveAgentProposalConfirmationCopy uses destructive copy for remove proposals", () => {
  assert.deepEqual(
    resolveAgentProposalConfirmationCopy(
      makePreview("remove_day_item", "high"),
    ),
    {
      confirmLabel: "强确认删除",
      description:
        "这次会移除行程安排，不能快捷代办；确认后才会写入本地行程并触发同步。",
    },
  );
});

test("resolveAgentProposalConfirmationCopy names move and update confirmations", () => {
  assert.deepEqual(
    resolveAgentProposalConfirmationCopy(
      makePreview("move_day_item", "medium"),
    ),
    {
      confirmLabel: "强确认调整",
      description:
        "这次会改变地点所在日期或顺序，确认后才会写入本地行程并触发同步。",
    },
  );

  assert.deepEqual(
    resolveAgentProposalConfirmationCopy(makePreview("update_day_item", "low")),
    {
      confirmLabel: "确认更新",
      description:
        "这次会更新地点标题、时间或备注，确认后才会写入本地行程并触发同步。",
    },
  );
});

test("resolveAgentProposalConfirmationCopy requires strong confirmation for a multi-operation proposal", () => {
  assert.deepEqual(
    resolveAgentProposalConfirmationCopy([
      ...makePreview("update_day_item", "low"),
      ...makePreview("update_trip_day_title", "low"),
    ]),
    {
      confirmLabel: "强确认应用",
      description:
        "这张提案会同时修改多处安排，需要强确认后才会一次性写入本地行程。",
    },
  );
});
