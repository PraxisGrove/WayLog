import assert from "node:assert/strict";
import test from "node:test";

import {
  AGENT_APPLIED_PROPOSALS_STORAGE_KEY,
  type AgentAppliedProposalStorage,
  type AgentApplyLedgerStatus,
  type TripEditProposal,
  beginAgentProposalApply,
  clearAppliedAgentProposalLedger,
  getAppliedAgentOperationIds,
  getAppliedAgentProposalRecords,
  hasAppliedAgentProposal,
  recordAppliedAgentProposal,
  recordFailedAgentProposalApply,
  setAgentLocalStorageAdapterForTests,
  setLegacyAgentLocalStorageAdapterForTests,
} from "../../../features/agent";
import {
  createLocalDbKeyValueStorageAdapter,
  setLocalDbForTests,
  type LocalDb,
  type LocalDbExecutor,
  type LocalDbParams,
  type LocalDbRunResult,
} from "../../../features/local-db";
import type { Trip } from "../../../features/trips/types";

function makeStorage(
  initialValue?: string,
): AgentAppliedProposalStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();

  if (initialValue !== undefined) {
    values.set(AGENT_APPLIED_PROPOSALS_STORAGE_KEY, initialValue);
  }

  return {
    values,
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

type FakeApplyRecordRow = {
  conversation_id: string | null;
  error_code: string | null;
  error_message: string | null;
  failed_step: string | null;
  finished_at: string | null;
  proposal_id: string;
  started_at: string;
  status: AgentApplyLedgerStatus;
  trip_id: string;
  trip_updated_at_after_apply: string | null;
  trip_updated_at_before_apply: string | null;
  turn_id: string | null;
};

type FakeOperationRow = {
  finished_at: string | null;
  operation_id: string;
  operation_type: string;
  proposal_id: string;
  started_at: string;
  status: AgentApplyLedgerStatus;
  trip_id: string;
};

function getParam(params: LocalDbParams | undefined, index: number): unknown {
  return Array.isArray(params) ? params[index] : undefined;
}

function getStringParam(
  params: LocalDbParams | undefined,
  index: number,
): string {
  return String(getParam(params, index) ?? "");
}

function getNullableStringParam(
  params: LocalDbParams | undefined,
  index: number,
): string | null {
  const value = getParam(params, index);

  return typeof value === "string" ? value : null;
}

function createFakeLocalDb(
  options: { failSucceededRecordReads?: boolean } = {},
): LocalDb & {
  applyRecords: Map<string, FakeApplyRecordRow>;
  keyValueRows: Map<string, FakeKeyValueRow>;
  operationRows: Map<string, FakeOperationRow>;
} {
  const applyRecords = new Map<string, FakeApplyRecordRow>();
  const keyValueRows = new Map<string, FakeKeyValueRow>();
  const operationRows = new Map<string, FakeOperationRow>();

  const executor: LocalDbExecutor = {
    exec: async () => {},
    getAll: async <TRow>(sql: string, params?: LocalDbParams) => {
      if (
        sql.includes("FROM agent_apply_records") &&
        sql.includes("WHERE status = 'succeeded'")
      ) {
        if (options.failSucceededRecordReads) {
          throw new Error("post-commit read failed");
        }
        return [...applyRecords.values()]
          .filter((row) => row.status === "succeeded")
          .sort((left, right) =>
            (right.finished_at ?? right.started_at).localeCompare(
              left.finished_at ?? left.started_at,
            ),
          ) as TRow[];
      }

      if (
        sql.includes("FROM agent_apply_operation_ledger") &&
        sql.includes("WHERE proposal_id = ?")
      ) {
        const proposalId = getStringParam(params, 0);

        return [...operationRows.values()]
          .filter(
            (row) =>
              row.proposal_id === proposalId && row.status === "succeeded",
          )
          .sort((left, right) =>
            (left.finished_at ?? left.started_at).localeCompare(
              right.finished_at ?? right.started_at,
            ),
          )
          .map((row) => ({ operation_id: row.operation_id })) as TRow[];
      }

      if (
        sql.includes("FROM agent_apply_operation_ledger") &&
        sql.includes("operation_id IN")
      ) {
        const operationIds = new Set((params as readonly string[]) ?? []);

        return [...operationRows.values()]
          .filter(
            (row) =>
              row.status === "succeeded" && operationIds.has(row.operation_id),
          )
          .map((row) => ({ operation_id: row.operation_id })) as TRow[];
      }

      if (
        sql.includes("FROM agent_apply_operation_ledger") &&
        sql.includes("WHERE status = 'succeeded'")
      ) {
        return [...operationRows.values()]
          .filter((row) => row.status === "succeeded")
          .map((row) => ({ operation_id: row.operation_id })) as TRow[];
      }

      if (sql.includes("FROM local_key_value_entries")) {
        const namespace = getStringParam(params, 0);

        return [...keyValueRows.entries()]
          .filter(([key]) => key.startsWith(`${namespace}:`))
          .map(([key]) => ({
            key: key.slice(namespace.length + 1),
          })) as TRow[];
      }

      return [];
    },
    getFirst: async <TRow>(sql: string, params?: LocalDbParams) => {
      if (sql.includes("FROM agent_apply_records")) {
        const proposalId = getStringParam(params, 0);
        const row = applyRecords.get(proposalId);

        return (
          row && row.status === "succeeded"
            ? { proposal_id: row.proposal_id }
            : null
        ) as TRow | null;
      }

      if (sql.includes("FROM local_key_value_entries")) {
        const namespace = getStringParam(params, 0);
        const key = getStringParam(params, 1);
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
        const namespace = getStringParam(params, 0);
        const key = getStringParam(params, 1);
        const value = getStringParam(params, 2);
        const updatedAt = getStringParam(params, 3);

        keyValueRows.set(`${namespace}:${key}`, { updatedAt, value });
      }

      if (sql.includes("DELETE FROM local_key_value_entries")) {
        const namespace = getStringParam(params, 0);
        const key = getStringParam(params, 1);

        keyValueRows.delete(`${namespace}:${key}`);
      }

      if (sql.includes("DELETE FROM agent_apply_operation_ledger")) {
        operationRows.clear();
      }

      if (sql.includes("DELETE FROM agent_apply_records")) {
        applyRecords.clear();
      }

      if (sql.includes("INSERT OR IGNORE INTO agent_apply_records")) {
        const proposalId = getStringParam(params, 1);

        if (!applyRecords.has(proposalId)) {
          applyRecords.set(proposalId, {
            conversation_id: null,
            error_code: null,
            error_message: null,
            failed_step: null,
            finished_at: getStringParam(params, 4),
            proposal_id: proposalId,
            started_at: getStringParam(params, 3),
            status: "succeeded",
            trip_id: getStringParam(params, 2),
            trip_updated_at_after_apply: getStringParam(params, 5),
            trip_updated_at_before_apply: null,
            turn_id: null,
          });
        }
      } else if (sql.includes("INSERT INTO agent_apply_records")) {
        const proposalId = getStringParam(params, 1);
        const existing = applyRecords.get(proposalId);
        const status = getStringParam(params, 5) as AgentApplyLedgerStatus;

        if (existing?.status !== "succeeded" || status === "succeeded") {
          applyRecords.set(proposalId, {
            conversation_id:
              existing?.conversation_id ?? getNullableStringParam(params, 3),
            error_code: getNullableStringParam(params, 11),
            error_message: getNullableStringParam(params, 12),
            failed_step: getNullableStringParam(params, 10),
            finished_at: getNullableStringParam(params, 7),
            proposal_id: proposalId,
            started_at: existing?.started_at ?? getStringParam(params, 6),
            status,
            trip_id: getStringParam(params, 2),
            trip_updated_at_after_apply: getNullableStringParam(params, 9),
            trip_updated_at_before_apply:
              existing?.trip_updated_at_before_apply ??
              getNullableStringParam(params, 8),
            turn_id: existing?.turn_id ?? getNullableStringParam(params, 4),
          });
        }
      }

      if (sql.includes("INSERT OR IGNORE INTO agent_apply_operation_ledger")) {
        const operationId = getStringParam(params, 0);

        if (!operationRows.has(operationId)) {
          operationRows.set(operationId, {
            finished_at: getStringParam(params, 4),
            operation_id: operationId,
            operation_type: "legacy",
            proposal_id: getStringParam(params, 1),
            started_at: getStringParam(params, 3),
            status: "succeeded",
            trip_id: getStringParam(params, 2),
          });
        }
      } else if (sql.includes("INSERT INTO agent_apply_operation_ledger")) {
        const operationId = getStringParam(params, 0);
        const existing = operationRows.get(operationId);

        if (existing?.status !== "succeeded") {
          operationRows.set(operationId, {
            finished_at: getNullableStringParam(params, 6),
            operation_id: operationId,
            operation_type: getStringParam(params, 3),
            proposal_id: getStringParam(params, 1),
            started_at: existing?.started_at ?? getStringParam(params, 5),
            status: getStringParam(params, 4) as AgentApplyLedgerStatus,
            trip_id: getStringParam(params, 2),
          });
        }
      }

      return { changes: 1, lastInsertRowId: 1 };
    },
  };

  return {
    ...executor,
    applyRecords,
    keyValueRows,
    operationRows,
    transaction: async (work) => work(executor),
  };
}

function makeProposal(
  overrides: Partial<TripEditProposal> = {},
): TripEditProposal {
  return {
    expectedUpdatedAt: "2026-06-01T00:00:00.000Z",
    operations: [
      {
        type: "update_day_item",
        changes: {
          time: "10:00",
        },
        dayId: "day-1",
        itemId: "item-1",
        operationId: "op-1",
        tripId: "trip-1",
      },
    ],
    proposalId: "proposal-1",
    summary: "Update item",
    tripId: "trip-1",
    ...overrides,
  };
}

function makeTrip(): Trip {
  return {
    checklistItems: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    currency: "CNY",
    days: [],
    destination: "Test",
    expenses: [],
    id: "trip-1",
    importSources: [],
    lodgings: [],
    memos: [],
    places: [],
    status: "planning" as Trip["status"],
    title: "Test Trip",
    transports: [],
    updatedAt: "2026-06-02T00:00:00.000Z",
  };
}

test("recordAppliedAgentProposal writes succeeded proposal and operation ledger rows", async () => {
  const db = createFakeLocalDb();
  const storage = makeStorage();
  const proposal = makeProposal();

  setLocalDbForTests(db);

  try {
    await recordAppliedAgentProposal(
      {
        appliedOperationIds: ["op-1"],
        conversationId: "conversation-1",
        proposal,
        trip: makeTrip(),
        turnId: "turn-1",
      },
      {
        clock: () => "2026-06-03T00:00:00.000Z",
        storage,
      },
    );

    const records = await getAppliedAgentProposalRecords({ storage });
    const operationIds = await getAppliedAgentOperationIds({ storage });

    assert.equal(records.length, 1);
    assert.equal(records[0]?.proposalId, "proposal-1");
    assert.equal(records[0]?.conversationId, "conversation-1");
    assert.equal(records[0]?.turnId, "turn-1");
    assert.equal(
      records[0]?.tripUpdatedAtAfterApply,
      "2026-06-02T00:00:00.000Z",
    );
    assert.equal(db.applyRecords.get("proposal-1")?.status, "succeeded");
    assert.equal(db.operationRows.get("op-1")?.status, "succeeded");
    assert.equal(operationIds.has("op-1"), true);
    assert.equal(await hasAppliedAgentProposal(proposal, { storage }), true);
  } finally {
    setLocalDbForTests(null);
  }
});

test("recordAppliedAgentProposal succeeds without a fallible post-commit ledger read", async () => {
  const db = createFakeLocalDb({ failSucceededRecordReads: true });
  const storage = makeStorage();
  const proposal = makeProposal();

  setLocalDbForTests(db);

  try {
    const records = await recordAppliedAgentProposal(
      {
        appliedOperationIds: ["op-1"],
        conversationId: "conversation-1",
        proposal,
        trip: makeTrip(),
        turnId: "turn-1",
      },
      {
        clock: () => "2026-06-03T00:00:00.000Z",
        storage,
      },
    );

    assert.equal(records[0]?.proposalId, "proposal-1");
    assert.equal(db.applyRecords.get("proposal-1")?.status, "succeeded");
    assert.equal(db.operationRows.get("op-1")?.status, "succeeded");
  } finally {
    setLocalDbForTests(null);
  }
});

test("hasAppliedAgentProposal detects repeated operation ids across proposal ids", async () => {
  const db = createFakeLocalDb();
  const storage = makeStorage();

  setLocalDbForTests(db);

  try {
    await recordAppliedAgentProposal(
      {
        appliedOperationIds: ["op-1"],
        proposal: makeProposal(),
        trip: makeTrip(),
      },
      { storage },
    );

    const repeatedOperationProposal = makeProposal({
      proposalId: "proposal-other",
    });

    assert.equal(
      await hasAppliedAgentProposal(repeatedOperationProposal, { storage }),
      true,
    );
  } finally {
    setLocalDbForTests(null);
  }
});

test("failed apply records preserve audit data without blocking retry", async () => {
  const db = createFakeLocalDb();
  const storage = makeStorage();
  const proposal = makeProposal();

  setLocalDbForTests(db);

  try {
    await beginAgentProposalApply(
      {
        proposal,
        trip: makeTrip(),
      },
      {
        clock: () => "2026-06-03T00:00:00.000Z",
        storage,
      },
    );
    await recordFailedAgentProposalApply(
      {
        errorCode: "TRIP_SAVE_FAILED",
        errorMessage: "保存失败",
        failedStep: "trip_save",
        proposal,
        trip: makeTrip(),
      },
      {
        clock: () => "2026-06-03T00:01:00.000Z",
        storage,
      },
    );

    assert.equal(await hasAppliedAgentProposal(proposal, { storage }), false);
    assert.deepEqual([...(await getAppliedAgentOperationIds({ storage }))], []);
    assert.equal(db.applyRecords.get("proposal-1")?.status, "failed");
    assert.equal(db.applyRecords.get("proposal-1")?.failed_step, "trip_save");
    assert.equal(db.operationRows.get("op-1")?.status, "failed");
  } finally {
    setLocalDbForTests(null);
  }
});

test("getAppliedAgentProposalRecords tolerates malformed legacy storage values", async () => {
  const db = createFakeLocalDb();
  const storage = makeStorage("{not-json");

  setLocalDbForTests(db);

  try {
    assert.deepEqual(await getAppliedAgentProposalRecords({ storage }), []);
    assert.deepEqual([...(await getAppliedAgentOperationIds({ storage }))], []);
  } finally {
    setLocalDbForTests(null);
  }
});

test("default applied proposal storage lazily migrates legacy AsyncStorage data into apply ledger", async () => {
  const db = createFakeLocalDb();
  const legacyValue = JSON.stringify([
    {
      appliedAt: "2026-06-03T00:00:00.000Z",
      operationIds: ["op-1"],
      proposalId: "proposal-1",
      tripId: "trip-1",
      tripUpdatedAtAfterApply: "2026-06-02T00:00:00.000Z",
    },
  ]);
  const legacyStorage = makeStorage(legacyValue);

  setLocalDbForTests(db);
  setAgentLocalStorageAdapterForTests(null);
  setLegacyAgentLocalStorageAdapterForTests(legacyStorage);

  try {
    const records = await getAppliedAgentProposalRecords();
    const sqliteStorage = createLocalDbKeyValueStorageAdapter("agent");

    assert.equal(records.length, 1);
    assert.equal(records[0]?.proposalId, "proposal-1");
    assert.equal(db.applyRecords.get("proposal-1")?.status, "succeeded");
    assert.equal(db.operationRows.get("op-1")?.status, "succeeded");
    assert.equal(
      await sqliteStorage.getItem(AGENT_APPLIED_PROPOSALS_STORAGE_KEY),
      null,
    );
    assert.equal(
      legacyStorage.values.has(AGENT_APPLIED_PROPOSALS_STORAGE_KEY),
      false,
    );
  } finally {
    setLegacyAgentLocalStorageAdapterForTests(undefined);
    setAgentLocalStorageAdapterForTests(null);
    setLocalDbForTests(null);
  }
});

test("clearAppliedAgentProposalLedger removes ledger rows and legacy KV", async () => {
  const db = createFakeLocalDb();
  const storage = makeStorage();
  const proposal = makeProposal();

  setLocalDbForTests(db);

  try {
    await recordAppliedAgentProposal(
      {
        appliedOperationIds: ["op-1"],
        proposal,
        trip: makeTrip(),
      },
      { storage },
    );
    await storage.setItem(AGENT_APPLIED_PROPOSALS_STORAGE_KEY, "legacy");

    await clearAppliedAgentProposalLedger({ storage });

    assert.equal(db.applyRecords.size, 0);
    assert.equal(db.operationRows.size, 0);
    assert.equal(
      storage.values.has(AGENT_APPLIED_PROPOSALS_STORAGE_KEY),
      false,
    );
  } finally {
    setLocalDbForTests(null);
  }
});

test("web applied proposal ledger uses storage without opening SQLite", async () => {
  const originalExpoOs = process.env.EXPO_OS;
  const db = createFakeLocalDb();
  const storage = makeStorage();
  const proposal = makeProposal();

  process.env.EXPO_OS = "web";
  setLocalDbForTests(db);

  try {
    await recordAppliedAgentProposal(
      {
        appliedOperationIds: ["op-1"],
        proposal,
        trip: makeTrip(),
      },
      {
        clock: () => "2026-06-03T00:00:00.000Z",
        storage,
      },
    );

    assert.equal(await hasAppliedAgentProposal(proposal, { storage }), true);
    assert.deepEqual(
      [...(await getAppliedAgentOperationIds({ storage }))],
      ["op-1"],
    );
    assert.equal(db.applyRecords.size, 0);
    assert.equal(db.operationRows.size, 0);
  } finally {
    if (originalExpoOs === undefined) {
      delete process.env.EXPO_OS;
    } else {
      process.env.EXPO_OS = originalExpoOs;
    }
    setLocalDbForTests(null);
  }
});
