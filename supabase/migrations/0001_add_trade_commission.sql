-- Adds commission/fees tracking to trades so P&L can be reported both gross
-- (price movement only) and net (what actually hit the account).
--
-- HOW TO RUN: paste this into the Supabase dashboard → SQL Editor → New query
-- → Run, on the same project this app points to. (Or `supabase db push` /
-- `supabase migration up` if you manage this project with the Supabase CLI.)
--
-- IMPORTANT — run this BEFORE deploying the app.js version that ships with
-- this file. The app now sends a `commission` field on every trade insert/
-- update; until this column exists, PostgREST will reject those writes with
-- a "Could not find the 'commission' column of 'trades'" error and saving or
-- editing a trade will fail. Reading/existing trades are unaffected either
-- way — this migration is purely additive and defaults every existing row to
-- 0 (i.e. "no commission recorded yet"), it does not change any stored P&L.
alter table public.trades
  add column if not exists commission numeric not null default 0 check (commission >= 0);
