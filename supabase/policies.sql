-- Bitacora Trading Journal - Supabase RLS policies
--
-- Run in Supabase SQL Editor for project ajihczecndwznolgbrdc.
-- Goal: authenticated users can only read/write/delete their own rows, and
-- trade screenshots stay private under the user's own storage folder.

begin;

-- The web app uses Supabase Auth, so PostgREST executes as role "authenticated"
-- after login. Grants are still required before RLS policies are evaluated.
grant usage on schema public to authenticated;
revoke all on table
  public.trades,
  public.journal,
  public.accounts,
  public.user_settings
from anon;
grant select, insert, update, delete on table
  public.trades,
  public.journal,
  public.accounts,
  public.user_settings
to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Inserts from app.js do not send user_id for trades/journal/accounts. These
-- defaults let the database stamp the current authenticated user.
alter table public.trades alter column user_id set default auth.uid();
alter table public.journal alter column user_id set default auth.uid();
alter table public.accounts alter column user_id set default auth.uid();
alter table public.user_settings alter column user_id set default auth.uid();

-- user_settings upsert uses onConflict: "user_id".
create unique index if not exists user_settings_user_id_key
  on public.user_settings (user_id);

alter table public.trades enable row level security;
alter table public.journal enable row level security;
alter table public.accounts enable row level security;
alter table public.user_settings enable row level security;

-- Recreate only the app-table policies so stale/broad rules do not fight the
-- intended model. This intentionally does not touch unrelated tables.
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('trades', 'journal', 'accounts', 'user_settings')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy "trades_select_own"
  on public.trades
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "trades_insert_own"
  on public.trades
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      account_id is null
      or exists (
        select 1
        from public.accounts a
        where a.id = public.trades.account_id
          and a.user_id = (select auth.uid())
      )
    )
  );

create policy "trades_update_own"
  on public.trades
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      account_id is null
      or exists (
        select 1
        from public.accounts a
        where a.id = public.trades.account_id
          and a.user_id = (select auth.uid())
      )
    )
  );

create policy "trades_delete_own"
  on public.trades
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "journal_select_own"
  on public.journal
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "journal_insert_own"
  on public.journal
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "journal_update_own"
  on public.journal
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "journal_delete_own"
  on public.journal
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "accounts_select_own"
  on public.accounts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "accounts_insert_own"
  on public.accounts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "accounts_update_own"
  on public.accounts
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "accounts_delete_own"
  on public.accounts
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_settings_select_own"
  on public.user_settings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_settings_insert_own"
  on public.user_settings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_settings_update_own"
  on public.user_settings
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_settings_delete_own"
  on public.user_settings
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Private screenshot storage. The app stores files as:
--   <auth.uid()>/<timestamp-random>.<ext>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trade-screenshots',
  'trade-screenshots',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        policyname like 'trade_screenshots_%'
        or coalesce(qual, '') like '%trade-screenshots%'
        or coalesce(with_check, '') like '%trade-screenshots%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy "trade_screenshots_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'trade-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "trade_screenshots_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'trade-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "trade_screenshots_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'trade-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'trade-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "trade_screenshots_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'trade-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;

select schemaname, tablename, policyname, cmd, roles
from pg_policies
where (schemaname = 'public' and tablename in ('trades', 'journal', 'accounts', 'user_settings'))
   or (schemaname = 'storage' and tablename = 'objects' and policyname like 'trade_screenshots_%')
order by schemaname, tablename, policyname;
