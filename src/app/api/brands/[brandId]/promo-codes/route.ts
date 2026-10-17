import { NextRequest, NextResponse } from 'next/server';
import { authenticateBrand } from '@/lib/auth';
import { getDb } from '@/lib/db';
import {
  parseAndValidateIsoDate,
  derivePromoStatus,
  validatePromoCodeFormat,
  checkEligibility
} from '@/lib/promoLogic';

const ALLOWED_REGISTRATION_FIELDS = new Set(['code', 'creator_id', 'valid_from', 'valid_to']);

export async function POST(
  req: NextRequest,
  { params }: { params: { brandId: string } }
) {
  const brandId = params.brandId;
  const auth = authenticateBrand(req, brandId);
  if (!auth.success) {
    return auth.response;
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
  }

  // Strict extra fields check: reject any unexpected field naming it
  const extraFields = Object.keys(body).filter((k) => !ALLOWED_REGISTRATION_FIELDS.has(k));
  if (extraFields.length > 0) {
    return NextResponse.json(
      { error: `unexpected field: ${extraFields.join(', ')}` },
      { status: 400 }
    );
  }

  // Check required fields
  for (const field of ALLOWED_REGISTRATION_FIELDS) {
    if (!(field in body) || body[field] === null || body[field] === undefined) {
      return NextResponse.json({ error: `Field "${field}" is required.` }, { status: 400 });
    }
  }

  let cleanCode: string;
  try {
    cleanCode = validatePromoCodeFormat(body.code);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const creatorId = String(body.creator_id).trim();

  let validFromDate: Date;
  let validToDate: Date;
  try {
    validFromDate = parseAndValidateIsoDate('valid_from', body.valid_from);
    validToDate = parseAndValidateIsoDate('valid_to', body.valid_to);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  if (validFromDate.getTime() > validToDate.getTime()) {
    return NextResponse.json(
      { error: 'Field "valid_from" must not be after "valid_to".' },
      { status: 400 }
    );
  }

  const db = getDb();

  // Check eligibility and rival conflict
  const eligibility = checkEligibility(db, brandId, creatorId);
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reason }, { status: 422 });
  }

  // Check uniqueness within brand
  const existing = db
    .prepare('SELECT id FROM promo_codes WHERE brand_id = ? AND code = ?;')
    .get(brandId, cleanCode);
  if (existing) {
    return NextResponse.json(
      { error: `Promo code "${cleanCode}" is already registered for brand "${brandId}".` },
      { status: 409 }
    );
  }

  const validFromIso = validFromDate.toISOString();
  const validToIso = validToDate.toISOString();
  const createdAtIso = new Date().toISOString();

  db.prepare(`
    INSERT INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
    VALUES (?, ?, ?, ?, ?, ?);
  `).run(brandId, cleanCode, creatorId, validFromIso, validToIso, createdAtIso);

  const status = derivePromoStatus(validFromIso, validToIso);

  return NextResponse.json(
    {
      code: cleanCode,
      creator_id: creatorId,
      valid_from: validFromIso,
      valid_to: validToIso,
      status
    },
    { status: 201 }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { brandId: string } }
) {
  const brandId = params.brandId;
  const auth = authenticateBrand(req, brandId);
  if (!auth.success) {
    return auth.response;
  }

  const db = getDb();
  const promoRows = db
    .prepare('SELECT * FROM promo_codes WHERE brand_id = ? ORDER BY code ASC;')
    .all(brandId) as Array<{
    code: string;
    creator_id: string;
    valid_from: string;
    valid_to: string;
  }>;

  // Aggregate stats per promo code
  const result = promoRows.map((promo) => {
    const orders = db
      .prepare(`
        SELECT subtotal_inr, discount_inr, total_inr, used_at, validity_flag
        FROM orders
        WHERE brand_id = ? AND promo_code = ? AND status != 'cancelled' AND status != 'refunded';
      `)
      .all(brandId, promo.code) as Array<{
      subtotal_inr: number;
      discount_inr: number | null;
      total_inr: number | null;
      used_at: string;
      validity_flag: string;
    }>;

    const use_count = orders.length;
    let last_used_at: string | null = null;
    let hasUnknownDiscount = false;
    let totalDiscount = 0;
    let totalRevenue = 0;

    for (const o of orders) {
      if (!last_used_at || new Date(o.used_at) > new Date(last_used_at)) {
        last_used_at = o.used_at;
      }
      if (o.discount_inr === null) {
        hasUnknownDiscount = true;
      } else {
        totalDiscount += o.discount_inr;
      }
      if (o.total_inr === null) {
        hasUnknownDiscount = true;
      } else {
        totalRevenue += o.total_inr;
      }
    }

    return {
      code: promo.code,
      creator_id: promo.creator_id,
      valid_from: promo.valid_from,
      valid_to: promo.valid_to,
      status: derivePromoStatus(promo.valid_from, promo.valid_to),
      use_count,
      last_used_at,
      discount_inr: hasUnknownDiscount ? null : Math.round(totalDiscount * 100) / 100,
      total_inr: hasUnknownDiscount ? null : Math.round(totalRevenue * 100) / 100
    };
  });

  return NextResponse.json(result, { status: 200 });
}
