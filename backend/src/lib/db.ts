import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runMigrations, LATEST_SCHEMA_VERSION } from './migrations.ts';

let dbInstance: DatabaseSync | null = null;

function resolveWorkspaceDataDir(): string {
  // Check upwards from cwd first
  let candidate = process.cwd();
  for (let i = 0; i < 4; i++) {
    const pkgPath = path.join(candidate, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === 'creator-campaign-contribution-planner') {
          return path.join(candidate, 'data');
        }
      } catch {}
    }
    const parent = path.dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }

  // Check upwards from import.meta.url
  try {
    let metaCandidate = path.dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 5; i++) {
      const pkgPath = path.join(metaCandidate, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.name === 'creator-campaign-contribution-planner') {
            return path.join(metaCandidate, 'data');
          }
        } catch {}
      }
      const parent = path.dirname(metaCandidate);
      if (parent === metaCandidate) break;
      metaCandidate = parent;
    }
  } catch {}

  return path.resolve(process.cwd(), 'data');
}

export function getDbPath(): string {
  const isProd = process.env.APP_ENV === 'production';
  if (isProd) {
    if (!process.env.DATABASE_PATH || process.env.DATABASE_PATH === ':memory:') {
      throw new Error('Production environment requires DATABASE_PATH to be configured with a persistent disk path.');
    }
    return process.env.DATABASE_PATH;
  }
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  const dataDir = resolveWorkspaceDataDir();
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

  // Numbered migrations with schema version check
  runMigrations(db);

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
  process.env.DATABASE_PATH = inMemory ? ':memory:' : path.join(resolveWorkspaceDataDir(), 'test.db');
  return getDb();
}

function seedReferenceData(db: DatabaseSync): void {
  const isProd = process.env.APP_ENV === 'production';
  if (isProd) {
    // Strictly refuse seeding in production
    return;
  }

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

  const cr1Exists = db.prepare("SELECT 1 FROM creators WHERE creator_id = 'CR1';").get();
  if (!cr1Exists) {
    const insertCreator = db.prepare(`
      INSERT INTO creators (
        creator_id, name, category, excluded, relationships,
        default_fee_inr, default_fee_paise,
        default_sp_inr, default_sp_paise,
        default_cp_inr, default_cp_paise,
        default_margin_pct, default_incremental_share
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);

    // Standard reference creators conforming to C24 specification
    insertCreator.run('CR1', 'Aarav Sharma', 'Lifestyle', 0, JSON.stringify([]), 400000, 40000000, 1800, 180000, 700, 70000, 40, 0.8);
    insertCreator.run('CR2', 'Meera Kapoor', 'Fashion', 0, JSON.stringify([]), 250000, 25000000, 1500, 150000, 600, 60000, 40, 0.8);
    insertCreator.run('CR3', 'Rohan Verma', 'Technology', 0, JSON.stringify(['B2']), 600000, 60000000, 2200, 220000, 900, 90000, 40, 0.8);
    insertCreator.run('CR4', 'Ananya Singh', 'Beauty', 0, JSON.stringify([]), 150000, 15000000, 1200, 120000, 500, 50000, 40, 0.8);
    insertCreator.run('CR5', 'Kabir Mehta', 'Fitness', 1, JSON.stringify([]), 300000, 30000000, 1600, 160000, 650, 65000, 40, 0.8);
    insertCreator.run('CR6', 'Isha Patel', 'Lifestyle', 0, null, 100000, 10000000, 2000, 200000, 800, 80000, 40, 0.8);
    insertCreator.run('CR7', 'Vivaan Rao', 'Technology', 0, JSON.stringify([]), 500000, 50000000, 2100, 210000, 850, 85000, 40, 0.8);
    insertCreator.run('CR8', 'Diya Malhotra', 'Fashion', 0, JSON.stringify([]), 200000, 20000000, 1400, 140000, 550, 55000, 40, 0.8);
  }
}
