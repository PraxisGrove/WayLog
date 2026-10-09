import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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

    const { emailAccessToken } = (await request.json()) as {
      emailAccessToken?: string;
    };

    if (!emailAccessToken) {
      return jsonResponse({ error: '缺少邮箱验证凭证' }, 400);
    }

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
    const currentAccessToken = authHeader.slice('Bearer '.length);
    const [currentResult, emailResult] = await Promise.all([
      supabase.auth.getUser(currentAccessToken),
      supabase.auth.getUser(emailAccessToken),
    ]);
    const currentUser = currentResult.data.user;
    const emailUser = emailResult.data.user;
    const normalizedEmail = emailUser?.email?.trim().toLowerCase();

    if (currentResult.error || !currentUser) {
      return jsonResponse({ error: '当前账号认证失败' }, 401);
    }

    if (emailResult.error || !emailUser || !normalizedEmail) {
      return jsonResponse({ error: '邮箱验证码无效或已过期' }, 401);
    }

    if (emailUser.id !== currentUser.id) {
      const { data: conflictUser } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', emailUser.id)
        .maybeSingle();
      const mergeToken = await createMergeToken(
        {
          primaryId: currentUser.id,
          provider: 'email',
          providerUid: normalizedEmail,
          secondaryId: emailUser.id,
        },
        serviceRoleKey,
      );

      return jsonResponse({
        conflict: true,
        conflict_user_id: emailUser.id,
        display_name: conflictUser?.display_name || '邮箱账号',
        merge_token: mergeToken,
      });
    }

    return jsonResponse({
      success: true,
      already_bound: true,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : '绑定邮箱失败',
      },
      400,
    );
  }
});
