import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { getDb, resetDbForTesting } from '../backend/src/lib/db.ts';
import { validateAndIngestOrder } from '../backend/src/lib/orderIngestion.ts';
import { processRefund } from '../backend/src/lib/refundProcessor.ts';
import { getSseHub } from '../backend/src/lib/sseHub.ts';

describe('Phase 2 Reconciliation & Live Feed Integration Test Suite', () => {
  before(() => {
    resetDbForTesting(true);
  });

  test('Order ingestion produces verified integer paise record and publishes SSE event', () => {
    const db = getDb();
    const sse = getSseHub();

    // Register active promo code for B1
    db.prepare(`
      INSERT OR REPLACE INTO promo_codes (brand_id, code, creator_id, valid_from, valid_to, created_at)
      VALUES ('B1', 'SUMMER25', 'c_rohan', '2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z', '2026-01-01T00:00:00Z');
    `).run();

    // Track SSE messages received
    const events = [];
    const mockController = {
      enqueue: (chunk) => {
        const text = new TextDecoder().decode(chunk);
        const match = text.match(/event: (.*?)\ndata: (.*?)\n\n/);
        if (match) {
          events.push({ name: match[1], payload: JSON.parse(match[2]) });
        }
      }
    };

    sse.subscribe('B1', mockController);

    // Ingest valid order with items
    const orderPayload = {
      order_id: 'ORD_PHASE2_001',
      customer_id: 'CUST_P2_99',
      used_at: '2026-06-15T14:30:00+05:30',
      discount_inr: 250,
      items: [
        {
          product_id: 'SKU_100',
          name: 'Noise Cancelling Headphones',
          unit_price_inr: 2500,
          quantity: 2,
          line_discount_inr: 250
        }
      ]
    };

    const result = validateAndIngestOrder('B1', orderPayload, 'SUMMER25');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.registered, true);
    assert.strictEqual(result.validity_flag, 'valid');
    assert.strictEqual(result.subtotal_inr, 5000);
    assert.strictEqual(result.discount_inr, 250);
    assert.strictEqual(result.total_inr, 4750);

    // Verify database record has integer paise
    const dbOrder = db.prepare('SELECT subtotal_paise, discount_paise, total_paise FROM orders WHERE order_id = ?;').get('ORD_PHASE2_001');
    assert.strictEqual(dbOrder.subtotal_paise, 500000);
    assert.strictEqual(dbOrder.discount_paise, 25000);
    assert.strictEqual(dbOrder.total_paise, 475000);

    // Broadcast SSE
    sse.publish('B1', 'use_recorded', {
      order_id: result.order_id,
      code: 'SUMMER25',
      registered: true,
      validity_flag: 'valid',
      subtotal_inr: result.subtotal_inr,
      discount_inr: result.discount_inr,
      total_inr: result.total_inr
    });

    assert.ok(events.length >= 1);
    const lastEvent = events[events.length - 1];
    assert.strictEqual(lastEvent.name, 'use_recorded');
    assert.strictEqual(lastEvent.payload.order_id, 'ORD_PHASE2_001');
    assert.strictEqual(lastEvent.payload.code, 'SUMMER25');
  });

  test('Unregistered promo code is recorded with validity_flag="unregistered"', () => {
    const orderPayload = {
      order_id: 'ORD_PHASE2_UNREG',
      customer_id: 'CUST_P2_100',
      used_at: '2026-06-15T15:00:00+05:30',
      items: [
        {
          product_id: 'SKU_200',
          name: 'Mechanical Keyboard',
          unit_price_inr: 3000,
          quantity: 1
        }
      ]
    };

    const result = validateAndIngestOrder('B1', orderPayload, 'GHOST_CODE');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.registered, false);
    assert.strictEqual(result.validity_flag, 'unregistered');

    const db = getDb();
    const dbOrder = db.prepare('SELECT validity_flag, promo_code FROM orders WHERE order_id = ?;').get('ORD_PHASE2_UNREG');
    assert.strictEqual(dbOrder.validity_flag, 'unregistered');
    assert.strictEqual(dbOrder.promo_code, 'GHOST_CODE');
  });

  test('Refund processor records refund event and updates order status with amount_paise', () => {
    const refundResult = processRefund({
      brand_id: 'B1',
      refund_id: 'REF_PHASE2_001',
      order_id: 'ORD_PHASE2_001',
      amount_inr: 1000
    });

    assert.strictEqual(refundResult.success, true);
    assert.strictEqual(refundResult.order_status, 'partially_refunded');

    const db = getDb();
    const refundRecord = db.prepare('SELECT amount_inr, amount_paise FROM refund_events WHERE refund_id = ?;').get('REF_PHASE2_001');
    assert.strictEqual(refundRecord.amount_inr, 1000);
    assert.strictEqual(refundRecord.amount_paise, 100000);

    const orderRecord = db.prepare('SELECT status FROM orders WHERE order_id = ?;').get('ORD_PHASE2_001');
    assert.strictEqual(orderRecord.status, 'partially_refunded');
  });
});
