import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createServerLogger, withSentry } from '../_shared/sentry.ts';
import { readWebhookConfig, rejectWebhookRequest } from '../_shared/webhook-auth.ts';

type SentryWebhookPayload = {
  action?: string;
  data?: {
    event?: Record<string, unknown>;
    issue?: Record<string, unknown>;
  };
  installation?: {
    uuid?: string;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, content-type, sentry-hook-signature, sentry-hook-resource, sentry-hook-timestamp',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const logger = createServerLogger('sentry-webhook');

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  });
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getNestedString(
  source: Record<string, unknown> | undefined,
  keys: string[],
): string | null {
  let current: unknown = source;

  for (const key of keys) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return getString(current);
}

function getTimestamp(value: unknown): string | null {
  const rawTimestamp = getString(value);

  if (!rawTimestamp) {
    return null;
  }

  const parsed = Date.parse(rawTimestamp);

  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function getUserId(event: Record<string, unknown> | undefined): string | null {
  const userId = getNestedString(event, ['user', 'id']);

  if (!userId) {
    return null;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(userId)
    ? userId
    : null;
}

function summarizeEvent(
  payload: SentryWebhookPayload,
  event: Record<string, unknown>,
  issue: Record<string, unknown> | undefined,
) {
  return {
    action: payload.action ?? null,
    event_id: getString(event.event_id ?? event.id),
    issue_id: getString(issue?.id ?? event.issue_id),
    logger: getString(event.logger),
    message: getString(event.message),
    transaction: getString(event.transaction),
    type: getString(event.type),
  };
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

async function verifySentrySignature(
  request: Request,
  rawBody: string,
): Promise<boolean> {
  const secret = Deno.env.get('SENTRY_WEBHOOK_SECRET')?.trim();

  if (!secret) {
    return false;
  }

  const signature = request.headers.get('sentry-hook-signature')?.trim().toLowerCase();

  if (!signature || !/^[0-9a-f]{64}$/.test(signature)) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(rawBody),
  );
  const expected = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return timingSafeEqual(expected, signature);
}

Deno.serve(withSentry(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  if (!readWebhookConfig((name) => Deno.env.get(name), 'SENTRY_WEBHOOK_SECRET')) {
    return rejectWebhookRequest(503, 'Sentry webhook is not configured.');
  }

  const rawBody = await request.text();
  let payload: SentryWebhookPayload;

  try {
    payload = JSON.parse(rawBody || '{}') as SentryWebhookPayload;
  } catch (error) {
    logger.warn('payload.invalid-json', { error }, 'Rejected invalid Sentry webhook JSON');
    return jsonResponse({ error: 'Invalid JSON.' }, 400);
  }

  if (!(await verifySentrySignature(request, rawBody))) {
    logger.warn(
      'signature.invalid',
      {},
      'Rejected Sentry webhook with invalid signature',
    );
    return jsonResponse({ error: 'Invalid signature.' }, 401);
  }

  const event = payload.data?.event;
  const issue = payload.data?.issue;

  if (!event) {
    return jsonResponse({ skipped: true, reason: 'missing_event' });
  }

  const sentryEventId = getString(event.event_id ?? event.id);

  if (!sentryEventId) {
    return jsonResponse({ skipped: true, reason: 'missing_event_id' });
  }

  const supabase = createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const { error } = await supabase
    .from('crash_reports')
    .upsert(
      {
        culprit: getString(event.culprit),
        environment: getString(event.environment),
        event_timestamp: getTimestamp(event.timestamp),
        issue_id: getString(issue?.id ?? event.issue_id),
        level: getString(event.level),
        payload_summary: summarizeEvent(payload, event, issue),
        platform: getString(event.platform),
        project_slug: getString(event.project),
        release: getString(event.release),
        sentry_event_id: sentryEventId,
        sentry_url: getString(event.web_url ?? event.url),
        title:
          getString(event.title) ??
          getString(event.message) ??
          getString(issue?.title) ??
          'Untitled Sentry event',
        user_id: getUserId(event),
      },
      { onConflict: 'sentry_event_id' },
    );

  if (error) {
    logger.error('crash_report.upsert.failed', error, {
      sentryEventId,
    });
    throw error;
  }

  return jsonResponse({ ok: true });
}, 'sentry-webhook'));
