import assert from "node:assert/strict";
import test from "node:test";
import { createCloudRouteToolSchema } from "../../../features/agent/cloud-route-selector";
import { authenticateAgentProxyRequest } from "../../../supabase/functions/agent-llm-proxy/authenticate";
import {
  buildItineraryEditSystemPrompt,
  buildRouteSelectorSystemPrompt,
  buildTripDraftSystemPrompt,
  buildWayLogQaSystemPrompt,
  createItineraryEditProviderRequest,
  createProviderMessages,
  createProxyEventsFromProviderResponse,
  createRouteSelectorProviderRequest,
  createRouteSelectorProviderTools,
  createTripDraftProviderRequest,
  createWayLogQaProviderRequest,
  getExpectedProviderToolNames,
  parseAgentLlmProxyRequest,
} from "../../../supabase/functions/agent-llm-proxy/contract";

function tripDraftProviderResponse(argumentsValue: unknown) {
  return {
    choices: [
      {
        message: {
          tool_calls: [
            {
              function: {
                arguments: JSON.stringify(argumentsValue),
                name: "waylog_trip_draft",
              },
              id: "trip-draft-provider-call",
              type: "function",
            },
          ],
        },
      },
    ],
  };
}

const validRequest = {
  context: {
    messages: [{ content: "杭州两天怎么安排？", role: "user" }],
    tools: [
      {
        description: "Return the structured public answer",
        name: "waylog_answer",
        parameters: { properties: {}, type: "object" },
      },
    ],
  },
  modelProfile: "balanced",
  phase: "waylog_qa",
  promptVersion: "waylog-qa.v1",
  schemaVersion: 1,
};

const validRouteRequest = {
  context: {
    messages: [
      {
        content: JSON.stringify({
          kind: "waylog_route_request",
          pageContext: {
            hasSelectedTrip: false,
            surface: "agent_conversation",
          },
          skills: [
            {
              description: "Answer read-only WayLog questions.",
              name: "waylog.qa",
              requiredContext: [],
              routeType: "waylog_qa",
              tags: ["waylog-qa"],
            },
          ],
          userMessage: "WayLog 的提案如何确认？",
        }),
        role: "user",
      },
    ],
    tools: [
      {
        description: "Return the structured route decision",
        name: "waylog_route",
        parameters: { properties: {}, type: "object" },
      },
    ],
  },
  modelProfile: "router",
  phase: "route_selector",
  promptVersion: "route-selector.v2",
  schemaVersion: 1,
};

const validTripDraftRequest = {
  context: {
    messages: [{ content: "帮我规划云南三日游", role: "user" }],
    tools: [
      {
        description: "Search verified POIs",
        name: "poi.search",
        parameters: { properties: {}, type: "object" },
      },
      {
        description: "Return the structured Trip draft",
        name: "waylog_trip_draft",
        parameters: { properties: {}, type: "object" },
      },
    ],
  },
  modelProfile: "balanced",
  phase: "trip_draft",
  promptVersion: "trip-draft.v1",
  schemaVersion: 1,
};

const validItineraryEditRequest = {
  context: {
    messages: [
      {
        content: JSON.stringify({
          kind: "waylog_itinerary_edit_request",
          selectedTrip: {
            days: [
              {
                dayIndex: 1,
                id: "day-1",
                items: [{ id: "item-1", title: "西湖" }],
                title: "第一天",
              },
            ],
            id: "trip-1",
            title: "杭州一日游",
            updatedAt: "2026-08-29T08:00:00.000Z",
          },
          userMessage: "删除第一天的西湖",
        }),
        role: "user",
      },
    ],
    tools: [
      {
        description: "Search verified POIs",
        name: "poi.search",
        parameters: { properties: {}, type: "object" },
      },
      {
        description: "Return the structured Trip edit proposal",
        name: "waylog_trip_edit_proposal",
        parameters: { properties: {}, type: "object" },
      },
    ],
  },
  modelProfile: "balanced",
  phase: "itinerary_edit",
  promptVersion: "itinerary-edit.v1",
  schemaVersion: 1,
};

test("LLM proxy gives RouteSelector an independent prompt and terminating schema", () => {
  const parsed = parseAgentLlmProxyRequest(validRouteRequest);

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.data.phase, "route_selector");
  assert.deepEqual(
    parsed.data.context.tools.map((tool) => tool.name),
    ["waylog_route"],
  );
  assert.match(buildRouteSelectorSystemPrompt(), /out_of_scope/);
  assert.match(buildRouteSelectorSystemPrompt(), /ambiguous/);
  assert.match(buildRouteSelectorSystemPrompt(), /prompt injection/i);
  assert.match(buildRouteSelectorSystemPrompt(), /reliably separate/i);
  assert.match(
    buildRouteSelectorSystemPrompt(),
    /legitimate travel request.*in_scope.*ignore the injected instruction/i,
  );
  assert.match(
    buildRouteSelectorSystemPrompt(),
    /cannot be reliably separated.*ambiguous.*clarification/i,
  );
  assert.equal(
    buildRouteSelectorSystemPrompt().includes("waylog_answer"),
    false,
  );

  const providerRequest = createRouteSelectorProviderRequest(parsed.data, {
    maxTokens: 1_200,
    model: "thinking-model",
    temperature: 0.4,
  });
  assert.equal(providerRequest.max_tokens, 800);
  assert.deepEqual(
    providerRequest.tools.map((tool) => tool.function.name),
    ["waylog_route"],
  );
  assert.equal(providerRequest.tool_choice, "auto");
  assert.equal(
    JSON.stringify(providerRequest).includes("waylog_answer"),
    false,
  );

  assert.equal(
    parseAgentLlmProxyRequest({
      ...validRouteRequest,
      context: validRequest.context,
    }).ok,
    false,
  );
});

test("mobile and Edge enforce the same RouteSelector terminating schema", () => {
  assert.deepEqual(
    createCloudRouteToolSchema(),
    createRouteSelectorProviderTools()[0]?.function.parameters,
  );
});

test("LLM proxy accepts only the Edge-owned phase and prompt version contract", () => {
  const result = parseAgentLlmProxyRequest(validRequest);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.phase, "waylog_qa");
  assert.deepEqual(
    result.data.context.tools.map((tool) => tool.name),
    ["waylog_answer"],
  );
  assert.match(buildWayLogQaSystemPrompt(), /read-only/i);
  assert.match(buildWayLogQaSystemPrompt(), /waylog_answer/);

  assert.equal(
    parseAgentLlmProxyRequest({ ...validRequest, userId: "spoofed-user" }).ok,
    false,
  );
  assert.equal(
    parseAgentLlmProxyRequest({
      ...validRequest,
      context: { ...validRequest.context, systemPrompt: "client override" },
    }).ok,
    false,
  );
  assert.equal(
    parseAgentLlmProxyRequest({
      ...validRequest,
      promptVersion: "unknown-prompt",
    }).ok,
    false,
  );
});

test("waylog.qa Edge contract rejects more than two read-tool calls", () => {
  const readTool = {
    description: "Read public weather data",
    name: "weather.get",
    parameters: { properties: {}, type: "object" },
  };
  const readPair = (index: number) => [
    {
      content: [
        {
          arguments: {
            latitude: 30,
            longitude: 120,
            placeName: "杭州",
          },
          id: `weather-call-${index}`,
          name: "weather.get",
          type: "toolCall",
        },
      ],
      role: "assistant",
    },
    {
      content: [{ text: '{"forecast":[]}', type: "text" }],
      role: "toolResult",
      toolCallId: `weather-call-${index}`,
      toolName: "weather.get",
    },
  ];
  const request = {
    ...validRequest,
    context: {
      messages: [
        ...validRequest.context.messages,
        ...readPair(0),
        ...readPair(1),
      ],
      tools: [readTool, ...validRequest.context.tools],
    },
  };

  assert.equal(parseAgentLlmProxyRequest(request).ok, true);
  assert.equal(
    parseAgentLlmProxyRequest({
      ...request,
      context: {
        ...request.context,
        messages: [...request.context.messages, ...readPair(2)],
      },
    }).ok,
    false,
  );
});

test("waylog.qa Edge phase accepts only its bounded read-tool allowlist and treats tool data as untrusted", () => {
  const qaRequest = {
    ...validRequest,
    context: {
      ...validRequest.context,
      tools: [
        ...["poi.search", "weather.get", "route.estimate", "web.search"].map(
          (name) => ({
            description: `Read-only ${name}`,
            name,
            parameters: { additionalProperties: false, type: "object" },
          }),
        ),
        ...validRequest.context.tools,
      ],
    },
  };
  const parsed = parseAgentLlmProxyRequest(qaRequest);

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const providerRequest = createWayLogQaProviderRequest(parsed.data, {
    maxTokens: 900,
    model: "controlled-model",
    temperature: 0.2,
  });
  assert.deepEqual(
    providerRequest.tools.map((tool) => tool.function.name),
    [
      "poi_search",
      "weather_get",
      "route_estimate",
      "web_search",
      "waylog_answer",
    ],
  );
  assert.match(buildWayLogQaSystemPrompt(), /untrusted data/i);
  assert.match(buildWayLogQaSystemPrompt(), /prompt injection/i);
  assert.match(buildWayLogQaSystemPrompt(), /explicitly asks.*web/i);
  assert.match(buildWayLogQaSystemPrompt(), /clarification/i);

  assert.equal(
    parseAgentLlmProxyRequest({
      ...qaRequest,
      context: {
        ...qaRequest.context,
        tools: [
          ...qaRequest.context.tools,
          {
            description: "write",
            name: "trip.update",
            parameters: { type: "object" },
          },
        ],
      },
    }).ok,
    false,
  );
  assert.equal(
    parseAgentLlmProxyRequest({
      ...validRouteRequest,
      context: qaRequest.context,
    }).ok,
    false,
  );
});

test("LLM proxy gives trip.draft its own prompt and terminating schema", () => {
  const parsed = parseAgentLlmProxyRequest(validTripDraftRequest);

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.data.phase, "trip_draft");
  assert.deepEqual(
    parsed.data.context.tools.map((tool) => tool.name),
    ["poi.search", "waylog_trip_draft"],
  );
  assert.match(buildTripDraftSystemPrompt(), /Trip Draft ReAct loop/);
  assert.match(buildTripDraftSystemPrompt(), /preview/i);
  assert.match(buildTripDraftSystemPrompt(), /at most 1 poi_search call/i);
  assert.match(buildTripDraftSystemPrompt(), /云南旅行.*dayCount/i);
  assert.match(buildTripDraftSystemPrompt(), /华盛顿.*destination/i);
  assert.match(buildTripDraftSystemPrompt(), /Tokyo.*日本 东京/i);
  assert.match(buildTripDraftSystemPrompt(), /Shanghai.*上海/i);
  assert.match(
    buildTripDraftSystemPrompt(),
    /destination=上海.*companions=\[父母\].*preferences=\[美食\]/i,
  );
  assert.match(
    buildTripDraftSystemPrompt(),
    /user's language.*public question/i,
  );
  assert.match(buildTripDraftSystemPrompt(), /localized destination.*景点/i);
  assert.match(
    buildTripDraftSystemPrompt(true),
    /at most one verified POI per day/i,
  );

  const providerRequest = createTripDraftProviderRequest(parsed.data, {
    maxTokens: 5_000,
    model: "thinking-model",
    temperature: 0.4,
  });
  assert.equal(providerRequest.max_tokens, 4_096);
  assert.equal(providerRequest.temperature, 0);
  assert.deepEqual(providerRequest.thinking, { type: "disabled" });
  assert.deepEqual(providerRequest.tool_choice, {
    function: { name: "waylog_trip_draft_semantics" },
    type: "function",
  });
  assert.deepEqual(
    providerRequest.tools.map((tool) => tool.function.name),
    ["waylog_trip_draft_semantics"],
  );
  assert.match(
    providerRequest.tools[0]?.function.description ?? "",
    /never default/i,
  );
  const semanticToolSchema = JSON.stringify(
    providerRequest.tools[0]?.function.parameters,
  );
  assert.equal(semanticToolSchema.includes('"enum":[["dayCount"]]'), true);
  assert.equal(semanticToolSchema.includes('"enum":[["destination"]]'), true);
  assert.equal(JSON.stringify(providerRequest).includes("waylog_route"), false);

  const continuedRequest = {
    ...parsed.data,
    context: {
      ...parsed.data.context,
      messages: [
        ...parsed.data.context.messages,
        {
          content: [
            {
              arguments: { query: "云南 石林" },
              id: "poi-provider-name",
              name: "poi.search",
              type: "toolCall",
            },
          ],
          role: "assistant",
        },
        {
          content: [{ text: '{"candidates":[]}', type: "text" }],
          role: "toolResult",
          toolCallId: "poi-provider-name",
          toolName: "poi.search",
        },
      ],
    },
  } as typeof parsed.data;
  const providerMessages = createProviderMessages(continuedRequest);
  const providerAssistant = providerMessages.find(
    (message) => message.role === "assistant",
  ) as { tool_calls?: Array<{ function: { name: string } }> } | undefined;
  assert.equal(providerAssistant?.tool_calls?.[0]?.function.name, "poi_search");
  assert.match(
    String(providerMessages[0]?.content),
    /poi_search is no longer available/i,
  );
  const continuedProviderRequest = createTripDraftProviderRequest(
    continuedRequest,
    {
      maxTokens: 5_000,
      model: "thinking-model",
      temperature: 0.4,
    },
  );
  assert.deepEqual(continuedProviderRequest.tool_choice, {
    function: { name: "waylog_trip_draft" },
    type: "function",
  });
  assert.deepEqual(
    continuedProviderRequest.tools.map((tool) => tool.function.name),
    ["waylog_trip_draft"],
  );
  assert.equal(
    JSON.stringify(continuedProviderRequest.tools).includes('"latitude"'),
    false,
  );
  assert.equal(
    JSON.stringify(continuedProviderRequest.tools).includes('"maxItems":1'),
    true,
  );

  const poiEvents = createProxyEventsFromProviderResponse(
    {
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  arguments: JSON.stringify({
                    result: {
                      kind: "search",
                      query: "云南 石林",
                      semantics: {
                        cities: ["昆明"],
                        companions: [],
                        confidence: 0.96,
                        dateExpression: "下周",
                        dateResolution: { kind: "next_week" },
                        dayCount: 3,
                        destination: "云南",
                        missingFields: [],
                        preferences: [],
                        semanticTitle: "云南三日游",
                      },
                    },
                  }),
                  name: "waylog_trip_draft_semantics",
                },
                id: "poi-provider-name",
                type: "function",
              },
            ],
          },
        },
      ],
    },
    ["poi.search", "waylog_trip_draft"],
  );
  const poiToolCallEvent = poiEvents.find(
    (event) => event.type === "toolcall_end",
  ) as
    | {
        toolCall?: {
          arguments?: { verifiedSemantics?: { destination?: string } };
          name?: string;
        };
      }
    | undefined;
  assert.equal(poiToolCallEvent?.toolCall?.name, "poi.search");
  assert.equal(
    poiToolCallEvent?.toolCall?.arguments?.verifiedSemantics?.destination,
    "云南",
  );

  assert.throws(() =>
    createProxyEventsFromProviderResponse(
      tripDraftProviderResponse({
        result: {
          draft: {
            assumptions: [],
            createdAt: "2026-08-29T08:00:00.000Z",
            dayCount: 3,
            days: [
              { dayIndex: 1, items: [], title: "第一天" },
              { dayIndex: 2, items: [], title: "第二天" },
              { dayIndex: 3, items: [], title: "第三天" },
            ],
            destination: "四川",
            draftId: "mismatched-semantics",
            title: "四川三日游",
            updatedAt: "2026-08-29T08:00:00.000Z",
            warnings: [],
          },
          kind: "trip_draft",
          semantics: {
            cities: [],
            companions: [],
            confidence: 0.96,
            dateExpression: "下周",
            dateResolution: { kind: "next_week" },
            dayCount: 3,
            destination: "四川",
            missingFields: [],
            preferences: [],
            semanticTitle: "四川三日游",
          },
        },
      }),
      "waylog_trip_draft",
      {
        cities: ["昆明"],
        companions: [],
        confidence: 0.96,
        dateExpression: "下周",
        dateResolution: { kind: "next_week" },
        dayCount: 3,
        destination: "云南",
        missingFields: [],
        preferences: [],
        semanticTitle: "云南三日游",
      },
    ),
  );

  const semanticClarificationEvents = createProxyEventsFromProviderResponse(
    {
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  arguments: JSON.stringify({
                    result: {
                      clarification: {
                        question: "你想在云南玩几天？",
                        requestedField: "dayCount",
                        responseContract: {
                          kind: "day_count",
                          maximum: 14,
                          minimum: 1,
                        },
                      },
                      kind: "clarification",
                      semantics: {
                        cities: [],
                        companions: [],
                        confidence: 0.88,
                        dateExpression: "下周",
                        dateResolution: { kind: "next_week" },
                        destination: "云南",
                        missingFields: ["dayCount"],
                        preferences: [],
                      },
                    },
                  }),
                  name: "waylog_trip_draft_semantics",
                },
                id: "semantic-clarification",
                type: "function",
              },
            ],
          },
        },
      ],
    },
    ["poi.search", "waylog_trip_draft"],
  );
  const semanticClarificationToolCall = semanticClarificationEvents.find(
    (event) => event.type === "toolcall_end",
  ) as
    | {
        toolCall?: {
          arguments?: {
            result?: { clarification?: { requestedField?: string } };
          };
          name?: string;
        };
      }
    | undefined;
  assert.equal(
    semanticClarificationToolCall?.toolCall?.name,
    "waylog_trip_draft",
  );
  assert.equal(
    semanticClarificationToolCall?.toolCall?.arguments?.result?.clarification
      ?.requestedField,
    "dayCount",
  );

  assert.throws(() =>
    createProxyEventsFromProviderResponse(
      {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    arguments: JSON.stringify({
                      result: {
                        kind: "search",
                        query: "云南 景点",
                        semantics: {
                          cities: [],
                          companions: [],
                          confidence: 0.5,
                          dateExpression: "下周",
                          dateResolution: { kind: "next_week" },
                          destination: "云南",
                          missingFields: ["dayCount"],
                          preferences: [],
                        },
                      },
                    }),
                    name: "waylog_trip_draft_semantics",
                  },
                  id: "semantic-default-day-count",
                  type: "function",
                },
              ],
            },
          },
        ],
      },
      ["poi.search", "waylog_trip_draft"],
    ),
  );

  assert.equal(
    parseAgentLlmProxyRequest({
      ...validTripDraftRequest,
      context: {
        ...validTripDraftRequest.context,
        tools: validTripDraftRequest.context.tools.slice(1),
      },
    }).ok,
    false,
  );
  assert.equal(
    parseAgentLlmProxyRequest({
      ...validTripDraftRequest,
      context: {
        ...validTripDraftRequest.context,
        tools: [
          ...validTripDraftRequest.context.tools,
          {
            description: "Forbidden write",
            name: "trip.create",
            parameters: { properties: {}, type: "object" },
          },
        ],
      },
    }).ok,
    false,
  );
});

test("trip.draft Edge contract requires one paired poi.search history entry", () => {
  const verifiedSemantics = {
    cities: ["昆明"],
    companions: [],
    confidence: 0.96,
    dateExpression: "下周",
    dateResolution: { kind: "next_week" },
    dayCount: 3,
    destination: "云南",
    missingFields: [],
    preferences: [],
    semanticTitle: "云南三日游",
  };
  const poiPair = (index: number) => [
    {
      content: [
        {
          arguments: {
            limit: 3,
            query: `云南 景点 ${index}`,
            verifiedSemantics,
          },
          id: `poi-call-${index}`,
          name: "poi.search",
          type: "toolCall",
        },
      ],
      role: "assistant",
    },
    {
      content: [{ text: '{"candidates":[]}', type: "text" }],
      role: "toolResult",
      toolCallId: `poi-call-${index}`,
      toolName: "poi.search",
    },
  ];
  const withinBudget = parseAgentLlmProxyRequest({
    ...validTripDraftRequest,
    context: {
      ...validTripDraftRequest.context,
      messages: [...validTripDraftRequest.context.messages, ...poiPair(0)],
    },
  });
  assert.equal(withinBudget.ok, true);

  assert.equal(
    parseAgentLlmProxyRequest({
      ...validTripDraftRequest,
      context: {
        ...validTripDraftRequest.context,
        messages: [
          ...validTripDraftRequest.context.messages,
          {
            content: [{ text: '{"candidates":[]}', type: "text" }],
            role: "toolResult",
            toolCallId: "orphan-poi",
            toolName: "poi.search",
          },
        ],
      },
    }).ok,
    false,
  );
  assert.equal(
    parseAgentLlmProxyRequest({
      ...validTripDraftRequest,
      context: {
        ...validTripDraftRequest.context,
        messages: [
          ...validTripDraftRequest.context.messages,
          poiPair(0)[0],
          { ...poiPair(0)[1], toolCallId: "mismatched-poi" },
        ],
      },
    }).ok,
    false,
  );

  assert.equal(
    parseAgentLlmProxyRequest({
      ...validTripDraftRequest,
      context: {
        ...validTripDraftRequest.context,
        messages: [
          ...validTripDraftRequest.context.messages,
          {
            content: [
              {
                arguments: {
                  category: "夜生活",
                  query: "云南 酒吧",
                  verifiedSemantics,
                },
                id: "poi-invalid-category",
                name: "poi.search",
                type: "toolCall",
              },
            ],
            role: "assistant",
          },
        ],
      },
    }).ok,
    false,
  );

  assert.equal(
    parseAgentLlmProxyRequest({
      ...validTripDraftRequest,
      context: {
        ...validTripDraftRequest.context,
        messages: [
          ...validTripDraftRequest.context.messages,
          ...poiPair(0),
          ...poiPair(1),
        ],
      },
    }).ok,
    false,
  );
  assert.equal(
    parseAgentLlmProxyRequest({
      ...validTripDraftRequest,
      context: {
        ...validTripDraftRequest.context,
        messages: [
          ...validTripDraftRequest.context.messages,
          {
            content: [
              {
                arguments: { query: "云南", verifiedSemantics, write: true },
                id: "tampered-poi-call",
                name: "poi.search",
                type: "toolCall",
              },
            ],
            role: "assistant",
          },
        ],
      },
    }).ok,
    false,
  );
});

test("LLM proxy gives itinerary.edit read-only Trip context and a proposal-only schema", () => {
  const parsed = parseAgentLlmProxyRequest(validItineraryEditRequest);

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.data.phase, "itinerary_edit");
  assert.deepEqual(
    parsed.data.context.tools.map((tool) => tool.name),
    ["poi.search", "waylog_trip_edit_proposal"],
  );
  assert.deepEqual(getExpectedProviderToolNames(parsed.data), [
    "poi.search",
    "waylog_trip_edit_proposal",
  ]);
  assert.match(buildItineraryEditSystemPrompt(), /proposal preview/i);
  assert.match(buildItineraryEditSystemPrompt(), /never apply/i);
  assert.match(buildItineraryEditSystemPrompt(), /poi_search/i);
  assert.match(buildItineraryEditSystemPrompt(), /conventional venue suffix/i);

  const providerRequest = createItineraryEditProviderRequest(parsed.data, {
    maxTokens: 2_000,
    model: "thinking-model",
    temperature: 0.4,
  });
  assert.equal(providerRequest.max_tokens, 1_600);
  assert.deepEqual(
    providerRequest.tools.map((tool) => tool.function.name),
    ["poi_search", "waylog_trip_edit_proposal"],
  );
  assert.equal(
    JSON.stringify(providerRequest).includes("waylog_answer"),
    false,
  );
});

test("itinerary.edit Edge contract accepts at most three paired poi.search calls", () => {
  const poiPair = (index: number) => [
    {
      content: [
        {
          arguments: { limit: 3, query: `昆明 地点 ${index}` },
          id: `itinerary-poi-${index}`,
          name: "poi.search",
          type: "toolCall",
        },
      ],
      role: "assistant",
    },
    {
      content: [{ text: '{"candidates":[]}', type: "text" }],
      role: "toolResult",
      toolCallId: `itinerary-poi-${index}`,
      toolName: "poi.search",
    },
  ];
  const threePairs = [0, 1, 2].flatMap(poiPair);

  assert.equal(
    parseAgentLlmProxyRequest({
      ...validItineraryEditRequest,
      context: {
        ...validItineraryEditRequest.context,
        messages: [
          ...validItineraryEditRequest.context.messages,
          ...threePairs,
        ],
      },
    }).ok,
    true,
  );
  assert.equal(
    parseAgentLlmProxyRequest({
      ...validItineraryEditRequest,
      context: {
        ...validItineraryEditRequest.context,
        messages: [
          ...validItineraryEditRequest.context.messages,
          ...threePairs,
          ...poiPair(3),
        ],
      },
    }).ok,
    false,
  );
});

test("LLM proxy rejects oversized or structurally unbounded message content", () => {
  assert.equal(
    parseAgentLlmProxyRequest({
      ...validRequest,
      context: {
        ...validRequest.context,
        messages: [
          {
            content: [{ text: "x".repeat(4_001), type: "text" }],
            role: "assistant",
          },
        ],
      },
    }).ok,
    false,
  );
  assert.equal(
    parseAgentLlmProxyRequest({
      ...validRequest,
      context: {
        ...validRequest.context,
        messages: [
          {
            content: Array.from({ length: 17 }, () => ({
              text: "bounded result",
              type: "text",
            })),
            role: "toolResult",
            toolCallId: "tool-call-1",
            toolName: "weather.get",
          },
        ],
      },
    }).ok,
    false,
  );
});

test("LLM proxy derives the account identity from JWT through Supabase Auth", async () => {
  let requestedAuthorization = "";
  const result = await authenticateAgentProxyRequest({
    anonKey: "public-anon-key",
    authHeader: "Bearer signed-user-jwt",
    fetcher: async (_url, init) => {
      requestedAuthorization = String(
        (init?.headers as Record<string, string>).Authorization,
      );
      return new Response(JSON.stringify({ id: "account-from-jwt" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    },
    supabaseUrl: "https://example.supabase.co",
  });

  assert.deepEqual(result, { ok: true, userId: "account-from-jwt" });
  assert.equal(requestedAuthorization, "Bearer signed-user-jwt");
});

test("provider output becomes a terminating answer tool proxy stream", () => {
  const events = createProxyEventsFromProviderResponse({
    choices: [
      {
        finish_reason: "tool_calls",
        message: {
          tool_calls: [
            {
              function: {
                arguments: '{"answer":{"text":"西湖与运河各安排一天。"}}',
                name: "waylog_answer",
              },
              id: "answer-call-1",
              type: "function",
            },
          ],
        },
      },
    ],
    usage: { completion_tokens: 12, prompt_tokens: 18, total_tokens: 30 },
  });

  assert.equal(events[0]?.type, "start");
  assert.equal(events.at(-1)?.type, "done");
  assert.equal(JSON.stringify(events).includes("waylog_answer"), true);
  assert.equal(JSON.stringify(events).includes("西湖与运河各安排一天"), true);
});

test("provider output becomes a distinct terminating route tool proxy stream", () => {
  const events = createProxyEventsFromProviderResponse(
    {
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            tool_calls: [
              {
                function: {
                  arguments: JSON.stringify({
                    route: {
                      confidence: 0.96,
                      missingSlots: [],
                      routeKind: "skill",
                      scope: "in_scope",
                      skillId: "waylog.qa",
                    },
                  }),
                  name: "waylog_route",
                },
                id: "route-call-1",
                type: "function",
              },
            ],
          },
        },
      ],
      usage: { completion_tokens: 8, prompt_tokens: 22, total_tokens: 30 },
    },
    "waylog_route",
  );

  assert.equal(events[0]?.type, "start");
  assert.equal(events.at(-1)?.type, "done");
  assert.equal(JSON.stringify(events).includes("waylog_route"), true);
  assert.equal(JSON.stringify(events).includes("waylog_answer"), false);

  assert.throws(
    () =>
      createProxyEventsFromProviderResponse(
        {
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      arguments: JSON.stringify({
                        route: {
                          confidence: 0.96,
                          missingSlots: [],
                          operation: { type: "create_trip" },
                          routeKind: "skill",
                          scope: "in_scope",
                          skillId: "trip.draft",
                        },
                      }),
                      name: "waylog_route",
                    },
                    id: "unsafe-route-call",
                  },
                ],
              },
            },
          ],
        },
        "waylog_route",
      ),
    /invalid terminating tool arguments/i,
  );
});

test("route provider output normalizes nullable optional fields without semantic fallback", () => {
  const events = createProxyEventsFromProviderResponse(
    {
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  arguments: JSON.stringify({
                    route: {
                      confidence: 0.96,
                      handler: null,
                      missingSlots: [],
                      publicMessage: null,
                      routeKind: "skill",
                      scope: "in_scope",
                      skillId: "trip.draft",
                    },
                  }),
                  name: "waylog_route",
                },
                id: "nullable-route-call",
                type: "function",
              },
            ],
          },
        },
      ],
    },
    "waylog_route",
  );
  const serialized = JSON.stringify(events);

  assert.equal(serialized.includes('"skillId":"trip.draft"'), true);
  assert.equal(serialized.includes('"handler":null'), false);
  assert.equal(serialized.includes('"publicMessage":null'), false);

  assert.throws(
    () =>
      createProxyEventsFromProviderResponse(
        {
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      arguments: JSON.stringify({
                        route: {
                          confidence: 0.96,
                          handler: "clarification",
                          missingSlots: [],
                          routeKind: "skill",
                          scope: "in_scope",
                          skillId: "trip.draft",
                        },
                      }),
                      name: "waylog_route",
                    },
                    id: "contradictory-route-call",
                  },
                ],
              },
            },
          ],
        },
        "waylog_route",
      ),
    /invalid terminating tool arguments/i,
  );
});

test("provider output preserves trip.draft and itinerary.edit terminating payloads", () => {
  const tripDraftEvents = createProxyEventsFromProviderResponse(
    {
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  arguments: JSON.stringify({
                    result: {
                      draft: {
                        assumptions: [],
                        createdAt: "2026-08-29T08:00:00.000Z",
                        dayCount: 1,
                        days: [{ dayIndex: 1, items: [], title: "第一天" }],
                        destination: "杭州",
                        draftId: "draft-1",
                        title: "杭州一日游",
                        updatedAt: "2026-08-29T08:00:00.000Z",
                        warnings: [],
                      },
                      kind: "trip_draft",
                      semantics: {
                        cities: ["杭州"],
                        companions: [],
                        confidence: 0.95,
                        dateExpression: null,
                        dateResolution: { kind: "none" },
                        dayCount: 1,
                        destination: "杭州",
                        missingFields: [],
                        preferences: [],
                        semanticTitle: "杭州一日游",
                      },
                    },
                  }),
                  name: "waylog_trip_draft",
                },
                id: "trip-draft-call-1",
                type: "function",
              },
            ],
          },
        },
      ],
    },
    "waylog_trip_draft",
  );
  const itineraryEditEvents = createProxyEventsFromProviderResponse(
    {
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  arguments: JSON.stringify({
                    proposal: {
                      expectedUpdatedAt: "2026-08-29T08:00:00.000Z",
                      operations: [
                        {
                          dayId: "day-1",
                          itemId: "item-1",
                          operationId: "operation-1",
                          tripId: "trip-1",
                          type: "remove_day_item",
                        },
                      ],
                      proposalId: "proposal-1",
                      summary: "删除西湖",
                      tripId: "trip-1",
                    },
                  }),
                  name: "waylog_trip_edit_proposal",
                },
                id: "trip-edit-call-1",
                type: "function",
              },
            ],
          },
        },
      ],
    },
    "waylog_trip_edit_proposal",
  );

  assert.equal(JSON.stringify(tripDraftEvents).includes("draft-1"), true);
  assert.equal(
    JSON.stringify(itineraryEditEvents).includes("proposal-1"),
    true,
  );
  assert.equal(tripDraftEvents.at(-1)?.type, "done");
  assert.equal(itineraryEditEvents.at(-1)?.type, "done");
});

test("trip.draft provider output accepts typed clarification and rejects mixed results", () => {
  const clarification = {
    result: {
      clarification: {
        question: "这次想玩几天？",
        requestedField: "dayCount",
        responseContract: { kind: "day_count", maximum: 14, minimum: 1 },
      },
      kind: "clarification",
      semantics: {
        cities: ["昆明"],
        companions: [],
        confidence: 0.92,
        dateExpression: "下周",
        dateResolution: { kind: "next_week" },
        destination: "云南",
        missingFields: ["dayCount"],
        preferences: [],
      },
    },
  };
  const providerResponse = (argumentsValue: unknown) => ({
    choices: [
      {
        message: {
          tool_calls: [
            {
              function: {
                arguments: JSON.stringify(argumentsValue),
                name: "waylog_trip_draft",
              },
              id: "trip-draft-clarification",
              type: "function",
            },
          ],
        },
      },
    ],
  });

  const clarificationEvents = createProxyEventsFromProviderResponse(
    providerResponse(clarification),
    ["poi.search", "waylog_trip_draft"],
  );
  assert.equal(clarificationEvents.at(-1)?.type, "done");
  assert.throws(
    () =>
      createProxyEventsFromProviderResponse(
        providerResponse({
          result: {
            ...clarification.result,
            draft: { destination: "云南" },
          },
        }),
        ["poi.search", "waylog_trip_draft"],
      ),
    /invalid.*arguments/i,
  );
});

test("LLM proxy uses thinking-compatible automatic tool selection", () => {
  const parsed = parseAgentLlmProxyRequest(validRequest);

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const request = createWayLogQaProviderRequest(parsed.data, {
    maxTokens: 1_200,
    model: "thinking-model",
    temperature: 0.2,
  });

  assert.equal(request.tool_choice, "auto");
  assert.deepEqual(
    request.tools.map((tool) => tool.function.name),
    ["waylog_answer"],
  );
});
