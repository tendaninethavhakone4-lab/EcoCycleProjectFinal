-- =====================================================================
-- ReclaimIQ / EcoCycle — Supabase production schema
-- Currency: ZAR (R) only.  No dummy data — you add real records.
--
-- HOW TO USE
--   1.  Open Supabase → SQL Editor → New query.
--   2.  Paste the WHOLE file and Run.  Safe to re-run.
--   3.  To wipe every row (keep tables) run section [WIPE] below.
--   4.  Create your real first admin/superadmin via section [BOOTSTRAP].
-- =====================================================================

-- ---------- extensions -----------------------------------------------
create extension if not exists "pgcrypto";

-- ---------- USERS (admins, superadmins, end users) -------------------
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text unique not null,
  phone         text,
  role          text not null default 'user'
                check (role in ('user','admin','superadmin')),
  branch        text,
  status        text default 'active'
                check (status in ('active','suspended','pending')),
  password_hash text not null,
  must_change_password boolean default false,
  approved_at   timestamptz,
  approved_by   text,
  last_login    timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists users_role_idx on public.users(role);
create index if not exists users_email_idx on public.users(email);

-- ---------- BRANCHES --------------------------------------------------
create table if not exists public.branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  country     text default 'South Africa',
  city        text,
  manager     text,
  manager_email text,
  lat         numeric,
  lng         numeric,
  status      text default 'active'
              check (status in ('active','pilot','paused','closed')),
  revenue     numeric default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ---------- PICKERS ---------------------------------------------------
create table if not exists public.pickers (
  id          text primary key,                -- e.g. PK-0001
  name        text not null,
  phone       text,
  email       text,
  id_number   text,
  branch      text,
  status      text default 'active'
              check (status in ('active','inactive','suspended')),
  total_kg    numeric default 0,
  total_paid  numeric default 0,
  rating      numeric default 0,
  lat         numeric,
  lng         numeric,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists pickers_branch_idx on public.pickers(branch);
create index if not exists pickers_status_idx on public.pickers(status);

-- ---------- PRICES & PRICE HISTORY -----------------------------------
create table if not exists public.prices (
  material      text primary key,
  price_per_kg  numeric not null check (price_per_kg >= 0),
  currency      text default 'ZAR',
  updated_at    timestamptz default now(),
  updated_by    text
);

create table if not exists public.price_history (
  id          bigserial primary key,
  material    text,
  old_price   numeric,
  new_price   numeric,
  changed_at  timestamptz default now(),
  changed_by  text
);
create index if not exists price_hist_material_idx on public.price_history(material);

-- ---------- INVENTORY -------------------------------------------------
create table if not exists public.inventory (
  material      text primary key,
  stock_kg      numeric default 0,
  reserved_kg   numeric default 0,
  threshold_kg  numeric default 200,
  unit          text default 'kg',
  updated_at    timestamptz default now()
);

-- ---------- TRANSACTIONS (picker drop-offs) --------------------------
create table if not exists public.transactions (
  id            text primary key,              -- e.g. TX-1730000000000
  picker_id     text references public.pickers(id) on delete set null,
  material      text,
  weight        numeric not null check (weight >= 0),
  price_per_kg  numeric not null check (price_per_kg >= 0),
  amount        numeric not null check (amount >= 0),
  status        text default 'completed'
                check (status in ('pending','completed','cancelled','reversed')),
  branch        text,
  notes         text,
  created_at    timestamptz default now()
);
create index if not exists tx_created_idx  on public.transactions(created_at desc);
create index if not exists tx_picker_idx   on public.transactions(picker_id);
create index if not exists tx_material_idx on public.transactions(material);
create index if not exists tx_branch_idx   on public.transactions(branch);

-- ---------- SALES (marketplace outflow) ------------------------------
create table if not exists public.sales (
  id           text primary key,
  material     text,
  qty          numeric check (qty >= 0),
  price_per_kg numeric check (price_per_kg >= 0),
  total        numeric check (total >= 0),
  buyer        text,
  buyer_email  text,
  status       text default 'pending'
               check (status in ('pending','paid','shipped','cancelled')),
  branch       text,
  created_at   timestamptz default now()
);
create index if not exists sales_created_idx on public.sales(created_at desc);
create index if not exists sales_status_idx  on public.sales(status);

-- ---------- PAYOUTS ---------------------------------------------------
create table if not exists public.payouts (
  id          text primary key,
  picker_id   text references public.pickers(id) on delete set null,
  amount      numeric not null check (amount >= 0),
  method      text default 'bank'
              check (method in ('bank','wallet','cash','airtime')),
  reference   text,
  status      text default 'pending'
              check (status in ('pending','paid','failed','cancelled')),
  paid_at     timestamptz,
  created_at  timestamptz default now()
);
create index if not exists payouts_picker_idx on public.payouts(picker_id);
create index if not exists payouts_status_idx on public.payouts(status);

-- ---------- SUPPORT TICKETS ------------------------------------------
create table if not exists public.support_tickets (
  id          text primary key,
  user_email  text,
  user_name   text,
  subject     text,
  message     text,
  category    text,
  priority    text default 'normal'
              check (priority in ('low','normal','high','urgent')),
  status      text default 'open'
              check (status in ('open','in_progress','resolved','closed')),
  escalated   boolean default false,
  assigned_to text,
  resolution  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists tickets_status_idx on public.support_tickets(status);

-- ---------- ALERTS ----------------------------------------------------
create table if not exists public.alerts (
  id         bigserial primary key,
  level      text default 'info'
             check (level in ('info','warning','critical')),
  message    text not null,
  source     text,
  read       boolean default false,
  created_at timestamptz default now()
);
create index if not exists alerts_read_idx on public.alerts(read, created_at desc);

-- ---------- AUDIT LOG -------------------------------------------------
create table if not exists public.audit_log (
  id         bigserial primary key,
  actor      text,
  action     text,
  resource   text,
  ip         text,
  created_at timestamptz default now()
);
create index if not exists audit_created_idx on public.audit_log(created_at desc);

-- ---------- SYSTEM SETTINGS (single-row key/value) --------------------
create table if not exists public.settings (
  key   text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Default settings (safe to re-run, won't overwrite your changes)
insert into public.settings (key, value) values
  ('platform_name',  to_jsonb('ReclaimIQ'::text)),
  ('currency',       to_jsonb('ZAR'::text)),
  ('support_email',  to_jsonb(''::text)),
  ('default_branch', to_jsonb(''::text)),
  ('flags',          '{"ai":true,"marketplace":true}'::jsonb)
on conflict (key) do nothing;

-- =====================================================================
-- [WIPE]  Remove every row from every operational table.
--         Uncomment + run when you want a clean slate.
--         Will NOT delete the tables themselves.
-- =====================================================================
-- truncate table
--   public.audit_log,
--   public.alerts,
--   public.support_tickets,
--   public.payouts,
--   public.sales,
--   public.transactions,
--   public.price_history,
--   public.inventory,
--   public.prices,
--   public.pickers,
--   public.branches,
--   public.users
-- restart identity cascade;

-- =====================================================================
-- [BOOTSTRAP]  Create your REAL first super-admin account.
--              Replace the email/name and run ONLY this block in
--              Supabase SQL editor, then log in via the Login page.
--              The password below is hashed for: ChangeMe!2026
--              (bcrypt cost 8).  CHANGE IT IMMEDIATELY after login.
-- =====================================================================
-- insert into public.users (name, email, role, status, password_hash)
-- values (
--   'Site Owner',
--   'owner@reclaimiq.co.za',
--   'superadmin',
--   'active',
--   '$2a$08$qkP7ZP0p1q9b5xJg2t0d6.5Z8uS3w0c9o1n2g0wQ7Yt0Kxh4j8aRe'
-- )
-- on conflict (email) do nothing;
--
-- Tip: to generate your own bcrypt hash run from project root:
--   node -e "console.log(require('bcryptjs').hashSync('YourPassword', 8))"
--
-- =====================================================================
-- [RLS]  Row-level security is OFF by default because the Node backend
--        connects with the service_role key.  Enable per-table only if
--        you also build direct browser→Supabase access.
-- =====================================================================
