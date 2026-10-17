import { NextRequest, NextResponse } from 'next/server';
import { authenticateBrand } from '@/lib/auth';
import { validateAndIngestOrder } from '@/lib/orderIngestion';
import { getDb } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: { brandId: string; code: string } }
) {
  const { brandId, code } = params;
  const auth = authenticateBrand(req, brandId);
  if (!auth.success) {
    return auth.response;
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  try {
    const result = validateAndIngestOrder(brandId, body, code);
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
      SELECT id, order_id, customer_id, used_at, subtotal_inr, discount_inr, discount_basis, total_inr, status, validity_flag
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
