import assert from "node:assert/strict";
import test from "node:test";

import {
  createLocalDbKeyValueStorageAdapter,
  isLocalDbSupported,
  runLocalDbMigrations,
  setLocalDbForTests,
  type LocalDb,
  type LocalDbExecutor,
  type LocalDbParams,
  type LocalDbRunResult,
} from "../../../features/local-db";

type FakeMigrationRow = {
  appliedAt: string;
  id: number;
  name: string;
};

type FakeKeyValueRow = {
  updatedAt: string;
  value: string;
};

function getParam(params: LocalDbParams | undefined, index: number): unknown {
  if (!Array.isArray(params)) {
    return undefined;
  }

  return params[index];
}

function createFakeLocalDb(): LocalDb & {
  createdTables: Set<string>;
  keyValueRows: Map<string, FakeKeyValueRow>;
  migrationRows: Map<number, FakeMigrationRow>;
} {
  const createdTables = new Set<string>();
  const keyValueRows = new Map<string, FakeKeyValueRow>();
  const migrationRows = new Map<number, FakeMigrationRow>();

  const executor: LocalDbExecutor = {
    exec: async (sql) => {
      if (sql.includes("local_db_migrations")) {
        createdTables.add("local_db_migrations");
      }

      if (sql.includes("local_key_value_entries")) {
        createdTables.add("local_key_value_entries");
      }

      if (sql.includes("agent_apply_records")) {
        createdTables.add("agent_apply_records");
      }

      if (sql.includes("agent_apply_operation_ledger")) {
        createdTables.add("agent_apply_operation_ledger");
      }
    },
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
      if (sql.includes("FROM local_db_migrations")) {
        const migrationId = getParam(params, 0);
        return (
          typeof migrationId === "number" && migrationRows.has(migrationId)
            ? { id: migrationId }
            : null
        ) as TRow | null;
      }

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
      if (sql.includes("INSERT INTO local_db_migrations")) {
        const id = getParam(params, 0);
        const name = getParam(params, 1);
        const appliedAt = getParam(params, 2);
        assert.equal(typeof id, "number");
        assert.equal(typeof name, "string");
        assert.equal(typeof appliedAt, "string");
        const migrationId = id as number;
        migrationRows.set(migrationId, {
          appliedAt: appliedAt as string,
          id: migrationId,
          name: name as string,
        });
      }

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
    createdTables,
    keyValueRows,
    migrationRows,
    transaction: async (work) => work(executor),
  };
}

test("LocalDB migrations are idempotent", async () => {
  const db = createFakeLocalDb();

  await runLocalDbMigrations(db);
  await runLocalDbMigrations(db);

  assert.equal(db.createdTables.has("local_db_migrations"), true);
  assert.equal(db.createdTables.has("local_key_value_entries"), true);
  assert.equal(db.createdTables.has("agent_apply_records"), true);
  assert.equal(db.createdTables.has("agent_apply_operation_ledger"), true);
  assert.equal(db.migrationRows.size, 3);
  assert.equal(db.migrationRows.get(1)?.name, "create_local_key_value_entries");
  assert.equal(db.migrationRows.get(2)?.name, "create_agent_apply_ledger");
  assert.equal(
    db.migrationRows.get(3)?.name,
    "add_agent_apply_audit_references",
  );
});

test("LocalDB key-value adapter stores and removes values by namespace", async () => {
  const db = createFakeLocalDb();
  setLocalDbForTests(db);

  try {
    const routeCache = createLocalDbKeyValueStorageAdapter("trip-route-cache");
    const agentCache = createLocalDbKeyValueStorageAdapter("agent-cache");

    await routeCache.setItem("same-key", "route-value");
    await agentCache.setItem("same-key", "agent-value");

    assert.equal(await routeCache.getItem("same-key"), "route-value");
    assert.equal(await agentCache.getItem("same-key"), "agent-value");

    await routeCache.removeItem("same-key");

    assert.equal(await routeCache.getItem("same-key"), null);
    assert.equal(await agentCache.getItem("same-key"), "agent-value");
  } finally {
    setLocalDbForTests(null);
  }
});

test("LocalDB key-value adapter lists keys by namespace", async () => {
  const db = createFakeLocalDb();
  setLocalDbForTests(db);

  try {
    const routeCache = createLocalDbKeyValueStorageAdapter("trip-route-cache");
    const agentCache = createLocalDbKeyValueStorageAdapter("agent-cache");

    await routeCache.setItem("route-a", "route-value-a");
    await routeCache.setItem("route-b", "route-value-b");
    await agentCache.setItem("agent-a", "agent-value-a");

    assert.deepEqual(await routeCache.getAllKeys(), ["route-a", "route-b"]);
    assert.deepEqual(await agentCache.getAllKeys(), ["agent-a"]);
  } finally {
    setLocalDbForTests(null);
  }
});

test("LocalDB is disabled on web runtime", () => {
  const originalExpoOs = process.env.EXPO_OS;

  process.env.EXPO_OS = "web";

  try {
    assert.equal(isLocalDbSupported(), false);
  } finally {
    if (originalExpoOs === undefined) {
      delete process.env.EXPO_OS;
    } else {
      process.env.EXPO_OS = originalExpoOs;
    }
  }
});
