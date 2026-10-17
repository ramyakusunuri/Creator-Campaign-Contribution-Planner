import { NextRequest, NextResponse } from 'next/server';
import { authenticateBrand } from '@/lib/auth';
import { getDb } from '@/lib/db';

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
  const rows = db
    .prepare(`
      SELECT order_id, promo_code, customer_id, used_at, subtotal_inr, discount_inr, total_inr, status
      FROM orders
      WHERE brand_id = ? AND validity_flag = 'unregistered'
      ORDER BY used_at DESC;
    `)
    .all(brandId);

  return NextResponse.json(rows, { status: 200 });
}
