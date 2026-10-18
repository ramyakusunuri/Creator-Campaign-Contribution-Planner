import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { getDb, resetDbForTesting } from '../src/lib/db.ts';
import { renderOrUnknown, formatINR, formatINRWithPaise, shortINR } from '../src/lib/formatters.ts';

describe('Phase 1 Strict Nullability Test Suite', () => {
  before(() => {
    resetDbForTesting(true);
  });

  test('Database strictly differentiates between explicit 0 and NULL', () => {
    const db = getDb();

    // Clean test orders
    db.exec(`
      DELETE FROM order_items;
      DELETE FROM orders;
      DELETE FROM promo_codes WHERE code IN ('ZERO_TEST', 'NULL_TEST');
    `);

    // Insert dummy promos using valid columns
    db.prepare(`
      INSERT INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
      VALUES 
        ('B1', 'ZERO_TEST', 'c_zero', '2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z', '2026-01-01T00:00:00Z'),
        ('B1', 'NULL_TEST', 'c_null', '2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z', '2026-01-01T00:00:00Z');
    `).run();

    // Insert order with explicit 0 discount
    db.prepare(`
      INSERT INTO orders (brand_id, order_id, promo_code, customer_id, subtotal_inr, subtotal_paise, discount_inr, discount_paise, total_inr, total_paise, used_at, status, validity_flag)
      VALUES ('B1', 'ORD_EXPLICIT_ZERO', 'ZERO_TEST', 'cust_0', 100, 10000, 0, 0, 100, 10000, '2026-06-01T10:00:00Z', 'completed', 'valid');
    `).run();

    // Insert order with NULL discount (unknown)
    db.prepare(`
      INSERT INTO orders (brand_id, order_id, promo_code, customer_id, subtotal_inr, subtotal_paise, discount_inr, discount_paise, total_inr, total_paise, used_at, status, validity_flag)
      VALUES ('B1', 'ORD_EXPLICIT_NULL', 'NULL_TEST', 'cust_null', 100, 10000, NULL, NULL, NULL, NULL, '2026-06-01T10:00:00Z', 'completed', 'valid');
    `).run();

    const retrievedZero = db.prepare('SELECT discount_inr, discount_paise, total_inr, total_paise FROM orders WHERE order_id = ?').get('ORD_EXPLICIT_ZERO');
    const retrievedNull = db.prepare('SELECT discount_inr, discount_paise, total_inr, total_paise FROM orders WHERE order_id = ?').get('ORD_EXPLICIT_NULL');

    assert.strictEqual(retrievedZero.discount_inr, 0, 'Explicit 0 discount_inr must stay 0');
    assert.strictEqual(retrievedZero.discount_paise, 0, 'Explicit 0 discount_paise must stay 0');
    assert.strictEqual(retrievedZero.total_inr, 100);
    assert.strictEqual(retrievedZero.total_paise, 10000);

    assert.strictEqual(retrievedNull.discount_inr, null, 'NULL discount_inr must stay null, never fallback to 0');
    assert.strictEqual(retrievedNull.discount_paise, null, 'NULL discount_paise must stay null, never fallback to 0');
    assert.strictEqual(retrievedNull.total_inr, null, 'NULL total_inr must stay null');
    assert.strictEqual(retrievedNull.total_paise, null, 'NULL total_paise must stay null');

    // Also check creator relationships column strict nullability (NULL, NO DEFAULT)
    const creatorWithNullRelationships = db.prepare('SELECT creator_id, relationships FROM creators WHERE creator_id = ?;').get('c_neha');
    if (creatorWithNullRelationships) {
      assert.strictEqual(creatorWithNullRelationships.relationships, null, 'relationships must be stored as null when absent');
    }
  });

  test('renderOrUnknown and formatters correctly render 0 as value and null as "unknown"', () => {
    // Explicit 0 values
    assert.strictEqual(renderOrUnknown(0), '0');
    assert.strictEqual(formatINR(0), '₹0');
    assert.strictEqual(formatINRWithPaise(0), '₹0.00');
    assert.strictEqual(shortINR(0), '₹0');

    // Null or undefined values must strictly render as 'unknown' (never '₹0', '0', or blank)
    assert.strictEqual(renderOrUnknown(null), 'unknown');
    assert.strictEqual(renderOrUnknown(undefined), 'unknown');
    assert.strictEqual(formatINR(null), 'unknown');
    assert.strictEqual(formatINR(undefined), 'unknown');
    assert.strictEqual(formatINRWithPaise(null), 'unknown');
    assert.strictEqual(formatINRWithPaise(undefined), 'unknown');
    assert.strictEqual(shortINR(null), 'unknown');
    assert.strictEqual(shortINR(undefined), 'unknown');
  });
});
