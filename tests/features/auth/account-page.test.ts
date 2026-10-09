import assert from "node:assert/strict";
import test from "node:test";

import {
  getPasswordManagementState,
  type AuthIdentity,
} from "../../../features/auth";

const now = "2026-07-10T00:00:00.000Z";

function createIdentity(
  provider: AuthIdentity["provider"],
  options: Partial<AuthIdentity> = {},
): AuthIdentity {
  return {
    createdAt: now,
    id: `${provider}-identity`,
    label: provider,
    lastLoginAt: now,
    provider,
    providerUid: provider,
    userId: "user-1",
    ...options,
  };
}

test("password management allows a bound phone identity to set a login password", () => {
  const phoneOnlyState = getPasswordManagementState([
    createIdentity("phone", {
      label: "138****8000",
      providerUid: "+8613800138000",
    }),
  ]);

  assert.equal(phoneOnlyState.canSetPassword, true);
  assert.equal(phoneOnlyState.actionLabel, "设置密码");
  assert.equal(
    phoneOnlyState.description,
    "设置后可以使用邮箱/手机号和密码登录",
  );

  const emailState = getPasswordManagementState([
    createIdentity("email", {
      label: "u***@example.com",
      providerUid: "user@example.com",
    }),
  ]);

  assert.equal(emailState.canSetPassword, true);
  assert.equal(emailState.actionLabel, "设置密码");
  assert.equal(emailState.description, "设置后可以使用邮箱/手机号和密码登录");
});
