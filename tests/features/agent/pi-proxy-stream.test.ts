import assert from "node:assert/strict";
import test from "node:test";

import {
  createPiProxyStreamFn,
  parsePiProxyPublicFailure,
} from "../../../features/agent/pi-proxy-stream";

test("Pi proxy sends bounded phase context and reconstructs a terminating tool call", async () => {
  const encoder = new TextEncoder();
  let requestBody: Record<string, unknown> | undefined;
  let requestHeaders: Record<string, string> | undefined;
  const streamFn = createPiProxyStreamFn({
    accessToken: "signed-user-jwt",
    anonKey: "public-anon-key",
    appVersion: "2026.08.30-0100",
    fetcher: async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      requestHeaders = init?.headers as Record<string, string>;
      const frames = [
        { schemaVersion: 1, type: "start" },
        {
          contentIndex: 0,
          id: "answer-call-1",
          schemaVersion: 1,
          toolName: "waylog_answer",
          type: "toolcall_start",
        },
        {
          contentIndex: 0,
          delta: '{"answer":{"text":"杭州两日可以慢游西湖与运河。"}}',
          schemaVersion: 1,
          type: "toolcall_delta",
        },
        {
          contentIndex: 0,
          schemaVersion: 1,
          toolCall: {
            arguments: { answer: { text: "杭州两日可以慢游西湖与运河。" } },
            id: "answer-call-1",
            name: "waylog_answer",
            type: "toolCall",
          },
          type: "toolcall_end",
        },
        {
          reason: "toolUse",
          schemaVersion: 1,
          type: "done",
          usage: {
            cacheRead: 0,
            cacheWrite: 0,
            input: 18,
            output: 12,
            totalTokens: 30,
          },
        },
      ];
      const body = frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`);

      return new Response(
        new ReadableStream({
          start(controller) {
            for (const frame of body) controller.enqueue(encoder.encode(frame));
            controller.close();
          },
        }),
        {
          headers: { "Content-Type": "text/event-stream" },
          status: 200,
        },
      );
    },
    phase: "waylog_qa",
    promptVersion: "waylog-qa.v1",
    url: "https://example.supabase.co/functions/v1/agent-llm-proxy",
  });
  const stream = await streamFn(
    {
      api: "waylog-proxy",
      baseUrl: "",
      contextWindow: 8_000,
      cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
      id: "balanced",
      input: ["text"],
      maxTokens: 800,
      name: "WayLog Balanced",
      provider: "waylog",
      reasoning: false,
    },
    {
      messages: [
        {
          content: [
            { text: "杭州两天", type: "text" },
            { text: "怎么安排？", type: "text" },
          ],
          role: "user",
          timestamp: 1,
        },
      ],
      systemPrompt: "client prompt must not cross the boundary",
      tools: [
        {
          description: "Return a structured answer",
          name: "waylog_answer",
          parameters: { properties: {}, type: "object" },
        },
      ],
    },
  );
  const events: Array<Record<string, unknown>> = [];

  for await (const event of stream) {
    events.push(event as unknown as Record<string, unknown>);
  }

  assert.equal(requestBody?.phase, "waylog_qa");
  assert.equal(requestBody?.promptVersion, "waylog-qa.v1");
  assert.equal(requestBody?.modelProfile, "balanced");
  assert.equal(requestHeaders?.["X-WayLog-Agent-Protocol-Version"], "1");
  assert.equal(requestHeaders?.["X-WayLog-App-Version"], "2026.08.30-0100");
  assert.equal(
    (
      requestBody?.context as {
        messages?: Array<{ content?: unknown }>;
      }
    )?.messages?.[0]?.content,
    "杭州两天\n怎么安排？",
  );
  assert.equal(
    JSON.stringify(requestBody).includes("client prompt must not cross"),
    false,
  );
  assert.equal(JSON.stringify(requestBody).includes("signed-user-jwt"), false);
  assert.equal(events.at(-1)?.type, "done");
  assert.equal(
    JSON.stringify(events).includes("杭州两日可以慢游西湖与运河。"),
    true,
  );
});

test("Pi proxy surfaces the public unavailable message instead of a generic HTTP fallback", async () => {
  const streamFn = createPiProxyStreamFn({
    accessToken: "signed-user-jwt",
    appVersion: "2026.08.29-0001",
    fetcher: async () =>
      new Response(
        JSON.stringify({
          error: {
            kind: "app_version_unsupported",
            message: "当前 App 版本过低，请更新后使用旅行助手。",
            retryable: false,
          },
          schemaVersion: 1,
        }),
        { headers: { "Content-Type": "application/json" }, status: 503 },
      ),
    phase: "waylog_qa",
    promptVersion: "waylog-qa.v1",
    url: "https://example.supabase.co/functions/v1/agent-llm-proxy",
  });
  const stream = await streamFn(
    {
      api: "waylog-proxy",
      baseUrl: "",
      contextWindow: 8_000,
      cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
      id: "balanced",
      input: ["text"],
      maxTokens: 800,
      name: "WayLog Balanced",
      provider: "waylog",
      reasoning: false,
    },
    { messages: [], systemPrompt: "", tools: [] },
  );
  const events: Array<Record<string, unknown>> = [];
  for await (const event of stream) {
    events.push(event as unknown as Record<string, unknown>);
  }

  const final = events.at(-1) as { error?: { errorMessage?: string } };
  assert.deepEqual(parsePiProxyPublicFailure(final.error?.errorMessage), {
    kind: "app_version_unsupported",
    message: "当前 App 版本过低，请更新后使用旅行助手。",
    retryable: false,
  });
});

test("Pi proxy preserves quota kind and retryability from the Edge", async () => {
  const streamFn = createPiProxyStreamFn({
    accessToken: "signed-user-jwt",
    fetcher: async () =>
      new Response(
        JSON.stringify({
          error: {
            kind: "quota_exceeded",
            message: "请求过于频繁，请稍后再试。",
            retryable: true,
          },
          schemaVersion: 1,
        }),
        { headers: { "Content-Type": "application/json" }, status: 429 },
      ),
    phase: "waylog_qa",
    promptVersion: "waylog-qa.v1",
    url: "https://example.supabase.co/functions/v1/agent-llm-proxy",
  });
  const stream = await streamFn(
    {
      api: "waylog-proxy",
      baseUrl: "",
      contextWindow: 8_000,
      cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
      id: "balanced",
      input: ["text"],
      maxTokens: 800,
      name: "WayLog Balanced",
      provider: "waylog",
      reasoning: false,
    },
    { messages: [], systemPrompt: "", tools: [] },
  );
  const events: Array<Record<string, unknown>> = [];
  for await (const event of stream)
    events.push(event as Record<string, unknown>);
  const final = events.at(-1) as { error?: { errorMessage?: string } };

  assert.deepEqual(parsePiProxyPublicFailure(final.error?.errorMessage), {
    kind: "quota_exceeded",
    message: "请求过于频繁，请稍后再试。",
    retryable: true,
  });
});

test("Pi proxy fails closed when an SSE event contains an invalid content index", async () => {
  const encoder = new TextEncoder();
  const streamFn = createPiProxyStreamFn({
    accessToken: "signed-user-jwt",
    fetcher: async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  contentIndex: -1,
                  id: "answer-call-1",
                  schemaVersion: 1,
                  toolName: "waylog_answer",
                  type: "toolcall_start",
                })}\n\n`,
              ),
            );
            controller.close();
          },
        }),
        {
          headers: { "Content-Type": "text/event-stream" },
          status: 200,
        },
      ),
    phase: "waylog_qa",
    promptVersion: "waylog-qa.v1",
    url: "https://example.supabase.co/functions/v1/agent-llm-proxy",
  });
  const stream = await streamFn(
    {
      api: "waylog-proxy",
      baseUrl: "",
      contextWindow: 8_000,
      cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
      id: "balanced",
      input: ["text"],
      maxTokens: 800,
      name: "WayLog Balanced",
      provider: "waylog",
      reasoning: false,
    },
    { messages: [], systemPrompt: "", tools: [] },
  );
  const events: Array<Record<string, unknown>> = [];

  for await (const event of stream) {
    events.push(event as unknown as Record<string, unknown>);
  }

  assert.equal(events.at(-1)?.type, "error");
  assert.equal(
    events.some((event) => event.type === "done"),
    false,
  );
});

test("Pi proxy fails closed when SSE event fields do not match the versioned contract", async () => {
  const invalidEvents = [
    { reason: "unexpected", schemaVersion: 1, type: "done", usage: {} },
    {
      contentIndex: 0,
      delta: 42,
      schemaVersion: 1,
      type: "toolcall_delta",
    },
    {
      contentIndex: 0,
      schemaVersion: 1,
      toolCall: {
        arguments: "not-an-object",
        id: "answer-call-1",
        name: "waylog_answer",
        type: "toolCall",
      },
      type: "toolcall_end",
    },
    {
      reason: "toolUse",
      schemaVersion: 1,
      type: "done",
      usage: { input: -1 },
    },
  ];

  for (const invalidEvent of invalidEvents) {
    const events = await collectProxyEvents([invalidEvent]);
    assert.equal(events.at(-1)?.type, "error");
    assert.equal(
      events.some((event) => event.type === "done"),
      false,
    );
  }
});

async function collectProxyEvents(
  frames: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  const encoder = new TextEncoder();
  const streamFn = createPiProxyStreamFn({
    accessToken: "signed-user-jwt",
    fetcher: async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            for (const frame of frames) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(frame)}\n\n`),
              );
            }
            controller.close();
          },
        }),
        {
          headers: { "Content-Type": "text/event-stream" },
          status: 200,
        },
      ),
    phase: "waylog_qa",
    promptVersion: "waylog-qa.v1",
    url: "https://example.supabase.co/functions/v1/agent-llm-proxy",
  });
  const stream = await streamFn(
    {
      api: "waylog-proxy",
      baseUrl: "",
      contextWindow: 8_000,
      cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
      id: "balanced",
      input: ["text"],
      maxTokens: 800,
      name: "WayLog Balanced",
      provider: "waylog",
      reasoning: false,
    },
    { messages: [], systemPrompt: "", tools: [] },
  );
  const events: Array<Record<string, unknown>> = [];

  for await (const event of stream) {
    events.push(event as unknown as Record<string, unknown>);
  }

  return events;
}
