-- Bitacora Trading Journal - schema safety migration
--
-- Run before supabase/policies.sql if the Supabase project is new or may be
-- missing columns from the current app. Safe to re-run: it creates tables,
-- columns, indexes, and constraints only when they do not already exist.

begin;

create extension if not exists pgcrypto;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  kind text not null default 'fondeo',
  firm text,
  balance numeric not null default 0,
  currency text not null default 'USD',
  phase text,
  status text not null default 'activa',
  profit_target numeric,
  max_drawdown numeric,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  date date not null,
  time text,
  symbol text not null,
  type text not null default 'future',
  side text not null,
  contracts numeric not null,
  entry numeric not null,
  exit numeric not null,
  setup text not null default 'Ruptura',
  emotion text not null default 'Tranquilo',
  rating integer not null default 3,
  note text not null default '',
  pnl numeric not null default 0,
  commission numeric not null default 0,
  account_id uuid,
  tags text[] not null default '{}',
  mae numeric,
  mfe numeric,
  screenshot_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  date date not null,
  mood text not null default 'Enfocado',
  title text not null,
  body text not null default '',
  lesson text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.accounts add column if not exists user_id uuid default auth.uid();
alter table public.accounts add column if not exists name text;
alter table public.accounts add column if not exists kind text default 'fondeo';
alter table public.accounts add column if not exists firm text;
alter table public.accounts add column if not exists balance numeric default 0;
alter table public.accounts add column if not exists currency text default 'USD';
alter table public.accounts add column if not exists phase text;
alter table public.accounts add column if not exists status text default 'activa';
alter table public.accounts add column if not exists profit_target numeric;
alter table public.accounts add column if not exists max_drawdown numeric;
alter table public.accounts add column if not exists notes text default '';
alter table public.accounts add column if not exists created_at timestamptz default now();

alter table public.trades add column if not exists user_id uuid default auth.uid();
alter table public.trades add column if not exists date date;
alter table public.trades add column if not exists time text;
alter table public.trades add column if not exists symbol text;
alter table public.trades add column if not exists type text default 'future';
alter table public.trades add column if not exists side text;
alter table public.trades add column if not exists contracts numeric;
alter table public.trades add column if not exists entry numeric;
alter table public.trades add column if not exists exit numeric;
alter table public.trades add column if not exists setup text default 'Ruptura';
alter table public.trades add column if not exists emotion text default 'Tranquilo';
alter table public.trades add column if not exists rating integer default 3;
alter table public.trades add column if not exists note text default '';
alter table public.trades add column if not exists pnl numeric default 0;
alter table public.trades add column if not exists commission numeric not null default 0;
alter table public.trades add column if not exists account_id uuid;
alter table public.trades add column if not exists tags text[] default '{}';
alter table public.trades add column if not exists mae numeric;
alter table public.trades add column if not exists mfe numeric;
alter table public.trades add column if not exists screenshot_path text;
alter table public.trades add column if not exists created_at timestamptz default now();

alter table public.journal add column if not exists user_id uuid default auth.uid();
alter table public.journal add column if not exists date date;
alter table public.journal add column if not exists mood text default 'Enfocado';
alter table public.journal add column if not exists title text;
alter table public.journal add column if not exists body text default '';
alter table public.journal add column if not exists lesson text default '';
alter table public.journal add column if not exists created_at timestamptz default now();

alter table public.user_settings add column if not exists user_id uuid default auth.uid();
alter table public.user_settings add column if not exists data jsonb default '{}'::jsonb;
alter table public.user_settings add column if not exists updated_at timestamptz default now();

alter table public.accounts alter column user_id set default auth.uid();
alter table public.accounts alter column kind set default 'fondeo';
alter table public.accounts alter column balance set default 0;
alter table public.accounts alter column currency set default 'USD';
alter table public.accounts alter column status set default 'activa';
alter table public.accounts alter column notes set default '';
alter table public.accounts alter column created_at set default now();

alter table public.trades alter column user_id set default auth.uid();
alter table public.trades alter column type set default 'future';
alter table public.trades alter column setup set default 'Ruptura';
alter table public.trades alter column emotion set default 'Tranquilo';
alter table public.trades alter column rating set default 3;
alter table public.trades alter column note set default '';
alter table public.trades alter column pnl set default 0;
alter table public.trades alter column commission set default 0;
alter table public.trades alter column tags set default '{}';
alter table public.trades alter column created_at set default now();

alter table public.journal alter column user_id set default auth.uid();
alter table public.journal alter column mood set default 'Enfocado';
alter table public.journal alter column body set default '';
alter table public.journal alter column lesson set default '';
alter table public.journal alter column created_at set default now();

alter table public.user_settings alter column user_id set default auth.uid();
alter table public.user_settings alter column data set default '{}'::jsonb;
alter table public.user_settings alter column updated_at set default now();

create unique index if not exists user_settings_user_id_key
  on public.user_settings (user_id);
create index if not exists trades_user_date_created_idx
  on public.trades (user_id, date desc, created_at desc);
create index if not exists journal_user_date_created_idx
  on public.journal (user_id, date desc, created_at desc);
create index if not exists accounts_user_created_idx
  on public.accounts (user_id, created_at desc);
create index if not exists trades_account_idx
  on public.trades (account_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trades_contracts_positive') then
    alter table public.trades
      add constraint trades_contracts_positive check (contracts > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trades_rating_range') then
    alter table public.trades
      add constraint trades_rating_range check (rating between 1 and 5) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trades_side_valid') then
    alter table public.trades
      add constraint trades_side_valid check (side in ('long', 'short')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trades_type_valid') then
    alter table public.trades
      add constraint trades_type_valid check (type in ('future', 'option')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trades_commission_non_negative') then
    alter table public.trades
      add constraint trades_commission_non_negative check (commission >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounts_kind_valid') then
    alter table public.accounts
      add constraint accounts_kind_valid check (kind in ('fondeo', 'live', 'demo')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounts_status_valid') then
    alter table public.accounts
      add constraint accounts_status_valid check (status in ('activa', 'pausada', 'cerrada')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trades_account_id_fkey') then
    alter table public.trades
      add constraint trades_account_id_fkey
      foreign key (account_id) references public.accounts(id) on delete set null not valid;
  end if;
end $$;

commit;
