import type { LocalDbExecutor, LocalDbMigration } from "./local-db-types";

const MIGRATION_TABLE_NAME = "local_db_migrations";

export const localDbMigrations: LocalDbMigration[] = [
  {
    id: 1,
    name: "create_local_key_value_entries",
    up: async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS local_key_value_entries (
          namespace TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (namespace, key)
        );

        CREATE INDEX IF NOT EXISTS idx_local_key_value_entries_updated_at
          ON local_key_value_entries(namespace, updated_at);
      `);
    },
  },
  {
    id: 2,
    name: "create_agent_apply_ledger",
    up: async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS agent_apply_records (
          record_id TEXT NOT NULL PRIMARY KEY,
          proposal_id TEXT NOT NULL UNIQUE,
          trip_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed')),
          started_at TEXT NOT NULL,
          finished_at TEXT,
          trip_updated_at_before_apply TEXT,
          trip_updated_at_after_apply TEXT,
          failed_step TEXT,
          error_code TEXT,
          error_message TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_agent_apply_records_trip_status
          ON agent_apply_records(trip_id, status, started_at);

        CREATE TABLE IF NOT EXISTS agent_apply_operation_ledger (
          operation_id TEXT NOT NULL PRIMARY KEY,
          proposal_id TEXT NOT NULL,
          trip_id TEXT NOT NULL,
          operation_type TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed')),
          started_at TEXT NOT NULL,
          finished_at TEXT,
          FOREIGN KEY (proposal_id)
            REFERENCES agent_apply_records(proposal_id)
            ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_agent_apply_operation_ledger_proposal
          ON agent_apply_operation_ledger(proposal_id);

        CREATE INDEX IF NOT EXISTS idx_agent_apply_operation_ledger_status
          ON agent_apply_operation_ledger(status, finished_at);
      `);
    },
  },
  {
    id: 3,
    name: "add_agent_apply_audit_references",
    up: async (db) => {
      await db.exec(`
        ALTER TABLE agent_apply_records ADD COLUMN conversation_id TEXT;
        ALTER TABLE agent_apply_records ADD COLUMN turn_id TEXT;
      `);
    },
  },
];

async function ensureMigrationTable(db: LocalDbExecutor): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE_NAME} (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

async function hasMigrationApplied(
  db: LocalDbExecutor,
  migrationId: number,
): Promise<boolean> {
  const row = await db.getFirst<{ id: number }>(
    `SELECT id FROM ${MIGRATION_TABLE_NAME} WHERE id = ? LIMIT 1`,
    [migrationId],
  );

  return Boolean(row);
}

async function markMigrationApplied(
  db: LocalDbExecutor,
  migration: LocalDbMigration,
): Promise<void> {
  await db.run(
    `INSERT INTO ${MIGRATION_TABLE_NAME} (id, name, applied_at)
      VALUES (?, ?, ?)`,
    [migration.id, migration.name, new Date().toISOString()],
  );
}

export async function runLocalDbMigrations(db: LocalDbExecutor): Promise<void> {
  await ensureMigrationTable(db);

  const sortedMigrations = [...localDbMigrations].sort((a, b) => a.id - b.id);

  for (const migration of sortedMigrations) {
    const applied = await hasMigrationApplied(db, migration.id);
    if (applied) {
      continue;
    }

    await migration.up(db);
    await markMigrationApplied(db, migration);
  }
}
