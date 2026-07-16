-- Run after you confirm the first authenticated account has migrated the old workbook_sync/main data.

drop policy if exists "workbook_sync_legacy_migration_read" on public.workbook_sync;

-- Also remove any old anon/public SELECT policy on public.workbook_sync in the Supabase dashboard
-- if one was created before this migration.
