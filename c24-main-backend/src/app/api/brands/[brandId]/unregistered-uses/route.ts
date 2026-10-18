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
  const orderRows = db
    .prepare(`
      SELECT order_id, promo_code, customer_id, used_at, subtotal_inr, discount_inr, total_inr, status
      FROM orders
      WHERE brand_id = ? AND validity_flag = 'unregistered'
      ORDER BY used_at DESC;
    `)
    .all(brandId) as any[];

  let unregTableRows: any[] = [];
  try {
    unregTableRows = db
      .prepare(`
        SELECT order_id, code_entered as promo_code, customer_id, used_at, subtotal_inr, discount_inr, total_inr, 'unregistered' as status
        FROM unregistered_code_uses
        WHERE brand_id = ?
        ORDER BY used_at DESC;
      `)
      .all(brandId) as any[];
  } catch {}

  const combined = [...orderRows, ...unregTableRows].sort((a, b) => 
    new Date(b.used_at).getTime() - new Date(a.used_at).getTime()
  );

  return NextResponse.json(combined, { status: 200 });
}
