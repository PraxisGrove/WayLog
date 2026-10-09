// 将仓库邮件模板同步到部署者指定的 Supabase 项目。
// 用法：node scripts/sync-supabase-auth-email-templates.js [project-ref]
const { readFileSync } = require("node:fs");

function writeLine(...messages) {
  process.stdout.write(`${messages.join(" ")}\n`);
}

function writeErrorLine(...messages) {
  process.stderr.write(`${messages.join(" ")}\n`);
}

const envPath = ".env.local";

function parseEnvFile(path) {
  const entries = new Map();

  try {
    for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
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
  } catch {
    return entries;
  }

  return entries;
}

function getProjectRef(localEnv) {
  const explicitRef =
    process.argv[2]?.trim() ||
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

async function main() {
  const localEnv = parseEnvFile(envPath);
  const projectRef = getProjectRef(localEnv);
  const accessToken =
    process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
    localEnv.get("SUPABASE_ACCESS_TOKEN");
  if (!accessToken) {
    throw new Error(
      "Missing SUPABASE_ACCESS_TOKEN. " +
        "Create one at https://supabase.com/dashboard/account/tokens " +
        "and set it in the current shell or .env.local.",
    );
  }

  const otpTemplate = readFileSync("supabase/templates/email-otp.html", "utf8");
  const signupTemplate = readFileSync(
    "supabase/templates/email-signup.html",
    "utf8",
  );

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mailer_otp_length: 6,
        mailer_subjects_confirmation: "WayLog verification code",
        mailer_subjects_magic_link: "WayLog verification code",
        mailer_templates_confirmation_content: signupTemplate,
        mailer_templates_magic_link_content: otpTemplate,
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Supabase Auth template sync failed: HTTP ${response.status} ${message}`.trim(),
    );
  }

  writeLine(`Synced Supabase Auth email templates for project ${projectRef}.`);
}

main().catch((error) => {
  writeErrorLine(error instanceof Error ? error.message : error);
  process.exit(1);
});
