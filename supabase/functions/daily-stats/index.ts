import { createServerLogger, withSentry } from '../_shared/sentry.ts';
import { authorizeInternalWebhook, rejectWebhookRequest } from '../_shared/webhook-auth.ts';

const logger = createServerLogger("daily-stats");

function getEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function countRows(table: string, filter?: string): Promise<number> {
  const url = getEnv("SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const query = filter ? `?${filter}` : "";
  const res = await fetch(`${url}/rest/v1/${table}${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "count=exact",
      Range: "0-0",
    },
    method: "HEAD",
  });
  if (!res.ok) {
    throw new Error(`Statistics query failed: HTTP ${res.status}`);
  }
  const contentRange = res.headers.get("content-range");
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)/);
    return match ? Number.parseInt(match[1], 10) : 0;
  }
  return 0;
}

async function sqlQuery<T>(sql: string): Promise<T[]> {
  const url = getEnv("SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const cleaned = sql.trim().replace(/\s+/g, " ");
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    body: JSON.stringify({ query: cleaned }),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!res.ok) {
    throw new Error(`SQL query failed: ${res.status} ${await res.text()}`);
  }

  return res.json() as Promise<T[]>;
}

async function sendTelegram(text: string) {
  const token = getEnv("TELEGRAM_BOT_TOKEN");
  const chatId = getEnv("TELEGRAM_CHAT_ID");
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    body: JSON.stringify({ chat_id: chatId, parse_mode: "HTML", text }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function progressBar(current: number, max: number, length = 10): string {
  const ratio = Math.min(current / max, 1);
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  const percent = (ratio * 100).toFixed(0);
  return `${bar} ${percent}%`;
}

Deno.serve(withSentry(async (request) => {
  if (request.method !== 'POST') {
    return rejectWebhookRequest(405, 'Method not allowed.');
  }
  const denied = authorizeInternalWebhook(request, (name) => Deno.env.get(name));
  if (denied) return denied;

  try {
    const today = new Date().toISOString().split("T")[0];

    const [
      totalUsers,
      todayUsers,
      totalFeedback,
      todayFeedback,
      totalTrips,
      totalPlaces,
    ] = await Promise.all([
      countRows("profiles", "select=id"),
      countRows("profiles", `select=id&created_at=gte.${today}T00:00:00`),
      countRows("feedback", "select=id"),
      countRows("feedback", `select=id&created_at=gte.${today}T00:00:00`),
      countRows("user_trips", "select=id&deleted_at=is.null"),
      countRows("user_favorite_places", "select=id"),
    ]);

    type DbSizeRow = { db_size_bytes: string };
    type ConnRow = { active: string; idle: string; total: string };
    type CacheRow = { hit_ratio: string };
    type TxnRow = { committed: string; uptime_seconds: string };

    const [dbSizeRows, connRows, txnRows, cacheRows] = await Promise.all([
      sqlQuery<DbSizeRow>(`
        SELECT pg_database_size(current_database())::text AS db_size_bytes
      `),
      sqlQuery<ConnRow>(`
        SELECT
          count(*) FILTER (WHERE state = 'active')::text AS active,
          count(*) FILTER (WHERE state = 'idle')::text AS idle,
          count(*)::text AS total
        FROM pg_stat_activity
        WHERE datname = current_database()
      `),
      sqlQuery<TxnRow>(`
        SELECT
          d.xact_commit::text AS committed,
          EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time()))::integer::text AS uptime_seconds
        FROM pg_stat_database d
        WHERE d.datname = current_database()
        LIMIT 1
      `),
      sqlQuery<CacheRow>(`
        SELECT
          CASE WHEN blks_hit + blks_read = 0 THEN '100'
               ELSE round(100.0 * blks_hit / (blks_hit + blks_read), 1)::text
          END AS hit_ratio
        FROM pg_stat_database
        WHERE datname = current_database()
      `),
    ]);

    const dbSizeBytes = Number(dbSizeRows[0]?.db_size_bytes ?? 0);
    const dbSizePretty = formatBytes(dbSizeBytes);
    const dbMaxBytes = 500 * 1024 * 1024;
    const dbUsageBar = progressBar(dbSizeBytes, dbMaxBytes);

    const conn = connRows[0] ?? { active: "0", idle: "0", total: "0" };
    const cacheHitRatio = cacheRows[0]?.hit_ratio ?? "N/A";
    const txn = txnRows[0] ?? { committed: "0", uptime_seconds: "1" };
    const totalTxn = Number(txn.committed);
    const uptimeDays = Math.max(Number(txn.uptime_seconds) / 86400, 1);
    const dailyAvgTxn = Math.round(totalTxn / uptimeDays);

    const limits = {
      dbStorage: 500, // MB
      edgeFunctions: 500000,
      edgeCPU: 100000,
      storage: 1, // GB
      mau: 50000,
    };

    const dbUsageMB = dbSizeBytes / (1024 * 1024);
    const dbUsagePercent = ((dbUsageMB / limits.dbStorage) * 100).toFixed(1);
    const dbStatus =
      Number(dbUsagePercent) > 80
        ? "🔴"
        : Number(dbUsagePercent) > 50
          ? "🟡"
          : "🟢";

    const dayOfMonth = new Date().getDate();
    const daysInMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0,
    ).getDate();
    const estimatedMonthlyFnCalls = Math.round(20 * daysInMonth);
    const fnUsagePercent = (
      (estimatedMonthlyFnCalls / limits.edgeFunctions) *
      100
    ).toFixed(2);

    const dbBar = progressBar(dbSizeBytes, dbMaxBytes, 8);
    const cacheIcon =
      Number(cacheHitRatio) >= 99
        ? "🟢"
        : Number(cacheHitRatio) >= 95
          ? "🟡"
          : "🔴";

    const text = [
      `📊 <b>每日报告</b> · ${today}`,
      "",
      "👥 <b>用户</b> " + `${totalUsers} 总计，今日 +${todayUsers}`,
      "📝 <b>反馈</b> " + `${totalFeedback} 总计，今日 +${todayFeedback}`,
      "✈️ <b>行程</b> " + `${totalTrips} 活跃　　⭐ <b>收藏</b> ${totalPlaces}`,
      "",
      `${dbStatus} <b>数据库</b> ${dbSizePretty} / 500 MB　${dbBar}　使用 ${dbUsagePercent}%`,
      `⚡ 缓存命中率 ${cacheHitRatio}%${cacheIcon} `,
      `🔗 连接数 ${conn.active} 活跃 / ${conn.idle} 空闲`,
      `📡 累计请求 ${totalTxn.toLocaleString()} 次，日均约 ${dailyAvgTxn.toLocaleString()} 次`,
      "",
      "📦 <b>免费额度使用情况</b>",
      `   数据库存储：${dbUsagePercent}%（${dbSizePretty} / 500 MB）`,
      `   Edge Functions：约 ${fnUsagePercent}%（预估本月 ${estimatedMonthlyFnCalls.toLocaleString()} 次 / 50 万次）`,
      `   月活用户：${totalUsers} / 50,000`,
    ].join("\n");

    await sendTelegram(text);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    logger.error("daily_stats_failed", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
    });
  }
}, "daily-stats"));
