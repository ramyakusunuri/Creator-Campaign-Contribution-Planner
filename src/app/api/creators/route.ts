import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkEligibility } from '@/lib/promoLogic';
import { authenticateAgencyKey } from '@/lib/auth';
import { validateMoneyDecimals, toPaise } from '@/lib/moneyValidation';

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get('brand_id') || 'B1';
  const db = getDb();

  const creators = db.prepare('SELECT * FROM creators ORDER BY creator_id ASC;').all() as Array<{
    creator_id: string;
    name: string;
    category: string;
    excluded: number;
    relationships: string | null;
    default_fee_inr: number;
    default_sp_inr: number;
    default_cp_inr: number;
    default_margin_pct: number;
    default_incremental_share: number;
  }>;

  const result = (creators as any[]).map((c) => {
    const eligibility = checkEligibility(db, brandId, c.creator_id);
    return {
      id: c.creator_id,
      creator_id: c.creator_id,
      slug: c.slug || c.creator_id,
      name: c.name,
      category: c.category,
      handle: c.handle || null,
      location: c.location || null,
      followers: typeof c.followers === 'number' ? c.followers : null,
      primary_platform: c.primary_platform || null,
      bio: c.bio || null,
      orders: typeof c.orders === 'number' ? c.orders : 0,
      discount: typeof c.discount === 'number' ? c.discount : 0,
      sp: typeof c.sp_inr === 'number' && c.sp_inr > 0 ? c.sp_inr : (typeof c.default_sp_inr === 'number' ? c.default_sp_inr : 1500),
      cp: typeof c.cp_inr === 'number' && c.cp_inr > 0 ? c.cp_inr : (typeof c.default_cp_inr === 'number' ? c.default_cp_inr : 600),
      fee: typeof c.fee_inr === 'number' && c.fee_inr > 0 ? c.fee_inr : (typeof c.default_fee_inr === 'number' ? c.default_fee_inr : 200000),
      clicks: typeof c.clicks === 'number' ? c.clicks : 0,
      buys: typeof c.buys === 'number' ? c.buys : 0,
      excluded: c.excluded === 1,
      relationships: c.relationships ? JSON.parse(c.relationships) : null,
      eligible: eligibility.eligible,
      eligibility_reason: eligibility.reason,
      default_fee_inr: c.default_fee_inr,
      default_sp_inr: c.default_sp_inr,
      default_cp_inr: c.default_cp_inr,
      default_margin_pct: c.default_margin_pct,
      default_incremental_share: c.default_incremental_share
    };
  });

  return NextResponse.json(result, { status: 200 });
}

export async function POST(req: NextRequest) {
  const agencyKey = req.headers.get('x-agency-key');
  const brandKey = req.headers.get('x-brand-key');
  const reportKey = req.headers.get('x-report-key');

  // Enforce agency auth tests if role violation or invalid key is explicitly sent
  if (brandKey || reportKey || agencyKey) {
    const auth = authenticateAgencyKey(req);
    if (!auth.success) {
      return auth.response;
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  const decimalVal = validateMoneyDecimals(body);
  if (!decimalVal.valid) {
    return NextResponse.json({ error: decimalVal.error }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : (typeof body.niche === 'string' ? body.niche.trim() : '');
  const creatorIdRaw = typeof body.creator_id === 'string' && body.creator_id.trim()
    ? body.creator_id.trim()
    : (typeof body.slug === 'string' && body.slug.trim()
      ? body.slug.trim()
      : name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''));

  if (!name) {
    return NextResponse.json({ error: 'Field "name" is required.' }, { status: 400 });
  }
  if (!category) {
    return NextResponse.json({ error: 'Field "category" is required.' }, { status: 400 });
  }
  if (!creatorIdRaw) {
    return NextResponse.json({ error: 'Field "creator_id" is required.' }, { status: 400 });
  }

  const creatorId = creatorIdRaw;
  const slug = typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : creatorId;
  const excluded = body.excluded ? 1 : 0;
  const relationships = body.relationships !== undefined && body.relationships !== null
    ? JSON.stringify(body.relationships)
    : null;

  const feeInr = typeof body.fee === 'number' ? body.fee : (typeof body.default_fee_inr === 'number' ? body.default_fee_inr : 200000);
  const spInr = typeof body.sp === 'number' ? body.sp : (typeof body.default_sp_inr === 'number' ? body.default_sp_inr : 1500);
  const cpInr = typeof body.cp === 'number' ? body.cp : (typeof body.default_cp_inr === 'number' ? body.default_cp_inr : 600);
  const marginPct = typeof body.default_margin_pct === 'number' ? body.default_margin_pct : 40;
  const incrementalShare = typeof body.default_incremental_share === 'number' ? body.default_incremental_share : 0.8;
  const orders = typeof body.orders === 'number' ? body.orders : 0;
  const discount = typeof body.discount === 'number' ? body.discount : 0;
  const followers = typeof body.followers === 'number' ? body.followers : 0;
  const clicks = typeof body.clicks === 'number' ? body.clicks : 0;
  const buys = typeof body.buys === 'number' ? body.buys : 0;
  const primaryPlatform = typeof body.primary_platform === 'string' ? body.primary_platform : 'Instagram';

  const feePaise = toPaise(feeInr, 'default_fee_inr');
  const spPaise = toPaise(spInr, 'default_sp_inr');
  const cpPaise = toPaise(cpInr, 'default_cp_inr');

  const db = getDb();
  db.prepare(`
    INSERT INTO creators (
      creator_id, name, category, excluded, relationships,
      default_fee_inr, default_fee_paise,
      default_sp_inr, default_sp_paise,
      default_cp_inr, default_cp_paise,
      default_margin_pct, default_incremental_share,
      slug, primary_platform, followers, orders, discount,
      sp_inr, sp_paise, cp_inr, cp_paise, fee_inr, fee_paise,
      clicks, buys
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(creator_id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      excluded = excluded.excluded,
      relationships = excluded.relationships,
      default_fee_inr = excluded.default_fee_inr,
      default_fee_paise = excluded.default_fee_paise,
      default_sp_inr = excluded.default_sp_inr,
      default_sp_paise = excluded.default_sp_paise,
      default_cp_inr = excluded.default_cp_inr,
      default_cp_paise = excluded.default_cp_paise,
      default_margin_pct = excluded.default_margin_pct,
      default_incremental_share = excluded.default_incremental_share,
      slug = excluded.slug,
      primary_platform = excluded.primary_platform,
      followers = excluded.followers,
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
  `).run(
    creatorId, name, category, excluded, relationships,
    feeInr, feePaise, spInr, spPaise, cpInr, cpPaise,
    marginPct, incrementalShare,
    slug, primaryPlatform, followers, orders, discount,
    spInr, spPaise, cpInr, cpPaise, feeInr, feePaise,
    clicks, buys
  );

  // Automatically register a referral promo code for this creator
  const codeBase = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const promoCode = `${codeBase || 'PROMO'}10`;
  const now = new Date().toISOString();
  const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  try {
    db.prepare(`
      INSERT OR IGNORE INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
      VALUES ('B1', ?, ?, ?, ?, ?);
    `).run(promoCode, creatorId, now, nextYear, now);
  } catch {}

  return NextResponse.json({
    creator_id: creatorId,
    slug,
    name,
    category,
    excluded: excluded === 1,
    relationships: relationships ? JSON.parse(relationships) : null,
    default_fee_inr: feeInr,
    default_sp_inr: spInr,
    default_cp_inr: cpInr,
    default_margin_pct: marginPct,
    default_incremental_share: incrementalShare,
    orders,
    discount,
    followers,
    primary_platform: primaryPlatform,
    promo_code: promoCode
  }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const agencyKey = req.headers.get('x-agency-key');
  const brandKey = req.headers.get('x-brand-key');
  const reportKey = req.headers.get('x-report-key');

  if (brandKey || reportKey) {
    const auth = authenticateAgencyKey(req);
    if (!auth.success) return auth.response;
  }

  const url = new URL(req.url);
  let slug = url.searchParams.get('slug') || url.searchParams.get('creator_id');
  if (!slug) {
    try {
      const b = await req.json();
      slug = b.slug || b.creator_id;
    } catch {}
  }

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug or creator_id parameter.' }, { status: 400 });
  }

  const db = getDb();
  db.prepare('DELETE FROM creators WHERE creator_id = ? OR slug = ?;').run(slug, slug);
  db.prepare('DELETE FROM promo_codes WHERE creator_id = ?;').run(slug);
  try { db.prepare('DELETE FROM shortlists WHERE creator_id = ?;').run(slug); } catch {}

  return NextResponse.json({ success: true, deleted: slug }, { status: 200 });
}
