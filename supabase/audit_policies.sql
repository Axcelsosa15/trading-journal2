-- Bitacora Trading Journal - read-only Supabase policy audit
--
-- Run after supabase/policies.sql. Every row should report ok = true.

with expected_public_tables(table_name) as (
  values ('trades'), ('journal'), ('accounts'), ('user_settings')
),
expected_storage_policies(policyname) as (
  values
    ('trade_screenshots_select_own'),
    ('trade_screenshots_insert_own'),
    ('trade_screenshots_update_own'),
    ('trade_screenshots_delete_own')
),
expected_table_policies(table_name, policyname) as (
  values
    ('trades', 'trades_select_own'),
    ('trades', 'trades_insert_own'),
    ('trades', 'trades_update_own'),
    ('trades', 'trades_delete_own'),
    ('journal', 'journal_select_own'),
    ('journal', 'journal_insert_own'),
    ('journal', 'journal_update_own'),
    ('journal', 'journal_delete_own'),
    ('accounts', 'accounts_select_own'),
    ('accounts', 'accounts_insert_own'),
    ('accounts', 'accounts_update_own'),
    ('accounts', 'accounts_delete_own'),
    ('user_settings', 'user_settings_select_own'),
    ('user_settings', 'user_settings_insert_own'),
    ('user_settings', 'user_settings_update_own'),
    ('user_settings', 'user_settings_delete_own')
)
select
  'rls_enabled_on_app_tables' as check_name,
  count(*) = 4 as ok,
  jsonb_agg(c.relname order by c.relname) as detail
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join expected_public_tables e on e.table_name = c.relname
where n.nspname = 'public'
  and c.relrowsecurity

union all

select
  'all_16_app_policies_exist' as check_name,
  count(*) = 16 as ok,
  jsonb_agg(p.tablename || '.' || p.policyname order by p.tablename, p.policyname) as detail
from expected_table_policies e
left join pg_policies p
  on p.schemaname = 'public'
 and p.tablename = e.table_name
 and p.policyname = e.policyname
where p.policyname is not null

union all

select
  'authenticated_has_table_privileges' as check_name,
  bool_and(
    has_table_privilege('authenticated', 'public.' || table_name, 'select')
    and has_table_privilege('authenticated', 'public.' || table_name, 'insert')
    and has_table_privilege('authenticated', 'public.' || table_name, 'update')
    and has_table_privilege('authenticated', 'public.' || table_name, 'delete')
  ) as ok,
  jsonb_agg(table_name order by table_name) as detail
from expected_public_tables

union all

select
  'anon_has_no_app_table_privileges' as check_name,
  not bool_or(
    has_table_privilege('anon', 'public.' || table_name, 'select')
    or has_table_privilege('anon', 'public.' || table_name, 'insert')
    or has_table_privilege('anon', 'public.' || table_name, 'update')
    or has_table_privilege('anon', 'public.' || table_name, 'delete')
  ) as ok,
  jsonb_agg(table_name order by table_name) as detail
from expected_public_tables

union all

select
  'user_id_defaults_to_auth_uid' as check_name,
  count(*) = 4 as ok,
  jsonb_agg(table_name order by table_name) as detail
from information_schema.columns
where table_schema = 'public'
  and table_name in (select table_name from expected_public_tables)
  and column_name = 'user_id'
  and column_default like '%auth.uid%'

union all

select
  'user_settings_user_id_unique' as check_name,
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'user_settings'
      and indexname = 'user_settings_user_id_key'
  ) as ok,
  jsonb_build_array('user_settings_user_id_key') as detail

union all

select
  'trade_screenshots_bucket_private' as check_name,
  exists (
    select 1
    from storage.buckets
    where id = 'trade-screenshots'
      and public = false
  ) as ok,
  coalesce(
    (select to_jsonb(b) from storage.buckets b where b.id = 'trade-screenshots'),
    '{}'::jsonb
  ) as detail

union all

select
  'trade_screenshots_storage_policies_exist' as check_name,
  count(*) = 4 as ok,
  jsonb_agg(p.policyname order by p.policyname) as detail
from expected_storage_policies e
left join pg_policies p
  on p.schemaname = 'storage'
 and p.tablename = 'objects'
 and p.policyname = e.policyname
where p.policyname is not null;
