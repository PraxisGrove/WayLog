-- ============================================================================
-- Migration: 20260610000001_drop_old_preference_tables.sql
-- Description: Drop the old separate preference tables.
--
-- The user_route_preferences and user_expense_preferences tables have been
-- replaced by the unified user_preferences table.
-- ============================================================================

drop table if exists public.user_expense_preferences;
drop table if exists public.user_route_preferences;
