import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SqliteStorage } from '../src/storage/sqlite.js';
import { MemoryStorage } from '../src/storage/memory.js';
import { toPaise, fromPaise, canonicalHash } from '../src/storage/interface.js';

function runContractTests(storageName, storageFactory) {
  describe(`Storage Contract Suite: ${storageName}`, () => {
    test('createPromo: creates promo and prevents duplicate codes', () => {
      const storage = storageFactory('demo');
      const promoData = {
        code: 'PROMO10',
        creator_id: 'CR1',
        valid_from: '2026-10-01T00:00:00Z',
        valid_to: '2026-10-31T23:59:59Z',
        created_at: new Date().toISOString()
      };

      const created = storage.createPromo('B1', promoData);
      assert.equal(created.code, 'PROMO10');
      assert.equal(created.brand_id, 'B1');

      // Duplicate creates must throw 409
      assert.throws(
        () => storage.createPromo('B1', promoData),
        (err) => err.status === 409
      );

      // Same code for different brand is allowed
      const b2Created = storage.createPromo('B2', promoData);
      assert.equal(b2Created.brand_id, 'B2');
      storage.close();
    });

    test('patchPromo: updates validity dates or throws 404', () => {
      const storage = storageFactory('demo');
      storage.createPromo('B1', {
        code: 'PATCHME',
        creator_id: 'CR1',
        valid_from: '2026-10-01T00:00:00Z',
        valid_to: '2026-10-31T23:59:59Z',
        created_at: new Date().toISOString()
      });

      const updated = storage.patchPromo('B1', 'PATCHME', {
        valid_to: '2026-11-15T23:59:59Z'
      });
      assert.equal(updated.valid_to, '2026-11-15T23:59:59Z');
      assert.equal(updated.valid_from, '2026-10-01T00:00:00Z');

      // Nonexistent code throws 404
      assert.throws(
        () => storage.patchPromo('B1', 'NONEXIST', { valid_to: '2026-11-15T23:59:59Z' }),
        (err) => err.status === 404
      );
      storage.close();
    });

    test('recordUse: handles idempotency, line items, and duplicate payloads', () => {
      const storage = storageFactory('demo');
      const payload1 = {
        order_id: 'ORD-901',
        code_entered: 'SAVE20',
        registered: true,
        customer_id: 'CUST-1',
        used_at: '2026-10-18T10:00:00Z',
        payment_confirmed_at: '2026-10-18T10:01:00Z',
        received_at: '2026-10-18T10:01:05Z',
        discount_paise: 20000,
        line_discount_basis: 'reported',
        source: 'website',
        validity_flag: 'valid',
        payload_raw: '{"a":1}',
        payload_hash: canonicalHash({ a: 1 })
      };

      const items = [
        { product_id: 'P1', name: 'Shoes', unit_price_paise: 50000, quantity: 2, line_discount_paise: 20000 }
      ];

      const res1 = storage.recordUse('B1', payload1, items);
      assert.equal(res1.duplicate, false);
      assert.equal(res1.use.order_id, 'ORD-901');

      // Duplicate delivery with SAME hash -> returns duplicate: true
      const res2 = storage.recordUse('B1', payload1, items);
      assert.equal(res2.duplicate, true);

      // Conflicting delivery with DIFFERENT hash -> throws 409
      const conflictingPayload = {
        ...payload1,
        payload_hash: canonicalHash({ a: 2, modified: true })
      };
      assert.throws(
        () => storage.recordUse('B1', conflictingPayload, items),
        (err) => err.status === 409
      );

      // Verify retrieval
      const fetched = storage.getUseByOrderId('B1', 'ORD-901');
      assert.ok(fetched);
      assert.equal(fetched.items.length, 1);
      assert.equal(fetched.items[0].product_id, 'P1');
      assert.equal(fetched.items[0].unit_price_paise, 50000);
      storage.close();
    });

    test('reconciliation and feed status', () => {
      const storage = storageFactory('demo');
      storage.createPromo('B1', {
        code: 'REG10',
        creator_id: 'CR1',
        valid_from: '2026-10-01T00:00:00Z',
        valid_to: '2026-10-31T23:59:59Z',
        created_at: new Date().toISOString()
      });

      // 1 registered use
      storage.recordUse('B1', {
        order_id: 'ORD-REC-1',
        code_entered: 'REG10',
        registered: true,
        customer_id: 'C1',
        used_at: '2026-10-18T12:00:00Z',
        payment_confirmed_at: '2026-10-18T12:01:00Z',
        received_at: '2026-10-18T12:01:05Z',
        discount_paise: 5000,
        line_discount_basis: 'reported',
        source: 'website',
        validity_flag: 'valid',
        payload_raw: '{}',
        payload_hash: 'hash1'
      }, [
        { product_id: 'P1', unit_price_paise: 100000, quantity: 2, line_discount_paise: 5000 }
      ]);

      // 1 unregistered use
      storage.recordUse('B1', {
        order_id: 'ORD-REC-2',
        code_entered: 'UNREG5',
        registered: false,
        customer_id: 'C2',
        used_at: '2026-10-18T13:00:00Z',
        payment_confirmed_at: '2026-10-18T13:01:00Z',
        received_at: '2026-10-18T13:01:05Z',
        discount_paise: null,
        line_discount_basis: null,
        source: 'synthetic_seed',
        validity_flag: 'unregistered',
        payload_raw: '{}',
        payload_hash: 'hash2'
      }, [
        { product_id: 'P2', unit_price_paise: 40000, quantity: 1, line_discount_paise: null }
      ]);

      const recon = storage.getReconciliation('B1', '2026-10-18T00:00:00Z', '2026-10-19T00:00:00Z');
      assert.equal(recon.registered_codes.length, 1);
      assert.equal(recon.registered_codes[0].code, 'REG10');
      assert.equal(recon.registered_codes[0].use_count, 1);
      assert.equal(recon.registered_codes[0].units, 2);
      assert.equal(recon.registered_codes[0].subtotal_inr, 2000); // 2 * 100000 paise = 2000 INR

      assert.equal(recon.unregistered_uses.length, 1);
      assert.equal(recon.unregistered_uses[0].code_entered, 'UNREG5');
      assert.equal(recon.unregistered_uses[0].subtotal_inr, 400);

      const status = storage.getFeedStatus('B1');
      assert.equal(status.uses_by_source.website, 1);
      assert.equal(status.uses_by_source.synthetic_seed, 1);
      assert.equal(status.unregistered_uses, 1);

      // Purge synthetic_seed
      storage.purgeBySource('synthetic_seed');
      const statusAfterPurge = storage.getFeedStatus('B1');
      assert.equal(statusAfterPurge.uses_by_source.synthetic_seed, 0);
      assert.equal(statusAfterPurge.uses_by_source.website, 1);
      storage.close();
    });
  });
}

runContractTests('SqliteStorage (:memory:)', (env) => new SqliteStorage(':memory:', env));
runContractTests('MemoryStorage', (env) => new MemoryStorage(env));
