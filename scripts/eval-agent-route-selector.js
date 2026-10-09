#!/usr/bin/env node

const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const PROJECT_ROOT = process.cwd();
const APP_VERSION = require(join(PROJECT_ROOT, "app.json")).expo.version;
const DEFAULT_REQUEST_DELAY_MS = 10_500;
const MAX_RATE_LIMIT_RETRIES = 6;
const envLocal = loadEnvFile(join(PROJECT_ROOT, ".env.local"));
const corpus = JSON.parse(
  readFileSync(
    join(PROJECT_ROOT, "scripts/fixtures/agent-route-selector-corpus.json"),
    "utf8",
  ),
);
const skills = JSON.parse(
  readFileSync(
    join(PROJECT_ROOT, "scripts/fixtures/agent-route-skills.json"),
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
      "缺少 Supabase URL 或 anon key，无法运行 RouteSelector eval。",
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

  const endpoint = `${supabaseUrl}/functions/v1/agent-llm-proxy`;
  const requestDelayMs = readNonNegativeNumber(
    args.delayMs ?? getEnv("AGENT_ROUTE_EVAL_DELAY_MS"),
    DEFAULT_REQUEST_DELAY_MS,
  );
  let passed = 0;

  for (const [index, fixture] of corpus.entries()) {
    if (index > 0 && requestDelayMs > 0) {
      await delay(requestDelayMs);
    }
    const route = await requestRoute({
      anonKey,
      endpoint,
      fixture,
      rateLimitRetryDelayMs: Math.max(requestDelayMs, 10_500),
      token,
    });
    const ok = matchesExpectedRoute(route, fixture.expected);
    process.stdout.write(
      `${ok ? "PASS" : "FAIL"} ${fixture.id} ${JSON.stringify(route)}\n`,
    );
    if (ok) passed += 1;
  }

  process.stdout.write(
    `RouteSelector eval: ${passed}/${corpus.length} passed\n`,
  );

  if (passed !== corpus.length) {
    process.exitCode = 1;
  }
}

async function requestRoute({
  anonKey,
  endpoint,
  fixture,
  rateLimitRetryDelayMs,
  token,
}) {
  return requestRouteAttempt(
    { anonKey, endpoint, fixture, rateLimitRetryDelayMs, token },
    0,
  );
}

async function requestRouteAttempt(input, retryCount) {
  const { anonKey, endpoint, fixture, rateLimitRetryDelayMs, token } = input;
  const response = await fetch(endpoint, {
    body: JSON.stringify({
      context: {
        messages: [
          {
            content: JSON.stringify({
              builtInHandlers: ["clarification", "out_of_scope"],
              kind: "waylog_route_request",
              pageContext: {
                hasSelectedTrip: fixture.hasSelectedTrip,
                surface: "agent_conversation",
              },
              skills,
              userMessage: fixture.message,
            }),
            role: "user",
          },
        ],
        tools: [
          {
            description: "Return the structured WayLog route decision.",
            name: "waylog_route",
            parameters: { properties: {}, type: "object" },
          },
        ],
      },
      modelProfile: "router",
      phase: "route_selector",
      promptVersion: "route-selector.v2",
      schemaVersion: 1,
    }),
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-waylog-app-version": APP_VERSION,
    },
    method: "POST",
  });
  const body = await response.text();

  if (response.status === 429 && retryCount < MAX_RATE_LIMIT_RETRIES) {
    await delay(rateLimitRetryDelayMs);
    return requestRouteAttempt(input, retryCount + 1);
  }

  if (!response.ok) {
    throw new Error(
      `RouteSelector eval 请求失败（HTTP ${response.status}）：${body}`,
    );
  }

  const events = body.split(/\n\n+/).flatMap((frame) =>
    frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => JSON.parse(line.slice(5).trim())),
  );
  const toolCall = events.find(
    (event) =>
      event.type === "toolcall_end" && event.toolCall?.name === "waylog_route",
  );
  const route = toolCall?.toolCall?.arguments?.route;

  if (!route || typeof route !== "object" || Array.isArray(route)) {
    throw new Error(`RouteSelector eval 没有返回结构化 route：${body}`);
  }

  return route;
}

function matchesExpectedRoute(route, expected) {
  return (
    route.scope === expected.scope &&
    (expected.skillId === undefined || route.skillId === expected.skillId) &&
    (expected.handler === undefined || route.handler === expected.handler)
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

    if (value === "--url") args.url = next;
    if (value === "--anon-key") args.anonKey = next;
    if (value === "--token") args.token = next;
    if (value === "--email") args.email = next;
    if (value === "--password") args.password = next;
    if (value === "--delay-ms") args.delayMs = next;
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

function readNonNegativeNumber(value, fallback) {
  if (value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
