import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../backend/src/app.js';
import { MemoryStorage } from '../backend/src/storage/memory.js';
import { SqliteStorage } from '../backend/src/storage/sqlite.js';
import { calculateCreatorCostPerUnit } from '../backend/src/lib/costPerUnit.js';

describe('Backend Phase B5: Cost Per Unit Test Suite', () => {
  describe('1. Acceptance Criteria Mathematical Proofs', () => {
    it('A fee of 20,000 with uses A (P1 x2, P2 x1) and B (P1 x1) yields 4 units, 5,000 per unit, with P1 at 15,000 and P2 at 5,000', () => {
      const uses = [
        {
          order_id: 'ord_1',
          code_entered: 'A',
          registered: 1,
          validity_flag: 'valid',
          items: [
            { product_id: 'P1', name: 'Product 1', quantity: 2 },
            { product_id: 'P2', name: 'Product 2', quantity: 1 }
          ]
        },
        {
          order_id: 'ord_2',
          code_entered: 'B',
          registered: 1,
          validity_flag: 'valid',
          items: [
            { product_id: 'P1', name: 'Product 1', quantity: 1 }
          ]
        }
      ];

      const result = calculateCreatorCostPerUnit({
        brandId: 'B1',
        creatorId: 'CR1',
        creatorName: 'Aarav Sharma',
        feeInr: 20000,
        registeredCodes: ['A', 'B'],
        uses
      });

      assert.equal(result.units_sold, 4, 'Total units should be 4 (3 of P1, 1 of P2)');
      assert.equal(result.cost_per_unit, 5000, 'Cost per unit should be 5,000 (20,000 / 4)');
      assert.equal(result.status, 'ok');

      // Product allocation
      assert.equal(result.by_product.length, 2);
      const p1 = result.by_product.find(p => p.product_id === 'P1');
      const p2 = result.by_product.find(p => p.product_id === 'P2');
      assert.ok(p1 && p2);
      assert.equal(p1.units, 3);
      assert.equal(p1.allocated_fee_inr, 15000, 'P1 allocation should be 15,000');
      assert.equal(p2.units, 1);
      assert.equal(p2.allocated_fee_inr, 5000, 'P2 allocation should be 5,000');
      assert.equal(p1.allocated_fee_paise + p2.allocated_fee_paise, 2000000, 'Paise sum must equal exactly 2,000,000');

      // Code allocation
      assert.equal(result.by_code.length, 2);
      const codeA = result.by_code.find(c => c.code === 'A');
      const codeB = result.by_code.find(c => c.code === 'B');
      assert.ok(codeA && codeB);
      assert.equal(codeA.units, 3);
      assert.equal(codeA.allocated_fee_inr, 15000);
      assert.equal(codeB.units, 1);
      assert.equal(codeB.allocated_fee_inr, 5000);
    });

    it('A fifth unit dynamically changes the cost to 4,000 with nothing stale', () => {
      const uses = [
        {
          order_id: 'ord_1',
          code_entered: 'A',
          registered: 1,
          validity_flag: 'valid',
          items: [
            { product_id: 'P1', quantity: 2 },
            { product_id: 'P2', quantity: 1 }
          ]
        },
        {
          order_id: 'ord_2',
          code_entered: 'B',
          registered: 1,
          validity_flag: 'valid',
          items: [
            { product_id: 'P1', quantity: 1 }
          ]
        },
        {
          order_id: 'ord_3',
          code_entered: 'A',
          registered: 1,
          validity_flag: 'valid',
          items: [
            { product_id: 'P1', quantity: 1 }
          ]
        }
      ];

      const result = calculateCreatorCostPerUnit({
        brandId: 'B1',
        creatorId: 'CR1',
        creatorName: 'Aarav Sharma',
        feeInr: 20000,
        registeredCodes: ['A', 'B'],
        uses
      });

      assert.equal(result.units_sold, 5, 'Total units should be 5');
      assert.equal(result.cost_per_unit, 4000, 'Cost per unit should be 4,000 (20,000 / 5)');
      assert.equal(result.status, 'ok');
    });

    it('A fee of 20,000 over 3 units yields 6,666.67 with allocations of 13,333.33 and 6,666.67', () => {
      const uses = [
        {
          order_id: 'ord_1',
          code_entered: 'A',
          registered: 1,
          validity_flag: 'valid',
          items: [
            { product_id: 'P1', quantity: 2 },
            { product_id: 'P2', quantity: 1 }
          ]
        }
      ];

      const result = calculateCreatorCostPerUnit({
        brandId: 'B1',
        creatorId: 'CR1',
        feeInr: 20000,
        registeredCodes: ['A'],
        uses
      });

      assert.equal(result.units_sold, 3);
      assert.equal(result.cost_per_unit, 6666.67, 'Cost per unit should be 6,666.67');

      const p1 = result.by_product.find(p => p.product_id === 'P1');
      const p2 = result.by_product.find(p => p.product_id === 'P2');
      assert.equal(p1.allocated_fee_inr, 13333.33, 'P1 allocation should be 13,333.33');
      assert.equal(p2.allocated_fee_inr, 6666.67, 'P2 allocation should be 6,666.67');
      assert.equal(p1.allocated_fee_paise + p2.allocated_fee_paise, 2000000, 'Paise sum must equal 20,000 INR exactly');
    });
  });

  describe('2. Statuses and Boundary Conditions', () => {
    it('Returns fee_unknown when fee is null or absent', () => {
      const result = calculateCreatorCostPerUnit({
        brandId: 'B1',
        creatorId: 'CR6',
        feeInr: null,
        registeredCodes: ['CODE1'],
        uses: [{
          order_id: 'ord_1',
          code_entered: 'CODE1',
          registered: 1,
          items: [{ product_id: 'P1', quantity: 10 }]
        }]
      });

      assert.equal(result.status, 'fee_unknown');
      assert.equal(result.cost_per_unit, null);
      assert.equal(result.units_sold, 10);
    });

    it('Returns no_units when fee is known but units sold is 0', () => {
      const result = calculateCreatorCostPerUnit({
        brandId: 'B1',
        creatorId: 'CR2',
        feeInr: 20000,
        registeredCodes: ['CODE2'],
        uses: []
      });

      assert.equal(result.status, 'no_units');
      assert.equal(result.cost_per_unit, null);
      assert.equal(result.units_sold, 0);
    });

    it('Returns cost_per_unit 0 and status ok when fee is 0 and units exist', () => {
      const result = calculateCreatorCostPerUnit({
        brandId: 'B1',
        creatorId: 'CR3',
        feeInr: 0,
        registeredCodes: ['FREECODE'],
        uses: [{
          order_id: 'ord_1',
          code_entered: 'FREECODE',
          registered: 1,
          items: [{ product_id: 'P1', quantity: 5 }]
        }]
      });

      assert.equal(result.status, 'ok');
      assert.equal(result.cost_per_unit, 0);
      assert.equal(result.units_sold, 5);
    });

    it('Includes uses outside validity dates, strictly excludes unregistered uses, counts units when discount is unknown', () => {
      const uses = [
        {
          order_id: 'valid_ord',
          code_entered: 'A',
          registered: 1,
          validity_flag: 'valid',
          discount_paise: null, // unknown discount
          items: [{ product_id: 'P1', quantity: 2 }]
        },
        {
          order_id: 'outside_ord',
          code_entered: 'A',
          registered: 1,
          validity_flag: 'outside_validity', // outside validity must be included
          discount_paise: 5000,
          items: [{ product_id: 'P1', quantity: 3 }]
        },
        {
          order_id: 'unregistered_ord',
          code_entered: 'UNREG',
          registered: 0, // unregistered MUST be excluded
          validity_flag: 'unregistered',
          items: [{ product_id: 'P1', quantity: 100 }]
        }
      ];

      const result = calculateCreatorCostPerUnit({
        brandId: 'B1',
        creatorId: 'CR1',
        feeInr: 50000,
        registeredCodes: ['A'],
        uses
      });

      assert.equal(result.units_sold, 5, 'Should count 2 (valid) + 3 (outside validity) = 5 units, excluding 100 from unregistered');
      assert.equal(result.cost_per_unit, 10000, '50,000 / 5 = 10,000');
      assert.equal(result.status, 'ok');
    });

    it('Includes basis text, reference note, and cost_per_kept_unit as unknown', () => {
      const result = calculateCreatorCostPerUnit({
        brandId: 'B1',
        creatorId: 'CR1',
        feeInr: 20000,
        registeredCodes: ['A'],
        uses: []
      });

      assert.equal(result.basis_text, 'Gross units; returns not deducted as returned quantities are not tracked');
      assert.equal(result.cost_per_kept_unit, null, 'cost_per_kept_unit must be null/unknown');
      assert.equal(result.reference_note, 'Creator fee is sourced from agency reference data.');
    });
  });

  describe('3. HTTP Endpoints Integration (B5)', () => {
    let app;
    let server;
    let baseUrl;

    before(async () => {
      const memStore = new MemoryStorage('demo');
      // Seed promo code for CR1
      memStore.createPromo('B1', {
        code: 'AARAV10',
        creator_id: 'CR1',
        valid_from: '2026-01-01T00:00:00Z',
        valid_to: '2026-12-31T23:59:59Z',
        created_at: new Date().toISOString()
      });

      // Record 4 units: P1 x 3, P2 x 1 across 2 uses
      memStore.recordUse('B1', {
        order_id: 'ord_1',
        code_entered: 'AARAV10',
        registered: 1,
        customer_id: 'cust_1',
        used_at: new Date().toISOString(),
        payment_confirmed_at: new Date().toISOString(),
        received_at: new Date().toISOString(),
        discount_paise: 10000,
        line_discount_basis: 'test',
        source: 'website',
        validity_flag: 'valid',
        payload_raw: '{}',
        payload_hash: 'h1'
      }, [
        { product_id: 'P1', name: 'Product 1', unit_price_paise: 100000, quantity: 2 },
        { product_id: 'P2', name: 'Product 2', unit_price_paise: 50000, quantity: 1 }
      ]);

      memStore.recordUse('B1', {
        order_id: 'ord_2',
        code_entered: 'AARAV10',
        registered: 1,
        customer_id: 'cust_2',
        used_at: new Date().toISOString(),
        payment_confirmed_at: new Date().toISOString(),
        received_at: new Date().toISOString(),
        discount_paise: 5000,
        line_discount_basis: 'test',
        source: 'website',
        validity_flag: 'valid',
        payload_raw: '{}',
        payload_hash: 'h2'
      }, [
        { product_id: 'P1', name: 'Product 1', unit_price_paise: 100000, quantity: 1 }
      ]);

      app = createApp({ storage: memStore, appEnv: 'demo' });
      server = app.server;
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
    });

    after(async () => {
      await new Promise(resolve => server.close(resolve));
      app.close();
    });

    it('GET /brands/:brandId/creators/:creatorId/cost-per-unit returns 4 units and 5,000 per unit for fee 20,000', async () => {
      const res = await fetch(`${baseUrl}/brands/B1/creators/CR1/cost-per-unit?fee_inr=20000`, {
        headers: { 'X-Brand-Key': 'demo-key-b1' }
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.creator_id, 'CR1');
      assert.equal(data.units_sold, 4);
      assert.equal(data.cost_per_unit, 5000);
      assert.equal(data.status, 'ok');

      // Check product allocations
      const p1 = data.by_product.find(p => p.product_id === 'P1');
      const p2 = data.by_product.find(p => p.product_id === 'P2');
      assert.equal(p1.allocated_fee_inr, 15000);
      assert.equal(p2.allocated_fee_inr, 5000);
    });

    it('Adding a 5th unit dynamically updates cost to 4,000 on the next read', async () => {
      // Ingest 5th unit
      await fetch(`${baseUrl}/brands/B1/promo-codes/AARAV10/redemptions`, {
        method: 'POST',
        headers: {
          'X-Report-Key': 'demo-report-key-b1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          order_id: 'ord_3',
          used_at: new Date().toISOString(),
          payment_confirmed_at: new Date().toISOString(),
          customer_id: 'cust_3',
          items: [{ product_id: 'P1', quantity: 1, unit_price_inr: 1000 }]
        })
      });

      const res = await fetch(`${baseUrl}/brands/B1/creators/CR1/cost-per-unit?fee_inr=20000`, {
        headers: { 'X-Brand-Key': 'demo-key-b1' }
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.units_sold, 5, 'Should immediately read 5 units');
      assert.equal(data.cost_per_unit, 4000, 'Cost per unit must be 4,000');
    });

    it('GET /brands/:brandId/cost-per-unit returns all creators with correct statuses', async () => {
      const res = await fetch(`${baseUrl}/brands/B1/cost-per-unit`, {
        headers: { 'X-Brand-Key': 'demo-key-b1' }
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.brand_id, 'B1');
      assert.ok(Array.isArray(data.creators));

      const cr1 = data.creators.find(c => c.creator_id === 'CR1');
      const cr2 = data.creators.find(c => c.creator_id === 'CR2');
      const cr6 = data.creators.find(c => c.creator_id === 'CR6');

      assert.equal(cr1.status, 'ok');
      assert.equal(cr2.status, 'no_units');
      assert.equal(cr6.status, 'fee_unknown');
    });

    it('Enforces 401 when X-Brand-Key is missing and 403 on mismatched brand', async () => {
      const noKeyRes = await fetch(`${baseUrl}/brands/B1/creators/CR1/cost-per-unit`);
      assert.equal(noKeyRes.status, 401);

      const wrongBrandRes = await fetch(`${baseUrl}/brands/B1/creators/CR1/cost-per-unit`, {
        headers: { 'X-Brand-Key': 'demo-key-b2' }
      });
      assert.equal(wrongBrandRes.status, 403);
    });
  });
});
