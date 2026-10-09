type AmapProxyRequestBody = {
  params?: Record<string, unknown>;
  path?: string;
};

import {
  isAmapJsonSuccessPayload,
  shouldFallbackToBackupKey,
} from '../../../features/trips/amap-failover.ts';

const AMAP_BASE_URL = 'https://restapi.amap.com';

const AMAP_STATIC_MAP_PATH = '/v3/staticmap';

const JSON_ENDPOINTS = new Set([
  '/v3/direction/driving',
  '/v3/direction/transit/integrated',
  '/v3/direction/walking',
  '/v3/geocode/regeo',
  '/v3/place/around',
  '/v3/place/text',
  '/v3/weather/weatherInfo',
  '/v4/direction/bicycling',
  '/v5/aoi/polyline',
  '/v5/place/around',
  '/v5/place/detail',
  '/v5/place/text',
]);

const STATIC_MAP_ALLOWED_PARAMS = new Set(['location', 'markers', 'paths', 'size', 'zoom']);

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function getAmapWebServiceKeys(): string[] {
  const keys = [
    Deno.env.get('AMAP_WEB_SERVICE_KEY')?.trim(),
    Deno.env.get('AMAP_WEB_SERVICE_KEY_BACKUP')?.trim(),
  ].filter((key): key is string => Boolean(key));

  if (keys.length === 0) {
    throw new Error('Missing AMAP_WEB_SERVICE_KEY');
  }

  return keys;
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

function getStringRecord(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const params: Record<string, string> = {};

  Object.entries(value as Record<string, unknown>).forEach(([name, rawValue]) => {
    if (typeof rawValue === 'string' && rawValue.trim()) {
      params[name] = rawValue.trim();
    }
  });

  return params;
}

function createAmapUrl(path: string, params: Record<string, string>, options: { key: string; outputJson: boolean }) {
  const searchParams = new URLSearchParams({
    key: options.key,
  });

  if (options.outputJson) {
    searchParams.set('output', 'json');
  }

  Object.entries(params).forEach(([name, value]) => {
    if (name !== 'key') {
      searchParams.set(name, value);
    }
  });

  return `${AMAP_BASE_URL}${path}?${searchParams.toString()}`;
}

async function handleJsonProxy(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AmapProxyRequestBody;
  const path = body.path?.trim();

  if (!path || !JSON_ENDPOINTS.has(path)) {
    return jsonResponse({ error: 'Unsupported Amap endpoint.' }, 400);
  }

  const keys = getAmapWebServiceKeys();
  const params = getStringRecord(body.params);
  let lastResponse: Response | undefined;
  let lastPayload = '';

  for (let i = 0; i < keys.length; i++) {
    try {
      const response = await fetch(createAmapUrl(path, params, { key: keys[i], outputJson: true }), {
        headers: {
          Accept: 'application/json',
        },
      });
      const payload = await response.text();
      lastResponse = response;
      lastPayload = payload;

      if (isAmapJsonSuccessPayload(payload) || i === keys.length - 1) {
        return new Response(payload, {
          headers: {
            ...corsHeaders,
            'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
          },
          status: response.status,
        });
      }

      if (shouldFallbackToBackupKey({ hasMoreKeys: i < keys.length - 1, payload })) {
        continue;
      }

      return new Response(payload, {
        headers: {
          ...corsHeaders,
          'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
        },
        status: response.status,
      });
    } catch (error) {
      lastResponse = new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Amap request failed.',
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          status: 502,
        },
      );
      lastPayload = await lastResponse.text();

      if (shouldFallbackToBackupKey({ error, hasMoreKeys: i < keys.length - 1 })) {
        continue;
      }
    }
  }

  if (lastResponse) {
    return new Response(lastPayload, {
      headers: {
        ...corsHeaders,
        'Content-Type': lastResponse.headers.get('Content-Type') ?? 'application/json',
      },
      status: lastResponse.status,
    });
  }

  return jsonResponse({ error: 'All Amap API keys exhausted.' }, 429);
}

async function handleStaticMapProxy(request: Request) {
  const requestUrl = new URL(request.url);
  const params: Record<string, string> = {};

  requestUrl.searchParams.forEach((value, name) => {
    if (STATIC_MAP_ALLOWED_PARAMS.has(name) && value.trim()) {
      params[name] = value.trim();
    }
  });

  if (!params.location && !params.markers && !params.paths) {
    return jsonResponse({ error: 'Missing static map location, markers, or paths.' }, 400);
  }

  const keys = getAmapWebServiceKeys();
  let lastStatus = 502;
  let lastError = 'Amap static map request failed.';

  for (let i = 0; i < keys.length; i++) {
    try {
      const response = await fetch(createAmapUrl(AMAP_STATIC_MAP_PATH, params, { key: keys[i], outputJson: false }));

      if (response.ok) {
        return new Response(response.body, {
          headers: {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=86400',
            'Content-Type': response.headers.get('Content-Type') ?? 'image/png',
          },
          status: response.status,
        });
      }

      lastStatus = response.status;
      lastError = `Amap static map request failed: HTTP ${response.status}`;

      if (i < keys.length - 1) {
        continue;
      }
    } catch (error) {
      lastStatus = 502;
      lastError = error instanceof Error ? error.message : 'Amap static map request failed.';

      if (i < keys.length - 1) {
        continue;
      }
    }
  }

  return jsonResponse({ error: lastError }, lastStatus);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestUrl = new URL(request.url);

    if (requestUrl.pathname.endsWith('/static-map')) {
      if (request.method !== 'GET') {
        return jsonResponse({ error: 'Method not allowed.' }, 405);
      }

      return await handleStaticMapProxy(request);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed.' }, 405);
    }

    return await handleJsonProxy(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Amap proxy request failed.';

    return jsonResponse({ error: message }, 500);
  }
});
