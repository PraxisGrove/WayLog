import { getAgentLocalStorage } from "../../agent-local-storage";

export const TRIP_CREATE_RECEIPT_STORAGE_KEY_PREFIX =
  "waylog.agent.trip-create-receipt.v1.";
export const TRIP_CREATE_PENDING_STORAGE_KEY_PREFIX =
  "waylog.agent.trip-create-pending.v1.";

export async function clearTripCreateLocalState(): Promise<void> {
  const storage = getAgentLocalStorage();
  const keys = (await storage.getAllKeys?.()) ?? [];
  const tripCreateKeys = keys.filter(
    (key) =>
      key.startsWith(TRIP_CREATE_RECEIPT_STORAGE_KEY_PREFIX) ||
      key.startsWith(TRIP_CREATE_PENDING_STORAGE_KEY_PREFIX),
  );

  await Promise.all(
    tripCreateKeys.map((key) => storage.removeItem?.(key) ?? Promise.resolve()),
  );
}
