import { NextRequest, NextResponse } from 'next/server';
import { authenticateBrand } from '@/lib/auth';
import { getDb } from '@/lib/db';
import {
  calculateRetainedSales,
  calculatePreFeeContribution,
  calculateNetContribution,
  calculateIncrementalContribution,
  calculateBreakEvenShare,
  round2
} from '@/lib/calculator';

export async function GET(
  req: NextRequest,
  { params }: { params: { brandId: string; creatorId: string } }
) {
  const { brandId, creatorId } = params;
  const auth = authenticateBrand(req, brandId);
  if (!auth.success) {
    return auth.response;
  }

  const db = getDb();
  const creator = db
    .prepare('SELECT * FROM creators WHERE creator_id = ?;')
    .get(creatorId) as
    | {
        creator_id: string;
        name: string;
        default_fee_inr: number;
        default_margin_pct: number;
        default_incremental_share: number;
      }
    | undefined;

  if (!creator) {
    return NextResponse.json({ error: `Creator "${creatorId}" not found.` }, { status: 404 });
  }

  const codes = db
    .prepare('SELECT code FROM promo_codes WHERE brand_id = ? AND creator_id = ?;')
    .all(brandId, creatorId) as Array<{ code: string }>;

  const codeList = codes.map((c) => c.code);

  if (codeList.length === 0) {
    return NextResponse.json({
      creator_id: creatorId,
      brand_id: brandId,
      codes: [],
      use_count: 0,
      unique_customers: 0,
      subtotal_inr: 0,
      discount_inr: 0,
      total_inr: 0,
      uses_discount_unknown: 0,
      discount_inr_known_sum: 0,
      implied_discount_pct_derived: null,
      orders: 0,
      returns: 0,
      retained_orders: 0,
      retained_sales_inr: null,
      pre_fee_contribution_inr: null,
      net_contribution_inr: null,
      incremental_contribution_inr: null,
      break_even_share: null
    });
  }

  const placeholders = codeList.map(() => '?').join(',');
  const orders = db
    .prepare(`
      SELECT * FROM orders
      WHERE brand_id = ? AND promo_code IN (${placeholders});
    `)
    .all(brandId, ...codeList) as Array<{
    id: number;
    order_id: string;
    customer_id: string;
    used_at: string;
    subtotal_inr: number;
    discount_inr: number | null;
    total_inr: number | null;
    status: string;
    validity_flag: string;
  }>;

  const externalOrderIds = orders.map((o) => o.order_id);
  let refundEvents: Array<{
    order_id: string;
    amount_inr: number;
    is_full_refund: number;
  }> = [];
  if (externalOrderIds.length > 0) {
    const rPlaceholders = externalOrderIds.map(() => '?').join(',');
    refundEvents = db
      .prepare(`SELECT * FROM refund_events WHERE brand_id = ? AND order_id IN (${rPlaceholders});`)
      .all(brandId, ...externalOrderIds) as typeof refundEvents;
  }

  const use_count = orders.length;
  const unique_customers = new Set(orders.map((o) => o.customer_id)).size;

  let subtotal_inr = 0;
  let discount_inr_known_sum = 0;
  let uses_discount_unknown = 0;
  let hasUnknownDiscount = false;

  for (const o of orders) {
    subtotal_inr += o.subtotal_inr;
    if (o.discount_inr === null) {
      uses_discount_unknown++;
      hasUnknownDiscount = true;
    } else {
      discount_inr_known_sum += o.discount_inr;
    }
  }

  subtotal_inr = round2(subtotal_inr, 'subtotal');
  discount_inr_known_sum = round2(discount_inr_known_sum, 'discount_known');
  const discount_inr = hasUnknownDiscount ? null : discount_inr_known_sum;
  const total_inr = hasUnknownDiscount ? null : round2(subtotal_inr - (discount_inr ?? 0), 'total');
  const implied_discount_pct_derived =
    hasUnknownDiscount || subtotal_inr === 0
      ? null
      : round2(((discount_inr ?? 0) / subtotal_inr) * 100, 'implied_discount_pct');

  const eligibleOrders = orders.filter((o) => o.validity_flag === 'valid');
  const eligibleCount = eligibleOrders.length;
  const returnedCount = eligibleOrders.filter(
    (o) => o.status === 'refunded' || o.status === 'cancelled'
  ).length;
  const retained_orders = eligibleCount - returnedCount;

  let retainedSalesInr: number | null = null;
  let preFeeContributionInr: number | null = null;
  let netContributionInr: number | null = null;
  let incrementalContributionInr: number | null = null;
  let breakEvenShare: number | null = null;

  if (retained_orders > 0 && !hasUnknownDiscount) {
    const retainedOrdersList = eligibleOrders.filter(
      (o) => o.status === 'completed' || o.status === 'partially_refunded'
    );
    const retainedGross = retainedOrdersList.reduce((sum, o) => sum + o.subtotal_inr, 0);
    const retainedDiscount = retainedOrdersList.reduce((sum, o) => sum + (o.discount_inr ?? 0), 0);
    const partialRefunds = refundEvents
      .filter((r) => r.is_full_refund === 0)
      .reduce((sum, r) => sum + r.amount_inr, 0);

    const aovInr = retainedGross / retained_orders;
    const discountPct = retainedGross > 0 ? (retainedDiscount / retainedGross) * 100 : 0;

    const baseRetainedSales = calculateRetainedSales(
      eligibleCount,
      returnedCount,
      aovInr,
      discountPct
    );
    retainedSalesInr = Math.max(0, round2(baseRetainedSales - partialRefunds, 'retainedSalesAfterRefunds'));
    preFeeContributionInr = calculatePreFeeContribution(retainedSalesInr, creator.default_margin_pct);
    netContributionInr = calculateNetContribution(
      retainedSalesInr,
      creator.default_margin_pct,
      creator.default_fee_inr
    );
    incrementalContributionInr = calculateIncrementalContribution(
      retainedSalesInr,
      creator.default_margin_pct,
      creator.default_fee_inr,
      creator.default_incremental_share
    );
    breakEvenShare = calculateBreakEvenShare(preFeeContributionInr, creator.default_fee_inr);
  }

  return NextResponse.json({
    creator_id: creatorId,
    brand_id: brandId,
    codes: codeList,
    use_count,
    unique_customers,
    subtotal_inr,
    discount_inr,
    total_inr,
    uses_discount_unknown,
    discount_inr_known_sum,
    implied_discount_pct_derived,
    orders: eligibleCount,
    returns: returnedCount,
    retained_orders,
    retained_sales_inr: retainedSalesInr,
    pre_fee_contribution_inr: preFeeContributionInr,
    net_contribution_inr: netContributionInr,
    incremental_contribution_inr: incrementalContributionInr,
    break_even_share: breakEvenShare
  });
}
