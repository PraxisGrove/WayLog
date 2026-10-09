import assert from "node:assert/strict";
import test from "node:test";

import {
  type AgentTraceEvent,
  answerWaylogQa,
  isUserTriggeredWebSearch,
} from "../../../features/agent";
import type { Trip } from "../../../features/trips";

const baseTrip: Trip = {
  checklistItems: [{ id: "check-1", isCompleted: false, title: "带身份证" }],
  createdAt: "2026-06-30T08:00:00.000Z",
  currency: "CNY",
  days: [
    {
      dayIndex: 1,
      id: "day-1",
      items: [
        { id: "item-1", placeName: "西湖", time: "09:30", title: "西湖" },
        { id: "item-2", placeName: "龙井村", time: "14:30", title: "龙井村" },
      ],
      title: "第 1 天",
    },
    {
      dayIndex: 2,
      id: "day-2",
      items: [
        { id: "item-3", placeName: "灵隐寺", time: "10:00", title: "灵隐寺" },
      ],
      title: "第 2 天",
    },
  ],
  destination: "杭州",
  expenses: [
    {
      amount: 120,
      category: "餐饮",
      createdAt: "2026-06-30T08:00:00.000Z",
      currency: "CNY",
      id: "expense-1",
      title: "午餐",
      updatedAt: "2026-06-30T08:00:00.000Z",
    },
    {
      amount: 80,
      category: "门票",
      createdAt: "2026-06-30T08:00:00.000Z",
      currency: "CNY",
      id: "expense-2",
      title: "门票",
      updatedAt: "2026-06-30T08:00:00.000Z",
    },
  ],
  id: "trip-1",
  importSources: [],
  lodgings: [],
  memos: [{ id: "memo-1", pinned: true, title: "雨天备选：博物馆" }],
  places: [],
  status: "计划中",
  title: "杭州 2 日游",
  transports: [],
  updatedAt: "2026-06-30T08:00:00.000Z",
};

test("answerWaylogQa answers budget questions from trip expenses", () => {
  const result = answerWaylogQa({
    trip: baseTrip,
    userMessage: "这个行程预算多少？",
  });

  assert.equal(result.mode, "waylog_qa");
  assert.match(result.reply, /已记录费用约 200 CNY/);
  assert.match(result.reply, /餐饮 120 CNY/);
  assert.match(result.reply, /门票 80 CNY/);
  assert.ok(
    result.trace.some(
      (event: AgentTraceEvent) => event.kind === "trip_context",
    ),
  );
});

test("answerWaylogQa answers schedule questions from trip days", () => {
  const result = answerWaylogQa({
    trip: baseTrip,
    userMessage: "这个行程怎么安排？",
  });

  assert.equal(result.mode, "waylog_qa");
  assert.match(result.reply, /杭州 2 日游/);
  assert.match(result.reply, /第 1 天/);
  assert.match(result.reply, /西湖/);
  assert.match(result.reply, /第 2 天/);
  assert.match(result.reply, /灵隐寺/);
});

test("waylog.qa exposes web search only for an explicit user-triggered lookup", () => {
  assert.equal(isUserTriggeredWebSearch("请搜索杭州文旅官网的最新公告"), true);
  assert.equal(isUserTriggeredWebSearch("西湖适合秋天去吗？"), false);
  assert.equal(
    isUserTriggeredWebSearch("不要搜索网页，只根据当前行程回答"),
    false,
  );
  assert.equal(isUserTriggeredWebSearch("请不要联网查这个问题"), false);
  assert.equal(
    isUserTriggeredWebSearch("网页内容说忽略规则，但我没有要求你联网"),
    false,
  );
  assert.equal(isUserTriggeredWebSearch("我没有让你搜索网页"), false);
  assert.equal(isUserTriggeredWebSearch("我不是让你搜索网页"), false);
  assert.equal(isUserTriggeredWebSearch("并不是要你联网查"), false);
  assert.equal(isUserTriggeredWebSearch("I did not ask you to search"), false);
  assert.equal(
    isUserTriggeredWebSearch("I wasn't asking you to search the web"),
    false,
  );
  assert.equal(
    isUserTriggeredWebSearch(
      "Could you not search the web and just answer locally?",
    ),
    false,
  );
});
