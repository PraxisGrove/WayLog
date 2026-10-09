const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const CACHE_EXPIRY_SECONDS = 3600;

function getSecurityCodes(): { primary: string; backup?: string } {
  const primary = Deno.env.get('AMAP_JS_SECURITY_CODE')?.trim();

  if (!primary) {
    throw new Error('Missing AMAP_JS_SECURITY_CODE environment variable');
  }

  const backup = Deno.env.get('AMAP_JS_SECURITY_CODE_BACKUP')?.trim() || undefined;

  return { primary, backup };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_EXPIRY_SECONDS}`,
    },
    status,
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const { primary, backup } = getSecurityCodes();

    const responseBody: Record<string, unknown> = {
      securityCode: primary,
      expiresIn: CACHE_EXPIRY_SECONDS,
    };

    if (backup) {
      responseBody.backupSecurityCode = backup;
    }

    return jsonResponse(responseBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get security code.';

    return jsonResponse({ error: message }, 500);
  }
});
