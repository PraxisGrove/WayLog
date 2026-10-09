import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { getCurrentAuthUser } from "@/features/auth/storage";
import {
  getSupabaseRealtimeClient,
  setRealtimeAuth,
} from "@/features/auth/supabase-realtime";
import { syncTripChecklistTemplatePreferenceWithCloud } from "@/features/trips/checklist-templates";
import { getCloudSyncSession } from "@/features/trips/cloud-sync";
import { syncTripExpensePreferenceWithCloud } from "@/features/trips/expense-preferences";
import { syncFavoritePlacesWithCloud } from "@/features/trips/favorite-places";
import { syncTripRoutePreferenceWithCloud } from "@/features/trips/route-preferences";
import { syncTripsWithCloud } from "@/features/trips/storage";
import { createDiagnosticLogger } from "@/features/diagnostics";
const syncLogger = createDiagnosticLogger("multi-sync");
const SYNC_DEBOUNCE_MS = 1000;

const POLL_INTERVAL_MS = 5 * 60 * 1000;

const SYNC_COOLDOWN_MS = 10 * 1000;

let syncLock = false;

let lastSyncCompletedAt = 0;

export async function syncAll(): Promise<void> {
  if (syncLock) {
    syncLogger.debug(
      "sync.skipped.locked",
      {
        reason: "sync_lock",
      },
      "Sync skipped because another sync is already running",
    );
    return;
  }

  const now = Date.now();
  const elapsed = now - lastSyncCompletedAt;
  if (elapsed < SYNC_COOLDOWN_MS) {
    syncLogger.debug(
      "sync.skipped.cooldown",
      {
        elapsedMs: elapsed,
        cooldownMs: SYNC_COOLDOWN_MS,
      },
      "Sync skipped because cooldown period has not elapsed",
    );
    return;
  }

  syncLock = true;
  syncLogger.info(
    "sync.started",
    {
      source: "syncAll",
    },
    "Started multi-device sync",
  );

  try {
    const results = await Promise.allSettled([
      syncTripsWithCloud(),
      syncFavoritePlacesWithCloud(),
      syncTripRoutePreferenceWithCloud(),
      syncTripExpensePreferenceWithCloud(),
      syncTripChecklistTemplatePreferenceWithCloud(),
    ]);

    syncLogger.info(
      "sync.finished",
      {
        results: results.map((result, index) => ({
          module: [
            "trips",
            "favorites",
            "route-preferences",
            "expense-preferences",
            "checklist-templates",
          ][index],
          status: result.status,
        })),
      },
      "Finished multi-device sync",
    );
  } catch (error) {
    syncLogger.error(
      "sync.failed",
      {
        error,
      },
      "Multi-device sync failed",
    );
  } finally {
    lastSyncCompletedAt = Date.now();
    syncLock = false;
  }
}

function createDebouncedSync(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return () => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = null;
      void syncAll();
    }, SYNC_DEBOUNCE_MS);
  };
}

export function useMultiDeviceSync(): void {
  const debouncedSyncRef = useRef(createDebouncedSync());
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const checkAuth = async () => {
      try {
        const user = await getCurrentAuthUser();
        if (!isActive) return;

        const currentUserId = user?.user?.id ?? null;
        syncLogger.debug(
          "auth.check.completed",
          {
            hasSession: Boolean(user?.session?.accessToken),
            userId: currentUserId,
          },
          "Checked auth state for multi-device sync",
        );
        setUserId((prev) => (prev !== currentUserId ? currentUserId : prev));
      } catch (error) {
        syncLogger.warn(
          "auth.check.failed",
          {
            error,
          },
          "Failed to check auth state for multi-device sync",
        );
      }
    };

    void checkAuth();

    const authCheckTimer = setInterval(checkAuth, 30 * 1000);

    return () => {
      isActive = false;
      clearInterval(authCheckTimer);
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      syncLogger.info(
        "auth.user.cleared",
        {
          reason: "no_user_id",
        },
        "Multi-device sync disabled because userId is empty",
      );
      return;
    }

    let isActive = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let appStateSub: { remove: () => void } | null = null;

    const setupSync = async () => {
      const [user, cloudSession] = await Promise.all([
        getCurrentAuthUser(),
        getCloudSyncSession(),
      ]);

      if (!isActive || !user?.user?.id || !cloudSession?.accessToken) {
        syncLogger.warn(
          "setup.aborted.missing-session",
          {
            hasAccessToken: Boolean(cloudSession?.accessToken),
            isActive,
            resolvedUserId: user?.user?.id ?? null,
            userId,
          },
          "Aborted multi-device sync setup because session is unavailable",
        );
        return;
      }

      const accessToken = cloudSession.accessToken;
      const client = getSupabaseRealtimeClient();

      setRealtimeAuth(accessToken);
      syncLogger.info(
        "realtime.auth.set",
        {
          userId,
        },
        "Configured realtime auth for multi-device sync",
      );

      const channel = client
        .channel(`sync-user-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_trips",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            syncLogger.info(
              "realtime.change.user-trips",
              {
                eventType: payload.eventType,
                userId,
              },
              "Received realtime change for user_trips",
            );
            debouncedSyncRef.current();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_favorite_places",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            syncLogger.info(
              "realtime.change.user-favorite-places",
              {
                eventType: payload.eventType,
                userId,
              },
              "Received realtime change for user_favorite_places",
            );
            debouncedSyncRef.current();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_preferences",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            syncLogger.info(
              "realtime.change.user-preferences",
              {
                eventType: payload.eventType,
                userId,
              },
              "Received realtime change for user_preferences",
            );
            debouncedSyncRef.current();
          },
        )
        .subscribe((status) => {
          syncLogger.info(
            "realtime.subscription.status",
            {
              status,
              userId,
            },
            "Realtime subscription status changed",
          );
        });

      const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (nextAppState === "active") {
          syncLogger.debug(
            "app-state.active.trigger-sync",
            {
              nextAppState,
              userId,
            },
            "App returned to foreground and triggered sync",
          );
          void syncAll();
        }
      };

      appStateSub = AppState.addEventListener("change", handleAppStateChange);

      let isForeground = AppState.currentState === "active";

      const handlePoll = () => {
        if (isForeground) {
          syncLogger.debug(
            "poll.trigger-sync",
            {
              intervalMs: POLL_INTERVAL_MS,
              userId,
            },
            "Periodic foreground poll triggered sync",
          );
          void syncAll();
        }
      };

      pollTimer = setInterval(handlePoll, POLL_INTERVAL_MS);

      const handleAppStateForPoll = (nextAppState: AppStateStatus) => {
        isForeground = nextAppState === "active";
      };

      const pollStateSub = AppState.addEventListener(
        "change",
        handleAppStateForPoll,
      );

      syncLogger.info(
        "setup.initial-sync",
        {
          userId,
        },
        "Running initial sync after multi-device sync setup",
      );
      void syncAll();

      return () => {
        client.removeChannel(channel);
        appStateSub?.remove();
        pollStateSub?.remove();

        if (pollTimer) {
          clearInterval(pollTimer);
        }
      };
    };

    let cleanupFn: (() => void) | undefined;

    void setupSync().then((cleanup) => {
      cleanupFn = cleanup;
    });

    return () => {
      isActive = false;
      cleanupFn?.();
    };
  }, [userId]);
}
