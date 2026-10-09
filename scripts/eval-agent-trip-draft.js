#!/usr/bin/env node

const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const PROJECT_ROOT = process.cwd();
const { parseTripDraftSkillTermination } = require(
  join(
    PROJECT_ROOT,
    ".tmp-test-dist/features/agent/trip-draft-skill-result.js",
  ),
);
const {
  isTripDraftPoiGeographicallyConsistent,
  runProposalGeneration,
} = require(
  join(PROJECT_ROOT, ".tmp-test-dist/features/agent/proposal-generation.js"),
);
const { createPiProxyStreamFn } = require(
  join(PROJECT_ROOT, ".tmp-test-dist/features/agent/pi-proxy-stream.js"),
);
const {
  createProxyEventsFromProviderResponse,
  createTripDraftProviderRequest,
  getTripDraftVerifiedSemantics,
} = require(
  join(
    PROJECT_ROOT,
    ".tmp-test-dist/supabase/functions/agent-llm-proxy/contract.js",
  ),
);
const DEFAULT_REQUEST_DELAY_MS = 10_500;
const MAX_RATE_LIMIT_RETRIES = 6;
const MAX_TOOL_CALLS = 8;
const envLocal = loadEnvFile(join(PROJECT_ROOT, ".env.local"));
const corpus = JSON.parse(
  readFileSync(
    join(PROJECT_ROOT, "scripts/fixtures/agent-trip-draft-corpus.json"),
    "utf8",
  ),
);

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl = normalizeUrl(
    args.url ||
      getEnv("AGENT_TURN_SUPABASE_URL") ||
      getEnv("EXPO_PUBLIC_SUPABASE_URL"),
  );
  const anonKey =
    args.anonKey ||
    getEnv("AGENT_TURN_ANON_KEY") ||
    getEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  let token = args.token || getEnv("AGENT_TURN_ACCESS_TOKEN");

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      "缺少 Supabase URL 或 anon key，无法运行 Trip Draft eval。",
    );
  }
  if (!token) {
    token = await signInForAccessToken({
      anonKey,
      email: args.email || getEnv("AGENT_TURN_EMAIL"),
      password: args.password || getEnv("AGENT_TURN_PASSWORD"),
      supabaseUrl,
    });
  }
  if (!token) {
    throw new Error(
      "缺少测试用户凭据。请提供 --token，或配置 AGENT_TURN_EMAIL / AGENT_TURN_PASSWORD。",
    );
  }

  const requestDelayMs = readNonNegativeNumber(
    args.delayMs ?? getEnv("AGENT_TRIP_DRAFT_EVAL_DELAY_MS"),
    DEFAULT_REQUEST_DELAY_MS,
  );
  const input = {
    anonKey,
    endpoint: `${supabaseUrl}/functions/v1/agent-llm-proxy`,
    rateLimitRetryDelayMs: Math.max(requestDelayMs, 10_500),
    supabaseUrl,
    token,
  };
  if (args.directProvider) {
    input.provider = {
      apiKey: getEnv("AGENT_LLM_API_KEY"),
      baseUrl: normalizeUrl(getEnv("AGENT_LLM_BASE_URL")),
      maxTokens: Math.max(Number(getEnv("AGENT_LLM_MAX_TOKENS")) || 0, 4_096),
      model: getEnv("AGENT_LLM_MODEL"),
      temperature: Number(getEnv("AGENT_LLM_TEMPERATURE")) || 0,
    };
    if (
      !input.provider.apiKey ||
      !input.provider.baseUrl ||
      !input.provider.model
    ) {
      throw new Error("缺少正式模型配置，无法运行供应商预检。");
    }
  }
  const selectedCorpus = args.fixture
    ? corpus.filter((fixture) => fixture.id === args.fixture)
    : corpus;
  if (selectedCorpus.length === 0) {
    throw new Error(`找不到正式语料：${args.fixture}`);
  }
  let passed = 0;

  for (const [index, fixture] of selectedCorpus.entries()) {
    if (index > 0 && requestDelayMs > 0) await delay(requestDelayMs);
    let outcome;
    try {
      outcome = fixture.simulatePoiFailure
        ? await runFormalToolFailureFixture(input, fixture)
        : await runFixture(input, fixture);
    } catch (error) {
      outcome = {
        error: error instanceof Error ? error.message : String(error),
        kind: fixture.simulatePoiFailure
          ? "formal_eval_failure"
          : "retryable_failure",
        originalInput: fixture.message,
      };
    }
    const ok = matchesExpected(outcome, fixture.expected);
    process.stdout.write(
      `${ok ? "PASS" : "FAIL"} ${fixture.id} ${JSON.stringify(outcome)}\n`,
    );
    if (ok) passed += 1;
  }

  process.stdout.write(
    `Trip Draft eval: ${passed}/${selectedCorpus.length} passed\n`,
  );
  if (passed !== selectedCorpus.length) process.exitCode = 1;
}

async function runFixture(input, fixture) {
  const referenceTime = fixture.referenceTime || "2026-08-29T08:00:00.000Z";
  const turnReference = { referenceTime, timeZone: "Asia/Shanghai" };
  const messages = [
    {
      content: JSON.stringify({
        kind: "waylog_trip_draft_request",
        originalInput: fixture.message,
        turnReference,
      }),
      role: "user",
    },
  ];
  const verifiedPois = new Map();

  for (
    let toolCallCount = 0;
    toolCallCount <= MAX_TOOL_CALLS;
    toolCallCount += 1
  ) {
    const toolCall = await requestModel(input, messages);
    if (toolCall.name === "waylog_trip_draft") {
      const parsed = parseTripDraftSkillTermination(
        toolCall.arguments?.result,
        turnReference,
      );
      if (!parsed.ok) {
        throw new Error(`正式结果未通过共享运行时解析器：${parsed.error}`);
      }
      if (parsed.data.kind === "trip_draft") {
        const items = parsed.data.draft.days.flatMap((day) => day.items || []);
        const groundingFailures = items.map((item) =>
          getFormalPoiGroundingFailure(
            item,
            parsed.data.semantics,
            verifiedPois,
          ),
        );
        if (items.length === 0 || groundingFailures.some(Boolean)) {
          const identityFailures = groundingFailures.filter(
            (failure) => failure === "identity",
          ).length;
          const geographyFailures = groundingFailures.filter(
            (failure) => failure === "geography",
          ).length;
          throw new Error(
            `模型草案包含未经真实 poi.search 核验的地点（verified=${verifiedPois.size}, identity=${identityFailures}, geography=${geographyFailures}）。`,
          );
        }
      }
      return parsed.data;
    }
    if (toolCall.name !== "poi.search" || toolCallCount === MAX_TOOL_CALLS) {
      throw new Error("Trip Draft 使用了未授权工具或超过调用预算。");
    }
    const candidates = await searchAmap(input, toolCall.arguments);
    for (const candidate of candidates) {
      verifiedPois.set(`${candidate.provider}:${candidate.providerPlaceId}`, {
        candidate,
        queryText: [toolCall.arguments?.query, toolCall.arguments?.regionText]
          .filter(Boolean)
          .join(" "),
      });
    }
    messages.push(
      {
        content: [
          {
            arguments: toolCall.arguments,
            id: toolCall.id,
            name: "poi.search",
            type: "toolCall",
          },
        ],
        role: "assistant",
      },
      {
        content: [{ text: JSON.stringify({ candidates }), type: "text" }],
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: "poi.search",
      },
    );
  }
  throw new Error("Trip Draft 未在有界工具循环内终止。");
}

async function runFormalToolFailureFixture(input, fixture) {
  let failingToolExecuted = false;
  let skillModelError;
  const values = new Map();
  const storage = {
    getAllKeys: async () => [...values.keys()],
    getItem: async (key) => values.get(key) ?? null,
    removeItem: async (key) => {
      values.delete(key);
    },
    setItem: async (key, value) => {
      values.set(key, value);
    },
  };
  const result = await runProposalGeneration(
    {
      accountId: "formal-trip-draft-eval",
      conversationId: `formal-${fixture.id}`,
      timeZone: "Asia/Shanghai",
      userMessage: fixture.message,
    },
    {
      clock: () => fixture.referenceTime || "2026-08-29T08:00:00.000Z",
      ids: { turn: () => `formal-turn-${fixture.id}` },
      routeModel: () =>
        terminatingStream("waylog_route", {
          route: {
            confidence: 1,
            missingSlots: [],
            routeKind: "skill",
            scope: "in_scope",
            skillId: "trip.draft",
          },
        }),
      skillModel: createFormalSkillModel(input, (error) => {
        skillModelError =
          error instanceof Error ? error.message : String(error);
      }),
      storage,
      tools: [
        {
          id: "poi.search",
          publicName: "搜索真实地点",
          tool: {
            description: "Controlled failing POI search for formal acceptance.",
            execute: async () => {
              failingToolExecuted = true;
              throw new Error("Controlled poi.search failure.");
            },
            label: "搜索真实地点",
            name: "poi.search",
            parameters: {
              additionalProperties: false,
              properties: {
                query: { minLength: 1, type: "string" },
                verifiedSemantics: { type: "object" },
              },
              required: ["query"],
              type: "object",
            },
          },
        },
      ],
    },
  );
  if (
    !failingToolExecuted ||
    result.resultType !== "failure" ||
    !result.retryable
  ) {
    throw new Error(
      `真实 Runtime 未把受控 poi.search 失败转换为可重试结果（executed=${failingToolExecuted}, resultType=${result.resultType}, retryable=${result.resultType === "failure" ? result.retryable : false}, error=${result.resultType === "failure" ? result.error : "none"}, modelError=${skillModelError ?? "none"}）。`,
    );
  }
  return {
    error: result.error,
    kind: "retryable_failure",
    originalInput: result.userMessage,
  };
}

function createFormalSkillModel(input, onError) {
  if (!input.provider) {
    return createPiProxyStreamFn({
      accessToken: input.token,
      anonKey: input.anonKey,
      phase: "trip_draft",
      promptVersion: "trip-draft.v1",
      url: input.endpoint,
    });
  }
  return (_model, context) =>
    deferredTerminatingStream(async () => {
      try {
        return await requestModel(input, context.messages);
      } catch (error) {
        onError?.(error);
        throw error;
      }
    });
}

function deferredTerminatingStream(loadToolCall) {
  const messagePromise = Promise.resolve()
    .then(loadToolCall)
    .then((toolCall) => createAssistantToolCallMessage(toolCall));
  return {
    async *[Symbol.asyncIterator]() {
      const message = await messagePromise;
      yield { partial: { ...message, content: [] }, type: "start" };
      yield { partial: message, type: "toolcall_end" };
      yield { message, reason: "toolUse", type: "done" };
    },
    result: () => messagePromise,
  };
}

function terminatingStream(name, argumentsValue) {
  return deferredTerminatingStream(async () => ({
    arguments: argumentsValue,
    id: `${name}-formal-call`,
    name,
  }));
}

function createAssistantToolCallMessage(toolCall) {
  return {
    api: "waylog-proxy",
    content: [{ ...toolCall, type: "toolCall" }],
    model: "formal-eval",
    provider: "waylog",
    role: "assistant",
    stopReason: "toolUse",
    timestamp: Date.parse("2026-08-29T08:00:00.000Z"),
    usage: {
      cacheRead: 0,
      cacheWrite: 0,
      cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0 },
      input: 0,
      output: 0,
      totalTokens: 0,
    },
  };
}

function getFormalPoiGroundingFailure(item, semantics, verifiedPois) {
  const provenance = verifiedPois.get(
    `${item.provider}:${item.providerPlaceId}`,
  );
  if (!provenance) return "identity";
  return isTripDraftPoiGeographicallyConsistent(
    provenance.candidate,
    provenance.queryText,
    semantics,
  )
    ? undefined
    : "geography";
}

async function requestModel(input, messages, retryCount = 0) {
  if (input.provider) {
    return requestProviderDirect(input.provider, messages);
  }
  const proxyRequest = createProxyRequest(messages);
  const response = await fetch(input.endpoint, {
    body: JSON.stringify(proxyRequest),
    headers: {
      apikey: input.anonKey,
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const body = await response.text();
  if (response.status === 429 && retryCount < MAX_RATE_LIMIT_RETRIES) {
    await delay(input.rateLimitRetryDelayMs);
    return requestModel(input, messages, retryCount + 1);
  }
  if (!response.ok) {
    throw new Error(
      `Trip Draft eval 请求失败（HTTP ${response.status}）：${body}`,
    );
  }
  const events = parseSseEvents(body);
  const event = events.find((candidate) => candidate.type === "toolcall_end");
  const toolCall = event?.toolCall;
  if (!toolCall?.name || !toolCall?.id || !toolCall.arguments) {
    throw new Error(`Trip Draft eval 没有返回结构化工具调用：${body}`);
  }
  return toolCall;
}

async function requestProviderDirect(provider, messages) {
  const proxyRequest = createProxyRequest(messages);
  const providerRequest = createTripDraftProviderRequest(
    proxyRequest,
    provider,
  );
  const hasPoiResult = messages.some(
    (message) =>
      message.role === "toolResult" && message.toolName === "poi.search",
  );
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      body: JSON.stringify(providerRequest),
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`正式模型预检请求失败（HTTP ${response.status}）。`);
    }
    const payload = await response.json();
    try {
      const events = createProxyEventsFromProviderResponse(
        payload,
        hasPoiResult
          ? "waylog_trip_draft"
          : ["poi.search", "waylog_trip_draft"],
        getTripDraftVerifiedSemantics(proxyRequest),
      );
      const event = events.find(
        (candidate) => candidate.type === "toolcall_end",
      );
      if (event?.toolCall) return event.toolCall;
      lastError = new Error("正式模型预检没有返回结构化工具调用。");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("正式模型预检失败。");
}

function createProxyRequest(messages) {
  return {
    context: {
      messages,
      tools: [
        {
          description: "Search verified POIs.",
          name: "poi.search",
          parameters: { properties: {}, type: "object" },
        },
        {
          description: "Return TripDraft or Clarification.",
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
}

async function searchAmap(input, parameters) {
  const query =
    typeof parameters?.query === "string" ? parameters.query.trim() : "";
  if (!query) throw new Error("poi.search query 无效。");
  const response = await fetch(`${input.supabaseUrl}/functions/v1/amap-proxy`, {
    body: JSON.stringify({
      path: "/v5/place/text",
      params: {
        city_limit: "false",
        keywords: query,
        page_num: "1",
        page_size: String(Math.min(6, parameters.limit || 6)),
        region: parameters.regionText || undefined,
        show_fields: "business",
      },
    }),
    headers: {
      apikey: input.anonKey,
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok || payload?.status !== "1" || !Array.isArray(payload.pois)) {
    throw new Error(`poi.search 正式调用失败（HTTP ${response.status}）。`);
  }
  return payload.pois.slice(0, 6).flatMap((poi) => {
    const providerPlaceId = readString(poi?.id);
    const name = readString(poi?.name);
    if (!providerPlaceId || !name) return [];
    const [longitude, latitude] =
      readString(poi.location)?.split(",").map(Number) || [];
    return [
      {
        address: readString(poi.address),
        area: [poi.pname, poi.cityname, poi.adname]
          .map(readString)
          .filter(Boolean)
          .join(" · "),
        city: readString(poi.cityname),
        latitude: Number.isFinite(latitude) ? latitude : undefined,
        longitude: Number.isFinite(longitude) ? longitude : undefined,
        name,
        poiType: readString(poi.type),
        provider: "amap",
        providerPlaceId,
      },
    ];
  });
}

function matchesExpected(outcome, expected) {
  if (outcome.kind !== expected.kind) return false;
  if (
    outcome.kind === "retryable_failure" &&
    (!outcome.originalInput || !outcome.error)
  )
    return false;
  if (
    expected.requestedField &&
    outcome.clarification?.requestedField !== expected.requestedField
  )
    return false;
  if (
    expected.destination &&
    outcome.semantics?.destination !== expected.destination
  )
    return false;
  if (
    expected.destinationIncludes &&
    !outcome.semantics?.destination
      ?.toLowerCase()
      .includes(expected.destinationIncludes.toLowerCase())
  )
    return false;
  if (expected.dayCount && outcome.semantics?.dayCount !== expected.dayCount)
    return false;
  if (
    expected.titleExcludes &&
    outcome.semantics?.semanticTitle?.includes(expected.titleExcludes)
  )
    return false;
  if (
    expected.resolvedStartDate &&
    outcome.semantics?.resolvedDateRange?.startDate !==
      expected.resolvedStartDate
  )
    return false;
  if (
    expected.resolvedEndDate &&
    outcome.semantics?.resolvedDateRange?.endDate !== expected.resolvedEndDate
  )
    return false;
  if (
    expected.dateExpressionIncludes &&
    !outcome.semantics?.dateExpression?.includes(
      expected.dateExpressionIncludes,
    )
  )
    return false;
  if (
    expected.companionsInclude &&
    !includesText(outcome.semantics?.companions, expected.companionsInclude)
  )
    return false;
  if (
    expected.preferencesInclude &&
    !includesText(outcome.semantics?.preferences, expected.preferencesInclude)
  )
    return false;
  if (
    outcome.kind === "trip_draft" &&
    outcome.semantics?.missingFields?.length !== 0
  )
    return false;
  return true;
}

function includesText(values, expected) {
  return (
    Array.isArray(values) &&
    values.some((value) =>
      String(value).toLowerCase().includes(expected.toLowerCase()),
    )
  );
}

function parseSseEvents(body) {
  return body.split(/\n\n+/).flatMap((frame) =>
    frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => JSON.parse(line.slice(5).trim())),
  );
}

async function signInForAccessToken({ anonKey, email, password, supabaseUrl }) {
  if (!email || !password) return "";
  const response = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      body: JSON.stringify({ email, password }),
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      method: "POST",
    },
  );
  const payload = await response.json().catch(() => undefined);
  if (!response.ok || typeof payload?.access_token !== "string") {
    throw new Error(`测试用户登录失败（HTTP ${response.status}）。`);
  }
  return payload.access_token;
}

function parseArgs(values) {
  const args = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const next = values[index + 1];
    if (value === "--direct-provider") {
      args.directProvider = true;
      continue;
    }
    if (value === "--url") args.url = next;
    if (value === "--anon-key") args.anonKey = next;
    if (value === "--token") args.token = next;
    if (value === "--email") args.email = next;
    if (value === "--password") args.password = next;
    if (value === "--delay-ms") args.delayMs = next;
    if (value === "--fixture") args.fixture = next;
    if (value?.startsWith("--") && next !== undefined) index += 1;
  }
  return args;
}

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const values = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    values[line.slice(0, separatorIndex).trim()] = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function getEnv(name) {
  return process.env[name]?.trim() || envLocal[name] || "";
}
function normalizeUrl(value) {
  return value?.trim().replace(/\/+$/, "") || "";
}
function readString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function readNonNegativeNumber(value, fallback) {
  if (value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}
function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
