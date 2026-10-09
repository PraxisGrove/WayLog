import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";

type OutboundRequest = { body: unknown; method: string; url: string };
type EdgeHandler = (request: Request) => Response | Promise<Response>;

// 在 Deno HTTP 注册入口运行真实 handler；只替换外部 SDK、网络和环境配置。
function loadWebhook(
  name: string,
  environment: Record<string, string> = {},
  respond?: (request: OutboundRequest) => Response | Promise<Response>,
) {
  const requests: OutboundRequest[] = [];
  let handler: EdgeHandler | undefined;
  const modules = new Map<string, { exports: unknown }>();
  const boundaryFetch = async (url: string, init?: RequestInit) => {
    const request = {
      body: init?.body,
      method: init?.method ?? "GET",
      url: String(url),
    };
    requests.push(request);
    if (respond) return respond(request);
    return new Response(String(url).includes("/rpc/") ? "[]" : "{}", {
      headers: { "Content-Range": "0-0/0", "Content-Type": "application/json" },
      status: 200,
    });
  };
  const sentryScope = { setContext() {}, setLevel() {}, setTag() {} };
  const sentryBoundary = {
    addBreadcrumb() {},
    captureException() {},
    init() {},
    withScope(callback: (scope: typeof sentryScope) => void) {
      callback(sentryScope);
    },
  };

  function loadModule(path: string): unknown {
    const cached = modules.get(path);
    if (cached) return cached.exports;
    const module = { exports: {} };
    modules.set(path, module);
    const compiled = transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ModuleKind.CommonJS },
      fileName: path,
    }).outputText;
    runInNewContext(
      compiled,
      {
        Deno: {
          env: { get: (key: string) => environment[key] },
          serve(value: EdgeHandler) {
            handler = value;
          },
        },
        Headers,
        Request,
        Response,
        TextEncoder,
        crypto: globalThis.crypto,
        exports: module.exports,
        fetch: boundaryFetch,
        module,
        require(specifier: string) {
          if (specifier === "npm:@sentry/deno") return sentryBoundary;
          if (specifier === "jsr:@supabase/supabase-js@2") {
            return {
              createClient(url: string) {
                return {
                  from(table: string) {
                    return {
                      async upsert(payload: unknown) {
                        await boundaryFetch(`${url}/rest/v1/${table}`, {
                          body: JSON.stringify(payload),
                          method: "POST",
                        });
                        return { error: null };
                      },
                    };
                  },
                };
              },
            };
          }
          if (specifier.startsWith(".")) {
            return loadModule(resolve(dirname(path), specifier));
          }
          throw new Error(`Unexpected external dependency: ${specifier}`);
        },
      },
      { filename: path },
    );
    return module.exports;
  }

  loadModule(resolve("supabase/functions", name, "index.ts"));
  assert.ok(handler, "Edge Function must register an HTTP handler");
  const registeredHandler = handler;
  return {
    requests,
    async request(
      body: unknown,
      headers: Record<string, string> = {},
      method = "POST",
    ) {
      return registeredHandler?.(
        new Request(`https://example.supabase.co/functions/v1/${name}`, {
          body:
            method === "GET" || method === "HEAD"
              ? undefined
              : typeof body === "string"
                ? body
                : JSON.stringify(body),
          headers: { "Content-Type": "application/json", ...headers },
          method,
        }),
      );
    },
  };
}

const telegramStart = {
  message: {
    chat: { id: 100, type: "private" },
    from: { id: 200 },
    text: "/start",
  },
  update_id: 1,
};

const telegramEnvironment = {
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  SUPABASE_URL: "https://example.supabase.co",
  TELEGRAM_ADMIN_USER_ID: "200",
  TELEGRAM_BOT_TOKEN: "test-bot-token",
  TELEGRAM_CHAT_ID: "100",
  TELEGRAM_WEBHOOK_SECRET: "test-telegram-webhook-secret",
};

test("Telegram webhook refuses unconfigured deployment before any external request", async () => {
  const webhook = loadWebhook("telegram-bot");
  const response = await webhook.request(telegramStart);
  assert.equal(response?.status, 503);
  assert.equal(webhook.requests.length, 0);
});

test("Telegram webhook rejects missing and incorrect Telegram secret without network access", async () => {
  const webhook = loadWebhook("telegram-bot", telegramEnvironment);
  const missing = await webhook.request(telegramStart);
  const incorrect = await webhook.request(telegramStart, {
    "X-Telegram-Bot-Api-Secret-Token": "incorrect-secret",
  });
  assert.equal(missing?.status, 401);
  assert.equal(incorrect?.status, 401);
  assert.equal(webhook.requests.length, 0);
});

test("Telegram private operations require both the configured chat and administrator", async () => {
  const webhook = loadWebhook("telegram-bot", telegramEnvironment);
  for (const message of [
    { ...telegramStart.message, chat: { id: 999, type: "private" } },
    { ...telegramStart.message, from: { id: 999 } },
    { chat: telegramStart.message.chat, text: "/start" },
  ]) {
    const response = await webhook.request(
      { message, update_id: 2 },
      { "X-Telegram-Bot-Api-Secret-Token": "test-telegram-webhook-secret" },
    );
    assert.equal(response?.status, 403);
  }
  assert.equal(webhook.requests.length, 0);
});

test("Telegram webhook cannot clear all feedback even for the authorized administrator", async () => {
  const webhook = loadWebhook("telegram-bot", telegramEnvironment);
  for (const body of [
    {
      ...telegramStart,
      message: { ...telegramStart.message, text: "/clear_feedback" },
    },
    {
      callback_query: {
        data: "clear_feedback_execute",
        from: { id: 200 },
        id: "callback-1",
        message: { chat: { id: 100 }, message_id: 1 },
      },
      update_id: 2,
    },
  ]) {
    const response = await webhook.request(body, {
      "X-Telegram-Bot-Api-Secret-Token": "test-telegram-webhook-secret",
    });
    assert.equal(response?.status, 403);
  }
  assert.equal(webhook.requests.length, 0);
});

test("Authorized Telegram administrator receives read-only command help", async () => {
  const webhook = loadWebhook("telegram-bot", telegramEnvironment);
  const response = await webhook.request(telegramStart, {
    "X-Telegram-Bot-Api-Secret-Token": "test-telegram-webhook-secret",
  });
  assert.equal(response?.status, 200);
  const message = JSON.parse(String(webhook.requests[0]?.body));
  assert.equal(message.chat_id, 100);
  assert.match(message.text, /\/stats/);
  assert.equal(message.text.includes("/clear_feedback"), false);
  assert.equal(
    webhook.requests.some((request) => request.method === "DELETE"),
    false,
  );
});

test("Telegram chat and administrator configuration cannot be omitted", async () => {
  for (const absent of ["TELEGRAM_CHAT_ID", "TELEGRAM_ADMIN_USER_ID"]) {
    const environment: Record<string, string> = { ...telegramEnvironment };
    delete environment[absent];
    const webhook = loadWebhook("telegram-bot", environment);
    const response = await webhook.request(telegramStart, {
      "X-Telegram-Bot-Api-Secret-Token": "test-telegram-webhook-secret",
    });
    assert.equal(response?.status, 503);
    assert.equal(webhook.requests.length, 0);
  }
});

const feedbackInsert = {
  record: { description: "合成测试反馈", id: "feedback-1" },
  table: "feedback",
  type: "INSERT",
};

test("Feedback notification refuses missing server credentials before contacting Telegram", async () => {
  const webhook = loadWebhook("feedback-notify");
  const response = await webhook.request(feedbackInsert);
  assert.equal(response?.status, 503);
  assert.equal(webhook.requests.length, 0);
});

const notificationEnvironment = {
  INTERNAL_WEBHOOK_SECRET: "test-internal-webhook-secret",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  SUPABASE_URL: "https://example.supabase.co",
  TELEGRAM_BOT_TOKEN: "test-bot-token",
  TELEGRAM_CHAT_ID: "100",
};

test("Feedback notification rejects missing, incorrect, and client credentials before any external request", async () => {
  const webhook = loadWebhook("feedback-notify", notificationEnvironment);
  const credentials: Record<string, string>[] = [
    {},
    { Authorization: "Bearer incorrect-secret" },
    { Authorization: "Bearer test-anon-key" },
    { apikey: "test-internal-webhook-secret" },
  ];
  for (const headers of credentials) {
    const response = await webhook.request(feedbackInsert, headers);
    assert.equal(response?.status, 401);
  }
  assert.equal(webhook.requests.length, 0);
});

test("Daily statistics require server configuration and authenticated POST before reading data", async () => {
  const missingConfiguration = loadWebhook("daily-stats");
  const unavailable = await missingConfiguration.request({});
  assert.equal(unavailable?.status, 503);
  assert.equal(missingConfiguration.requests.length, 0);

  const webhook = loadWebhook("daily-stats", notificationEnvironment);
  const credentials: Record<string, string>[] = [
    {},
    { Authorization: "Bearer incorrect-secret" },
  ];
  for (const headers of credentials) {
    const response = await webhook.request({}, headers);
    assert.equal(response?.status, 401);
  }
  const unsupported = await webhook.request(
    {},
    {
      Authorization: "Bearer test-internal-webhook-secret",
    },
    "GET",
  );
  assert.equal(unsupported?.status, 405);
  assert.equal(webhook.requests.length, 0);
});

test("Authenticated internal notifications accept dedicated and existing service-role Bearer credentials", async () => {
  for (const name of ["feedback-notify", "daily-stats"]) {
    for (const token of [
      "test-internal-webhook-secret",
      "test-service-role-key",
    ]) {
      const webhook = loadWebhook(name, notificationEnvironment);
      const response = await webhook.request(
        name === "feedback-notify" ? feedbackInsert : {},
        { Authorization: `Bearer ${token}` },
      );
      assert.equal(response?.status, 200);
      assert.ok(
        webhook.requests.some((request) =>
          request.url.endsWith("/sendMessage"),
        ),
      );
    }
  }
});

const sentryPayload = {
  data: { event: { event_id: "test-event-1", message: "合成崩溃测试" } },
};

test("Sentry webhook refuses missing signing secret even with database service credentials", async () => {
  const webhook = loadWebhook("sentry-webhook", notificationEnvironment);
  const response = await webhook.request(sentryPayload);
  assert.equal(response?.status, 503);
  assert.equal(webhook.requests.length, 0);
});

const sentryEnvironment = {
  ...notificationEnvironment,
  SENTRY_WEBHOOK_SECRET: "test-sentry-signing-secret",
};

test("Sentry webhook rejects missing and invalid signatures without writing crash reports", async () => {
  const webhook = loadWebhook("sentry-webhook", sentryEnvironment);
  const credentials: Record<string, string>[] = [
    {},
    { "sentry-hook-signature": "incorrect-signature" },
  ];
  for (const headers of credentials) {
    const response = await webhook.request(sentryPayload, headers);
    assert.equal(response?.status, 401);
  }
  assert.equal(webhook.requests.length, 0);
});

test("Sentry authenticates the original signed body including whitespace before storing a crash report", async () => {
  const webhook = loadWebhook("sentry-webhook", sentryEnvironment);
  const rawBody = JSON.stringify(sentryPayload, null, 2);
  const signature = createHmac("sha256", "test-sentry-signing-secret")
    .update(rawBody)
    .digest("hex");
  const response = await webhook.request(rawBody, {
    "sentry-hook-signature": signature,
  });
  assert.equal(response?.status, 200);
  assert.equal(
    webhook.requests[0]?.url,
    "https://example.supabase.co/rest/v1/crash_reports",
  );
  assert.equal(
    JSON.parse(String(webhook.requests[0]?.body)).sentry_event_id,
    "test-event-1",
  );
});

test("Sentry refuses altered bodies even when the original signature is supplied", async () => {
  const webhook = loadWebhook("sentry-webhook", sentryEnvironment);
  const rawBody = JSON.stringify(sentryPayload);
  const signature = createHmac("sha256", "test-sentry-signing-secret")
    .update(rawBody)
    .digest("hex");
  const response = await webhook.request(
    rawBody.replace("test-event-1", "altered-event"),
    { "sentry-hook-signature": signature },
  );
  assert.equal(response?.status, 401);
  assert.equal(webhook.requests.length, 0);
});

test("Telegram webhook rejects unsupported HTTP methods without side effects", async () => {
  const webhook = loadWebhook("telegram-bot", telegramEnvironment);
  const response = await webhook.request(
    {},
    {
      "X-Telegram-Bot-Api-Secret-Token": "test-telegram-webhook-secret",
    },
    "GET",
  );
  assert.equal(response?.status, 405);
  assert.equal(webhook.requests.length, 0);
});

test("Authenticated Telegram requests reject malformed updates without side effects", async () => {
  const webhook = loadWebhook("telegram-bot", telegramEnvironment);
  for (const body of [
    "{",
    { ...telegramStart, message: { ...telegramStart.message, text: 42 } },
  ]) {
    const response = await webhook.request(body, {
      "X-Telegram-Bot-Api-Secret-Token": "test-telegram-webhook-secret",
    });
    assert.equal(response?.status, 400);
  }
  assert.equal(webhook.requests.length, 0);
});

test("Telegram cannot combine the chat from a message with an administrator from a callback", async () => {
  const webhook = loadWebhook("telegram-bot", telegramEnvironment);
  const response = await webhook.request(
    {
      callback_query: {
        from: { id: 200 },
        id: "callback-1",
        message: { chat: { id: 999 }, message_id: 1 },
      },
      message: { chat: { id: 100, type: "private" }, text: "/users" },
      update_id: 2,
    },
    { "X-Telegram-Bot-Api-Secret-Token": "test-telegram-webhook-secret" },
  );
  assert.equal(response?.status, 400);
  assert.equal(webhook.requests.length, 0);
});

test("Daily statistics read concrete tables and report their returned counts", async () => {
  const tableCounts: Record<string, number> = {
    feedback: 4,
    profiles: 7,
    user_favorite_places: 5,
    user_trips: 3,
  };
  const webhook = loadWebhook(
    "daily-stats",
    notificationEnvironment,
    (request) => {
      const url = new URL(request.url);
      if (request.method === "HEAD") {
        const table = url.pathname.split("/").at(-1) ?? "";
        if (!(table in tableCounts)) return new Response("", { status: 404 });
        const count = url.searchParams.has("created_at")
          ? table === "profiles"
            ? 2
            : 1
          : tableCounts[table];
        return new Response(null, {
          headers: { "Content-Range": `0-0/${count}` },
          status: 200,
        });
      }
      return new Response(url.pathname.includes("/rpc/") ? "[]" : "{}", {
        status: 200,
      });
    },
  );
  const response = await webhook.request(
    {},
    {
      Authorization: "Bearer test-internal-webhook-secret",
    },
  );
  assert.equal(response?.status, 200);
  const tableQueries = webhook.requests
    .filter((request) => request.method === "HEAD")
    .map((request) => new URL(request.url).pathname)
    .sort();
  assert.deepEqual(tableQueries, [
    "/rest/v1/feedback",
    "/rest/v1/feedback",
    "/rest/v1/profiles",
    "/rest/v1/profiles",
    "/rest/v1/user_favorite_places",
    "/rest/v1/user_trips",
  ]);
  const message = webhook.requests.find((request) =>
    request.url.endsWith("/sendMessage"),
  );
  const text = JSON.parse(String(message?.body)).text;
  assert.match(text, /7 总计，今日 \+2/);
  assert.match(text, /4 总计，今日 \+1/);
  assert.match(text, /3 活跃/);
  assert.match(text, /<b>收藏<\/b> 5/);
});

test("Daily statistics do not send a zero-count report when a database query fails", async () => {
  const webhook = loadWebhook(
    "daily-stats",
    notificationEnvironment,
    (request) => {
      const url = new URL(request.url);
      if (request.method === "HEAD" && url.pathname === "/rest/v1/profiles") {
        return new Response(null, { status: 503 });
      }
      return new Response(url.pathname.includes("/rpc/") ? "[]" : "{}", {
        headers: { "Content-Range": "0-0/3" },
        status: 200,
      });
    },
  );
  const response = await webhook.request(
    {},
    {
      Authorization: "Bearer test-internal-webhook-secret",
    },
  );
  assert.equal(response?.status, 500);
  assert.equal(
    webhook.requests.some((request) => request.url.endsWith("/sendMessage")),
    false,
  );
});
