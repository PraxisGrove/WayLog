import { getAuthState, saveAuthState, signOut } from "./storage";
import { destroySupabaseRealtimeClient } from "./supabase-realtime";
import type { AuthSession } from "./types";

let inflightInvalidation: Promise<void> | null = null;

function isSameSessionSnapshot(
  latest: AuthSession,
  requested: AuthSession,
): boolean {
  return (
    latest.userId === requested.userId &&
    latest.accessToken === requested.accessToken &&
    latest.refreshToken === requested.refreshToken
  );
}

export async function saveRefreshedSessionIfCurrent(
  requestedSession: AuthSession,
  refreshedSession: AuthSession,
): Promise<boolean> {
  const latestState = await getAuthState();
  const latestSession = latestState.session;

  if (
    !latestSession ||
    !isSameSessionSnapshot(latestSession, requestedSession)
  ) {
    return false;
  }

  await saveAuthState({
    ...latestState,
    session: {
      ...latestSession,
      accessToken: refreshedSession.accessToken,
      lastActiveAt: refreshedSession.lastActiveAt,
      refreshToken: refreshedSession.refreshToken,
      userId: refreshedSession.userId,
    },
  });

  return true;
}

export async function handleAuthInvalidated(): Promise<void> {
  if (!inflightInvalidation) {
    inflightInvalidation = (async () => {
      try {
        await signOut();
      } finally {
        destroySupabaseRealtimeClient();
      }
    })().finally(() => {
      inflightInvalidation = null;
    });
  }

  await inflightInvalidation;
}
