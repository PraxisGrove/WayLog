import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerLogger, withSentry } from '../_shared/sentry.ts';
import { verifyMergeToken } from '../_shared/merge-token.ts';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
};

const logger = createServerLogger('merge-accounts');

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

async function migrateIdentities(
  supabase: SupabaseClient,
  primaryId: string,
  secondaryId: string,
) {
  const { data: identities, error } = await supabase
    .from('user_identities')
    .select('*')
    .eq('user_id', secondaryId);

  if (error) {
    throw new Error(`Failed to fetch identities: ${error.message}`);
  }

  if (!identities || identities.length === 0) {
    return;
  }

  for (const identity of identities) {
    const { data: existing } = await supabase
      .from('user_identities')
      .select('id')
      .eq('user_id', primaryId)
      .eq('provider', identity.provider)
      .eq('provider_uid', identity.provider_uid)
      .maybeSingle();

    if (existing) {
      continue;
    }

    const { error: updateError } = await supabase
      .from('user_identities')
      .update({ user_id: primaryId })
      .eq('id', identity.id);

    if (updateError) {
      throw new Error(`Failed to migrate identity ${identity.id}: ${updateError.message}`);
    }
  }
}

async function migrateTrips(
  supabase: SupabaseClient,
  primaryId: string,
  secondaryId: string,
) {
  const [{ data: primaryTrips, error: primaryError }, { data: secondaryTrips, error: secondaryError }] =
    await Promise.all([
      supabase.from('user_trips').select('id').eq('user_id', primaryId),
      supabase.from('user_trips').select('id').eq('user_id', secondaryId),
    ]);

  if (primaryError || secondaryError) {
    throw new Error(`Failed to inspect trips: ${primaryError?.message ?? secondaryError?.message}`);
  }

  const primaryIds = new Set((primaryTrips ?? []).map((trip) => trip.id));
  const duplicateIds = (secondaryTrips ?? [])
    .map((trip) => trip.id)
    .filter((id) => primaryIds.has(id));

  if (duplicateIds.length > 0) {
    const { error: duplicateDeleteError } = await supabase
      .from('user_trips')
      .delete()
      .eq('user_id', secondaryId)
      .in('id', duplicateIds);

    if (duplicateDeleteError) {
      throw new Error(`Failed to remove duplicate trips: ${duplicateDeleteError.message}`);
    }
  }

  const { error } = await supabase
    .from('user_trips')
    .update({ user_id: primaryId })
    .eq('user_id', secondaryId);

  if (error) {
    throw new Error(`Failed to migrate trips: ${error.message}`);
  }
}

async function migrateFavoritePlaces(
  supabase: SupabaseClient,
  primaryId: string,
  secondaryId: string,
) {
  const { data: favorites, error } = await supabase
    .from('user_favorite_places')
    .select('*')
    .eq('user_id', secondaryId);

  if (error) {
    throw new Error(`Failed to fetch favorites: ${error.message}`);
  }

  if (!favorites || favorites.length === 0) {
    return;
  }

  for (const fav of favorites) {
    const { data: existing } = await supabase
      .from('user_favorite_places')
      .select('user_id')
      .eq('user_id', primaryId)
      .eq('id', fav.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('user_favorite_places')
        .delete()
        .eq('user_id', secondaryId)
        .eq('id', fav.id);
    } else {
      const { error: updateError } = await supabase
        .from('user_favorite_places')
        .update({ user_id: primaryId })
        .eq('user_id', secondaryId)
        .eq('id', fav.id);

      if (updateError) {
        throw new Error(`Failed to migrate favorite ${fav.id}: ${updateError.message}`);
      }
    }
  }
}

async function mergeProfiles(
  supabase: SupabaseClient,
  primaryId: string,
  secondaryId: string,
) {
  const [primaryResult, secondaryResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', primaryId).single(),
    supabase.from('profiles').select('*').eq('id', secondaryId).single(),
  ]);

  const primaryProfile = primaryResult.data;
  const secondaryProfile = secondaryResult.data;

  if (!primaryProfile || !secondaryProfile) {
    return;
  }

  const mergedProfile: Record<string, unknown> = {};

  if (!primaryProfile.display_name && secondaryProfile.display_name) {
    mergedProfile.display_name = secondaryProfile.display_name;
  }

  if (!primaryProfile.avatar_url && secondaryProfile.avatar_url) {
    mergedProfile.avatar_url = secondaryProfile.avatar_url;
  }

  if (!primaryProfile.bio && secondaryProfile.bio) {
    mergedProfile.bio = secondaryProfile.bio;
  }

  if (!primaryProfile.home_city && secondaryProfile.home_city) {
    mergedProfile.home_city = secondaryProfile.home_city;
  }

  if (Object.keys(mergedProfile).length > 0) {
    mergedProfile.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('profiles')
      .update(mergedProfile)
      .eq('id', primaryId);

    if (error) {
      throw new Error(`Failed to merge profiles: ${error.message}`);
    }
  }
}

async function migratePreferences(
  supabase: SupabaseClient,
  primaryId: string,
  secondaryId: string,
  preferenceKey: string,
) {
  const { data: secondaryPref, error: fetchError } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', secondaryId)
    .eq('preference_key', preferenceKey)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch ${preferenceKey} preference: ${fetchError.message}`);
  }

  if (!secondaryPref) {
    return;
  }

  const { data: primaryPref } = await supabase
    .from('user_preferences')
    .select('user_id')
    .eq('user_id', primaryId)
    .eq('preference_key', preferenceKey)
    .maybeSingle();

  if (primaryPref) {
    await supabase
      .from('user_preferences')
      .delete()
      .eq('user_id', secondaryId)
      .eq('preference_key', preferenceKey);
  } else {
    const { error } = await supabase
      .from('user_preferences')
      .update({ user_id: primaryId })
      .eq('user_id', secondaryId)
      .eq('preference_key', preferenceKey);

    if (error) {
      throw new Error(`Failed to migrate ${preferenceKey} preference: ${error.message}`);
    }
  }
}

async function deleteSecondaryAccount(
  supabase: SupabaseClient,
  secondaryId: string,
) {
  const { error } = await supabase.auth.admin.deleteUser(secondaryId);

  if (error) {
    throw new Error(`Failed to delete secondary account: ${error.message}`);
  }
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

    const { primary_id, secondary_id, merge_token } = (await request.json()) as {
      merge_token?: string;
      primary_id?: string;
      secondary_id?: string;
    };

    if (!primary_id || !secondary_id || !merge_token) {
      return jsonResponse({ error: 'Missing merge account parameters.' }, 400);
    }

    if (primary_id === secondary_id) {
      return jsonResponse({ error: 'Cannot merge account with itself.' }, 400);
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

    if (currentUser.id !== primary_id) {
      return jsonResponse({ error: 'You can only merge into your own account.' }, 403);
    }

    const mergeProof = await verifyMergeToken(merge_token, serviceRoleKey);

    if (
      mergeProof.primaryId !== primary_id ||
      mergeProof.secondaryId !== secondary_id
    ) {
      return jsonResponse({ error: 'Merge proof does not match these accounts.' }, 403);
    }

    const { data: secondaryUser, error: secondaryError } = await supabase.auth.admin.getUserById(secondary_id);

    if (secondaryError || !secondaryUser.user) {
      return jsonResponse({ error: 'Secondary account not found.' }, 404);
    }

    logger.info('merge_started', { primaryId: primary_id, secondaryId: secondary_id });

    await migrateIdentities(supabase, primary_id, secondary_id);
    logger.info('identities_migrated', { primaryId: primary_id, secondaryId: secondary_id });

    await migrateTrips(supabase, primary_id, secondary_id);
    logger.info('trips_migrated', { primaryId: primary_id, secondaryId: secondary_id });

    await migrateFavoritePlaces(supabase, primary_id, secondary_id);
    logger.info('favorite_places_migrated', { primaryId: primary_id, secondaryId: secondary_id });

    await mergeProfiles(supabase, primary_id, secondary_id);
    logger.info('profiles_merged', { primaryId: primary_id, secondaryId: secondary_id });

    await migratePreferences(supabase, primary_id, secondary_id, 'route');
    logger.info('route_preferences_migrated', { primaryId: primary_id, secondaryId: secondary_id });

    await migratePreferences(supabase, primary_id, secondary_id, 'expense');
    logger.info('expense_preferences_migrated', { primaryId: primary_id, secondaryId: secondary_id });

    await deleteSecondaryAccount(supabase, secondary_id);
    logger.info('secondary_account_deleted', { primaryId: primary_id, secondaryId: secondary_id });

    const credentialPatch = mergeProof.provider === 'email'
      ? {
          email: mergeProof.providerUid,
          email_confirm: true,
        }
      : {
          phone: mergeProof.providerUid,
          phone_confirm: true,
        };
    const { error: credentialError } = await supabase.auth.admin.updateUserById(
      primary_id,
      credentialPatch,
    );

    if (credentialError) {
      throw new Error(`Failed to update primary login credential: ${credentialError.message}`);
    }

    if (mergeProof.provider === 'phone') {
      const { error: identityError } = await supabase
        .from('user_identities')
        .upsert(
          {
            provider: 'sms_phone',
            provider_uid: mergeProof.providerUid,
            user_id: primary_id,
          },
          { onConflict: 'provider,provider_uid' },
        );

      if (identityError) {
        throw new Error(`Failed to attach SMS phone identity: ${identityError.message}`);
      }
    }

    return jsonResponse({
      success: true,
      merged_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('merge_failed', error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Merge accounts failed.',
      },
      500,
    );
  }
}, 'merge-accounts'));
