import assert from "node:assert/strict";
import test from "node:test";

import {
  AGENT_FAILURE_KINDS,
  type AgentConversationStorage,
  beginAgentRuntimeAttempt,
  cancelActiveAgentTurn,
  clearAgentRuntimeForAccount,
  createAgentFailure,
  getActiveAgentRuntimeAttempt,
} from "../../../features/agent";

test("AgentFailureKind exposes stable retry and public-copy policy", () => {
  assert.deepEqual(AGENT_FAILURE_KINDS, [
    "authentication",
    "quota",
    "network",
    "timeout",
    "cancelled",
    "protocol",
    "model",
    "tool",
    "schema",
    "skill_unavailable",
    "runtime_disabled",
    "internal",
  ]);
  assert.equal(createAgentFailure("network").retryable, true);
  assert.equal(
    createAgentFailure("quota", { retryable: true }).retryable,
    true,
  );
  assert.equal(createAgentFailure("cancelled").retryable, false);
  assert.match(createAgentFailure("authentication").message, /登录/);
});

test("runtime permits one active attempt across the app and cancellation targets it", () => {
  const first = beginAgentRuntimeAttempt({
    accountId: "account-a",
    attemptId: "attempt-1",
    conversationId: "conversation-1",
    turnId: "turn-1",
  });
  let aborted = false;
  first.registerAbort(() => {
    aborted = true;
  });

  assert.throws(
    () =>
      beginAgentRuntimeAttempt({
        accountId: "account-a",
        attemptId: "attempt-2",
        conversationId: "conversation-2",
        turnId: "turn-2",
      }),
    /已有回合正在运行/,
  );
  assert.equal(
    cancelActiveAgentTurn({ accountId: "account-b", turnId: "turn-1" }),
    false,
  );
  assert.equal(
    cancelActiveAgentTurn({ accountId: "account-a", turnId: "turn-1" }),
    true,
  );
  assert.equal(aborted, true);
  assert.throws(() => first.throwIfCancelled(), /已取消/);
  first.complete();
  assert.equal(getActiveAgentRuntimeAttempt(), undefined);
});

test("logout clears only matching in-memory runtime state and preserves storage", () => {
  const storage = new Map<string, string>([["conversation", "history"]]);
  const attempt = beginAgentRuntimeAttempt({
    accountId: "account-a",
    attemptId: "attempt-logout",
    conversationId: "conversation-logout",
    turnId: "turn-logout",
  });

  assert.equal(clearAgentRuntimeForAccount("account-b"), false);
  assert.equal(getActiveAgentRuntimeAttempt()?.accountId, "account-a");
  assert.equal(clearAgentRuntimeForAccount("account-a"), true);
  assert.equal(getActiveAgentRuntimeAttempt(), undefined);
  assert.equal(storage.get("conversation"), "history");
  attempt.complete();
});

export function createRuntimeMemoryStorage(): AgentConversationStorage & {
  values: Map<string, string>;
} {
  const values = new Map<string, string>();
  return {
    values,
    getAllKeys: async () => [...values.keys()],
    getItem: async (key) => values.get(key) ?? null,
    removeItem: async (key) => {
      values.delete(key);
    },
    setItem: async (key, value) => {
      values.set(key, value);
    },
  };
}
