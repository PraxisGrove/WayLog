-- ============================================================================
-- Migration: 20260611000001_cleanup_realtime_for_dropped_tables.sql
-- Description: Remove dropped tables from Realtime publication.
--
-- user_route_preferences and user_expense_preferences were dropped and merged
-- into user_preferences. This migration removes them from the Realtime
-- publication to prevent errors.
-- ============================================================================

-- Remove the dropped tables from the publication (IF EXISTS prevents errors)
DO $$
BEGIN
  -- Remove user_route_preferences if it was added
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_route_preferences'
  ) THEN
    ALTER publication supabase_realtime DROP TABLE public.user_route_preferences;
  END IF;

  -- Remove user_expense_preferences if it was added
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_expense_preferences'
  ) THEN
    ALTER publication supabase_realtime DROP TABLE public.user_expense_preferences;
  END IF;
END $$;

-- Add the new unified table to Realtime
ALTER publication supabase_realtime ADD TABLE public.user_preferences;
