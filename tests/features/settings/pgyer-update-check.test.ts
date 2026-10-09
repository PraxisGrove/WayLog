import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";

type EdgeHandler = (request: Request) => Response | Promise<Response>;
type OutboundRequest = { params: URLSearchParams; url: string };

// 测试真实 Deno HTTP 入口，只替换外部 Sentry SDK、供应商网络和部署环境。
function loadUpdateCheck(environment: Record<string, string> = {}) {
  const requests: OutboundRequest[] = [];
  let handler: EdgeHandler | undefined;
  const modules = new Map<string, { exports: unknown }>();
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
    runInNewContext(compiled, {
      Deno: {
        env: { get: (name: string) => environment[name] },
        serve(value: EdgeHandler) {
          handler = value;
        },
      },
      Request,
      Response,
      URLSearchParams,
      exports: module.exports,
      async fetch(url: string, init?: RequestInit) {
        requests.push({
          params: new URLSearchParams(String(init?.body ?? "")),
          url: String(url),
        });
        const data = String(url).endsWith("/app/getDownUrl")
          ? { downloadUrl: "https://example.com/test-release.apk" }
          : {
              buildKey: "test-build-key",
              buildShortcutUrl: "test-app",
              buildUpdateDescription: "测试发布说明",
              buildVersion: "1.0.0",
              buildVersionNo: "11",
            };
        return new Response(JSON.stringify({ code: 0, data }), { status: 200 });
      },
      module,
      require(specifier: string) {
        if (specifier === "npm:@sentry/deno") return sentryBoundary;
        if (specifier.startsWith(".")) {
          return loadModule(resolve(dirname(path), specifier));
        }
        throw new Error(`Unexpected external dependency: ${specifier}`);
      },
    });
    return module.exports;
  }

  loadModule(resolve("supabase/functions/pgyer-update-check/index.ts"));
  assert.ok(handler, "Edge Function must register an HTTP handler");
  const registeredHandler = handler;

  return {
    requests,
    async request(body: unknown) {
      const response = await registeredHandler?.(
        new Request(
          "https://example.supabase.co/functions/v1/pgyer-update-check",
          {
            body: JSON.stringify(body),
            method: "POST",
          },
        ),
      );
      assert.ok(response);
      return response;
    },
  };
}

test("Pgyer update check returns no update without a configured target and never contacts a provider", async () => {
  const environments: Record<string, string>[] = [
    {},
    { PGYER_API_KEY: "test-api-key" },
  ];
  for (const environment of environments) {
    const endpoint = loadUpdateCheck(environment);
    const response = await endpoint.request({ currentVersion: "1.0.0" });
    assert.equal(response?.status, 200);
    assert.deepEqual(await response?.json(), {
      hasUpdate: false,
      ok: true,
      updateUrl: "https://github.com/PraxisGrove/WayLog/releases",
    });
    assert.equal(endpoint.requests.length, 0);
  }
});

test("Pgyer update check uses the configured shortcut and keeps the public response contract", async () => {
  const endpoint = loadUpdateCheck({
    PGYER_API_KEY: "test-api-key",
    PGYER_APP_SHORTCUT: "test-app",
  });
  const response = await endpoint.request({
    currentBuildNumber: "10",
    currentVersion: "9.0.0",
  });
  assert.equal(response?.status, 200);
  assert.deepEqual(await response?.json(), {
    downloadUrl: "https://example.com/test-release.apk",
    hasUpdate: true,
    latestBuildNumber: "11",
    latestVersion: "1.0.0",
    ok: true,
    releaseNotes: "测试发布说明",
    updateUrl: "https://www.pgyer.com/test-app",
  });
  assert.equal(
    endpoint.requests[0]?.url,
    "https://www.pgyer.com/apiv2/app/getByShortcut",
  );
  assert.equal(
    endpoint.requests[0]?.params.get("buildShortcutUrl"),
    "test-app",
  );
  assert.equal(endpoint.requests[1]?.params.get("buildKey"), "test-build-key");
});

test("Pgyer update check selects the configured app key before an optional shortcut", async () => {
  const endpoint = loadUpdateCheck({
    PGYER_API_KEY: "test-api-key",
    PGYER_APP_KEY: "test-app-key",
    PGYER_APP_SHORTCUT: "other-test-app",
  });
  const response = await endpoint.request({ currentBuildNumber: "11" });
  assert.equal(response?.status, 200);
  const payload = await response?.json();
  assert.equal(payload?.hasUpdate, false);
  assert.equal(
    endpoint.requests[0]?.url,
    "https://www.pgyer.com/apiv2/app/view",
  );
  assert.equal(endpoint.requests[0]?.params.get("appKey"), "test-app-key");
  assert.equal(endpoint.requests[0]?.params.has("buildShortcutUrl"), false);
});
