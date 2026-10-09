import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeAgentTurnQuota,
  readAgentUsageSummary,
} from "../../../supabase/functions/agent-llm-proxy/quota";

test("quota RPC uses the request JWT and remotely configured limits", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const result = await consumeAgentTurnQuota("Bearer signed-user-jwt", {
    anonKey: "anon-key",
    dailyLimit: 40,
    fetcher: async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(
        JSON.stringify({
          allowed: true,
          dailyLimit: 40,
          dailyRemaining: 31,
          dailyUsed: 9,
          minuteLimit: 4,
          minuteRemaining: 3,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      );
    },
    minuteLimit: 4,
    supabaseUrl: "https://example.supabase.co/",
    timeoutMs: 100,
  });

  assert.equal(
    capturedUrl.endsWith("/rest/v1/rpc/consume_agent_turn_quota"),
    true,
  );
  assert.equal(
    (capturedInit?.headers as Record<string, string>).Authorization,
    "Bearer signed-user-jwt",
  );
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    p_daily_limit: 40,
    p_minute_limit: 4,
  });
  assert.deepEqual(result, {
    allowed: true,
    dailyLimit: 40,
    dailyRemaining: 31,
    dailyUsed: 9,
    minuteLimit: 4,
    minuteRemaining: 3,
  });
});

test("usage summary is read without consuming quota and stays account-scoped by JWT", async () => {
  let capturedUrl = "";
  const result = await readAgentUsageSummary("Bearer account-jwt", {
    anonKey: "anon-key",
    dailyLimit: 40,
    fetcher: async (url) => {
      capturedUrl = String(url);
      return new Response(
        JSON.stringify({
          dailyLimit: 40,
          dailyRemaining: 31,
          dailyUsed: 9,
          durationMs: 12000,
          escalations: 1,
          modelCalls: 9,
          modelProfile: "balanced",
          resetAt: "2026-08-31T00:00:00.000Z",
          toolCalls: 3,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      );
    },
    supabaseUrl: "https://example.supabase.co",
    timeoutMs: 100,
  });

  assert.equal(
    capturedUrl.endsWith("/rest/v1/rpc/get_agent_runtime_usage"),
    true,
  );
  assert.deepEqual(result, {
    dailyLimit: 40,
    dailyRemaining: 31,
    dailyUsed: 9,
    durationMs: 12000,
    escalations: 1,
    modelCalls: 9,
    modelProfile: "balanced",
    resetAt: "2026-08-31T00:00:00.000Z",
    toolCalls: 3,
  });
});
