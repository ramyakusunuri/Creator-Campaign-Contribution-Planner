import { toPaise, fromPaise, canonicalHash } from './interface.js';
import { calculateCreatorCostPerUnit } from '../lib/costPerUnit.js';

let DatabaseSync;
try {
  const sqlite = await import('node:sqlite');
  DatabaseSync = sqlite.DatabaseSync;
} catch (err) {
  throw new Error(`node:sqlite is unavailable in Node ${process.version}. Please run on Node.js 22.5.0 or newer. (Node prints ExperimentalWarning for node:sqlite). Error: ${err.message}`);
}

export class SqliteStorage {
  constructor(dbPath, appEnv = 'demo') {
    this.dbPath = dbPath;
    this.appEnv = appEnv;
    this.db = new DatabaseSync(dbPath);

    // Initial setup
    this.db.exec('PRAGMA foreign_keys = ON;');
    if (dbPath !== ':memory:') {
      this.db.exec('PRAGMA journal_mode = WAL;');
    }

    this._runMigrations();
  }

  _runMigrations() {
    const CURRENT_VERSION = 1;
    const versionRow = this.db.prepare('PRAGMA user_version;').get();
    const currentDbVersion = versionRow.user_version || 0;

    if (currentDbVersion > CURRENT_VERSION) {
      throw new Error(`Database file version (${currentDbVersion}) is newer than supported code version (${CURRENT_VERSION}).`);
    }

    if (currentDbVersion === 0) {
      this.db.exec(`
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
          registered INTEGER NOT NULL,
          customer_id TEXT NOT NULL,
          used_at TEXT NOT NULL,
          payment_confirmed_at TEXT NOT NULL,
          received_at TEXT NOT NULL,
          discount_paise INTEGER,
          line_discount_basis TEXT,
          source TEXT NOT NULL,
          validity_flag TEXT NOT NULL,
          payload_raw TEXT NOT NULL,
          payload_hash TEXT NOT NULL,
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

        CREATE TABLE IF NOT EXISTS creator_profiles (
          creator_id TEXT NOT NULL,
          platform TEXT NOT NULL,
          handle TEXT NOT NULL,
          canonical_url TEXT NOT NULL,
          platform_account_id TEXT,
          PRIMARY KEY (creator_id, platform)
        );

        CREATE TABLE IF NOT EXISTS creator_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          creator_id TEXT NOT NULL,
          platform TEXT NOT NULL,
          count INTEGER,
          exact_or_rounded TEXT NOT NULL DEFAULT 'rounded',
          hidden_flag INTEGER NOT NULL DEFAULT 0,
          fetched_time TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'manual',
          status TEXT NOT NULL DEFAULT 'ok'
        );

        CREATE TABLE IF NOT EXISTS shortlists (
          brand_id TEXT NOT NULL,
          creator_id TEXT NOT NULL,
          added_at TEXT NOT NULL,
          notes TEXT,
          PRIMARY KEY (brand_id, creator_id)
        );

        PRAGMA user_version = 1;
      `);

      this.db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?);').run('environment', this.appEnv);
    }
  }

  createPromo(brandId, promoData) {
    const { code, creator_id, valid_from, valid_to, created_at = new Date().toISOString() } = promoData;
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const existing = this.db.prepare('SELECT code FROM promo_codes WHERE brand_id = ? AND code = ?;').get(brandId, code);
      if (existing) {
        const err = new Error(`Promo code "${code}" already exists for brand "${brandId}".`);
        err.status = 409;
        throw err;
      }

      this.db.prepare(`
        INSERT INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
        VALUES (?, ?, ?, ?, ?, ?);
      `).run(brandId, code, creator_id, valid_from, valid_to, created_at);

      this.db.prepare(`
        INSERT INTO audit_log (at, brand_id, code, action, changes)
        VALUES (?, ?, ?, ?, ?);
      `).run(
        created_at,
        brandId,
        code,
        'CREATE_PROMO_CODE',
        JSON.stringify({ code, creator_id, valid_from, valid_to })
      );

      this.db.exec('COMMIT;');
      return { brand_id: brandId, code, creator_id, valid_from, valid_to, created_at };
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  patchPromo(brandId, code, patchData) {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const promo = this.db.prepare('SELECT * FROM promo_codes WHERE brand_id = ? AND code = ?;').get(brandId, code);
      if (!promo) {
        const err = new Error(`Promo code "${code}" not found for brand "${brandId}".`);
        err.status = 404;
        throw err;
      }

      const valid_from = patchData.valid_from !== undefined ? patchData.valid_from : promo.valid_from;
      const valid_to = patchData.valid_to !== undefined ? patchData.valid_to : promo.valid_to;
      const now = new Date().toISOString();

      this.db.prepare(`
        UPDATE promo_codes
        SET valid_from = ?, valid_to = ?
        WHERE brand_id = ? AND code = ?;
      `).run(valid_from, valid_to, brandId, code);

      this.db.prepare(`
        INSERT INTO audit_log (at, brand_id, code, action, changes)
        VALUES (?, ?, ?, ?, ?);
      `).run(
        now,
        brandId,
        code,
        'PATCH_PROMO_CODE',
        JSON.stringify({ valid_from, valid_to })
      );

      this.db.exec('COMMIT;');
      return { brand_id: brandId, code, creator_id: promo.creator_id, valid_from, valid_to, created_at: promo.created_at };
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  getPromo(brandId, code) {
    const row = this.db.prepare('SELECT * FROM promo_codes WHERE brand_id = ? AND code = ?;').get(brandId, code);
    return row || null;
  }

  listPromos(brandId) {
    return this.db.prepare('SELECT * FROM promo_codes WHERE brand_id = ? ORDER BY code ASC;').all(brandId);
  }

  recordUse(brandId, useData, items) {
    const {
      order_id,
      code_entered,
      registered,
      customer_id,
      used_at,
      payment_confirmed_at,
      received_at,
      discount_paise,
      line_discount_basis,
      source,
      validity_flag,
      payload_raw,
      payload_hash
    } = useData;

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      // Check idempotency
      const existing = this.db.prepare('SELECT * FROM uses WHERE brand_id = ? AND order_id = ?;').get(brandId, order_id);
      if (existing) {
        if (existing.payload_hash === payload_hash) {
          this.db.exec('COMMIT;');
          return { duplicate: true, use: existing };
        } else {
          const err = new Error('order_id already reported with different data');
          err.status = 409;
          throw err;
        }
      }

      const insertUse = this.db.prepare(`
        INSERT INTO uses (
          brand_id, order_id, code_entered, registered, customer_id, used_at,
          payment_confirmed_at, received_at, discount_paise, line_discount_basis,
          source, validity_flag, payload_raw, payload_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `);

      const res = insertUse.run(
        brandId,
        order_id,
        code_entered,
        registered ? 1 : 0,
        customer_id,
        used_at,
        payment_confirmed_at,
        received_at,
        discount_paise,
        line_discount_basis,
        source,
        validity_flag,
        payload_raw,
        payload_hash
      );

      const useId = Number(res.lastInsertRowid);

      const insertItem = this.db.prepare(`
        INSERT INTO use_items (
          use_id, line_no, product_id, name, unit_price_paise, quantity, line_discount_paise
        ) VALUES (?, ?, ?, ?, ?, ?, ?);
      `);

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        insertItem.run(
          useId,
          i + 1,
          it.product_id,
          it.name || null,
          it.unit_price_paise,
          it.quantity,
          it.line_discount_paise !== undefined ? it.line_discount_paise : null
        );
      }

      this.db.prepare(`
        INSERT INTO audit_log (at, brand_id, code, action, changes)
        VALUES (?, ?, ?, ?, ?);
      `).run(
        received_at,
        brandId,
        code_entered,
        'RECORD_USE',
        JSON.stringify({ order_id, registered, total_items: items.length })
      );

      this.db.exec('COMMIT;');
      return {
        duplicate: false,
        use: {
          id: useId,
          brand_id: brandId,
          order_id,
          code_entered,
          registered: !!registered,
          customer_id,
          used_at,
          payment_confirmed_at,
          received_at,
          discount_paise,
          line_discount_basis,
          source,
          validity_flag
        }
      };
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  getUseByOrderId(brandId, orderId) {
    const use = this.db.prepare('SELECT * FROM uses WHERE brand_id = ? AND order_id = ?;').get(brandId, orderId);
    if (!use) return null;
    const items = this.db.prepare('SELECT * FROM use_items WHERE use_id = ? ORDER BY line_no ASC;').all(use.id);
    return { ...use, items };
  }

  listUses(brandId, code = null) {
    let sql = 'SELECT * FROM uses WHERE brand_id = ?';
    const params = [brandId];
    if (code) {
      sql += ' AND code_entered = ?';
      params.push(code);
    }
    sql += ' ORDER BY used_at DESC;';
    const uses = this.db.prepare(sql).all(...params);
    for (const u of uses) {
      u.items = this.db.prepare('SELECT * FROM use_items WHERE use_id = ? ORDER BY line_no ASC;').all(u.id);
    }
    return uses;
  }

  listUnregisteredUses(brandId) {
    const uses = this.db.prepare('SELECT * FROM uses WHERE brand_id = ? AND registered = 0 ORDER BY used_at DESC;').all(brandId);
    for (const u of uses) {
      u.items = this.db.prepare('SELECT * FROM use_items WHERE use_id = ? ORDER BY line_no ASC;').all(u.id);
    }
    return uses;
  }

  getReconciliation(brandId, fromIso, toIso) {
    const fromTime = new Date(fromIso).getTime();
    const toTime = new Date(toIso).getTime();

    // from inclusive, to exclusive
    const allUses = this.db.prepare(`
      SELECT * FROM uses
      WHERE brand_id = ? AND used_at >= ? AND used_at < ?
      ORDER BY used_at ASC;
    `).all(brandId, fromIso, toIso);

    if (allUses.length > 5000) {
      const err = new RangeError('range too large, narrow it');
      err.status = 400;
      throw err;
    }

    const registeredMap = new Map();
    const unregisteredList = [];

    for (const u of allUses) {
      const items = this.db.prepare('SELECT * FROM use_items WHERE use_id = ?;').all(u.id);
      let subtotalPaise = 0;
      let totalUnits = 0;
      for (const it of items) {
        subtotalPaise += it.unit_price_paise * it.quantity;
        totalUnits += it.quantity;
      }

      if (u.registered === 1) {
        let entry = registeredMap.get(u.code_entered);
        if (!entry) {
          entry = {
            code: u.code_entered,
            use_count: 0,
            units: 0,
            subtotal_paise: 0,
            order_ids: []
          };
          registeredMap.set(u.code_entered, entry);
        }
        entry.use_count++;
        entry.units += totalUnits;
        entry.subtotal_paise += subtotalPaise;
        entry.order_ids.push(u.order_id);
      } else {
        unregisteredList.push({
          order_id: u.order_id,
          code_entered: u.code_entered,
          used_at: u.used_at,
          units: totalUnits,
          subtotal_inr: fromPaise(subtotalPaise)
        });
      }
    }

    const registeredResults = Array.from(registeredMap.values()).map(r => ({
      code: r.code,
      use_count: r.use_count,
      units: r.units,
      subtotal_inr: fromPaise(r.subtotal_paise),
      order_ids: r.order_ids.sort()
    }));

    return {
      brand_id: brandId,
      from: fromIso,
      to: toIso,
      registered_codes: registeredResults,
      unregistered_uses: unregisteredList,
      generated_at: new Date().toISOString()
    };
  }

  getFeedStatus(brandId) {
    const row = this.db.prepare(`
      SELECT 
        MAX(received_at) as last_received,
        SUM(CASE WHEN source = 'website' THEN 1 ELSE 0 END) as website_count,
        SUM(CASE WHEN source = 'synthetic_seed' THEN 1 ELSE 0 END) as seed_count,
        SUM(CASE WHEN registered = 0 THEN 1 ELSE 0 END) as unreg_count
      FROM uses
      WHERE brand_id = ?;
    `).get(brandId);

    return {
      last_use_received_at: row.last_received || null,
      uses_by_source: {
        website: row.website_count || 0,
        synthetic_seed: row.seed_count || 0
      },
      unregistered_uses: row.unreg_count || 0
    };
  }

  purgeBySource(source) {
    if (source !== 'synthetic_seed') {
      throw new Error(`purgeBySource is only permitted for "synthetic_seed". Received: "${source}"`);
    }
    if (this.appEnv !== 'demo') {
      throw new Error('purgeBySource can only be executed in "demo" environment.');
    }

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      this.db.exec(`
        DELETE FROM use_items WHERE use_id IN (SELECT id FROM uses WHERE source = 'synthetic_seed');
        DELETE FROM uses WHERE source = 'synthetic_seed';
      `);
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  getCostPerUnit(brandId, creatorId, options = {}) {
    const allPromos = this.listPromos(brandId);
    const creatorPromos = allPromos.filter(p => p.creator_id === creatorId);
    const registeredCodes = creatorPromos.map(p => p.code);
    const allUses = this.listUses(brandId);
    return calculateCreatorCostPerUnit({
      brandId,
      creatorId,
      creatorName: options.creatorName,
      feeInr: options.feeInr,
      registeredCodes,
      uses: allUses,
      refunds: options.refunds || []
    });
  }

  saveCreatorProfile(creatorId, platform, handle, canonicalUrl, platformAccountId = null) {
    this.db.prepare(`
      INSERT OR REPLACE INTO creator_profiles (creator_id, platform, handle, canonical_url, platform_account_id)
      VALUES (?, ?, ?, ?, ?);
    `).run(creatorId, platform, handle, canonicalUrl, platformAccountId);
  }

  saveCreatorSnapshot(creatorId, platform, snapshotData) {
    const {
      count = null,
      exact_or_rounded = 'rounded',
      hidden_flag = 0,
      fetched_time = new Date().toISOString(),
      source = 'manual',
      status = 'ok'
    } = snapshotData;

    this.db.prepare(`
      INSERT INTO creator_snapshots (creator_id, platform, count, exact_or_rounded, hidden_flag, fetched_time, source, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `).run(creatorId, platform, count, exact_or_rounded, hidden_flag ? 1 : 0, fetched_time, source, status);
  }

  listCreatorProfilesWithLatestSnapshot(platform = null) {
    let sql = `
      SELECT 
        p.creator_id,
        p.platform,
        p.handle,
        p.canonical_url,
        p.platform_account_id,
        s.count,
        s.exact_or_rounded,
        s.hidden_flag,
        s.fetched_time,
        s.source,
        s.status
      FROM creator_profiles p
      LEFT JOIN creator_snapshots s ON s.id = (
        SELECT id FROM creator_snapshots 
        WHERE creator_id = p.creator_id AND platform = p.platform 
        ORDER BY id DESC LIMIT 1
      )
    `;
    const params = [];
    if (platform && platform !== 'all') {
      sql += ' WHERE p.platform = ?';
      params.push(platform);
    }
    sql += ' ORDER BY p.creator_id ASC;';
    return this.db.prepare(sql).all(...params);
  }

  addToShortlist(brandId, creatorId, notes = null) {
    const addedAt = new Date().toISOString();
    this.db.prepare(`
      INSERT OR REPLACE INTO shortlists (brand_id, creator_id, added_at, notes)
      VALUES (?, ?, ?, ?);
    `).run(brandId, creatorId, addedAt, notes);
    return { brand_id: brandId, creator_id: creatorId, added_at: addedAt, notes };
  }

  removeFromShortlist(brandId, creatorId) {
    this.db.prepare('DELETE FROM shortlists WHERE brand_id = ? AND creator_id = ?;').run(brandId, creatorId);
    return { success: true };
  }

  getShortlist(brandId) {
    return this.db.prepare(`
      SELECT s.brand_id, s.creator_id, s.added_at, s.notes
      FROM shortlists s
      WHERE s.brand_id = ?
      ORDER BY s.added_at DESC;
    `).all(brandId);
  }

  saveCsvProfilesBatch(rows) {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const insertProfile = this.db.prepare(`
        INSERT OR REPLACE INTO creator_profiles (creator_id, platform, handle, canonical_url, platform_account_id)
        VALUES (?, ?, ?, ?, ?);
      `);
      const insertSnapshot = this.db.prepare(`
        INSERT INTO creator_snapshots (creator_id, platform, count, exact_or_rounded, hidden_flag, fetched_time, source, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `);

      for (const row of rows) {
        insertProfile.run(row.creator_id, row.platform, row.handle, row.canonical_url, null);
        insertSnapshot.run(
          row.creator_id,
          row.platform,
          row.count,
          row.exact_or_rounded || 'rounded',
          row.hidden_flag || 0,
          row.fetched_time || new Date().toISOString(),
          row.source || 'csv_upload',
          row.status || 'ok'
        );
      }
      this.db.exec('COMMIT;');
      return { success: true, count: rows.length };
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  close() {
    try {
      this.db.close();
    } catch {}
  }
}
