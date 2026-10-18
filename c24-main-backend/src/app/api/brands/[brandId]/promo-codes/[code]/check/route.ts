import { NextRequest, NextResponse } from 'next/server';
import { authenticateReportKey } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { derivePromoStatus } from '@/lib/promoLogic';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { brandId: string; code: string } }
) {
  const { brandId, code } = params;
  const auth = authenticateReportKey(req, brandId);
  if (!auth.success) {
    return auth.response;
  }

  const cleanCode = code.toUpperCase();
  const db = getDb();
  const promo = db
    .prepare('SELECT valid_from, valid_to FROM promo_codes WHERE brand_id = ? AND code = ?;')
    .get(brandId, cleanCode) as { valid_from: string; valid_to: string } | undefined;

  if (!promo) {
    return NextResponse.json({
      code: cleanCode,
      valid: false,
      reason: 'not_found',
      status: 'unknown',
      valid_from: null,
      valid_to: null
    });
  }

  const status = derivePromoStatus(promo.valid_from, promo.valid_to);
  return NextResponse.json({
    code: cleanCode,
    valid: status === 'valid',
    reason: status,
    status,
    valid_from: promo.valid_from,
    valid_to: promo.valid_to
  });
}
