import assert from "node:assert/strict";
import test from "node:test";

import {
  loadAgentRuntimeConfig,
  recordAgentRuntimeTelemetry,
} from "../../../supabase/functions/agent-llm-proxy/operations-store";

test("Edge loads the singleton runtime config with service-role authority", async () => {
  let capturedInit: RequestInit | undefined;
  const result = await loadAgentRuntimeConfig({
    fetcher: async (_url, init) => {
      capturedInit = init;
      return new Response(
        JSON.stringify({
          allowedModelProfiles: ["router", "balanced"],
          configVersion: 7,
          dailyLimit: 40,
          disabledSkillIds: [],
          enabled: true,
          minimumAppVersion: "2026.08.30-0100",
          minuteLimit: 4,
          modelProfiles: {
            balanced: "deepseek-v4-pro",
            router: "deepseek-v4-flash",
          },
          protocolVersion: 1,
          telemetryEnabled: true,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      );
    },
    serviceRoleKey: "service-role-secret",
    supabaseUrl: "https://example.supabase.co",
    timeoutMs: 100,
  });

  assert.equal(result.ok, true);
  assert.equal(
    (capturedInit?.headers as Record<string, string>).Authorization,
    "Bearer service-role-secret",
  );
});

test("telemetry writer sends only the already-whitelisted RPC parameters", async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const result = await recordAgentRuntimeTelemetry(
    {
      durationMs: 99,
      modelProfile: "balanced",
      phase: "waylog_qa",
      promptVersion: "waylog-qa.v1",
      status: "succeeded",
      toolEvents: [{ name: "poi.search", status: "completed" }],
      totalTokens: 12,
      userId: "123e4567-e89b-42d3-a456-426614174000",
    },
    {
      fetcher: async (_url, init) => {
        capturedBody = JSON.parse(String(init?.body));
        return new Response("null", { status: 200 });
      },
      serviceRoleKey: "service-role-secret",
      supabaseUrl: "https://example.supabase.co",
      timeoutMs: 100,
    },
  );

  assert.equal(result, true);
  assert.deepEqual(capturedBody, {
    p_app_version: null,
    p_attempt_id: null,
    p_conversation_id: null,
    p_duration_ms: 99,
    p_escalated_from: null,
    p_escalation_reason: null,
    p_failure_kind: null,
    p_input_tokens: null,
    p_model: null,
    p_model_profile: "balanced",
    p_operation_count: null,
    p_output_tokens: null,
    p_phase: "waylog_qa",
    p_prompt_version: "waylog-qa.v1",
    p_provider: null,
    p_status: "succeeded",
    p_tool_events: [{ name: "poi.search", status: "completed" }],
    p_total_tokens: 12,
    p_turn_id: null,
    p_user_id: "123e4567-e89b-42d3-a456-426614174000",
  });
});
