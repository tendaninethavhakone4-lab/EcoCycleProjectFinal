-- Run once in Supabase SQL Editor.
-- Adds approval workflow columns to existing tables.

alter table public.users
  add column if not exists must_change_password boolean default false,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by text;

-- Anyone who self-registers from now on starts pending.
-- Existing rows are left as they are (you already activated yours).

notify pgrst, 'reload schema';
