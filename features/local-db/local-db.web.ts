import type { LocalDb } from "./local-db-types";

export async function getLocalDb(): Promise<LocalDb> {
  throw new Error("LocalDB is not supported in the web runtime.");
}

export function isLocalDbSupported(): boolean {
  return false;
}

export function setLocalDbForTests(_db: LocalDb | null): void {
  // Web uses the AsyncStorage fallback path instead of SQLite.
}
