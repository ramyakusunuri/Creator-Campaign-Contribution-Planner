# C24 Data Contract: Promo Codes, Creator Finder & E-Commerce Integration

## 1. Conventions & Principles
- **Monetary Unit:** Indian Rupee (**INR / ₹**). Over API wire, formatted as finite numbers with at most 2 decimal places. In SQLite storage, stored as **integer paise** (`paise = Math.round(inr * 100)`). Numbers with $>2$ decimal places are rejected with HTTP 400.
- **Unknown Convention:** `null` and `undefined` strictly signify **UNKNOWN**, never zero. Missing discounts and hidden follower counts remain `NULL` in storage and JSON. Explicit zero discount or zero fee is `0`.
- **Timezone:** Timestamps must be full ISO 8601 strings with explicit timezones (`Z` or `+05:30` IST). Displayed in UI in Indian Standard Time (IST, UTC+05:30).
- **Role-Based Authentication:**
  - `X-Brand-Key`: Authenticates brand marketing dashboard (`/brands/:brandId/promo-codes`, `/events`, `/creators`, `/shortlist`).
  - `X-Report-Key`: Authenticates e-commerce website server (`/brands/:brandId/promo-codes/:code/check`, `/redemptions`).
  - `X-Agency-Key`: Authenticates agency-level shared creator catalog writes (`/api/finder/csv`, `/api/finder/profiles`).
  - All keys are verified using constant-time string comparison (`crypto.timingSafeEqual`).

---

## 2. Database Schema (SQLite `node:sqlite`)

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Meta & Environment
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Creator Catalog & Finder (Phase B6)
CREATE TABLE IF NOT EXISTS creator_profiles (
  creator_id TEXT NOT NULL,
  platform TEXT NOT NULL,                -- 'youtube' | 'instagram'
  handle TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  platform_account_id TEXT,
  PRIMARY KEY (creator_id, platform)
);

CREATE TABLE IF NOT EXISTS creator_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  count INTEGER,                         -- NULL if hidden/unknown
  exact_or_rounded TEXT NOT NULL DEFAULT 'rounded', -- 'exact' | 'rounded'
  hidden_flag INTEGER NOT NULL DEFAULT 0,
  fetched_time TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'ok',
  FOREIGN KEY (creator_id, platform) REFERENCES creator_profiles(creator_id, platform) ON DELETE CASCADE
);

-- Brand-Scoped Shortlists (Phase B6)
CREATE TABLE IF NOT EXISTS shortlists (
  brand_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  added_at TEXT NOT NULL,
  notes TEXT,
  PRIMARY KEY (brand_id, creator_id)
);

-- Promo Codes (Phase B3)
CREATE TABLE IF NOT EXISTS promo_codes (
  brand_id TEXT NOT NULL,
  code TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (brand_id, code)
);

-- Promo Redemptions & Uses (Phase B2 & B3)
CREATE TABLE IF NOT EXISTS uses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  code_entered TEXT NOT NULL,
  registered INTEGER NOT NULL,          -- 1 = registered, 0 = unregistered
  customer_id TEXT NOT NULL,           -- pseudonymous, no PII
  used_at TEXT NOT NULL,
  payment_confirmed_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  discount_paise INTEGER,              -- NULL if unknown, 0 if explicit zero
  line_discount_basis TEXT,            -- 'reported' | 'estimated' | NULL
  source TEXT NOT NULL,                -- 'website' | 'synthetic_seed'
  validity_flag TEXT NOT NULL,         -- 'valid' | 'outside_validity' | 'unregistered'
  payload_raw TEXT NOT NULL,
  payload_hash TEXT NOT NULL,          -- SHA-256 of canonical JSON
  UNIQUE (brand_id, order_id)
);

CREATE TABLE IF NOT EXISTS use_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  use_id INTEGER NOT NULL,
  line_no INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  name TEXT,
  unit_price_paise INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  line_discount_paise INTEGER,
  FOREIGN KEY (use_id) REFERENCES uses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  code TEXT,
  action TEXT NOT NULL,
  changes TEXT NOT NULL
);
```

---

## 3. Demo vs Production Security Restrictions (Phase B9)
- **No HTTP purge endpoint:** The platform does NOT expose any endpoint capable of purging or deleting historical orders or live feeds over HTTP.
- **No HTTP synthetic creation endpoint:** All synthetic simulations are strictly driven via external CLI scripts (`scripts/fake-website.js`) communicating over the public e-commerce reporting API.
- **Demo Guard:** Simulation scripts query `GET /health` and refuse to run unless `environment === 'demo'`.

---

## 4. Canonical Payload Hashing & Idempotency
- Order reporting uses canonical JSON serialization before computing SHA-256 hash:
  - Object keys are recursively sorted lexicographically.
  - White space is stripped.
  - Floating point numbers are normalized.
- Idempotency logic:
  - If `order_id` does not exist: row inserted, returns HTTP 201.
  - If `order_id` exists and stored `payload_hash === new_hash`: returns HTTP 200 `{ duplicate: true }`.
  - If `order_id` exists and stored `payload_hash !== new_hash`: rejects with HTTP 409 Conflict.
