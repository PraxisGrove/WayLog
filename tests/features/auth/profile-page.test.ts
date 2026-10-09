import assert from "node:assert/strict";
import test from "node:test";

import {
  type CurrentAuthUser,
  shouldPromptGuestDataMigration,
} from "../../../features/auth";

function createAuthUser(options: {
  accessToken?: string;
  provider: "email" | "guest" | "phone" | "wechat";
  userId: string;
}): CurrentAuthUser {
  return {
    identities: [
      {
        createdAt: "2026-06-03T10:00:00.000Z",
        id: `identity-${options.userId}-${options.provider}`,
        label: options.provider === "guest" ? "本机游客" : options.provider,
        lastLoginAt: "2026-06-03T10:00:00.000Z",
        provider: options.provider,
        providerUid: `${options.provider}-${options.userId}`,
        userId: options.userId,
      },
    ],
    session: {
      accessToken: options.accessToken,
      createdAt: "2026-06-03T10:00:00.000Z",
      lastActiveAt: "2026-06-03T10:00:00.000Z",
      userId: options.userId,
    },
    user: {
      createdAt: "2026-06-03T10:00:00.000Z",
      displayName: options.provider === "guest" ? "游客" : "云端用户",
      id: options.userId,
      updatedAt: "2026-06-03T10:00:00.000Z",
    },
  };
}

test("should prompt guest migration when switching from guest to cloud account", () => {
  const previousAuthUser = createAuthUser({
    provider: "guest",
    userId: "guest-user",
  });
  const nextAuthUser = createAuthUser({
    accessToken: "access-token-1",
    provider: "email",
    userId: "cloud-user",
  });

  assert.equal(
    shouldPromptGuestDataMigration(previousAuthUser, nextAuthUser),
    true,
  );
});

test("should not prompt guest migration for regular cloud login flows", () => {
  const cloudAuthUser = createAuthUser({
    accessToken: "access-token-1",
    provider: "email",
    userId: "cloud-user",
  });

  assert.equal(shouldPromptGuestDataMigration(null, cloudAuthUser), false);
  assert.equal(
    shouldPromptGuestDataMigration(cloudAuthUser, cloudAuthUser),
    false,
  );
  assert.equal(
    shouldPromptGuestDataMigration(
      createAuthUser({ provider: "guest", userId: "guest-user" }),
      null,
    ),
    false,
  );
});

test("should keep prompt logic focused on guest-to-cloud transitions only", () => {
  const previousGuestUser = createAuthUser({
    provider: "guest",
    userId: "guest-user",
  });
  const nextGuestUser = createAuthUser({
    provider: "guest",
    userId: "guest-user-2",
  });

  assert.equal(
    shouldPromptGuestDataMigration(previousGuestUser, nextGuestUser),
    false,
  );
});
