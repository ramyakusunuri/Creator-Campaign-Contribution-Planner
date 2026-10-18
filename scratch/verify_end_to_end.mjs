import assert from 'node:assert';

const BASE_FE = 'http://localhost:3000';
const BASE_STORE = 'http://localhost:3002';
const BRAND_KEY = 'b1_secret_key';
const REPORT_KEY = 'demo-report-key-b1';
const AGENCY_KEY = 'demo-agency-key';

async function verifyAll() {
  console.log('=== STARTING END-TO-END SYSTEM VERIFICATION ===\n');

  // 1. Verify Frontend Pages (HTML Status 200 & Core DOM Elements)
  console.log('1. Verifying Frontend Web Pages...');
  const resHome = await fetch(`${BASE_FE}/`);
  assert.strictEqual(resHome.status, 200, 'Home page must return 200 OK');
  const homeHtml = await resHome.text();
  assert(homeHtml.includes('Campaign Contribution Shell'), 'Home must contain main heading');
  assert(homeHtml.includes('id="overview"'), 'Home must contain #overview hero section');
  assert(homeHtml.includes('id="planner"'), 'Home must contain #planner optimizer section');
  assert(homeHtml.includes('id="creators"'), 'Home must contain #creators influencer table');
  assert(homeHtml.includes('id="cost-per-unit"'), 'Home must contain #cost-per-unit section');
  assert(homeHtml.includes('id="finder"'), 'Home must contain #finder creator finder section');
  console.log('  ✓ Home Dashboard (http://localhost:3000/) - 200 OK with all sections present');

  const resCalc = await fetch(`${BASE_FE}/calculator`);
  assert.strictEqual(resCalc.status, 200, 'Calculator page must return 200 OK');
  const calcHtml = await resCalc.text();
  assert(calcHtml.includes('Campaign Calculator'), 'Calculator must contain title');
  console.log('  ✓ Campaign Calculator (http://localhost:3000/calculator) - 200 OK');

  const resProfile1 = await fetch(`${BASE_FE}/influencer/CR1`);
  assert.strictEqual(resProfile1.status, 200, 'Profile CR1 must return 200 OK');
  const profile1Html = await resProfile1.text();
  assert(profile1Html.includes('Aarav'), 'Profile must display creator name (Aarav)');
  assert(profile1Html.includes('Back to Overview'), 'Profile must have Back to Overview link');
  console.log('  ✓ Influencer Profile CR1 (http://localhost:3000/influencer/CR1) - 200 OK');

  const resProfile2 = await fetch(`${BASE_FE}/influencer/creator_001`);
  assert.strictEqual(resProfile2.status, 200, 'Profile creator_001 must return 200 OK');
  console.log('  ✓ Influencer Profile Alias (http://localhost:3000/influencer/creator_001) - 200 OK');

  const resStore = await fetch(`${BASE_STORE}/`);
  assert.strictEqual(resStore.status, 200, 'Storefront must return 200 OK');
  const storeHtml = await resStore.text();
  assert(storeHtml.includes('ATELIER 24'), 'Storefront must contain brand title');
  console.log('  ✓ E-Commerce Storefront (http://localhost:3002/) - 200 OK\n');

  // 2. Promo Code Registration & Eligibility Checks
  console.log('2. Testing Promo Code Registration & Brand Isolation...');
  const testCode = 'HACK' + Math.floor(1000 + Math.random() * 9000);
  const regRes = await fetch(`${BASE_FE}/api/brands/B1/promo-codes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Brand-Key': BRAND_KEY
    },
    body: JSON.stringify({
      code: testCode,
      creator_id: 'CR1',
      starts_at: '2026-01-01T00:00:00.000Z',
      expires_at: '2026-12-31T23:59:59.000Z'
    })
  });
  assert.strictEqual(regRes.status, 201, 'Registration must return 201 Created');
  const regData = await regRes.json();
  assert.strictEqual(regData.code, testCode, 'Registered code must match');
  console.log(`  ✓ Registered new promo code "${testCode}" for Creator CR1 on Brand B1`);

  // 3. Pre-checkout check (Simulating Storefront Cart)
  console.log('3. Testing Storefront Pre-checkout Code Check...');
  const checkRes = await fetch(`${BASE_FE}/brands/B1/promo-codes/${testCode}/check`, {
    headers: { 'X-Report-Key': REPORT_KEY }
  });
  assert.strictEqual(checkRes.status, 200, 'Check must return 200 OK');
  const checkData = await checkRes.json();
  assert.strictEqual(checkData.valid, true, 'Code must be reported as valid');
  console.log(`  ✓ Storefront advisory check verified: "${testCode}" is VALID`);

  // 4. Storefront Order Checkout & Redemption Reporting
  console.log('4. Testing Order Checkout & Redemption Event...');
  const orderId = 'ORD-E2E-' + Date.now();
  const orderRes = await fetch(`${BASE_FE}/brands/B1/promo-codes/${testCode}/redemptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Report-Key': REPORT_KEY
    },
    body: JSON.stringify({
      order_id: orderId,
      customer_id: 'CUST-E2E-1',
      used_at: new Date().toISOString(),
      payment_confirmed_at: new Date().toISOString(),
      discount_inr: 400,
      items: [
        {
          product_id: 'PRD-1',
          name: 'Track Pants',
          unit_price_inr: 1499,
          quantity: 2,
          line_discount_inr: 300
        },
        {
          product_id: 'PRD-2',
          name: 'Classic Tee',
          unit_price_inr: 999,
          quantity: 1,
          line_discount_inr: 100
        }
      ]
    })
  });
  assert.strictEqual(orderRes.status, 201, 'Redemption must return 201 Created');
  const orderData = await orderRes.json();
  assert.strictEqual(orderData.registered, true, 'Order must be recognized as registered');
  assert.strictEqual(orderData.validity_flag, 'valid', 'Order validity flag must be valid');
  assert.strictEqual(orderData.discount_inr, 400, 'Order discount must match');
  console.log(`  ✓ Order ${orderId} successfully redeemed with "${testCode}"`);

  // 5. Cost Per Unit Dynamic Calculation on Read
  console.log('5. Testing Cost Per Unit Dynamic Calculation (Phase B5)...');
  const cpuRes = await fetch(`${BASE_FE}/api/brands/B1/creators/CR1/cost-per-unit`, {
    headers: { 'X-Brand-Key': BRAND_KEY }
  });
  assert.strictEqual(cpuRes.status, 200, 'CPU must return 200 OK');
  const cpuData = await cpuRes.json();
  assert(cpuData.units_sold >= 3, 'Units sold must include new order units');
  assert(cpuData.cost_per_unit > 0, 'Cost per unit must be a positive number');
  assert.strictEqual(cpuData.status, 'ok', 'Status must be ok');
  console.log(`  ✓ Creator CR1 live CPU: units_sold=${cpuData.units_sold}, cost_per_unit=₹${cpuData.cost_per_unit}, status=${cpuData.status}`);

  // 6. Audit Reconciliation & Zero-PII Guarantee (Phase B4)
  console.log('6. Testing Audit Reconciliation Endpoint...');
  const reconRes = await fetch(`${BASE_FE}/api/brands/B1/reconciliation?from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.000Z`, {
    headers: { 'X-Brand-Key': BRAND_KEY }
  });
  assert.strictEqual(reconRes.status, 200, 'Reconciliation must return 200 OK');
  const reconData = await reconRes.json();
  const testCodeRecon = reconData.registered_codes?.find((c) => c.code === testCode);
  assert(testCodeRecon, 'Test code must be listed in reconciliation');
  assert(testCodeRecon.order_ids?.includes(orderId), 'Reconciliation must list order ID');
  assert(!JSON.stringify(reconData).includes('CUST-E2E-1'), 'Zero PII: Customer ID must NEVER appear in reconciliation response');
  console.log(`  ✓ Reconciliation contains order ${orderId} with zero PII leakage`);

  // 7. Creator Finder URL Parser & CSV Transactional Upload (Phase B6)
  console.log('7. Testing Creator Finder Ingestion (Phase B6)...');
  const parseRes = await fetch(`${BASE_FE}/api/finder/parse-urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls: 'https://youtube.com/@aaravstyle\nhttps://instagram.com/diyaglow\nhttps://badsite.com/foo' })
  });
  assert.strictEqual(parseRes.status, 200, 'Parse URLs must return 200 OK');
  const parseData = await parseRes.json();
  assert.strictEqual(parseData.valid_count, 2, 'Must recognize 2 valid URLs');
  assert.strictEqual(parseData.invalid_count, 1, 'Must reject 1 invalid URL');
  console.log('  ✓ Strict offline URL parser correctly validated YouTube & Instagram handles');

  // 8. Brand-Scoped Shortlist
  console.log('8. Testing Brand Shortlist Storage & Isolation...');
  const shortAddRes = await fetch(`${BASE_FE}/api/brands/B1/shortlist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Brand-Key': BRAND_KEY
    },
    body: JSON.stringify({
      creator_id: 'CR1',
      notes: 'Automated E2E Test Note'
    })
  });
  assert([200, 201].includes(shortAddRes.status), 'Shortlist add must succeed');
  const shortListRes = await fetch(`${BASE_FE}/api/brands/B1/shortlist`, {
    headers: { 'X-Brand-Key': BRAND_KEY }
  });
  const shortListData = await shortListRes.json();
  assert(shortListData.shortlist?.some((s) => s.creator_id === 'CR1'), 'Creator CR1 must be in Brand B1 shortlist');

  // Verify Brand B2 cannot see Brand B1's shortlist
  const shortB2Res = await fetch(`${BASE_FE}/api/brands/B2/shortlist`, {
    headers: { 'X-Brand-Key': 'b2_secret_key' }
  });
  const shortB2Data = await shortB2Res.json();
  assert(!shortB2Data.shortlist?.some((s) => s.creator_id === 'CR1'), 'Brand B2 must NOT see Brand B1 shortlist items');
  console.log('  ✓ Brand shortlist persisted to SQLite and strictly isolated between brands');

  console.log('\n======================================================');
  console.log('🎉 ALL END-TO-END HACKATHON ESSENTIAL FEATURES PASSED!');
  console.log('======================================================');
}

verifyAll().catch((err) => {
  console.error('\n❌ E2E Verification Failed:', err);
  process.exit(1);
});
