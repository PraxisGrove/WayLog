export type LocalDbValue = string | number | boolean | null | Uint8Array;

export type LocalDbParams =
  | readonly LocalDbValue[]
  | Record<string, LocalDbValue>;

export type LocalDbRunResult = {
  changes: number;
  lastInsertRowId: number;
};

export type LocalDbExecutor = {
  exec: (sql: string) => Promise<void>;
  getAll: <TRow>(sql: string, params?: LocalDbParams) => Promise<TRow[]>;
  getFirst: <TRow>(sql: string, params?: LocalDbParams) => Promise<TRow | null>;
  run: (sql: string, params?: LocalDbParams) => Promise<LocalDbRunResult>;
};

export type LocalDb = LocalDbExecutor & {
  transaction: <TResult>(
    work: (db: LocalDbExecutor) => Promise<TResult>,
  ) => Promise<TResult>;
};

export type LocalDbMigration = {
  id: number;
  name: string;
  up: (db: LocalDbExecutor) => Promise<void>;
};
