import assert from "node:assert/strict";
import test from "node:test";

import {
  AGENT_CONVERSATION_INDEX_STORAGE_KEY,
  type AgentConversationStorage,
  type TripEditProposal,
  appendAgentConversationMessage,
  beginAgentRuntimeAttempt,
  createAgentFailure,
  createAgentConversationTraceEventKey,
  getAgentConversation,
  getAgentConversationIndex,
  getAgentConversationStorageKey,
  getCurrentAgentConversation,
  listAgentConversationSummaries,
  recordAgentConversationTurn,
  recoverInterruptedAgentConversationTurns,
  removeAgentConversation,
  renameAgentConversation,
  setAgentLocalStorageAdapterForTests,
  setLegacyAgentLocalStorageAdapterForTests,
  startNewAgentConversation,
} from "../../../features/agent";
import {
  createLocalDbKeyValueStorageAdapter,
  setLocalDbForTests,
  type LocalDb,
  type LocalDbExecutor,
  type LocalDbParams,
  type LocalDbRunResult,
} from "../../../features/local-db";

function makeStorage(
  initialValues: Record<string, string> = {},
): AgentConversationStorage & { values: Map<string, string> } {
  const values = new Map<string, string>(Object.entries(initialValues));

  return {
    values,
    async getAllKeys() {
      return [...values.keys()];
    },
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async removeItem(key) {
      values.delete(key);
    },
    async setItem(key, value) {
      values.set(key, value);
    },
  };
}

type FakeKeyValueRow = {
  updatedAt: string;
  value: string;
};

test("trace event keys remain unique when labels repeat", () => {
  const event = {
    detail: "执行规划步骤",
    kind: "planner" as const,
    label: "规划步骤",
    status: "completed" as const,
  };

  assert.equal(
    createAgentConversationTraceEventKey(event, 0) ===
      createAgentConversationTraceEventKey(event, 1),
    false,
  );
});

function getParam(params: LocalDbParams | undefined, index: number): unknown {
  return Array.isArray(params) ? params[index] : undefined;
}

function createFakeLocalDb(): LocalDb & {
  keyValueRows: Map<string, FakeKeyValueRow>;
} {
  const keyValueRows = new Map<string, FakeKeyValueRow>();

  const executor: LocalDbExecutor = {
    exec: async () => {},
    getAll: async <TRow>(sql: string, params?: LocalDbParams) => {
      if (sql.includes("FROM local_key_value_entries")) {
        const namespace = String(getParam(params, 0) ?? "");

        return [...keyValueRows.entries()]
          .filter(([key]) => key.startsWith(`${namespace}:`))
          .map(([key]) => ({
            key: key.slice(namespace.length + 1),
          })) as TRow[];
      }

      return [];
    },
    getFirst: async <TRow>(sql: string, params?: LocalDbParams) => {
      if (sql.includes("FROM local_key_value_entries")) {
        const namespace = String(getParam(params, 0) ?? "");
        const key = String(getParam(params, 1) ?? "");
        const row = keyValueRows.get(`${namespace}:${key}`);
        return (row ? { value: row.value } : null) as TRow | null;
      }

      return null;
    },
    run: async (
      sql: string,
      params?: LocalDbParams,
    ): Promise<LocalDbRunResult> => {
      if (sql.includes("INSERT OR REPLACE INTO local_key_value_entries")) {
        const namespace = String(getParam(params, 0) ?? "");
        const key = String(getParam(params, 1) ?? "");
        const value = String(getParam(params, 2) ?? "");
        const updatedAt = String(getParam(params, 3) ?? "");
        keyValueRows.set(`${namespace}:${key}`, { updatedAt, value });
      }

      if (sql.includes("DELETE FROM local_key_value_entries")) {
        const namespace = String(getParam(params, 0) ?? "");
        const key = String(getParam(params, 1) ?? "");
        keyValueRows.delete(`${namespace}:${key}`);
      }

      return { changes: 1, lastInsertRowId: 1 };
    },
  };

  return {
    ...executor,
    keyValueRows,
    transaction: async (work) => work(executor),
  };
}

function makeClock(values: string[]) {
  let index = 0;

  return () =>
    values[Math.min(index++, values.length - 1)] ?? "2026-06-01T00:00:00.000Z";
}

function makeProposal(): TripEditProposal {
  return {
    expectedUpdatedAt: "2026-06-01T00:00:00.000Z",
    operations: [
      {
        type: "add_place_to_day",
        dayId: "day-1",
        operationId: "op-add-place",
        place: {
          name: "云南大学",
        },
        tripId: "trip-1",
      },
    ],
    proposalId: "proposal-1",
    summary: "添加云南大学",
    tripId: "trip-1",
  };
}

test("startNewAgentConversation creates index and detail records", async () => {
  const storage = makeStorage();
  const conversation = await startNewAgentConversation({
    clock: () => "2026-06-01T00:00:00.000Z",
    ids: { conversation: () => "conversation-1" },
    storage,
  });
  const index = await getAgentConversationIndex({ storage });

  assert.equal(conversation.id, "conversation-1");
  assert.equal(index.currentConversationId, "conversation-1");
  assert.equal(index.summaries.length, 1);
  assert.equal(
    storage.values.has(getAgentConversationStorageKey("conversation-1")),
    true,
  );
});

test("conversation records are isolated by authenticated account", async () => {
  const storage = makeStorage();
  const accountA = await startNewAgentConversation({
    accountId: "account-a",
    ids: { conversation: () => "shared-conversation-id" },
    storage,
  });

  await appendAgentConversationMessage(
    {
      conversationId: accountA.id,
      role: "user",
      text: "账号 A 的私密旅行问题",
    },
    {
      accountId: "account-a",
      ids: { message: () => "message-a" },
      storage,
    },
  );

  assert.equal(
    await getAgentConversation("shared-conversation-id", {
      accountId: "account-b",
      storage,
    }),
    undefined,
  );
  assert.deepEqual(
    await listAgentConversationSummaries(
      {},
      { accountId: "account-b", storage },
    ),
    [],
  );
  assert.equal(
    (
      await getAgentConversation("shared-conversation-id", {
        accountId: "account-a",
        storage,
      })
    )?.messages[0]?.text,
    "账号 A 的私密旅行问题",
  );
});

test("conversation rejects a record copied into another account partition", async () => {
  const storage = makeStorage();
  await startNewAgentConversation({
    accountId: "account-a",
    ids: { conversation: () => "conversation-copied" },
    storage,
  });
  const accountAKey = getAgentConversationStorageKey(
    "conversation-copied",
    "account-a",
  );
  const accountBKey = getAgentConversationStorageKey(
    "conversation-copied",
    "account-b",
  );
  const copied = storage.values.get(accountAKey);
  if (!copied) throw new Error("account A conversation was not persisted");
  storage.values.set(accountBKey, copied);

  assert.equal(
    await getAgentConversation("conversation-copied", {
      accountId: "account-b",
      storage,
    }),
    undefined,
  );
});

test("scoped conversations keep global and trip current records separately", async () => {
  const storage = makeStorage();
  const globalConversation = await startNewAgentConversation({
    clock: () => "2026-06-01T00:00:00.000Z",
    ids: { conversation: () => "global-conversation" },
    scope: { type: "global" },
    storage,
  });
  await appendAgentConversationMessage(
    {
      conversationId: globalConversation.id,
      role: "user",
      text: "帮我规划一次旅行",
    },
    {
      clock: () => "2026-06-01T00:00:00.500Z",
      ids: { message: () => "global-message" },
      storage,
    },
  );
  const tripConversation = await startNewAgentConversation({
    clock: () => "2026-06-01T00:00:01.000Z",
    ids: { conversation: () => "trip-conversation" },
    scope: { tripId: "trip-1", tripTitle: "云南三日", type: "trip" },
    storage,
  });
  const index = await getAgentConversationIndex({ storage });

  assert.equal(index.currentConversationId, "trip-conversation");
  assert.equal(index.currentGlobalConversationId, "global-conversation");
  assert.equal(
    index.currentTripConversationIds?.["trip-1"],
    "trip-conversation",
  );
  assert.equal(
    (await getCurrentAgentConversation({ scope: { type: "global" }, storage }))
      ?.id,
    globalConversation.id,
  );
  assert.equal(
    (
      await getCurrentAgentConversation({
        scope: { tripId: "trip-1", type: "trip" },
        storage,
      })
    )?.id,
    tripConversation.id,
  );
});

test("listAgentConversationSummaries filters by conversation scope", async () => {
  const storage = makeStorage();
  const globalConversation = await startNewAgentConversation({
    clock: () => "2026-06-01T00:00:00.000Z",
    ids: { conversation: () => "global-conversation" },
    scope: { type: "global" },
    storage,
  });
  await appendAgentConversationMessage(
    {
      conversationId: globalConversation.id,
      role: "user",
      text: "帮我规划一次旅行",
    },
    {
      clock: () => "2026-06-01T00:00:00.500Z",
      ids: { message: () => "global-message" },
      storage,
    },
  );
  const tripOneConversation = await startNewAgentConversation({
    clock: () => "2026-06-01T00:00:01.000Z",
    ids: { conversation: () => "trip-1-conversation" },
    scope: { tripId: "trip-1", type: "trip" },
    storage,
  });
  await appendAgentConversationMessage(
    {
      conversationId: tripOneConversation.id,
      role: "user",
      text: "把云南大学加入第一天",
    },
    {
      clock: () => "2026-06-01T00:00:01.500Z",
      ids: { message: () => "trip-1-message" },
      storage,
    },
  );
  const tripTwoConversation = await startNewAgentConversation({
    clock: () => "2026-06-01T00:00:02.000Z",
    ids: { conversation: () => "trip-2-conversation" },
    scope: { tripId: "trip-2", type: "trip" },
    storage,
  });
  await appendAgentConversationMessage(
    {
      conversationId: tripTwoConversation.id,
      role: "user",
      text: "调整第二天行程",
    },
    {
      clock: () => "2026-06-01T00:00:02.500Z",
      ids: { message: () => "trip-2-message" },
      storage,
    },
  );

  const globalSummaries = await listAgentConversationSummaries(
    { scope: { type: "global" } },
    { storage },
  );
  const tripOneSummaries = await listAgentConversationSummaries(
    { scope: { tripId: "trip-1", type: "trip" } },
    { storage },
  );
  const allSummaries = await listAgentConversationSummaries({}, { storage });

  assert.deepEqual(
    globalSummaries.map((summary) => summary.id),
    ["global-conversation"],
  );
  assert.deepEqual(
    tripOneSummaries.map((summary) => summary.id),
    ["trip-1-conversation"],
  );
  assert.deepEqual(
    allSummaries.map((summary) => summary.id),
    ["trip-2-conversation", "trip-1-conversation", "global-conversation"],
  );
});

test("appendAgentConversationMessage stores messages and updates summary title", async () => {
  const storage = makeStorage();
  const clock = makeClock([
    "2026-06-01T00:00:00.000Z",
    "2026-06-01T00:00:01.000Z",
    "2026-06-01T00:00:02.000Z",
  ]);

  const conversation = await startNewAgentConversation({
    clock,
    ids: { conversation: () => "conversation-1" },
    storage,
  });
  await appendAgentConversationMessage(
    {
      conversationId: conversation.id,
      role: "user",
      text: "把云南大学加入云南三日第四天",
    },
    {
      clock,
      ids: { message: () => "message-1" },
      storage,
    },
  );
  await appendAgentConversationMessage(
    {
      audit: {
        mode: "llm",
        model: "gpt-4.1-mini",
        provider: "openai",
        timing: {
          totalMs: 1500,
        },
        usage: {
          completionTokens: 34,
          promptTokens: 123,
          totalTokens: 157,
        },
      },
      conversationId: conversation.id,
      message: {
        audit: {
          mode: "llm",
          model: "gpt-4.1-mini",
          provider: "openai",
          timing: {
            totalMs: 1500,
          },
          usage: {
            completionTokens: 34,
            promptTokens: 123,
            totalTokens: 157,
          },
        },
        createdAt: "2026-06-01T00:00:02.000Z",
        debug: {
          operationIds: ["op-add-place"],
          proposalId: "proposal-1",
          resultType: "proposal",
          route: "itinerary_edit",
          timing: {
            llmMs: 1200,
            totalMs: 1500,
          },
          usage: {
            completionTokens: 34,
            promptTokens: 123,
            totalTokens: 157,
          },
        },
        id: "message-2",
        role: "agent",
        text: "我已生成提案，确认后写入。",
      },
      role: "agent",
      text: "我已生成提案，确认后写入。",
    },
    {
      clock,
      ids: { message: () => "message-2" },
      storage,
    },
  );

  const savedConversation = await getAgentConversation(conversation.id, {
    storage,
  });
  const index = await getAgentConversationIndex({ storage });

  assert.equal(savedConversation?.messages.length, 2);
  assert.equal(savedConversation?.messages[0]?.id, "message-1");
  assert.deepEqual(savedConversation?.messages[1]?.audit?.usage, {
    completionTokens: 34,
    promptTokens: 123,
    totalTokens: 157,
  });
  assert.deepEqual(savedConversation?.messages[1]?.audit?.timing, {
    totalMs: 1500,
  });
  assert.deepEqual(savedConversation?.messages[1]?.debug, {
    operationIds: ["op-add-place"],
    proposalId: "proposal-1",
    resultType: "proposal",
    route: "itinerary_edit",
    timing: {
      llmMs: 1200,
      totalMs: 1500,
    },
    usage: {
      completionTokens: 34,
      promptTokens: 123,
      totalTokens: 157,
    },
  });
  assert.equal(index.summaries[0]?.title, "把云南大学加入云南三日第四天");
  assert.equal(index.summaries[0]?.messageCount, 2);
  assert.equal(
    index.summaries[0]?.lastMessagePreview,
    "我已生成提案，确认后写入。",
  );
});

test("recordAgentConversationTurn persists minimal proposal audit data", async () => {
  const storage = makeStorage();
  const conversation = await startNewAgentConversation({
    clock: () => "2026-06-01T00:00:00.000Z",
    ids: { conversation: () => "conversation-1" },
    storage,
  });

  await recordAgentConversationTurn(
    {
      conversationId: conversation.id,
      proposal: makeProposal(),
      reply: "已生成提案",
      status: "previewed",
      tripTitle: "云南三日",
      userMessage: "把云南大学加入云南三日第四天",
    },
    {
      clock: () => "2026-06-01T00:00:03.000Z",
      ids: { turn: () => "turn-1" },
      storage,
    },
  );

  const savedConversation = await getAgentConversation(conversation.id, {
    storage,
  });
  const turn = savedConversation?.turns[0];

  assert.equal(turn?.id, "turn-1");
  assert.equal(turn?.status, "previewed");
  assert.equal(turn?.proposalId, "proposal-1");
  assert.deepEqual(turn?.operationIds, ["op-add-place"]);
  assert.equal(turn?.tripId, "trip-1");
  assert.equal(turn?.tripTitle, "云南三日");
});

test("recordAgentConversationTurn persists chat audit data", async () => {
  const storage = makeStorage();
  const conversation = await startNewAgentConversation({
    clock: () => "2026-06-01T00:00:00.000Z",
    ids: { conversation: () => "conversation-1" },
    storage,
  });

  await recordAgentConversationTurn(
    {
      conversationId: conversation.id,
      mode: "chat",
      model: "deepseek-v4-flash",
      provider: "deepseek",
      reply: "你好，我是一路记旅行助手。",
      status: "chat",
      usage: {
        completionTokens: 12,
        promptTokens: 30,
        totalTokens: 42,
      },
      userMessage: "你好",
    },
    {
      clock: () => "2026-06-01T00:00:03.000Z",
      ids: { turn: () => "turn-chat" },
      storage,
    },
  );

  const savedConversation = await getAgentConversation(conversation.id, {
    storage,
  });
  const turn = savedConversation?.turns[0];

  assert.equal(turn?.id, "turn-chat");
  assert.equal(turn?.status, "chat");
  assert.equal(turn?.proposalId, undefined);
  assert.equal(turn?.model, "deepseek-v4-flash");
  assert.deepEqual(turn?.usage, {
    completionTokens: 12,
    promptTokens: 30,
    totalTokens: 42,
  });
});

test("conversation upserts duplicate turn events and links retry attempts", async () => {
  const storage = makeStorage();
  const conversation = await startNewAgentConversation({
    accountId: "account-a",
    ids: { conversation: () => "conversation-retry" },
    storage,
  });
  const deps = { accountId: "account-a", storage };

  await appendAgentConversationMessage(
    {
      conversationId: conversation.id,
      dedupeKey: "turn-retry:user",
      role: "user",
      text: "规划云南三日游",
      turnId: "turn-retry",
    },
    deps,
  );
  await appendAgentConversationMessage(
    {
      conversationId: conversation.id,
      dedupeKey: "turn-retry:user",
      role: "user",
      text: "规划云南三日游",
      turnId: "turn-retry",
    },
    deps,
  );
  await recordAgentConversationTurn(
    {
      attemptId: "attempt-1",
      conversationId: conversation.id,
      failure: createAgentFailure("network"),
      status: "failed",
      turnId: "turn-retry",
      userMessage: "规划云南三日游",
    },
    deps,
  );
  await recordAgentConversationTurn(
    {
      attemptId: "attempt-2",
      conversationId: conversation.id,
      reply: "已生成草案",
      status: "previewed",
      turnId: "turn-retry",
      userMessage: "规划云南三日游",
    },
    deps,
  );

  const saved = await getAgentConversation(conversation.id, deps);
  assert.equal(saved?.messages.length, 1);
  assert.equal(saved?.turns.length, 1);
  assert.equal(saved?.turns[0]?.attemptId, "attempt-2");
  assert.deepEqual(
    saved?.turns[0]?.attempts?.map((attempt) => [
      attempt.id,
      attempt.status,
      attempt.failure?.kind,
    ]),
    [
      ["attempt-1", "failed", "network"],
      ["attempt-2", "previewed", undefined],
    ],
  );
});

test("login recovery marks persisted running attempts as interrupted", async () => {
  const storage = makeStorage();
  const conversation = await startNewAgentConversation({
    accountId: "account-a",
    ids: { conversation: () => "conversation-interrupted" },
    storage,
  });
  await recordAgentConversationTurn(
    {
      attemptId: "attempt-running",
      conversationId: conversation.id,
      status: "running",
      turnId: "turn-running",
      userMessage: "规划北京周末游",
    },
    { accountId: "account-a", storage },
  );

  const recovered = await recoverInterruptedAgentConversationTurns({
    accountId: "account-a",
    storage,
  });

  assert.equal(recovered, 1);
  assert.equal(
    (
      await getAgentConversation(conversation.id, {
        accountId: "account-a",
        storage,
      })
    )?.turns[0]?.status,
    "interrupted",
  );
  assert.equal(
    await recoverInterruptedAgentConversationTurns({
      accountId: "account-b",
      storage,
    }),
    0,
  );
});

test("login recovery preserves the matching in-memory active attempt", async () => {
  const storage = makeStorage();
  const conversation = await startNewAgentConversation({
    accountId: "account-active",
    ids: { conversation: () => "conversation-active" },
    storage,
  });
  await recordAgentConversationTurn(
    {
      attemptId: "attempt-active",
      conversationId: conversation.id,
      status: "running",
      turnId: "turn-active",
      userMessage: "规划仍在执行中的行程",
    },
    { accountId: "account-active", storage },
  );
  const detailKey = getAgentConversationStorageKey(
    conversation.id,
    "account-active",
  );
  const readItem = storage.getItem.bind(storage);
  let releaseDetailRead!: () => void;
  let markDetailReadStarted!: () => void;
  const detailReadReleased = new Promise<void>((resolve) => {
    releaseDetailRead = resolve;
  });
  const detailReadStarted = new Promise<void>((resolve) => {
    markDetailReadStarted = resolve;
  });
  storage.getItem = async (key) => {
    if (key === detailKey) {
      markDetailReadStarted();
      await detailReadReleased;
    }
    return readItem(key);
  };

  const recovery = recoverInterruptedAgentConversationTurns({
    accountId: "account-active",
    storage,
  });
  await detailReadStarted;
  const runtimeAttempt = beginAgentRuntimeAttempt({
    accountId: "account-active",
    attemptId: "attempt-active",
    conversationId: conversation.id,
    turnId: "turn-active",
  });
  releaseDetailRead();

  try {
    assert.equal(await recovery, 0);
    assert.equal(
      (
        await getAgentConversation(conversation.id, {
          accountId: "account-active",
          storage,
        })
      )?.turns[0]?.status,
      "running",
    );
  } finally {
    runtimeAttempt.complete();
  }
});

test("renameAgentConversation updates detail and summary titles", async () => {
  const storage = makeStorage();
  const conversation = await startNewAgentConversation({
    clock: () => "2026-06-01T00:00:00.000Z",
    ids: { conversation: () => "conversation-1" },
    storage,
  });

  const result = await renameAgentConversation(
    {
      conversationId: conversation.id,
      title: "云南 3 日复盘",
    },
    {
      clock: () => "2026-06-01T00:00:01.000Z",
      storage,
    },
  );

  const savedConversation = await getAgentConversation(conversation.id, {
    storage,
  });
  const index = await getAgentConversationIndex({ storage });

  assert.equal(result?.title, "云南 3 日复盘");
  assert.equal(savedConversation?.title, "云南 3 日复盘");
  assert.equal(savedConversation?.updatedAt, "2026-06-01T00:00:01.000Z");
  assert.equal(index.summaries[0]?.title, "云南 3 日复盘");
});

test("removeAgentConversation deletes detail and moves current pointer to next summary", async () => {
  const storage = makeStorage();
  const firstConversation = await startNewAgentConversation({
    clock: () => "2026-06-01T00:00:00.000Z",
    ids: { conversation: () => "conversation-1" },
    storage,
  });
  await appendAgentConversationMessage(
    {
      conversationId: firstConversation.id,
      role: "user",
      text: "规划云南 3 日",
    },
    {
      clock: () => "2026-06-01T00:00:01.000Z",
      ids: { message: () => "message-1" },
      storage,
    },
  );
  const secondConversation = await startNewAgentConversation({
    clock: () => "2026-06-01T00:00:02.000Z",
    ids: { conversation: () => "conversation-2" },
    storage,
  });
  await appendAgentConversationMessage(
    {
      conversationId: secondConversation.id,
      role: "user",
      text: "调整第一天标题",
    },
    {
      clock: () => "2026-06-01T00:00:03.000Z",
      ids: { message: () => "message-2" },
      storage,
    },
  );

  const removedConversation = await removeAgentConversation(
    secondConversation.id,
    { storage },
  );

  const index = await getAgentConversationIndex({ storage });
  const summaries = await listAgentConversationSummaries({}, { storage });

  assert.equal(removedConversation?.id, secondConversation.id);
  assert.equal(
    storage.values.has(getAgentConversationStorageKey(secondConversation.id)),
    false,
  );
  assert.equal(
    await getAgentConversation(secondConversation.id, { storage }),
    undefined,
  );
  assert.deepEqual(
    summaries.map((summary) => summary.id),
    [firstConversation.id],
  );
  assert.equal(index.currentConversationId, firstConversation.id);
  assert.equal(index.currentGlobalConversationId, firstConversation.id);
});

test("conversation writes keep messages and turns when appended concurrently", async () => {
  const storage = makeStorage();
  const conversation = await startNewAgentConversation({
    clock: () => "2026-06-01T00:00:00.000Z",
    ids: { conversation: () => "conversation-1" },
    storage,
  });

  await Promise.all([
    appendAgentConversationMessage(
      {
        conversationId: conversation.id,
        role: "user",
        text: "把云南大学加入云南三日第四天",
      },
      {
        clock: () => "2026-06-01T00:00:01.000Z",
        ids: { message: () => "message-1" },
        storage,
      },
    ),
    recordAgentConversationTurn(
      {
        conversationId: conversation.id,
        proposal: makeProposal(),
        status: "previewed",
        userMessage: "把云南大学加入云南三日第四天",
      },
      {
        clock: () => "2026-06-01T00:00:02.000Z",
        ids: { turn: () => "turn-1" },
        storage,
      },
    ),
  ]);

  const savedConversation = await getAgentConversation(conversation.id, {
    storage,
  });

  assert.equal(savedConversation?.messages.length, 1);
  assert.equal(savedConversation?.turns.length, 1);
  assert.equal(savedConversation?.messages[0]?.id, "message-1");
  assert.equal(savedConversation?.turns[0]?.id, "turn-1");
});

test("getCurrentAgentConversation tolerates malformed storage values", async () => {
  const storage = makeStorage({
    [AGENT_CONVERSATION_INDEX_STORAGE_KEY]: "{not-json",
  });

  assert.deepEqual(await getAgentConversationIndex({ storage }), {
    summaries: [],
    version: 1,
  });
  assert.equal(await getCurrentAgentConversation({ storage }), undefined);
});

test("default conversation storage lazily migrates legacy AsyncStorage data into SQLite", async () => {
  const db = createFakeLocalDb();
  const legacyConversationValue = JSON.stringify({
    conversation: {
      createdAt: "2026-06-01T00:00:00.000Z",
      id: "conversation-legacy",
      messages: [
        {
          createdAt: "2026-06-01T00:00:00.000Z",
          id: "message-legacy",
          role: "user",
          text: "旧对话",
        },
      ],
      scope: { type: "global" },
      title: "Legacy",
      turns: [],
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
    version: 1,
  });
  const legacyStorage = makeStorage({
    [AGENT_CONVERSATION_INDEX_STORAGE_KEY]: JSON.stringify({
      currentConversationId: "conversation-legacy",
      summaries: [
        {
          createdAt: "2026-06-01T00:00:00.000Z",
          id: "conversation-legacy",
          messageCount: 1,
          scope: { type: "global" },
          title: "Legacy",
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
      version: 1,
    }),
    [getAgentConversationStorageKey("conversation-legacy")]:
      legacyConversationValue,
  });

  setLocalDbForTests(db);
  setAgentLocalStorageAdapterForTests(null);
  setLegacyAgentLocalStorageAdapterForTests(legacyStorage);

  try {
    const conversation = await getAgentConversation("conversation-legacy");
    const sqliteStorage = createLocalDbKeyValueStorageAdapter("agent");

    assert.equal(conversation?.messages[0]?.text, "旧对话");
    assert.equal(
      await sqliteStorage.getItem(
        getAgentConversationStorageKey("conversation-legacy"),
      ),
      legacyConversationValue,
    );
    assert.equal(
      legacyStorage.values.has(
        getAgentConversationStorageKey("conversation-legacy"),
      ),
      false,
    );
  } finally {
    setLegacyAgentLocalStorageAdapterForTests(undefined);
    setAgentLocalStorageAdapterForTests(null);
    setLocalDbForTests(null);
  }
});
