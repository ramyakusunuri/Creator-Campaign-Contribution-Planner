#!/usr/bin/env node

/**
 * scripts/fake-website.js
 * 
 * Standalone e-commerce simulator script (Phase B9).
 * Features:
 * 1. Health check guard: refuses to run unless /health reports environment === 'demo'.
 * 2. Pre-checkout advisory check: GET /brands/:brandId/promo-codes/:code/check using X-Report-Key.
 * 3. Paid order reporting: POST /brands/:brandId/promo-codes/:code/redemptions using X-Report-Key.
 * 4. Idempotency test: Re-submits order to verify 200 duplicate response.
 * 5. CLI Flags:
 *    --repeat <N>   : Repeat simulation N times
 *    --bad-code     : Include invalid/unregistered promo code test cases
 *    --brand <ID>   : Target brand ID (defaults to B1)
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
let BRAND_ID = process.env.BRAND_ID || 'B1';
let REPORT_KEY = process.env.REPORT_KEY || 'demo-report-key-b1';

// Parse CLI flags
const args = process.argv.slice(2);
let repeatCount = 1;
let includeBadCode = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--repeat' || arg === '-r') {
    const val = parseInt(args[++i], 10);
    if (!isNaN(val) && val > 0) repeatCount = val;
  } else if (arg === '--bad-code') {
    includeBadCode = true;
  } else if (arg === '--brand') {
    BRAND_ID = args[++i] || BRAND_ID;
    if (BRAND_ID === 'B2') REPORT_KEY = 'demo-report-key-b2';
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Usage: node scripts/fake-website.js [options]

Options:
  --repeat, -r <N>   Number of times to run checkout simulation (default: 1)
  --bad-code         Simulate failed/unregistered promo codes alongside valid ones
  --brand <ID>       Target brand ID (default: B1)
  --help, -h         Show this help message
`);
    process.exit(0);
  }
}

async function verifyDemoHealth() {
  console.log(`[Simulator] Checking target health at ${BASE_URL}/health...`);
  let res;
  try {
    res = await fetch(`${BASE_URL}/health`);
  } catch (err) {
    console.error(`[Simulator ERROR] Could not connect to ${BASE_URL}/health: ${err.message}`);
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`[Simulator ERROR] /health returned HTTP ${res.status}`);
    process.exit(1);
  }

  const health = await res.json();
  console.log(`[Simulator] Health response:`, health);

  if (health.environment !== 'demo') {
    console.error(`[Simulator REFUSAL] Target environment is "${health.environment}". Simulator refuses to run unless environment is "demo".`);
    process.exit(1);
  }

  console.log('[Simulator] Health verified: Target is in "demo" mode. Proceeding with simulation.\n');
}

async function checkPromoCode(code) {
  console.log(`[Simulator] Pre-checkout check for code: "${code}"...`);
  const res = await fetch(`${BASE_URL}/brands/${BRAND_ID}/promo-codes/${code}/check`, {
    headers: {
      'X-Report-Key': REPORT_KEY
    }
  });

  const data = await res.json();
  console.log(`[Simulator] Check result: HTTP ${res.status} ->`, data);
  return data;
}

async function reportPaidOrder(orderPayload, promoCode) {
  console.log(`[Simulator] Reporting paid order: ${orderPayload.order_id} (Code: "${promoCode}")...`);
  const res = await fetch(`${BASE_URL}/brands/${BRAND_ID}/promo-codes/${promoCode}/redemptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Report-Key': REPORT_KEY
    },
    body: JSON.stringify(orderPayload)
  });

  const data = await res.json();
  console.log(`[Simulator] Report result: HTTP ${res.status} ->`, data);
  return { status: res.status, data };
}

async function runDemoSimulation() {
  await verifyDemoHealth();

  const codesToTest = ['AARAV10'];
  if (includeBadCode) {
    codesToTest.push('NONEXISTENT99', 'EXPIREDCODE10');
  }

  console.log(`[Simulator] Starting simulation: ${repeatCount} iteration(s) for brand "${BRAND_ID}" with codes: [${codesToTest.join(', ')}]\n`);

  for (let iteration = 1; iteration <= repeatCount; iteration++) {
    console.log(`-------------------------------------------------`);
    console.log(`ITERATION ${iteration} of ${repeatCount}`);
    console.log(`-------------------------------------------------`);

    for (const code of codesToTest) {
      console.log(`Simulating checkout with promo code: "${code}"`);

      const check = await checkPromoCode(code);
      const now = new Date();
      const usedAt = now.toISOString();
      const paymentConfirmedAt = new Date(now.getTime() + 15000).toISOString();
      const orderId = `SIM-ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      const websiteDiscountInr = check.valid ? 200 : 0;

      const payload = {
        order_id: orderId,
        customer_id: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
        used_at: usedAt,
        payment_confirmed_at: paymentConfirmedAt,
        discount_inr: websiteDiscountInr,
        items: [
          {
            product_id: 'PRD-HOODIE',
            name: 'Classic Oversized Hoodie',
            unit_price_inr: 1499.00,
            quantity: 1,
            line_discount_inr: websiteDiscountInr
          },
          {
            product_id: 'PRD-TEE',
            name: 'Heavyweight Cotton Tee',
            unit_price_inr: 699.00,
            quantity: 2,
            line_discount_inr: 0
          }
        ]
      };

      // 1. Report order
      const firstReport = await reportPaidOrder(payload, code);

      // 2. Test idempotency with identical payload
      console.log(`[Simulator] Re-transmitting identical order to verify idempotency...`);
      const duplicateReport = await reportPaidOrder(payload, code);

      if (duplicateReport.status === 200 && duplicateReport.data.duplicate === true) {
        console.log(`[Simulator SUCCESS] Idempotency confirmed: Server returned duplicate: true.`);
      } else {
        console.warn(`[Simulator WARNING] Unexpected idempotency response:`, duplicateReport);
      }

      console.log('');
    }
  }

  console.log('[Simulator] Simulation sequence completed successfully.');
  console.log('[Simulator] All simulation iterations completed successfully.');
}

runDemoSimulation().catch(err => {
  console.error('[Simulator FATAL]', err);
  process.exit(1);
});
