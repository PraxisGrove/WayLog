import {
  parseAgentRuntimeConfig,
  type AgentRuntimeConfig,
} from "./operational-controls.ts";
import {
  createAgentRuntimeTelemetryEvent,
  type AgentRuntimeTelemetryEvent,
} from "./telemetry.ts";

type OperationsStoreOptions = {
  fetcher?: typeof fetch;
  serviceRoleKey: string;
  supabaseUrl: string;
  timeoutMs?: number;
};

export async function loadAgentRuntimeConfig(
  options: OperationsStoreOptions,
): Promise<
  { data: AgentRuntimeConfig; ok: true } | { error: string; ok: false }
> {
  if (!options.supabaseUrl.trim() || !options.serviceRoleKey.trim()) {
    return { error: "Agent runtime config authority is missing.", ok: false };
  }

  const response = await requestOperationsRpc(
    "get_agent_runtime_config",
    {},
    options,
  ).catch(() => undefined);
  if (!response?.ok) {
    return { error: "Agent runtime config is unavailable.", ok: false };
  }
  return parseAgentRuntimeConfig(await response.json().catch(() => undefined));
}

export async function recordAgentRuntimeTelemetry(
  input: AgentRuntimeTelemetryEvent,
  options: OperationsStoreOptions,
): Promise<boolean> {
  const event = createAgentRuntimeTelemetryEvent(input);
  if (!event.userId || !event.phase || !event.status) return false;

  const response = await requestOperationsRpc(
    "record_agent_runtime_event",
    {
      p_app_version: event.appVersion ?? null,
      p_attempt_id: event.attemptId ?? null,
      p_conversation_id: event.conversationId ?? null,
      p_duration_ms: event.durationMs ?? null,
      p_escalated_from: event.escalatedFrom ?? null,
      p_escalation_reason: event.escalationReason ?? null,
      p_failure_kind: event.failureKind ?? null,
      p_input_tokens: event.inputTokens ?? null,
      p_model: event.model ?? null,
      p_model_profile: event.modelProfile ?? null,
      p_operation_count: event.operationCount ?? null,
      p_output_tokens: event.outputTokens ?? null,
      p_phase: event.phase,
      p_prompt_version: event.promptVersion ?? null,
      p_provider: event.provider ?? null,
      p_status: event.status,
      p_tool_events: event.toolEvents ?? [],
      p_total_tokens: event.totalTokens ?? null,
      p_turn_id: event.turnId ?? null,
      p_user_id: event.userId,
    },
    options,
  ).catch(() => undefined);
  return Boolean(response?.ok);
}

function requestOperationsRpc(
  name: string,
  body: Record<string, unknown>,
  options: OperationsStoreOptions,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 2_000,
  );
  const baseUrl = options.supabaseUrl.replace(/\/+$/g, "");

  return (options.fetcher ?? fetch)(`${baseUrl}/rest/v1/rpc/${name}`, {
    body: JSON.stringify(body),
    headers: {
      apikey: options.serviceRoleKey,
      Authorization: `Bearer ${options.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));
}
