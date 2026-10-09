import assert from "node:assert/strict";
import test from "node:test";

import {
  type AgentTripTargetSummary,
  createAgentTripTargetSummaries,
  resolveAgentTripTarget,
} from "../../../features/agent";

const trips: AgentTripTargetSummary[] = [
  {
    dayCount: 4,
    destination: "云南",
    endDate: "2026-06-23",
    id: "trip-yunnan-4d",
    startDate: "2026-06-20",
    status: "计划中",
    title: "云南四日游",
  },
  {
    dayCount: 3,
    destination: "杭州",
    endDate: "2026-07-03",
    id: "trip-hangzhou-3d",
    startDate: "2026-07-01",
    status: "计划中",
    title: "杭州 3 日",
  },
];

test("resolveAgentTripTarget resolves a named existing trip from a global message", () => {
  const result = resolveAgentTripTarget("把虎跳峡加入云南四日游第四天", trips);

  assert.equal(result.status, "resolved");
  if (result.status !== "resolved") return;
  assert.equal(result.candidate.id, "trip-yunnan-4d");
  assert.deepEqual(result.candidate.matchedText.includes("云南四日游"), true);
});

test("resolveAgentTripTarget can combine destination and day count when the full title is not spoken", () => {
  const result = resolveAgentTripTarget("把白水台加入云南4天的行程", trips);

  assert.equal(result.status, "resolved");
  if (result.status !== "resolved") return;
  assert.equal(result.candidate.id, "trip-yunnan-4d");
});

test("resolveAgentTripTarget matches Chinese and Arabic day count title variants", () => {
  const result = resolveAgentTripTarget("把云南大学加入云南三日第四天", [
    {
      dayCount: 5,
      destination: "云南",
      id: "trip-yunnan-3d",
      status: "计划中",
      title: "云南3日",
    },
  ]);

  assert.equal(result.status, "resolved");
  if (result.status !== "resolved") return;
  assert.equal(result.candidate.id, "trip-yunnan-3d");
});

test("resolveAgentTripTarget resolves a single strong candidate when the spoken trip name has extra suffix text", () => {
  const result = resolveAgentTripTarget(
    "把云南三日游Pro第一天标题改成轻松开始",
    [
      {
        dayCount: 7,
        destination: "云南",
        id: "trip-yunnan-3d",
        status: "旅行中",
        title: "云南3日",
      },
    ],
  );

  assert.equal(result.status, "resolved");
  if (result.status !== "resolved") return;
  assert.equal(result.candidate.id, "trip-yunnan-3d");
});

test("resolveAgentTripTarget asks for confirmation when an extra suffix can match multiple similar trip titles", () => {
  const result = resolveAgentTripTarget(
    "把云南三日游Pro第一天标题改成轻松开始",
    [
      {
        dayCount: 7,
        destination: "云南",
        id: "trip-yunnan-3d",
        status: "旅行中",
        title: "云南3日",
      },
      {
        dayCount: 7,
        destination: "云南",
        id: "trip-yunnan-slow",
        status: "计划中",
        title: "云南三日慢游",
      },
    ],
  );

  assert.equal(result.status, "ambiguous");
  if (result.status !== "ambiguous") return;
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.id),
    ["trip-yunnan-3d", "trip-yunnan-slow"],
  );
});

test("resolveAgentTripTarget asks for confirmation when a spoken title core matches a longer similar trip title", () => {
  const result = resolveAgentTripTarget("把云南三日游第一天标题改成精力充沛", [
    {
      dayCount: 7,
      destination: "昆明市 · 大理白族自治州 · 丽江市",
      id: "trip-yunnan-3d",
      status: "已完成",
      title: "云南3日",
    },
    {
      dayCount: 7,
      destination: undefined,
      id: "trip-yunnan-happy",
      status: "计划中",
      title: "云南三日愉快假期游",
    },
  ]);

  assert.equal(result.status, "ambiguous");
  if (result.status !== "ambiguous") return;
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.id),
    ["trip-yunnan-3d", "trip-yunnan-happy"],
  );
});

test("resolveAgentTripTarget resolves the exact longer trip title before shorter title-core candidates", () => {
  const result = resolveAgentTripTarget(
    "把云南三日愉快假期游第一天标题改成精力充沛",
    [
      {
        dayCount: 7,
        destination: "昆明市 · 大理白族自治州 · 丽江市",
        id: "trip-yunnan-3d",
        status: "已完成",
        title: "云南3日",
      },
      {
        dayCount: 7,
        destination: undefined,
        id: "trip-yunnan-happy",
        status: "计划中",
        title: "云南三日愉快假期游",
      },
    ],
  );

  assert.equal(result.status, "resolved");
  if (result.status !== "resolved") return;
  assert.equal(result.candidate.id, "trip-yunnan-happy");
});

test("resolveAgentTripTarget resolves an exact short title before similar longer titles", () => {
  const result = resolveAgentTripTarget(
    "把云南3日第六天旮旯食堂的备注改成下午早点去",
    [
      {
        dayCount: 7,
        destination: "昆明市 · 大理白族自治州 · 丽江市",
        id: "trip-yunnan-3d",
        status: "已完成",
        title: "云南3日",
      },
      {
        dayCount: 7,
        destination: undefined,
        id: "trip-yunnan-happy",
        status: "计划中",
        title: "云南三日愉快假期游",
      },
    ],
  );

  assert.equal(result.status, "resolved");
  if (result.status !== "resolved") return;
  assert.equal(result.candidate.id, "trip-yunnan-3d");
});

test("resolveAgentTripTarget keeps trip duration separate from explicit target day", () => {
  const result = resolveAgentTripTarget(
    "帮我把云南大学加入到云南3日这个行程的第5天",
    [
      {
        dayCount: 3,
        destination: "云南",
        id: "trip-yunnan-3d",
        status: "计划中",
        title: "云南3日",
      },
    ],
  );

  assert.equal(result.status, "resolved");
  if (result.status !== "resolved") return;
  assert.equal(result.candidate.id, "trip-yunnan-3d");
});

test("resolveAgentTripTarget returns candidates when multiple trips are similarly plausible", () => {
  const result = resolveAgentTripTarget("把虎跳峡加入云南第四天", [
    ...trips,
    {
      dayCount: 4,
      destination: "云南",
      id: "trip-yunnan-summer",
      status: "计划中",
      title: "云南夏季行程",
    },
  ]);

  assert.equal(result.status, "ambiguous");
  if (result.status !== "ambiguous") return;
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.id),
    ["trip-yunnan-4d", "trip-yunnan-summer"],
  );
});

test("resolveAgentTripTarget offers trip candidates for actionable day-only messages", () => {
  const result = resolveAgentTripTarget(
    "帮我把云南师范大学添加到第四天",
    trips,
  );

  assert.equal(result.status, "ambiguous");
  if (result.status !== "ambiguous") return;
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.id),
    ["trip-yunnan-4d"],
  );
});

test("resolveAgentTripTarget offers candidates for day title update messages", () => {
  const result = resolveAgentTripTarget("把第一天标题改成昆明初见", trips);

  assert.equal(result.status, "ambiguous");
  if (result.status !== "ambiguous") return;
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.id),
    ["trip-hangzhou-3d", "trip-yunnan-4d"],
  );
});

test("resolveAgentTripTarget keeps unrelated day-only messages as not found", () => {
  const result = resolveAgentTripTarget("第四天天气怎么样", trips);

  assert.equal(result.status, "not_found");
});

test("resolveAgentTripTarget reports not found for unrelated global messages", () => {
  const result = resolveAgentTripTarget("帮我看看明天天气", trips);

  assert.equal(result.status, "not_found");
});

test("createAgentTripTargetSummaries keeps only the public summary contract", () => {
  const summaries = createAgentTripTargetSummaries([
    {
      dayCount: 5,
      destination: " 丽江 ",
      endDate: "",
      id: "trip-lijiang",
      startDate: "2026-08-01",
      status: "",
      title: "丽江旅行",
    },
  ]);

  assert.deepEqual(summaries, [
    {
      dayCount: 5,
      destination: "丽江",
      endDate: undefined,
      id: "trip-lijiang",
      startDate: "2026-08-01",
      status: undefined,
      title: "丽江旅行",
    },
  ]);
});
