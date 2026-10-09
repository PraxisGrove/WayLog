import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  normalizeMainlandPhone,
  verifyAliyunSmsCode,
} from '../_shared/aliyun-sms.ts';
import { createMergeToken } from '../_shared/merge-token.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: '缺少认证信息' }, 401);
    }

    const { phone, code } = (await request.json()) as {
      code?: string;
      phone?: string;
    };
    const normalizedPhone = normalizeMainlandPhone(phone?.trim() ?? '');

    await verifyAliyunSmsCode(normalizedPhone, code?.trim() ?? '');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('缺少 Supabase 配置');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const accessToken = authHeader.slice('Bearer '.length);
    const { data: currentAuth, error: currentUserError } = await supabase.auth.getUser(accessToken);

    if (currentUserError || !currentAuth.user) {
      return jsonResponse({ error: '认证失败' }, 401);
    }

    const currentUserId = currentAuth.user.id;
    const { data: existingIdentity, error: queryError } = await supabase
      .from('user_identities')
      .select('user_id')
      .in('provider', ['sms_phone', 'phone'])
      .eq('provider_uid', normalizedPhone)
      .maybeSingle();

    if (queryError) {
      throw queryError;
    }

    if (existingIdentity && existingIdentity.user_id !== currentUserId) {
      const { data: conflictUser } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', existingIdentity.user_id)
        .maybeSingle();
      const mergeToken = await createMergeToken(
        {
          primaryId: currentUserId,
          provider: 'phone',
          providerUid: normalizedPhone,
          secondaryId: existingIdentity.user_id,
        },
        serviceRoleKey,
      );

      return jsonResponse({
        conflict: true,
        conflict_user_id: existingIdentity.user_id,
        display_name: conflictUser?.display_name || '另一个账号',
        merge_token: mergeToken,
      });
    }

    if (existingIdentity?.user_id === currentUserId) {
      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(
        currentUserId,
        {
          phone: normalizedPhone,
          phone_confirm: true,
        },
      );

      if (updateAuthError) {
        throw updateAuthError;
      }

      return jsonResponse({
        success: true,
        already_bound: true,
      });
    }

    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(
      currentUserId,
      {
        phone: normalizedPhone,
        phone_confirm: true,
      },
    );

    if (updateAuthError) {
      throw updateAuthError;
    }

    const { error: insertError } = await supabase
      .from('user_identities')
      .upsert(
        {
          provider: 'sms_phone',
          provider_uid: normalizedPhone,
          user_id: currentUserId,
        },
        { onConflict: 'provider,provider_uid' },
      );

    if (insertError) {
      throw insertError;
    }

    return jsonResponse({
      success: true,
      already_bound: false,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : '绑定手机号失败',
      },
      400,
    );
  }
});
