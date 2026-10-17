import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

let dbInstance: DatabaseSync | null = null;

export function getDbPath(): string {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'planner.db');
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function getDb(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getDbPath();
  const db = new DatabaseSync(dbPath);

  // Configure SQLite for high performance and integrity
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }

  // Schema creation
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
      relationships TEXT, -- JSON array of brand_ids, or NULL for unknown
      default_fee_inr REAL NOT NULL DEFAULT 200000,
      default_sp_inr REAL NOT NULL DEFAULT 1500,
      default_cp_inr REAL NOT NULL DEFAULT 600,
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
      promo_code TEXT,
      customer_id TEXT NOT NULL,
      used_at TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      subtotal_inr REAL NOT NULL,
      discount_inr REAL,
      discount_basis TEXT,
      total_inr REAL,
      status TEXT NOT NULL DEFAULT 'completed',
      validity_flag TEXT NOT NULL DEFAULT 'valid',
      raw_payload TEXT,
      UNIQUE(brand_id, order_id),
      FOREIGN KEY(brand_id) REFERENCES brands(brand_id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id_ref INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      name TEXT,
      unit_price_inr REAL NOT NULL,
      quantity INTEGER NOT NULL,
      gross_inr REAL NOT NULL,
      line_discount_inr REAL,
      net_inr REAL,
      FOREIGN KEY(order_id_ref) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS refund_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id TEXT NOT NULL,
      refund_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      amount_inr REAL NOT NULL,
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

  seedReferenceData(db);

  dbInstance = db;
  return dbInstance;
}

export function resetDbForTesting(inMemory = true): DatabaseSync {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }
  process.env.DATABASE_PATH = inMemory ? ':memory:' : path.join(process.cwd(), 'data', 'test.db');
  return getDb();
}

function seedReferenceData(db: DatabaseSync): void {
  const brandCount = (db.prepare('SELECT COUNT(*) as cnt FROM brands;').get() as { cnt: number }).cnt;
  if (brandCount === 0) {
    const insertBrand = db.prepare(`
      INSERT INTO brands (brand_id, name, api_key_hash, webhook_secret, platform_type, rivals)
      VALUES (?, ?, ?, ?, ?, ?);
    `);
    // Default brand B1: api_key is "b1_secret_key"
    insertBrand.run('B1', 'Brand Nova (Synthetic)', hashApiKey('b1_secret_key'), 'whsec_b1_test_secret', 'generic', JSON.stringify(['B2']));
    // Default brand B2: api_key is "b2_secret_key"
    insertBrand.run('B2', 'Brand Zenith (Synthetic)', hashApiKey('b2_secret_key'), 'whsec_b2_test_secret', 'generic', JSON.stringify(['B1']));
  }

  const creatorCount = (db.prepare('SELECT COUNT(*) as cnt FROM creators;').get() as { cnt: number }).cnt;
  if (creatorCount === 0) {
    const insertCreator = db.prepare(`
      INSERT INTO creators (creator_id, name, category, excluded, relationships, default_fee_inr, default_sp_inr, default_cp_inr, default_margin_pct, default_incremental_share)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);

    // Standard reference creators conforming to C24 specification
    insertCreator.run('CR1', 'Aarav Sharma', 'Lifestyle', 0, JSON.stringify([]), 400000, 1800, 700, 40, 0.8);
    insertCreator.run('CR2', 'Meera Kapoor', 'Fashion', 0, JSON.stringify([]), 250000, 1500, 600, 40, 0.8);
    insertCreator.run('CR3', 'Rohan Verma', 'Technology', 0, JSON.stringify(['B2']), 600000, 2200, 900, 40, 0.8); // works with B2 (rival of B1)
    insertCreator.run('CR4', 'Ananya Singh', 'Beauty', 0, JSON.stringify([]), 150000, 1200, 500, 40, 0.8);
    insertCreator.run('CR5', 'Kabir Mehta', 'Fitness', 1, JSON.stringify([]), 300000, 1600, 650, 40, 0.8); // excluded: true
    insertCreator.run('CR6', 'Isha Patel', 'Lifestyle', 0, null, 100000, 2000, 800, 40, 0.8); // relationships: null (unknown)
    insertCreator.run('CR7', 'Vivaan Rao', 'Technology', 0, JSON.stringify([]), 500000, 2100, 850, 40, 0.8);
    insertCreator.run('CR8', 'Diya Malhotra', 'Fashion', 0, JSON.stringify([]), 200000, 1400, 550, 40, 0.8);
  }
}
