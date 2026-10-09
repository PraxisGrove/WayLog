import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createServerLogger, withSentry } from '../_shared/sentry.ts';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
};

const CONFIRM_TEXT = '我确认要注销';
const logger = createServerLogger('delete-account');

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

Deno.serve(withSentry(async (request) => {
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

    const { confirmText } = (await request.json()) as { confirmText?: string };
    const normalizedConfirmText = confirmText?.trim();

    if (normalizedConfirmText !== CONFIRM_TEXT) {
      return jsonResponse(
        { error: `请输入"${CONFIRM_TEXT}"以确认注销。` },
        400,
      );
    }

    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
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

    const userId = currentUser.id;

    const { error: tripsError } = await supabase
      .from('user_trips')
      .delete()
      .eq('user_id', userId);

    if (tripsError) {
      logger.error('delete_user_trips_failed', tripsError, { userId });
      throw new Error('删除行程数据失败');
    }

    const { error: favoritesError } = await supabase
      .from('user_favorite_places')
      .delete()
      .eq('user_id', userId);

    if (favoritesError) {
      logger.error('delete_favorite_places_failed', favoritesError, { userId });
      throw new Error('删除收藏地点失败');
    }

    const { error: prefsError } = await supabase
      .from('user_preferences')
      .delete()
      .eq('user_id', userId);

    if (prefsError) {
      logger.error('delete_preferences_failed', prefsError, { userId });
      throw new Error('删除偏好设置失败');
    }

    const { error: identitiesError } = await supabase
      .from('user_identities')
      .delete()
      .eq('user_id', userId);

    if (identitiesError) {
      logger.error('delete_auth_identities_failed', identitiesError, { userId });
      throw new Error('删除身份绑定记录失败');
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      logger.error('delete_profile_failed', profileError, { userId });
      throw new Error('删除用户资料失败');
    }

    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      logger.error('delete_auth_user_failed', deleteUserError, { userId });
      throw new Error('删除认证账号失败');
    }

    return jsonResponse({ success: true });
  } catch (error) {
    logger.error('delete_account_failed', error);

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : '账号注销失败，请稍后再试。',
      },
      500,
    );
  }
}, 'delete-account'));
