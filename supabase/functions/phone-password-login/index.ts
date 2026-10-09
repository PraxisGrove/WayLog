import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeMainlandPhone } from '../_shared/aliyun-sms.ts';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
};

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();

  return value || undefined;
}

function readFirstSecretFromJsonMap(name: string): string | undefined {
  const rawValue = getOptionalEnv(name);

  if (!rawValue) {
    return undefined;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Record<string, unknown>;
    const defaultValue = parsedValue.default;

    if (typeof defaultValue === 'string' && defaultValue.trim()) {
      return defaultValue.trim();
    }

    for (const value of Object.values(parsedValue)) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function getSupabaseServiceKey(): string {
  const serviceRoleKey =
    getOptionalEnv('SUPABASE_SERVICE_ROLE_KEY') ??
    getOptionalEnv('SUPABASE_SECRET_KEY') ??
    readFirstSecretFromJsonMap('SUPABASE_SECRET_KEYS');

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }

  return serviceRoleKey;
}

function getSupabasePublicKey(): string {
  const publicKey =
    getOptionalEnv('SUPABASE_ANON_KEY') ??
    getOptionalEnv('SUPABASE_PUBLISHABLE_KEY') ??
    readFirstSecretFromJsonMap('SUPABASE_PUBLISHABLE_KEYS');

  if (!publicKey) {
    throw new Error('Missing SUPABASE_ANON_KEY');
  }

  return publicKey;
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

function invalidCredentialsResponse() {
  return jsonResponse({ error: 'Invalid login credentials' }, 400);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const { phone, password } = (await request.json()) as {
      password?: string;
      phone?: string;
    };
    const normalizedPhone = normalizeMainlandPhone(phone?.trim() ?? '');
    const normalizedPassword = password?.trim() ?? '';

    if (normalizedPassword.length < 8) {
      return invalidCredentialsResponse();
    }

    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const serviceRoleKey = getSupabaseServiceKey();
    const publicKey = getSupabasePublicKey();
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { data: identity, error: identityError } = await supabase
      .from('user_identities')
      .select('user_id')
      .in('provider', ['sms_phone', 'phone'])
      .eq('provider_uid', normalizedPhone)
      .maybeSingle();

    if (identityError) {
      throw identityError;
    }

    if (!identity?.user_id) {
      return invalidCredentialsResponse();
    }

    const { data: authUser, error: authUserError } =
      await supabase.auth.admin.getUserById(identity.user_id);
    const loginEmail = authUser.user?.email?.trim();

    if (authUserError || !authUser.user || !loginEmail) {
      return invalidCredentialsResponse();
    }

    const authResponse = await fetch(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        body: JSON.stringify({
          email: loginEmail,
          password: normalizedPassword,
        }),
        headers: {
          apikey: publicKey,
          Authorization: `Bearer ${publicKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
    const payload = (await authResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!authResponse.ok) {
      return jsonResponse(payload, authResponse.status);
    }

    return jsonResponse(payload);
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : '手机号密码登录失败',
      },
      400,
    );
  }
});
