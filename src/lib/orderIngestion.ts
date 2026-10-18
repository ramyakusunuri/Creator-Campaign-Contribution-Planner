import { getDb } from './db.ts';
import { round2 } from './calculator.ts';
import { parseAndValidateIsoDate, ISO_WITH_TZ_REGEX } from './promoLogic.ts';
import { validateMoneyDecimals, toPaise } from './moneyValidation.ts';
import type { LineItemRecord, OrderStatus, ValidityFlag } from '../types/ecommerce.ts';

const ALLOWED_ORDER_FIELDS = new Set(['order_id', 'customer_id', 'used_at', 'payment_confirmed_at', 'items', 'discount_inr', 'promo_code', 'code']);
const ALLOWED_ITEM_FIELDS = new Set(['product_id', 'name', 'unit_price_inr', 'quantity', 'line_discount_inr']);
const FORBIDDEN_PII_FIELDS = new Set(['name', 'email', 'customer_email', 'phone', 'customer_phone', 'address', 'shipping_address', 'billing_address']);

export interface IngestOrderResult {
  success: boolean;
  registered: boolean;
  validity_flag: ValidityFlag;
  order_id: string;
  promo_code: string | null;
  subtotal_inr: number;
  discount_inr: number | null;
  discount_basis: 'reported' | 'estimated' | null;
  total_inr: number | null;
  items: LineItemRecord[];
}

export function validateAndIngestOrder(
  brandId: string,
  rawPayload: Record<string, any>,
  forcedPromoCode?: string | null
): IngestOrderResult {
  if (typeof rawPayload !== 'object' || rawPayload === null || Array.isArray(rawPayload)) {
    throw { status: 400, message: 'Payload must be a JSON object.' };
  }

  // Decimal precision guard: reject any financial field with > 2 decimal places with 400 Bad Request
  const decimalValidation = validateMoneyDecimals(rawPayload);
  if (!decimalValidation.valid) {
    throw { status: 400, message: decimalValidation.error };
  }

  // Check for forbidden PII fields
  for (const key of Object.keys(rawPayload)) {
    if (FORBIDDEN_PII_FIELDS.has(key.toLowerCase())) {
      throw { status: 400, message: `Forbidden customer PII field received: "${key}". PII must not be transmitted or stored.` };
    }
  }

  // Check unexpected fields
  const extraOrderFields = Object.keys(rawPayload).filter((k) => !ALLOWED_ORDER_FIELDS.has(k));
  if (extraOrderFields.length > 0) {
    throw { status: 400, message: `unexpected field: ${extraOrderFields.join(', ')}` };
  }

  // Required fields
  if (!rawPayload.order_id || typeof rawPayload.order_id !== 'string' || rawPayload.order_id.trim() === '') {
    throw { status: 400, message: 'Field "order_id" is required and must be a non-empty string.' };
  }
  const orderId = rawPayload.order_id.trim();

  if (!rawPayload.customer_id || typeof rawPayload.customer_id !== 'string' || rawPayload.customer_id.trim() === '') {
    throw { status: 400, message: 'Field "customer_id" is required and must be a non-empty string.' };
  }
  const customerId = rawPayload.customer_id.trim();

  let usedAtDate: Date;
  try {
    usedAtDate = parseAndValidateIsoDate('used_at', rawPayload.used_at);
  } catch (err: any) {
    throw { status: 400, message: err.message };
  }
  const usedAtIso = usedAtDate.toISOString();

  if (!Array.isArray(rawPayload.items) || rawPayload.items.length === 0) {
    throw { status: 400, message: 'Field "items" must be a non-empty array.' };
  }

  // Validate items
  let subtotal = 0;
  const processedItems: Array<{
    product_id: string;
    name: string | null;
    unit_price_inr: number;
    quantity: number;
    gross_inr: number;
    line_discount_inr: number | null;
    net_inr: number | null;
  }> = [];

  let lineDiscountsPresentCount = 0;

  for (let i = 0; i < rawPayload.items.length; i++) {
    const item = rawPayload.items[i];
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw { status: 400, message: `Item at index ${i} must be an object.` };
    }


    const extraItemFields = Object.keys(item).filter((k) => !ALLOWED_ITEM_FIELDS.has(k));
    if (extraItemFields.length > 0) {
      throw { status: 400, message: `unexpected field: ${extraItemFields.join(', ')}` };
    }

    if (!item.product_id || typeof item.product_id !== 'string') {
      throw { status: 400, message: `Item at index ${i} missing valid "product_id".` };
    }

    if (item.unit_price_inr === null || item.unit_price_inr === undefined || typeof item.unit_price_inr !== 'number' || !Number.isFinite(item.unit_price_inr) || item.unit_price_inr < 0) {
      throw { status: 400, message: `Item "${item.product_id}" must have finite "unit_price_inr" >= 0.` };
    }

    if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw { status: 400, message: `Item "${item.product_id}" quantity must be an integer >= 1. Received: ${item.quantity}` };
    }

    const gross = round2(item.unit_price_inr * item.quantity, 'line_gross');
    subtotal += gross;

    if (item.line_discount_inr !== null && item.line_discount_inr !== undefined) {
      if (typeof item.line_discount_inr !== 'number' || !Number.isFinite(item.line_discount_inr) || item.line_discount_inr < 0) {
        throw { status: 400, message: `Item "${item.product_id}" line_discount_inr must be >= 0.` };
      }
      if (item.line_discount_inr > gross) {
        throw { status: 400, message: `Item "${item.product_id}" line_discount_inr (${item.line_discount_inr}) cannot exceed line gross (${gross}).` };
      }
      lineDiscountsPresentCount++;
    }

    processedItems.push({
      product_id: item.product_id,
      name: item.name ? String(item.name) : null,
      unit_price_inr: item.unit_price_inr,
      quantity: item.quantity,
      gross_inr: gross,
      line_discount_inr: item.line_discount_inr !== undefined && item.line_discount_inr !== null ? round2(item.line_discount_inr, 'line_discount') : null,
      net_inr: null
    });
  }

  subtotal = round2(subtotal, 'subtotal');

  // Discount rule resolution
  let finalOrderDiscount: number | null = null;
  let finalBasis: 'reported' | 'estimated' | null = null;

  if (lineDiscountsPresentCount > 0 && lineDiscountsPresentCount < processedItems.length) {
    throw { status: 400, message: 'Partial line discounts invalid: line_discount_inr must be provided on ALL lines or NONE.' };
  }

  const orderDiscountGiven = rawPayload.discount_inr !== undefined && rawPayload.discount_inr !== null;
  if (orderDiscountGiven) {
    if (typeof rawPayload.discount_inr !== 'number' || !Number.isFinite(rawPayload.discount_inr) || rawPayload.discount_inr < 0) {
      throw { status: 400, message: 'Field "discount_inr" must be a finite number >= 0.' };
    }
    if (rawPayload.discount_inr > subtotal) {
      throw { status: 400, message: `discount_inr (${rawPayload.discount_inr}) cannot exceed subtotal (${subtotal}).` };
    }
  }

  if (lineDiscountsPresentCount === processedItems.length) {
    const lineDiscountSum = round2(
      processedItems.reduce((sum, item) => sum + (item.line_discount_inr ?? 0), 0),
      'line_discount_sum'
    );

    if (orderDiscountGiven && round2(rawPayload.discount_inr, 'order_disc') !== lineDiscountSum) {
      throw {
        status: 400,
        message: `Order discount_inr (${rawPayload.discount_inr}) does not match the sum of line_discount_inr (${lineDiscountSum}).`
      };
    }

    finalOrderDiscount = lineDiscountSum;
    finalBasis = 'reported';
    for (const item of processedItems) {
      item.net_inr = round2(item.gross_inr - (item.line_discount_inr ?? 0), 'item_net');
    }
  } else {
    // No line discounts provided
    if (!orderDiscountGiven) {
      // Rule 1: Unknown discount
      finalOrderDiscount = null;
      finalBasis = null;
      for (const item of processedItems) {
        item.line_discount_inr = null;
        item.net_inr = null;
      }
    } else {
      // Rule 2: Order discount given, split proportionally across lines
      finalOrderDiscount = round2(rawPayload.discount_inr, 'order_discount');
      finalBasis = 'estimated';

      let allocatedSoFar = 0;
      for (let i = 0; i < processedItems.length; i++) {
        const item = processedItems[i];
        if (i === processedItems.length - 1) {
          // Last line absorbs rounding remainder
          const remainder = round2(finalOrderDiscount - allocatedSoFar, 'remainder');
          item.line_discount_inr = remainder;
        } else {
          const proportion = subtotal > 0 ? (item.gross_inr / subtotal) : 0;
          const share = round2(finalOrderDiscount * proportion, 'line_share');
          item.line_discount_inr = share;
          allocatedSoFar = round2(allocatedSoFar + share, 'allocated');
        }
        item.net_inr = round2(item.gross_inr - item.line_discount_inr, 'line_net');
      }
    }
  }

  const finalTotal = finalOrderDiscount === null ? null : round2(subtotal - finalOrderDiscount, 'order_total');

  // Check Promo Code Registration and Validity
  const rawCode = forcedPromoCode || rawPayload.promo_code || rawPayload.code || null;
  const normalizedCode = rawCode ? String(rawCode).trim().toUpperCase() : null;

  const db = getDb();

  // Check unique order_id per brand
  const existingOrder = db
    .prepare('SELECT id FROM orders WHERE brand_id = ? AND order_id = ?;')
    .get(brandId, orderId);
  if (existingOrder) {
    throw { status: 409, message: `Order "${orderId}" has already been processed for brand "${brandId}".` };
  }

  let isRegistered = false;
  let validityFlag: ValidityFlag = 'unregistered';

  if (normalizedCode) {
    const promo = db
      .prepare('SELECT * FROM promo_codes WHERE brand_id = ? AND code = ?;')
      .get(brandId, normalizedCode) as
      | { valid_from: string; valid_to: string }
      | undefined;

    if (promo) {
      isRegistered = true;
      const orderTime = usedAtDate.getTime();
      const fromTime = new Date(promo.valid_from).getTime();
      const toTime = new Date(promo.valid_to).getTime();

      if (orderTime < fromTime || orderTime > toTime) {
        validityFlag = 'outside_validity';
      } else {
        validityFlag = 'valid';
      }
    }
  }

  const subtotalPaise = toPaise(subtotal, 'subtotal');
  const discountPaise = finalOrderDiscount !== null ? toPaise(finalOrderDiscount, 'discount') : null;
  const totalPaise = finalTotal !== null ? toPaise(finalTotal, 'total') : null;

  // Insert into database atomically
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      brand_id, order_id, promo_code, customer_id, used_at,
      subtotal_inr, subtotal_paise,
      discount_inr, discount_paise,
      discount_basis,
      total_inr, total_paise,
      status, validity_flag, raw_payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  const orderResult = insertOrder.run(
    brandId,
    orderId,
    normalizedCode,
    customerId,
    usedAtIso,
    subtotal,
    subtotalPaise,
    finalOrderDiscount,
    discountPaise,
    finalBasis,
    finalTotal,
    totalPaise,
    'completed',
    validityFlag,
    JSON.stringify(rawPayload)
  );

  const orderRowId = Number(orderResult.lastInsertRowid);

  const insertItem = db.prepare(`
    INSERT INTO order_items (
      order_id_ref, product_id, name,
      unit_price_inr, unit_price_paise,
      quantity,
      gross_inr, gross_paise,
      line_discount_inr, line_discount_paise,
      net_inr, net_paise
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  for (const item of processedItems) {
    const unitPricePaise = toPaise(item.unit_price_inr, 'unit_price');
    const grossPaise = toPaise(item.gross_inr, 'gross');
    const lineDiscountPaise = item.line_discount_inr !== null ? toPaise(item.line_discount_inr, 'line_discount') : null;
    const netPaise = item.net_inr !== null ? toPaise(item.net_inr, 'net') : null;

    insertItem.run(
      orderRowId,
      item.product_id,
      item.name,
      item.unit_price_inr,
      unitPricePaise,
      item.quantity,
      item.gross_inr,
      grossPaise,
      item.line_discount_inr,
      lineDiscountPaise,
      item.net_inr,
      netPaise
    );
  }

  return {
    success: true,
    registered: isRegistered,
    validity_flag: validityFlag,
    order_id: orderId,
    promo_code: normalizedCode,
    subtotal_inr: subtotal,
    discount_inr: finalOrderDiscount,
    discount_basis: finalBasis,
    total_inr: finalTotal,
    items: processedItems
  };
}
