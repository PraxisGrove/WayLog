import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { shouldRefreshOnForeground } from "@/features/auth/session-guard";
import {
  handleAuthInvalidated,
  saveRefreshedSessionIfCurrent,
} from "@/features/auth/session-lifecycle";
import {
  getCurrentAuthUser,
  refreshSupabaseSession,
} from "@/features/auth/storage";
import { createDiagnosticLogger } from "@/features/diagnostics";

let inflightForegroundRefresh: Promise<void> | null = null;

const authGuardLogger = createDiagnosticLogger("auth-session-guard");

async function performForegroundRefresh(): Promise<void> {
  try {
    const current = await getCurrentAuthUser();

    if (!current?.session?.refreshToken) {
      authGuardLogger.debug(
        "foreground.refresh.skipped",
        { reason: "no_session" },
        "Skipped foreground refresh because there is no active session",
      );
      return;
    }

    const refreshedSession = await refreshSupabaseSession(current.session);
    const didSaveSession = await saveRefreshedSessionIfCurrent(
      current.session,
      refreshedSession,
    );
    authGuardLogger.info(
      "foreground.refresh.succeeded",
      { didSaveSession, userId: current.user.id },
      "Silent foreground refresh succeeded",
    );
  } catch (error) {
    authGuardLogger.warn(
      "foreground.refresh.failed",
      { error: error instanceof Error ? error.message : String(error) },
      "Silent foreground refresh failed; signing out",
    );

    await handleAuthInvalidated();
  }
}

export function useAuthSessionGuard(): void {
  const lastBackgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        lastBackgroundedAtRef.current = Date.now();
        return;
      }

      if (nextAppState !== "active") {
        return;
      }

      if (
        !shouldRefreshOnForeground(lastBackgroundedAtRef.current, Date.now())
      ) {
        return;
      }

      if (inflightForegroundRefresh) {
        return;
      }

      inflightForegroundRefresh = performForegroundRefresh().finally(() => {
        inflightForegroundRefresh = null;
      });
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      sub.remove();
    };
  }, []);
}
