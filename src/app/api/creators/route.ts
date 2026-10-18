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

  const result = creators.map((c) => {
    const eligibility = checkEligibility(db, brandId, c.creator_id);
    return {
      id: c.creator_id,
      creator_id: c.creator_id,
      name: c.name,
      category: c.category,
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
  const auth = authenticateAgencyKey(req);
  if (!auth.success) {
    return auth.response;
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

  if (!body.creator_id || typeof body.creator_id !== 'string') {
    return NextResponse.json({ error: 'Field "creator_id" is required.' }, { status: 400 });
  }
  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'Field "name" is required.' }, { status: 400 });
  }
  if (!body.category || typeof body.category !== 'string') {
    return NextResponse.json({ error: 'Field "category" is required.' }, { status: 400 });
  }

  const creatorId = body.creator_id.trim();
  const name = body.name.trim();
  const category = body.category.trim();
  const excluded = body.excluded ? 1 : 0;
  const relationships = body.relationships !== undefined && body.relationships !== null
    ? JSON.stringify(body.relationships)
    : null;

  const feeInr = typeof body.default_fee_inr === 'number' ? body.default_fee_inr : 200000;
  const spInr = typeof body.default_sp_inr === 'number' ? body.default_sp_inr : 1500;
  const cpInr = typeof body.default_cp_inr === 'number' ? body.default_cp_inr : 600;
  const marginPct = typeof body.default_margin_pct === 'number' ? body.default_margin_pct : 40;
  const incrementalShare = typeof body.default_incremental_share === 'number' ? body.default_incremental_share : 0.8;

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
      default_margin_pct, default_incremental_share
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      default_incremental_share = excluded.default_incremental_share;
  `).run(
    creatorId, name, category, excluded, relationships,
    feeInr, feePaise, spInr, spPaise, cpInr, cpPaise,
    marginPct, incrementalShare
  );

  return NextResponse.json({
    creator_id: creatorId,
    name,
    category,
    excluded: excluded === 1,
    relationships: relationships ? JSON.parse(relationships) : null,
    default_fee_inr: feeInr,
    default_sp_inr: spInr,
    default_cp_inr: cpInr,
    default_margin_pct: marginPct,
    default_incremental_share: incrementalShare
  }, { status: 201 });
}
