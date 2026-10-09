import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_STORAGE_KEY,
  type AuthInvalidatedEvent,
  type AuthSession,
  type AuthState,
  addAuthInvalidatedListener,
  FOREGROUND_REFRESH_THRESHOLD_MS,
  requestSupabase,
  saveRefreshedSessionIfCurrent,
  setAuthStorageAdapter,
  shouldRefreshOnForeground,
} from "../../features/auth";
import {
  clearDiagnosticRingBufferForTests,
  getDiagnosticBundle,
} from "../../features/diagnostics";

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;
const memoryStorage = new Map<string, string>();

function resetTestState(): void {
  memoryStorage.clear();
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://travel-test.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  globalThis.fetch = originalFetch;
  setAuthStorageAdapter({
    getItem: async (key: string) => memoryStorage.get(key) ?? null,
    removeItem: async (key: string) => {
      memoryStorage.delete(key);
    },
    setItem: async (key: string, value: string) => {
      memoryStorage.set(key, value);
    },
  });
}

function seedSignedInUser(): void {
  memoryStorage.set(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      identities: [],
      session: {
        accessToken: "primary-access-token",
        createdAt: "2026-06-17T00:00:00.000Z",
        lastActiveAt: "2026-06-17T00:00:00.000Z",
        refreshToken: "primary-refresh-token",
        userId: "primary-user",
      },
      users: [
        {
          createdAt: "2026-06-17T00:00:00.000Z",
          displayName: "测试账号",
          id: "primary-user",
          updatedAt: "2026-06-17T00:00:00.000Z",
        },
      ],
    }),
  );
}

function readAuthState(): AuthState {
  const raw = memoryStorage.get(AUTH_STORAGE_KEY);
  if (!raw) {
    throw new Error("Expected auth state to be seeded.");
  }
  return JSON.parse(raw) as AuthState;
}

function mockFetchReturning(status: number, body: unknown): () => number {
  let fetchCalls = 0;

  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return {
      json: async () => body,
      ok: false,
      status,
    } as Response;
  }) as typeof fetch;

  return () => fetchCalls;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

test("shouldRefreshOnForeground: lastBackgroundedAt 为 null 时不刷新", () => {
  assert.equal(shouldRefreshOnForeground(null, Date.now()), false);
});

test("shouldRefreshOnForeground: 后台时长不足阈值时不刷新", () => {
  const now = 1_000_000;
  const lastBackgroundedAt = now - (FOREGROUND_REFRESH_THRESHOLD_MS - 1);

  assert.equal(shouldRefreshOnForeground(lastBackgroundedAt, now), false);
});

test("shouldRefreshOnForeground: 后台时长恰好等于阈值时刷新（边界）", () => {
  const now = 1_000_000;
  const lastBackgroundedAt = now - FOREGROUND_REFRESH_THRESHOLD_MS;

  assert.equal(shouldRefreshOnForeground(lastBackgroundedAt, now), true);
});

test("shouldRefreshOnForeground: 后台时长超过阈值时刷新", () => {
  const now = 1_000_000;
  const lastBackgroundedAt = now - (FOREGROUND_REFRESH_THRESHOLD_MS + 1);

  assert.equal(shouldRefreshOnForeground(lastBackgroundedAt, now), true);
});

test("shouldRefreshOnForeground: 支持自定义阈值", () => {
  const now = 1_000_000;
  const lastBackgroundedAt = now - 3_000;

  assert.equal(shouldRefreshOnForeground(lastBackgroundedAt, now, 2_000), true);
  assert.equal(
    shouldRefreshOnForeground(lastBackgroundedAt, now, 5_000),
    false,
  );
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

test("requestSupabase: 带 accessToken 收到 401 时触发 auth invalidated listener", async () => {
  resetTestState();
  seedSignedInUser();

  let listenerCalls = 0;
  let receivedEvent: AuthInvalidatedEvent | null = null;
  const unsubscribe = addAuthInvalidatedListener((event) => {
    listenerCalls += 1;
    receivedEvent = event;
  });

  const getFetchCalls = mockFetchReturning(401, {
    code: "PGRST303",
    message: "JWT expired",
  });

  try {
    await assert.rejects(
      () =>
        requestSupabase<unknown>({
          accessToken: "primary-access-token",
          method: "GET",
          path: "user_favorite_places?user_id=eq.primary-user",
          service: "rest",
        }),
      /JWT expired/,
    );

    assert.equal(getFetchCalls(), 1);
    assert.equal(listenerCalls, 1);
    assert.deepEqual(receivedEvent, {
      method: "GET",
      path: "user_favorite_places?user_id=eq.primary-user",
      service: "rest",
      status: 401,
    });
  } finally {
    unsubscribe();
  }
});

test("requestSupabase: JWT issued at future 等待后重试且不使登录失效", async (t) => {
  resetTestState();
  seedSignedInUser();
  clearDiagnosticRingBufferForTests();
  t.mock.timers.enable({ apis: ["setTimeout"] });

  let fetchCalls = 0;
  let listenerCalls = 0;
  const unsubscribe = addAuthInvalidatedListener(() => {
    listenerCalls += 1;
  });

  globalThis.fetch = (async () => {
    fetchCalls += 1;

    if (fetchCalls === 1) {
      return {
        json: async () => ({
          code: "PGRST303",
          message: "JWT issued at future",
        }),
        ok: false,
        status: 401,
      } as Response;
    }

    return {
      json: async () => [{ id: "favorite-place-1" }],
      ok: true,
      status: 200,
    } as Response;
  }) as typeof fetch;

  try {
    const requestPromise = requestSupabase<Array<{ id: string }>>({
      accessToken: "primary-access-token",
      method: "GET",
      path: "user_favorite_places?user_id=eq.primary-user",
      service: "rest",
    });
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(fetchCalls, 1);
    t.mock.timers.tick(999);
    await Promise.resolve();
    assert.equal(fetchCalls, 1);

    t.mock.timers.tick(1);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(fetchCalls, 2);

    const rows = await requestPromise;

    assert.deepEqual(rows, [{ id: "favorite-place-1" }]);
    assert.equal(listenerCalls, 0);
    assert.deepEqual(
      getDiagnosticBundle().entries.map((entry) => ({
        event: entry.event,
        level: entry.level,
      })),
      [{ event: "jwt.future.retry.scheduled", level: "warn" }],
    );
  } finally {
    unsubscribe();
    clearDiagnosticRingBufferForTests();
  }
});

test("requestSupabase: JWT issued at future 重试耗尽后仍不使登录失效", async (t) => {
  resetTestState();
  seedSignedInUser();
  t.mock.timers.enable({ apis: ["setTimeout"] });

  let fetchCalls = 0;
  let listenerCalls = 0;
  const body = { deleted_at: "2026-08-26T08:00:00.000Z" };
  const requestBodies: string[] = [];
  const unsubscribe = addAuthInvalidatedListener(() => {
    listenerCalls += 1;
  });

  globalThis.fetch = (async (_url, init) => {
    fetchCalls += 1;
    requestBodies.push(String(init?.body));
    return {
      json: async () => ({
        code: "PGRST303",
        message: "JWT issued at future",
      }),
      ok: false,
      status: 401,
    } as Response;
  }) as typeof fetch;

  try {
    const rejection = assert.rejects(
      () =>
        requestSupabase<unknown>({
          accessToken: "primary-access-token",
          body,
          method: "PATCH",
          path: "user_favorite_places?user_id=eq.primary-user&id=eq.favorite-place-1",
          service: "rest",
        }),
      /JWT issued at future/,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(fetchCalls, 1);
    t.mock.timers.tick(1_000);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(fetchCalls, 2);

    t.mock.timers.tick(2_000);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(fetchCalls, 3);

    t.mock.timers.tick(4_000);
    await new Promise<void>((resolve) => setImmediate(resolve));
    await rejection;

    assert.equal(fetchCalls, 4);
    assert.equal(listenerCalls, 0);
    assert.deepEqual(requestBodies, [
      JSON.stringify(body),
      JSON.stringify(body),
      JSON.stringify(body),
      JSON.stringify(body),
    ]);
  } finally {
    unsubscribe();
  }
});

test("requestSupabase: 带 accessToken 收到认证失效类 403 时触发 listener", async () => {
  resetTestState();
  seedSignedInUser();

  let listenerCalls = 0;
  const unsubscribe = addAuthInvalidatedListener(() => {
    listenerCalls += 1;
  });

  mockFetchReturning(403, { error: "JWT expired" });

  await assert.rejects(
    () =>
      requestSupabase<unknown>({
        accessToken: "primary-access-token",
        method: "PATCH",
        path: "user_trips?id=eq.abc",
        service: "rest",
      }),
    /JWT expired/,
  );

  assert.equal(listenerCalls, 1);

  unsubscribe();
});

test("requestSupabase: 普通 403 权限错误不触发 auth invalidated listener", async () => {
  resetTestState();
  seedSignedInUser();

  let listenerCalls = 0;
  const unsubscribe = addAuthInvalidatedListener(() => {
    listenerCalls += 1;
  });

  mockFetchReturning(403, { error: "forbidden" });

  await assert.rejects(
    () =>
      requestSupabase<unknown>({
        accessToken: "primary-access-token",
        method: "PATCH",
        path: "user_trips?id=eq.abc",
        service: "rest",
      }),
    /forbidden/,
  );

  assert.equal(listenerCalls, 0);

  unsubscribe();
});

test("requestSupabase: 匿名 key（无 accessToken）收到 401 时不触发 listener", async () => {
  resetTestState();
  memoryStorage.clear();

  let listenerCalls = 0;
  const unsubscribe = addAuthInvalidatedListener(() => {
    listenerCalls += 1;
  });

  mockFetchReturning(401, { error: "invalid_grant" });

  await assert.rejects(
    () =>
      requestSupabase<unknown>({
        method: "POST",
        path: "token?grant_type=password",
        service: "auth",
      }),
    /invalid_grant/,
  );

  assert.equal(listenerCalls, 0);

  unsubscribe();
});

test("requestSupabase: 500 等非 401/403 错误不触发 listener", async () => {
  resetTestState();
  seedSignedInUser();

  let listenerCalls = 0;
  const unsubscribe = addAuthInvalidatedListener(() => {
    listenerCalls += 1;
  });

  mockFetchReturning(500, { message: "internal" });

  await assert.rejects(
    () =>
      requestSupabase<unknown>({
        accessToken: "primary-access-token",
        method: "GET",
        path: "profiles?id=eq.primary-user",
        service: "rest",
      }),
    /internal/,
  );

  assert.equal(listenerCalls, 0);

  unsubscribe();
});

test("requestSupabase: 404 不触发 listener", async () => {
  resetTestState();
  seedSignedInUser();

  let listenerCalls = 0;
  const unsubscribe = addAuthInvalidatedListener(() => {
    listenerCalls += 1;
  });

  mockFetchReturning(404, { message: "not found" });

  await assert.rejects(
    () =>
      requestSupabase<unknown>({
        accessToken: "primary-access-token",
        method: "GET",
        path: "user_trips?id=eq.missing",
        service: "rest",
      }),
    /not found/,
  );

  assert.equal(listenerCalls, 0);

  unsubscribe();
});

test("requestSupabase: listener 抛错不影响其他 listener 也不阻止 error 抛出", async () => {
  resetTestState();
  seedSignedInUser();

  const calls: string[] = [];
  const unsubscribeBad = addAuthInvalidatedListener(() => {
    calls.push("bad");
    throw new Error("listener intentionally throws");
  });
  const unsubscribeGood = addAuthInvalidatedListener(() => {
    calls.push("good");
  });

  mockFetchReturning(401, {});

  await assert.rejects(
    () =>
      requestSupabase<unknown>({
        accessToken: "primary-access-token",
        method: "GET",
        path: "user",
        service: "auth",
      }),
    /Supabase 请求失败/,
  );

  assert.deepEqual(calls, ["bad", "good"]);

  unsubscribeBad();
  unsubscribeGood();
});

test("requestSupabase: unsubscribe 后 listener 不再被调用", async () => {
  resetTestState();
  seedSignedInUser();

  let listenerCalls = 0;
  const unsubscribe = addAuthInvalidatedListener(() => {
    listenerCalls += 1;
  });

  mockFetchReturning(401, {});

  await assert.rejects(() =>
    requestSupabase<unknown>({
      accessToken: "primary-access-token",
      method: "GET",
      path: "user",
      service: "auth",
    }),
  );
  assert.equal(listenerCalls, 1);

  unsubscribe();

  await assert.rejects(() =>
    requestSupabase<unknown>({
      accessToken: "primary-access-token",
      method: "GET",
      path: "user",
      service: "auth",
    }),
  );
  assert.equal(listenerCalls, 1);
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

test("saveRefreshedSessionIfCurrent: refresh 成功后写回最新 token", async () => {
  resetTestState();
  seedSignedInUser();

  const requestedSession = readAuthState().session as AuthSession;
  const didSave = await saveRefreshedSessionIfCurrent(requestedSession, {
    ...requestedSession,
    accessToken: "new-access-token",
    lastActiveAt: "2026-06-17T01:00:00.000Z",
    refreshToken: "new-refresh-token",
  });

  const savedSession = readAuthState().session;

  assert.equal(didSave, true);
  assert.equal(savedSession?.accessToken, "new-access-token");
  assert.equal(savedSession?.refreshToken, "new-refresh-token");
  assert.equal(savedSession?.lastActiveAt, "2026-06-17T01:00:00.000Z");
});

test("saveRefreshedSessionIfCurrent: 本地 session 已变化时不覆盖新状态", async () => {
  resetTestState();
  seedSignedInUser();

  const requestedSession = readAuthState().session as AuthSession;
  memoryStorage.set(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      ...readAuthState(),
      session: {
        ...requestedSession,
        accessToken: "newer-access-token-from-another-flow",
      },
    }),
  );

  const didSave = await saveRefreshedSessionIfCurrent(requestedSession, {
    ...requestedSession,
    accessToken: "stale-refresh-result",
    lastActiveAt: "2026-06-17T01:00:00.000Z",
  });

  assert.equal(didSave, false);
  assert.equal(
    readAuthState().session?.accessToken,
    "newer-access-token-from-another-flow",
  );
});
