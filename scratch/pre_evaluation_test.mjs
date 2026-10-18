import assert from 'node:assert';

const FE_URL = 'http://localhost:3000';
const BE_URL = 'http://localhost:3001';
const STORE_URL = 'http://localhost:3002';

const B1_KEY = 'b1_secret_key';
const B2_KEY = 'b2_secret_key';
const REPORT_KEY = 'demo-report-key-b1';
const AGENCY_KEY = 'demo-agency-key';

async function runPreEval() {
  const results = [];

  function record(name, pass, details) {
    results.push({ name, pass, details });
    console.log(`${pass ? '✓ PASS' : '❌ FAIL'}: ${name} - ${details}`);
  }

  console.log('====================================================');
  console.log('   FINAL PRE-EVALUATION READINESS VERIFICATION      ');
  console.log('====================================================\n');

  // Check 1: Frontend Startup & Health
  try {
    const res = await fetch(`${FE_URL}/health`);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.environment, 'demo');
    record('Frontend Health Endpoint', true, `Status 200, environment="${data.environment}"`);
  } catch (e) {
    record('Frontend Health Endpoint', false, e.message);
  }

  // Check 2: Backend Startup & Health
  try {
    const res = await fetch(`${BE_URL}/health`);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.environment, 'demo');
    record('Backend Engine Health Endpoint', true, `Status 200, environment="${data.environment}"`);
  } catch (e) {
    record('Backend Engine Health Endpoint', false, e.message);
  }

  // Check 3: Storefront Simulator
  try {
    const res = await fetch(`${STORE_URL}/`);
    const text = await res.text();
    assert.strictEqual(res.status, 200);
    assert(text.includes('ATELIER 24'));
    assert(text.includes('app.js'));
    record('Storefront Simulator Server', true, 'Status 200, Atelier 24 luxury store UI loaded');
  } catch (e) {
    record('Storefront Simulator Server', false, e.message);
  }

  // Check 4: Database Read/Write & Persistence
  try {
    const testCode = 'EVAL' + Math.floor(1000 + Math.random() * 9000);
    const regRes = await fetch(`${FE_URL}/api/brands/B1/promo-codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Brand-Key': B1_KEY
      },
      body: JSON.stringify({
        code: testCode,
        creator_id: 'CR1',
        starts_at: '2026-01-01T00:00:00.000Z',
        expires_at: '2026-12-31T23:59:59.000Z'
      })
    });
    const regData = await regRes.json();
    assert.strictEqual(regRes.status, 201);
    assert.strictEqual(regData.code, testCode);

    // Read back to confirm SQLite write
    const listRes = await fetch(`${FE_URL}/api/brands/B1/promo-codes`, {
      headers: { 'X-Brand-Key': B1_KEY }
    });
    const listData = await listRes.json();
    const codes = Array.isArray(listData) ? listData : listData.promo_codes;
    assert(codes.some((p) => p.code === testCode));
    record('SQLite Database Read/Write & Persistence', true, `Successfully wrote & read back promo code "${testCode}"`);
  } catch (e) {
    record('SQLite Database Read/Write & Persistence', false, e.message);
  }

  // Check 5: Storefront Pre-checkout Advisory Check (Security: Zero Leakage)
  try {
    const checkRes = await fetch(`${FE_URL}/brands/B1/promo-codes/AARAV10/check`, {
      headers: { 'X-Report-Key': REPORT_KEY }
    });
    const checkData = await checkRes.json();
    assert.strictEqual(checkRes.status, 200);
    assert.strictEqual(checkData.valid, true);
    assert.strictEqual(checkData.reason, 'valid');
    // Ensure zero leakage of creator fee or formulas
    assert.strictEqual(checkData.creator_fee, undefined);
    assert.strictEqual(checkData.fee_inr, undefined);
    record('Pre-Checkout Advisory Check (Zero Leakage)', true, 'Status 200, valid:true, zero sensitive fields leaked');
  } catch (e) {
    record('Pre-Checkout Advisory Check (Zero Leakage)', false, e.message);
  }

  // Check 6: Order Redemption & Proportional Line Discount Split
  const testOrderId = 'ORD-EVAL-' + Date.now();
  const testUsedAt = new Date().toISOString();
  const testOrderPayload = {
    order_id: testOrderId,
    customer_id: 'CUST-EVAL-42',
    used_at: testUsedAt,
    payment_confirmed_at: testUsedAt,
    discount_inr: 500,
    items: [
      { product_id: 'PRD-1', name: 'Athletic Track Pants', unit_price_inr: 1499, quantity: 2, line_discount_inr: 375 },
      { product_id: 'PRD-2', name: 'Cotton Crew Tee', unit_price_inr: 500, quantity: 1, line_discount_inr: 125 }
    ]
  };

  try {
    const orderRes = await fetch(`${FE_URL}/brands/B1/promo-codes/AARAV10/redemptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Report-Key': REPORT_KEY
      },
      body: JSON.stringify(testOrderPayload)
    });
    const orderData = await orderRes.json();
    assert.strictEqual(orderRes.status, 201);
    assert.strictEqual(orderData.registered, true);
    assert.strictEqual(orderData.validity_flag, 'valid');
    assert.strictEqual(orderData.discount_inr, 500);
    record('Order Redemption & Line Discount Split', true, `Order ${testOrderId} reported with paise integrity (sum: ₹500.00)`);
  } catch (e) {
    record('Order Redemption & Line Discount Split', false, e.message);
  }

  // Check 7: Idempotency Duplicate Detection (Exact retransmission -> 200 duplicate; Conflict -> 409)
  try {
    // 7a. Identical payload retransmission -> must return 200 duplicate: true
    const dupRes = await fetch(`${FE_URL}/brands/B1/promo-codes/AARAV10/redemptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Report-Key': REPORT_KEY
      },
      body: JSON.stringify(testOrderPayload)
    });
    const dupData = await dupRes.json();
    assert.strictEqual(dupRes.status, 200);
    assert.strictEqual(dupData.duplicate, true);
    assert.strictEqual(dupData.order_id, testOrderId);

    // 7b. Modified payload with same order_id -> must return 409 Conflict
    const conflictRes = await fetch(`${FE_URL}/brands/B1/promo-codes/AARAV10/redemptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Report-Key': REPORT_KEY
      },
      body: JSON.stringify({ ...testOrderPayload, customer_id: 'CUST-EVAL-99' })
    });
    assert.strictEqual(conflictRes.status, 409);

    record('Idempotency Duplicate Guard', true, `Re-transmission returned HTTP 200 duplicate:true, and modified re-attempt returned HTTP 409 conflict for order ${testOrderId}`);
  } catch (e) {
    record('Idempotency Duplicate Guard', false, e.message);
  }

  // Check 8: Dynamic Cost Per Unit Sold Calculation on Read
  try {
    const cpuRes = await fetch(`${FE_URL}/api/brands/B1/creators/CR1/cost-per-unit`, {
      headers: { 'X-Brand-Key': B1_KEY }
    });
    const cpuData = await cpuRes.json();
    assert.strictEqual(cpuRes.status, 200);
    assert.strictEqual(cpuData.status, 'ok');
    assert(cpuData.units_sold > 0);
    assert(cpuData.cost_per_unit > 0);
    // Verify fee allocation sum equals total fee paise exactly
    const sumAllocated = cpuData.by_product.reduce((s, p) => s + (p.allocated_fee_paise || 0), 0);
    assert.strictEqual(sumAllocated, cpuData.fee_paise, 'Sum of product fee paise must equal creator fee paise');
    record('Dynamic Cost Per Unit (Integer Paise Split)', true, `CR1 units=${cpuData.units_sold}, CPU=₹${cpuData.cost_per_unit}, paise sum matches 100%`);
  } catch (e) {
    record('Dynamic Cost Per Unit (Integer Paise Split)', false, e.message);
  }

  // Check 9: Audit Reconciliation & Zero-PII Guarantee
  try {
    const reconRes = await fetch(`${FE_URL}/api/brands/B1/reconciliation?from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.000Z`, {
      headers: { 'X-Brand-Key': B1_KEY }
    });
    const reconData = await reconRes.json();
    assert.strictEqual(reconRes.status, 200);
    const aaravRecon = reconData.registered_codes?.find((c) => c.code === 'AARAV10');
    assert(aaravRecon);
    assert(aaravRecon.order_ids?.includes(testOrderId));
    // Zero PII assert
    assert(!JSON.stringify(reconData).includes('CUST-EVAL-42'));
    record('Audit Reconciliation & Zero PII Guarantee', true, `Order ${testOrderId} listed in sorted order IDs with 0 customer PII`);
  } catch (e) {
    record('Audit Reconciliation & Zero PII Guarantee', false, e.message);
  }

  // Check 10: Creator Finding, Offline URL Parser & Transactional CSV
  try {
    // 10a. URL Parser (strict offline format check)
    const parseRes = await fetch(`${FE_URL}/api/finder/parse-urls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: 'https://youtube.com/@aaravstyle\nhttps://instagram.com/diyaglow\nhttps://invalid-host.com/user' })
    });
    const parseData = await parseRes.json();
    assert.strictEqual(parseRes.status, 200);
    assert.strictEqual(parseData.valid_count, 2);
    assert.strictEqual(parseData.invalid_count, 1);

    // 10b. Transactional CSV Ingestion (Agency Auth)
    const csvContent = 'creator_id,platform,canonical_url,count,exact_or_rounded,hidden\nCR_TEST_1,youtube,https://youtube.com/@aaravstyle,250000,rounded,false\nCR_TEST_2,instagram,https://instagram.com/diyaglow,480000,exact,false';
    const csvRes = await fetch(`${FE_URL}/api/finder/csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agency-Key': AGENCY_KEY
      },
      body: JSON.stringify({ csv: csvContent })
    });
    const csvData = await csvRes.json();
    assert.strictEqual(csvRes.status, 201);
    assert.strictEqual(csvData.success, true);
    record('Creator Finder (URL Parser & Transactional CSV)', true, '2 valid URLs recognized, 1 rejected; 2 CSV profiles committed with Agency Auth');
  } catch (e) {
    record('Creator Finder (URL Parser & Transactional CSV)', false, e.message);
  }

  // Check 11: Brand-Scoped Shortlist & Multi-Tenant Isolation
  try {
    // Add to Brand B1
    const addRes = await fetch(`${FE_URL}/api/brands/B1/shortlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Brand-Key': B1_KEY
      },
      body: JSON.stringify({ creator_id: 'CR1', notes: 'Pre-eval test note' })
    });
    assert([200, 201].includes(addRes.status));

    // Brand B1 can see it
    const b1Res = await fetch(`${FE_URL}/api/brands/B1/shortlist`, {
      headers: { 'X-Brand-Key': B1_KEY }
    });
    const b1Data = await b1Res.json();
    assert(b1Data.shortlist?.some((s) => s.creator_id === 'CR1'));

    // Brand B2 CANNOT see it (strict isolation)
    const b2Res = await fetch(`${FE_URL}/api/brands/B2/shortlist`, {
      headers: { 'X-Brand-Key': B2_KEY }
    });
    const b2Data = await b2Res.json();
    assert(!b2Data.shortlist?.some((s) => s.creator_id === 'CR1'));
    record('Brand Shortlist Multi-Tenant Isolation', true, 'Brand B1 contains creator CR1; Brand B2 shortlist is completely isolated');
  } catch (e) {
    record('Brand Shortlist Multi-Tenant Isolation', false, e.message);
  }

  // Check 12: Dual-Key Security Guard (401 & 403 enforcement)
  try {
    // Missing key -> 401
    const noKeyRes = await fetch(`${FE_URL}/api/brands/B1/promo-codes`);
    assert.strictEqual(noKeyRes.status, 401);

    // Wrong brand key -> 403
    const wrongKeyRes = await fetch(`${FE_URL}/api/brands/B1/promo-codes`, {
      headers: { 'X-Brand-Key': B2_KEY } // Brand B2 key on Brand B1 endpoint
    });
    assert.strictEqual(wrongKeyRes.status, 403);
    record('Dual-Key Authentication & Authorization Guard', true, 'Enforced 401 on missing key and 403 on wrong brand key');
  } catch (e) {
    record('Dual-Key Authentication & Authorization Guard', false, e.message);
  }

  console.log('\n====================================================');
  const allPassed = results.every((r) => r.pass);
  console.log(`TOTAL CHECKS: ${results.length} | PASSED: ${results.filter((r) => r.pass).length} | FAILED: ${results.filter((r) => !r.pass).length}`);
  console.log(allPassed ? '>>> ALL PRE-EVALUATION CHECKS PASSED SUCCESSFULLY <<<' : '>>> SOME CHECKS FAILED <<<');
  console.log('====================================================');
  if (!allPassed) process.exit(1);
}

runPreEval().catch((err) => {
  console.error('Pre-eval crashed:', err);
  process.exit(1);
});
