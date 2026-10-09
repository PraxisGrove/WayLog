import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  type AgentConversationStorage,
  beginAgentRuntimeAttempt,
  getAgentConversation,
  isTripDraftPoiGeographicallyConsistent,
  listRouteVisibleAgentSkills,
  resumeProposalGeneration,
  resumeTripDraftProposalGeneration,
  retryProposalGeneration,
  runProposalGeneration,
} from "../../../features/agent";
import type { WayLogPiAgentOptions } from "../../../features/agent/pi-runtime";
import type { Trip } from "../../../features/trips/types";

type StreamFn = WayLogPiAgentOptions["streamFn"];
type StreamContext = Parameters<StreamFn>[1];

const EMPTY_USAGE = {
  cacheRead: 0,
  cacheWrite: 0,
  cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0 },
  input: 0,
  output: 0,
  totalTokens: 0,
};

test("trip.draft rejects a verified identity from the wrong geography", () => {
  const semantics = {
    cities: ["昆明"],
    companions: [],
    confidence: 0.95,
    dateExpression: null,
    dateResolution: { kind: "none" as const },
    dayCount: 3,
    destination: "云南",
    missingFields: [],
    preferences: [],
    resolvedDateRange: null,
    semanticTitle: "云南三日游",
  };

  assert.equal(
    isTripDraftPoiGeographicallyConsistent(
      { area: "杭州市", provider: "amap", providerPlaceId: "B0HANGZHOU" },
      "杭州 西湖",
      semantics,
    ),
    false,
  );
  assert.equal(
    isTripDraftPoiGeographicallyConsistent(
      { area: "昆明市", provider: "amap", providerPlaceId: "B0KUNMING" },
      "云南 昆明 石林",
      semantics,
    ),
    true,
  );
  assert.equal(
    isTripDraftPoiGeographicallyConsistent(
      {
        city: "丽江市",
        area: "云南省 · 丽江市 · 古城区",
        providerPlaceId: "B0LIJIANG",
      },
      "云南 景点",
      { ...semantics, cities: [] },
    ),
    true,
  );
  assert.equal(
    isTripDraftPoiGeographicallyConsistent(
      { city: "杭州市", area: "西湖区", providerPlaceId: "B0HANGZHOU" },
      "云南 景点",
      { ...semantics, cities: [] },
    ),
    false,
  );
  assert.equal(
    isTripDraftPoiGeographicallyConsistent(
      {
        city: "丽江市",
        area: "云南省 · 丽江市 · 古城区",
        providerPlaceId: "B0LIJIANG",
      },
      "云南 景点",
      { ...semantics, cities: ["云南"] },
    ),
    true,
  );
  assert.equal(
    isTripDraftPoiGeographicallyConsistent(
      {
        city: "成都市",
        area: "四川省 · 成都市 · 青羊区",
        providerPlaceId: "B0CHENGDU",
      },
      "四川 景点",
      { ...semantics, cities: [], destination: "四川" },
    ),
    true,
  );
  assert.equal(
    isTripDraftPoiGeographicallyConsistent(
      {
        address: "东京都千代田区",
        city: "东京都",
        provider: "amap",
        providerPlaceId: "B0TOKYO",
      },
      "Tokyo Imperial Palace",
      { ...semantics, cities: ["Tokyo"], destination: "Tokyo" },
    ),
    true,
  );
});

function createMemoryStorage(): AgentConversationStorage & {
  values: Map<string, string>;
} {
  const values = new Map<string, string>();

  return {
    values,
    getAllKeys: async () => [...values.keys()],
    getItem: async (key) => values.get(key) ?? null,
    removeItem: async (key) => {
      values.delete(key);
    },
    setItem: async (key, value) => {
      values.set(key, value);
    },
  };
}

test("live RouteSelector eval uses the same compact Skill metadata as production", () => {
  const evalSkills = JSON.parse(
    readFileSync("scripts/fixtures/agent-route-skills.json", "utf8"),
  );

  assert.deepEqual(evalSkills, listRouteVisibleAgentSkills());
});

function createSelectedTrip(): Trip {
  return {
    checklistItems: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    currency: "CNY",
    days: [
      {
        dayIndex: 1,
        id: "day-1",
        items: [
          {
            category: "景点",
            id: "item-west-lake",
            placeId: "place-west-lake",
            placeName: "西湖",
            title: "西湖",
          },
        ],
        title: "第一天",
      },
    ],
    destination: "杭州",
    expenses: [],
    id: "trip-hangzhou",
    importSources: [],
    lodgings: [],
    memos: [],
    places: [
      {
        category: "景点",
        id: "place-west-lake",
        isScheduled: true,
        latitude: 30.25,
        longitude: 120.15,
        name: "西湖",
        provider: "amap",
        providerPlaceId: "B0WESTLAKE001",
      },
    ],
    status: "计划中",
    title: "杭州一日游",
    transports: [],
    updatedAt: "2026-06-01T10:00:00.000Z",
  };
}

function terminatingStream(toolName: string, args: Record<string, unknown>) {
  const message = {
    api: "waylog-proxy",
    content: [
      {
        arguments: args,
        id: `${toolName}-call`,
        name: toolName,
        type: "toolCall" as const,
      },
    ],
    model: "controlled-model",
    provider: "waylog",
    role: "assistant" as const,
    stopReason: "toolUse" as const,
    timestamp: Date.parse("2026-08-29T08:00:00.000Z"),
    usage: EMPTY_USAGE,
  };
  const events = [
    { partial: { ...message, content: [] }, type: "start" as const },
    { partial: message, type: "toolcall_end" as const },
    { message, reason: "toolUse" as const, type: "done" as const },
  ];

  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) yield event;
    },
    result: async () => message,
  };
}

function stoppedStream() {
  const message = {
    api: "waylog-proxy",
    content: [],
    model: "controlled-model",
    provider: "waylog",
    role: "assistant" as const,
    stopReason: "stop" as const,
    timestamp: Date.parse("2026-08-29T08:00:00.000Z"),
    usage: EMPTY_USAGE,
  };

  return {
    async *[Symbol.asyncIterator]() {
      yield { partial: message, type: "start" as const };
      yield { message, reason: "stop" as const, type: "done" as const };
    },
    result: async () => message,
  };
}

test("proposal generation routes free text before running only the selected Skill", async () => {
  const storage = createMemoryStorage();
  const observedContexts: Array<{ phase: string; value: unknown }> = [];
  const selectedTrip = createSelectedTrip();
  const result = await runProposalGeneration(
    {
      accountId: "account-a",
      conversationId: "conversation-routing",
      pageContext: { hasSelectedTrip: true, surface: "agent_conversation" },
      selectedTrip,
      userMessage: "WayLog 的 Agent 提案为什么需要确认？",
    },
    {
      clock: () => "2026-08-29T08:00:00.000Z",
      ids: { turn: () => "turn-routing" },
      routeModel: (_model: Parameters<StreamFn>[0], context: StreamContext) => {
        observedContexts.push({ phase: "route", value: context });
        return terminatingStream("waylog_route", {
          route: {
            confidence: 0.98,
            missingSlots: [],
            routeKind: "skill",
            scope: "in_scope",
            skillId: "waylog.qa",
          },
        }) as never;
      },
      skillModel: (_model: Parameters<StreamFn>[0], context: StreamContext) => {
        observedContexts.push({ phase: "skill", value: context });
        return terminatingStream("waylog_answer", {
          answer: { text: "因为真实 Trip 写入必须由你确认。" },
        }) as never;
      },
      storage,
      tools: [],
    },
  );

  assert.equal(result.resultType, "answer");
  if (result.resultType !== "answer") return;
  assert.equal(result.route.scope, "in_scope");
  assert.equal(result.route.skillId, "waylog.qa");
  assert.deepEqual(
    observedContexts.map(({ phase, value }) => ({
      phase,
      toolNames: (value as { tools?: Array<{ name: string }> }).tools?.map(
        (tool) => tool.name,
      ),
    })),
    [
      { phase: "route", toolNames: ["waylog_route"] },
      { phase: "skill", toolNames: ["waylog_answer"] },
    ],
  );

  const routeContext = JSON.stringify(observedContexts[0]?.value);
  const skillContext = JSON.stringify(observedContexts[1]?.value);
  assert.equal(routeContext.includes("waylog.qa"), true);
  assert.equal(routeContext.includes("expectedUpdatedAt"), false);
  assert.equal(routeContext.includes("selectedTrip.full"), true);
  assert.equal(routeContext.includes(selectedTrip.id), false);
  assert.equal(skillContext.includes("trip.draft"), false);
  assert.equal(skillContext.includes("itinerary.edit"), false);
  assert.equal(skillContext.includes("untrusted_trip_data"), true);
  assert.equal(skillContext.includes(selectedTrip.title), true);
  assert.equal(skillContext.includes(selectedTrip.id), false);
  assert.equal(skillContext.includes(selectedTrip.updatedAt), false);
});

test("proposal generation runs trip.draft as a second Pi run and returns a confirmable draft", async () => {
  const observedContexts: Array<{ phase: string; value: StreamContext }> = [];
  let skillCall = 0;
  const result = await runProposalGeneration(
    {
      accountId: "account-trip-draft",
      userMessage: "帮我规划下周去云南三日游",
    },
    {
      clock: () => "2026-08-29T08:00:00.000Z",
      ids: { turn: () => "turn-trip-draft" },
      routeModel: (_model, context) => {
        observedContexts.push({ phase: "route", value: context });
        return terminatingStream("waylog_route", {
          route: {
            confidence: 0.99,
            missingSlots: [],
            routeKind: "skill",
            scope: "in_scope",
            skillId: "trip.draft",
          },
        }) as never;
      },
      skillModel: (_model, context) => {
        observedContexts.push({ phase: "skill", value: context });
        skillCall += 1;
        if (skillCall === 1) {
          return terminatingStream("poi.search", {
            query: "云南 石林",
          }) as never;
        }
        return terminatingStream("waylog_trip_draft", {
          result: {
            draft: {
              assumptions: ["按轻松节奏安排"],
              createdAt: "2026-08-29T08:00:00.000Z",
              dayCount: 3,
              days: [
                {
                  dayIndex: 1,
                  items: [
                    {
                      placeName: "石林风景区",
                      provider: "amap",
                      providerPlaceId: "B0YUNNAN001",
                      title: "石林风景区",
                    },
                  ],
                  title: "抵达昆明",
                },
                { dayIndex: 2, items: [], title: "昆明慢游" },
                { dayIndex: 3, items: [], title: "返程" },
              ],
              destination: "云南",
              draftId: "draft-yunnan-3d",
              title: "云南三日游",
              updatedAt: "2026-08-29T08:00:00.000Z",
              warnings: [],
            },
            kind: "trip_draft",
            semantics: {
              cities: ["昆明", "大理"],
              companions: [],
              confidence: 0.97,
              dateExpression: "下周",
              dateResolution: { kind: "next_week" },
              dayCount: 3,
              destination: "云南",
              missingFields: [],
              preferences: ["轻松节奏"],
              semanticTitle: "云南三日游",
            },
          },
        }) as never;
      },
      storage: createMemoryStorage(),
      tools: [
        {
          id: "poi.search",
          publicName: "搜索真实地点",
          tool: {
            description: "搜索并核验真实地点",
            execute: async () => {
              const candidates = [
                {
                  area: "昆明市",
                  name: "石林风景区",
                  provider: "amap",
                  providerPlaceId: "B0YUNNAN001",
                },
              ];
              return {
                content: [
                  {
                    text: JSON.stringify({
                      data: { candidates },
                      kind: "untrusted_tool_data",
                      sourceReferences: [
                        {
                          platform: "高德地图",
                          retrievedAt: "2026-08-29T08:00:00.000Z",
                          title: "灵隐寺",
                        },
                      ],
                      toolName: "poi.search",
                    }),
                    type: "text",
                  },
                ],
                details: {
                  publicSummary: "找到 1 个地点候选",
                  sourceReferences: [
                    {
                      platform: "高德地图",
                      retrievedAt: "2026-08-29T08:00:00.000Z",
                      title: "灵隐寺",
                    },
                  ],
                },
              };
            },
            label: "搜索真实地点",
            name: "poi.search",
            parameters: {
              additionalProperties: false,
              properties: { query: { minLength: 1, type: "string" } },
              required: ["query"],
              type: "object",
            },
          },
        },
      ],
    },
  );

  assert.equal(result.resultType, "trip_draft");
  if (result.resultType !== "trip_draft") return;
  assert.equal(result.draft.destination, "云南");
  assert.equal(result.draft.dayCount, 3);
  assert.deepEqual(
    observedContexts.map(({ phase, value }) => ({
      phase,
      toolNames: value.tools?.map((tool) => tool.name),
    })),
    [
      { phase: "route", toolNames: ["waylog_route"] },
      {
        phase: "skill",
        toolNames: ["poi.search", "waylog_trip_draft"],
      },
      {
        phase: "skill",
        toolNames: ["poi.search", "waylog_trip_draft"],
      },
    ],
  );
});

test("proposal generation rejects model-invented places from selected Skills", async () => {
  const selectedTrip = createSelectedTrip();
  const cases = [
    {
      routeSkillId: "trip.draft" as const,
      skillToolName: "waylog_trip_draft",
      skillToolArguments: {
        result: {
          draft: {
            assumptions: [],
            createdAt: "2026-08-29T08:00:00.000Z",
            dayCount: 1,
            days: [
              {
                dayIndex: 1,
                items: [
                  {
                    provider: "amap",
                    providerPlaceId: "invented-poi-id",
                    title: "模型虚构地点",
                  },
                ],
                title: "第一天",
              },
            ],
            destination: "杭州",
            draftId: "unsafe-draft",
            title: "不安全草案",
            updatedAt: "2026-08-29T08:00:00.000Z",
            warnings: [],
          },
          kind: "trip_draft",
          semantics: {
            cities: ["杭州"],
            companions: [],
            confidence: 0.9,
            dateExpression: null,
            dateResolution: { kind: "none" },
            dayCount: 1,
            destination: "杭州",
            missingFields: [],
            preferences: [],
            semanticTitle: "杭州一日游",
          },
        },
      },
      userMessage: "帮我规划杭州一日游",
    },
    {
      routeSkillId: "itinerary.edit" as const,
      skillToolName: "waylog_trip_edit_proposal",
      skillToolArguments: {
        proposal: {
          expectedUpdatedAt: selectedTrip.updatedAt,
          operations: [
            {
              dayId: "day-1",
              operationId: "unsafe-add-operation",
              place: {
                name: "模型虚构地点",
                provider: "amap",
                providerPlaceId: "invented-poi-id",
              },
              tripId: selectedTrip.id,
              type: "add_place_to_day",
            },
          ],
          proposalId: "unsafe-add-proposal",
          summary: "添加未经核验的地点",
          tripId: selectedTrip.id,
        },
      },
      userMessage: "把一个新地点加到第一天",
    },
  ];

  for (const fixture of cases) {
    let skillCallCount = 0;
    const result = await runProposalGeneration(
      {
        accountId: `account-${fixture.routeSkillId}`,
        selectedTrip:
          fixture.routeSkillId === "itinerary.edit" ? selectedTrip : undefined,
        userMessage: fixture.userMessage,
      },
      {
        clock: () => "2026-08-29T08:00:00.000Z",
        routeModel: () =>
          terminatingStream("waylog_route", {
            route: {
              confidence: 0.99,
              missingSlots: [],
              routeKind: "skill",
              scope: "in_scope",
              skillId: fixture.routeSkillId,
            },
          }) as never,
        skillModel: () => {
          skillCallCount += 1;
          return (
            skillCallCount === 1
              ? terminatingStream(
                  fixture.skillToolName,
                  fixture.skillToolArguments,
                )
              : stoppedStream()
          ) as never;
        },
        storage: createMemoryStorage(),
        tools: [],
      },
    );

    assert.equal(result.resultType, "failure");
    if (result.resultType !== "failure") continue;
    assert.equal(result.retryable, true);
    assert.equal(result.userMessage, fixture.userMessage);
  }
});

test("trip.draft tool failure preserves the original input and cannot produce a plausible place", async () => {
  const storage = createMemoryStorage();
  const result = await runProposalGeneration(
    {
      accountId: "account-poi-failure",
      conversationId: "conversation-poi-failure",
      userMessage: "帮我规划明天去杭州两日游",
    },
    {
      clock: () => "2026-08-29T08:00:00.000Z",
      routeModel: () =>
        terminatingStream("waylog_route", {
          route: {
            confidence: 0.98,
            missingSlots: [],
            routeKind: "skill",
            scope: "in_scope",
            skillId: "trip.draft",
          },
        }) as never,
      skillModel: () =>
        terminatingStream("poi.search", { query: "杭州 西湖" }) as never,
      storage,
      tools: [
        {
          id: "poi.search",
          publicName: "搜索真实地点",
          tool: {
            description: "搜索并核验真实地点",
            execute: async () => {
              throw new Error("provider unavailable");
            },
            label: "搜索真实地点",
            name: "poi.search",
            parameters: {
              additionalProperties: false,
              properties: { query: { type: "string" } },
              required: ["query"],
              type: "object",
            },
          },
        },
      ],
    },
  );

  assert.equal(result.resultType, "failure");
  if (result.resultType !== "failure") return;
  assert.equal(result.retryable, true);
  assert.equal(result.userMessage, "帮我规划明天去杭州两日游");
  assert.match(result.error, /地点搜索.*重试/);
  assert.equal(JSON.stringify(result).includes("西湖"), false);
  const conversation = await getAgentConversation("conversation-poi-failure", {
    accountId: "account-poi-failure",
    storage,
  });
  assert.deepEqual(
    conversation?.messages.map((message) => [message.role, message.text]),
    [["user", "帮我规划明天去杭州两日游"]],
  );
});

test("trip.draft stops before a ninth poi.search execution", async () => {
  let executions = 0;
  const result = await runProposalGeneration(
    {
      accountId: "account-poi-budget",
      userMessage: "帮我规划云南三日游",
    },
    {
      clock: () => "2026-08-29T08:00:00.000Z",
      routeModel: () =>
        terminatingStream("waylog_route", {
          route: {
            confidence: 0.98,
            missingSlots: [],
            routeKind: "skill",
            scope: "in_scope",
            skillId: "trip.draft",
          },
        }) as never,
      skillModel: () =>
        terminatingStream("poi.search", { query: "云南 景点" }) as never,
      storage: createMemoryStorage(),
      tools: [
        {
          id: "poi.search",
          publicName: "搜索真实地点",
          tool: {
            description: "搜索并核验真实地点",
            execute: async () => {
              executions += 1;
              const candidates = [
                {
                  area: "昆明市",
                  name: "石林风景区",
                  provider: "amap",
                  providerPlaceId: "B0BUDGET001",
                },
              ];
              return {
                content: [
                  {
                    text: JSON.stringify({
                      data: { candidates },
                      kind: "untrusted_tool_data",
                      sourceReferences: [],
                      toolName: "poi.search",
                    }),
                    type: "text",
                  },
                ],
                details: { publicSummary: "找到 1 个地点候选" },
              };
            },
            label: "搜索真实地点",
            name: "poi.search",
            parameters: {
              additionalProperties: false,
              properties: { query: { type: "string" } },
              required: ["query"],
              type: "object",
            },
          },
        },
      ],
    },
  );

  assert.equal(result.resultType, "failure");
  assert.equal(executions, 8);
});

test("trip.draft accepts only POIs returned by its allowlisted poi.search tool and canonicalizes their facts", async () => {
  let skillCall = 0;
  let poiCall = 0;
  const result = await runProposalGeneration(
    {
      accountId: "account-grounded-draft",
      userMessage: "帮我规划下周去云南三日游",
    },
    {
      clock: () => "2026-08-29T08:00:00.000Z",
      routeModel: () =>
        terminatingStream("waylog_route", {
          route: {
            confidence: 0.99,
            missingSlots: [],
            routeKind: "skill",
            scope: "in_scope",
            skillId: "trip.draft",
          },
        }) as never,
      skillModel: (_model, context) => {
        skillCall += 1;
        assert.deepEqual(
          context.tools?.map((tool) => tool.name),
          ["poi.search", "waylog_trip_draft"],
        );
        if (skillCall === 1) {
          return terminatingStream("poi.search", {
            limit: 5,
            query: "云南 石林",
            regionText: "云南",
          }) as never;
        }
        return terminatingStream("waylog_trip_draft", {
          result: {
            draft: {
              assumptions: [],
              createdAt: "2026-08-29T08:00:00.000Z",
              dayCount: 3,
              days: [
                {
                  dayIndex: 1,
                  items: [
                    {
                      address: "模型篡改地址",
                      placeName: "模型篡改名称",
                      provider: "amap",
                      providerPlaceId: "B0YUNNAN001",
                      title: "模型篡改名称",
                    },
                  ],
                  title: "昆明与石林",
                },
                { dayIndex: 2, items: [], title: "大理慢游" },
                { dayIndex: 3, items: [], title: "返程" },
              ],
              destination: "云南",
              draftId: "draft-grounded-yunnan",
              title: "云南风光三日行",
              updatedAt: "2026-08-29T08:00:00.000Z",
              warnings: [],
            },
            kind: "trip_draft",
            semantics: {
              cities: ["昆明", "大理"],
              companions: [],
              confidence: 0.97,
              dateExpression: "下周",
              dateResolution: { kind: "next_week" },
              dayCount: 3,
              destination: "云南",
              missingFields: [],
              preferences: ["自然风光"],
              semanticTitle: "云南风光三日行",
            },
          },
        }) as never;
      },
      storage: createMemoryStorage(),
      tools: [
        {
          id: "poi.search",
          publicName: "搜索真实地点",
          tool: {
            description: "搜索并核验真实地点",
            execute: async () => {
              poiCall += 1;
              const candidates = [
                {
                  address: "云南省昆明市石林彝族自治县",
                  area: "昆明市",
                  category: "景点",
                  id: "poi-shilin",
                  latitude: 24.81,
                  longitude: 103.32,
                  name: "石林风景区",
                  poiType: "风景名胜",
                  provider: "amap",
                  providerPlaceId: "B0YUNNAN001",
                },
              ];
              return {
                content: [
                  { text: JSON.stringify({ candidates }), type: "text" },
                ],
                details: { candidates },
              };
            },
            label: "搜索真实地点",
            name: "poi.search",
            parameters: {
              additionalProperties: false,
              properties: {
                limit: { maximum: 6, minimum: 1, type: "integer" },
                query: { minLength: 1, type: "string" },
                regionText: { type: "string" },
              },
              required: ["query"],
              type: "object",
            },
          },
        },
      ],
    },
  );

  assert.equal(result.resultType, "trip_draft");
  if (result.resultType !== "trip_draft") return;
  assert.equal(poiCall, 1);
  assert.equal(result.draft.days[0]?.items[0]?.placeName, "石林风景区");
  assert.equal(
    result.draft.days[0]?.items[0]?.address,
    "云南省昆明市石林彝族自治县",
  );
  assert.equal(result.draft.dateExpression, "下周");
  assert.deepEqual(result.draft.resolvedDateRange, {
    endDate: "2026-09-02",
    startDate: "2026-08-31",
  });
});

test("proposal generation runs itinerary.edit with selected Trip context and returns only a validated preview", async () => {
  const selectedTrip = createSelectedTrip();
  const originalTrip = structuredClone(selectedTrip);
  let skillContext: StreamContext | undefined;
  const result = await runProposalGeneration(
    {
      accountId: "account-trip-edit",
      pageContext: { hasSelectedTrip: true, surface: "agent_conversation" },
      selectedTrip,
      userMessage: "删除第一天的西湖",
    },
    {
      clock: () => "2026-08-29T08:00:00.000Z",
      ids: { turn: () => "turn-trip-edit" },
      routeModel: () =>
        terminatingStream("waylog_route", {
          route: {
            confidence: 0.99,
            missingSlots: [],
            routeKind: "skill",
            scope: "in_scope",
            skillId: "itinerary.edit",
          },
        }) as never,
      skillModel: (_model, context) => {
        skillContext = context;
        return terminatingStream("waylog_trip_edit_proposal", {
          proposal: {
            expectedUpdatedAt: selectedTrip.updatedAt,
            operations: [
              {
                dayId: "day-1",
                itemId: "item-west-lake",
                operationId: "remove-west-lake-op",
                tripId: selectedTrip.id,
                type: "remove_day_item",
              },
            ],
            proposalId: "remove-west-lake-proposal",
            summary: "从第一天删除西湖",
            tripId: selectedTrip.id,
          },
        }) as never;
      },
      storage: createMemoryStorage(),
      tools: [],
    },
  );

  assert.equal(result.resultType, "trip_edit_proposal");
  if (result.resultType !== "trip_edit_proposal") return;
  assert.equal(result.preview.status, "preview");
  assert.equal(result.preview.preview[0]?.risk, "high");
  assert.deepEqual(selectedTrip, originalTrip);
  assert.deepEqual(
    skillContext?.tools?.map((tool) => tool.name),
    ["waylog_trip_edit_proposal"],
  );
  assert.equal(JSON.stringify(skillContext).includes("item-west-lake"), true);
  assert.equal(JSON.stringify(skillContext).includes("trip.draft"), false);
});

test("itinerary.edit returns a validated multi-operation preview with stable targets", async () => {
  const selectedTrip = createSelectedTrip();
  const result = await runProposalGeneration(
    {
      accountId: "account-multi-trip-edit",
      selectedTrip,
      userMessage: "把西湖改到十点，并更新第一天标题",
    },
    {
      clock: () => "2026-08-29T08:00:00.000Z",
      routeModel: () =>
        terminatingStream("waylog_route", {
          route: {
            confidence: 0.99,
            missingSlots: [],
            routeKind: "skill",
            scope: "in_scope",
            skillId: "itinerary.edit",
          },
        }) as never,
      skillModel: () =>
        terminatingStream("waylog_trip_edit_proposal", {
          proposal: {
            expectedUpdatedAt: selectedTrip.updatedAt,
            operations: [
              {
                changes: { time: "10:00" },
                dayId: "day-1",
                itemId: "item-west-lake",
                operationId: "operation-update-west-lake",
                tripId: selectedTrip.id,
                type: "update_day_item",
              },
              {
                dayId: "day-1",
                operationId: "operation-title-day-1",
                title: "西湖漫游",
                tripId: selectedTrip.id,
                type: "update_trip_day_title",
              },
            ],
            proposalId: "proposal-multi-edit",
            summary: "更新两处安排",
            tripId: selectedTrip.id,
          },
        }) as never,
      storage: createMemoryStorage(),
      tools: [],
    },
  );

  assert.equal(result.resultType, "trip_edit_proposal");
  if (result.resultType !== "trip_edit_proposal") return;
  assert.deepEqual(
    result.preview.proposal.operations.map((operation) => ({
      operationId: operation.operationId,
      tripId: operation.tripId,
      type: operation.type,
    })),
    [
      {
        operationId: "operation-update-west-lake",
        tripId: selectedTrip.id,
        type: "update_day_item",
      },
      {
        operationId: "operation-title-day-1",
        tripId: selectedTrip.id,
        type: "update_trip_day_title",
      },
    ],
  );
  assert.equal(result.preview.preview.length, 2);
  assert.deepEqual(
    result.preview.preview.map((item) => item.risk),
    ["low", "low"],
  );
});

test("itinerary.edit rebuilds an added place from trusted Trip data", async () => {
  const selectedTrip = createSelectedTrip();
  const result = await runProposalGeneration(
    {
      accountId: "account-canonical-place",
      selectedTrip,
      userMessage: "把地点库里的西湖再排到第一天",
    },
    {
      clock: () => "2026-08-29T08:00:00.000Z",
      routeModel: () =>
        terminatingStream("waylog_route", {
          route: {
            confidence: 0.99,
            missingSlots: [],
            routeKind: "skill",
            scope: "in_scope",
            skillId: "itinerary.edit",
          },
        }) as never,
      skillModel: () =>
        terminatingStream("waylog_trip_edit_proposal", {
          proposal: {
            expectedUpdatedAt: selectedTrip.updatedAt,
            operations: [
              {
                dayId: "day-1",
                operationId: "canonical-add-operation",
                place: {
                  address: "模型伪造地址",
                  id: "place-west-lake",
                  latitude: 0,
                  longitude: 0,
                  name: "模型伪造地点名",
                  sourcePlaceId: "place-west-lake",
                },
                tripId: selectedTrip.id,
                type: "add_place_to_day",
              },
            ],
            proposalId: "canonical-add-proposal",
            summary: "重新安排西湖",
            tripId: selectedTrip.id,
          },
        }) as never,
      storage: createMemoryStorage(),
      tools: [],
    },
  );

  assert.equal(result.resultType, "trip_edit_proposal");
  if (result.resultType !== "trip_edit_proposal") return;
  const operation = result.preview.proposal.operations[0];
  assert.equal(operation?.type, "add_place_to_day");
  if (operation?.type !== "add_place_to_day") return;
  assert.equal(operation.place.name, "西湖");
  assert.equal(operation.place.address, undefined);
  assert.equal(operation.place.latitude, 30.25);
  assert.equal(operation.place.longitude, 120.15);
  assert.equal(operation.place.providerPlaceId, "B0WESTLAKE001");
});

test("itinerary.edit exposes only accepted poi.search matches to the model", async () => {
  const selectedTrip = createSelectedTrip();
  let skillCall = 0;
  let poiCall = 0;
  let proposedProviderPlaceId = "B0LINGYIN001";
  const generate = () =>
    runProposalGeneration(
      {
        accountId: "account-verified-edit-place",
        selectedTrip,
        userMessage: "把灵隐寺加到第一天",
      },
      {
        clock: () => "2026-08-29T08:00:00.000Z",
        routeModel: () =>
          terminatingStream("waylog_route", {
            route: {
              confidence: 0.99,
              missingSlots: [],
              routeKind: "skill",
              scope: "in_scope",
              skillId: "itinerary.edit",
            },
          }) as never,
        skillModel: (_model, context) => {
          skillCall += 1;
          assert.deepEqual(
            context.tools?.map((tool) => tool.name),
            ["poi.search", "waylog_trip_edit_proposal"],
          );
          if (skillCall === 1) {
            return terminatingStream("poi.search", {
              limit: 3,
              query: "灵隐寺",
              regionText: "杭州",
            }) as never;
          }
          const messages = JSON.stringify(context.messages);
          assert.equal(/灵隐寺\(地铁站\)/u.test(messages), false);
          assert.equal(messages.includes("灵隐寺"), true);
          if (skillCall > 2) {
            throw new Error("stop after a rejected proposal");
          }
          return terminatingStream("waylog_trip_edit_proposal", {
            proposal: {
              expectedUpdatedAt: selectedTrip.updatedAt,
              operations: [
                {
                  dayId: "day-1",
                  operationId: "add-lingyin-operation",
                  place: {
                    address: "模型篡改地址",
                    latitude: 0,
                    longitude: 0,
                    name: "模型篡改名称",
                    provider: "amap",
                    providerPlaceId: proposedProviderPlaceId,
                  },
                  tripId: selectedTrip.id,
                  type: "add_place_to_day",
                },
              ],
              proposalId: "add-lingyin-proposal",
              summary: "把灵隐寺加入第一天",
              tripId: selectedTrip.id,
            },
          }) as never;
        },
        storage: createMemoryStorage(),
        tools: [
          {
            id: "poi.search",
            publicName: "搜索真实地点",
            tool: {
              description: "搜索并核验真实地点",
              execute: async () => {
                poiCall += 1;
                const candidates = [
                  {
                    address: "浙江省杭州市西湖区灵隐路",
                    id: "poi-lingyin-scenic",
                    latitude: 30.241,
                    longitude: 120.103,
                    name: "灵隐寺(地铁站)",
                    provider: "amap",
                    providerPlaceId: "B0LINGYINSUBWAY",
                  },
                  {
                    address: "浙江省杭州市西湖区法云弄1号",
                    area: "西湖区",
                    category: "景点",
                    details: {
                      privateUrl: "https://example.com/signed?token=secret",
                    },
                    externalRefs: { signedUrl: "https://example.com/private" },
                    id: "poi-lingyin",
                    iconKey: "not-a-real-icon",
                    latitude: 30.2401,
                    longitude: 120.1025,
                    mapBoundary: [{ latitude: "invalid", longitude: 120 }],
                    name: "灵隐寺",
                    photos: [{ url: "https://example.com/private-photo" }],
                    poiGroup: "not-a-real-group",
                    poiType: "寺庙",
                    provider: "amap",
                    providerPlaceId: "B0LINGYIN001",
                  },
                ];
                return {
                  content: [
                    {
                      text: JSON.stringify({
                        data: { candidates },
                        kind: "untrusted_tool_data",
                        sourceReferences: [],
                        toolName: "poi.search",
                      }),
                      type: "text",
                    },
                  ],
                  details: { publicSummary: "找到 1 个地点候选" },
                };
              },
              label: "搜索真实地点",
              name: "poi.search",
              parameters: {
                additionalProperties: false,
                properties: {
                  limit: { maximum: 6, minimum: 1, type: "integer" },
                  query: { minLength: 1, type: "string" },
                  regionText: { type: "string" },
                },
                required: ["query"],
                type: "object",
              },
            },
          },
        ],
      },
    );
  const result = await generate();

  assert.equal(
    result.resultType,
    "trip_edit_proposal",
    result.resultType === "failure" ? result.error : undefined,
  );
  if (result.resultType !== "trip_edit_proposal") return;
  assert.equal(poiCall, 1);
  const operation = result.preview.proposal.operations[0];
  assert.equal(operation?.type, "add_place_to_day");
  if (operation?.type !== "add_place_to_day") return;
  assert.equal(operation.place.name, "灵隐寺");
  assert.equal(operation.place.address, "浙江省杭州市西湖区法云弄1号");
  assert.equal(operation.place.latitude, 30.2401);
  assert.equal(operation.place.longitude, 120.1025);
  assert.equal(operation.place.providerPlaceId, "B0LINGYIN001");
  assert.equal(operation.place.details, undefined);
  assert.equal(operation.place.externalRefs, undefined);
  assert.equal(operation.place.iconKey, undefined);
  assert.equal(operation.place.mapBoundary, undefined);
  assert.equal(operation.place.photos, undefined);
  assert.equal(operation.place.poiGroup, undefined);
  assert.equal(result.preview.preview[0]?.risk, "low");
  assert.deepEqual(result.preview.preview[0]?.impact, [
    "新增地点：灵隐寺",
    "目标日期：第一天",
    "已匹配真实地点：高德",
    "地点地址：浙江省杭州市西湖区法云弄1号",
    "地点来源 ID：B0LINGYIN001",
  ]);

  skillCall = 0;
  poiCall = 0;
  proposedProviderPlaceId = "B0WRONGPLACE";
  const rejected = await generate();
  assert.equal(rejected.resultType, "failure");
  assert.equal(poiCall, 1);
});

test("proposal generation keeps Trip selection local after the authoritative itinerary.edit route", async () => {
  let skillCalled = false;
  const storage = createMemoryStorage();
  const result = await runProposalGeneration(
    {
      accountId: "account-trip-selection",
      userMessage: "删除第一天的西湖",
    },
    {
      clock: () => "2026-08-29T08:00:00.000Z",
      ids: { turn: () => "turn-trip-selection" },
      resolveTrip: async () => ({
        candidates: [
          {
            dayCount: 1,
            id: "trip-hangzhou",
            matchedText: ["第一天"],
            score: 21,
            title: "杭州一日游",
          },
          {
            dayCount: 2,
            id: "trip-suzhou",
            matchedText: ["第一天"],
            score: 21,
            title: "苏州二日游",
          },
        ],
        reason: "请选择要修改的行程",
        status: "ambiguous",
      }),
      routeModel: () =>
        terminatingStream("waylog_route", {
          route: {
            confidence: 0.94,
            missingSlots: ["selectedTrip"],
            routeKind: "skill",
            scope: "in_scope",
            skillId: "itinerary.edit",
          },
        }) as never,
      skillModel: (() => {
        skillCalled = true;
        throw new Error("Trip selection must finish before the Skill run");
      }) as never,
      storage,
      tools: [],
    },
  );

  assert.equal(result.resultType, "trip_selection_required");
  if (result.resultType !== "trip_selection_required") return;
  assert.equal(result.candidates.length, 2);
  assert.equal(result.route.skillId, "itinerary.edit");
  assert.equal(skillCalled, false);
  const conversation = await getAgentConversation(result.conversationId, {
    accountId: "account-trip-selection",
    storage,
  });
  assert.deepEqual(
    conversation?.turns[0]?.attempts?.map((attempt) => [
      attempt.id,
      attempt.status,
    ]),
    [[result.attemptId, "place_selection"]],
  );
  assert.equal(conversation?.messages.at(-1)?.turnId, result.turnId);
});

test("Trip selection resumes the selected Skill without routing the original free text again", async () => {
  const selectedTrip = createSelectedTrip();
  const storage = createMemoryStorage();
  const selectionResult = await runProposalGeneration(
    {
      accountId: "account-trip-resume",
      conversationId: "conversation-trip-resume",
      userMessage: "删除第一天的西湖",
    },
    {
      clock: () => "2026-08-29T08:00:00.000Z",
      ids: { turn: () => "turn-trip-resume" },
      resolveTrip: () => ({
        candidates: [
          {
            dayCount: 1,
            id: selectedTrip.id,
            matchedText: ["第一天"],
            score: 21,
            title: selectedTrip.title,
          },
        ],
        reason: "请选择要修改的行程",
        status: "ambiguous",
      }),
      routeModel: () =>
        terminatingStream("waylog_route", {
          route: {
            confidence: 0.94,
            missingSlots: ["selectedTrip"],
            routeKind: "skill",
            scope: "in_scope",
            skillId: "itinerary.edit",
          },
        }) as never,
      skillModel: (() => {
        throw new Error("selection must finish before Skill execution");
      }) as never,
      storage,
      tools: [],
    },
  );

  assert.equal(selectionResult.resultType, "trip_selection_required");
  if (selectionResult.resultType !== "trip_selection_required") return;
  let routeCalled = false;
  const result = await resumeProposalGeneration(
    {
      accountId: "account-trip-resume",
      conversationId: selectionResult.conversationId,
      route: selectionResult.route,
      selectedTrip,
      turnId: selectionResult.turnId,
      userMessage: selectionResult.userMessage,
    },
    {
      clock: () => "2026-08-29T08:00:00.000Z",
      routeModel: (() => {
        routeCalled = true;
        throw new Error("resume must not route again");
      }) as never,
      skillModel: () =>
        terminatingStream("waylog_trip_edit_proposal", {
          proposal: {
            expectedUpdatedAt: selectedTrip.updatedAt,
            operations: [
              {
                dayId: "day-1",
                itemId: "item-west-lake",
                operationId: "resume-remove-west-lake-op",
                tripId: selectedTrip.id,
                type: "remove_day_item",
              },
            ],
            proposalId: "resume-remove-west-lake-proposal",
            summary: "从第一天删除西湖",
            tripId: selectedTrip.id,
          },
        }) as never,
      storage,
      tools: [],
    },
  );

  assert.equal(result.resultType, "trip_edit_proposal");
  assert.equal(routeCalled, false);
});

test("ambiguous and out-of-scope routes use bounded built-in handlers without a Skill run", async () => {
  for (const fixture of [
    {
      expectedResultType: "clarification",
      message: "帮我安排一下",
      route: {
        confidence: 0.55,
        handler: "clarification",
        missingSlots: ["intent"],
        publicMessage: "你想新建旅行，还是修改已有行程？",
        routeKind: "built_in",
        scope: "ambiguous",
      },
    },
    {
      expectedResultType: "out_of_scope",
      message: "帮我写一段股票交易代码",
      route: {
        confidence: 0.99,
        handler: "out_of_scope",
        missingSlots: [],
        publicMessage: "我只能协助旅行规划、行程记录和 WayLog 使用问题。",
        routeKind: "built_in",
        scope: "out_of_scope",
      },
    },
  ] as const) {
    let skillCalled = false;
    const result = await runProposalGeneration(
      {
        accountId: "account-a",
        userMessage: fixture.message,
      },
      {
        clock: () => "2026-08-29T08:00:00.000Z",
        routeModel: () =>
          terminatingStream("waylog_route", { route: fixture.route }) as never,
        skillModel: (() => {
          skillCalled = true;
          throw new Error("built-in routes must not start a Skill run");
        }) as never,
        storage: createMemoryStorage(),
        tools: [],
      },
    );

    assert.equal(result.resultType, fixture.expectedResultType);
    if (result.resultType === "failure") return;
    assert.equal(result.route.scope, fixture.route.scope);
    assert.equal(skillCalled, false);
  }
});

test("route model and schema failures preserve the original input as a retryable failure", async () => {
  let invalidSchemaCall = 0;
  let forbiddenOperationCall = 0;
  const routeModels = [
    () => {
      throw new Error("network unavailable");
    },
    () => {
      invalidSchemaCall += 1;
      return (
        invalidSchemaCall === 1
          ? terminatingStream("waylog_route", {
              route: {
                confidence: 0.8,
                missingSlots: [],
                routeKind: "skill",
                scope: "in_scope",
                skillId: "not-a-skill",
              },
            })
          : stoppedStream()
      ) as never;
    },
    () => {
      forbiddenOperationCall += 1;
      return (
        forbiddenOperationCall === 1
          ? terminatingStream("waylog_route", {
              route: {
                confidence: 0.9,
                missingSlots: [],
                operation: { type: "create_trip" },
                routeKind: "skill",
                scope: "in_scope",
                skillId: "trip.draft",
              },
            })
          : stoppedStream()
      ) as never;
    },
  ];

  for (const routeModel of routeModels) {
    const storage = createMemoryStorage();
    let skillCalled = false;
    const result = await runProposalGeneration(
      {
        accountId: "account-a",
        conversationId: "conversation-failure",
        userMessage: "帮我规划下周去云南三日游",
      },
      {
        clock: () => "2026-08-29T08:00:00.000Z",
        routeModel: routeModel as never,
        skillModel: (() => {
          skillCalled = true;
          throw new Error("must not run after route failure");
        }) as never,
        storage,
        tools: [],
      },
    );

    assert.equal(result.resultType, "failure");
    if (result.resultType !== "failure") return;
    assert.equal(result.retryable, true);
    assert.equal(result.userMessage, "帮我规划下周去云南三日游");
    assert.equal(skillCalled, false);

    const conversation = await getAgentConversation("conversation-failure", {
      accountId: "account-a",
      storage,
    });
    assert.deepEqual(
      conversation?.messages.map((message) => [message.role, message.text]),
      [["user", "帮我规划下周去云南三日游"]],
    );
  }
});

test("missing dayCount pauses trip.draft with a structured continuation", async () => {
  const storage = createMemoryStorage();
  const result = await runProposalGeneration(
    {
      accountId: "account-day-clarification",
      conversationId: "conversation-day-clarification",
      userMessage: "帮我规划下周去云南旅行",
    },
    {
      clock: () => "2026-08-29T08:00:00.000Z",
      ids: {
        clarification: () => "clarification-day-count-1",
        turn: () => "turn-day-clarification",
      },
      routeModel: () =>
        terminatingStream("waylog_route", {
          route: {
            confidence: 0.98,
            missingSlots: ["dayCount"],
            routeKind: "skill",
            scope: "in_scope",
            skillId: "trip.draft",
          },
        }) as never,
      skillModel: () =>
        terminatingStream("waylog_trip_draft", {
          result: {
            clarification: {
              question: "这次想玩几天？",
              requestedField: "dayCount",
              responseContract: {
                kind: "day_count",
                maximum: 14,
                minimum: 1,
              },
            },
            kind: "clarification",
            semantics: {
              cities: ["昆明", "大理"],
              companions: [],
              confidence: 0.93,
              dateExpression: "下周",
              dateResolution: { kind: "next_week" },
              destination: "云南",
              missingFields: ["dayCount"],
              preferences: [],
              semanticTitle: "云南风光之旅",
            },
          },
        }) as never,
      storage,
      tools: [],
    },
  );

  assert.equal(result.resultType, "trip_draft_clarification");
  if (result.resultType !== "trip_draft_clarification") return;
  assert.equal(
    result.clarification.clarificationId,
    "clarification-day-count-1",
  );
  assert.equal(result.clarification.requestedField, "dayCount");
  assert.equal(result.clarification.continuation.turnId, result.turnId);
  assert.equal(result.userMessage, "帮我规划下周去云南旅行");
  const conversation = await getAgentConversation(result.conversationId, {
    accountId: "account-day-clarification",
    storage,
  });
  assert.deepEqual(
    conversation?.turns[0]?.attempts?.map((attempt) => [
      attempt.id,
      attempt.status,
    ]),
    [[result.attemptId, "requested"]],
  );
  assert.equal(conversation?.messages.at(-1)?.turnId, result.turnId);
});

test("typed dayCount resumes the original trip.draft Skill without RouteSelector", async () => {
  const storage = createMemoryStorage();
  const initial = await runProposalGeneration(
    {
      accountId: "account-resume-days",
      conversationId: "conversation-resume-days",
      userMessage: "帮我规划下周去云南旅行",
    },
    {
      clock: () => "2026-08-29T08:00:00.000Z",
      ids: {
        clarification: () => "clarification-resume-days",
        turn: () => "turn-resume-days",
      },
      routeModel: () =>
        terminatingStream("waylog_route", {
          route: {
            confidence: 0.98,
            missingSlots: ["dayCount"],
            routeKind: "skill",
            scope: "in_scope",
            skillId: "trip.draft",
          },
        }) as never,
      skillModel: () =>
        terminatingStream("waylog_trip_draft", {
          result: {
            clarification: {
              question: "这次想玩几天？",
              requestedField: "dayCount",
              responseContract: {
                kind: "day_count",
                maximum: 14,
                minimum: 1,
              },
            },
            kind: "clarification",
            semantics: {
              cities: ["昆明"],
              companions: [],
              confidence: 0.93,
              dateExpression: "下周",
              dateResolution: { kind: "next_week" },
              destination: "云南",
              missingFields: ["dayCount"],
              preferences: [],
              semanticTitle: "云南风光之旅",
            },
          },
        }) as never,
      storage,
      tools: [],
    },
  );
  assert.equal(initial.resultType, "trip_draft_clarification");
  if (initial.resultType !== "trip_draft_clarification") return;

  let routeCalled = false;
  let resumeSkillCall = 0;
  let resumePrompt: unknown;
  const resumed = await resumeTripDraftProposalGeneration(
    {
      accountId: "account-resume-days",
      clarificationId: initial.clarification.clarificationId,
      value: { dayCount: 3, kind: "day_count" },
    },
    {
      clock: () => "2026-08-29T08:10:00.000Z",
      routeModel: (() => {
        routeCalled = true;
        throw new Error("RouteSelector must not run for typed continuation");
      }) as never,
      skillModel: (_model, context) => {
        resumeSkillCall += 1;
        if (resumeSkillCall === 1) {
          const prompt = context.messages.at(-1)?.content;
          const promptText =
            typeof prompt === "string"
              ? prompt
              : Array.isArray(prompt)
                ? prompt.find(
                    (part): part is { text: string; type: "text" } =>
                      part.type === "text" && typeof part.text === "string",
                  )?.text
                : undefined;
          resumePrompt = promptText ? JSON.parse(promptText) : undefined;
          return terminatingStream("poi.search", {
            query: "云南 石林",
          }) as never;
        }
        return terminatingStream("waylog_trip_draft", {
          result: {
            draft: {
              assumptions: [],
              createdAt: "2026-08-29T08:10:00.000Z",
              dayCount: 3,
              days: [
                {
                  dayIndex: 1,
                  items: [
                    {
                      provider: "amap",
                      providerPlaceId: "B0RESUME001",
                      title: "石林风景区",
                    },
                  ],
                  title: "昆明与石林",
                },
                { dayIndex: 2, items: [], title: "大理慢游" },
                { dayIndex: 3, items: [], title: "返程" },
              ],
              destination: "云南",
              draftId: "draft-resume-yunnan",
              title: "云南风光三日行",
              updatedAt: "2026-08-29T08:10:00.000Z",
              warnings: [],
            },
            kind: "trip_draft",
            semantics: {
              cities: ["昆明"],
              companions: [],
              confidence: 0.93,
              dateExpression: "下周",
              dateResolution: { kind: "next_week" },
              dayCount: 3,
              destination: "云南",
              missingFields: [],
              preferences: [],
              semanticTitle: "云南风光三日行",
            },
          },
        }) as never;
      },
      storage,
      tools: [
        {
          id: "poi.search",
          publicName: "搜索真实地点",
          tool: {
            description: "搜索并核验真实地点",
            execute: async () => {
              const candidates = [
                {
                  area: "昆明市",
                  name: "石林风景区",
                  provider: "amap",
                  providerPlaceId: "B0RESUME001",
                },
              ];
              return {
                content: [
                  { text: JSON.stringify({ candidates }), type: "text" },
                ],
                details: { candidates },
              };
            },
            label: "搜索真实地点",
            name: "poi.search",
            parameters: {
              additionalProperties: false,
              properties: { query: { type: "string" } },
              required: ["query"],
              type: "object",
            },
          },
        },
      ],
    },
  );

  assert.equal(routeCalled, false);
  assert.deepEqual(
    {
      dayCount: (resumePrompt as { validatedSemantics?: { dayCount?: number } })
        ?.validatedSemantics?.dayCount,
      kind: (resumePrompt as { kind?: string })?.kind,
      originalInput: (resumePrompt as { originalInput?: string })
        ?.originalInput,
    },
    {
      dayCount: 3,
      kind: "waylog_trip_draft_continuation",
      originalInput: "帮我规划下周去云南旅行",
    },
  );
  assert.equal(
    resumed.resultType,
    "trip_draft",
    resumed.resultType === "failure" ? resumed.error : undefined,
  );
  if (resumed.resultType !== "trip_draft") return;
  assert.equal(resumed.conversationId, initial.conversationId);
  assert.equal(resumed.turnId, initial.turnId);
  assert.equal(resumed.draft.dayCount, 3);
  assert.deepEqual(resumed.draft.resolvedDateRange, {
    endDate: "2026-09-02",
    startDate: "2026-08-31",
  });
  const conversation = await getAgentConversation(initial.conversationId, {
    accountId: "account-resume-days",
    storage,
  });
  assert.equal(
    conversation?.messages.filter((message) => message.role === "user").length,
    1,
  );
  assert.equal(conversation?.turns.at(-1)?.id, initial.turnId);
  assert.equal(conversation?.turns.at(-1)?.status, "previewed");
});

test("concurrent duplicate clarification submission is rejected while failure remains retryable", async () => {
  const storage = createMemoryStorage();
  const initial = await runProposalGeneration(
    {
      accountId: "account-concurrent-resume",
      userMessage: "帮我规划去云南旅行",
    },
    {
      clock: () => "2026-08-29T08:00:00.000Z",
      ids: { clarification: () => "clarification-concurrent" },
      routeModel: () =>
        terminatingStream("waylog_route", {
          route: {
            confidence: 0.95,
            missingSlots: ["dayCount"],
            routeKind: "skill",
            scope: "in_scope",
            skillId: "trip.draft",
          },
        }) as never,
      skillModel: () =>
        terminatingStream("waylog_trip_draft", {
          result: {
            clarification: {
              question: "这次想玩几天？",
              requestedField: "dayCount",
              responseContract: {
                kind: "day_count",
                maximum: 14,
                minimum: 1,
              },
            },
            kind: "clarification",
            semantics: {
              cities: ["昆明"],
              companions: [],
              confidence: 0.9,
              dateExpression: null,
              dateResolution: { kind: "none" },
              destination: "云南",
              missingFields: ["dayCount"],
              preferences: [],
              semanticTitle: null,
            },
          },
        }) as never,
      storage,
      tools: [],
    },
  );
  assert.equal(initial.resultType, "trip_draft_clarification");
  if (initial.resultType !== "trip_draft_clarification") return;

  const deps = {
    clock: () => "2026-08-29T08:10:00.000Z",
    routeModel: (() => {
      throw new Error("RouteSelector must not run");
    }) as never,
    skillModel: (() =>
      terminatingStream("poi.search", { query: "云南 景点" })) as never,
    storage,
    tools: [
      {
        id: "poi.search" as const,
        publicName: "搜索真实地点",
        tool: {
          description: "搜索并核验真实地点",
          execute: async () => {
            throw new Error("poi unavailable");
          },
          label: "搜索真实地点",
          name: "poi.search" as const,
          parameters: {
            properties: { query: { type: "string" } },
            required: ["query"],
            type: "object",
          },
        },
      },
    ],
  };
  const response = {
    accountId: "account-concurrent-resume",
    clarificationId: initial.clarification.clarificationId,
    value: { dayCount: 3, kind: "day_count" as const },
  };
  const blockingAttempt = beginAgentRuntimeAttempt({
    accountId: "account-other-turn",
    attemptId: "attempt-other-turn",
    conversationId: "conversation-other-turn",
    turnId: "turn-other-turn",
  });
  try {
    await assert.rejects(
      () => resumeTripDraftProposalGeneration(response, deps),
      /已有回合正在运行/,
    );
  } finally {
    blockingAttempt.complete();
  }

  const first = resumeTripDraftProposalGeneration(response, deps);
  const duplicate = resumeTripDraftProposalGeneration(response, deps);
  await assert.rejects(() => duplicate, /already being submitted/);
  const failed = await first;
  assert.equal(failed.resultType, "failure");
  if (failed.resultType !== "failure") return;

  let retryPrompt: unknown;
  const retried = await retryProposalGeneration(
    {
      accountId: response.accountId,
      conversationId: failed.conversationId,
      turnId: failed.turnId,
    },
    {
      ...deps,
      skillModel: ((_model: unknown, context: StreamContext) => {
        const prompt = context.messages.at(-1)?.content;
        const promptText =
          typeof prompt === "string"
            ? prompt
            : Array.isArray(prompt)
              ? prompt.find(
                  (part): part is { text: string; type: "text" } =>
                    part.type === "text" && typeof part.text === "string",
                )?.text
              : undefined;
        retryPrompt = promptText ? JSON.parse(promptText) : undefined;
        return terminatingStream("waylog_trip_draft", {
          result: {
            draft: {
              assumptions: [],
              createdAt: "2026-08-29T08:10:00.000Z",
              dayCount: 3,
              days: [
                { dayIndex: 1, items: [], title: "昆明" },
                { dayIndex: 2, items: [], title: "大理" },
                { dayIndex: 3, items: [], title: "返程" },
              ],
              destination: "云南",
              draftId: "draft-retry-clarification",
              title: "云南三日游",
              updatedAt: "2026-08-29T08:10:00.000Z",
              warnings: [],
            },
            kind: "trip_draft",
            semantics: {
              cities: ["昆明"],
              companions: [],
              confidence: 0.9,
              dateExpression: null,
              dateResolution: { kind: "none" },
              dayCount: 3,
              destination: "云南",
              missingFields: [],
              preferences: [],
              semanticTitle: "云南三日游",
            },
          },
        }) as never;
      }) as never,
    },
  );
  assert.equal(retried.attemptId === failed.attemptId, false);
  assert.equal(
    (retryPrompt as { validatedSemantics?: { dayCount?: number } })
      ?.validatedSemantics?.dayCount,
    3,
  );
});
