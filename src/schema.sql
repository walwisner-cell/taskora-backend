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
  pay_preference  TEXT,
  payout_method   TEXT,
  notif_prefs     JSONB,
  rating          NUMERIC(3,1) DEFAULT 0,
  jobs_completed  INTEGER DEFAULT 0,
  price           NUMERIC(8,2),
  color           TEXT,
  provider_since  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_role_category_city ON users(role, category, city);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS categories (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL UNIQUE,
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
  id           TEXT PRIMARY KEY,
  customer_id  TEXT NOT NULL REFERENCES users(id),
  provider_id  TEXT NOT NULL REFERENCES users(id),
  job_id       TEXT REFERENCES jobs(id),
  service      TEXT NOT NULL,
  date         TEXT,
  time         TEXT,
  address      TEXT,
  amount       NUMERIC(10,2) NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active',
  signed_at    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS escrow_transactions (
  id           TEXT PRIMARY KEY,
  contract_id  TEXT NOT NULL REFERENCES contracts(id),
  amount       NUMERIC(10,2) NOT NULL,
  status       TEXT NOT NULL DEFAULT 'held',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_escrow_contract ON escrow_transactions(contract_id);

CREATE TABLE IF NOT EXISTS payouts (
  id           TEXT PRIMARY KEY,
  provider_id  TEXT NOT NULL REFERENCES users(id),
  amount       NUMERIC(10,2) NOT NULL,
  method       TEXT,
  status       TEXT NOT NULL DEFAULT 'processing',
  date         TEXT
);

CREATE TABLE IF NOT EXISTS disputes (
  id           TEXT PRIMARY KEY,
  contract_id  TEXT NOT NULL REFERENCES contracts(id),
  reason       TEXT NOT NULL,
  amount       NUMERIC(10,2),
  status       TEXT NOT NULL DEFAULT 'open',
  parties      TEXT,
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
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  brand         TEXT,
  last4         TEXT,
  name_on_card  TEXT,
  expiry        TEXT,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  mode          TEXT NOT NULL DEFAULT 'test',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
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
