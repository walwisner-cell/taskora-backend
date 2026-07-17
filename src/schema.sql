-- Taskora PostgreSQL schema.
-- Mirrors exactly what the JSON-file datastore has been storing — every
-- field here is already in use by the running application, not aspirational.

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('customer','provider','admin')),
  country         TEXT,
  city            TEXT,
  state           TEXT,
  phone           TEXT,
  address         TEXT,
  zip_code        TEXT,
  phone_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  status          TEXT,
  region          TEXT,
  is_super_admin  BOOLEAN NOT NULL DEFAULT FALSE,
  -- provider-only fields (NULL for customers/admins)
  provider_role   TEXT,
  category        TEXT,
  skills          TEXT,
  tags            JSONB,
  availability    JSONB,
  pricing_model   TEXT CHECK (pricing_model IN ('hourly','negotiable')),
  plan            TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','pro','superpro')),
  pay_preference  TEXT,
  payout_method   TEXT,
  notif_prefs     JSONB,
  rating          NUMERIC(3,1) DEFAULT 0,
  jobs_completed  INTEGER DEFAULT 0,
  price           NUMERIC(8,2),
  color           TEXT,
  provider_since  TEXT,
  profile_photo_url TEXT,
  category_approval_status TEXT DEFAULT 'approved',
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  business_name TEXT,
  business_registration_number TEXT,
  admin_department TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_role_category_city ON users(role, category, city);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS categories (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL UNIQUE,
  icon    TEXT DEFAULT '🛠️',
  active  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS countries (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL UNIQUE,
  status  TEXT NOT NULL CHECK (status IN ('live','planned'))
);

CREATE TABLE IF NOT EXISTS cities (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  country   TEXT,
  admin_id  TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id           TEXT PRIMARY KEY,
  customer_id  TEXT NOT NULL REFERENCES users(id),
  category     TEXT NOT NULL,
  description  TEXT NOT NULL,
  budget       TEXT,
  pay_currency TEXT DEFAULT 'usd',
  status       TEXT NOT NULL DEFAULT 'open',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matches (
  id              TEXT PRIMARY KEY,
  job_id          TEXT NOT NULL REFERENCES jobs(id),
  provider_id     TEXT NOT NULL REFERENCES users(id),
  customer_id     TEXT NOT NULL REFERENCES users(id),
  score           INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  same_community  BOOLEAN,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_matches_provider_status ON matches(provider_id, status);

CREATE TABLE IF NOT EXISTS contracts (
  id             TEXT PRIMARY KEY,
  booking_number TEXT UNIQUE,
  customer_id    TEXT NOT NULL REFERENCES users(id),
  provider_id    TEXT NOT NULL REFERENCES users(id),
  job_id         TEXT REFERENCES jobs(id),
  service        TEXT NOT NULL,
  date           TEXT,
  time           TEXT,
  address        TEXT,
  amount         NUMERIC(10,2) NOT NULL,
  pay_currency   TEXT DEFAULT 'usd',
  materials_advance NUMERIC(10,2) DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active',
  signed_at      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS escrow_transactions (
  id                 TEXT PRIMARY KEY,
  contract_id        TEXT NOT NULL REFERENCES contracts(id),
  amount             NUMERIC(10,2) NOT NULL,
  paid_currency      TEXT DEFAULT 'USD',
  paid_amount_local   NUMERIC(14,2),
  exchange_rate_note TEXT,
  status             TEXT NOT NULL DEFAULT 'held',
  payout_id          TEXT,
  materials_advance_amount NUMERIC(10,2) DEFAULT 0,
  materials_advance_released BOOLEAN DEFAULT FALSE,
  materials_advance_payout_id TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_escrow_contract ON escrow_transactions(contract_id);

CREATE TABLE IF NOT EXISTS payouts (
  id                 TEXT PRIMARY KEY,
  provider_id        TEXT NOT NULL REFERENCES users(id),
  gross_amount       NUMERIC(10,2) NOT NULL,
  commission_rate    NUMERIC(5,4) NOT NULL DEFAULT 0,
  commission_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount             NUMERIC(10,2) NOT NULL,
  payout_currency    TEXT DEFAULT 'USD',
  payout_amount_local NUMERIC(14,2),
  exchange_rate_note TEXT,
  method             TEXT,
  status             TEXT NOT NULL DEFAULT 'processing',
  line_items         JSONB,
  date               TEXT
);

CREATE TABLE IF NOT EXISTS disputes (
  id           TEXT PRIMARY KEY,
  contract_id  TEXT NOT NULL REFERENCES contracts(id),
  reason       TEXT NOT NULL,
  amount       NUMERIC(10,2),
  status       TEXT NOT NULL DEFAULT 'open',
  parties      TEXT,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id           TEXT PRIMARY KEY,
  contract_id  TEXT REFERENCES contracts(id),
  provider_id  TEXT NOT NULL REFERENCES users(id),
  author_name  TEXT NOT NULL,
  stars        SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  text         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  icon       TEXT,
  text       TEXT NOT NULL,
  time       TEXT,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  link_to    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  from_id    TEXT NOT NULL REFERENCES users(id),
  to_id      TEXT NOT NULL REFERENCES users(id),
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  doc_type   TEXT,
  status     TEXT NOT NULL DEFAULT 'in review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  brand           TEXT,
  last4           TEXT,
  name_on_card    TEXT,
  expiry          TEXT,
  billing_address TEXT,
  billing_zip     TEXT,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  mode            TEXT NOT NULL DEFAULT 'test',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_resets (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS phone_verifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_submissions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  subject     TEXT NOT NULL,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS careers_inquiries (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS advertising_inquiries (
  id                TEXT PRIMARY KEY,
  company_name      TEXT NOT NULL,
  contact_name      TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT,
  message           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'new',
  target_city       TEXT,
  is_live           BOOLEAN NOT NULL DEFAULT false,
  price             NUMERIC,
  currency_code     TEXT,
  display_headline  TEXT,
  display_subtext   TEXT,
  display_link      TEXT,
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales_inquiries (
  id            TEXT PRIMARY KEY,
  company_name  TEXT NOT NULL,
  contact_name  TEXT NOT NULL,
  email         TEXT NOT NULL,
  team_size     TEXT,
  message       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'new',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The global USD starting price per plan, editable by a super admin. Any
-- plan not present here falls back to the built-in default in
-- src/plan-pricing.js — so this table only needs a row once someone
-- actually edits a price.
CREATE TABLE IF NOT EXISTS plan_pricing_base (
  id          TEXT PRIMARY KEY,
  plan        TEXT NOT NULL UNIQUE,
  usd_price   NUMERIC NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A regional admin's (or super admin's) real local-currency price for one
-- plan in one country — overrides the auto-converted USD base for that
-- country only. Absence of a row here means "use the converted default".
CREATE TABLE IF NOT EXISTS plan_pricing_overrides (
  id             TEXT PRIMARY KEY,
  country        TEXT NOT NULL,
  plan           TEXT NOT NULL,
  local_price    NUMERIC NOT NULL,
  currency_code  TEXT NOT NULL,
  set_by         TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country, plan)
);

-- A currency's effective rate — either a super admin's manual correction
-- (source: 'manual', protected from the daily live refresh) or the most
-- recent successful fetch from the live provider (source: 'live'). Absence
-- of a row here means "use the static default in src/currency-data.js" —
-- typically only true before the very first scheduled refresh has run.
CREATE TABLE IF NOT EXISTS exchange_rates (
  id             TEXT PRIMARY KEY,
  currency_code  TEXT NOT NULL UNIQUE,
  rate_to_usd    NUMERIC NOT NULL,
  source         TEXT NOT NULL DEFAULT 'manual',
  fetched_at     TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fraud_flags (
  id             TEXT PRIMARY KEY,
  type           TEXT NOT NULL,
  severity       TEXT NOT NULL DEFAULT 'medium',
  user_id        TEXT REFERENCES users(id),
  related_user_id TEXT REFERENCES users(id),
  contract_id    TEXT REFERENCES contracts(id),
  details        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'open',
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pending_logins (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS category_requests (
  id                  TEXT PRIMARY KEY,
  provider_id         TEXT NOT NULL REFERENCES users(id),
  requested_category  TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pending_registrations (
  id                TEXT PRIMARY KEY,
  payload           JSONB NOT NULL,
  phone_code_hash   TEXT NOT NULL,
  email_code_hash   TEXT NOT NULL,
  phone_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portfolio_photos (
  id           TEXT PRIMARY KEY,
  provider_id  TEXT NOT NULL REFERENCES users(id),
  filename     TEXT NOT NULL,
  url          TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_provider ON portfolio_photos(provider_id);

-- ── MIGRATIONS ────────────────────────────────────────────────────────────
-- `CREATE TABLE IF NOT EXISTS` above only helps on a genuinely fresh
-- database — it does nothing for a table that already exists from an
-- earlier version of this schema. Anything added to an existing table after
-- its first deploy needs an explicit ALTER TABLE here, or it silently never
-- reaches a database that was set up before this line was added. This file
-- runs on every boot, so these are all safe to run repeatedly.
ALTER TABLE users ADD COLUMN IF NOT EXISTS pay_preference TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_method TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_prefs JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'starter';
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS billing_zip TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS booking_number TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '🛠️';
ALTER TABLE users ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pay_currency TEXT DEFAULT 'usd';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS pay_currency TEXT DEFAULT 'usd';
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS paid_currency TEXT DEFAULT 'USD';
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS paid_amount_local NUMERIC(14,2);
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS exchange_rate_note TEXT;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS payout_currency TEXT DEFAULT 'USD';
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS payout_amount_local NUMERIC(14,2);
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS exchange_rate_note TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS category_approval_status TEXT DEFAULT 'approved';
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS payout_id TEXT;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(10,2);
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4) DEFAULT 0;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2) DEFAULT 0;
-- Backfill: any payout created before commission tracking existed had no
-- deduction at all, so its gross equals its net — never invent a
-- commission for a payout that already went out at the full amount.
UPDATE payouts SET gross_amount = amount WHERE gross_amount IS NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_registration_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_department TEXT;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS line_items JSONB;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS materials_advance NUMERIC(10,2) DEFAULT 0;
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS materials_advance_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS materials_advance_released BOOLEAN DEFAULT FALSE;
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS materials_advance_payout_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link_to JSONB;
ALTER TABLE advertising_inquiries ADD COLUMN IF NOT EXISTS target_city TEXT;
ALTER TABLE advertising_inquiries ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE advertising_inquiries ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE advertising_inquiries ADD COLUMN IF NOT EXISTS currency_code TEXT;
ALTER TABLE advertising_inquiries ADD COLUMN IF NOT EXISTS display_headline TEXT;
ALTER TABLE advertising_inquiries ADD COLUMN IF NOT EXISTS display_subtext TEXT;
ALTER TABLE advertising_inquiries ADD COLUMN IF NOT EXISTS display_link TEXT;
ALTER TABLE advertising_inquiries ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE advertising_inquiries ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ;
