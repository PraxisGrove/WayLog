import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./supabase";

let realtimeClient: SupabaseClient | null = null;

export function getSupabaseRealtimeClient(): SupabaseClient {
  if (!realtimeClient) {
    const config = getSupabaseConfig();

    realtimeClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }

  return realtimeClient;
}

export function setRealtimeAuth(accessToken: string): void {
  const client = getSupabaseRealtimeClient();
  client.realtime.setAuth(accessToken);
}

export function destroySupabaseRealtimeClient(): void {
  if (realtimeClient) {
    realtimeClient.removeAllChannels();
    realtimeClient = null;
  }
}
