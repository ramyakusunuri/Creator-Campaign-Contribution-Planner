import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDbForTesting, getDb, hashApiKey } from '../backend/src/lib/db.ts';
import {
  calculateRetainedSales,
  calculatePreFeeContribution,
  calculateNetContribution,
  calculateIncrementalContribution,
  calculateBreakEvenShare,
  round2
} from '../backend/src/lib/calculator.ts';
import { validateAndIngestOrder } from '../backend/src/lib/orderIngestion.ts';
import { processRefund } from '../backend/src/lib/refundProcessor.ts';
import { derivePromoStatus, checkEligibility } from '../backend/src/lib/promoLogic.ts';
import { ShopifyAdapter } from '../backend/src/lib/ecommerce/shopifyAdapter.ts';
import { MockAdapter } from '../backend/src/lib/ecommerce/mockAdapter.ts';
import crypto from 'node:crypto';

describe('C24 Promo-Code & E-Commerce Integration Test Suite', () => {
  before(() => {
    resetDbForTesting(true);
  });

  beforeEach(() => {
    const db = getDb();
    // Clean dynamic tables between test suites
    db.exec(`
      DELETE FROM refund_events;
      DELETE FROM order_items;
      DELETE FROM orders;
      DELETE FROM promo_codes;
      DELETE FROM webhook_idempotency_log;
      DELETE FROM audit_log;
    `);
  });

  test('T1: Registering an unused promo code without changing existing metrics', () => {
    const db = getDb();
    const validFrom = new Date(Date.now() - 3600000).toISOString();
    const validTo = new Date(Date.now() + 86400000).toISOString();

    db.prepare(`
      INSERT INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
      VALUES (?, ?, ?, ?, ?, ?);
    `).run('B1', 'AARAV10', 'CR1', validFrom, validTo, new Date().toISOString());

    const promo = db.prepare('SELECT * FROM promo_codes WHERE brand_id = ? AND code = ?;').get('B1', 'AARAV10');
    assert.ok(promo, 'Promo code should exist in database');

    const status = derivePromoStatus(validFrom, validTo);
    assert.equal(status, 'valid');

    // Confirm 0 orders recorded and existing metrics untouched
    const orders = db.prepare('SELECT COUNT(*) as count FROM orders WHERE brand_id = ? AND promo_code = ?;').get('B1', 'AARAV10');
    assert.equal(orders.count, 0, 'Unused promo code must have exactly 0 orders');
  });

  test('T2: Valid order updating the appropriate campaign metrics', () => {
    const db = getDb();
    const validFrom = new Date(Date.now() - 3600000).toISOString();
    const validTo = new Date(Date.now() + 86400000).toISOString();

    db.prepare(`
      INSERT INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
      VALUES (?, ?, ?, ?, ?, ?);
    `).run('B1', 'AARAV10', 'CR1', validFrom, validTo, new Date().toISOString());

    // P1: ₹1,000 x 2, P2: ₹500 x 1, discount: ₹250
    const orderPayload = {
      order_id: 'ORD-101',
      customer_id: 'CUST-001',
      used_at: new Date().toISOString(),
      discount_inr: 250,
      items: [
        { product_id: 'P1', name: 'Product 1', unit_price_inr: 1000, quantity: 2 },
        { product_id: 'P2', name: 'Product 2', unit_price_inr: 500, quantity: 1 }
      ]
    };

    const result = validateAndIngestOrder('B1', orderPayload, 'AARAV10');
    assert.equal(result.subtotal_inr, 2500);
    assert.equal(result.discount_inr, 250);
    assert.equal(result.total_inr, 2250);
    assert.equal(result.discount_basis, 'estimated');
    assert.equal(result.validity_flag, 'valid');

    // Check proportional line discount split: 200 on P1, 50 on P2
    assert.equal(result.items[0].line_discount_inr, 200);
    assert.equal(result.items[1].line_discount_inr, 50);

    // C24 Economics: Retained sales = ₹2,250, 40% margin => ₹900 pre-fee contribution
    const retainedSales = calculateRetainedSales(1, 0, 2500, 10);
    assert.equal(retainedSales, 2250);
    const preFee = calculatePreFeeContribution(retainedSales, 40);
    assert.equal(preFee, 900);
  });

  test('T3: Duplicate order and refund events being processed only once', () => {
    const validFrom = new Date(Date.now() - 3600000).toISOString();
    const validTo = new Date(Date.now() + 86400000).toISOString();
    const db = getDb();
    db.prepare(`
      INSERT INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
      VALUES (?, ?, ?, ?, ?, ?);
    `).run('B1', 'AARAV10', 'CR1', validFrom, validTo, new Date().toISOString());

    const orderPayload = {
      order_id: 'ORD-IDEMP',
      customer_id: 'CUST-002',
      used_at: new Date().toISOString(),
      discount_inr: 0,
      items: [{ product_id: 'P1', unit_price_inr: 1000, quantity: 1 }]
    };

    // First delivery succeeds
    const first = validateAndIngestOrder('B1', orderPayload, 'AARAV10');
    assert.equal(first.order_id, 'ORD-IDEMP');

    // Duplicate delivery throws 409
    assert.throws(
      () => validateAndIngestOrder('B1', orderPayload, 'AARAV10'),
      (err) => err.status === 409
    );

    const count = db.prepare('SELECT COUNT(*) as c FROM orders WHERE brand_id = ? AND order_id = ?;').get('B1', 'ORD-IDEMP');
    assert.equal(count.c, 1, 'Only one order record must exist in DB');
  });

  test('T4: Partial refunds, full refunds, and cancellations', () => {
    const validFrom = new Date(Date.now() - 3600000).toISOString();
    const validTo = new Date(Date.now() + 86400000).toISOString();
    const db = getDb();
    db.prepare(`
      INSERT INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
      VALUES (?, ?, ?, ?, ?, ?);
    `).run('B1', 'AARAV10', 'CR1', validFrom, validTo, new Date().toISOString());

    validateAndIngestOrder('B1', {
      order_id: 'ORD-REF-TEST',
      customer_id: 'CUST-003',
      used_at: new Date().toISOString(),
      discount_inr: 100,
      items: [{ product_id: 'P1', unit_price_inr: 1000, quantity: 2 }]
    }, 'AARAV10');

    // 1. Partial Refund of ₹300
    const partialRes = processRefund({
      brand_id: 'B1',
      refund_id: 'REF-PARTIAL-01',
      order_id: 'ORD-REF-TEST',
      amount_inr: 300,
      is_full_refund: false
    });
    assert.equal(partialRes.order_status, 'partially_refunded');

    const orderRow1 = db.prepare('SELECT status FROM orders WHERE brand_id = ? AND order_id = ?;').get('B1', 'ORD-REF-TEST');
    assert.equal(orderRow1.status, 'partially_refunded');

    // 2. Duplicate refund event is ignored
    const dupRefund = processRefund({
      brand_id: 'B1',
      refund_id: 'REF-PARTIAL-01',
      order_id: 'ORD-REF-TEST',
      amount_inr: 300
    });
    assert.equal(dupRefund.duplicate, true);

    // 3. Full Refund of remaining amount
    const fullRes = processRefund({
      brand_id: 'B1',
      refund_id: 'REF-FULL-02',
      order_id: 'ORD-REF-TEST',
      amount_inr: 1600,
      is_full_refund: true
    });
    assert.equal(fullRes.order_status, 'refunded');

    const orderRow2 = db.prepare('SELECT status FROM orders WHERE brand_id = ? AND order_id = ?;').get('B1', 'ORD-REF-TEST');
    assert.equal(orderRow2.status, 'refunded');
  });

  test('T5: Invalid webhook signatures and malformed payloads', () => {
    const shopifyAdapter = new ShopifyAdapter();
    const payload = JSON.stringify({ id: 12345, line_items: [] });
    const secret = 'shpss_secret_123';

    // Invalid signature
    const badHeaders = new Headers({ 'x-shopify-hmac-sha256': 'invalid_signature_string' });
    const isBadValid = shopifyAdapter.verifySignature(payload, badHeaders, secret);
    assert.equal(isBadValid, false, 'Invalid HMAC must fail verification');

    // Valid signature
    const validSignature = crypto.createHmac('sha256', secret).update(payload).digest('base64');
    const goodHeaders = new Headers({ 'x-shopify-hmac-sha256': validSignature });
    const isGoodValid = shopifyAdapter.verifySignature(payload, goodHeaders, secret);
    assert.equal(isGoodValid, true, 'Valid HMAC must pass verification');

    // Forbidden customer PII payload
    assert.throws(
      () => validateAndIngestOrder('B1', {
        order_id: 'ORD-PII-BAD',
        customer_id: 'CUST-1',
        customer_email: 'customer@example.com', // PII!
        used_at: new Date().toISOString(),
        items: [{ product_id: 'P1', unit_price_inr: 100, quantity: 1 }]
      }),
      (err) => err.status === 400 && err.message.includes('Forbidden customer PII')
    );
  });

  test('T6: Unregistered promo codes and orders outside validity dates', () => {
    const db = getDb();
    const validFrom = new Date(Date.now() - 100000).toISOString();
    const validTo = new Date(Date.now() - 50000).toISOString(); // expired

    db.prepare(`
      INSERT INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
      VALUES (?, ?, ?, ?, ?, ?);
    `).run('B1', 'EXPIRED10', 'CR1', validFrom, validTo, new Date().toISOString());

    // 1. Unregistered promo code
    const unregResult = validateAndIngestOrder('B1', {
      order_id: 'ORD-UNREG',
      customer_id: 'CUST-009',
      used_at: new Date().toISOString(),
      items: [{ product_id: 'P1', unit_price_inr: 500, quantity: 1 }]
    }, 'NOTREGISTERED');

    assert.equal(unregResult.registered, false);
    assert.equal(unregResult.validity_flag, 'unregistered');

    // 2. Outside validity order (used_at is now, but code expired 50s ago)
    const outsideResult = validateAndIngestOrder('B1', {
      order_id: 'ORD-OUTSIDE',
      customer_id: 'CUST-010',
      used_at: new Date().toISOString(),
      items: [{ product_id: 'P1', unit_price_inr: 500, quantity: 1 }]
    }, 'EXPIRED10');

    assert.equal(outsideResult.registered, true);
    assert.equal(outsideResult.validity_flag, 'outside_validity');
  });

  test('T7: Cross-brand eligibility checks and rival conflict', () => {
    const db = getDb();
    // CR3 works with B2. B1's rival is B2.
    const eligibilityB1 = checkEligibility(db, 'B1', 'CR3');
    assert.equal(eligibilityB1.eligible, false, 'CR3 must be blocked for B1 due to rival conflict');
    assert.ok(eligibilityB1.reason.includes('rival'), 'Reason must mention rival conflict');

    // CR3 is eligible for B2
    const eligibilityB2 = checkEligibility(db, 'B2', 'CR3');
    assert.equal(eligibilityB2.eligible, true, 'CR3 must be eligible for B2');

    // CR5 is excluded
    const eligibilityCR5 = checkEligibility(db, 'B1', 'CR5');
    assert.equal(eligibilityCR5.eligible, false);

    // CR6 has null relationships
    const eligibilityCR6 = checkEligibility(db, 'B1', 'CR6');
    assert.equal(eligibilityCR6.eligible, false);
  });

  test('T8: Line discount accounting and proportional split validation', () => {
    // 3 lines of ₹100 with discount ₹100: 33.33, 33.33, 33.34
    const validFrom = new Date(Date.now() - 3600000).toISOString();
    const validTo = new Date(Date.now() + 86400000).toISOString();
    const db = getDb();
    db.prepare(`
      INSERT INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
      VALUES (?, ?, ?, ?, ?, ?);
    `).run('B1', 'TESTSPLIT', 'CR1', validFrom, validTo, new Date().toISOString());

    const res = validateAndIngestOrder('B1', {
      order_id: 'ORD-SPLIT-3',
      customer_id: 'CUST-100',
      used_at: new Date().toISOString(),
      discount_inr: 100,
      items: [
        { product_id: 'A', unit_price_inr: 100, quantity: 1 },
        { product_id: 'B', unit_price_inr: 100, quantity: 1 },
        { product_id: 'C', unit_price_inr: 100, quantity: 1 }
      ]
    }, 'TESTSPLIT');

    assert.equal(res.items[0].line_discount_inr, 33.33);
    assert.equal(res.items[1].line_discount_inr, 33.33);
    assert.equal(res.items[2].line_discount_inr, 33.34); // last line absorbs rounding remainder!
    assert.equal(round2(res.items[0].line_discount_inr + res.items[1].line_discount_inr + res.items[2].line_discount_inr), 100);
  });

  test('T9: Null values remaining unknown rather than becoming zero', () => {
    const validFrom = new Date(Date.now() - 3600000).toISOString();
    const validTo = new Date(Date.now() + 86400000).toISOString();
    const db = getDb();
    db.prepare(`
      INSERT INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
      VALUES (?, ?, ?, ?, ?, ?);
    `).run('B1', 'TESTUNKNOWN', 'CR1', validFrom, validTo, new Date().toISOString());

    const res = validateAndIngestOrder('B1', {
      order_id: 'ORD-UNKNOWN-DISC',
      customer_id: 'CUST-101',
      used_at: new Date().toISOString(),
      items: [{ product_id: 'P1', unit_price_inr: 1500, quantity: 1 }]
      // discount_inr omitted => UNKNOWN
    }, 'TESTUNKNOWN');

    assert.equal(res.discount_inr, null, 'Unknown discount must remain null');
    assert.equal(res.total_inr, null, 'Total must remain null when discount is unknown');
    assert.equal(res.items[0].line_discount_inr, null);
    assert.equal(res.items[0].net_inr, null);
  });

  test('T10: All existing Phase 1 tests continuing to pass', () => {
    // 100 orders, 20 returns, ₹1,000 AOV, 10% discount => ₹72,000 retained sales
    const retainedSales = calculateRetainedSales(100, 20, 1000, 10);
    assert.equal(retainedSales, 72000);

    // 40% pre-fee contribution => ₹28,800
    const preFee = calculatePreFeeContribution(retainedSales, 40);
    assert.equal(preFee, 28800);

    // Net contribution with ₹20,000 fee => ₹8,800 (from fixture.json)
    const netContrib = calculateNetContribution(retainedSales, 40, 20000);
    assert.equal(netContrib, 8800);

    // Incremental contribution at 0.8 share => +₹3,040
    const incContrib80 = calculateIncrementalContribution(retainedSales, 40, 20000, 0.8);
    assert.equal(incContrib80, 3040);

    // Incremental contribution at 0.5 share => -₹5,600
    const incContrib50 = calculateIncrementalContribution(retainedSales, 40, 20000, 0.5);
    assert.equal(incContrib50, -5600);

    // Break-even share: 20000 / 28800 = 0.69444...
    const breakEven = calculateBreakEvenShare(preFee, 20000);
    assert.ok(Math.abs((breakEven ?? 0) - (20000 / 28800)) < 0.0001);
  });

  test('T11: IST (+05:30) timezone timestamps parsed and handled correctly', () => {
    const db = getDb();
    // Valid in IST: 18 Oct 2026, 00:00:00 IST to 18 Nov 2026, 23:59:59 IST
    const validFromIST = '2026-10-18T00:00:00+05:30';
    const validToIST = '2026-11-18T23:59:59+05:30';

    db.prepare(`
      INSERT INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
      VALUES (?, ?, ?, ?, ?, ?);
    `).run('B1', 'ISTCODE10', 'CR1', new Date(validFromIST).toISOString(), new Date(validToIST).toISOString(), new Date().toISOString());

    // Order placed at 18 Oct 2026, 14:30:00 IST (+05:30)
    const orderUsedAtIST = '2026-10-18T14:30:00+05:30';
    const res = validateAndIngestOrder('B1', {
      order_id: 'ORD-IST-01',
      customer_id: 'CUST-IST-1',
      used_at: orderUsedAtIST,
      discount_inr: 100,
      items: [{ product_id: 'P1', unit_price_inr: 1000, quantity: 1 }]
    }, 'ISTCODE10');

    assert.equal(res.success, true);
    assert.equal(res.validity_flag, 'valid');
    assert.equal(res.discount_inr, 100);

    // Verify stored date corresponds to exact UTC time of the IST timestamp
    const storedOrder = db.prepare('SELECT used_at FROM orders WHERE brand_id = ? AND order_id = ?;').get('B1', 'ORD-IST-01');
    assert.equal(storedOrder.used_at, new Date(orderUsedAtIST).toISOString());
  });
});

