import type {
  AdminServiceConfigInitializeItem,
  AdminServiceType,
} from "./admin-service-config-types";

type EnvLike = Record<string, string | undefined>;

export type ProviderSeedDefinition = {
  baseUrl: string | null;
  config: Record<string, unknown>;
  defaultModel: string | null;
  displayName: string;
  envNames: string[];
  providerKey: string;
  serviceType: AdminServiceType;
};

export type SeedSecretImportDecision =
  | {
      action: Exclude<
        AdminServiceConfigInitializeItem["secretAction"],
        "imported"
      >;
      envName: string | null;
    }
  | {
      action: "imported";
      envName: string;
      secret: string;
    };

export function createProviderSeedDefinitions(
  env: EnvLike = process.env,
): ProviderSeedDefinition[] {
  return [
    {
      baseUrl: "https://restapi.amap.com",
      config: { channel: "web_service", purpose: "poi_search_route_geocode" },
      defaultModel: null,
      displayName: "高德 Web 服务",
      envNames: ["AMAP_WEB_SERVICE_KEY", "AMAP_WEB_SERVICE_KEY_BACKUP"],
      providerKey: "amap-web-service",
      serviceType: "poi",
    },
    {
      baseUrl: "https://webapi.amap.com",
      config: { channel: "javascript_api", publicClientKey: true },
      defaultModel: null,
      displayName: "高德 JS 地图",
      envNames: ["EXPO_PUBLIC_AMAP_JS_API_KEY", "NEXT_PUBLIC_AMAP_JS_API_KEY"],
      providerKey: "amap-js-map",
      serviceType: "map",
    },
    {
      baseUrl: null,
      config: { variable: "AMAP_JS_SECURITY_CODE" },
      defaultModel: null,
      displayName: "高德 JS 安全密钥",
      envNames: ["AMAP_JS_SECURITY_CODE", "AMAP_JS_SECURITY_CODE_BACKUP"],
      providerKey: "amap-js-security",
      serviceType: "map",
    },
    {
      baseUrl: null,
      config: { auth: true, database: true },
      defaultModel: null,
      displayName: "Supabase Anon",
      envNames: [
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY",
      ],
      providerKey: "supabase-anon",
      serviceType: "database",
    },
    {
      baseUrl: null,
      config: { serviceRole: true },
      defaultModel: null,
      displayName: "Supabase Service Role",
      envNames: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"],
      providerKey: "supabase-service-role",
      serviceType: "database",
    },
    {
      baseUrl:
        readEnvValue(env, "AGENT_LLM_BASE_URL") ?? "https://api.openai.com/v1",
      config: {
        provider:
          readEnvValue(env, "AGENT_LLM_PROVIDER") ?? "openai_compatible",
        temperature: readNumberEnvValue(env, "AGENT_LLM_TEMPERATURE"),
      },
      defaultModel: readEnvValue(env, "AGENT_LLM_MODEL") ?? null,
      displayName: "Agent LLM",
      envNames: ["AGENT_LLM_API_KEY", "OPENAI_API_KEY", "DEEPSEEK_API_KEY"],
      providerKey: "agent-llm",
      serviceType: "agent",
    },
    {
      baseUrl: "https://api.openai.com/v1",
      config: { provider: "openai" },
      defaultModel: "gpt-4.1-mini",
      displayName: "OpenAI",
      envNames: ["OPENAI_API_KEY"],
      providerKey: "openai",
      serviceType: "llm",
    },
    {
      baseUrl: "https://api.deepseek.com",
      config: { provider: "deepseek" },
      defaultModel: readEnvValue(env, "AGENT_LLM_MODEL") ?? "deepseek-v4-flash",
      displayName: "DeepSeek",
      envNames: ["DEEPSEEK_API_KEY", "AGENT_LLM_API_KEY"],
      providerKey: "deepseek",
      serviceType: "llm",
    },
    {
      baseUrl: "https://api.open-meteo.com",
      config: { provider: "open_meteo", requiresSecret: false },
      defaultModel: null,
      displayName: "Open-Meteo 天气",
      envNames: [],
      providerKey: "open-meteo",
      serviceType: "weather",
    },
    {
      baseUrl: "https://api.telegram.org",
      config: { channel: "feedback_notify" },
      defaultModel: null,
      displayName: "Telegram Bot",
      envNames: ["TELEGRAM_BOT_TOKEN"],
      providerKey: "telegram-bot",
      serviceType: "notification",
    },
    {
      baseUrl: "https://sentry.io",
      config: {
        dsnConfigured: Boolean(
          readEnvValue(env, "SENTRY_DSN", "EXPO_PUBLIC_SENTRY_DSN"),
        ),
        environment: readEnvValue(
          env,
          "SENTRY_ENVIRONMENT",
          "EXPO_PUBLIC_SENTRY_ENVIRONMENT",
        ),
        release: readEnvValue(env, "SENTRY_RELEASE"),
      },
      defaultModel: null,
      displayName: "Sentry",
      envNames: ["SENTRY_AUTH_TOKEN", "SENTRY_WEBHOOK_SECRET"],
      providerKey: "sentry",
      serviceType: "monitoring",
    },
  ];
}

export function decideSeedSecretImport(input: {
  canEncrypt: boolean;
  env: EnvLike;
  hasExistingSecret: boolean;
  seed: Pick<ProviderSeedDefinition, "envNames">;
}): SeedSecretImportDecision {
  if (input.seed.envNames.length === 0) {
    return { action: "not_applicable", envName: null };
  }

  if (input.hasExistingSecret) {
    return { action: "skipped_existing", envName: null };
  }

  const envSecret = readFirstEnvValue(input.env, input.seed.envNames);

  if (!envSecret) {
    return { action: "missing_env", envName: input.seed.envNames[0] ?? null };
  }

  if (!input.canEncrypt) {
    return { action: "encryption_key_missing", envName: envSecret.name };
  }

  return {
    action: "imported",
    envName: envSecret.name,
    secret: envSecret.value,
  };
}

export function hasServiceConfigEncryptionKey(env: EnvLike = process.env) {
  return Boolean(
    readEnvValue(
      env,
      "ADMIN_SERVICE_CONFIG_ENCRYPTION_KEY",
      "SERVICE_CONFIG_ENCRYPTION_KEY",
    ),
  );
}

function readEnvValue(env: EnvLike, ...names: string[]) {
  return readFirstEnvValue(env, names)?.value;
}

function readFirstEnvValue(env: EnvLike, names: string[]) {
  for (const name of names) {
    const value = env[name]?.trim();

    if (value && value !== "undefined" && value !== "null" && value !== "?") {
      return { name, value };
    }
  }

  return undefined;
}

function readNumberEnvValue(env: EnvLike, name: string) {
  const value = readEnvValue(env, name);

  if (!value) {
    return undefined;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : undefined;
}
