import { DatabaseSync } from 'node:sqlite';

export const LATEST_SCHEMA_VERSION = 5;

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
  },
  {
    version: 3,
    name: '003_b3_promo_lifecycle_and_unregistered',
    up: (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS promo_code_audit (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_id TEXT NOT NULL,
          code TEXT NOT NULL,
          old_valid_from TEXT,
          old_valid_to TEXT,
          new_valid_from TEXT,
          new_valid_to TEXT,
          updated_at TEXT NOT NULL,
          changed_by TEXT NOT NULL DEFAULT 'brand_dashboard'
        );

        CREATE TABLE IF NOT EXISTS unregistered_code_uses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_id TEXT NOT NULL,
          order_id TEXT NOT NULL,
          code_entered TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          subtotal_inr REAL NOT NULL,
          subtotal_paise INTEGER NOT NULL,
          discount_inr REAL NULL,
          discount_paise INTEGER NULL,
          total_inr REAL NULL,
          total_paise INTEGER NULL,
          used_at TEXT NOT NULL,
          payment_confirmed_at TEXT NULL,
          raw_payload TEXT,
          created_at TEXT NOT NULL,
          UNIQUE(brand_id, order_id)
        );
      `);

      try {
        db.exec("ALTER TABLE orders ADD COLUMN payment_confirmed_at TEXT NULL;");
      } catch {}
    }
  },
  {
    version: 4,
    name: '004_creator_finder_and_shortlist',
    up: (db: DatabaseSync) => {
      db.exec(`
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
          count INTEGER NULL,
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
      `);
    }
  },
  {
    version: 5,
    name: '005_frontend_creator_raw_inputs',
    up: (db: DatabaseSync) => {
      const rawCols = [
        { col: 'slug', type: 'TEXT NULL' },
        { col: 'handle', type: 'TEXT NULL' },
        { col: 'location', type: 'TEXT NULL' },
        { col: 'followers', type: 'INTEGER NULL' },
        { col: 'primary_platform', type: 'TEXT NULL' },
        { col: 'bio', type: 'TEXT NULL' },
        { col: 'orders', type: 'INTEGER NOT NULL DEFAULT 0' },
        { col: 'discount', type: 'REAL NOT NULL DEFAULT 0' },
        { col: 'sp_inr', type: 'REAL NOT NULL DEFAULT 0' },
        { col: 'sp_paise', type: 'INTEGER NOT NULL DEFAULT 0' },
        { col: 'cp_inr', type: 'REAL NOT NULL DEFAULT 0' },
        { col: 'cp_paise', type: 'INTEGER NOT NULL DEFAULT 0' },
        { col: 'fee_inr', type: 'REAL NOT NULL DEFAULT 0' },
        { col: 'fee_paise', type: 'INTEGER NOT NULL DEFAULT 0' },
        { col: 'clicks', type: 'INTEGER NOT NULL DEFAULT 0' },
        { col: 'buys', type: 'INTEGER NOT NULL DEFAULT 0' }
      ];

      for (const rc of rawCols) {
        try {
          db.exec(`ALTER TABLE creators ADD COLUMN ${rc.col} ${rc.type};`);
        } catch {}
      }

      // Seed 8 frontend creators with RAW inputs only (no calculated/derived fields stored)
      const rawCreators = [
        {
          creator_id: 'creator_001',
          slug: 'creator_001',
          name: 'Aarav Mehta',
          category: 'Photography & Travel',
          handle: '@aaravframes',
          location: 'Mumbai, Maharashtra',
          followers: 48200,
          primary_platform: 'Instagram',
          bio: 'Cinematic city escapes, practical travel guides, and photography tips.',
          orders: 1800,
          discount: 10,
          sp_inr: 1800,
          sp_paise: 180000,
          cp_inr: 700,
          cp_paise: 70000,
          fee_inr: 400000,
          fee_paise: 40000000,
          clicks: 1800,
          buys: 90
        },
        {
          creator_id: 'creator_002',
          slug: 'creator_002',
          name: 'Diya Sharma',
          category: 'Beauty & Skincare',
          handle: '@diyabeautyedit',
          location: 'Delhi, India',
          followers: 73500,
          primary_platform: 'Instagram',
          bio: 'Clean beauty routines, ingredient deep-dives, and seasonal skincare edits.',
          orders: 1300,
          discount: 15,
          sp_inr: 1500,
          sp_paise: 150000,
          cp_inr: 600,
          cp_paise: 60000,
          fee_inr: 250000,
          fee_paise: 25000000,
          clicks: 2200,
          buys: 130
        },
        {
          creator_id: 'creator_003',
          slug: 'creator_003',
          name: 'Rohan Varma',
          category: 'Fitness & Health',
          handle: '@rohanlifts',
          location: 'Bengaluru, Karnataka',
          followers: 61200,
          primary_platform: 'YouTube',
          bio: 'Strength fundamentals, home workout splits, and recovery nutrition.',
          orders: 2400,
          discount: 8,
          sp_inr: 2200,
          sp_paise: 220000,
          cp_inr: 900,
          cp_paise: 90000,
          fee_inr: 600000,
          fee_paise: 60000000,
          clicks: 1950,
          buys: 110
        },
        {
          creator_id: 'creator_004',
          slug: 'creator_004',
          name: 'Ananya Iyer',
          category: 'Tech & Gadgets',
          handle: '@ananyatech',
          location: 'Hyderabad, Telangana',
          followers: 89400,
          primary_platform: 'YouTube',
          bio: 'Consumer electronics breakdowns, desk setups, and workflow software.',
          orders: 900,
          discount: 20,
          sp_inr: 1200,
          sp_paise: 120000,
          cp_inr: 500,
          cp_paise: 50000,
          fee_inr: 150000,
          fee_paise: 15000000,
          clicks: 3100,
          buys: 185
        },
        {
          creator_id: 'creator_005',
          slug: 'creator_005',
          name: 'Kabir Sen',
          category: 'Fashion & Lifestyle',
          handle: '@kabirfits',
          location: 'Mumbai, Maharashtra',
          followers: 54100,
          primary_platform: 'Instagram',
          bio: 'Everyday luxury menswear, capsule wardrobes, and sneaker styling.',
          orders: 1600,
          discount: 10,
          sp_inr: 1600,
          sp_paise: 160000,
          cp_inr: 650,
          cp_paise: 65000,
          fee_inr: 300000,
          fee_paise: 30000000,
          clicks: 2400,
          buys: 120
        },
        {
          creator_id: 'creator_006',
          slug: 'creator_006',
          name: 'Meera Nair',
          category: 'Food & Cooking',
          handle: '@meeraeats',
          location: 'Kochi, Kerala',
          followers: 66800,
          primary_platform: 'Instagram',
          bio: 'Modern coastal recipes, slow weekend cooking, and pantry shortcuts.',
          orders: 700,
          discount: 5,
          sp_inr: 2000,
          sp_paise: 200000,
          cp_inr: 800,
          cp_paise: 80000,
          fee_inr: 100000,
          fee_paise: 10000000,
          clicks: 2100,
          buys: 115
        },
        {
          creator_id: 'creator_007',
          slug: 'creator_007',
          name: 'Vikram Malhotra',
          category: 'Gaming & Esports',
          handle: '@vikramplay',
          location: 'Pune, Maharashtra',
          followers: 98300,
          primary_platform: 'YouTube',
          bio: 'Competitive PC gaming benchmarks, mechanical keyboards, and peripherals.',
          orders: 2000,
          discount: 12,
          sp_inr: 2100,
          sp_paise: 210000,
          cp_inr: 850,
          cp_paise: 85000,
          fee_inr: 500000,
          fee_paise: 50000000,
          clicks: 3400,
          buys: 200
        },
        {
          creator_id: 'creator_008',
          slug: 'creator_008',
          name: 'Pooja Joshi',
          category: 'Parenting & Family',
          handle: '@poojaparenting',
          location: 'Jaipur, Rajasthan',
          followers: 42900,
          primary_platform: 'Instagram',
          bio: 'Practical family routines, kid-friendly travel packing, and learning spaces.',
          orders: 1100,
          discount: 10,
          sp_inr: 1400,
          sp_paise: 140000,
          cp_inr: 550,
          cp_paise: 55000,
          fee_inr: 200000,
          fee_paise: 20000000,
          clicks: 1600,
          buys: 85
        }
      ];

      const stmt = db.prepare(`
        INSERT INTO creators (
          creator_id, slug, name, category, handle, location, followers, primary_platform, bio,
          orders, discount, sp_inr, sp_paise, cp_inr, cp_paise, fee_inr, fee_paise, clicks, buys,
          default_fee_inr, default_fee_paise, default_sp_inr, default_sp_paise, default_cp_inr, default_cp_paise,
          default_margin_pct, default_incremental_share
        ) VALUES (
          @creator_id, @slug, @name, @category, @handle, @location, @followers, @primary_platform, @bio,
          @orders, @discount, @sp_inr, @sp_paise, @cp_inr, @cp_paise, @fee_inr, @fee_paise, @clicks, @buys,
          @fee_inr, @fee_paise, @sp_inr, @sp_paise, @cp_inr, @cp_paise,
          40, 0.8
        )
        ON CONFLICT(creator_id) DO UPDATE SET
          slug = excluded.slug,
          name = excluded.name,
          category = excluded.category,
          handle = excluded.handle,
          location = excluded.location,
          followers = excluded.followers,
          primary_platform = excluded.primary_platform,
          bio = excluded.bio,
          orders = excluded.orders,
          discount = excluded.discount,
          sp_inr = excluded.sp_inr,
          sp_paise = excluded.sp_paise,
          cp_inr = excluded.cp_inr,
          cp_paise = excluded.cp_paise,
          fee_inr = excluded.fee_inr,
          fee_paise = excluded.fee_paise,
          clicks = excluded.clicks,
          buys = excluded.buys;
      `);

      for (const rc of rawCreators) {
        stmt.run(rc);
      }
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
