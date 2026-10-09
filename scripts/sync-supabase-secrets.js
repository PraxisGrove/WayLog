// 将本地或系统环境中的服务端配置同步到部署者指定的 Supabase 项目。
// 用法：node scripts/sync-supabase-secrets.js [project-ref] [--only phone-auth]
const { readFileSync } = require("node:fs");

function writeLine(...messages) {
  process.stdout.write(`${messages.join(" ")}\n`);
}

function writeErrorLine(...messages) {
  process.stderr.write(`${messages.join(" ")}\n`);
}

const envPath = ".env.local";
const args = process.argv.slice(2);
let projectRefArg;
let onlyGroup;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];

  if (arg === "--only") {
    onlyGroup = args[index + 1];
    index += 1;
    continue;
  }

  if (arg === "--help" || arg === "-h") {
    projectRefArg = arg;
    continue;
  }

  if (!projectRefArg) {
    projectRefArg = arg;
  }
}

const secretSpecs = [
  {
    groups: ["phone-auth"],
    name: "SUPABASE_URL",
    sources: ["SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_URL"],
  },
  {
    groups: ["phone-auth"],
    name: "SUPABASE_ANON_KEY",
    sources: ["SUPABASE_ANON_KEY", "EXPO_PUBLIC_SUPABASE_ANON_KEY"],
  },
  {
    groups: ["phone-auth"],
    name: "SUPABASE_PUBLISHABLE_KEY",
    sources: [
      "SUPABASE_PUBLISHABLE_KEY",
      "EXPO_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_ANON_KEY",
    ],
  },
  {
    groups: ["phone-auth"],
    name: "SUPABASE_SERVICE_ROLE_KEY",
    sources: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"],
  },
  { name: "AMAP_WEB_SERVICE_KEY" },
  { name: "AMAP_WEB_SERVICE_KEY_BACKUP" },
  { name: "AMAP_JS_SECURITY_CODE" },
  { name: "AMAP_JS_SECURITY_CODE_BACKUP" },
  {
    name: "WECHAT_APP_ID",
    sources: ["WECHAT_APP_ID", "EXPO_PUBLIC_WECHAT_APP_ID"],
  },
  { name: "WECHAT_APP_SECRET" },
  { groups: ["phone-auth"], name: "ALIYUN_ACCESS_KEY_ID" },
  { groups: ["phone-auth"], name: "ALIYUN_ACCESS_KEY_SECRET" },
  { name: "PGYER_API_KEY" },
  { name: "PGYER_APP_KEY" },
  { name: "PGYER_APP_SHORTCUT" },
  { name: "AGENT_LLM_PROVIDER" },
  { name: "AGENT_LLM_BASE_URL" },
  { name: "AGENT_LLM_MODEL" },
  { name: "AGENT_LLM_API_KEY" },
  { name: "AGENT_LLM_TEMPERATURE" },
  { name: "AGENT_LLM_MAX_TOKENS" },
  { name: "WEB_SEARCH_PROVIDER" },
  { name: "TAVILY_API_KEY" },
  { name: "BRAVE_SEARCH_API_KEY" },
  {
    name: "DEEPSEEK_API_KEY",
    sources: ["DEEPSEEK_API_KEY", "AGENT_LLM_API_KEY"],
  },
  { name: "TELEGRAM_BOT_TOKEN" },
  { name: "TELEGRAM_CHAT_ID" },
  { name: "TELEGRAM_WEBHOOK_SECRET" },
  { name: "TELEGRAM_ADMIN_USER_ID" },
  { name: "INTERNAL_WEBHOOK_SECRET" },
  { name: "SENTRY_DSN", sources: ["SENTRY_DSN", "EXPO_PUBLIC_SENTRY_DSN"] },
  {
    name: "SENTRY_ENVIRONMENT",
    sources: ["SENTRY_ENVIRONMENT", "EXPO_PUBLIC_SENTRY_ENVIRONMENT"],
  },
  { name: "SENTRY_RELEASE" },
  { name: "SENTRY_WEBHOOK_SECRET" },
];

if (projectRefArg === "--help" || projectRefArg === "-h") {
  writeLine(`
Usage:
  node scripts/sync-supabase-secrets.js [project-ref] [--only phone-auth]

需要在系统环境或 .env.local 配置 SUPABASE_ACCESS_TOKEN。
目标项目来自参数、PROJECT_REF / SUPABASE_PROJECT_REF 或自己的 Supabase URL。
`);
  process.exit(0);
}

function parseEnvFile(path) {
  const entries = new Map();

  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return entries;
    }
    throw error;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (value && value !== "?") {
      entries.set(key, value);
    }
  }

  return entries;
}

function getProjectRef(localEnv) {
  const explicitRef =
    projectRefArg?.trim() ||
    process.env.PROJECT_REF?.trim() ||
    process.env.SUPABASE_PROJECT_REF?.trim() ||
    localEnv.get("PROJECT_REF") ||
    localEnv.get("SUPABASE_PROJECT_REF");

  if (explicitRef) {
    if (!/^[a-z0-9-]+$/.test(explicitRef)) {
      throw new Error(
        "目标 project-ref 格式无效，请填写自己的 Supabase 项目标识。",
      );
    }
    return explicitRef;
  }

  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
    localEnv.get("SUPABASE_URL") ||
    localEnv.get("EXPO_PUBLIC_SUPABASE_URL");

  if (supabaseUrl) {
    let parsedUrl;
    try {
      parsedUrl = new URL(supabaseUrl);
    } catch {
      throw new Error("Supabase URL 格式无效，请检查目标项目配置。");
    }
    const projectMatch = /^([a-z0-9-]+)\.supabase\.co$/.exec(
      parsedUrl.hostname,
    );
    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.port ||
      !projectMatch
    ) {
      throw new Error(
        "无法从 URL 推导 Supabase 托管项目，请显式配置 PROJECT_REF 或 SUPABASE_PROJECT_REF。",
      );
    }
    return projectMatch[1];
  }

  throw new Error(
    "缺少目标项目：请传入 project-ref，配置 PROJECT_REF / SUPABASE_PROJECT_REF，或在环境变量 / .env.local 配置 Supabase URL。",
  );
}

const localEnv = parseEnvFile(envPath);
let projectRef;
try {
  projectRef = getProjectRef(localEnv);
} catch (error) {
  writeErrorLine(error instanceof Error ? error.message : error);
  process.exit(1);
}
const selectedSecretSpecs = onlyGroup
  ? secretSpecs.filter(({ groups = [] }) => groups.includes(onlyGroup))
  : secretSpecs;

if (onlyGroup && selectedSecretSpecs.length === 0) {
  writeErrorLine(`Unknown secret group: ${onlyGroup}`);
  process.exit(1);
}

const secretLines = selectedSecretSpecs
  .map(({ name, sources = [name] }) => {
    const value = sources
      .map((source) => process.env[source]?.trim() || localEnv.get(source))
      .find(Boolean);

    return value ? `${name}=${value}` : undefined;
  })
  .filter(Boolean);

if (secretLines.length === 0) {
  writeErrorLine(
    `No Supabase secrets found in ${envPath}. Expected one of: ${selectedSecretSpecs
      .flatMap(({ name, sources = [name] }) => sources)
      .join(", ")}`,
  );
  process.exit(1);
}

async function syncWithManagementApi(secrets) {
  const accessToken =
    process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
    localEnv.get("SUPABASE_ACCESS_TOKEN");

  if (!accessToken) {
    writeErrorLine(
      "Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens and add it to .env.local or the current shell.",
    );
    process.exit(1);
  }

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/secrets`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          secrets.map((line) => {
            const separatorIndex = line.indexOf("=");
            return {
              name: line.slice(0, separatorIndex),
              value: line.slice(separatorIndex + 1),
            };
          }),
        ),
      },
    );

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(
        `Supabase Management API failed: HTTP ${response.status} ${message}`.trim(),
      );
    }

    writeLine(
      `Synced ${secrets.length} Supabase secret(s) via Management API.`,
    );
    return true;
  } catch (error) {
    writeErrorLine(
      `⚠ Management API unavailable: ${error instanceof Error ? error.message : error}`,
    );
    writeErrorLine(
      "  Secrets were not synced. Check SUPABASE_ACCESS_TOKEN and project ref.",
    );
    process.exit(1);
  }
}

(async () => {
  await syncWithManagementApi(secretLines);
})().catch((error) => {
  writeErrorLine(error instanceof Error ? error.message : error);
  process.exit(1);
});
