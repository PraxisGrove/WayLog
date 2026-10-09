import { createClient } from '@supabase/supabase-js';

type WechatAccessTokenResponse = {
  access_token?: string;
  errcode?: number;
  errmsg?: string;
  openid?: string;
  refresh_token?: string;
  scope?: string;
  unionid?: string;
};

type WechatUserInfoResponse = {
  city?: string;
  country?: string;
  errcode?: number;
  errmsg?: string;
  headimgurl?: string;
  nickname?: string;
  openid?: string;
  privilege?: string[];
  province?: string;
  sex?: number;
  unionid?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
};

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

async function fetchWechatJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = (await response.json()) as T & {
    errcode?: number;
    errmsg?: string;
  };

  if (!response.ok || payload.errcode) {
    throw new Error(payload.errmsg ?? 'WeChat request failed.');
  }

  return payload;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing authorization header.' }, 401);
    }

    const accessToken = authHeader.replace('Bearer ', '');

    const { code } = (await request.json()) as { code?: string };
    const normalizedCode = code?.trim();

    if (!normalizedCode) {
      return jsonResponse({ error: 'Missing WeChat authorization code.' }, 400);
    }

    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const wechatAppId = getRequiredEnv('WECHAT_APP_ID');
    const wechatAppSecret = getRequiredEnv('WECHAT_APP_SECRET');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !currentUser) {
      return jsonResponse({ error: 'Invalid access token.' }, 401);
    }

    const currentUserId = currentUser.id;

    const tokenParams = new URLSearchParams({
      appid: wechatAppId,
      secret: wechatAppSecret,
      code: normalizedCode,
      grant_type: 'authorization_code',
    });
    const token = await fetchWechatJson<WechatAccessTokenResponse>(
      `https://api.weixin.qq.com/sns/oauth2/access_token?${tokenParams.toString()}`,
    );
    const openid = token.openid?.trim();

    if (!openid || !token.access_token) {
      return jsonResponse({ error: 'WeChat did not return openid or access token.' }, 502);
    }

    const userParams = new URLSearchParams({
      access_token: token.access_token,
      openid,
      lang: 'zh_CN',
    });
    const userInfo = await fetchWechatJson<WechatUserInfoResponse>(
      `https://api.weixin.qq.com/sns/userinfo?${userParams.toString()}`,
    );
    const providerUid = userInfo.unionid?.trim() || openid;
    const displayName = userInfo.nickname?.trim() || '微信旅行者';

    const identityQuery = await supabase
      .from('user_identities')
      .select('user_id, display_name, avatar_url')
      .eq('provider', 'wechat')
      .eq('provider_uid', providerUid)
      .maybeSingle();

    if (identityQuery.error) {
      throw identityQuery.error;
    }

    if (identityQuery.data) {
      const conflictUserId = identityQuery.data.user_id;

      if (conflictUserId === currentUserId) {
        return jsonResponse({ success: true, provider_uid: providerUid, already_bound: true });
      }

      return jsonResponse({
        conflict: true,
        conflict_user_id: conflictUserId,
        provider_uid: providerUid,
        display_name: identityQuery.data.display_name ?? displayName,
        avatar_url: identityQuery.data.avatar_url ?? userInfo.headimgurl,
      });
    }

    const insertIdentity = await supabase.from('user_identities').insert({
      avatar_url: userInfo.headimgurl,
      display_name: displayName,
      provider: 'wechat',
      provider_uid: providerUid,
      union_id: userInfo.unionid,
      user_id: currentUserId,
    });

    if (insertIdentity.error) {
      throw insertIdentity.error;
    }

    await supabase.auth.admin.updateUserById(currentUserId, {
      user_metadata: {
        wechat_openid: openid,
        wechat_unionid: userInfo.unionid,
      },
    });

    return jsonResponse({ success: true, provider_uid: providerUid });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Bind WeChat failed.',
      },
      500,
    );
  }
});
