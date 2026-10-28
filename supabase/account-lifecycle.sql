-- Bitácora account lifecycle history
-- Run once in Supabase SQL Editor for an existing installation.
begin;

alter table public.accounts
  add column if not exists account_history jsonb not null default '[]'::jsonb;

alter table public.accounts
  drop constraint if exists accounts_status_valid;

alter table public.accounts
  add constraint accounts_status_valid
  check (status in ('activa', 'evaluacion', 'fondeada', 'payout_pedido', 'payout_aprobado', 'aprobada', 'quemada', 'pausada', 'cerrada', 'archivada')) not valid;

commit;
