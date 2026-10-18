import http from 'node:http';

async function testLiveOrderStream() {
  console.log('--- Testing Live Order Stream & Event Publishing ---');

  const nowIso = new Date().toISOString();
  const orderPayload = {
    order_id: 'TEST_LIVE_' + Date.now(),
    customer_id: 'CUST_DEMO_01',
    promo_code: 'AARAV10',
    used_at: nowIso,
    payment_confirmed_at: nowIso,
    discount_inr: 299.9,
    items: [
      {
        product_id: 'PRD-1',
        name: 'Wireless Earbuds',
        quantity: 1,
        unit_price_inr: 2999,
        line_discount_inr: 299.9
      }
    ]
  };

  // Connect to SSE feed on port 3000
  const reqSse = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/brands/B1/events',
    method: 'GET',
    headers: {
      'X-Brand-Key': 'b1_secret_key'
    }
  });

  const eventPromise = new Promise((resolve, reject) => {
    let raw = '';
    const timeout = setTimeout(() => {
      reqSse.destroy();
      reject(new Error('Timeout waiting for use_recorded event'));
    }, 10000);

    reqSse.on('response', (res) => {
      console.log('SSE Stream response status:', res.statusCode);
      res.on('data', (chunk) => {
        const text = chunk.toString();
        raw += text;
        console.log('[SSE Chunk Received]:', text.trim());
        if (text.includes('use_recorded')) {
          clearTimeout(timeout);
          reqSse.destroy();
          resolve(text);
        }
      });
    });

    reqSse.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    reqSse.end();
  });

  // Give SSE a brief moment to connect
  await new Promise((r) => setTimeout(r, 600));

  // Now post order via report endpoint on 3000
  console.log('Posting order report to http://localhost:3000/api/v1/orders/report...');
  const postRes = await fetch('http://localhost:3000/api/v1/orders/report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Report-Key': 'demo-report-key-b1'
    },
    body: JSON.stringify(orderPayload)
  });

  const postJson = await postRes.json();
  console.log('Order Report Response:', postRes.status, postJson);

  if (postRes.status !== 201 && postRes.status !== 200) {
    throw new Error(`Order report failed with status ${postRes.status}: ${JSON.stringify(postJson)}`);
  }

  // Wait for SSE event
  const sseOutput = await eventPromise;
  console.log('SUCCESS: Received SSE Output:', sseOutput);

  // Validate strict payload requirements:
  // Must have: type: 'use_recorded', code, creator_id, time
  // Must NOT have: discount_inr, total_inr, subtotal_inr, items, customer_id
  const match = sseOutput.match(/data:\s*(\{.*\})/);
  if (!match) {
    throw new Error('Could not find data JSON in SSE message');
  }
  const eventData = JSON.parse(match[1]);
  console.log('Parsed Event Data:', eventData);

  if (eventData.type !== 'use_recorded') throw new Error(`Expected type use_recorded, got ${eventData.type}`);
  if (eventData.code !== 'AARAV10') throw new Error(`Expected code AARAV10, got ${eventData.code}`);
  if (!eventData.creator_id) throw new Error(`Expected creator_id in payload`);
  if (!eventData.time) throw new Error(`Expected time in payload`);

  const forbiddenKeys = ['discount_inr', 'discount_paise', 'subtotal_inr', 'total_inr', 'customer_id', 'items'];
  for (const k of forbiddenKeys) {
    if (k in eventData) {
      throw new Error(`FORBIDDEN key ${k} found in event payload: sensitive PII/pricing leaked!`);
    }
  }

  console.log('--- ALL CHECKS PASSED: Live event published and verified! ---');
}

testLiveOrderStream().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
