import { NextRequest, NextResponse } from 'next/server';
import { authenticateBrand, authenticateReportKey } from '@/lib/auth';
import { validateAndIngestOrder } from '@/lib/orderIngestion';
import { getDb } from '@/lib/db';
import { canonicalHash } from '@/lib/promoLogic';
import { validateMoneyDecimals } from '@/lib/moneyValidation';

export async function POST(
  req: NextRequest,
  { params }: { params: { brandId: string; code: string } }
) {
  const { brandId, code } = params;
  const auth = authenticateReportKey(req, brandId);
  if (!auth.success) {
    return auth.response;
  }

  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > 1024 * 1024) {
    return NextResponse.json({ error: 'Payload Too Large, maximum 1MB' }, { status: 413 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  // Pre-controller decimal validation
  const decimalValidation = validateMoneyDecimals(body);
  if (!decimalValidation.valid) {
    return NextResponse.json({ error: decimalValidation.error }, { status: 400 });
  }

  const cleanCode = code.toUpperCase();
  const db = getDb();

  // Check idempotency before ingestion
  if (body && typeof body.order_id === 'string') {
    const existing = db
      .prepare('SELECT raw_payload FROM orders WHERE brand_id = ? AND order_id = ?;')
      .get(brandId, body.order_id.trim()) as { raw_payload: string | null } | undefined;

    if (existing && existing.raw_payload) {
      try {
        const existingHash = canonicalHash(JSON.parse(existing.raw_payload));
        const incomingHash = canonicalHash(body);
        if (existingHash === incomingHash) {
          return NextResponse.json(
            { duplicate: true, order_id: body.order_id.trim() },
            { status: 200 }
          );
        }
      } catch {}
    }
  }

  try {
    const result = validateAndIngestOrder(brandId, body, cleanCode);

    if ('duplicate' in result || !('items' in result)) {
      return NextResponse.json(result, { status: 200 });
    }

    const eventName = result.registered ? 'use_recorded' : 'unregistered_use_recorded';
    const eventPayload = {
      order_id: result.order_id,
      code: cleanCode,
      promo_code: result.promo_code,
      registered: result.registered,
      validity_flag: result.validity_flag,
      used_at: body.used_at,
      discount_inr: result.discount_inr,
      discount_basis: result.discount_basis,
      subtotal_inr: result.subtotal_inr,
      total_inr: result.total_inr,
      source: 'website'
    };

    try {
      const { getSseHub } = await import('@/lib/sseHub');
      getSseHub().publish(brandId, eventName, eventPayload);
    } catch (err) {
      console.error('Failed to publish redemptions SSE event:', err);
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    const statusCode = err.status || 500;
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: statusCode });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { brandId: string; code: string } }
) {
  const { brandId, code } = params;
  const auth = authenticateBrand(req, brandId);
  if (!auth.success) {
    return auth.response;
  }

  const cleanCode = code.toUpperCase();
  const db = getDb();

  const orders = db
    .prepare(`
      SELECT id, order_id, customer_id, used_at, subtotal_inr, discount_inr, discount_basis, total_inr, status, validity_flag, source
      FROM orders
      WHERE brand_id = ? AND promo_code = ?
      ORDER BY used_at DESC;
    `)
    .all(brandId, cleanCode) as Array<any>;

  for (const o of orders) {
    o.items = db
      .prepare(`
        SELECT product_id, name, unit_price_inr, quantity, gross_inr, line_discount_inr, net_inr
        FROM order_items
        WHERE order_id_ref = ?;
      `)
      .all(o.id);
  }

  return NextResponse.json(orders, { status: 200 });
}
