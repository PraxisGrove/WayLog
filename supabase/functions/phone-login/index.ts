import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  normalizeMainlandPhone,
  verifyAliyunSmsCode,
} from '../_shared/aliyun-sms.ts';

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

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  });
}

function maskPhone(phone: string): string {
  return `${phone.slice(0, 6)}****${phone.slice(-4)}`;
}

function createInternalEmail(): string {
  return `phone-${crypto.randomUUID()}@accounts.waylog.invalid`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const { phone, code } = (await request.json()) as {
      code?: string;
      phone?: string;
    };
    const normalizedPhone = normalizeMainlandPhone(phone?.trim() ?? '');

    await verifyAliyunSmsCode(normalizedPhone, code?.trim() ?? '');

    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
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

    let userId = identity?.user_id as string | undefined;
    let isNewUser = false;
    let loginEmail = '';
    const displayName = maskPhone(normalizedPhone);

    if (userId) {
      const { data, error } = await supabase.auth.admin.getUserById(userId);

      if (error || !data.user) {
        throw error ?? new Error('手机号绑定的账号不存在');
      }

      loginEmail = data.user.email?.trim() ?? '';

      if (!loginEmail) {
        loginEmail = createInternalEmail();
        const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
          email: loginEmail,
          email_confirm: true,
          phone: normalizedPhone,
          phone_confirm: true,
        });

        if (updateError) {
          throw updateError;
        }
      }
    } else {
      isNewUser = true;
      loginEmail = createInternalEmail();
      const { data, error } = await supabase.auth.admin.createUser({
        email: loginEmail,
        email_confirm: true,
        phone: normalizedPhone,
        phone_confirm: true,
        user_metadata: {
          display_name: displayName,
        },
      });

      if (error || !data.user) {
        throw error ?? new Error('创建手机号账号失败');
      }

      userId = data.user.id;

      const { error: insertIdentityError } = await supabase
        .from('user_identities')
        .insert({
          display_name: displayName,
          provider: 'sms_phone',
          provider_uid: normalizedPhone,
          user_id: userId,
        });

      if (insertIdentityError) {
        await supabase.auth.admin.deleteUser(userId);
        throw insertIdentityError;
      }

      const { error: profileError } = await supabase.from('profiles').upsert({
        display_name: displayName,
        id: userId,
      });

      if (profileError) {
        throw profileError;
      }
    }

    const { data: authLink, error: authLinkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: loginEmail,
      options: {
        data: {
          display_name: displayName,
          phone: normalizedPhone,
        },
      },
    });

    if (authLinkError) {
      throw authLinkError;
    }

    return jsonResponse({
      isNewUser,
      token_hash: authLink.properties.hashed_token,
      type: 'magiclink',
      user_hint: {
        id: userId,
        phone: normalizedPhone,
        user_metadata: {
          display_name: displayName,
        },
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : '手机号登录失败',
      },
      400,
    );
  }
});
