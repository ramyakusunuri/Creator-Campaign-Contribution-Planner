# C24 Data Contract: Promo Codes & E-Commerce Integration

## 1. Conventions & Principles
- **Monetary Unit:** Indian Rupee (**INR / ₹**). Over API wire, formatted as finite numbers with at most 2 decimal places. In SQLite storage, stored as **integer paise** (`paise = Math.round(inr * 100)`). Numbers with $>2$ decimal places are rejected with HTTP 400.
- **Unknown Convention:** `null` and `undefined` strictly signify **UNKNOWN**, never zero. Missing discounts remain `NULL` in storage and JSON. Explicit zero discount is `0`.
- **Timezone:** Timestamps must be full ISO 8601 strings with explicit timezones (`Z` or `+05:30` IST). Displayed in UI in Indian Standard Time (IST, UTC+05:30).
- **Dual-Key Authentication:**
  - `X-Brand-Key`: Authenticates brand marketing dashboard (`/brands/:brandId/promo-codes`, `/events`, `/creators`, `/purge-seed`).
  - `X-Report-Key`: Authenticates e-commerce website server (`/brands/:brandId/promo-codes/:code/check`, `/redemptions`).
  - Verified using constant-time string comparison (`crypto.timingSafeEqual`).

---

## 2. Database Schema (SQLite `node:sqlite`)

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promo_codes (
  brand_id TEXT NOT NULL,
  code TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (brand_id, code)
);

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

PRAGMA user_version = 1;
```

---

## 3. Demo vs Production Guards & Purge
- Database initializes `meta.environment` from `process.env.APP_ENV || 'demo'`.
- Method `storage.purgeBySource(source)`:
  - Strictly requires `source === 'synthetic_seed'`.
  - Strictly requires `environment === 'demo'`. Throws error if attempted in production.
- Simulator `scripts/fake-website.js`:
  - Queries `GET /health` and validates `environment === 'demo'` before executing any simulated transactions.

---

## 4. Canonical Payload Hashing & Idempotency
- Order reporting uses canonical JSON serialization before computing SHA-256 hash:
  - Object keys are recursively sorted lexicographically.
  - White space is stripped.
  - Floating point numbers are normalized.
- Idempotency logic:
  - If `order_id` does not exist: row inserted, returns HTTP 201.
  - If `order_id` exists and stored `payload_hash === new_hash`: returns HTTP 200 `{ duplicate: true }`.
  - If `order_id` exists and stored `payload_hash !== new_hash`: rejects with HTTP 409 Conflict `{ error: "order_id already reported with different data" }`.

---

## 5. Live Events Contract (SSE)
- Emitted over `GET /brands/:brandId/events` with header `X-Brand-Key`.
- Per-brand subscriber limit: 20 max (21st receives HTTP 429).
- Heartbeat: comment `: ping\n\n` emitted every 25 seconds.
- Event names:
  1. `promo_created`: `{ brand_id, code, creator_id, valid_from, valid_to, created_at, status }`
  2. `code_updated`: `{ brand_id, code, creator_id, valid_from, valid_to, status }`
  3. `use_recorded`: `{ order_id, code_entered, registered: true, validity_flag, units, subtotal_inr, discount_inr, source: 'website' }`
  4. `unregistered_use_recorded`: `{ order_id, code_entered, registered: false, validity_flag: 'unregistered', units, subtotal_inr, source: 'website' }`
