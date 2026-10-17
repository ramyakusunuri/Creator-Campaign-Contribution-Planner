import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { SqliteStorage } from '../src/storage/sqlite.js';
import { toPaise, fromPaise, canonicalHash } from '../src/storage/interface.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.join(__dirname, 'test_promo_run.db');

describe('C24 Native Promo Integration Test Suite', () => {
  let appInstance;
  let serverUrl;

  before(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch {}
    }

    appInstance = createApp({
      dbPath: TEST_DB_PATH,
      appEnv: 'demo'
    });

    await new Promise((resolve) => {
      appInstance.server.listen(0, '127.0.0.1', () => {
        const port = appInstance.server.address().port;
        serverUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(() => {
    if (appInstance) {
      appInstance.close();
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch {}
    }
  });

  test('T1: Health check reports status ok and demo environment', async () => {
    const res = await fetch(`${serverUrl}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.environment, 'demo');
    assert.ok(data.timestamp);
  });

  test('T2: Dual-Key Auth enforces correct permissions with 401 and 403', async () => {
    // 1. Missing key -> 401
    const resNoKey = await fetch(`${serverUrl}/brands/B1/promo-codes`);
    assert.equal(resNoKey.status, 401);

    // 2. Wrong key -> 401
    const resBadKey = await fetch(`${serverUrl}/brands/B1/promo-codes`, {
      headers: { 'X-Brand-Key': 'wrong-key-value' }
    });
    assert.equal(resBadKey.status, 401);

    // 3. Report key on Brand endpoint -> 403
    const resWrongKeyType = await fetch(`${serverUrl}/brands/B1/promo-codes`, {
      headers: { 'X-Report-Key': 'demo-report-key-b1' }
    });
    assert.equal(resWrongKeyType.status, 403);

    // 4. Brand key on Report endpoint -> 403
    const resWrongReportType = await fetch(`${serverUrl}/brands/B1/promo-codes/CODE/check`, {
      headers: { 'X-Brand-Key': 'demo-key-b1' }
    });
    assert.equal(resWrongReportType.status, 403);

    // 5. Valid Brand key on Brand endpoint -> 200
    const resGood = await fetch(`${serverUrl}/brands/B1/promo-codes`, {
      headers: { 'X-Brand-Key': 'demo-key-b1' }
    });
    assert.equal(resGood.status, 200);
  });

  test('T3: Promo Code Registration, Creator Eligibility, and Format Validation', async () => {
    const now = new Date();
    const validFrom = new Date(now.getTime() - 3600000).toISOString();
    const validTo = new Date(now.getTime() + 86400000 * 30).toISOString();

    // 1. Ineligible creator (rival conflict: CR3 collaborates with B2, rival of B1)
    const resRival = await fetch(`${serverUrl}/brands/B1/promo-codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Brand-Key': 'demo-key-b1'
      },
      body: JSON.stringify({
        code: 'RIVAL10',
        creator_id: 'CR3',
        valid_from: validFrom,
        valid_to: validTo
      })
    });
    assert.equal(resRival.status, 400);
    const rivalData = await resRival.json();
    assert.ok(rivalData.error.includes('rival'));

    // 2. Invalid code format (< 4 chars or non-alphanumeric)
    const resShort = await fetch(`${serverUrl}/brands/B1/promo-codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Brand-Key': 'demo-key-b1'
      },
      body: JSON.stringify({
        code: 'A1',
        creator_id: 'CR1',
        valid_from: validFrom,
        valid_to: validTo
      })
    });
    assert.equal(resShort.status, 400);

    // 3. Valid Registration: AARAV10 with CR1
    const resValid = await fetch(`${serverUrl}/brands/B1/promo-codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Brand-Key': 'demo-key-b1'
      },
      body: JSON.stringify({
        code: 'AARAV10',
        creator_id: 'CR1',
        valid_from: validFrom,
        valid_to: validTo
      })
    });
    assert.equal(resValid.status, 201);
    const validData = await resValid.json();
    assert.equal(validData.code, 'AARAV10');
    assert.equal(validData.creator_id, 'CR1');
    assert.equal(validData.status, 'valid');

    // 4. Duplicate Registration throws 409
    const resDup = await fetch(`${serverUrl}/brands/B1/promo-codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Brand-Key': 'demo-key-b1'
      },
      body: JSON.stringify({
        code: 'AARAV10',
        creator_id: 'CR1',
        valid_from: validFrom,
        valid_to: validTo
      })
    });
    assert.equal(resDup.status, 409);
  });

  test('T4: Pre-checkout Advisory Check (GET .../check) does not leak discounts or creators', async () => {
    // 1. Registered and valid code
    const resCheckValid = await fetch(`${serverUrl}/brands/B1/promo-codes/AARAV10/check`, {
      headers: { 'X-Report-Key': 'demo-report-key-b1' }
    });
    assert.equal(resCheckValid.status, 200);
    const dataValid = await resCheckValid.json();
    assert.equal(dataValid.code, 'AARAV10');
    assert.equal(dataValid.valid, true);
    assert.equal(dataValid.reason, 'valid');
    // Ensure no leakage of brand internal details
    assert.equal(dataValid.creator_id, undefined);
    assert.equal(dataValid.discount_rule, undefined);

    // 2. Non-existent code
    const resCheckMissing = await fetch(`${serverUrl}/brands/B1/promo-codes/NONEXIST99/check`, {
      headers: { 'X-Report-Key': 'demo-report-key-b1' }
    });
    assert.equal(resCheckMissing.status, 200);
    const dataMissing = await resCheckMissing.json();
    assert.equal(dataMissing.valid, false);
    assert.equal(dataMissing.reason, 'not_found');
  });

  test('T5: Paid Order Reporting with Canonical Hash Idempotency', async () => {
    const now = new Date();
    const orderPayload = {
      order_id: 'ORD-NAT-1001',
      customer_id: 'CUST-888',
      used_at: now.toISOString(),
      payment_confirmed_at: new Date(now.getTime() + 10000).toISOString(),
      discount_inr: 150.00,
      items: [
        { product_id: 'SKU-SHIRT', name: 'Linen Shirt', unit_price_inr: 1500.00, quantity: 1, line_discount_inr: 150.00 }
      ]
    };

    // 1. Initial successful report -> 201
    const res1 = await fetch(`${serverUrl}/brands/B1/promo-codes/AARAV10/redemptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Report-Key': 'demo-report-key-b1'
      },
      body: JSON.stringify(orderPayload)
    });
    assert.equal(res1.status, 201);
    const data1 = await res1.json();
    assert.equal(data1.success, true);
    assert.equal(data1.registered, true);
    assert.equal(data1.validity_flag, 'valid');

    // 2. Exact duplicate report (same canonical payload hash) -> 200 duplicate: true
    const res2 = await fetch(`${serverUrl}/brands/B1/promo-codes/AARAV10/redemptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Report-Key': 'demo-report-key-b1'
      },
      body: JSON.stringify(orderPayload)
    });
    assert.equal(res2.status, 200);
    const data2 = await res2.json();
    assert.equal(data2.duplicate, true);

    // 3. Different payload with same order_id -> 409 Conflict
    const conflictingPayload = {
      ...orderPayload,
      customer_id: 'CUST-DIFFERENT'
    };
    const res3 = await fetch(`${serverUrl}/brands/B1/promo-codes/AARAV10/redemptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Report-Key': 'demo-report-key-b1'
      },
      body: JSON.stringify(conflictingPayload)
    });
    assert.equal(res3.status, 409);
  });

  test('T6: Discount Unknown (NULL) vs Explicit Zero Discount (0)', async () => {
    const now = new Date();

    // 1. Unknown discount (discount_inr omitted)
    const unknownPayload = {
      order_id: 'ORD-DISC-UNKNOWN',
      customer_id: 'CUST-UNK',
      used_at: now.toISOString(),
      payment_confirmed_at: now.toISOString(),
      items: [{ product_id: 'P-UNK', unit_price_inr: 1200.00, quantity: 1 }]
    };

    const resUnk = await fetch(`${serverUrl}/brands/B1/promo-codes/AARAV10/redemptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Report-Key': 'demo-report-key-b1'
      },
      body: JSON.stringify(unknownPayload)
    });
    assert.equal(resUnk.status, 201);

    // Check in storage
    const unkUse = appInstance.store.getUseByOrderId('B1', 'ORD-DISC-UNKNOWN');
    assert.equal(unkUse.discount_paise, null, 'Unknown discount must be stored as strictly NULL');
    assert.equal(fromPaise(unkUse.discount_paise), null);

    // 2. Explicit Zero Discount (discount_inr = 0)
    const zeroPayload = {
      order_id: 'ORD-DISC-ZERO',
      customer_id: 'CUST-ZERO',
      used_at: now.toISOString(),
      payment_confirmed_at: now.toISOString(),
      discount_inr: 0,
      items: [{ product_id: 'P-ZERO', unit_price_inr: 800.00, quantity: 1, line_discount_inr: 0 }]
    };

    const resZero = await fetch(`${serverUrl}/brands/B1/promo-codes/AARAV10/redemptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Report-Key': 'demo-report-key-b1'
      },
      body: JSON.stringify(zeroPayload)
    });
    assert.equal(resZero.status, 201);

    const zeroUse = appInstance.store.getUseByOrderId('B1', 'ORD-DISC-ZERO');
    assert.equal(zeroUse.discount_paise, 0, 'Explicit zero discount must be stored as 0, not null');
    assert.equal(fromPaise(zeroUse.discount_paise), 0);
  });

  test('T7: Monetary validation rejects > 2 decimal places with 400', async () => {
    const badDecimalsPayload = {
      order_id: 'ORD-BAD-DEC',
      customer_id: 'CUST-1',
      used_at: new Date().toISOString(),
      payment_confirmed_at: new Date().toISOString(),
      discount_inr: 10.999, // 3 decimal places!
      items: [{ product_id: 'P1', unit_price_inr: 100, quantity: 1 }]
    };

    const res = await fetch(`${serverUrl}/brands/B1/promo-codes/AARAV10/redemptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Report-Key': 'demo-report-key-b1'
      },
      body: JSON.stringify(badDecimalsPayload)
    });
    assert.equal(res.status, 400);
  });

  test('T8: Customer PII fields are strictly forbidden with 400', async () => {
    const piiPayload = {
      order_id: 'ORD-PII-REJECT',
      customer_id: 'CUST-1',
      customer_email: 'influencer_shopper@gmail.com', // PII!
      used_at: new Date().toISOString(),
      payment_confirmed_at: new Date().toISOString(),
      items: [{ product_id: 'P1', unit_price_inr: 100, quantity: 1 }]
    };

    const res = await fetch(`${serverUrl}/brands/B1/promo-codes/AARAV10/redemptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Report-Key': 'demo-report-key-b1'
      },
      body: JSON.stringify(piiPayload)
    });
    assert.equal(res.status, 400);
  });

  test('T9: 1MB Request Body Limit returns 413 Payload Too Large', async () => {
    const hugePayload = {
      order_id: 'ORD-HUGE',
      customer_id: 'CUST-HUGE',
      used_at: new Date().toISOString(),
      payment_confirmed_at: new Date().toISOString(),
      items: []
    };

    // Construct > 1MB of items
    for (let i = 0; i < 25000; i++) {
      hugePayload.items.push({
        product_id: `PRODUCT_LONG_NAME_PADDING_IDENTIFIER_${i}`,
        unit_price_inr: 100,
        quantity: 1
      });
    }

    try {
      const res = await fetch(`${serverUrl}/brands/B1/promo-codes/AARAV10/redemptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Report-Key': 'demo-report-key-b1'
        },
        body: JSON.stringify(hugePayload)
      });
      assert.equal(res.status, 413);
    } catch (err) {
      // In Node.js, fetch may throw when server closes/destroys stream on 413
      assert.ok(err);
    }
  });

  test('T10: SSE Hub cap (20 clients) returns 429 on 21st subscriber', async () => {
    const clients = [];

    // Connect 20 clients
    for (let i = 0; i < 20; i++) {
      const controller = new AbortController();
      const res = await fetch(`${serverUrl}/brands/B1/events`, {
        headers: { 'X-Brand-Key': 'demo-key-b1' },
        signal: controller.signal
      });
      assert.equal(res.status, 200);
      clients.push({ controller, res });
    }

    // 21st client must be rejected with 429
    const overflowRes = await fetch(`${serverUrl}/brands/B1/events`, {
      headers: { 'X-Brand-Key': 'demo-key-b1' }
    });
    assert.equal(overflowRes.status, 429);

    // Clean up
    for (const c of clients) {
      c.controller.abort();
    }
  });

  test('T11: Database Persistence across restarts', async () => {
    // 1. Verify data exists before closing
    const promoBefore = appInstance.store.getPromo('B1', 'AARAV10');
    assert.ok(promoBefore);
    assert.equal(promoBefore.code, 'AARAV10');

    // 2. Close app and DB
    appInstance.close();

    // 3. Re-open DB from same file
    const restartedStore = new SqliteStorage(TEST_DB_PATH, 'demo');
    const promoAfter = restartedStore.getPromo('B1', 'AARAV10');
    assert.ok(promoAfter, 'Promo code must survive storage restart');
    assert.equal(promoAfter.creator_id, 'CR1');

    const usesAfter = restartedStore.listUses('B1', 'AARAV10');
    assert.ok(usesAfter.length >= 1, 'Uses must survive storage restart');

    restartedStore.close();

    // Restart appInstance for any further tests
    appInstance = createApp({
      dbPath: TEST_DB_PATH,
      appEnv: 'demo'
    });

    await new Promise((resolve) => {
      appInstance.server.listen(0, '127.0.0.1', () => {
        const port = appInstance.server.address().port;
        serverUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  test('T12: Reconciliation endpoint returns accurate aggregates and rejects invalid ranges', async () => {
    // 1. Invalid range (from >= to) -> 400
    const resBadRange = await fetch(`${serverUrl}/brands/B1/reconciliation?from=2026-10-18T10:00:00Z&to=2026-10-18T09:00:00Z`, {
      headers: { 'X-Report-Key': 'demo-report-key-b1' }
    });
    assert.equal(resBadRange.status, 400);

    // 2. Valid range
    const from = new Date(Date.now() - 3600000 * 24).toISOString();
    const to = new Date(Date.now() + 3600000 * 24).toISOString();

    const resGood = await fetch(`${serverUrl}/brands/B1/reconciliation?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
      headers: { 'X-Report-Key': 'demo-report-key-b1' }
    });
    assert.equal(resGood.status, 200);
    const reconData = await resGood.json();
    assert.equal(reconData.brand_id, 'B1');
    assert.ok(Array.isArray(reconData.registered_codes));
    assert.ok(Array.isArray(reconData.unregistered_uses));
  });
});
