-- ============================================================================
-- Migration: 20260611000002_drop_login_providers_from_profiles.sql
-- Description: Remove login_providers column from profiles table.
--
-- login_providers (JSONB array) was a redundant copy of login method data.
-- Supabase-native identities are canonical in auth.identities. Custom
-- identities are canonical in public.user_identities.
-- ============================================================================

DROP INDEX IF EXISTS public.idx_profiles_login_providers;

ALTER TABLE public.profiles
DROP COLUMN IF EXISTS login_providers;
