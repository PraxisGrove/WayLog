import assert from "node:assert/strict";
import test from "node:test";

import {
  createAgentRuntimeTelemetryEvent,
  summarizeAgentProxyActivity,
  summarizeAgentProxyToolResults,
} from "../../../supabase/functions/agent-llm-proxy/telemetry";

test("Agent telemetry serializes only explicitly allowed fields", () => {
  const event = createAgentRuntimeTelemetryEvent({
    appVersion: "2026.08.30-0100",
    attemptId: "attempt-1",
    conversationId: "conversation-1",
    durationMs: 321,
    failureKind: "model_failure",
    jwt: "signed-user-jwt",
    messages: [{ content: "完整消息不得记录" }],
    model: "deepseek-v4-flash",
    modelProfile: "balanced",
    operationCount: 2,
    phase: "itinerary_edit",
    promptVersion: "itinerary-edit.v1",
    provider: "deepseek",
    signedUrl: "https://example.com/private?token=secret",
    status: "failed",
    toolEvents: [{ name: "poi.search", status: "completed" }],
    totalTokens: 42,
    trip: { id: "trip-secret", title: "完整 Trip JSON" },
    turnId: "turn-1",
    userId: "123e4567-e89b-42d3-a456-426614174000",
  });
  const serialized = JSON.stringify(event);

  assert.deepEqual(Object.keys(event).sort(), [
    "appVersion",
    "attemptId",
    "conversationId",
    "durationMs",
    "failureKind",
    "model",
    "modelProfile",
    "operationCount",
    "phase",
    "promptVersion",
    "provider",
    "status",
    "toolEvents",
    "totalTokens",
    "turnId",
    "userId",
  ]);
  assert.equal(serialized.includes("完整消息不得记录"), false);
  assert.equal(serialized.includes("signed-user-jwt"), false);
  assert.equal(serialized.includes("trip-secret"), false);
  assert.equal(serialized.includes("token=secret"), false);
});

test("Agent telemetry rejects secrets and URLs hidden inside allowed string fields", () => {
  const event = createAgentRuntimeTelemetryEvent({
    appVersion: "Bearer eyJhbGciOi.secret.signature",
    attemptId: "https://example.com/private?token=secret",
    conversationId: "eyJhbGciOiJIUzI1NiJ9.payload.signature",
    failureKind: "token=short-private",
    model: "https://models.example/private?key=secret",
    modelProfile: "balanced",
    phase: "waylog_qa",
    promptVersion: "waylog-qa.v1",
    provider: "Bearer provider-secret",
    status: "failed",
    toolEvents: [
      { name: "https://example.com/tool?sig=secret", status: "requested" },
    ],
    userId: "not-a-user-uuid",
  });

  assert.deepEqual(event, {
    modelProfile: "balanced",
    phase: "waylog_qa",
    promptVersion: "waylog-qa.v1",
    status: "failed",
  });
});

test("tool-result telemetry keeps only tool name and public status", () => {
  const summary = summarizeAgentProxyToolResults([
    {
      content: [{ text: "signed-url-secret", type: "text" }],
      isError: false,
      role: "toolResult",
      toolCallId: "tool-call-1",
      toolName: "poi.search",
    },
    {
      content: [{ text: "完整提案", type: "text" }],
      isError: true,
      role: "toolResult",
      toolCallId: "tool-call-2",
      toolName: "weather.get",
    },
  ]);

  assert.deepEqual(summary, [
    { name: "poi.search", status: "completed" },
    { name: "weather.get", status: "failed" },
  ]);
  assert.equal(JSON.stringify(summary).includes("signed-url-secret"), false);
  assert.equal(JSON.stringify(summary).includes("完整提案"), false);
});

test("proxy activity summary drops tool payloads and counts proposal operations", () => {
  const summary = summarizeAgentProxyActivity([
    {
      schemaVersion: 1,
      toolCall: {
        arguments: {
          proposal: {
            operations: [
              { operationId: "operation-1", secret: "payload-secret" },
              { operationId: "operation-2" },
            ],
          },
        },
        id: "call-1",
        name: "waylog_trip_edit_proposal",
        type: "toolCall",
      },
      type: "toolcall_end",
    },
    {
      reason: "toolUse",
      schemaVersion: 1,
      type: "done",
      usage: { input: 10, output: 5, totalTokens: 15 },
    },
  ]);

  assert.deepEqual(summary, {
    operationCount: 2,
    toolEvents: [],
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
  });
  assert.equal(JSON.stringify(summary).includes("payload-secret"), false);
});
