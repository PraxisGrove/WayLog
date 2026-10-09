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

type WechatIdentityRow = {
  provider_uid: string;
  user_id: string;
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

function createInternalEmail(): string {
  return `wechat-${crypto.randomUUID()}@accounts.waylog.invalid`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
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

    const unionid = userInfo.unionid?.trim() || token.unionid?.trim();
    const providerUid = unionid || openid;
    const candidateProviderUids = [...new Set([providerUid, openid])];
    const displayName = userInfo.nickname?.trim() || '微信旅行者';
    const avatarUrl = userInfo.headimgurl?.trim() || null;
    const { data: identities, error: identityError } = await supabase
      .from('user_identities')
      .select('user_id, provider_uid')
      .eq('provider', 'wechat')
      .in('provider_uid', candidateProviderUids);

    if (identityError) {
      throw identityError;
    }

    const identityRows = (identities ?? []) as WechatIdentityRow[];
    const matchedUserIds = [...new Set(identityRows.map((identity) => identity.user_id))];

    if (matchedUserIds.length > 1) {
      throw new Error('WeChat identity is linked to multiple users.');
    }

    let userId = matchedUserIds[0];
    let isNewUser = false;
    let loginEmail = '';

    if (userId) {
      const { data, error } = await supabase.auth.admin.getUserById(userId);

      if (error || !data.user) {
        throw error ?? new Error('WeChat account does not exist.');
      }

      loginEmail = data.user.email?.trim() ?? '';

      if (!loginEmail) {
        loginEmail = createInternalEmail();
        const { error: updateUserError } = await supabase.auth.admin.updateUserById(userId, {
          email: loginEmail,
          email_confirm: true,
        });

        if (updateUserError) {
          throw updateUserError;
        }
      }

      const hasPrimaryIdentity = identityRows.some(
        (identity) => identity.provider_uid === providerUid,
      );
      const legacyIdentity = hasPrimaryIdentity
        ? undefined
        : identityRows.find((identity) => identity.provider_uid !== providerUid);

      if (legacyIdentity) {
        const { error: updateIdentityError } = await supabase
          .from('user_identities')
          .update({
            provider_uid: providerUid,
            union_id: unionid ?? null,
          })
          .eq('provider', 'wechat')
          .eq('user_id', userId)
          .eq('provider_uid', legacyIdentity.provider_uid);

        if (updateIdentityError) {
          throw updateIdentityError;
        }
      }
    } else {
      isNewUser = true;
      loginEmail = createInternalEmail();
      const { data, error } = await supabase.auth.admin.createUser({
        email: loginEmail,
        email_confirm: true,
        user_metadata: {
          avatar_url: avatarUrl,
          display_name: displayName,
          wechat_openid: openid,
          wechat_unionid: unionid,
        },
      });

      if (error || !data.user) {
        throw error ?? new Error('Failed to create WeChat user.');
      }

      userId = data.user.id;

      const { error: insertIdentityError } = await supabase
        .from('user_identities')
        .insert({
          display_name: displayName,
          provider: 'wechat',
          provider_uid: providerUid,
          union_id: unionid ?? null,
          user_id: userId,
        });

      if (insertIdentityError) {
        await supabase.auth.admin.deleteUser(userId);
        throw insertIdentityError;
      }

      const { error: profileError } = await supabase.from('profiles').upsert({
        avatar_url: avatarUrl,
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
          avatar_url: avatarUrl,
          display_name: displayName,
          wechat_openid: openid,
          wechat_unionid: unionid,
        },
      },
    });

    if (authLinkError) {
      throw authLinkError;
    }

    return jsonResponse({
      avatar_url: avatarUrl,
      isNewUser,
      nickname: displayName,
      openid,
      success: true,
      token_hash: authLink.properties.hashed_token,
      type: 'magiclink',
      unionid: unionid || null,
      userId,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : 'WeChat login failed.',
      },
      500,
    );
  }
});
