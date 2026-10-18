import { NextRequest, NextResponse } from 'next/server';
import { authenticateReconciliation } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { parseAndValidateIsoDate } from '@/lib/promoLogic';
import { round2 } from '@/lib/calculator';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { brandId: string } }
) {
  const { brandId } = params;
  const auth = authenticateReconciliation(req, brandId);
  if (!auth.success) {
    return auth.response;
  }

  const url = new URL(req.url);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');

  if (!fromParam || !toParam) {
    return NextResponse.json(
      { error: 'Query parameters "from" and "to" are required (ISO 8601 strings)' },
      { status: 400 }
    );
  }

  let fromDate: Date;
  let toDate: Date;
  try {
    fromDate = parseAndValidateIsoDate('from', fromParam);
    toDate = parseAndValidateIsoDate('to', toParam);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  if (fromDate.getTime() >= toDate.getTime()) {
    return NextResponse.json(
      { error: '"from" timestamp must be strictly earlier than "to" timestamp' },
      { status: 400 }
    );
  }

  const db = getDb();
  const allOrders = db.prepare(`
    SELECT * FROM orders
    WHERE brand_id = ? AND used_at >= ? AND used_at < ?
    ORDER BY used_at ASC;
  `).all(brandId, fromDate.toISOString(), toDate.toISOString()) as Array<{
    id: number;
    order_id: string;
    promo_code: string | null;
    customer_id: string;
    used_at: string;
    subtotal_inr: number;
    validity_flag: string;
  }>;

  if (allOrders.length > 5000) {
    return NextResponse.json(
      { error: 'range too large, narrow it' },
      { status: 400 }
    );
  }

  const registeredMap = new Map<string, {
    code: string;
    use_count: number;
    units: number;
    subtotal_inr: number;
    order_ids: string[];
  }>();
  const unregisteredList: any[] = [];

  for (const o of allOrders) {
    const items = db.prepare('SELECT quantity FROM order_items WHERE order_id_ref = ?;').all(o.id) as Array<{ quantity: number }>;
    const totalUnits = items.reduce((s, it) => s + it.quantity, 0);

    if (o.validity_flag !== 'unregistered' && o.promo_code) {
      let entry = registeredMap.get(o.promo_code);
      if (!entry) {
        entry = {
          code: o.promo_code,
          use_count: 0,
          units: 0,
          subtotal_inr: 0,
          order_ids: []
        };
        registeredMap.set(o.promo_code, entry);
      }
      entry.use_count++;
      entry.units += totalUnits;
      entry.subtotal_inr = round2(entry.subtotal_inr + o.subtotal_inr);
      entry.order_ids.push(o.order_id);
    } else {
      unregisteredList.push({
        order_id: o.order_id,
        code_entered: o.promo_code || 'NONE',
        used_at: o.used_at,
        units: totalUnits,
        subtotal_inr: o.subtotal_inr
      });
    }
  }

  const registeredResults = Array.from(registeredMap.values()).map(r => ({
    ...r,
    order_ids: r.order_ids.sort()
  }));

  return NextResponse.json({
    brand_id: brandId,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    registered_codes: registeredResults,
    unregistered_uses: unregisteredList,
    generated_at: new Date().toISOString()
  });
}
