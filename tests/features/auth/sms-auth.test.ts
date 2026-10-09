import assert from "node:assert/strict";
import test from "node:test";

import {
  getSmsSendErrorDetails,
  SMS_SEND_COOLDOWN_SECONDS,
  sendSmsCode,
} from "../../../features/auth/sms-auth";

const originalFetch = globalThis.fetch;

function configureSupabase() {
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://travel-test.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
}

function resetTestState() {
  globalThis.fetch = originalFetch;
  process.env.EXPO_PUBLIC_SUPABASE_URL = undefined;
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = undefined;
}

test("getSmsSendErrorDetails translates Aliyun frequency errors", () => {
  assert.deepEqual(
    getSmsSendErrorDetails(new Error("check frequency failed")),
    {
      cooldownSeconds: SMS_SEND_COOLDOWN_SECONDS,
      message: "短信发送过于频繁，请等待 60 秒后再试。",
    },
  );
});

test("sendSmsCode coalesces concurrent requests for the same phone", async () => {
  try {
    configureSupabase();
    let requestCount = 0;

    globalThis.fetch = (async () => {
      requestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));

      return new Response(
        JSON.stringify({
          success: true,
          verifyToken: "verify-token",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const results = await Promise.all([
      sendSmsCode("13800138000"),
      sendSmsCode("+86 138 0013 8000"),
    ]);

    assert.equal(requestCount, 1);
    assert.deepEqual(results, ["verify-token", "verify-token"]);
  } finally {
    resetTestState();
  }
});

test("sendSmsCode exposes a friendly message for deployed raw frequency errors", async () => {
  try {
    configureSupabase();

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: "check frequency failed",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      )) as typeof fetch;

    await assert.rejects(
      () => sendSmsCode("13800138000"),
      /短信发送过于频繁，请等待 60 秒后再试/,
    );
  } finally {
    resetTestState();
  }
});
