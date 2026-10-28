-- Bitácora: repair accounts schema for lifecycle/history features.
-- Safe to run repeatedly. Run in Supabase SQL Editor for project
-- ajihczecndwznolgbrdc, then reload the app.
begin;
alter table public.accounts
  add column if not exists account_history jsonb not null default '[]'::jsonb;
alter table public.accounts
  alter column account_history set default '[]'::jsonb;
update public.accounts
  set account_history = '[]'::jsonb
  where account_history is null;
notify pgrst, 'reload schema';
commit;
