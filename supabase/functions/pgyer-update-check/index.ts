import { createServerLogger, withSentry } from '../_shared/sentry.ts';

type PgyerUpdateCheckRequestBody = {
  currentBuildNumber?: string | number | null;
  currentVersion?: string | number | null;
};

type PgyerAppData = {
  buildCreated?: string | null;
  buildHaveNewVersion?: boolean | null;
  buildKey?: string | null;
  buildShortcutUrl?: string | null;
  buildUpdateDescription?: string | null;
  buildUpdated?: string | null;
  buildVersion?: string | number | null;
  buildVersionNo?: string | number | null;
};

type PgyerDownloadUrlData = {
  downloadUrl?: string | null;
  QRCodeUrl?: string | null;
};

type PgyerApiResponse<T> = {
  code?: number;
  data?: T;
  message?: string;
};

const PGYER_API_BASE_URL = 'https://www.pgyer.com/apiv2';
const PGYER_HOME_URL = 'https://www.pgyer.com';
const PUBLIC_RELEASES_URL = 'https://github.com/PraxisGrove/WayLog/releases';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const logger = createServerLogger('pgyer-update-check');

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  });
}

function normalizeComparableValue(value?: string | number | null): string {
  const normalizedValue = String(value ?? '').trim();

  return normalizedValue && normalizedValue !== '?' && normalizedValue !== '暂无' && normalizedValue !== 'undefined'
    ? normalizedValue
    : '';
}

function extractVersionParts(value?: string | number | null): number[] {
  const normalizedValue = normalizeComparableValue(value);

  if (!normalizedValue) {
    return [];
  }

  return (normalizedValue.match(/\d+/g) ?? []).map((part) => Number.parseInt(part, 10));
}

function compareVersionLike(currentVersion?: string | number | null, latestVersion?: string | number | null): number {
  const currentParts = extractVersionParts(currentVersion);
  const latestParts = extractVersionParts(latestVersion);

  if (!currentParts.length || !latestParts.length) {
    return 0;
  }

  const length = Math.max(currentParts.length, latestParts.length);

  for (let index = 0; index < length; index++) {
    const currentPart = currentParts[index] ?? 0;
    const latestPart = latestParts[index] ?? 0;

    if (latestPart > currentPart) return 1;
    if (latestPart < currentPart) return -1;
  }

  return 0;
}

async function fetchPgyerLatest(appKey: string, shortcut: string): Promise<PgyerAppData> {
  const params = new URLSearchParams({ _api_key: getRequiredEnv('PGYER_API_KEY') });
  params.set(appKey ? 'appKey' : 'buildShortcutUrl', appKey || shortcut);
  const endpoint = appKey ? 'view' : 'getByShortcut';
  const response = await fetch(`${PGYER_API_BASE_URL}/app/${endpoint}`, {
    body: params,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });
  const payload = (await response.json().catch(() => ({}))) as PgyerApiResponse<PgyerAppData>;

  if (!response.ok || payload.code !== 0 || !payload.data) {
    throw new Error(payload.message || `Pgyer request failed: HTTP ${response.status}`);
  }

  return payload.data;
}

type DirectDownloadResult = {
  downloadUrl?: string;
  errorMessage?: string;
};

async function fetchPgyerDownloadUrl(buildKey: string): Promise<DirectDownloadResult> {
  const response = await fetch(`${PGYER_API_BASE_URL}/app/getDownUrl`, {
    body: new URLSearchParams({
      _api_key: getRequiredEnv('PGYER_API_KEY'),
      buildKey,
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });
  const payload = (await response.json().catch(() => ({}))) as PgyerApiResponse<PgyerDownloadUrlData>;

  if (!response.ok || payload.code !== 0 || !payload.data?.downloadUrl) {
    const errorMessage =
      payload.message?.trim() ||
      `HTTP ${response.status} (code=${payload.code ?? 'n/a'})`;

    logger.warn('fetch_direct_download_url_failed', { errorMessage });
    return { errorMessage };
  }

  return { downloadUrl: payload.data.downloadUrl };
}

function createUpdateStatus(
  input: PgyerUpdateCheckRequestBody,
  latest: PgyerAppData,
  direct: DirectDownloadResult,
  updateUrl: string,
) {
  const currentBuildNumber = normalizeComparableValue(input.currentBuildNumber);
  const currentVersion = normalizeComparableValue(input.currentVersion);
  const latestBuildNumber = normalizeComparableValue(latest.buildVersionNo);
  const latestVersion = normalizeComparableValue(latest.buildVersion);
  const hasBuildNumberSignal = Boolean(currentBuildNumber && latestBuildNumber);
  const inferredHasUpdate = hasBuildNumberSignal
    ? compareVersionLike(currentBuildNumber, latestBuildNumber) > 0
    : compareVersionLike(currentVersion, latestVersion) > 0;

  return {
    downloadUrl: direct.downloadUrl,
    downloadUrlError: direct.errorMessage,
    hasUpdate: latest.buildHaveNewVersion ?? inferredHasUpdate,
    latestBuildNumber: latestBuildNumber || undefined,
    latestVersion: latestVersion || undefined,
    ok: true,
    releaseNotes: normalizeComparableValue(latest.buildUpdateDescription) || undefined,
    updateUrl,
  };
}

Deno.serve(withSentry(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as PgyerUpdateCheckRequestBody;
    const appKey = normalizeComparableValue(Deno.env.get('PGYER_APP_KEY'));
    const shortcut = normalizeComparableValue(Deno.env.get('PGYER_APP_SHORTCUT'));
    if (!appKey && !shortcut) {
      return jsonResponse({ hasUpdate: false, ok: true, updateUrl: PUBLIC_RELEASES_URL });
    }
    const latest = await fetchPgyerLatest(appKey, shortcut);

    const direct: DirectDownloadResult = latest.buildKey
      ? await fetchPgyerDownloadUrl(latest.buildKey)
      : { errorMessage: 'buildKey missing in latest app response' };

    const publishedShortcut = normalizeComparableValue(latest.buildShortcutUrl) || shortcut;
    const updateUrl = publishedShortcut
      ? `${PGYER_HOME_URL}/${publishedShortcut.replace(/^\/+/, '')}`
      : PUBLIC_RELEASES_URL;
    return jsonResponse(createUpdateStatus(body, latest, direct, updateUrl));
  } catch (error) {
    logger.error('pgyer_update_check_failed', error);

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Pgyer update check failed.',
      },
      500,
    );
  }
}, 'pgyer-update-check'));
