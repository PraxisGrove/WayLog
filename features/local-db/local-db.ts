import { runLocalDbMigrations } from "./local-db-migrations";
import type {
  LocalDb,
  LocalDbExecutor,
  LocalDbParams,
  LocalDbRunResult,
} from "./local-db-types";

const LOCAL_DB_NAME = "waylog.db";

type ExpoSQLiteRunResult = {
  changes: number;
  lastInsertRowId: number;
};

type ExpoSQLiteDatabase = {
  execAsync: (sql: string) => Promise<void>;
  getAllAsync: <TRow>(sql: string, params?: LocalDbParams) => Promise<TRow[]>;
  getFirstAsync: <TRow>(
    sql: string,
    params?: LocalDbParams,
  ) => Promise<TRow | null>;
  runAsync: (
    sql: string,
    params?: LocalDbParams,
  ) => Promise<ExpoSQLiteRunResult>;
  withTransactionAsync: (work: () => Promise<void>) => Promise<void>;
};

type ExpoSQLiteModule = {
  openDatabaseAsync: (databaseName: string) => Promise<ExpoSQLiteDatabase>;
};

let localDbPromise: Promise<LocalDb> | null = null;
let localDbForTests: LocalDb | null = null;

function wrapExpoSqliteDatabase(database: ExpoSQLiteDatabase): LocalDb {
  const createExecutor = (db: ExpoSQLiteDatabase): LocalDbExecutor => ({
    exec: (sql) => db.execAsync(sql),
    getAll: (sql, params) => db.getAllAsync(sql, params ?? []),
    getFirst: (sql, params) => db.getFirstAsync(sql, params ?? []),
    run: async (sql, params): Promise<LocalDbRunResult> => {
      const result = await db.runAsync(sql, params ?? []);

      return {
        changes: result.changes,
        lastInsertRowId: result.lastInsertRowId,
      };
    },
  });

  return {
    ...createExecutor(database),
    transaction: async (work) => {
      let result: unknown;
      await database.withTransactionAsync(async () => {
        result = await work(createExecutor(database));
      });

      return result as Awaited<ReturnType<typeof work>>;
    },
  };
}

async function openExpoSqliteDatabase(): Promise<LocalDb> {
  const sqlite = (await import("expo-sqlite")) as ExpoSQLiteModule;
  const database = await sqlite.openDatabaseAsync(LOCAL_DB_NAME);
  const db = wrapExpoSqliteDatabase(database);

  await db.exec("PRAGMA foreign_keys = ON;");
  await db.transaction(async (transactionDb) => {
    await runLocalDbMigrations(transactionDb);
  });

  return db;
}

export async function getLocalDb(): Promise<LocalDb> {
  if (localDbForTests) {
    return localDbForTests;
  }

  if (!isLocalDbSupported()) {
    throw new Error("LocalDB is not supported in the current runtime.");
  }

  if (!localDbPromise) {
    localDbPromise = openExpoSqliteDatabase();
  }

  return localDbPromise;
}

export function isLocalDbSupported(): boolean {
  if (process.env.EXPO_OS === "web") {
    return false;
  }

  return (
    typeof window === "undefined" || typeof window.document === "undefined"
  );
}

export function setLocalDbForTests(db: LocalDb | null): void {
  localDbForTests = db;
  localDbPromise = null;
}
