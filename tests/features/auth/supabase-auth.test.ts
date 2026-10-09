import assert from "node:assert/strict";
import test from "node:test";

import {
  setAgentLocalStorageAdapterForTests,
  setLegacyAgentLocalStorageAdapterForTests,
} from "../../../features/agent";
import {
  setLocalDbForTests,
  type LocalDb,
  type LocalDbExecutor,
  type LocalDbRunResult,
} from "../../../features/local-db";
import {
  AUTH_STORAGE_KEY,
  bindEmailToCurrentUser,
  bindPhoneToCurrentUser,
  dismissPasswordSetupPrompt,
  getCurrentAuthUser,
  hasGuestIdentityRecord,
  mergeWithAccount,
  refreshCurrentUserIdentities,
  requestEmailOtp,
  requestPhoneOtp,
  setAuthStorageAdapter,
  setCurrentUserPassword,
  signInAsGuest,
  signInWithEmailCode,
  signInWithEmailPassword,
  signInWithPhoneCode,
  signInWithPhonePassword,
  signInWithWechat,
  signOut,
  updateCurrentUserProfile,
} from "../../../features/auth";

const originalFetch = globalThis.fetch;
const memoryStorage = new Map<string, string>();
const TRIPS_STORAGE_KEY = "waylog.trips.v1";
const TRIP_SYNC_STORAGE_KEY = "waylog.trip_sync.v1";
const FAVORITE_PLACES_STORAGE_KEY = "waylog.favorite_places.v1";
const FAVORITE_PLACE_SYNC_STORAGE_KEY = "waylog.favorite_place_sync.v1";
const TRIP_ROUTE_PREFERENCE_STORAGE_KEY = "waylog.trip_route_preferences.v1";
const TRIP_EXPENSE_PREFERENCE_STORAGE_KEY =
  "waylog.trip_expense_preferences.v1";
const AGENT_APPLIED_PROPOSALS_STORAGE_KEY = "waylog.agent.applied-proposals.v1";
const AGENT_TRIP_CREATE_RECEIPT_STORAGE_KEY =
  "waylog.agent.trip-create-receipt.v1.operation-1";
const AGENT_TRIP_CREATE_PENDING_STORAGE_KEY =
  "waylog.agent.trip-create-pending.v1.operation-2";
const AGENT_CONVERSATION_INDEX_STORAGE_KEY =
  "waylog.agent.conversations.index.v1";
const AGENT_CONVERSATION_STORAGE_KEY_PREFIX = "waylog.agent.conversation.v1.";
const ACCOUNT_AGENT_CONVERSATION_INDEX_STORAGE_KEY =
  "waylog.agent.account.v1.supabase-user-1.conversations.index";

function resetAuthTestState() {
  memoryStorage.clear();
  process.env.EXPO_PUBLIC_SUPABASE_URL = undefined;
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = undefined;
  globalThis.fetch = originalFetch;
  setAuthStorageAdapter(__authTestStorage);
  setAgentLocalStorageAdapterForTests(__authTestStorage);
  setLegacyAgentLocalStorageAdapterForTests(undefined);
  setLocalDbForTests(createAuthFakeLocalDb());
}

function configureSupabase() {
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://travel-test.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
}

function createProfileSelectUrl(userId: string) {
  return `https://travel-test.supabase.co/rest/v1/profiles?id=eq.${encodeURIComponent(
    userId,
  )}&select=id,display_name,avatar_url,bio,home_city,avatar_scale,avatar_offset_x,avatar_offset_y,created_at,updated_at&limit=1`;
}

function seedSignedInUser() {
  memoryStorage.set(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      identities: [
        {
          createdAt: "2026-06-11T00:00:00.000Z",
          id: "identity-primary",
          label: "138****8000",
          lastLoginAt: "2026-06-11T00:00:00.000Z",
          provider: "phone",
          providerUid: "+8613800138000",
          userId: "primary-user",
        },
      ],
      session: {
        accessToken: "primary-access-token",
        createdAt: "2026-06-11T00:00:00.000Z",
        lastActiveAt: "2026-06-11T00:00:00.000Z",
        refreshToken: "primary-refresh-token",
        userId: "primary-user",
      },
      users: [
        {
          createdAt: "2026-06-11T00:00:00.000Z",
          displayName: "主账号",
          id: "primary-user",
          updatedAt: "2026-06-11T00:00:00.000Z",
        },
      ],
    }),
  );
}

test("requestPhoneOtp requires Supabase configuration", async () => {
  resetAuthTestState();

  await assert.rejects(
    () => requestPhoneOtp("13800138000"),
    /请先配置 Supabase/,
  );
});

test("requestPhoneOtp calls the Aliyun SMS Edge Function", async () => {
  resetAuthTestState();
  configureSupabase();
  const requests: {
    body: string;
    headers: Record<string, string>;
    url: string;
  }[] = [];

  globalThis.fetch = (async (url, init) => {
    requests.push({
      body: String(init?.body),
      headers: init?.headers as Record<string, string>,
      url: String(url),
    });

    return {
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response;
  }) as typeof fetch;

  await requestPhoneOtp("138 0013 8000");

  assert.equal(requests.length, 1);
  assert.equal(
    requests[0]?.url,
    "https://travel-test.supabase.co/functions/v1/send-sms",
  );
  assert.equal(requests[0]?.headers.apikey, "test-anon-key");
  assert.deepEqual(JSON.parse(requests[0]?.body ?? "{}"), {
    phone: "+8613800138000",
  });
});

test("requestEmailOtp calls Supabase email OTP endpoint", async () => {
  resetAuthTestState();
  configureSupabase();
  const requests: {
    body: string;
    headers: Record<string, string>;
    url: string;
  }[] = [];

  globalThis.fetch = (async (url, init) => {
    requests.push({
      body: String(init?.body),
      headers: init?.headers as Record<string, string>,
      url: String(url),
    });

    return {
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response;
  }) as typeof fetch;

  await requestEmailOtp(" USER@Example.COM ");

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "https://travel-test.supabase.co/auth/v1/otp");
  assert.equal(requests[0]?.headers.apikey, "test-anon-key");
  assert.deepEqual(JSON.parse(requests[0]?.body ?? "{}"), {
    email: "user@example.com",
    create_user: true,
  });
});

test("signInWithEmailCode creates a local session from verified Supabase email auth", async () => {
  resetAuthTestState();
  configureSupabase();
  const requests: {
    body: string;
    headers: Record<string, string>;
    method: string;
    url: string;
  }[] = [];

  globalThis.fetch = (async (url, init) => {
    const urlText = String(url);

    requests.push({
      body: String(init?.body),
      headers: init?.headers as Record<string, string>,
      method: init?.method ?? "GET",
      url: urlText,
    });

    if (urlText === "https://travel-test.supabase.co/auth/v1/verify") {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        email: "user@example.com",
        token: "135790",
        type: "email",
      });

      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "email-access-token",
          refresh_token: "email-refresh-token",
          user: {
            id: "email-user-1",
            email: "user@example.com",
            created_at: "2026-05-30T00:00:00.000Z",
            updated_at: "2026-05-30T00:00:01.000Z",
          },
        }),
      } as Response;
    }

    if (urlText === createProfileSelectUrl("email-user-1")) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            avatar_offset_x: -6,
            avatar_offset_y: 8,
            avatar_scale: "1.5",
            avatar_url: "https://example.com/avatar.jpg",
            bio: "Cloud bio",
            display_name: "Cloud Name",
            home_city: "Shanghai",
          },
        ],
      } as Response;
    }

    throw new Error(`Unexpected request ${urlText}`);
  }) as typeof fetch;

  const authUser = await signInWithEmailCode(" USER@Example.COM ", "135790");

  assert.equal(authUser.user.id, "email-user-1");
  assert.equal(authUser.user.displayName, "Cloud Name");
  assert.equal(authUser.user.avatarOffsetX, -6);
  assert.equal(authUser.user.avatarOffsetY, 8);
  assert.equal(authUser.user.avatarScale, 1.5);
  assert.equal(authUser.user.avatarUrl, "https://example.com/avatar.jpg");
  assert.equal(authUser.user.bio, "Cloud bio");
  assert.equal(authUser.user.homeCity, "Shanghai");
  assert.equal(authUser.identities[0]?.provider, "email");
  assert.equal(authUser.identities[0]?.providerUid, "user@example.com");
  assert.equal(authUser.identities[0]?.label, "u***@example.com");
  assert.equal(authUser.identities[0]?.hasPassword, false);
  assert.equal(authUser.session.accessToken, "email-access-token");
  assert.equal(authUser.session.passwordSetupRecommended, false);
  assert.equal(authUser.session.refreshToken, "email-refresh-token");
  assert.equal(requests[1]?.method, "GET");
  assert.equal(requests[1]?.headers.Authorization, "Bearer email-access-token");
  assert.equal((await getCurrentAuthUser())?.user.id, "email-user-1");
});

test("signInWithEmailCode refreshes profile fields for an existing local user", async () => {
  resetAuthTestState();
  configureSupabase();

  memoryStorage.set(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      identities: [
        {
          createdAt: "2026-05-30T00:00:00.000Z",
          id: "identity-1",
          label: "u***@example.com",
          lastLoginAt: "2026-05-30T00:00:00.000Z",
          provider: "email",
          providerUid: "user@example.com",
          userId: "email-user-1",
        },
      ],
      session: null,
      users: [
        {
          avatarUrl: "https://example.com/old-avatar.jpg",
          bio: "Old bio",
          createdAt: "2026-05-30T00:00:00.000Z",
          displayName: "Old Name",
          homeCity: "Old City",
          id: "email-user-1",
          updatedAt: "2026-05-30T00:00:01.000Z",
        },
      ],
    }),
  );

  globalThis.fetch = (async (url, init) => {
    const urlText = String(url);

    if (urlText === "https://travel-test.supabase.co/auth/v1/verify") {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        email: "user@example.com",
        token: "135790",
        type: "email",
      });

      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "email-access-token",
          refresh_token: "email-refresh-token",
          user: {
            id: "email-user-1",
            email: "user@example.com",
            created_at: "2026-05-30T00:00:00.000Z",
            updated_at: "2026-05-30T00:00:02.000Z",
          },
        }),
      } as Response;
    }

    if (urlText === createProfileSelectUrl("email-user-1")) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            avatar_offset_x: 12,
            avatar_offset_y: -4,
            avatar_scale: "1.4",
            avatar_url: "https://example.com/cloud-avatar.jpg",
            bio: "Cloud bio",
            display_name: "Cloud Name",
            home_city: "Shanghai",
          },
        ],
      } as Response;
    }

    throw new Error(`Unexpected request ${urlText}`);
  }) as typeof fetch;

  const authUser = await signInWithEmailCode(" USER@Example.COM ", "135790");

  assert.equal(authUser.user.displayName, "Cloud Name");
  assert.equal(authUser.user.avatarUrl, "https://example.com/cloud-avatar.jpg");
  assert.equal(authUser.user.avatarOffsetX, 12);
  assert.equal(authUser.user.avatarOffsetY, -4);
  assert.equal(authUser.user.avatarScale, 1.4);
  assert.equal(authUser.user.bio, "Cloud bio");
  assert.equal(authUser.user.homeCity, "Shanghai");
  assert.equal(
    (await getCurrentAuthUser())?.user.avatarUrl,
    "https://example.com/cloud-avatar.jpg",
  );
});

test("signInWithEmailCode falls back to signup verification for first-time email codes", async () => {
  resetAuthTestState();
  configureSupabase();
  const verifyBodies: unknown[] = [];
  const profileRequests: string[] = [];

  globalThis.fetch = (async (url, init) => {
    const urlText = String(url);

    if (urlText === createProfileSelectUrl("signup-user-1")) {
      profileRequests.push(urlText);

      return {
        ok: true,
        status: 200,
        json: async () => [],
      } as Response;
    }

    assert.equal(urlText, "https://travel-test.supabase.co/auth/v1/verify");
    const body = JSON.parse(String(init?.body));

    verifyBodies.push(body);

    if (body.type === "email") {
      return {
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: "Token has expired or is invalid",
          },
        }),
      } as Response;
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "signup-access-token",
        refresh_token: "signup-refresh-token",
        user: {
          id: "signup-user-1",
          email: "new@example.com",
          created_at: "2026-05-30T00:00:00.000Z",
          updated_at: "2026-05-30T00:00:01.000Z",
        },
      }),
    } as Response;
  }) as typeof fetch;

  const authUser = await signInWithEmailCode(" NEW@Example.COM ", "246810");

  assert.deepEqual(verifyBodies, [
    {
      email: "new@example.com",
      token: "246810",
      type: "email",
    },
    {
      email: "new@example.com",
      token: "246810",
      type: "signup",
    },
  ]);
  assert.equal(authUser.user.id, "signup-user-1");
  assert.equal(authUser.session.accessToken, "signup-access-token");
  assert.equal(authUser.session.passwordSetupRecommended, true);
  assert.deepEqual(profileRequests, [createProfileSelectUrl("signup-user-1")]);
  assert.equal(
    (await getCurrentAuthUser())?.session.passwordSetupRecommended,
    true,
  );
});

test("dismissPasswordSetupPrompt clears the first-time email password recommendation", async () => {
  resetAuthTestState();
  configureSupabase();

  memoryStorage.set(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      identities: [
        {
          createdAt: "2026-05-30T00:00:00.000Z",
          id: "identity-1",
          label: "n***@example.com",
          lastLoginAt: "2026-05-30T00:00:00.000Z",
          provider: "email",
          providerUid: "new@example.com",
          userId: "signup-user-1",
        },
      ],
      session: {
        accessToken: "signup-access-token",
        createdAt: "2026-05-30T00:00:00.000Z",
        lastActiveAt: "2026-05-30T00:00:00.000Z",
        passwordSetupRecommended: true,
        refreshToken: "signup-refresh-token",
        userId: "signup-user-1",
      },
      users: [
        {
          createdAt: "2026-05-30T00:00:00.000Z",
          displayName: "旅行者 new",
          id: "signup-user-1",
          updatedAt: "2026-05-30T00:00:01.000Z",
        },
      ],
    }),
  );

  const authUser = await dismissPasswordSetupPrompt();

  assert.equal(Boolean(authUser?.session.passwordSetupDismissedAt), true);
  assert.equal(authUser?.session.passwordSetupRecommended, false);
  assert.equal(
    (await getCurrentAuthUser())?.session.passwordSetupRecommended,
    false,
  );
});

test("dismissPasswordSetupPrompt remembers dismissal for signed-in email sessions without the legacy prompt flag", async () => {
  resetAuthTestState();
  configureSupabase();

  memoryStorage.set(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      identities: [
        {
          createdAt: "2026-05-30T00:00:00.000Z",
          id: "identity-1",
          label: "n***@example.com",
          lastLoginAt: "2026-05-30T00:00:00.000Z",
          provider: "email",
          providerUid: "new@example.com",
          userId: "signup-user-1",
        },
      ],
      session: {
        accessToken: "signup-access-token",
        createdAt: "2026-05-30T00:00:00.000Z",
        lastActiveAt: "2026-05-30T00:00:00.000Z",
        refreshToken: "signup-refresh-token",
        userId: "signup-user-1",
      },
      users: [
        {
          createdAt: "2026-05-30T00:00:00.000Z",
          displayName: "旅行者 new",
          id: "signup-user-1",
          updatedAt: "2026-05-30T00:00:01.000Z",
        },
      ],
    }),
  );

  const authUser = await dismissPasswordSetupPrompt();

  assert.equal(Boolean(authUser?.session.passwordSetupDismissedAt), true);
  assert.equal(authUser?.session.passwordSetupRecommended, false);
  assert.equal(
    Boolean((await getCurrentAuthUser())?.session.passwordSetupDismissedAt),
    true,
  );
});

test("setCurrentUserPassword updates the Supabase auth user password and clears the setup prompt", async () => {
  resetAuthTestState();
  configureSupabase();
  const requests: {
    body: string;
    headers: Record<string, string>;
    method: string;
    url: string;
  }[] = [];

  memoryStorage.set(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      identities: [
        {
          createdAt: "2026-05-30T00:00:00.000Z",
          id: "identity-1",
          label: "n***@example.com",
          lastLoginAt: "2026-05-30T00:00:00.000Z",
          provider: "email",
          providerUid: "new@example.com",
          userId: "signup-user-1",
        },
      ],
      session: {
        accessToken: "signup-access-token",
        createdAt: "2026-05-30T00:00:00.000Z",
        lastActiveAt: "2026-05-30T00:00:00.000Z",
        passwordSetupRecommended: true,
        refreshToken: "signup-refresh-token",
        userId: "signup-user-1",
      },
      users: [
        {
          createdAt: "2026-05-30T00:00:00.000Z",
          displayName: "旅行者 new",
          id: "signup-user-1",
          updatedAt: "2026-05-30T00:00:01.000Z",
        },
      ],
    }),
  );

  globalThis.fetch = (async (url, init) => {
    requests.push({
      body: String(init?.body),
      headers: init?.headers as Record<string, string>,
      method: init?.method ?? "GET",
      url: String(url),
    });

    return {
      ok: true,
      status: 200,
      json: async () => ({
        user: {
          id: "signup-user-1",
          email: "new@example.com",
        },
      }),
    } as Response;
  }) as typeof fetch;

  const authUser = await setCurrentUserPassword("new-password-1");

  assert.equal(
    requests[0]?.url,
    "https://travel-test.supabase.co/auth/v1/user",
  );
  assert.equal(requests[0]?.method, "PUT");
  assert.equal(
    requests[0]?.headers.Authorization,
    "Bearer signup-access-token",
  );
  assert.deepEqual(JSON.parse(requests[0]?.body ?? "{}"), {
    data: {
      waylog_has_password: true,
    },
    password: "new-password-1",
  });
  assert.equal(authUser.identities[0]?.hasPassword, true);
  assert.equal(Boolean(authUser.session.passwordSetupDismissedAt), true);
  assert.equal(authUser.session.passwordSetupRecommended, false);
  assert.equal(
    (await getCurrentAuthUser())?.session.passwordSetupRecommended,
    false,
  );
});

test("signInWithEmailPassword creates a local session from Supabase password auth", async () => {
  resetAuthTestState();
  configureSupabase();
  const requests: {
    body: string;
    headers: Record<string, string>;
    method: string;
    url: string;
  }[] = [];

  globalThis.fetch = (async (url, init) => {
    const urlText = String(url);

    requests.push({
      body: String(init?.body),
      headers: init?.headers as Record<string, string>,
      method: init?.method ?? "GET",
      url: urlText,
    });

    if (
      urlText ===
      "https://travel-test.supabase.co/auth/v1/token?grant_type=password"
    ) {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        email: "user@example.com",
        password: "correct-password",
      });

      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "password-access-token",
          refresh_token: "password-refresh-token",
          user: {
            id: "email-user-1",
            email: "user@example.com",
            created_at: "2026-05-30T00:00:00.000Z",
            updated_at: "2026-05-30T00:00:01.000Z",
          },
        }),
      } as Response;
    }

    if (urlText === createProfileSelectUrl("email-user-1")) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            display_name: "Saved Password Name",
          },
        ],
      } as Response;
    }

    throw new Error(`Unexpected request ${urlText}`);
  }) as typeof fetch;

  const authUser = await signInWithEmailPassword(
    " USER@Example.COM ",
    "correct-password",
  );

  assert.equal(authUser.user.id, "email-user-1");
  assert.equal(authUser.user.displayName, "Saved Password Name");
  assert.equal(authUser.identities[0]?.provider, "email");
  assert.equal(authUser.identities[0]?.hasPassword, true);
  assert.equal(authUser.session.accessToken, "password-access-token");
  assert.equal(authUser.session.passwordSetupRecommended, false);
  assert.equal(authUser.session.refreshToken, "password-refresh-token");
  assert.equal(requests[1]?.method, "GET");
  assert.equal(
    requests[1]?.headers.Authorization,
    "Bearer password-access-token",
  );
});

test("signInWithPhonePassword creates a local session through the phone password Edge Function", async () => {
  resetAuthTestState();
  configureSupabase();
  const requests: {
    body: string;
    headers: Record<string, string>;
    method: string;
    url: string;
  }[] = [];

  globalThis.fetch = (async (url, init) => {
    const urlText = String(url);

    requests.push({
      body: String(init?.body),
      headers: init?.headers as Record<string, string>,
      method: init?.method ?? "GET",
      url: urlText,
    });

    if (
      urlText ===
      "https://travel-test.supabase.co/functions/v1/phone-password-login"
    ) {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        phone: "+8613800138000",
        password: "correct-password",
      });

      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "phone-password-access-token",
          refresh_token: "phone-password-refresh-token",
          user: {
            id: "phone-user-1",
            phone: "+8613800138000",
            created_at: "2026-06-11T00:00:00.000Z",
            updated_at: "2026-06-11T00:00:01.000Z",
          },
        }),
      } as Response;
    }

    if (urlText === createProfileSelectUrl("phone-user-1")) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            display_name: "Phone Password Name",
          },
        ],
      } as Response;
    }

    throw new Error(`Unexpected request ${urlText}`);
  }) as typeof fetch;

  const authUser = await signInWithPhonePassword(
    "138 0013 8000",
    "correct-password",
  );

  assert.equal(authUser.user.id, "phone-user-1");
  assert.equal(authUser.user.displayName, "Phone Password Name");
  assert.equal(authUser.identities[0]?.provider, "phone");
  assert.equal(authUser.identities[0]?.providerUid, "+8613800138000");
  assert.equal(authUser.identities[0]?.hasPassword, true);
  assert.equal(authUser.session.accessToken, "phone-password-access-token");
  assert.equal(authUser.session.refreshToken, "phone-password-refresh-token");
  assert.equal(requests[1]?.method, "GET");
  assert.equal(
    requests[1]?.headers.Authorization,
    "Bearer phone-password-access-token",
  );
  assert.equal(
    requests.some((request) =>
      request.url.includes("/auth/v1/token?grant_type=password"),
    ),
    false,
  );
});

test("signInWithEmailCode requires an exact six digit email code before calling Supabase", async () => {
  resetAuthTestState();
  configureSupabase();
  let didFetch = false;

  globalThis.fetch = (async () => {
    didFetch = true;
    throw new Error(
      "Supabase should not be called for a malformed email code.",
    );
  }) as typeof fetch;

  await assert.rejects(
    () => signInWithEmailCode("user@example.com", "12345"),
    /请输入 6 位邮箱验证码/,
  );
  await assert.rejects(
    () => signInWithEmailCode("user@example.com", "1234567"),
    /请输入 6 位邮箱验证码/,
  );
  await assert.rejects(
    () => signInWithEmailCode("user@example.com", "123 456"),
    /请输入 6 位邮箱验证码/,
  );
  assert.equal(didFetch, false);
});

test("signInWithEmailCode reports invalid email codes with a clear user-facing message", async () => {
  resetAuthTestState();
  configureSupabase();
  const verifyBodies: unknown[] = [];

  globalThis.fetch = (async (url, init) => {
    assert.equal(String(url), "https://travel-test.supabase.co/auth/v1/verify");
    verifyBodies.push(JSON.parse(String(init?.body)));

    return {
      ok: false,
      status: 400,
      json: async () => ({
        error: "invalid_grant",
        error_description: "Token has expired or is invalid",
      }),
    } as Response;
  }) as typeof fetch;

  await assert.rejects(
    () => signInWithEmailCode(" USER@Example.COM ", "135790"),
    /验证码不正确或已过期/,
  );
  assert.deepEqual(verifyBodies, [
    {
      email: "user@example.com",
      token: "135790",
      type: "email",
    },
    {
      email: "user@example.com",
      token: "135790",
      type: "signup",
    },
  ]);
});

test("signInWithPhoneCode creates a local session from verified Supabase phone auth", async () => {
  resetAuthTestState();
  configureSupabase();
  const requests: {
    body: string;
    headers: Record<string, string>;
    method: string;
    url: string;
  }[] = [];

  globalThis.fetch = (async (url, init) => {
    const urlText = String(url);

    requests.push({
      body: String(init?.body),
      headers: init?.headers as Record<string, string>,
      method: init?.method ?? "GET",
      url: urlText,
    });

    if (
      urlText === "https://travel-test.supabase.co/functions/v1/phone-login"
    ) {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        code: "246810",
        phone: "+8613800138000",
      });

      return {
        ok: true,
        status: 200,
        json: async () => ({
          isNewUser: false,
          token_hash: "phone-token-hash",
          type: "magiclink",
          user_hint: {
            id: "supabase-user-1",
            phone: "+8613800138000",
          },
        }),
      } as Response;
    }

    if (urlText === "https://travel-test.supabase.co/auth/v1/verify") {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        token_hash: "phone-token-hash",
        type: "magiclink",
      });

      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "access-token-1",
          refresh_token: "refresh-token-1",
          user: {
            id: "supabase-user-1",
            phone: "+8613800138000",
            created_at: "2026-05-30T00:00:00.000Z",
            updated_at: "2026-05-30T00:00:01.000Z",
          },
        }),
      } as Response;
    }

    if (urlText === createProfileSelectUrl("supabase-user-1")) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            display_name: "Cloud Phone",
          },
        ],
      } as Response;
    }

    throw new Error(`Unexpected request ${urlText}`);
  }) as typeof fetch;

  const authUser = await signInWithPhoneCode("13800138000", "246810");

  assert.equal(authUser.user.id, "supabase-user-1");
  assert.equal(authUser.user.displayName, "Cloud Phone");
  assert.equal(authUser.identities[0]?.provider, "phone");
  assert.equal(authUser.identities[0]?.providerUid, "+8613800138000");
  assert.equal(authUser.session.accessToken, "access-token-1");
  assert.equal(authUser.session.refreshToken, "refresh-token-1");
  assert.equal(requests[2]?.method, "GET");
  assert.equal(requests[2]?.headers.Authorization, "Bearer access-token-1");
  assert.equal((await getCurrentAuthUser())?.user.id, "supabase-user-1");

  await signOut();
  assert.equal((await getCurrentAuthUser())?.user.id, undefined);
});

test("bindPhoneToCurrentUser verifies the code on the server and returns a signed merge proof", async () => {
  resetAuthTestState();
  configureSupabase();
  seedSignedInUser();

  globalThis.fetch = (async (url, init) => {
    assert.equal(
      String(url),
      "https://travel-test.supabase.co/functions/v1/bind-phone",
    );
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer primary-access-token",
    );
    assert.deepEqual(JSON.parse(String(init?.body)), {
      code: "2468",
      phone: "+8613900139000",
    });

    return {
      ok: true,
      status: 200,
      json: async () => ({
        conflict: true,
        conflict_user_id: "secondary-phone-user",
        display_name: "手机号旧账号",
        merge_token: "signed-phone-merge-token",
      }),
    } as Response;
  }) as typeof fetch;

  const result = await bindPhoneToCurrentUser("13900139000", "2468");

  assert.deepEqual(result, {
    conflict: true,
    conflict_user_id: "secondary-phone-user",
    display_name: "手机号旧账号",
    merge_token: "signed-phone-merge-token",
  });
});

test("bindEmailToCurrentUser uses the verified email session as ownership proof", async () => {
  resetAuthTestState();
  configureSupabase();
  seedSignedInUser();
  const requests: {
    body: string;
    headers: Record<string, string>;
    url: string;
  }[] = [];

  globalThis.fetch = (async (url, init) => {
    const urlText = String(url);

    requests.push({
      body: String(init?.body),
      headers: init?.headers as Record<string, string>,
      url: urlText,
    });

    if (urlText.endsWith("/auth/v1/verify")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "verified-email-access-token",
          refresh_token: "verified-email-refresh-token",
          user: {
            email: "user@example.com",
            id: "secondary-email-user",
          },
        }),
      } as Response;
    }

    if (urlText.endsWith("/functions/v1/bind-email")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          conflict: true,
          conflict_user_id: "secondary-email-user",
          display_name: "邮箱旧账号",
          merge_token: "signed-email-merge-token",
        }),
      } as Response;
    }

    throw new Error(`Unexpected request ${urlText}`);
  }) as typeof fetch;

  const result = await bindEmailToCurrentUser("USER@example.com", "135790");

  assert.equal(
    requests[1]?.headers.Authorization,
    "Bearer primary-access-token",
  );
  assert.deepEqual(JSON.parse(requests[1]?.body ?? "{}"), {
    emailAccessToken: "verified-email-access-token",
  });
  assert.deepEqual(result, {
    conflict: true,
    conflict_user_id: "secondary-email-user",
    display_name: "邮箱旧账号",
    merge_token: "signed-email-merge-token",
  });
});

test("refreshCurrentUserIdentities merges native identities with custom SMS and WeChat mappings", async () => {
  resetAuthTestState();
  configureSupabase();

  memoryStorage.set(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      identities: [],
      session: {
        accessToken: "primary-access-token",
        createdAt: "2026-06-11T00:00:00.000Z",
        lastActiveAt: "2026-06-11T00:00:00.000Z",
        userId: "primary-user",
      },
      users: [
        {
          createdAt: "2026-06-11T00:00:00.000Z",
          displayName: "主账号",
          id: "primary-user",
          updatedAt: "2026-06-11T00:00:00.000Z",
        },
      ],
    }),
  );

  globalThis.fetch = (async (url) => {
    const urlText = String(url);

    if (urlText === "https://travel-test.supabase.co/auth/v1/user") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "primary-user",
          email: "user@example.com",
          phone: "+8613800138000",
          identities: [
            {
              id: "native-email",
              identity_data: { email: "user@example.com" },
              provider: "email",
              provider_id: "user@example.com",
              user_id: "primary-user",
            },
            {
              id: "native-phone",
              identity_data: { phone: "+8613800138000" },
              provider: "phone",
              provider_id: "+8613800138000",
              user_id: "primary-user",
            },
            {
              id: "native-apple",
              provider: "apple",
              provider_id: "apple-user-1",
              user_id: "primary-user",
            },
          ],
        }),
      } as Response;
    }

    if (
      urlText ===
      "https://travel-test.supabase.co/rest/v1/user_identities?user_id=eq.primary-user&select=id,user_id,provider,provider_uid,display_name,created_at"
    ) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            id: "sms-phone",
            provider: "sms_phone",
            provider_uid: "+8613800138000",
            user_id: "primary-user",
          },
          {
            id: "wechat-identity",
            provider: "wechat",
            provider_uid: "wechat-union-id",
            user_id: "primary-user",
          },
        ],
      } as Response;
    }

    throw new Error(`Unexpected request ${urlText}`);
  }) as typeof fetch;

  const session = {
    accessToken: "primary-access-token",
    createdAt: "2026-06-11T00:00:00.000Z",
    lastActiveAt: "2026-06-11T00:00:00.000Z",
    userId: "primary-user",
  };

  await refreshCurrentUserIdentities(session);

  const authUser = await getCurrentAuthUser();
  assert.deepEqual(
    authUser?.identities.map((identity) => [
      identity.provider,
      identity.providerUid,
    ]),
    [
      ["email", "user@example.com"],
      ["phone", "+8613800138000"],
      ["apple", "apple-user-1"],
      ["wechat", "wechat-union-id"],
    ],
  );
});

test("refreshCurrentUserIdentities does not restore a stale session after the user changes", async () => {
  resetAuthTestState();
  configureSupabase();

  const primarySession = {
    accessToken: "primary-access-token",
    createdAt: "2026-06-11T00:00:00.000Z",
    lastActiveAt: "2026-06-11T00:00:00.000Z",
    userId: "primary-user",
  };
  const secondarySession = {
    accessToken: "secondary-access-token",
    createdAt: "2026-06-11T00:01:00.000Z",
    lastActiveAt: "2026-06-11T00:01:00.000Z",
    userId: "secondary-user",
  };
  const authState = {
    identities: [],
    session: primarySession,
    users: [
      {
        createdAt: "2026-06-11T00:00:00.000Z",
        displayName: "Primary user",
        id: "primary-user",
        updatedAt: "2026-06-11T00:00:00.000Z",
      },
      {
        createdAt: "2026-06-11T00:01:00.000Z",
        displayName: "Secondary user",
        id: "secondary-user",
        updatedAt: "2026-06-11T00:01:00.000Z",
      },
    ],
  };

  memoryStorage.set(AUTH_STORAGE_KEY, JSON.stringify(authState));

  globalThis.fetch = (async (url) => {
    const urlText = String(url);

    if (urlText === "https://travel-test.supabase.co/auth/v1/user") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "primary-user",
          identities: [],
        }),
      } as Response;
    }

    if (urlText.includes("/rest/v1/user_identities?user_id=eq.primary-user")) {
      memoryStorage.set(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          ...authState,
          session: secondarySession,
        }),
      );

      return {
        ok: true,
        status: 200,
        json: async () => [],
      } as Response;
    }

    throw new Error(`Unexpected request ${urlText}`);
  }) as typeof fetch;

  await refreshCurrentUserIdentities(primarySession);

  const authUser = await getCurrentAuthUser();
  assert.equal(authUser?.user.id, "secondary-user");
  assert.equal(authUser?.session.accessToken, "secondary-access-token");
});

test("mergeWithAccount requires the signed proof returned by a verified binding flow", async () => {
  resetAuthTestState();
  configureSupabase();
  seedSignedInUser();

  globalThis.fetch = (async (url, init) => {
    assert.equal(
      String(url),
      "https://travel-test.supabase.co/functions/v1/merge-accounts",
    );
    assert.deepEqual(JSON.parse(String(init?.body)), {
      merge_token: "signed-merge-token",
      primary_id: "primary-user",
      secondary_id: "secondary-user",
    });

    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: false,
      }),
    } as Response;
  }) as typeof fetch;

  assert.equal(
    await mergeWithAccount("secondary-user", "signed-merge-token"),
    false,
  );
});

test("signOut clears local trip data for signed-in cloud accounts", async () => {
  resetAuthTestState();
  configureSupabase();

  memoryStorage.set(TRIPS_STORAGE_KEY, JSON.stringify([{ id: "trip-1" }]));
  memoryStorage.set(
    TRIP_SYNC_STORAGE_KEY,
    JSON.stringify({ entities: { "trip-1": { dirty: true } } }),
  );
  memoryStorage.set(
    FAVORITE_PLACES_STORAGE_KEY,
    JSON.stringify([{ id: "place-1" }]),
  );
  memoryStorage.set(
    FAVORITE_PLACE_SYNC_STORAGE_KEY,
    JSON.stringify({ entities: { "place-1": { dirty: true } } }),
  );
  memoryStorage.set(
    AGENT_APPLIED_PROPOSALS_STORAGE_KEY,
    JSON.stringify([{ proposalId: "proposal-1" }]),
  );
  memoryStorage.set(
    AGENT_CONVERSATION_INDEX_STORAGE_KEY,
    JSON.stringify({
      currentConversationId: "agent-conversation-1",
      summaries: [
        {
          id: "agent-conversation-1",
          title: "Agent",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
          messageCount: 1,
        },
      ],
      version: 1,
    }),
  );
  memoryStorage.set(
    `${AGENT_CONVERSATION_STORAGE_KEY_PREFIX}agent-conversation-1`,
    JSON.stringify({
      conversation: { id: "agent-conversation-1" },
      version: 1,
    }),
  );
  memoryStorage.set(
    `${AGENT_CONVERSATION_STORAGE_KEY_PREFIX}orphan-agent-conversation`,
    JSON.stringify({
      conversation: { id: "orphan-agent-conversation" },
      version: 1,
    }),
  );
  const agentLocalStorage = new Map<string, string>();
  const agentLocalStorageAdapter = createMapStorageAdapter(agentLocalStorage);
  setAgentLocalStorageAdapterForTests(agentLocalStorageAdapter);
  agentLocalStorage.set(
    AGENT_APPLIED_PROPOSALS_STORAGE_KEY,
    JSON.stringify([{ proposalId: "sqlite-proposal-1" }]),
  );
  agentLocalStorage.set(AGENT_TRIP_CREATE_RECEIPT_STORAGE_KEY, "receipt");
  agentLocalStorage.set(AGENT_TRIP_CREATE_PENDING_STORAGE_KEY, "pending");
  agentLocalStorage.set(
    AGENT_CONVERSATION_INDEX_STORAGE_KEY,
    JSON.stringify({
      currentConversationId: "sqlite-agent-conversation-1",
      summaries: [
        {
          createdAt: "2026-06-01T00:00:00.000Z",
          id: "sqlite-agent-conversation-1",
          messageCount: 1,
          title: "SQLite Agent",
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
      version: 1,
    }),
  );
  agentLocalStorage.set(
    `${AGENT_CONVERSATION_STORAGE_KEY_PREFIX}sqlite-agent-conversation-1`,
    JSON.stringify({
      conversation: { id: "sqlite-agent-conversation-1" },
      version: 1,
    }),
  );
  agentLocalStorage.set(
    ACCOUNT_AGENT_CONVERSATION_INDEX_STORAGE_KEY,
    JSON.stringify({ summaries: [], version: 1 }),
  );
  memoryStorage.set(
    TRIP_ROUTE_PREFERENCE_STORAGE_KEY,
    JSON.stringify({
      preference: { allowEstimatedRoutes: true, preferredMode: "auto" },
      updatedAt: "2026-06-03T10:00:00.000Z",
      userId: "supabase-user-1",
      version: 1,
    }),
  );
  memoryStorage.set(
    TRIP_EXPENSE_PREFERENCE_STORAGE_KEY,
    JSON.stringify({
      preference: {
        budgetWarningRatio: 0.8,
        defaultCurrency: "CNY",
        pinnedCategories: ["餐饮", "交通"],
      },
      updatedAt: "2026-06-03T10:00:00.000Z",
      userId: "supabase-user-1",
      version: 1,
    }),
  );

  globalThis.fetch = (async (url) => {
    const urlText = String(url);

    if (urlText.endsWith("/functions/v1/phone-login")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          token_hash: "phone-token-hash",
          type: "magiclink",
          user_hint: {
            id: "supabase-user-1",
            phone: "+8613800138000",
          },
        }),
      } as Response;
    }

    if (urlText.endsWith("/auth/v1/verify")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "access-token-1",
          refresh_token: "refresh-token-1",
          user: {
            id: "supabase-user-1",
            phone: "+8613800138000",
          },
        }),
      } as Response;
    }

    if (urlText === createProfileSelectUrl("supabase-user-1")) {
      return {
        ok: true,
        status: 200,
        json: async () => [],
      } as Response;
    }

    throw new Error(`Unexpected request ${urlText}`);
  }) as typeof fetch;

  await signInWithPhoneCode("13800138000", "246810");
  await signOut();

  assert.equal(memoryStorage.has(TRIPS_STORAGE_KEY), false);
  assert.equal(memoryStorage.has(TRIP_SYNC_STORAGE_KEY), false);
  assert.equal(memoryStorage.has(FAVORITE_PLACES_STORAGE_KEY), false);
  assert.equal(memoryStorage.has(FAVORITE_PLACE_SYNC_STORAGE_KEY), false);
  assert.equal(memoryStorage.has(TRIP_ROUTE_PREFERENCE_STORAGE_KEY), false);
  assert.equal(memoryStorage.has(TRIP_EXPENSE_PREFERENCE_STORAGE_KEY), false);
  assert.equal(memoryStorage.has(AGENT_APPLIED_PROPOSALS_STORAGE_KEY), false);
  assert.equal(memoryStorage.has(AGENT_CONVERSATION_INDEX_STORAGE_KEY), false);
  assert.equal(
    memoryStorage.has(
      `${AGENT_CONVERSATION_STORAGE_KEY_PREFIX}agent-conversation-1`,
    ),
    false,
  );
  assert.equal(
    memoryStorage.has(
      `${AGENT_CONVERSATION_STORAGE_KEY_PREFIX}orphan-agent-conversation`,
    ),
    false,
  );
  assert.equal(
    agentLocalStorage.has(AGENT_APPLIED_PROPOSALS_STORAGE_KEY),
    false,
  );
  assert.equal(
    agentLocalStorage.has(AGENT_TRIP_CREATE_RECEIPT_STORAGE_KEY),
    false,
  );
  assert.equal(
    agentLocalStorage.has(AGENT_TRIP_CREATE_PENDING_STORAGE_KEY),
    false,
  );
  assert.equal(
    agentLocalStorage.has(AGENT_CONVERSATION_INDEX_STORAGE_KEY),
    false,
  );
  assert.equal(
    agentLocalStorage.has(
      `${AGENT_CONVERSATION_STORAGE_KEY_PREFIX}sqlite-agent-conversation-1`,
    ),
    false,
  );
  assert.equal(
    agentLocalStorage.has(ACCOUNT_AGENT_CONVERSATION_INDEX_STORAGE_KEY),
    true,
  );
});

test("signOut preserves guest local data but clears sync metadata", async () => {
  resetAuthTestState();

  memoryStorage.set(TRIPS_STORAGE_KEY, JSON.stringify([{ id: "trip-guest" }]));
  memoryStorage.set(
    TRIP_SYNC_STORAGE_KEY,
    JSON.stringify({ entities: { "trip-guest": { dirty: true } } }),
  );
  memoryStorage.set(
    FAVORITE_PLACES_STORAGE_KEY,
    JSON.stringify([{ id: "place-guest" }]),
  );
  memoryStorage.set(
    FAVORITE_PLACE_SYNC_STORAGE_KEY,
    JSON.stringify({ entities: { "place-guest": { dirty: true } } }),
  );
  memoryStorage.set(
    AGENT_APPLIED_PROPOSALS_STORAGE_KEY,
    JSON.stringify([{ proposalId: "guest-proposal" }]),
  );
  memoryStorage.set(
    AGENT_CONVERSATION_INDEX_STORAGE_KEY,
    JSON.stringify({
      currentConversationId: "guest-agent-conversation",
      summaries: [
        {
          id: "guest-agent-conversation",
          title: "Guest Agent",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
          messageCount: 1,
        },
      ],
      version: 1,
    }),
  );
  memoryStorage.set(
    `${AGENT_CONVERSATION_STORAGE_KEY_PREFIX}guest-agent-conversation`,
    JSON.stringify({
      conversation: { id: "guest-agent-conversation" },
      version: 1,
    }),
  );
  memoryStorage.set(
    TRIP_ROUTE_PREFERENCE_STORAGE_KEY,
    JSON.stringify({
      preference: { allowEstimatedRoutes: false, preferredMode: "walking" },
      updatedAt: "2026-06-03T10:00:00.000Z",
      version: 1,
    }),
  );
  memoryStorage.set(
    TRIP_EXPENSE_PREFERENCE_STORAGE_KEY,
    JSON.stringify({
      preference: {
        budgetWarningRatio: 0.7,
        defaultCurrency: "JPY",
        pinnedCategories: ["门票", "购物"],
      },
      updatedAt: "2026-06-03T10:00:00.000Z",
      version: 1,
    }),
  );

  await signInAsGuest();
  await signOut();

  assert.equal(await hasGuestIdentityRecord(), true);
  assert.equal(memoryStorage.has(TRIPS_STORAGE_KEY), true);
  assert.equal(memoryStorage.has(TRIP_SYNC_STORAGE_KEY), false);
  assert.equal(memoryStorage.has(FAVORITE_PLACES_STORAGE_KEY), true);
  assert.equal(memoryStorage.has(FAVORITE_PLACE_SYNC_STORAGE_KEY), false);
  assert.equal(memoryStorage.has(TRIP_ROUTE_PREFERENCE_STORAGE_KEY), true);
  assert.equal(memoryStorage.has(TRIP_EXPENSE_PREFERENCE_STORAGE_KEY), true);
  assert.equal(memoryStorage.has(AGENT_APPLIED_PROPOSALS_STORAGE_KEY), true);
  assert.equal(memoryStorage.has(AGENT_CONVERSATION_INDEX_STORAGE_KEY), true);
  assert.equal(
    memoryStorage.has(
      `${AGENT_CONVERSATION_STORAGE_KEY_PREFIX}guest-agent-conversation`,
    ),
    true,
  );
});

test("updateCurrentUserProfile syncs profile changes to Supabase when signed in with an access token", async () => {
  resetAuthTestState();
  configureSupabase();
  const requests: {
    body: string;
    headers: Record<string, string>;
    method: string;
    url: string;
  }[] = [];

  globalThis.fetch = (async (url, init) => {
    requests.push({
      body: String(init?.body),
      headers: init?.headers as Record<string, string>,
      method: init?.method ?? "GET",
      url: String(url),
    });

    if (String(url).endsWith("/functions/v1/phone-login")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          token_hash: "phone-token-hash",
          type: "magiclink",
          user_hint: {
            id: "supabase-user-1",
            phone: "+8613800138000",
          },
        }),
      } as Response;
    }

    if (String(url).endsWith("/auth/v1/verify")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "access-token-1",
          refresh_token: "refresh-token-1",
          user: {
            id: "supabase-user-1",
            phone: "+8613800138000",
          },
        }),
      } as Response;
    }

    if (String(url) === createProfileSelectUrl("supabase-user-1")) {
      return {
        ok: true,
        status: 200,
        json: async () => [],
      } as Response;
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response;
  }) as typeof fetch;

  await signInWithPhoneCode("13800138000", "246810");
  await updateCurrentUserProfile({
    avatarOffsetX: -8,
    avatarOffsetY: 12,
    avatarScale: 1.4,
    avatarUrl: "file:///tmp/avatar.jpg",
    bio: "喜欢城市漫步",
    displayName: "阿旅",
    homeCity: "上海",
  });

  const profileRequest = requests.find((request) =>
    request.url.endsWith("/rest/v1/profiles?on_conflict=id"),
  );

  assert.equal(profileRequest?.method, "POST");
  assert.equal(profileRequest?.headers.Authorization, "Bearer access-token-1");
  assert.equal(
    profileRequest?.headers.Prefer,
    "resolution=merge-duplicates,return=minimal",
  );
  assert.deepEqual(JSON.parse(profileRequest?.body ?? "{}"), {
    id: "supabase-user-1",
    avatar_offset_x: -8,
    avatar_offset_y: 12,
    avatar_scale: 1.4,
    avatar_url: "file:///tmp/avatar.jpg",
    bio: "喜欢城市漫步",
    display_name: "阿旅",
    home_city: "上海",
  });
});

test("updateCurrentUserProfile refreshes an expired Supabase JWT before retrying profile sync", async () => {
  resetAuthTestState();
  configureSupabase();
  const requests: {
    body: string;
    headers: Record<string, string>;
    method: string;
    url: string;
  }[] = [];

  globalThis.fetch = (async (url, init) => {
    const urlText = String(url);

    requests.push({
      body: String(init?.body),
      headers: init?.headers as Record<string, string>,
      method: init?.method ?? "GET",
      url: urlText,
    });

    if (urlText.endsWith("/functions/v1/phone-login")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          token_hash: "phone-token-hash",
          type: "magiclink",
          user_hint: {
            id: "supabase-user-1",
            phone: "+8613800138000",
          },
        }),
      } as Response;
    }

    if (urlText.endsWith("/auth/v1/verify")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "expired-access-token",
          refresh_token: "refresh-token-1",
          user: {
            id: "supabase-user-1",
            phone: "+8613800138000",
          },
        }),
      } as Response;
    }

    if (urlText === createProfileSelectUrl("supabase-user-1")) {
      return {
        ok: true,
        status: 200,
        json: async () => [],
      } as Response;
    }

    if (urlText.endsWith("/rest/v1/profiles?on_conflict=id")) {
      const authHeader = (init?.headers as Record<string, string>)
        .Authorization;

      if (authHeader === "Bearer expired-access-token") {
        return {
          ok: false,
          status: 401,
          json: async () => ({
            message: "JWT expired",
          }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    }

    if (urlText.endsWith("/auth/v1/token?grant_type=refresh_token")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "fresh-access-token",
          refresh_token: "refresh-token-2",
          user: {
            id: "supabase-user-1",
          },
        }),
      } as Response;
    }

    throw new Error(`Unexpected request ${urlText}`);
  }) as typeof fetch;

  await signInWithPhoneCode("13800138000", "246810");
  const authUser = await updateCurrentUserProfile({
    displayName: "新名字",
  });

  const profileRequests = requests.filter((request) =>
    request.url.endsWith("/rest/v1/profiles?on_conflict=id"),
  );
  const refreshRequest = requests.find((request) =>
    request.url.endsWith("/auth/v1/token?grant_type=refresh_token"),
  );

  assert.equal(profileRequests.length, 2);
  assert.equal(
    profileRequests[0]?.headers.Authorization,
    "Bearer expired-access-token",
  );
  assert.equal(
    profileRequests[1]?.headers.Authorization,
    "Bearer fresh-access-token",
  );
  assert.deepEqual(JSON.parse(refreshRequest?.body ?? "{}"), {
    refresh_token: "refresh-token-1",
  });
  assert.equal(authUser.session.accessToken, "fresh-access-token");
  assert.equal(authUser.session.refreshToken, "refresh-token-2");
  assert.equal(
    (await getCurrentAuthUser())?.session.accessToken,
    "fresh-access-token",
  );
});

test("updateCurrentUserProfile refreshes expired Supabase JWT sessions before profile sync", async () => {
  resetAuthTestState();
  configureSupabase();
  const expiredJwt = "eyJhbGciOiJub25lIn0.eyJleHAiOjB9.sig";
  const requests: {
    body: string;
    headers: Record<string, string>;
    method: string;
    url: string;
  }[] = [];

  memoryStorage.set(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      identities: [],
      session: {
        accessToken: expiredJwt,
        createdAt: "2026-05-30T00:00:00.000Z",
        lastActiveAt: "2026-05-30T00:00:00.000Z",
        refreshToken: "refresh-token-1",
        userId: "supabase-user-1",
      },
      users: [
        {
          createdAt: "2026-05-30T00:00:00.000Z",
          displayName: "旧名字",
          id: "supabase-user-1",
          updatedAt: "2026-05-30T00:00:00.000Z",
        },
      ],
    }),
  );

  globalThis.fetch = (async (url, init) => {
    const urlText = String(url);

    requests.push({
      body: String(init?.body),
      headers: init?.headers as Record<string, string>,
      method: init?.method ?? "GET",
      url: urlText,
    });

    if (urlText.endsWith("/auth/v1/token?grant_type=refresh_token")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "fresh-access-token",
          refresh_token: "refresh-token-2",
          user: {
            id: "supabase-user-1",
          },
        }),
      } as Response;
    }

    if (urlText.endsWith("/rest/v1/profiles?on_conflict=id")) {
      const authHeader = (init?.headers as Record<string, string>)
        .Authorization;

      assert.equal(authHeader !== `Bearer ${expiredJwt}`, true);

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    }

    throw new Error(`Unexpected request ${urlText}`);
  }) as typeof fetch;

  const authUser = await updateCurrentUserProfile({
    displayName: "新名字",
  });

  assert.equal(
    requests[0]?.url,
    "https://travel-test.supabase.co/auth/v1/token?grant_type=refresh_token",
  );
  assert.equal(
    requests[1]?.url,
    "https://travel-test.supabase.co/rest/v1/profiles?on_conflict=id",
  );
  assert.equal(requests[1]?.headers.Authorization, "Bearer fresh-access-token");
  assert.equal(authUser.session.accessToken, "fresh-access-token");
  assert.equal(authUser.session.refreshToken, "refresh-token-2");
});

test("signInWithWechat exchanges a native code through the Supabase Edge Function", async () => {
  resetAuthTestState();
  configureSupabase();
  const requests: {
    body: string;
    headers: Record<string, string>;
    url: string;
  }[] = [];

  globalThis.fetch = (async (url, init) => {
    const urlText = String(url);

    requests.push({
      body: String(init?.body),
      headers: init?.headers as Record<string, string>,
      url: urlText,
    });

    if (urlText.endsWith("/functions/v1/wechat-login")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          isNewUser: false,
          success: true,
          openid: "openid-1",
          unionid: "unionid-1",
          nickname: "微信旅行者",
          userId: "wechat-user-1",
          token_hash: "wechat-token-hash",
        }),
      } as Response;
    }

    if (urlText.endsWith("/auth/v1/verify")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "wechat-access-token",
          refresh_token: "wechat-refresh-token",
          user: {
            id: "wechat-user-1",
            phone: null,
            user_metadata: {
              display_name: "微信旅行者",
              wechat_unionid: "unionid-1",
            },
          },
        }),
      } as Response;
    }

    if (urlText === createProfileSelectUrl("wechat-user-1")) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            display_name: "Cloud WeChat",
          },
        ],
      } as Response;
    }

    throw new Error(`Unexpected request ${urlText}`);
  }) as typeof fetch;

  const authUser = await signInWithWechat("native-code-1");

  assert.equal(
    requests[0]?.url,
    "https://travel-test.supabase.co/functions/v1/wechat-login",
  );
  assert.equal(requests[0]?.headers.Authorization, "Bearer test-anon-key");
  assert.deepEqual(JSON.parse(requests[0]?.body ?? "{}"), {
    code: "native-code-1",
  });
  assert.equal(
    requests[1]?.url,
    "https://travel-test.supabase.co/auth/v1/verify",
  );
  assert.deepEqual(JSON.parse(requests[1]?.body ?? "{}"), {
    token_hash: "wechat-token-hash",
    type: "magiclink",
  });
  assert.equal(requests[2]?.url, createProfileSelectUrl("wechat-user-1"));
  assert.equal(authUser.user.id, "wechat-user-1");
  assert.equal(authUser.user.displayName, "Cloud WeChat");
  assert.equal(authUser.identities[0]?.provider, "wechat");
  assert.equal(authUser.identities[0]?.providerUid, "unionid-1");
  assert.equal(authUser.session.accessToken, "wechat-access-token");
});

test("signInWithWechat reports missing native code clearly", async () => {
  resetAuthTestState();

  await assert.rejects(() => signInWithWechat(), /微信开放平台移动应用/);
});

export const __authTestStorage = {
  getAllKeys: async () => [...memoryStorage.keys()],
  getItem: async (key: string) => memoryStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    memoryStorage.set(key, value);
  },
  removeItem: async (key: string) => {
    memoryStorage.delete(key);
  },
  clearAuth: async () => {
    memoryStorage.delete(AUTH_STORAGE_KEY);
  },
};

function createMapStorageAdapter(storage: Map<string, string>) {
  return {
    getAllKeys: async () => [...storage.keys()],
    getItem: async (key: string) => storage.get(key) ?? null,
    removeItem: async (key: string) => {
      storage.delete(key);
    },
    setItem: async (key: string, value: string) => {
      storage.set(key, value);
    },
  };
}

function createAuthFakeLocalDb(): LocalDb {
  const executor: LocalDbExecutor = {
    exec: async () => {},
    getAll: async () => [],
    getFirst: async () => null,
    run: async (): Promise<LocalDbRunResult> => ({
      changes: 0,
      lastInsertRowId: 0,
    }),
  };

  return {
    ...executor,
    transaction: async (work) => work(executor),
  };
}
