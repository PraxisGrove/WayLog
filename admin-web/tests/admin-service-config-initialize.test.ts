import assert from "node:assert/strict";
import test from "node:test";

import {
  createProviderSeedDefinitions,
  decideSeedSecretImport,
  hasServiceConfigEncryptionKey,
} from "../lib/admin-service-config-initialize";

test("decideSeedSecretImport skips existing database secrets", () => {
  const decision = decideSeedSecretImport({
    canEncrypt: true,
    env: { AMAP_WEB_SERVICE_KEY: "new-secret" },
    hasExistingSecret: true,
    seed: { envNames: ["AMAP_WEB_SERVICE_KEY"] },
  });

  assert.deepEqual(decision, {
    action: "skipped_existing",
    envName: null,
  });
});

test("decideSeedSecretImport imports only when env exists and encryption is available", () => {
  const decision = decideSeedSecretImport({
    canEncrypt: true,
    env: { OPENAI_API_KEY: "fake-openai-key" },
    hasExistingSecret: false,
    seed: { envNames: ["OPENAI_API_KEY"] },
  });

  assert.deepEqual(decision, {
    action: "imported",
    envName: "OPENAI_API_KEY",
    secret: "fake-openai-key",
  });
});

test("decideSeedSecretImport does not import without encryption key", () => {
  const decision = decideSeedSecretImport({
    canEncrypt: false,
    env: { SUPABASE_SERVICE_ROLE_KEY: "service-role" },
    hasExistingSecret: false,
    seed: { envNames: ["SUPABASE_SERVICE_ROLE_KEY"] },
  });

  assert.deepEqual(decision, {
    action: "encryption_key_missing",
    envName: "SUPABASE_SERVICE_ROLE_KEY",
  });
});

test("decideSeedSecretImport reports missing env without writing a secret", () => {
  const decision = decideSeedSecretImport({
    canEncrypt: true,
    env: {},
    hasExistingSecret: false,
    seed: { envNames: ["TELEGRAM_BOT_TOKEN"] },
  });

  assert.deepEqual(decision, {
    action: "missing_env",
    envName: "TELEGRAM_BOT_TOKEN",
  });
});

test("provider seed definitions include required WayLog providers", () => {
  const seeds = createProviderSeedDefinitions({
    AGENT_LLM_BASE_URL: "https://api.deepseek.com",
    AGENT_LLM_MODEL: "deepseek-v4-flash",
    AGENT_LLM_PROVIDER: "deepseek",
  });
  const keys = new Set(seeds.map((seed) => seed.providerKey));

  for (const key of [
    "agent-llm",
    "amap-js-map",
    "amap-web-service",
    "open-meteo",
    "openai",
    "sentry",
    "supabase-anon",
    "supabase-service-role",
  ]) {
    assert.equal(keys.has(key), true, `${key} should be seeded`);
  }
});

test("hasServiceConfigEncryptionKey ignores placeholder values", () => {
  assert.equal(
    hasServiceConfigEncryptionKey({
      ADMIN_SERVICE_CONFIG_ENCRYPTION_KEY: "?",
    }),
    false,
  );
  assert.equal(
    hasServiceConfigEncryptionKey({
      ADMIN_SERVICE_CONFIG_ENCRYPTION_KEY: "real-key",
    }),
    true,
  );
});
