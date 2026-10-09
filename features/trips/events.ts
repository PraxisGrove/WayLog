import { createDiagnosticLogger } from "../diagnostics";

export const TRIPS_UPDATED_EVENT = "trips:updated";

const listeners = new Set<() => void>();
const tripsEventLogger = createDiagnosticLogger("trips-events");

export function emitTripsUpdated(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      tripsEventLogger.error(
        "emit.listener.failed",
        { error },
        "Trip update listener failed",
      );
    }
  }
}

export function addTripsUpdateListener(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
