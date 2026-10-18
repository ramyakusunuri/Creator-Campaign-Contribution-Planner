import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../backend/src/app.js';
import { SqliteStorage } from '../backend/src/storage/sqlite.js';
import { SseHub } from '../backend/src/sse.js';
import { getSseHub } from '../backend/src/lib/sseHub.ts';
import { getDb, resetDbForTesting } from '../backend/src/lib/db.ts';
import { POST as reportOrderRoute } from '../frontend/src/app/api/v1/orders/report/route.ts';

describe('Phase 4 (Backend B4 & Frontend F4): Live Event Stream & Reconciliation', () => {
  let appInstance;
  let baseUrl;
  let storage;
  let sseHub;

  beforeEach(async () => {
    storage = new SqliteStorage(':memory:', 'demo');
    sseHub = new SseHub({ heartbeatIntervalMs: 25000, maxSubscribersPerBrand: 20 });
    appInstance = createApp({
      storage,
      sse: sseHub,
      appEnv: 'demo'
    });

    await new Promise((resolve) => {
      appInstance.server.listen(0, '127.0.0.1', () => {
        const addr = appInstance.server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(() => {
    if (sseHub) sseHub.close();
    if (appInstance) appInstance.close();
  });

  describe('1. Event Stream Hub, Ping, Retry Hint & 20-Subscriber Cap', () => {
    test('Connects to SSE stream, receives initial retry hint, and cleans up on close', async () => {
      const controller = new AbortController();
      const res = await fetch(`${baseUrl}/brands/B1/events`, {
        headers: { 'X-Brand-Key': 'demo-key-b1' },
        signal: controller.signal
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'text/event-stream');
      assert.equal(sseHub.getSubscriberCount('B1'), 1);

      const reader = res.body.getReader();
      const firstChunk = await reader.read();
      const text = new TextDecoder().decode(firstChunk.value);
      assert.ok(text.includes('retry: 3000\n: connected\n\n'));

      // Abort connection and verify cleanup
      controller.abort();
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(sseHub.getSubscriberCount('B1'), 0);
    });

    test('Strict cap: 20 subscribers permitted; 21st subscriber receives HTTP 429', async () => {
      const controllers = [];
      for (let i = 0; i < 20; i++) {
        const c = new AbortController();
        controllers.push(c);
        const res = await fetch(`${baseUrl}/brands/B1/events`, {
          headers: { 'X-Brand-Key': 'demo-key-b1' },
          signal: c.signal
        });
        assert.equal(res.status, 200);
      }

      assert.equal(sseHub.getSubscriberCount('B1'), 20);

      // 21st subscriber should receive HTTP 429
      const c21 = new AbortController();
      const res21 = await fetch(`${baseUrl}/brands/B1/events`, {
        headers: { 'X-Brand-Key': 'demo-key-b1' },
        signal: c21.signal
      });
      assert.equal(res21.status, 429);
      const json21 = await res21.json();
      assert.ok(json21.error.includes('limit: 20') || json21.error.includes('Too many'));

      // Clean up all connections
      for (const c of controllers) c.abort();
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(sseHub.getSubscriberCount('B1'), 0);
    });

    test('Heartbeat pings every 25 seconds with comment format ": ping\\n\\n"', async () => {
      // Create a test hub with fast heartbeat for unit testing
      const fastHub = new SseHub({ heartbeatIntervalMs: 50 });
      let messageReceived = '';
      const mockRes = {
        writeHead: () => {},
        write: (chunk) => { messageReceived += chunk; },
        on: () => {},
        end: () => {}
      };

      fastHub.subscribe('B1', mockRes);
      await new Promise((r) => setTimeout(r, 120));
      fastHub.close();

      assert.ok(messageReceived.includes(': ping\n\n'));
    });
  });

  describe('2. Strict Brand Isolation: Brand A Never Sees Brand B Events', () => {
    test('An event published to Brand B is invisible to Brand A subscriber', async () => {
      const controllerA = new AbortController();
      const resA = await fetch(`${baseUrl}/brands/B1/events`, {
        headers: { 'X-Brand-Key': 'demo-key-b1' },
        signal: controllerA.signal
      });
      const readerA = resA.body.getReader();
      // Read initial connection comment
      await readerA.read();

      const receivedByA = [];
      const readLoop = async () => {
        try {
          while (true) {
            const { value, done } = await readerA.read();
            if (done) break;
            const str = new TextDecoder().decode(value);
            if (str && !str.startsWith(':')) {
              receivedByA.push(str);
            }
          }
        } catch {}
      };
      readLoop();

      // Register promo code for Brand B2
      await fetch(`${baseUrl}/brands/B2/promo-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Brand-Key': 'demo-key-b2'
        },
        body: JSON.stringify({
          code: 'BRANDB_EXCLUSIVE',
          creator_id: 'c_rohan',
          starts_at: '2026-01-01T00:00:00Z',
          expires_at: '2026-12-31T23:59:59Z'
        })
      });

      // Wait 100ms for any potential SSE leakage
      await new Promise((r) => setTimeout(r, 100));

      controllerA.abort();
      assert.equal(receivedByA.length, 0, 'Brand A must not receive any events sent to Brand B');
    });
  });

  describe('3. Event Types & Payloads (Zero Sensitive Data Leakage)', () => {
    test('use_recorded event delivers strictly { type, code, creator, time } without customer IDs, prices, or discounts', async () => {
      // First register promo code for B1
      await fetch(`${baseUrl}/brands/B1/promo-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Brand-Key': 'demo-key-b1'
        },
        body: JSON.stringify({
          code: 'SAVE20',
          creator_id: 'CR1',
          starts_at: '2026-01-01T00:00:00Z',
          expires_at: '2026-12-31T23:59:59Z'
        })
      });

      // Subscribe to B1 SSE
      const controller = new AbortController();
      const res = await fetch(`${baseUrl}/brands/B1/events`, {
        headers: { 'X-Brand-Key': 'demo-key-b1' },
        signal: controller.signal
      });
      const reader = res.body.getReader();
      await reader.read(); // skip initial comment

      // Report paid order
      const orderPayload = {
        order_id: 'ORD_TEST_001',
        customer_id: 'SECRET_CUSTOMER_999',
        used_at: '2026-06-15T12:00:00+05:30',
        payment_confirmed_at: '2026-06-15T12:05:00+05:30',
        discount_inr: 500,
        items: [
          {
            product_id: 'SKU_1',
            name: 'Premium Headphones',
            unit_price_inr: 2500,
            quantity: 1,
            line_discount_inr: 500
          }
        ]
      };

      await fetch(`${baseUrl}/brands/B1/promo-codes/SAVE20/redemptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Report-Key': 'demo-report-key-b1'
        },
        body: JSON.stringify(orderPayload)
      });

      // Read SSE message
      const chunk = await reader.read();
      controller.abort();

      const text = new TextDecoder().decode(chunk.value);
      assert.ok(text.includes('event: use_recorded'));
      const dataMatch = text.match(/data: (.*)\n\n/);
      assert.ok(dataMatch, 'Must match SSE data payload');

      const payload = JSON.parse(dataMatch[1]);
      assert.strictEqual(payload.type, 'use_recorded');
      assert.strictEqual(payload.code, 'SAVE20');
      assert.strictEqual(payload.creator, 'CR1');
      assert.ok(payload.time);

      // Strict requirement: NEVER include customer IDs, prices, or discounts
      assert.strictEqual(payload.customer_id, undefined);
      assert.strictEqual(payload.discount_inr, undefined);
      assert.strictEqual(payload.discount_paise, undefined);
      assert.strictEqual(payload.subtotal_inr, undefined);
      assert.strictEqual(payload.subtotal_paise, undefined);
      assert.strictEqual(payload.total_inr, undefined);
      assert.strictEqual(payload.total_paise, undefined);
      assert.strictEqual(payload.items, undefined);
    });

    test('unregistered_use_recorded delivers strictly { type, code, creator, time }', async () => {
      const controller = new AbortController();
      const res = await fetch(`${baseUrl}/brands/B1/events`, {
        headers: { 'X-Brand-Key': 'demo-key-b1' },
        signal: controller.signal
      });
      const reader = res.body.getReader();
      await reader.read(); // skip initial comment

      const orderPayload = {
        order_id: 'ORD_UNREG_001',
        customer_id: 'SECRET_CUST_111',
        used_at: '2026-06-15T12:00:00+05:30',
        payment_confirmed_at: '2026-06-15T12:05:00+05:30',
        items: [
          {
            product_id: 'SKU_2',
            name: 'Shoes',
            unit_price_inr: 1000,
            quantity: 1
          }
        ]
      };

      await fetch(`${baseUrl}/brands/B1/promo-codes/GHOST_CODE/redemptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Report-Key': 'demo-report-key-b1'
        },
        body: JSON.stringify(orderPayload)
      });

      const chunk = await reader.read();
      controller.abort();

      const text = new TextDecoder().decode(chunk.value);
      assert.ok(text.includes('event: unregistered_use_recorded'));
      const dataMatch = text.match(/data: (.*)\n\n/);
      const payload = JSON.parse(dataMatch[1]);
      assert.strictEqual(payload.type, 'unregistered_use_recorded');
      assert.strictEqual(payload.code, 'GHOST_CODE');
      assert.strictEqual(payload.creator, null);
      assert.strictEqual(payload.customer_id, undefined);
      assert.strictEqual(payload.discount_inr, undefined);
    });

    test('code_registered and code_updated events deliver strictly { type, code, creator, time }', async () => {
      const controller = new AbortController();
      const res = await fetch(`${baseUrl}/brands/B1/events`, {
        headers: { 'X-Brand-Key': 'demo-key-b1' },
        signal: controller.signal
      });
      const reader = res.body.getReader();
      await reader.read();

      // 1. Register code
      await fetch(`${baseUrl}/brands/B1/promo-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Brand-Key': 'demo-key-b1'
        },
        body: JSON.stringify({
          code: 'FLASH50',
          creator_id: 'CR1',
          starts_at: '2026-01-01T00:00:00Z',
          expires_at: '2026-06-01T00:00:00Z'
        })
      });

      const regChunk = await reader.read();
      const regText = new TextDecoder().decode(regChunk.value);
      assert.ok(regText.includes('event: code_registered'));
      const regPayload = JSON.parse(regText.match(/data: (.*)\n\n/)[1]);
      assert.strictEqual(regPayload.type, 'code_registered');
      assert.strictEqual(regPayload.code, 'FLASH50');
      assert.strictEqual(regPayload.creator, 'CR1');
      assert.ok(regPayload.time);
      assert.strictEqual(regPayload.customer_id, undefined);

      // 2. Patch code
      await fetch(`${baseUrl}/brands/B1/promo-codes/FLASH50`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Brand-Key': 'demo-key-b1'
        },
        body: JSON.stringify({
          expires_at: '2026-09-01T00:00:00Z'
        })
      });

      const updateChunk = await reader.read();
      controller.abort();
      const updateText = new TextDecoder().decode(updateChunk.value);
      assert.ok(updateText.includes('event: code_updated'));
      const updatePayload = JSON.parse(updateText.match(/data: (.*)\n\n/)[1]);
      assert.strictEqual(updatePayload.type, 'code_updated');
      assert.strictEqual(updatePayload.code, 'FLASH50');
      assert.strictEqual(updatePayload.creator, 'CR1');
      assert.ok(updatePayload.time);
    });
  });

  describe('4. Feed Status & Reconciliation Endpoints', () => {
    test('Feed status returns last use received, uses by source, and unregistered count', async () => {
      // Ingest 1 registered and 1 unregistered use
      await fetch(`${baseUrl}/brands/B1/promo-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Brand-Key': 'demo-key-b1' },
        body: JSON.stringify({
          code: 'AUTUMN10',
          creator_id: 'CR1',
          starts_at: '2026-01-01T00:00:00Z',
          expires_at: '2026-12-31T23:59:59Z'
        })
      });

      await fetch(`${baseUrl}/brands/B1/promo-codes/AUTUMN10/redemptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Report-Key': 'demo-report-key-b1' },
        body: JSON.stringify({
          order_id: 'ORD_AUTUMN_1',
          customer_id: 'CUST_1',
          used_at: '2026-08-01T10:00:00Z',
          payment_confirmed_at: '2026-08-01T10:05:00Z',
          items: [{ product_id: 'P1', name: 'Item 1', unit_price_inr: 500, quantity: 2 }]
        })
      });

      await fetch(`${baseUrl}/brands/B1/promo-codes/UNKNOWN_CODE/redemptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Report-Key': 'demo-report-key-b1' },
        body: JSON.stringify({
          order_id: 'ORD_AUTUMN_2',
          customer_id: 'CUST_2',
          used_at: '2026-08-01T11:00:00Z',
          payment_confirmed_at: '2026-08-01T11:05:00Z',
          items: [{ product_id: 'P2', name: 'Item 2', unit_price_inr: 1000, quantity: 1 }]
        })
      });

      const res = await fetch(`${baseUrl}/brands/B1/feed-status`, {
        headers: { 'X-Brand-Key': 'demo-key-b1' }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.brand_id, 'B1');
      assert.ok(data.last_use_received_at);
      assert.strictEqual(data.uses_by_source.website, 2);
      assert.strictEqual(data.uses_by_source.synthetic_seed, 0);
      assert.strictEqual(data.unregistered_uses, 1);
    });

    test('Reconciliation lists exactly in-range orders and sorted order IDs without customer IDs or discounts', async () => {
      // Register promo code AUTUMN10 for B1
      await fetch(`${baseUrl}/brands/B1/promo-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Brand-Key': 'demo-key-b1' },
        body: JSON.stringify({
          code: 'AUTUMN10',
          creator_id: 'CR1',
          starts_at: '2026-01-01T00:00:00Z',
          expires_at: '2026-12-31T23:59:59Z'
        })
      });

      // In-range order (10:00)
      await fetch(`${baseUrl}/brands/B1/promo-codes/AUTUMN10/redemptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Report-Key': 'demo-report-key-b1' },
        body: JSON.stringify({
          order_id: 'ORD_AUTUMN_1',
          customer_id: 'CUST_1',
          used_at: '2026-08-01T10:00:00Z',
          payment_confirmed_at: '2026-08-01T10:05:00Z',
          items: [{ product_id: 'P1', name: 'Item 1', unit_price_inr: 500, quantity: 2 }]
        })
      });

      // Out-of-range order (11:00)
      await fetch(`${baseUrl}/brands/B1/promo-codes/UNKNOWN_CODE/redemptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Report-Key': 'demo-report-key-b1' },
        body: JSON.stringify({
          order_id: 'ORD_AUTUMN_2',
          customer_id: 'CUST_2',
          used_at: '2026-08-01T11:00:00Z',
          payment_confirmed_at: '2026-08-01T11:05:00Z',
          items: [{ product_id: 'P2', name: 'Item 2', unit_price_inr: 1000, quantity: 1 }]
        })
      });

      const from = '2026-08-01T09:00:00.000Z';
      const to = '2026-08-01T10:30:00.000Z'; // should include ORD_AUTUMN_1 (10:00) but exclude ORD_AUTUMN_2 (11:00)

      const res = await fetch(`${baseUrl}/brands/B1/reconciliation?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
        headers: { 'X-Brand-Key': 'demo-key-b1' }
      });

      assert.equal(res.status, 200);
      const recon = await res.json();
      assert.strictEqual(recon.brand_id, 'B1');
      assert.strictEqual(recon.registered_codes.length, 1);
      assert.strictEqual(recon.registered_codes[0].code, 'AUTUMN10');
      assert.strictEqual(recon.registered_codes[0].use_count, 1);
      assert.strictEqual(recon.registered_codes[0].units, 2);
      assert.deepEqual(recon.registered_codes[0].order_ids, ['ORD_AUTUMN_1']);

      // Out of range order ORD_AUTUMN_2 is excluded
      assert.strictEqual(recon.unregistered_uses.length, 0);

      // Verify zero customer IDs and zero discounts in reconciliation
      for (const item of recon.registered_codes) {
        assert.strictEqual(item.customer_id, undefined);
        assert.strictEqual(item.discount_inr, undefined);
      }
    });

    test('Reconciliation rejects time ranges exceeding 5,000 uses with 400', () => {
      // Create memory storage and inject > 5,000 uses to test cap
      const capStorage = new SqliteStorage(':memory:', 'demo');
      const fromIso = '2026-01-01T00:00:00.000Z';
      const toIso = '2026-12-31T23:59:59.000Z';

      // Insert 5,001 uses
      capStorage.db.exec('BEGIN IMMEDIATE;');
      for (let i = 1; i <= 5001; i++) {
        capStorage.db.prepare(`
          INSERT INTO uses (brand_id, order_id, code_entered, registered, customer_id, used_at, payment_confirmed_at, received_at, discount_paise, source, validity_flag, payload_raw, payload_hash)
          VALUES ('B1', 'ORD_BULK_${i}', 'BULK10', 1, 'CUST_${i}', '2026-06-01T12:00:00.000Z', '2026-06-01T12:00:00.000Z', '2026-06-01T12:00:00.000Z', 0, 'website', 'valid', '{}', 'hash_${i}');
        `).run();
      }
      capStorage.db.exec('COMMIT;');

      assert.throws(() => {
        capStorage.getReconciliation('B1', fromIso, toIso);
      }, (err) => {
        assert.equal(err.status, 400);
        assert.ok(err.message.includes('range too large, narrow it'));
        return true;
      });
    });
  });
});
