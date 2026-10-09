import type { LocalDb, LocalDbExecutor } from "./local-db-types";

export async function runLocalDbTransaction<TResult>(
  db: LocalDb,
  work: (executor: LocalDbExecutor) => Promise<TResult>,
): Promise<TResult> {
  return db.transaction(work);
}
