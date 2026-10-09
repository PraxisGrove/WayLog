import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL) ??
  normalizeEnvValue(process.env.EXPO_PUBLIC_SUPABASE_URL);
const supabaseAnonKey =
  normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ??
  normalizeEnvValue(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

let client: SupabaseClient | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function getBrowserSupabaseClient(): SupabaseClient | undefined {
  if (!isSupabaseConfigured) {
    return undefined;
  }

  if (!client) {
    if (!isHttpUrl(supabaseUrl)) {
      throw new Error(
        "Invalid Supabase URL. Check EXPO_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.",
      );
    }

    client = createClient(supabaseUrl as string, supabaseAnonKey as string);
  }

  return client;
}

function isHttpUrl(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeEnvValue(value: string | undefined) {
  const normalizedValue = value?.trim();

  if (
    !normalizedValue ||
    normalizedValue === "undefined" ||
    normalizedValue === "null"
  ) {
    return undefined;
  }

  return normalizedValue;
}
