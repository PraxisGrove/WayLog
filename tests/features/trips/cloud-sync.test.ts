import assert from "node:assert/strict";
import test from "node:test";

import { setAuthStorageAdapter } from "../../../features/auth";
import { AUTH_STORAGE_KEY } from "../../../features/auth/storage";
import { getCloudSyncSession } from "../../../features/trips/cloud-sync";

const originalFetch = globalThis.fetch;
const memoryStorage = new Map<string, string>();

function configureSupabase() {
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://travel-test.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
}

function createExpiredAccessToken(): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) - 300,
      sub: "user-1",
    }),
  ).toString("base64url");
  return `${header}.${payload}.signature`;
}

function createFreshAccessToken(): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: "user-1",
    }),
  ).toString("base64url");
  return `${header}.${payload}.signature`;
}

function resetCloudSyncTestState() {
  memoryStorage.clear();
  process.env.EXPO_PUBLIC_SUPABASE_URL = undefined;
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = undefined;
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

function seedExpiredCloudUser(): void {
  memoryStorage.set(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      identities: [
        {
          createdAt: "2026-06-07T14:00:00.000Z",
          id: "identity-1",
          label: "u***@example.com",
          lastLoginAt: "2026-06-07T14:00:00.000Z",
          provider: "email",
          providerUid: "user@example.com",
          userId: "user-1",
        },
      ],
      session: {
        accessToken: createExpiredAccessToken(),
        createdAt: "2026-06-07T14:00:00.000Z",
        lastActiveAt: "2026-06-07T14:00:00.000Z",
        refreshToken: "refresh-token-1",
        userId: "user-1",
      },
      users: [
        {
          createdAt: "2026-06-07T14:00:00.000Z",
          displayName: "Test User",
          id: "user-1",
          updatedAt: "2026-06-07T14:00:00.000Z",
        },
      ],
    }),
  );
}

test("getCloudSyncSession deduplicates concurrent expired-token refreshes", async () => {
  resetCloudSyncTestState();
  configureSupabase();

  seedExpiredCloudUser();

  let refreshRequestCount = 0;
  globalThis.fetch = (async (url, init) => {
    const urlText = String(url);

    if (urlText.endsWith("/auth/v1/token?grant_type=refresh_token")) {
      refreshRequestCount += 1;
      assert.deepEqual(JSON.parse(String(init?.body)), {
        refresh_token: "refresh-token-1",
      });

      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: createFreshAccessToken(),
          refresh_token: "refresh-token-2",
        }),
      } as Response;
    }

    throw new Error(`Unexpected request ${urlText}`);
  }) as typeof fetch;

  const [sessionA, sessionB] = await Promise.all([
    getCloudSyncSession(),
    getCloudSyncSession(),
  ]);

  assert.equal(refreshRequestCount, 1);
  assert.equal(sessionA?.userId, "user-1");
  assert.equal(sessionB?.userId, "user-1");
  assert.equal(sessionA?.accessToken, sessionB?.accessToken);

  const storedAuthState = JSON.parse(
    memoryStorage.get(AUTH_STORAGE_KEY) ?? "{}",
  ) as {
    session?: { accessToken?: string; refreshToken?: string };
  };
  assert.equal(storedAuthState.session?.accessToken, sessionA?.accessToken);
  assert.equal(storedAuthState.session?.refreshToken, "refresh-token-2");
});

test("getCloudSyncSession clears local auth when expired-token refresh fails", async () => {
  resetCloudSyncTestState();
  configureSupabase();
  seedExpiredCloudUser();

  globalThis.fetch = (async (url) => {
    const urlText = String(url);

    if (urlText.endsWith("/auth/v1/token?grant_type=refresh_token")) {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: "invalid_grant" }),
      } as Response;
    }

    throw new Error(`Unexpected request ${urlText}`);
  }) as typeof fetch;

  const session = await getCloudSyncSession();
  const storedAuthState = JSON.parse(
    memoryStorage.get(AUTH_STORAGE_KEY) ?? "{}",
  ) as {
    session?: unknown;
  };

  assert.equal(session, null);
  assert.equal(storedAuthState.session, null);
});
