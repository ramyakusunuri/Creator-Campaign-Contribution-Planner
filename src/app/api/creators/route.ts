import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkEligibility } from '@/lib/promoLogic';

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
