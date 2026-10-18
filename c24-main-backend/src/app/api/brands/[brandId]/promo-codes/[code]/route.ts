import { authenticateBrand } from '../../../../../../lib/auth.ts';
import { getDb } from '../../../../../../lib/db.ts';
import {
  parseAndValidateIsoDate,
  derivePromoStatus,
  validatePromoCodeFormat
} from '../../../../../../lib/promoLogic.ts';
import {
  calculateRetainedSales,
  calculatePreFeeContribution,
  calculateNetContribution,
  calculateIncrementalContribution,
  calculateBreakEvenShare,
  round2
} from '../../../../../../lib/calculator.ts';

const ALLOWED_PATCH_FIELDS = new Set(['valid_from', 'valid_to', 'starts_at', 'expires_at']);

export async function GET(
  req: Request,
  { params }: { params: { brandId: string; code: string } }
) {
  const { brandId, code } = params;
  const auth = authenticateBrand(req, brandId);
  if (!auth.success) {
    return auth.response;
  }

  const cleanCode = code.toUpperCase();
  const db = getDb();

  const promo = db
    .prepare('SELECT * FROM promo_codes WHERE brand_id = ? AND code = ?;')
    .get(brandId, cleanCode) as
    | {
        code: string;
        creator_id: string;
        brand_id: string;
        valid_from: string;
        valid_to: string;
        created_at: string;
      }
    | undefined;

  if (!promo) {
    return Response.json({ error: `Promo code "${cleanCode}" not found.` }, { status: 404 });
  }

  const creator = db
    .prepare('SELECT * FROM creators WHERE creator_id = ?;')
    .get(promo.creator_id) as
    | {
        creator_id: string;
        name: string;
        default_fee_inr: number;
        default_margin_pct: number;
        default_incremental_share: number;
      }
    | undefined;

  const fee = creator?.default_fee_inr ?? 200000;
  const marginPct = creator?.default_margin_pct ?? 40;
  const incrementalShare = creator?.default_incremental_share ?? 0.8;

  // Retrieve all orders with this promo code
  const orders = db
    .prepare(`
      SELECT * FROM orders
      WHERE brand_id = ? AND promo_code = ?;
    `)
    .all(brandId, cleanCode) as Array<{
    id: number;
    order_id: string;
    customer_id: string;
    used_at: string;
    subtotal_inr: number;
    discount_inr: number | null;
    discount_basis: string | null;
    total_inr: number | null;
    status: string;
    validity_flag: string;
  }>;

  // Retrieve all items for these orders
  const orderIds = orders.map((o) => o.id);
  let allItems: Array<{
    order_id_ref: number;
    product_id: string;
    name: string | null;
    unit_price_inr: number;
    quantity: number;
    gross_inr: number;
    line_discount_inr: number | null;
    net_inr: number | null;
  }> = [];

  if (orderIds.length > 0) {
    const placeholders = orderIds.map(() => '?').join(',');
    allItems = db
      .prepare(`SELECT * FROM order_items WHERE order_id_ref IN (${placeholders});`)
      .all(...orderIds) as typeof allItems;
  }

  // Retrieve refunds for these orders
  const externalOrderIds = orders.map((o) => o.order_id);
  let refundEvents: Array<{
    order_id: string;
    amount_inr: number;
    is_full_refund: number;
  }> = [];
  if (externalOrderIds.length > 0) {
    const placeholders = externalOrderIds.map(() => '?').join(',');
    refundEvents = db
      .prepare(`SELECT * FROM refund_events WHERE brand_id = ? AND order_id IN (${placeholders});`)
      .all(brandId, ...externalOrderIds) as typeof refundEvents;
  }

  const use_count = orders.length;
  const unique_customers = new Set(orders.map((o) => o.customer_id)).size;

  let last_used_at: string | null = null;
  let outside_validity_uses = 0;
  let subtotal_inr = 0;
  let discount_inr_known_sum = 0;
  let uses_discount_unknown = 0;
  let hasUnknownDiscount = false;

  for (const o of orders) {
    if (!last_used_at || new Date(o.used_at) > new Date(last_used_at)) {
      last_used_at = o.used_at;
    }
    if (o.validity_flag === 'outside_validity') {
      outside_validity_uses++;
    }
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

  // Product Aggregation
  const productMap = new Map<
    string,
    {
      product_id: string;
      name: string | null;
      quantity: number;
      gross_inr: number;
      discount_inr: number | null;
      hasUnknownDiscount: boolean;
      unit_prices: number[];
      bases: Set<string>;
    }
  >();

  let totalUnits = 0;
  for (const item of allItems) {
    totalUnits += item.quantity;
    let prod = productMap.get(item.product_id);
    if (!prod) {
      prod = {
        product_id: item.product_id,
        name: item.name,
        quantity: 0,
        gross_inr: 0,
        discount_inr: 0,
        hasUnknownDiscount: false,
        unit_prices: [],
        bases: new Set()
      };
      productMap.set(item.product_id, prod);
    }
    prod.quantity += item.quantity;
    prod.gross_inr += item.gross_inr;
    prod.unit_prices.push(item.unit_price_inr);
    if (item.line_discount_inr === null) {
      prod.hasUnknownDiscount = true;
    } else if (prod.discount_inr !== null) {
      prod.discount_inr += item.line_discount_inr;
    }

    const parentOrder = orders.find((o) => o.id === item.order_id_ref);
    if (parentOrder?.discount_basis) {
      prod.bases.add(parentOrder.discount_basis);
    }
  }

  const products = Array.from(productMap.values()).map((p) => {
    const gross = round2(p.gross_inr, 'gross');
    const disc = p.hasUnknownDiscount || p.discount_inr === null ? null : round2(p.discount_inr, 'disc');
    const net = disc === null ? null : round2(gross - disc, 'net');
    const avgPrice = p.quantity > 0 ? round2(gross / p.quantity, 'avgPrice') : 0;
    const basis =
      p.bases.size === 0
        ? null
        : p.bases.size > 1
        ? 'mixed'
        : (Array.from(p.bases)[0] as 'reported' | 'estimated');

    const allocatedFee = fee && totalUnits > 0 ? round2((p.quantity / totalUnits) * fee, 'allocatedFee') : null;
    return {
      product_id: p.product_id,
      name: p.name,
      units: p.quantity,
      gross_inr: gross,
      discount_inr: disc,
      net_inr: net,
      avg_unit_price_inr: avgPrice,
      discount_basis: basis,
      allocated_fee: allocatedFee
    };
  });

  // C24 Authoritative Contribution Model Calculation
  // Eligible orders: valid flag === 'valid', excluding cancelled and fully refunded
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
    preFeeContributionInr = calculatePreFeeContribution(retainedSalesInr, marginPct);
    netContributionInr = calculateNetContribution(retainedSalesInr, marginPct, fee);
    incrementalContributionInr = calculateIncrementalContribution(
      retainedSalesInr,
      marginPct,
      fee,
      incrementalShare
    );
    breakEvenShare = calculateBreakEvenShare(preFeeContributionInr, fee);
  }

  const costPerUnit = fee && totalUnits > 0 ? round2(fee / totalUnits, 'costPerUnit') : null;
  const costPerUnitStatus = !fee ? 'fee_unknown' : totalUnits === 0 ? 'no_units' : 'ok';

  return Response.json({
    code: promo.code,
    creator_id: promo.creator_id,
    brand_id: promo.brand_id,
    valid_from: promo.valid_from,
    valid_to: promo.valid_to,
    status: derivePromoStatus(promo.valid_from, promo.valid_to),
    use_count,
    unique_customers,
    last_used_at,
    outside_validity_uses,
    units: totalUnits,
    creator_fee: fee,
    cost_per_unit: costPerUnit,
    cost_per_unit_status: costPerUnitStatus,
    cost_per_unit_basis: 'returns not deducted',
    subtotal_inr,
    discount_inr,
    total_inr,
    uses_discount_unknown,
    discount_inr_known_sum,
    implied_discount_pct_derived,
    // C24 Contribution Economics
    orders: eligibleCount,
    returns: returnedCount,
    retained_orders,
    retained_sales_inr: retainedSalesInr,
    pre_fee_contribution_inr: preFeeContributionInr,
    net_contribution_inr: netContributionInr,
    incremental_contribution_inr: incrementalContributionInr,
    break_even_share: breakEvenShare,
    products
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { brandId: string; code: string } }
) {
  const { brandId, code } = params;
  const auth = authenticateBrand(req, brandId);
  if (!auth.success) {
    return auth.response;
  }

  const cleanCode = code.toUpperCase();
  const db = getDb();

  const existing = db
    .prepare('SELECT * FROM promo_codes WHERE brand_id = ? AND code = ?;')
    .get(brandId, cleanCode) as
    | { valid_from: string; valid_to: string; creator_id: string }
    | undefined;

  if (!existing) {
    return Response.json({ error: `Promo code "${cleanCode}" not found.` }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  const extraFields = Object.keys(body).filter((k) => !ALLOWED_PATCH_FIELDS.has(k));
  if (extraFields.length > 0) {
    return Response.json(
      { error: `unexpected field: ${extraFields.join(', ')}` },
      { status: 400 }
    );
  }

  if (Object.keys(body).length === 0) {
    return Response.json({ error: 'At least one date field must be provided to update.' }, { status: 400 });
  }

  const newValidFromStr = (body.starts_at !== undefined ? body.starts_at : body.valid_from) ?? existing.valid_from;
  const newValidToStr = (body.expires_at !== undefined ? body.expires_at : body.valid_to) ?? existing.valid_to;

  let validFromDate: Date;
  let validToDate: Date;
  try {
    const startsAtField = body.starts_at !== undefined ? 'starts_at' : 'valid_from';
    const expiresAtField = body.expires_at !== undefined ? 'expires_at' : 'valid_to';
    validFromDate = parseAndValidateIsoDate(startsAtField, newValidFromStr);
    validToDate = parseAndValidateIsoDate(expiresAtField, newValidToStr);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 400 });
  }

  if (validFromDate.getTime() > validToDate.getTime()) {
    return Response.json(
      { error: 'Field "starts_at" (or "valid_from") must not be after "expires_at" (or "valid_to").' },
      { status: 400 }
    );
  }

  const validFromIso = validFromDate.toISOString();
  const validToIso = validToDate.toISOString();

  db.prepare(`
    UPDATE promo_codes
    SET valid_from = ?, valid_to = ?
    WHERE brand_id = ? AND code = ?;
  `).run(validFromIso, validToIso, brandId, cleanCode);

  // Write to promo_code_audit table
  db.prepare(`
    INSERT INTO promo_code_audit (
      brand_id, code, old_valid_from, old_valid_to, new_valid_from, new_valid_to, updated_at, changed_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  `).run(
    brandId,
    cleanCode,
    existing.valid_from,
    existing.valid_to,
    validFromIso,
    validToIso,
    new Date().toISOString(),
    'brand_dashboard'
  );

  // Write audit log entry
  db.prepare(`
    INSERT INTO audit_log (at, brand_id, action, changes)
    VALUES (?, ?, ?, ?);
  `).run(
    new Date().toISOString(),
    brandId,
    'PATCH_PROMO_CODE',
    JSON.stringify({ code: cleanCode, valid_from: validFromIso, valid_to: validToIso })
  );

  const responsePayload = {
    code: cleanCode,
    starts_at: validFromIso,
    expires_at: validToIso,
    valid_from: validFromIso,
    valid_to: validToIso,
    status: derivePromoStatus(validFromIso, validToIso)
  };

  try {
    const { getSseHub } = await import('../../../../../../lib/sseHub.ts');
    const eventData = {
      type: 'code_updated',
      code: cleanCode,
      creator: existing.creator_id,
      time: new Date().toISOString()
    };
    getSseHub().publish(brandId, 'code_updated', eventData);
  } catch (err) {
    console.error('Failed to publish code_updated SSE event:', err);
  }

  return Response.json(responsePayload);
}

export async function DELETE() {
  return Response.json(
    { error: 'Method Not Allowed: Promo codes cannot be deleted; modify validity dates instead.' },
    { status: 405 }
  );
}

