import { round2 } from './lib/calculator.ts';
import { toPaise } from './storage/interface.js';

export const ISO_WITH_TZ_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function parseAndValidateIsoDate(fieldName, val) {
  if (val === null || val === undefined) {
    const err = new Error(`Field "${fieldName}" is required and cannot be null or undefined.`);
    err.status = 400;
    throw err;
  }
  if (typeof val !== 'string' || val.trim() === '') {
    const err = new Error(`Field "${fieldName}" must be a non-empty ISO 8601 date string.`);
    err.status = 400;
    throw err;
  }
  const str = val.trim();
  if (!ISO_WITH_TZ_REGEX.test(str)) {
    const err = new Error(`Field "${fieldName}" must be a full ISO 8601 string WITH timezone (e.g. "2026-10-18T10:00:00Z" or "+05:30").`);
    err.status = 400;
    throw err;
  }
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) {
    const err = new Error(`Field "${fieldName}" could not be parsed into a valid date.`);
    err.status = 400;
    throw err;
  }
  return parsed;
}

export function validatePromoCodeFormat(code) {
  if (typeof code !== 'string' || code.trim() === '') {
    const err = new Error('Promo code must be a non-empty string.');
    err.status = 400;
    throw err;
  }
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,20}$/.test(clean)) {
    const err = new Error(`Promo code "${code}" is invalid. Must be 4 to 20 uppercase alphanumeric characters.`);
    err.status = 400;
    throw err;
  }
  return clean;
}

export function derivePromoStatus(validFromIso, validToIso, clockNow = new Date()) {
  const from = new Date(validFromIso).getTime();
  const to = new Date(validToIso).getTime();
  const now = clockNow.getTime();

  if (now < from) {
    return 'not_yet_valid';
  }
  if (now <= to) {
    return 'valid';
  }
  return 'expired';
}

export function checkEligibility(creatorsList, brandsList, brandId, creatorId) {
  const brand = brandsList.find(b => b.brand_id === brandId);
  if (!brand) {
    return { eligible: false, reason: `Brand "${brandId}" not found.` };
  }

  const creator = creatorsList.find(c => c.creator_id === creatorId);
  if (!creator) {
    return { eligible: false, reason: `Unknown creator "${creatorId}".` };
  }

  if (creator.excluded === true) {
    return { eligible: false, reason: `Creator ${creatorId} is flagged as excluded.` };
  }

  if (creator.relationships === null || creator.relationships === undefined) {
    return {
      eligible: false,
      reason: `Creator ${creatorId} has unknown relationship history (null) and is blocked pending review.`
    };
  }

  const rivals = brand.rivals || [];
  const conflicting = (creator.relationships || []).filter(r => rivals.includes(r));
  if (conflicting.length > 0) {
    return {
      eligible: false,
      reason: `Creator ${creatorId} has an active collaboration with rival brand(s): ${conflicting.join(', ')}.`
    };
  }

  return { eligible: true };
}

const ALLOWED_ORDER_FIELDS = new Set([
  'order_id',
  'customer_id',
  'used_at',
  'payment_confirmed_at',
  'items',
  'discount_inr',
  'promo_code',
  'code'
]);

const ALLOWED_ITEM_FIELDS = new Set([
  'product_id',
  'name',
  'unit_price_inr',
  'quantity',
  'line_discount_inr'
]);

const FORBIDDEN_PII_FIELDS = new Set([
  'name',
  'email',
  'customer_email',
  'phone',
  'customer_phone',
  'address',
  'shipping_address',
  'billing_address'
]);

export function validateOrderPayload(rawPayload) {
  if (typeof rawPayload !== 'object' || rawPayload === null || Array.isArray(rawPayload)) {
    const err = new Error('Payload must be a JSON object.');
    err.status = 400;
    throw err;
  }

  // Check forbidden PII
  for (const key of Object.keys(rawPayload)) {
    if (FORBIDDEN_PII_FIELDS.has(key.toLowerCase())) {
      const err = new Error(`Forbidden customer PII field received: "${key}". PII must not be transmitted or stored.`);
      err.status = 400;
      throw err;
    }
  }

  // Check unexpected fields
  const extraFields = Object.keys(rawPayload).filter(k => !ALLOWED_ORDER_FIELDS.has(k));
  if (extraFields.length > 0) {
    const err = new Error(`unexpected field: ${extraFields.join(', ')}`);
    err.status = 400;
    throw err;
  }

  if (!rawPayload.order_id || typeof rawPayload.order_id !== 'string' || rawPayload.order_id.trim() === '') {
    const err = new Error('Field "order_id" is required and must be a non-empty string.');
    err.status = 400;
    throw err;
  }
  const orderId = rawPayload.order_id.trim();

  if (!rawPayload.customer_id || typeof rawPayload.customer_id !== 'string' || rawPayload.customer_id.trim() === '') {
    const err = new Error('Field "customer_id" is required and must be a non-empty string.');
    err.status = 400;
    throw err;
  }
  const customerId = rawPayload.customer_id.trim();

  const usedAtDate = parseAndValidateIsoDate('used_at', rawPayload.used_at);
  const paymentConfirmedDate = parseAndValidateIsoDate('payment_confirmed_at', rawPayload.payment_confirmed_at);

  if (!Array.isArray(rawPayload.items) || rawPayload.items.length === 0) {
    const err = new Error('Field "items" must be a non-empty array.');
    err.status = 400;
    throw err;
  }

  let subtotalPaise = 0;
  const processedItems = [];
  let lineDiscountsPresentCount = 0;

  for (let i = 0; i < rawPayload.items.length; i++) {
    const item = rawPayload.items[i];
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      const err = new Error(`Item at index ${i} must be an object.`);
      err.status = 400;
      throw err;
    }

    const extraItemFields = Object.keys(item).filter(k => !ALLOWED_ITEM_FIELDS.has(k));
    if (extraItemFields.length > 0) {
      const err = new Error(`unexpected field: ${extraItemFields.join(', ')}`);
      err.status = 400;
      throw err;
    }

    if (!item.product_id || typeof item.product_id !== 'string') {
      const err = new Error(`Item at index ${i} missing valid "product_id".`);
      err.status = 400;
      throw err;
    }

    if (item.unit_price_inr === null || item.unit_price_inr === undefined || typeof item.unit_price_inr !== 'number' || !Number.isFinite(item.unit_price_inr) || item.unit_price_inr < 0) {
      const err = new Error(`Item "${item.product_id}" must have finite "unit_price_inr" >= 0.`);
      err.status = 400;
      throw err;
    }

    const unitPricePaise = toPaise(item.unit_price_inr, 'unit_price_inr');

    if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1) {
      const err = new Error(`Item "${item.product_id}" quantity must be an integer >= 1. Received: ${item.quantity}`);
      err.status = 400;
      throw err;
    }

    const grossPaise = unitPricePaise * item.quantity;
    subtotalPaise += grossPaise;

    let lineDiscountPaise = null;
    if (item.line_discount_inr !== null && item.line_discount_inr !== undefined) {
      if (typeof item.line_discount_inr !== 'number' || !Number.isFinite(item.line_discount_inr) || item.line_discount_inr < 0) {
        const err = new Error(`Item "${item.product_id}" line_discount_inr must be >= 0.`);
        err.status = 400;
        throw err;
      }
      lineDiscountPaise = toPaise(item.line_discount_inr, 'line_discount_inr');
      if (lineDiscountPaise > grossPaise) {
        const err = new Error(`Item "${item.product_id}" line_discount_inr cannot exceed line gross.`);
        err.status = 400;
        throw err;
      }
      lineDiscountsPresentCount++;
    }

    processedItems.push({
      product_id: item.product_id,
      name: item.name ? String(item.name) : null,
      unit_price_paise: unitPricePaise,
      unit_price_inr: item.unit_price_inr,
      quantity: item.quantity,
      gross_paise: grossPaise,
      line_discount_paise: lineDiscountPaise
    });
  }

  // Line discounts resolution
  let finalOrderDiscountPaise = null;
  let finalBasis = null;

  if (lineDiscountsPresentCount > 0 && lineDiscountsPresentCount < processedItems.length) {
    const err = new Error('Partial line discounts invalid: line_discount_inr must be provided on ALL lines or NONE.');
    err.status = 400;
    throw err;
  }

  const orderDiscountGiven = rawPayload.discount_inr !== undefined && rawPayload.discount_inr !== null;
  let orderDiscountPaise = null;
  if (orderDiscountGiven) {
    if (typeof rawPayload.discount_inr !== 'number' || !Number.isFinite(rawPayload.discount_inr) || rawPayload.discount_inr < 0) {
      const err = new Error('Field "discount_inr" must be a finite number >= 0.');
      err.status = 400;
      throw err;
    }
    orderDiscountPaise = toPaise(rawPayload.discount_inr, 'discount_inr');
    if (orderDiscountPaise > subtotalPaise) {
      const err = new Error(`discount_inr cannot exceed subtotal.`);
      err.status = 400;
      throw err;
    }
  }

  if (lineDiscountsPresentCount === processedItems.length) {
    const lineDiscountSumPaise = processedItems.reduce((sum, item) => sum + (item.line_discount_paise || 0), 0);
    if (orderDiscountGiven && orderDiscountPaise !== lineDiscountSumPaise) {
      const err = new Error(`Order discount_inr does not match the sum of line_discount_inr.`);
      err.status = 400;
      throw err;
    }
    finalOrderDiscountPaise = lineDiscountSumPaise;
    finalBasis = 'reported';
  } else {
    // No line discounts reported
    if (!orderDiscountGiven) {
      finalOrderDiscountPaise = null;
      finalBasis = null;
      for (const item of processedItems) {
        item.line_discount_paise = null;
      }
    } else {
      finalOrderDiscountPaise = orderDiscountPaise;
      finalBasis = 'estimated';

      // Allocate proportionally
      let allocatedSoFar = 0;
      for (let i = 0; i < processedItems.length; i++) {
        const item = processedItems[i];
        if (i === processedItems.length - 1) {
          item.line_discount_paise = finalOrderDiscountPaise - allocatedSoFar;
        } else {
          const share = subtotalPaise > 0
            ? Math.round((finalOrderDiscountPaise * item.gross_paise) / subtotalPaise)
            : 0;
          item.line_discount_paise = share;
          allocatedSoFar += share;
        }
      }
    }
  }

  return {
    order_id: orderId,
    customer_id: customerId,
    used_at: usedAtDate.toISOString(),
    payment_confirmed_at: paymentConfirmedDate.toISOString(),
    subtotal_paise: subtotalPaise,
    discount_paise: finalOrderDiscountPaise,
    line_discount_basis: finalBasis,
    items: processedItems
  };
}
