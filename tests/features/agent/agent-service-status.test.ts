import assert from "node:assert/strict";
import test from "node:test";

import {
  createAgentServiceStatusRequestGate,
  parseAgentServiceStatus,
  requestAgentServiceStatus,
} from "../../../features/agent/agent-service-status";

test("account-scoped status requests reject stale account responses", () => {
  const gate = createAgentServiceStatusRequestGate();
  const accountA = gate.begin("account-a");
  const accountB = gate.begin("account-b");

  assert.equal(gate.isCurrent(accountA), false);
  assert.equal(gate.isCurrent(accountB), true);
  gate.invalidate();
  assert.equal(gate.isCurrent(accountB), false);
});

const validStatus = {
  availability: {
    available: true,
    code: "available",
    message: "旅行助手可用。",
    retryable: false,
  },
  configVersion: 7,
  quota: {
    limit: 40,
    remaining: 31,
    resetAt: "2026-08-31T00:00:00.000Z",
    used: 9,
  },
  schemaVersion: 1,
  usage: {
    durationMs: 12_000,
    escalations: 1,
    modelCalls: 9,
    modelProfile: "balanced",
    toolCalls: 3,
  },
};

test("client parses the bounded Agent availability and usage protocol", () => {
  assert.deepEqual(parseAgentServiceStatus(validStatus), validStatus);
  assert.equal(
    parseAgentServiceStatus({ ...validStatus, schemaVersion: 2 }),
    undefined,
  );
  assert.equal(
    parseAgentServiceStatus({
      ...validStatus,
      availability: { ...validStatus.availability, code: "invented" },
    }),
    undefined,
  );
});

test("status request sends JWT and app/protocol versions without a client userId", async () => {
  let capturedInit: RequestInit | undefined;
  const result = await requestAgentServiceStatus({
    accessToken: "signed-user-jwt",
    anonKey: "anon-key",
    appVersion: "2026.08.30-0100",
    fetcher: async (_url, init) => {
      capturedInit = init;
      return new Response(JSON.stringify(validStatus), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    },
    url: "https://example.supabase.co/functions/v1/agent-llm-proxy",
  });

  assert.deepEqual(result, validStatus);
  assert.equal(capturedInit?.method, "GET");
  assert.deepEqual(capturedInit?.headers, {
    apikey: "anon-key",
    Authorization: "Bearer signed-user-jwt",
    "X-WayLog-Agent-Protocol-Version": "1",
    "X-WayLog-App-Version": "2026.08.30-0100",
  });
  assert.equal("body" in (capturedInit ?? {}), false);
});

test("status request preserves a truthful unavailable response", async () => {
  const unavailable = {
    ...validStatus,
    availability: {
      available: false,
      code: "runtime_disabled",
      message: "旅行助手当前暂停服务。",
      retryable: false,
    },
  };
  const result = await requestAgentServiceStatus({
    accessToken: "signed-user-jwt",
    appVersion: "2026.08.30-0100",
    fetcher: async () =>
      new Response(JSON.stringify(unavailable), {
        headers: { "Content-Type": "application/json" },
        status: 503,
      }),
    url: "https://example.supabase.co/functions/v1/agent-llm-proxy",
  });

  assert.equal(result.availability.code, "runtime_disabled");
  assert.equal(result.availability.available, false);
});
