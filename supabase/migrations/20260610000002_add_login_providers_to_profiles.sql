-- ============================================================================
-- Migration: 20260610000002_add_login_providers_to_profiles.sql
-- Description: Add login_providers field to profiles table.
--
-- This field stores an array of login methods the user has used,
-- e.g. ["email"], ["phone", "wechat"], ["email", "wechat"]
-- ============================================================================

-- Add login_providers column (JSONB array, default empty)
alter table public.profiles
add column if not exists login_providers jsonb not null default '[]'::jsonb;

-- Create index for querying by login provider
create index if not exists idx_profiles_login_providers
on public.profiles using gin (login_providers);
