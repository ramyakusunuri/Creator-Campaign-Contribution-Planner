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
    SELECT id, order_id, promo_code, customer_id, used_at, subtotal_inr, subtotal_paise, 
           discount_inr, discount_paise, total_inr, total_paise, status, validity_flag
    FROM orders
    WHERE brand_id = ? AND used_at >= ? AND used_at < ?
    ORDER BY used_at ASC;
  `).all(brandId, fromDate.toISOString(), toDate.toISOString()) as Array<{
    id: number;
    order_id: string;
    promo_code: string | null;
    customer_id: string;
    used_at: string;
    subtotal_inr: number;
    subtotal_paise: number;
    discount_inr: number | null;
    discount_paise: number | null;
    total_inr: number | null;
    total_paise: number | null;
    status: string;
    validity_flag: string;
  }>;

  if (allOrders.length > 5000) {
    return NextResponse.json(
      { error: 'range too large, narrow it' },
      { status: 400 }
    );
  }

  const refundRows = db.prepare(`
    SELECT refund_id, order_id, amount_inr, amount_paise, is_full_refund, created_at
    FROM refund_events
    WHERE brand_id = ? AND created_at >= ? AND created_at < ?
    ORDER BY created_at ASC;
  `).all(brandId, fromDate.toISOString(), toDate.toISOString()) as Array<{
    refund_id: string;
    order_id: string;
    amount_inr: number;
    amount_paise: number;
    is_full_refund: number;
    created_at: string;
  }>;

  let totalUnits = 0;
  let grossSubtotalPaise = 0;
  let totalDiscountPaise = 0;
  let hasUnknownDiscount = false;
  let netTotalPaise = 0;
  let hasUnknownNet = false;
  let discrepanciesCount = 0;

  const registeredMap = new Map<string, {
    code: string;
    use_count: number;
    units: number;
    subtotal_inr: number;
    subtotal_paise: number;
    order_ids: string[];
  }>();
  const unregisteredList: any[] = [];

  for (const o of allOrders) {
    const items = db.prepare('SELECT quantity FROM order_items WHERE order_id_ref = ?;').all(o.id) as Array<{ quantity: number }>;
    const orderUnits = items.reduce((s, it) => s + it.quantity, 0);
    totalUnits += orderUnits;
    grossSubtotalPaise += o.subtotal_paise;

    if (o.discount_paise === null) {
      hasUnknownDiscount = true;
    } else {
      totalDiscountPaise += o.discount_paise;
    }

    if (o.total_paise === null) {
      hasUnknownNet = true;
    } else {
      netTotalPaise += o.total_paise;
    }

    if (o.validity_flag !== 'valid') {
      discrepanciesCount++;
    }

    if (o.validity_flag !== 'unregistered' && o.promo_code) {
      let entry = registeredMap.get(o.promo_code);
      if (!entry) {
        entry = {
          code: o.promo_code,
          use_count: 0,
          units: 0,
          subtotal_inr: 0,
          subtotal_paise: 0,
          order_ids: []
        };
        registeredMap.set(o.promo_code, entry);
      }
      entry.use_count++;
      entry.units += orderUnits;
      entry.subtotal_paise += o.subtotal_paise;
      entry.subtotal_inr = round2(entry.subtotal_paise / 100);
      entry.order_ids.push(o.order_id);
    } else {
      unregisteredList.push({
        order_id: o.order_id,
        code_entered: o.promo_code || 'NONE',
        used_at: o.used_at,
        units: orderUnits,
        subtotal_inr: o.subtotal_inr,
        subtotal_paise: o.subtotal_paise
      });
    }
  }

  const refundAmountPaise = refundRows.reduce((acc, r) => acc + r.amount_paise, 0);

  const registeredResults = Array.from(registeredMap.values()).map(r => ({
    ...r,
    order_ids: r.order_ids.sort()
  }));

  return NextResponse.json({
    brand_id: brandId,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    summary: {
      total_orders: allOrders.length,
      registered_orders_count: allOrders.length - unregisteredList.length,
      unregistered_orders_count: unregisteredList.length,
      total_units: totalUnits,
      gross_subtotal_inr: round2(grossSubtotalPaise / 100),
      gross_subtotal_paise: grossSubtotalPaise,
      total_discount_inr: hasUnknownDiscount ? null : round2(totalDiscountPaise / 100),
      total_discount_paise: hasUnknownDiscount ? null : totalDiscountPaise,
      net_total_inr: hasUnknownNet ? null : round2(netTotalPaise / 100),
      net_total_paise: hasUnknownNet ? null : netTotalPaise,
      refund_events_count: refundRows.length,
      refund_amount_inr: round2(refundAmountPaise / 100),
      refund_amount_paise: refundAmountPaise,
      discrepancies_count: discrepanciesCount
    },
    registered_codes: registeredResults,
    unregistered_uses: unregisteredList,
    refunds: refundRows,
    generated_at: new Date().toISOString()
  });
}
