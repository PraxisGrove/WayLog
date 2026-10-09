import nextEnv from "@next/env";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const adminRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(adminRoot, "..");
const { loadEnvConfig } = nextEnv;

loadEnvConfig(repoRoot, process.env.NODE_ENV !== "production");
loadRepoEnvLocal(resolve(repoRoot, ".env.local"));

const nextPublicSupabaseUrl =
  readEnv("NEXT_PUBLIC_SUPABASE_URL") ??
  readEnv("EXPO_PUBLIC_SUPABASE_URL") ??
  "";
const nextPublicSupabaseAnonKey =
  readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
  readEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY") ??
  "";

process.env.NEXT_PUBLIC_SUPABASE_URL = nextPublicSupabaseUrl;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = nextPublicSupabaseAnonKey;

/** @type {import("next").NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_ANON_KEY: nextPublicSupabaseAnonKey,
    NEXT_PUBLIC_SUPABASE_URL: nextPublicSupabaseUrl,
  },
};

export default nextConfig;

function readEnv(name) {
  const value = process.env[name]?.trim();

  if (!value || value === "undefined" || value === "null") {
    return undefined;
  }

  return value;
}

function loadRepoEnvLocal(path) {
  if (!existsSync(path)) {
    return;
  }

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (readEnv(key) === undefined) {
      process.env[key] = value;
    }
  }
}
