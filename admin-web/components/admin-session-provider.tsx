"use client";

import "@ant-design/v5-patch-for-react-19";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getCurrentAdminSession } from "@/lib/admin-auth";
import type { AdminSessionState } from "@/lib/admin-types";
import { getBrowserSupabaseClient } from "@/lib/supabase-client";

type AdminSessionContextValue = {
  error?: Error;
  loading: boolean;
  reload: () => Promise<AdminSessionState | undefined>;
  session?: AdminSessionState;
};

const AdminSessionContext = createContext<AdminSessionContextValue | undefined>(
  undefined,
);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSessionState>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadSession = useCallback(
    async (options?: { showLoading?: boolean }) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (options?.showLoading !== false && mountedRef.current) {
        setLoading(true);
      }

      try {
        const nextSession = await getCurrentAdminSession();

        if (mountedRef.current && requestId === requestIdRef.current) {
          setSession(nextSession);
          setError(undefined);
        }

        return nextSession;
      } catch (nextError: unknown) {
        if (mountedRef.current && requestId === requestIdRef.current) {
          setError(
            nextError instanceof Error
              ? nextError
              : new Error("读取后台登录状态失败"),
          );
        }

        return undefined;
      } finally {
        if (mountedRef.current && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    void loadSession();

    return () => {
      mountedRef.current = false;
    };
  }, [loadSession]);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();

    if (!supabase) {
      return undefined;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        void loadSession({ showLoading: false });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadSession]);

  const reload = useCallback(
    () => loadSession({ showLoading: false }),
    [loadSession],
  );

  const value = useMemo(
    () => ({
      error,
      loading,
      reload,
      session,
    }),
    [error, loading, reload, session],
  );

  return (
    <AdminSessionContext.Provider value={value}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession() {
  const context = useContext(AdminSessionContext);

  if (!context) {
    throw new Error("useAdminSession must be used within AdminSessionProvider");
  }

  return context;
}
