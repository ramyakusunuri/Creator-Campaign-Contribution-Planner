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

  const responsePayload = {
    code: cleanCode,
    creator_id: creatorId,
    valid_from: validFromIso,
    valid_to: validToIso,
    status
  };

  try {
    const { getSseHub } = await import('@/lib/sseHub');
    getSseHub().publish(brandId, 'promo_created', responsePayload);
  } catch (err) {
    console.error('Failed to publish promo_created SSE event:', err);
  }

  return NextResponse.json(responsePayload, { status: 201 });
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

    const creator = db.prepare('SELECT default_fee_inr FROM creators WHERE creator_id = ?;').get(promo.creator_id) as any;
    const fee = creator?.default_fee_inr ?? null;

    const unitsRow = db.prepare(`
      SELECT SUM(oi.quantity) as total_units
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id_ref
      WHERE o.brand_id = ? AND o.promo_code = ? AND o.status != 'cancelled' AND o.status != 'refunded';
    `).get(brandId, promo.code) as any;
    const units = unitsRow?.total_units || 0;

    let cost_per_unit: number | null = null;
    let cost_per_unit_status: 'ok' | 'fee_unknown' | 'no_units' = 'ok';
    if (fee === null || fee === undefined) {
      cost_per_unit_status = 'fee_unknown';
    } else if (units === 0) {
      cost_per_unit_status = 'no_units';
    } else {
      cost_per_unit = Math.round((fee / units) * 100) / 100;
    }

    return {
      code: promo.code,
      creator_id: promo.creator_id,
      valid_from: promo.valid_from,
      valid_to: promo.valid_to,
      status: derivePromoStatus(promo.valid_from, promo.valid_to),
      use_count,
      last_used_at,
      units,
      creator_fee: fee,
      cost_per_unit,
      cost_per_unit_status,
      cost_per_unit_basis: 'returns not deducted',
      discount_inr: hasUnknownDiscount ? null : Math.round(totalDiscount * 100) / 100,
      total_inr: hasUnknownDiscount ? null : Math.round(totalRevenue * 100) / 100
    };
  });

  return NextResponse.json(result, { status: 200 });
}
