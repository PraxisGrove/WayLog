import { withSentry } from "../_shared/sentry.ts";
import { readAgentLLMConfig } from "./config.ts";
import { fetchWithTimeout } from "./http-client.ts";
import {
  consumeAgentTurnQuota,
  readAgentUsageSummary,
} from "./quota.ts";
import { authenticateAgentProxyRequest } from "./authenticate.ts";
import {
  type AgentLlmProxyEvent,
  createProxyEventsFromProviderResponse,
  createItineraryEditProviderRequest,
  createRouteSelectorProviderRequest,
  createTripDraftProviderRequest,
  createWayLogQaProviderRequest,
  getExpectedProviderToolNames,
  getTripDraftVerifiedSemantics,
  parseAgentLlmProxyRequest,
} from "./contract.ts";
import {
  AGENT_RUNTIME_PROTOCOL_VERSION,
  evaluateAgentRuntimeAvailability,
  type AgentModelProfile,
  type AgentRuntimeAvailability,
  resolveAgentRuntimeModel,
} from "./operational-controls.ts";
import {
  loadAgentRuntimeConfig,
  recordAgentRuntimeTelemetry,
} from "./operations-store.ts";
import {
  createAgentRuntimeTelemetryEvent,
  summarizeAgentProxyActivity,
  summarizeAgentProxyToolResults,
} from "./telemetry.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-waylog-agent-protocol-version, x-waylog-app-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

Deno.serve(withSentry(handleRequest, "agent-llm-proxy"));

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim() ?? "";
  const identity = await authenticateAgentProxyRequest({
    anonKey,
    authHeader,
    supabaseUrl,
  });

  if (!identity.ok) {
    return jsonResponse({ error: identity.error }, 401);
  }

  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  const operationsOptions = { serviceRoleKey, supabaseUrl };
  const configResult = await loadAgentRuntimeConfig(operationsOptions);
  const appVersion = readHeaderValue(request, "x-waylog-app-version");

  if (!configResult.ok) {
    const unavailable: AgentRuntimeAvailability = {
      available: false,
      code: "configuration_unavailable",
      message: "旅行助手配置暂时不可用，请稍后重试。",
      retryable: true,
    };
    if (request.method === "GET") {
      return jsonResponse(
        createAgentServiceStatus(0, unavailable, emptyAgentUsageSummary()),
        503,
      );
    }
    return agentUnavailableResponse(unavailable, 503);
  }
  const runtimeConfig = configResult.data;

  if (request.method === "GET") {
    const requestedProtocol = readPositiveIntegerHeader(
      request,
      "x-waylog-agent-protocol-version",
    );
    const availability = evaluateAgentRuntimeAvailability(runtimeConfig, {
      appVersion,
      protocolVersion: requestedProtocol ?? 0,
    });
    const usage = await readAgentUsageSummary(authHeader, {
      anonKey,
      dailyLimit: runtimeConfig.dailyLimit,
      supabaseUrl,
    });
    if ("error" in usage) {
      return jsonResponse({ error: usage.error }, usage.status);
    }
    return jsonResponse(
      createAgentServiceStatus(
        runtimeConfig.configVersion,
        availability,
        usage,
      ),
      200,
    );
  }

  const parsedRequest = parseAgentLlmProxyRequest(
    await request.json().catch(() => undefined),
  );

  if (!parsedRequest.ok) {
    return jsonResponse({ error: parsedRequest.error }, 400);
  }

  const availability = evaluateAgentRuntimeAvailability(runtimeConfig, {
    appVersion,
    modelProfile: parsedRequest.data.modelProfile,
    protocolVersion: parsedRequest.data.schemaVersion,
    skillId: getSkillIdForPhase(parsedRequest.data.phase),
  });
  if (!availability.available) {
    await writeTelemetry({
      appVersion,
      availability,
      identityUserId: identity.userId,
      modelProfile: parsedRequest.data.modelProfile,
      operationsOptions,
      phase: parsedRequest.data.phase,
      promptVersion: parsedRequest.data.promptVersion,
      telemetryEnabled: runtimeConfig.telemetryEnabled,
    });
    return agentUnavailableResponse(availability, 503);
  }

  const llmConfig = readAgentLLMConfig();

  if (!llmConfig) {
    return agentUnavailableResponse(
      {
        available: false,
        code: "configuration_unavailable",
        message: "旅行助手模型暂时不可用，请稍后重试。",
        retryable: true,
      },
      503,
    );
  }
  const selectedModel = resolveAgentRuntimeModel(
    runtimeConfig,
    parsedRequest.data.modelProfile as AgentModelProfile,
  );
  if (!selectedModel) {
    return agentUnavailableResponse(
      {
        available: false,
        code: "configuration_unavailable",
        message: "旅行助手模型配置暂时不可用，请稍后重试。",
        retryable: true,
      },
      503,
    );
  }
  const selectedLlmConfig = {
    ...llmConfig,
    model: selectedModel,
  };

  const providerRequest =
    parsedRequest.data.phase === "route_selector"
      ? createRouteSelectorProviderRequest(
          parsedRequest.data,
          selectedLlmConfig,
        )
      : parsedRequest.data.phase === "itinerary_edit"
        ? createItineraryEditProviderRequest(
            parsedRequest.data,
            selectedLlmConfig,
          )
        : parsedRequest.data.phase === "trip_draft"
          ? createTripDraftProviderRequest(
              parsedRequest.data,
              selectedLlmConfig,
            )
          : createWayLogQaProviderRequest(
              parsedRequest.data,
              selectedLlmConfig,
            );
  const tripDraftHasPoiResult =
    parsedRequest.data.phase === "trip_draft" &&
    parsedRequest.data.context.messages.some(
      (message) =>
        message.role === "toolResult" && message.toolName === "poi.search",
    );
  const expectedToolNames = getExpectedProviderToolNames(parsedRequest.data);
  const maximumAttempts = parsedRequest.data.phase === "trip_draft" ? 2 : 1;
  const verifiedTripDraftSemantics =
    parsedRequest.data.phase === "trip_draft"
      ? getTripDraftVerifiedSemantics(parsedRequest.data)
      : undefined;
  if (tripDraftHasPoiResult && !verifiedTripDraftSemantics) {
    return jsonResponse(
      { error: "Trip Draft semantic state is invalid." },
      400,
    );
  }

  const quota = await consumeAgentTurnQuota(authHeader, {
    anonKey,
    dailyLimit: runtimeConfig.dailyLimit,
    minuteLimit: runtimeConfig.minuteLimit,
    supabaseUrl,
  });

  if ("error" in quota) {
    return jsonResponse({ error: quota.error }, quota.status);
  }

  if (!quota.allowed) {
    await writeTelemetry({
      appVersion,
      failureKind: "quota_exceeded",
      identityUserId: identity.userId,
      modelProfile: parsedRequest.data.modelProfile,
      operationsOptions,
      phase: parsedRequest.data.phase,
      promptVersion: parsedRequest.data.promptVersion,
      telemetryEnabled: runtimeConfig.telemetryEnabled,
    });
    return jsonResponse(
      {
        error: {
          kind: "quota_exceeded",
          message:
            quota.bucket === "day"
              ? "旅行助手每日额度已用完，请稍后再试。"
              : "请求过于频繁，请稍后再试。",
          retryable: quota.bucket !== "day",
        },
        quota,
        schemaVersion: AGENT_RUNTIME_PROTOCOL_VERSION,
      },
      429,
    );
  }
  let events: AgentLlmProxyEvent[] | undefined;
  let lastSchemaError = "Invalid model output.";
  const startedAt = Date.now();

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const providerResponse = await fetchWithTimeout(
      `${selectedLlmConfig.baseUrl}/chat/completions`,
      {
        body: JSON.stringify(providerRequest),
        headers: {
          Authorization: `Bearer ${selectedLlmConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
      30_000,
    ).catch(() => undefined);

    if (!providerResponse?.ok) {
      await writeTelemetry({
        appVersion,
        durationMs: Date.now() - startedAt,
        failureKind: "model_failure",
        identityUserId: identity.userId,
        model: selectedLlmConfig.model,
        modelProfile: parsedRequest.data.modelProfile,
        operationsOptions,
        phase: parsedRequest.data.phase,
        promptVersion: parsedRequest.data.promptVersion,
        provider: selectedLlmConfig.provider,
        telemetryEnabled: runtimeConfig.telemetryEnabled,
        toolEvents: summarizeAgentProxyToolResults(
          parsedRequest.data.context.messages,
        ),
      });
      return jsonResponse({ error: "Agent model request failed." }, 502);
    }

    try {
      events = createProxyEventsFromProviderResponse(
        await providerResponse.json().catch(() => undefined),
        expectedToolNames,
        verifiedTripDraftSemantics,
      );
      break;
    } catch (error) {
      lastSchemaError =
        error instanceof Error ? error.message : "Invalid model output.";
    }
  }

  if (!events) {
    await writeTelemetry({
      appVersion,
      durationMs: Date.now() - startedAt,
      failureKind: "schema_failure",
      identityUserId: identity.userId,
      model: selectedLlmConfig.model,
      modelProfile: parsedRequest.data.modelProfile,
      operationsOptions,
      phase: parsedRequest.data.phase,
      promptVersion: parsedRequest.data.promptVersion,
      provider: selectedLlmConfig.provider,
      telemetryEnabled: runtimeConfig.telemetryEnabled,
      toolEvents: summarizeAgentProxyToolResults(
        parsedRequest.data.context.messages,
      ),
    });
    return jsonResponse({ error: lastSchemaError }, 502);
  }

  const activity = summarizeAgentProxyActivity(events);
  await writeTelemetry({
    appVersion,
    durationMs: Date.now() - startedAt,
    identityUserId: identity.userId,
    model: selectedLlmConfig.model,
    modelProfile: parsedRequest.data.modelProfile,
    operationCount: activity.operationCount,
    operationsOptions,
    phase: parsedRequest.data.phase,
    promptVersion: parsedRequest.data.promptVersion,
    provider: selectedLlmConfig.provider,
    telemetryEnabled: runtimeConfig.telemetryEnabled,
    toolEvents: [
      ...summarizeAgentProxyToolResults(parsedRequest.data.context.messages),
      ...activity.toolEvents,
    ],
    usage: activity.usage,
  });

  const body = events
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join("");

  return new Response(body, {
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
    status,
  });
}

function agentUnavailableResponse(
  availability: AgentRuntimeAvailability,
  status: number,
) {
  return jsonResponse(
    {
      availability,
      error: {
        kind: availability.code,
        message: availability.message,
        retryable: availability.retryable,
      },
      schemaVersion: AGENT_RUNTIME_PROTOCOL_VERSION,
    },
    status,
  );
}

function createAgentServiceStatus(
  configVersion: number,
  availability: AgentRuntimeAvailability,
  usage: {
    dailyLimit: number;
    dailyRemaining: number;
    dailyUsed: number;
    durationMs: number;
    escalations: number;
    modelCalls: number;
    modelProfile?: string;
    resetAt?: string;
    toolCalls: number;
  },
) {
  return {
    availability,
    configVersion,
    quota: {
      limit: usage.dailyLimit,
      remaining: usage.dailyRemaining,
      resetAt: usage.resetAt,
      used: usage.dailyUsed,
    },
    schemaVersion: AGENT_RUNTIME_PROTOCOL_VERSION,
    usage: {
      durationMs: usage.durationMs,
      escalations: usage.escalations,
      modelCalls: usage.modelCalls,
      modelProfile: usage.modelProfile,
      toolCalls: usage.toolCalls,
    },
  };
}

function emptyAgentUsageSummary() {
  return {
    dailyLimit: 0,
    dailyRemaining: 0,
    dailyUsed: 0,
    durationMs: 0,
    escalations: 0,
    modelCalls: 0,
    toolCalls: 0,
  };
}

function getSkillIdForPhase(phase: string): string | undefined {
  if (phase === "waylog_qa") return "waylog.qa";
  if (phase === "trip_draft") return "trip.draft";
  if (phase === "itinerary_edit") return "itinerary.edit";
  return undefined;
}

function readHeaderValue(request: Request, name: string): string {
  return (request.headers.get(name) ?? "").trim().slice(0, 200);
}

function readPositiveIntegerHeader(
  request: Request,
  name: string,
): number | undefined {
  const value = Number(readHeaderValue(request, name));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

async function writeTelemetry(input: {
  appVersion: string;
  availability?: AgentRuntimeAvailability;
  durationMs?: number;
  failureKind?: string;
  identityUserId: string;
  model?: string;
  modelProfile: string;
  operationCount?: number;
  operationsOptions: {
    serviceRoleKey: string;
    supabaseUrl: string;
  };
  phase: string;
  promptVersion: string;
  provider?: string;
  telemetryEnabled: boolean;
  toolEvents?: Array<{
    name: string;
    status: "completed" | "failed" | "requested";
  }>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}) {
  if (!input.telemetryEnabled) return;
  await recordAgentRuntimeTelemetry(
    createAgentRuntimeTelemetryEvent({
      appVersion: input.appVersion,
      durationMs: input.durationMs,
      failureKind:
        input.failureKind ??
        (input.availability?.available === false
          ? input.availability.code
          : undefined),
      inputTokens: input.usage?.inputTokens,
      model: input.model,
      modelProfile: input.modelProfile,
      operationCount: input.operationCount,
      outputTokens: input.usage?.outputTokens,
      phase: input.phase,
      promptVersion: input.promptVersion,
      provider: input.provider,
      status:
        input.failureKind || input.availability?.available === false
          ? "failed"
          : "succeeded",
      toolEvents: input.toolEvents,
      totalTokens: input.usage?.totalTokens,
      userId: input.identityUserId,
    }),
    input.operationsOptions,
  );
}
