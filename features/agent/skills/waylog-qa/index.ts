import {
  resolveTripDayTitle,
  type Trip,
  type TripExpenseCategory,
} from "../../../trips";

import type {
  AgentSkillDefinition,
  AgentSkillResult,
  AgentSkillRunContext,
  AgentSkillRunResult,
} from "../../skill-types";
import { createAgentSkillError } from "../../skill-types";
import type { AgentTraceEvent } from "../../trace";

export type WaylogQaSkillInput = {
  userMessage?: string;
};

export { createWaylogQaContext } from "./context";

export const waylogQaSkill: AgentSkillDefinition<unknown> = {
  allowedInternalActions: ["get_trip_context"],
  allowedRuntimeTools: [
    "poi.search",
    "weather.get",
    "route.estimate",
    "web.search",
  ],
  allowedTools: ["get_trip_context"],
  description:
    "只读回答 WayLog 业务范围内的问题，包括当前 Trip 安排、预算、清单、备忘，以及旅行规划和 WayLog 使用帮助。不创建 Trip、不修改行程、不生成写入提案。",
  id: "waylog.qa",
  maxToolCalls: 2,
  output: "answer",
  routeMetadata: {
    description:
      "Answer read-only WayLog, travel planning, POI, and current Trip questions without creating or editing Trips.",
    name: "waylog.qa",
    requiredContext: [],
    routeType: "waylog_qa",
    tags: ["waylog-qa", "read-only", "trip-question", "travel-question"],
  },
  risk: "low",
  triggerExamples: [
    "这个行程预算是多少？",
    "这个行程怎么安排？",
    "西湖适合放进这趟旅行吗？",
    "WayLog 的 Agent 提案怎么确认？",
  ],
  run: runWaylogQaSkill,
};

export type AgentWaylogQaResult = {
  mode: "waylog_qa";
  provider: "local";
  reply: string;
  trace: AgentTraceEvent[];
};

export function answerWaylogQa(input: {
  trip: Trip;
  userMessage: string;
}): AgentWaylogQaResult {
  const question = input.userMessage.trim();
  const trace: AgentTraceEvent[] = [
    {
      detail: `${input.trip.days.length} 天，${input.trip.expenses.length} 条费用，${input.trip.checklistItems.length} 个清单项`,
      kind: "trip_context",
      label: "读取行程上下文",
      status: "completed",
    },
  ];

  if (isBudgetQuestion(question)) {
    return {
      mode: "waylog_qa",
      provider: "local",
      reply: createBudgetAnswer(input.trip),
      trace,
    };
  }

  return {
    mode: "waylog_qa",
    provider: "local",
    reply: createScheduleAnswer(input.trip),
    trace,
  };
}

function runWaylogQaSkill(
  rawInput: unknown,
  context: AgentSkillRunContext,
): AgentSkillResult<AgentSkillRunResult> {
  const userMessage = readUserMessage(rawInput) ?? context.userMessage;

  if (!userMessage) {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      "waylog.qa 需要 userMessage",
    );
  }

  context.emit?.({
    text: "正在读取 WayLog 只读上下文",
    type: "status",
  });

  const result = answerWaylogQa({
    trip: context.trip,
    userMessage,
  });

  return {
    ok: true,
    data: {
      answer: result.reply,
      events: [],
      kind: "answer",
    },
  };
}

function readUserMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const message = (value as { userMessage?: unknown }).userMessage;

    return typeof message === "string" && message.trim()
      ? message.trim()
      : undefined;
  }

  return undefined;
}

function isBudgetQuestion(value: string) {
  return /预算|费用|花费|多少钱|成本|消费|支出|budget|cost|expense/i.test(
    value,
  );
}

function createBudgetAnswer(trip: Trip) {
  const total = trip.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const currency = trip.expenses[0]?.currency ?? trip.currency;
  const byCategory = groupExpensesByCategory(trip);
  const categoryText = Object.entries(byCategory)
    .sort((left, right) => right[1] - left[1])
    .map(
      ([category, amount]) => `${category} ${formatAmount(amount)} ${currency}`,
    )
    .join("，");
  const budgetText = trip.budget?.amount
    ? `设置预算 ${formatAmount(trip.budget.amount)} ${trip.budget.currency}。`
    : "还没有设置总预算。";

  return [
    `${trip.title} 已记录费用约 ${formatAmount(total)} ${currency}。`,
    categoryText ? `分类里，${categoryText}。` : "目前还没有费用分类明细。",
    budgetText,
  ].join("");
}

function createScheduleAnswer(trip: Trip) {
  const dayLines = trip.days.map((day) => {
    const items = day.items
      .map((item) => item.placeName ?? item.title)
      .filter(Boolean)
      .slice(0, 4)
      .join("、");

    return `${resolveTripDayTitle(day)}：${items || "还没有安排地点"}`;
  });
  const memoText = trip.memos.length
    ? ` 另外有 ${trip.memos.length} 条备忘，${trip.checklistItems.length} 个清单项。`
    : trip.checklistItems.length
      ? ` 另外有 ${trip.checklistItems.length} 个清单项。`
      : "";

  return `${trip.title} 目前是 ${trip.days.length} 天行程。${dayLines.join("；")}。${memoText}`;
}

function groupExpensesByCategory(
  trip: Trip,
): Partial<Record<TripExpenseCategory, number>> {
  return trip.expenses.reduce<Partial<Record<TripExpenseCategory, number>>>(
    (groups, expense) => {
      groups[expense.category] =
        (groups[expense.category] ?? 0) + expense.amount;

      return groups;
    },
    {},
  );
}

function formatAmount(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
