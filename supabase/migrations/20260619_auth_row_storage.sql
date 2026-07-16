-- Workbook v2: Supabase Auth + per-user row tables + private Storage.
-- Run this before deploying the updated GitHub Pages app.

create table if not exists public.workbook_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  legacy_migrated boolean not null default false,
  migrated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.workbook_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0,
  deleted_at bigint not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.workbook_categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  updated_at bigint not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.workbook_contacts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  updated_at bigint not null default 0,
  deleted_at bigint not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists workbook_entries_user_updated_idx on public.workbook_entries(user_id, updated_at desc);
create index if not exists workbook_contacts_user_order_idx on public.workbook_contacts(user_id, sort_order);
create index if not exists workbook_categories_user_order_idx on public.workbook_categories(user_id, sort_order);

alter table public.workbook_profiles enable row level security;
alter table public.workbook_entries enable row level security;
alter table public.workbook_categories enable row level security;
alter table public.workbook_contacts enable row level security;

drop policy if exists "workbook_profiles_owner" on public.workbook_profiles;
create policy "workbook_profiles_owner" on public.workbook_profiles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "workbook_entries_owner" on public.workbook_entries;
create policy "workbook_entries_owner" on public.workbook_entries
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "workbook_categories_owner" on public.workbook_categories;
create policy "workbook_categories_owner" on public.workbook_categories
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "workbook_contacts_owner" on public.workbook_contacts;
create policy "workbook_contacts_owner" on public.workbook_contacts
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.workbook_profiles to authenticated;
grant select, insert, update, delete on public.workbook_entries to authenticated;
grant select, insert, update, delete on public.workbook_categories to authenticated;
grant select, insert, update, delete on public.workbook_contacts to authenticated;

-- Temporary legacy read policy: the first authenticated login can migrate workbook_sync/main.
-- After migration is confirmed, run 20260619_lock_legacy.sql.
alter table if exists public.workbook_sync enable row level security;
drop policy if exists "workbook_sync_legacy_migration_read" on public.workbook_sync;
create policy "workbook_sync_legacy_migration_read" on public.workbook_sync
  for select to authenticated
  using (id = 'main');

insert into storage.buckets (id, name, public, file_size_limit)
values ('workbook', 'workbook', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = 52428800;

drop policy if exists "workbook_storage_owner_select" on storage.objects;
create policy "workbook_storage_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'workbook' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "workbook_storage_owner_insert" on storage.objects;
create policy "workbook_storage_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'workbook' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "workbook_storage_owner_update" on storage.objects;
create policy "workbook_storage_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'workbook' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'workbook' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "workbook_storage_owner_delete" on storage.objects;
create policy "workbook_storage_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'workbook' and (storage.foldername(name))[1] = auth.uid()::text);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workbook_entries'
  ) then
    alter publication supabase_realtime add table public.workbook_entries;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workbook_categories'
  ) then
    alter publication supabase_realtime add table public.workbook_categories;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workbook_contacts'
  ) then
    alter publication supabase_realtime add table public.workbook_contacts;
  end if;
end $$;
