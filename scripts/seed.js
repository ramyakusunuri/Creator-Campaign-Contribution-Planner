#!/usr/bin/env node

/**
 * scripts/seed.js
 * 
 * Database seed script for Demo & Presentation (Phase B9).
 * Seeds brands, creators, creator profiles, snapshots, and promo codes.
 * Refuses to run if target environment is not 'demo'.
 */

import { getDb } from '../backend/src/lib/db.ts';

const appEnv = process.env.APP_ENV || 'demo';
if (appEnv !== 'demo') {
  console.error(`[Seed REFUSAL] Cannot seed database in non-demo environment: "${appEnv}".`);
  process.exit(1);
}

console.log('[Seed] Initializing SQLite database with demo fixtures...');
const db = getDb();

// 1. Seed creators with rich profiles and snapshots
const creatorFixtures = [
  {
    creator_id: 'C1',
    name: 'Aarav Sharma',
    category: 'Fashion & Lifestyle',
    platform: 'youtube',
    handle: '@aaravstyle',
    canonical_url: 'https://youtube.com/@aaravstyle',
    count: 250000,
    exact_or_rounded: 'rounded',
    hidden: 0,
    fee_inr: 200000
  },
  {
    creator_id: 'C2',
    name: 'Diya Patel',
    category: 'Beauty & Skincare',
    platform: 'instagram',
    handle: '@diyaglow',
    canonical_url: 'https://instagram.com/diyaglow',
    count: 480000,
    exact_or_rounded: 'exact',
    hidden: 0,
    fee_inr: 150000
  },
  {
    creator_id: 'C3',
    name: 'Kabir Mehta',
    category: 'Tech & Gadgets',
    platform: 'youtube',
    handle: '@kabirreviews',
    canonical_url: 'https://youtube.com/@kabirreviews',
    count: null, // Hidden count test case
    exact_or_rounded: 'rounded',
    hidden: 1,
    fee_inr: 180000
  },
  {
    creator_id: 'C4',
    name: 'Ananya Roy',
    category: 'Fitness & Health',
    platform: 'instagram',
    handle: '@ananyafit',
    canonical_url: 'https://instagram.com/ananyafit',
    count: 85000,
    exact_or_rounded: 'rounded',
    hidden: 0,
    fee_inr: 80000
  },
  {
    creator_id: 'C5',
    name: 'Rohan Verma',
    category: 'Gaming & Streaming',
    platform: 'youtube',
    handle: '@rohangames',
    canonical_url: 'https://youtube.com/@rohangames',
    count: 1200000,
    exact_or_rounded: 'rounded',
    hidden: 0,
    fee_inr: 350000
  }
];

db.exec('BEGIN IMMEDIATE;');
try {
  const insertProfile = db.prepare(`
    INSERT INTO creator_profiles (creator_id, platform, handle, canonical_url, platform_account_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(creator_id, platform) DO UPDATE SET
      handle = excluded.handle,
      canonical_url = excluded.canonical_url;
  `);

  const insertSnapshot = db.prepare(`
    INSERT INTO creator_snapshots (creator_id, platform, count, exact_or_rounded, hidden_flag, fetched_time, source, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  `);

  for (const c of creatorFixtures) {
    insertProfile.run(c.creator_id, c.platform, c.handle, c.canonical_url, null);
    insertSnapshot.run(
      c.creator_id,
      c.platform,
      c.count,
      c.exact_or_rounded,
      c.hidden,
      new Date().toISOString(),
      'demo_seed',
      'ok'
    );
  }

  // 2. Seed active promo codes
  const insertPromo = db.prepare(`
    INSERT INTO promo_codes (code, brand_id, creator_id, valid_from, valid_to, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(brand_id, code) DO UPDATE SET
      valid_from = excluded.valid_from,
      valid_to = excluded.valid_to;
  `);

  const now = new Date();
  const validFrom = new Date(now.getTime() - 7 * 86400000).toISOString();
  const validTo = new Date(now.getTime() + 30 * 86400000).toISOString();

  insertPromo.run('AARAV10', 'B1', 'C1', validFrom, validTo, now.toISOString());
  insertPromo.run('DIYA15', 'B1', 'C2', validFrom, validTo, now.toISOString());
  insertPromo.run('KABIRTECH', 'B1', 'C3', validFrom, validTo, now.toISOString());
  insertPromo.run('AARAVB2', 'B2', 'C1', validFrom, validTo, now.toISOString());

  db.exec('COMMIT;');
  console.log('[Seed SUCCESS] Demo creators, profiles, snapshots, and promo codes seeded successfully.');
} catch (err) {
  db.exec('ROLLBACK;');
  console.error('[Seed FAILED]', err);
  process.exit(1);
}
