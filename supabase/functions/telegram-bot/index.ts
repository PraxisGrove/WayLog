import { createServerLogger, withSentry } from '../_shared/sentry.ts';
import { readWebhookConfig, rejectWebhookRequest, timingSafeEqual } from '../_shared/webhook-auth.ts';

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

type TelegramMessage = {
  message_id: number;
  chat: { id: number; type: string };
  from?: { id: number; first_name: string; username?: string };
  text?: string;
  date: number;
};

type TelegramCallbackQuery = {
  id: string;
  from: { id: number; first_name: string; username?: string };
  message?: { chat: { id: number }; message_id: number };
  data?: string;
};

const TELEGRAM_API = 'https://api.telegram.org';
const logger = createServerLogger('telegram-bot');

function getEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function tg(method: string, body: Record<string, unknown>): Promise<Response> {
  const token = getEnv('TELEGRAM_BOT_TOKEN');
  return fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

async function sendMessage(chatId: number, text: string, extra?: Record<string, unknown>) {
  await tg('sendMessage', { chat_id: chatId, parse_mode: 'HTML', text, ...extra });
}

async function dbQuery<T>(sql: string): Promise<T[]> {
  const url = getEnv('SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    body: JSON.stringify({ query: sql }),
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!res.ok) {
    // fallback: use direct query endpoint
    const res2 = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    });
    throw new Error(`DB query failed: ${res.status}`);
  }

  return res.json() as Promise<T[]>;
}

async function restQuery<T>(table: string, query: string): Promise<T[]> {
  const url = getEnv('SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    method: 'GET',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`REST query failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<T[]>;
}

async function countRows(table: string, filter?: string): Promise<number> {
  const url = getEnv('SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const query = filter ? `?${filter}` : '';
  const res = await fetch(`${url}/rest/v1/${table}${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'count=exact',
      Range: '0-0',
    },
    method: 'HEAD',
  });
  const contentRange = res.headers.get('content-range');
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)/);
    return match ? Number.parseInt(match[1], 10) : 0;
  }
  return 0;
}

async function getProfileCount(): Promise<number> {
  const url = getEnv('SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${url}/rest/v1/profiles?select=id`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'count=exact',
      Range: '0-0',
    },
    method: 'HEAD',
  });
  const contentRange = res.headers.get('content-range');
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)/);
    return match ? Number.parseInt(match[1], 10) : 0;
  }
  return 0;
}

async function getFeedbackCount(): Promise<number> {
  const url = getEnv('SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${url}/rest/v1/feedback?select=id`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'count=exact',
      Range: '0-0',
    },
    method: 'HEAD',
  });
  const contentRange = res.headers.get('content-range');
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)/);
    return match ? Number.parseInt(match[1], 10) : 0;
  }
  return 0;
}

async function getTodayNewUsers(): Promise<number> {
  const url = getEnv('SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(`${url}/rest/v1/profiles?select=id&created_at=gte.${today}T00:00:00`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'count=exact',
      Range: '0-0',
    },
    method: 'HEAD',
  });
  const contentRange = res.headers.get('content-range');
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)/);
    return match ? Number.parseInt(match[1], 10) : 0;
  }
  return 0;
}

async function getTodayFeedbackCount(): Promise<number> {
  const url = getEnv('SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(`${url}/rest/v1/feedback?select=id&created_at=gte.${today}T00:00:00`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'count=exact',
      Range: '0-0',
    },
    method: 'HEAD',
  });
  const contentRange = res.headers.get('content-range');
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)/);
    return match ? Number.parseInt(match[1], 10) : 0;
  }
  return 0;
}

async function handleStart(chatId: number) {
  const text = [
    '👋 <b>一路记 Bot</b>',
    '',
    '可用指令：',
    '/stats — 数据统计概览',
    '/feedback — 最近反馈',
    '/users — 最近注册用户',
  ].join('\n');
  await sendMessage(chatId, text);
}

async function sqlQuery<T>(sql: string): Promise<T[]> {
  const url = getEnv('SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const cleaned = sql.trim().replace(/\s+/g, ' ');
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    body: JSON.stringify({ query: cleaned }),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`SQL query failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T[]>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function progressBar(current: number, max: number, length = 10): string {
  const ratio = Math.min(current / max, 1);
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percent = (ratio * 100).toFixed(0);
  return `${bar} ${percent}%`;
}

async function handleStats(chatId: number) {
  const today = new Date().toISOString().split('T')[0];

  const [totalUsers, todayUsers, totalFeedback, todayFeedback, totalTrips, totalPlaces] =
    await Promise.all([
      getProfileCount(),
      getTodayNewUsers(),
      getFeedbackCount(),
      getTodayFeedbackCount(),
      countRows('user_trips', 'select=id&deleted_at=is.null'),
      countRows('user_favorite_places', 'select=id'),
    ]);

  type DbSizeRow = { db_size_bytes: string };
  type ConnRow = { active: string; idle: string; total: string };
  type CacheRow = { hit_ratio: string };
  type TxnRow = { committed: string; uptime_seconds: string };

  const [dbSizeRows, connRows, txnRows, cacheRows] = await Promise.all([
    sqlQuery<DbSizeRow>(`SELECT pg_database_size(current_database())::text AS db_size_bytes`),
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

  const conn = connRows[0] ?? { active: '0', idle: '0', total: '0' };
  const cacheHitRatio = cacheRows[0]?.hit_ratio ?? 'N/A';
  const txn = txnRows[0] ?? { committed: '0', uptime_seconds: '1' };
  const totalTxn = Number(txn.committed);
  const uptimeDays = Math.max(Number(txn.uptime_seconds) / 86400, 1);
  const dailyAvgTxn = Math.round(totalTxn / uptimeDays);

  const dbUsageMB = dbSizeBytes / (1024 * 1024);
  const dbUsagePercent = ((dbUsageMB / 500) * 100).toFixed(1);
  const dbStatus = Number(dbUsagePercent) > 80 ? '🔴' : Number(dbUsagePercent) > 50 ? '🟡' : '🟢';

  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const estimatedMonthlyFnCalls = Math.round(20 * daysInMonth);
  const fnUsagePercent = ((estimatedMonthlyFnCalls / 500000) * 100).toFixed(2);

  const dbBar = progressBar(dbSizeBytes, dbMaxBytes, 8);
  const cacheIcon = Number(cacheHitRatio) >= 99 ? '🟢' : Number(cacheHitRatio) >= 95 ? '🟡' : '🔴';

  const text = [
    `📊 <b>每日报告</b> · ${today}`,
    '',
    '👥 <b>用户</b> ' + `${totalUsers} 总计，今日 +${todayUsers}`,
    '📝 <b>反馈</b> ' + `${totalFeedback} 总计，今日 +${todayFeedback}`,
    '✈️ <b>行程</b> ' + `${totalTrips} 活跃　　⭐ <b>收藏</b> ${totalPlaces}`,
    '',
    `${dbStatus} <b>数据库</b> ${dbSizePretty} / 500 MB　${dbBar}　使用 ${dbUsagePercent}%`,
    `⚡ 缓存命中率 ${cacheHitRatio}%${cacheIcon}`,
    `🔗 连接数 ${conn.active} 活跃 / ${conn.idle} 空闲`,
    `📡 累计请求 ${totalTxn.toLocaleString()} 次，日均约 ${dailyAvgTxn.toLocaleString()} 次`,
    '',
    '📦 <b>免费额度使用情况</b>',
    `   数据库存储：${dbUsagePercent}%（${dbSizePretty} / 500 MB）`,
    `   Edge Functions：约 ${fnUsagePercent}%（预估本月 ${estimatedMonthlyFnCalls.toLocaleString()} 次 / 50 万次）`,
    `   月活用户：${totalUsers} / 50,000`,
  ].join('\n');

  await sendMessage(chatId, text);
}

async function handleFeedback(chatId: number) {
  const rows = await restQuery<{
    id: string;
    description: string;
    contact_method: string | null;
    contact_value: string | null;
    platform: string | null;
    created_at: string;
  }>('feedback', 'order=created_at.desc&limit=5&select=id,description,contact_method,contact_value,platform,created_at');

  if (rows.length === 0) {
    await sendMessage(chatId, '📝 暂无反馈记录。');
    return;
  }

  const lines = rows.map((r, i) => {
    const date = r.created_at.slice(0, 16).replace('T', ' ');
    const contact = r.contact_method && r.contact_value ? `${r.contact_method}: ${r.contact_value}` : '无联系方式';
    const platform = r.platform ?? '未知';
    return [
      `<b>${i + 1}. ${escapeHtml(truncate(r.description, 50))}</b>`,
      `   📱 ${platform} | 📅 ${date}`,
      `   📫 ${contact}`,
    ].join('\n');
  });

  const text = ['📝 <b>最近 5 条反馈</b>', '', ...lines].join('\n');
  await sendMessage(chatId, text);
}

async function handleUsers(chatId: number) {
  const rows = await restQuery<{
    display_name: string;
    created_at: string;
    id: string;
  }>('profiles', 'order=created_at.desc&limit=5&select=id,display_name,created_at');

  if (rows.length === 0) {
    await sendMessage(chatId, '👥 暂无注册用户。');
    return;
  }

  const lines = rows.map((r, i) => {
    const date = r.created_at.slice(0, 16).replace('T', ' ');
    return `${i + 1}. <b>${escapeHtml(r.display_name)}</b> — ${date}`;
  });

  const text = ['👥 <b>最近 5 位用户</b>', '', ...lines].join('\n');
  await sendMessage(chatId, text);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

async function handleUpdate(update: TelegramUpdate) {
  if (update.message?.text) {
    const chatId = update.message.chat.id;
    const text = update.message.text.trim();

    if (text === '/start' || text.startsWith('/start@')) {
      await handleStart(chatId);
    } else if (text === '/stats' || text.startsWith('/stats@')) {
      await handleStats(chatId);
    } else if (text === '/feedback' || text.startsWith('/feedback@')) {
      await handleFeedback(chatId);
    } else if (text === '/users' || text.startsWith('/users@')) {
      await handleUsers(chatId);
    }

    return;
  }

}

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

Deno.serve(withSentry(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return rejectWebhookRequest(405, 'Method not allowed.');
  }

  const readEnv = (name: string) => Deno.env.get(name);
  const secret = readWebhookConfig(readEnv, 'TELEGRAM_WEBHOOK_SECRET');
  const allowedChatId = readWebhookConfig(readEnv, 'TELEGRAM_CHAT_ID');
  const adminUserId = readWebhookConfig(readEnv, 'TELEGRAM_ADMIN_USER_ID');
  if (!secret || !allowedChatId || !adminUserId) {
    return rejectWebhookRequest(503, 'Telegram webhook is not configured.');
  }
  const suppliedSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '';
  if (!timingSafeEqual(secret, suppliedSecret)) {
    return rejectWebhookRequest(401, 'Invalid Telegram webhook credentials.');
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return rejectWebhookRequest(400, 'Invalid Telegram JSON.');
  }
  // 验证实际会使用的协议字段，避免 malformed update 被当作成功处理。
  if (
    !update || typeof update !== 'object' || Array.isArray(update) ||
    (update.message?.text !== undefined && typeof update.message.text !== 'string') ||
    (update.callback_query?.data !== undefined && typeof update.callback_query.data !== 'string')
  ) {
    return rejectWebhookRequest(400, 'Invalid Telegram update.');
  }
  // 两种更新互斥；身份必须来自同一分支，禁止拼接 message 与 callback 的字段。
  const hasMessage = update.message !== undefined;
  const hasCallback = update.callback_query !== undefined;
  if (hasMessage === hasCallback) {
    return rejectWebhookRequest(400, 'Telegram update must contain exactly one message or callback.');
  }

  try {
    const chatId = hasMessage ? update.message?.chat?.id : update.callback_query?.message?.chat?.id;
    const userId = hasMessage ? update.message?.from?.id : update.callback_query?.from?.id;
    if (
      !Number.isSafeInteger(chatId) || !Number.isSafeInteger(userId) ||
      String(chatId) !== allowedChatId || String(userId) !== adminUserId
    ) {
      return rejectWebhookRequest(403, 'Telegram sender is not authorized.');
    }
    // 旧通知按钮也必须失效，禁止通过 webhook 执行全表删除。
    if (
      update.message?.text?.trim().startsWith('/clear_feedback') ||
      update.callback_query?.data?.startsWith('clear_feedback_')
    ) {
      return rejectWebhookRequest(403, 'Destructive Telegram commands are disabled.');
    }
    await handleUpdate(update);
  } catch (error) {
    logger.error('telegram_bot_update_failed', error);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}, 'telegram-bot'));
