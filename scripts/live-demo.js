#!/usr/bin/env node

/**
 * scripts/live-demo.js
 * 
 * Live demonstration simulator script (Phase B9).
 * Emits one synthetic promo redemption every 5 seconds, stopping strictly after 40 seconds (8 total events).
 * Refuses to run unless target /health reports environment === 'demo'.
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const BRAND_ID = process.env.BRAND_ID || 'B1';
const REPORT_KEY = process.env.REPORT_KEY || 'demo-report-key-b1';

const TOTAL_DURATION_SEC = 40;
const INTERVAL_SEC = 5;
const TOTAL_CYCLES = Math.floor(TOTAL_DURATION_SEC / INTERVAL_SEC); // 8 cycles

async function checkHealthGuard() {
  console.log(`[Live Demo] Checking server status at ${BASE_URL}/health...`);
  let res;
  try {
    res = await fetch(`${BASE_URL}/health`);
  } catch (err) {
    console.error(`[Live Demo ERROR] Failed to connect to server: ${err.message}`);
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`[Live Demo ERROR] Server returned status ${res.status}`);
    process.exit(1);
  }

  const health = await res.json();
  if (health.environment !== 'demo') {
    console.error(`[Live Demo REFUSAL] Environment is "${health.environment}". Script only executes in "demo" mode.`);
    process.exit(1);
  }

  console.log('[Live Demo] Health verified: Server is running in "demo" mode.');
}

async function emitSyntheticUse(cycleIndex) {
  const codes = ['AARAV10', 'DIYA15', 'AARAV10', 'KABIRTECH', 'AARAV10'];
  const code = codes[(cycleIndex - 1) % codes.length];
  const now = new Date();
  const orderId = `LIVE-DEMO-${Date.now().toString(36).toUpperCase()}-${cycleIndex}`;

  const payload = {
    order_id: orderId,
    customer_id: `CUST-LIVE-${Math.floor(1000 + Math.random() * 9000)}`,
    used_at: now.toISOString(),
    payment_confirmed_at: new Date(now.getTime() + 10000).toISOString(),
    discount_inr: 200,
    items: [
      {
        product_id: 'PRD-LIVETEE',
        name: 'Graphic Tour T-Shirt',
        unit_price_inr: 899.00,
        quantity: 1,
        line_discount_inr: 200
      }
    ]
  };

  const url = `${BASE_URL}/brands/${BRAND_ID}/promo-codes/${code}/redemptions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Report-Key': REPORT_KEY
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  const elapsedSec = (cycleIndex - 1) * INTERVAL_SEC;
  console.log(`[Live Demo] [T=${elapsedSec}s/${TOTAL_DURATION_SEC}s] Event ${cycleIndex}/${TOTAL_CYCLES} -> Code "${code}" | Order ${orderId} | Status: ${res.status}`);
  return data;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  await checkHealthGuard();
  console.log(`\n[Live Demo] Starting ${TOTAL_DURATION_SEC}-second live demonstration (${TOTAL_CYCLES} events, 1 event every ${INTERVAL_SEC}s)...`);

  for (let cycle = 1; cycle <= TOTAL_CYCLES; cycle++) {
    try {
      await emitSyntheticUse(cycle);
    } catch (err) {
      console.error(`[Live Demo ERROR in event ${cycle}]`, err.message);
    }

    if (cycle < TOTAL_CYCLES) {
      await sleep(INTERVAL_SEC * 1000);
    }
  }

  console.log(`\n[Live Demo] 40-second live demonstration concluded. Sent all ${TOTAL_CYCLES} synthetic events. Exiting cleanly.`);
}

main().catch(err => {
  console.error('[Live Demo FATAL]', err);
  process.exit(1);
});
