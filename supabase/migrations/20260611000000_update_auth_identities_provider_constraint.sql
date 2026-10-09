-- ============================================================================
-- Migration: 20260611000000_update_auth_identities_provider_constraint.sql
-- Description: Update auth_identities table to support more login providers.
--
-- Adds 'email' and 'apple' to the allowed provider values,
-- enabling users to bind multiple login methods to the same account.
-- ============================================================================

-- Drop the existing CHECK constraint
alter table public.auth_identities
drop constraint if exists auth_identities_provider_check;

-- Add updated CHECK constraint with all supported providers
alter table public.auth_identities
add constraint auth_identities_provider_check
check (provider in ('phone', 'wechat', 'email', 'apple'));
