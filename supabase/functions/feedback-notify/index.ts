import { createServerLogger, withSentry } from '../_shared/sentry.ts';
import { authorizeInternalWebhook } from '../_shared/webhook-auth.ts';

type FeedbackRow = {
  app_version?: string | null;
  contact_method?: string | null;
  contact_value?: string | null;
  created_at?: string;
  description?: string;
  id?: string;
  platform?: string | null;
  user_id?: string | null;
};

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: FeedbackRow;
  old_record?: unknown;
};

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const logger = createServerLogger('feedback-notify');

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing ${name} environment variable`);
  }

  return value;
}

function formatPlatform(platform?: string | null): string {
  switch (platform) {
    case 'ios': return 'iOS';
    case 'android': return 'Android';
    case 'web': return 'Web';
    default: return platform || '未知';
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendTelegramMessage(record: FeedbackRow): Promise<void> {
  const token = getRequiredEnv('TELEGRAM_BOT_TOKEN');
  const chatId = getRequiredEnv('TELEGRAM_CHAT_ID');

  const platform = formatPlatform(record.platform);
  const contact = record.contact_method && record.contact_value
    ? `${escapeHtml(record.contact_method)}: ${escapeHtml(record.contact_value)}`
    : '未提供';
  const version = record.app_version || '未知';
  const isGuest = !record.user_id;
  const description = escapeHtml(record.description || '（空）');

  const text = [
    '📝 <b>新反馈</b>',
    '',
    `<i>${description}</i>`,
    '',
    `联系方式: ${contact}`,
    `平台: ${platform} | 版本: ${version}`,
    `来源: ${isGuest ? '游客' : '登录用户'}`,
  ].join('\n');

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    body: JSON.stringify({
      chat_id: chatId,
      parse_mode: 'HTML',
      text,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API failed: HTTP ${response.status} - ${body}`);
  }
}

Deno.serve(withSentry(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  const denied = authorizeInternalWebhook(request, (name) => Deno.env.get(name));
  if (denied) return denied;

  try {
    const payload = (await request.json().catch(() => ({}))) as WebhookPayload;

    if (payload.type !== 'INSERT' || payload.table !== 'feedback' || !payload.record) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    await sendTelegramMessage(payload.record);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    logger.error('feedback_notify_failed', error);

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
}, 'feedback-notify'));
