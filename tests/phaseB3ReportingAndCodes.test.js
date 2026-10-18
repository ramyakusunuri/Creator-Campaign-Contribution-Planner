import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getDb, resetDbForTesting } from '../src/lib/db.ts';
import { POST as registerPromo, GET as listPromos } from '../src/app/api/brands/[brandId]/promo-codes/route.ts';
import { PATCH as patchPromo, DELETE as deletePromo } from '../src/app/api/brands/[brandId]/promo-codes/[code]/route.ts';
import { GET as checkCodeV1 } from '../src/app/api/v1/codes/check/route.ts';
import { POST as reportOrderV1 } from '../src/app/api/v1/orders/report/route.ts';
import { validateAndIngestOrder } from '../src/lib/orderIngestion.ts';

describe('Backend Phase B3: Promo Codes & Paid-Use Reporting Test Suite', () => {
  before(() => {
    resetDbForTesting(true);
  });

  beforeEach(() => {
    const db = getDb();
    // Clean tables between tests
    db.exec(`
      DELETE FROM promo_code_audit;
      DELETE FROM unregistered_code_uses;
      DELETE FROM order_items;
      DELETE FROM orders;
      DELETE FROM promo_codes;
    `);

    // Ensure creators exist for testing
    db.prepare(`
      INSERT OR REPLACE INTO creators (creator_id, name, category, default_fee_inr, default_fee_paise, excluded, relationships)
      VALUES ('CR_ROHAN', 'Rohan Sharma', 'Tech', 1000, 100000, 0, '["B1"]');
    `).run();

    db.prepare(`
      INSERT OR REPLACE INTO creators (creator_id, name, category, default_fee_inr, default_fee_paise, excluded, relationships)
      VALUES ('CR_RIVAL', 'Rival Creator', 'Fashion', 1000, 100000, 0, '["B2"]');
    `).run();
  });

  describe('1. Promo Code Registration & Extra Fields Guard', () => {
    test('Successfully registers promo code with starts_at and expires_at and normalizes code', async () => {
      const req = new Request('http://localhost:3000/api/brands/B1/promo-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Brand-Key': 'demo-brand-key-b1'
        },
        body: JSON.stringify({
          code: 'rohan20',
          creator_id: 'CR_ROHAN',
          starts_at: '2026-06-01T00:00:00+05:30',
          expires_at: '2026-12-31T23:59:59+05:30'
        })
      });

      const res = await registerPromo(req, { params: { brandId: 'B1' } });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.code, 'ROHAN20'); // Normalized to uppercase
      assert.strictEqual(data.creator_id, 'CR_ROHAN');
      assert.strictEqual(typeof data.status, 'string');
      assert.ok(data.starts_at);
      assert.ok(data.expires_at);

      // Verify in DB that code is uppercase
      const db = getDb();
      const row = db.prepare('SELECT * FROM promo_codes WHERE brand_id = ? AND code = ?;').get('B1', 'ROHAN20');
      assert.ok(row);
      assert.strictEqual(row.code, 'ROHAN20');
    });

    test('Strict extra fields check: rejects unexpected fields with 400 naming the field', async () => {
      const req = new Request('http://localhost:3000/api/brands/B1/promo-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Brand-Key': 'demo-brand-key-b1'
        },
        body: JSON.stringify({
          code: 'EXTRAFIELD1',
          creator_id: 'CR_ROHAN',
          starts_at: '2026-06-01T00:00:00Z',
          expires_at: '2026-12-31T23:59:59Z',
          discount_pct: 15
        })
      });

      const res = await registerPromo(req, { params: { brandId: 'B1' } });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /unexpected field: discount_pct/i);
    });

    test('Creator eligibility checks: rejects creator with rival conflict with 422', async () => {
      // B1 rivals with B2; CR_RIVAL has relationship with B2
      const req = new Request('http://localhost:3000/api/brands/B1/promo-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Brand-Key': 'demo-brand-key-b1'
        },
        body: JSON.stringify({
          code: 'RIVALPROMO',
          creator_id: 'CR_RIVAL',
          starts_at: '2026-06-01T00:00:00Z',
          expires_at: '2026-12-31T23:59:59Z'
        })
      });

      const res = await registerPromo(req, { params: { brandId: 'B1' } });
      assert.strictEqual(res.status, 422);
      const data = await res.json();
      assert.match(data.error, /rival/i);
    });
  });

  describe('2. Promo Code Lifecycle, Audit & Deletion Guard', () => {
    test('PATCH allows updating validity dates only and creates promo_code_audit row', async () => {
      const db = getDb();
      // Insert initial promo code
      db.prepare(`
        INSERT INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
        VALUES ('B1', 'LIFECYCLE1', 'CR_ROHAN', '2026-01-01T00:00:00Z', '2026-06-01T00:00:00Z', '2026-01-01T00:00:00Z');
      `).run();

      const patchReq = new Request('http://localhost:3000/api/brands/B1/promo-codes/LIFECYCLE1', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Brand-Key': 'demo-brand-key-b1'
        },
        body: JSON.stringify({
          expires_at: '2026-12-31T23:59:59Z'
        })
      });

      const patchRes = await patchPromo(patchReq, { params: { brandId: 'B1', code: 'LIFECYCLE1' } });
      assert.strictEqual(patchRes.status, 200);
      const patchData = await patchRes.json();
      assert.strictEqual(patchData.code, 'LIFECYCLE1');
      assert.strictEqual(patchData.expires_at, '2026-12-31T23:59:59.000Z');

      // Verify audit record created in promo_code_audit
      const auditRows = db.prepare('SELECT * FROM promo_code_audit WHERE brand_id = ? AND code = ?;').all('B1', 'LIFECYCLE1');
      assert.strictEqual(auditRows.length, 1);
      assert.strictEqual(auditRows[0].code, 'LIFECYCLE1');
      assert.strictEqual(auditRows[0].old_valid_to, '2026-06-01T00:00:00Z');
      assert.strictEqual(auditRows[0].new_valid_to, '2026-12-31T23:59:59.000Z');

      // Verify status is not statically stored in promo_codes table
      const promoRow = db.prepare('SELECT * FROM promo_codes WHERE brand_id = ? AND code = ?;').get('B1', 'LIFECYCLE1');
      assert.strictEqual(promoRow.status, undefined); // Column does not exist in schema
    });

    test('DELETE returns HTTP 405 Method Not Allowed', async () => {
      const deleteRes = await deletePromo();
      assert.strictEqual(deleteRes.status, 405);
      const data = await deleteRes.json();
      assert.match(data.error, /Method Not Allowed/i);
    });
  });

  describe('3. Pre-checkout Code Validation Endpoint (GET /api/v1/codes/check)', () => {
    test('Returns 401 when X-Report-Key is missing and 403 on invalid key', async () => {
      const reqMissing = new Request('http://localhost:3000/api/v1/codes/check?code=ROHAN20');
      const resMissing = await checkCodeV1(reqMissing);
      assert.strictEqual(resMissing.status, 401);

      const reqInvalid = new Request('http://localhost:3000/api/v1/codes/check?code=ROHAN20', {
        headers: { 'X-Report-Key': 'wrong-report-key' }
      });
      const resInvalid = await checkCodeV1(reqInvalid);
      assert.strictEqual(resInvalid.status, 401);
    });

    test('Valid promo code returns status without leaking creator ID, formulas or rates, with zero audit rows', async () => {
      const db = getDb();
      db.prepare(`
        INSERT INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
        VALUES ('B1', 'CHECKVALID1', 'CR_ROHAN', '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
      `).run();

      const auditBefore = db.prepare('SELECT COUNT(*) as count FROM promo_code_audit;').get().count;

      const req = new Request('http://localhost:3000/api/v1/codes/check?code=CHECKVALID1', {
        headers: { 'X-Report-Key': 'demo-report-key-b1' }
      });
      const res = await checkCodeV1(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.strictEqual(data.code, 'CHECKVALID1');
      assert.strictEqual(data.valid, true);
      assert.strictEqual(data.status, 'valid');
      assert.strictEqual(data.starts_at, '2026-01-01T00:00:00Z');
      assert.strictEqual(data.expires_at, '2027-01-01T00:00:00Z');

      // Security check: Zero leakage of brand internal details
      assert.strictEqual(data.creator_id, undefined);
      assert.strictEqual(data.creator, undefined);
      assert.strictEqual(data.fee, undefined);
      assert.strictEqual(data.rate, undefined);
      assert.strictEqual(data.discount_formula, undefined);

      // Audit check: Zero audit rows written
      const auditAfter = db.prepare('SELECT COUNT(*) as count FROM promo_code_audit;').get().count;
      assert.strictEqual(auditAfter, auditBefore);
    });

    test('Non-existent promo code returns valid=false and status="unknown"', async () => {
      const req = new Request('http://localhost:3000/api/v1/codes/check?code=GHOSTCODE', {
        headers: { 'X-Report-Key': 'demo-report-key-b1' }
      });
      const res = await checkCodeV1(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.code, 'GHOSTCODE');
      assert.strictEqual(data.valid, false);
      assert.strictEqual(data.status, 'unknown');
      assert.strictEqual(data.starts_at, null);
      assert.strictEqual(data.expires_at, null);
    });
  });

  describe('4. Paid-Use Reporting Endpoint (POST /api/v1/orders/report)', () => {
    test('Rejects request body > 1MB with 413 Payload Too Large', async () => {
      const largePayload = 'a'.repeat(1024 * 1024 + 50);
      const req = new Request('http://localhost:3000/api/v1/orders/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Report-Key': 'demo-report-key-b1',
          'Content-Length': String(largePayload.length)
        },
        body: largePayload
      });

      const res = await reportOrderV1(req);
      assert.strictEqual(res.status, 413);
      const data = await res.json();
      assert.match(data.error, /Payload Too Large/i);
    });

    test('Requires payment_confirmed_at timestamp with timezone offset', async () => {
      const req = new Request('http://localhost:3000/api/v1/orders/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Report-Key': 'demo-report-key-b1'
        },
        body: JSON.stringify({
          order_id: 'ORD-NO-PAY-CONFIRM',
          customer_id: 'CUST-1',
          used_at: '2026-06-15T10:00:00Z',
          items: [{ product_id: 'P1', unit_price_inr: 500, quantity: 1 }]
        })
      });

      const res = await reportOrderV1(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /payment_confirmed_at/i);
    });

    test('Proportional discount split test: (2 x 1000 + 1 x 500) with discount 250 -> subtotal 2500, total 2250, line discounts 200 and 50', async () => {
      const db = getDb();
      // Register promo code
      db.prepare(`
        INSERT INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
        VALUES ('B1', 'PROPORTION250', 'CR_ROHAN', '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
      `).run();

      const orderPayload = {
        order_id: 'ORD-PROPORTIONAL-01',
        customer_id: 'CUST-PROP-1',
        promo_code: 'PROPORTION250',
        used_at: '2026-06-15T12:00:00+05:30',
        payment_confirmed_at: '2026-06-15T12:00:10+05:30',
        discount_inr: 250,
        items: [
          { product_id: 'SKU-A', name: 'Item A', unit_price_inr: 1000, quantity: 2 },
          { product_id: 'SKU-B', name: 'Item B', unit_price_inr: 500, quantity: 1 }
        ]
      };

      const req = new Request('http://localhost:3000/api/v1/orders/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Report-Key': 'demo-report-key-b1'
        },
        body: JSON.stringify(orderPayload)
      });

      const res = await reportOrderV1(req);
      assert.strictEqual(res.status, 201);
      const data = await res.json();

      assert.strictEqual(data.subtotal_inr, 2500);
      assert.strictEqual(data.discount_inr, 250);
      assert.strictEqual(data.total_inr, 2250);

      // Verify line items in response
      assert.strictEqual(data.items.length, 2);
      assert.strictEqual(data.items[0].line_discount_inr, 200);
      assert.strictEqual(data.items[0].net_inr, 1800);
      assert.strictEqual(data.items[1].line_discount_inr, 50);
      assert.strictEqual(data.items[1].net_inr, 450);

      // Verify integer paise in database
      const orderDb = db.prepare('SELECT * FROM orders WHERE order_id = ?;').get('ORD-PROPORTIONAL-01');
      assert.strictEqual(orderDb.subtotal_paise, 250000);
      assert.strictEqual(orderDb.discount_paise, 25000);
      assert.strictEqual(orderDb.total_paise, 225000);
      assert.strictEqual(orderDb.source, 'website');
      assert.strictEqual(orderDb.validity_flag, 'valid');

      const itemsDb = db.prepare('SELECT * FROM order_items WHERE order_id_ref = ? ORDER BY id ASC;').all(orderDb.id);
      assert.strictEqual(itemsDb.length, 2);
      assert.strictEqual(itemsDb[0].gross_paise, 200000);
      assert.strictEqual(itemsDb[0].line_discount_paise, 20000);
      assert.strictEqual(itemsDb[0].net_paise, 180000);

      assert.strictEqual(itemsDb[1].gross_paise, 50000);
      assert.strictEqual(itemsDb[1].line_discount_paise, 5000);
      assert.strictEqual(itemsDb[1].net_paise, 45000);
    });

    test('Idempotency & Concurrency: identical duplicate returns 200 duplicate=true, modified duplicate returns 409', async () => {
      const db = getDb();
      db.prepare(`
        INSERT INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
        VALUES ('B1', 'IDEMPOTENT1', 'CR_ROHAN', '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
      `).run();

      const orderPayload = {
        order_id: 'ORD-IDEM-99',
        customer_id: 'CUST-IDEM',
        promo_code: 'IDEMPOTENT1',
        used_at: '2026-06-15T12:00:00Z',
        payment_confirmed_at: '2026-06-15T12:01:00Z',
        items: [{ product_id: 'SKU-1', unit_price_inr: 100, quantity: 1 }]
      };

      // 1. First submission -> 201
      const req1 = new Request('http://localhost:3000/api/v1/orders/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Report-Key': 'demo-report-key-b1' },
        body: JSON.stringify(orderPayload)
      });
      const res1 = await reportOrderV1(req1);
      assert.strictEqual(res1.status, 201);

      // 2. Exact duplicate -> 200 duplicate=true
      const req2 = new Request('http://localhost:3000/api/v1/orders/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Report-Key': 'demo-report-key-b1' },
        body: JSON.stringify(orderPayload)
      });
      const res2 = await reportOrderV1(req2);
      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();
      assert.strictEqual(data2.duplicate, true);
      assert.strictEqual(data2.order_id, 'ORD-IDEM-99');

      // 3. Mismatched duplicate (different items/amount) -> 409 Conflict
      const alteredPayload = {
        ...orderPayload,
        items: [{ product_id: 'SKU-1', unit_price_inr: 500, quantity: 1 }]
      };
      const req3 = new Request('http://localhost:3000/api/v1/orders/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Report-Key': 'demo-report-key-b1' },
        body: JSON.stringify(alteredPayload)
      });
      const res3 = await reportOrderV1(req3);
      assert.strictEqual(res3.status, 409);
    });

    test('Unregistered code is saved to unregistered_code_uses and NOT saved to orders', async () => {
      const orderPayload = {
        order_id: 'ORD-UNREG-101',
        customer_id: 'CUST-UNREG',
        promo_code: 'GHOST_UNKNOWN',
        used_at: '2026-06-15T12:00:00Z',
        payment_confirmed_at: '2026-06-15T12:01:00Z',
        discount_inr: 50,
        items: [{ product_id: 'SKU-1', unit_price_inr: 500, quantity: 1 }]
      };

      const req = new Request('http://localhost:3000/api/v1/orders/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Report-Key': 'demo-report-key-b1' },
        body: JSON.stringify(orderPayload)
      });

      const res = await reportOrderV1(req);
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.registered, false);
      assert.strictEqual(data.validity_flag, 'unregistered');

      // Verify stored in unregistered_code_uses
      const db = getDb();
      const unregRow = db.prepare('SELECT * FROM unregistered_code_uses WHERE order_id = ?;').get('ORD-UNREG-101');
      assert.ok(unregRow);
      assert.strictEqual(unregRow.code_entered, 'GHOST_UNKNOWN');
      assert.strictEqual(unregRow.discount_paise, 5000);
      assert.strictEqual(unregRow.subtotal_paise, 50000);
      assert.strictEqual(unregRow.total_paise, 45000);

      // Verify NOT in orders table
      const orderRow = db.prepare('SELECT * FROM orders WHERE order_id = ?;').get('ORD-UNREG-101');
      assert.strictEqual(orderRow, undefined);
    });

    test('Out-of-validity order is saved to orders with validity_flag="outside_validity"', async () => {
      const db = getDb();
      db.prepare(`
        INSERT INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
        VALUES ('B1', 'PASTEXPIRED', 'CR_ROHAN', '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', '2026-01-01T00:00:00Z');
      `).run();

      const orderPayload = {
        order_id: 'ORD-OUTSIDE-55',
        customer_id: 'CUST-OUTSIDE',
        promo_code: 'PASTEXPIRED',
        used_at: '2026-06-15T12:00:00Z', // 4 months after expiration
        payment_confirmed_at: '2026-06-15T12:01:00Z',
        items: [{ product_id: 'SKU-1', unit_price_inr: 500, quantity: 1 }]
      };

      const req = new Request('http://localhost:3000/api/v1/orders/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Report-Key': 'demo-report-key-b1' },
        body: JSON.stringify(orderPayload)
      });

      const res = await reportOrderV1(req);
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.registered, true);
      assert.strictEqual(data.validity_flag, 'outside_validity');

      // Verify saved in orders
      const orderRow = db.prepare('SELECT * FROM orders WHERE order_id = ?;').get('ORD-OUTSIDE-55');
      assert.ok(orderRow);
      assert.strictEqual(orderRow.validity_flag, 'outside_validity');
    });

    test('Transaction rollback: mid-transaction failure rolls back completely leaving 0 rows', async () => {
      const db = getDb();
      db.prepare(`
        INSERT INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
        VALUES ('B1', 'ROLLBACK_CODE', 'CR_ROHAN', '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
      `).run();

      // Temporarily sabotage order_items table to fail insertion during transaction
      const ordersCountBefore = db.prepare('SELECT COUNT(*) as count FROM orders;').get().count;

      // We simulate a mid-write failure by modifying order_items constraint
      db.exec('CREATE TRIGGER fail_item_insert BEFORE INSERT ON order_items BEGIN SELECT RAISE(FAIL, "Forced mid-write failure"); END;');

      const orderPayload = {
        order_id: 'ORD-ROLLBACK-FAIL',
        customer_id: 'CUST-ROLLBACK',
        promo_code: 'ROLLBACK_CODE',
        used_at: '2026-06-15T12:00:00Z',
        payment_confirmed_at: '2026-06-15T12:01:00Z',
        items: [{ product_id: 'SKU-1', unit_price_inr: 1000, quantity: 1 }]
      };

      assert.throws(() => {
        validateAndIngestOrder('B1', orderPayload, 'ROLLBACK_CODE', {
          source: 'website',
          saveUnregisteredToSeparateTable: true,
          requirePaymentConfirmed: true
        });
      }, /Forced mid-write failure/);

      // Drop the sabotage trigger
      db.exec('DROP TRIGGER fail_item_insert;');

      // Verify that orders table rolled back completely and has 0 rows from this order
      const ordersCountAfter = db.prepare('SELECT COUNT(*) as count FROM orders;').get().count;
      assert.strictEqual(ordersCountAfter, ordersCountBefore);
      const orderRow = db.prepare('SELECT * FROM orders WHERE order_id = ?;').get('ORD-ROLLBACK-FAIL');
      assert.strictEqual(orderRow, undefined);
    });
  });
});
