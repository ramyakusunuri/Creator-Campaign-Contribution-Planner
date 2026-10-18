import { DatabaseSync } from 'node:sqlite';

export const LATEST_SCHEMA_VERSION = 2;

export interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_initial_schema',
    up: (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS brands (
          brand_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          api_key_hash TEXT NOT NULL,
          webhook_secret TEXT,
          platform_type TEXT DEFAULT 'generic',
          rivals TEXT DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS creators (
          creator_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          excluded INTEGER NOT NULL DEFAULT 0,
          relationships TEXT NULL, -- STRICT NULLABLE, NO DEFAULT
          default_fee_inr REAL NOT NULL DEFAULT 200000,
          default_fee_paise INTEGER NOT NULL DEFAULT 20000000,
          default_sp_inr REAL NOT NULL DEFAULT 1500,
          default_sp_paise INTEGER NOT NULL DEFAULT 150000,
          default_cp_inr REAL NOT NULL DEFAULT 600,
          default_cp_paise INTEGER NOT NULL DEFAULT 60000,
          default_margin_pct REAL NOT NULL DEFAULT 40,
          default_incremental_share REAL NOT NULL DEFAULT 0.8
        );

        CREATE TABLE IF NOT EXISTS promo_codes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_id TEXT NOT NULL,
          code TEXT NOT NULL,
          creator_id TEXT NOT NULL,
          valid_from TEXT NOT NULL,
          valid_to TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(brand_id, code),
          FOREIGN KEY(brand_id) REFERENCES brands(brand_id)
        );

        CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_id TEXT NOT NULL,
          order_id TEXT NOT NULL,
          promo_code TEXT NULL,
          customer_id TEXT NOT NULL,
          used_at TEXT NOT NULL,
          currency TEXT NOT NULL DEFAULT 'INR',
          subtotal_inr REAL NOT NULL,
          subtotal_paise INTEGER NOT NULL,
          discount_inr REAL NULL,          -- STRICT NULLABLE
          discount_paise INTEGER NULL,      -- STRICT NULLABLE, NO DEFAULT 0
          discount_basis TEXT NULL,         -- STRICT NULLABLE
          total_inr REAL NULL,             -- STRICT NULLABLE
          total_paise INTEGER NULL,         -- STRICT NULLABLE, NO DEFAULT 0
          status TEXT NOT NULL DEFAULT 'completed',
          validity_flag TEXT NOT NULL DEFAULT 'valid',
          source TEXT NOT NULL DEFAULT 'website',
          raw_payload TEXT,
          UNIQUE(brand_id, order_id),
          FOREIGN KEY(brand_id) REFERENCES brands(brand_id)
        );

        CREATE TABLE IF NOT EXISTS order_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id_ref INTEGER NOT NULL,
          product_id TEXT NOT NULL,
          name TEXT NULL,
          unit_price_inr REAL NOT NULL,
          unit_price_paise INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          gross_inr REAL NOT NULL,
          gross_paise INTEGER NOT NULL,
          line_discount_inr REAL NULL,     -- STRICT NULLABLE
          line_discount_paise INTEGER NULL, -- STRICT NULLABLE, NO DEFAULT 0
          net_inr REAL NULL,               -- STRICT NULLABLE
          net_paise INTEGER NULL,           -- STRICT NULLABLE, NO DEFAULT 0
          FOREIGN KEY(order_id_ref) REFERENCES orders(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS refund_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_id TEXT NOT NULL,
          refund_id TEXT NOT NULL,
          order_id TEXT NOT NULL,
          amount_inr REAL NOT NULL,
          amount_paise INTEGER NOT NULL,
          is_full_refund INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          UNIQUE(brand_id, refund_id)
        );

        CREATE TABLE IF NOT EXISTS webhook_idempotency_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_id TEXT NOT NULL,
          event_id TEXT NOT NULL,
          processed_at TEXT NOT NULL,
          UNIQUE(brand_id, event_id)
        );

        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          at TEXT NOT NULL,
          brand_id TEXT NOT NULL,
          action TEXT NOT NULL,
          changes TEXT NOT NULL
        );
      `);
    }
  },
  {
    version: 2,
    name: '002_integer_paise_migration',
    up: (db: DatabaseSync) => {
      // Ensure paise columns exist (safe alter)
      const tables = [
        { table: 'orders', col: 'subtotal_paise', type: 'INTEGER NULL' },
        { table: 'orders', col: 'discount_paise', type: 'INTEGER NULL' },
        { table: 'orders', col: 'total_paise', type: 'INTEGER NULL' },
        { table: 'orders', col: 'source', type: "TEXT NOT NULL DEFAULT 'website'" },
        { table: 'order_items', col: 'unit_price_paise', type: 'INTEGER NULL' },
        { table: 'order_items', col: 'gross_paise', type: 'INTEGER NULL' },
        { table: 'order_items', col: 'line_discount_paise', type: 'INTEGER NULL' },
        { table: 'order_items', col: 'net_paise', type: 'INTEGER NULL' },
        { table: 'creators', col: 'default_fee_paise', type: 'INTEGER NULL' },
        { table: 'creators', col: 'default_sp_paise', type: 'INTEGER NULL' },
        { table: 'creators', col: 'default_cp_paise', type: 'INTEGER NULL' },
        { table: 'refund_events', col: 'amount_paise', type: 'INTEGER NULL' }
      ];

      for (const t of tables) {
        try {
          db.exec(`ALTER TABLE ${t.table} ADD COLUMN ${t.col} ${t.type};`);
        } catch {}
      }

      // Backfill integer paise from existing INR data if needed
      db.exec(`
        UPDATE orders SET subtotal_paise = CAST(ROUND(subtotal_inr * 100) AS INTEGER) WHERE subtotal_paise IS NULL AND subtotal_inr IS NOT NULL;
        UPDATE orders SET discount_paise = CAST(ROUND(discount_inr * 100) AS INTEGER) WHERE discount_paise IS NULL AND discount_inr IS NOT NULL;
        UPDATE orders SET total_paise = CAST(ROUND(total_inr * 100) AS INTEGER) WHERE total_paise IS NULL AND total_inr IS NOT NULL;
        UPDATE order_items SET unit_price_paise = CAST(ROUND(unit_price_inr * 100) AS INTEGER) WHERE unit_price_paise IS NULL AND unit_price_inr IS NOT NULL;
        UPDATE order_items SET gross_paise = CAST(ROUND(gross_inr * 100) AS INTEGER) WHERE gross_paise IS NULL AND gross_inr IS NOT NULL;
        UPDATE order_items SET line_discount_paise = CAST(ROUND(line_discount_inr * 100) AS INTEGER) WHERE line_discount_paise IS NULL AND line_discount_inr IS NOT NULL;
        UPDATE order_items SET net_paise = CAST(ROUND(net_inr * 100) AS INTEGER) WHERE net_paise IS NULL AND net_inr IS NOT NULL;
        UPDATE creators SET default_fee_paise = CAST(ROUND(default_fee_inr * 100) AS INTEGER) WHERE default_fee_paise IS NULL AND default_fee_inr IS NOT NULL;
        UPDATE creators SET default_sp_paise = CAST(ROUND(default_sp_inr * 100) AS INTEGER) WHERE default_sp_paise IS NULL AND default_sp_inr IS NOT NULL;
        UPDATE creators SET default_cp_paise = CAST(ROUND(default_cp_inr * 100) AS INTEGER) WHERE default_cp_paise IS NULL AND default_cp_inr IS NOT NULL;
        UPDATE refund_events SET amount_paise = CAST(ROUND(amount_inr * 100) AS INTEGER) WHERE amount_paise IS NULL AND amount_inr IS NOT NULL;
      `);
    }
  }
];

export function runMigrations(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version;').get() as { user_version: number } | undefined;
  const currentVersion = Number(row?.user_version || 0);

  if (currentVersion > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Database schema version (${currentVersion}) is newer than application supported version (${LATEST_SCHEMA_VERSION}). Refusing to start.`
    );
  }

  for (const migration of MIGRATIONS) {
    if (currentVersion < migration.version) {
      migration.up(db);
      db.exec(`PRAGMA user_version = ${migration.version};`);
    }
  }

  const finalRow = db.prepare('PRAGMA user_version;').get() as { user_version: number } | undefined;
  return Number(finalRow?.user_version || LATEST_SCHEMA_VERSION);
}
