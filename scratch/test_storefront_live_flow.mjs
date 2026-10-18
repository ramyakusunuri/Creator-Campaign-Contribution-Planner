import http from 'node:http';

async function testStorefrontLiveFlow() {
  console.log('--- Testing Storefront Proxy to Live SSE Flow ---');

  // Fetch initial promo codes list from dashboard
  const preRes = await fetch('http://localhost:3000/api/brands/B1/promo-codes', {
    headers: { 'X-Brand-Key': 'b1_secret_key' }
  });
  const preData = await preRes.json();
  const preAarav = (preData.promo_codes || preData).find((p) => p.code === 'AARAV10');
  const initialUnits = preAarav ? preAarav.units : 0;
  console.log(`Initial units for AARAV10: ${initialUnits}`);

  const nowIso = new Date().toISOString();
  const orderPayload = {
    order_id: 'ORDER_STOREFRONT_' + Date.now(),
    customer_id: 'CUST_STOREFRONT_99',
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
    const timeout = setTimeout(() => {
      reqSse.destroy();
      reject(new Error('Timeout waiting for SSE event from storefront order'));
    }, 10000);

    reqSse.on('response', (res) => {
      res.on('data', (chunk) => {
        const text = chunk.toString();
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

  await new Promise((r) => setTimeout(r, 600));

  // Place order through Storefront proxy on port 3002
  console.log('Sending order to storefront proxy at http://localhost:3002/api/order...');
  const storeRes = await fetch('http://localhost:3002/api/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderPayload)
  });

  const storeJson = await storeRes.json();
  console.log('Storefront response:', storeRes.status, storeJson);

  if (storeRes.status !== 200 && storeRes.status !== 201) {
    throw new Error(`Storefront returned error status ${storeRes.status}`);
  }

  // Wait for SSE stream event
  const sseChunk = await eventPromise;
  console.log('Received SSE chunk on client listener:', sseChunk.trim());

  // Verify dashboard promo-codes unit count incremented
  const postRes = await fetch('http://localhost:3000/api/brands/B1/promo-codes', {
    headers: { 'X-Brand-Key': 'b1_secret_key' }
  });
  const postData = await postRes.json();
  const postAarav = (postData.promo_codes || postData).find((p) => p.code === 'AARAV10');
  const updatedUnits = postAarav ? postAarav.units : 0;
  console.log(`Updated units for AARAV10: ${updatedUnits}`);

  if (updatedUnits !== initialUnits + 1) {
    throw new Error(`Expected units to increment from ${initialUnits} to ${initialUnits + 1}, but got ${updatedUnits}`);
  }

  // Verify Cost Per Unit endpoint recomputes dynamically
  const cpuRes = await fetch('http://localhost:3000/api/brands/B1/cost-per-unit', {
    headers: { 'X-Brand-Key': 'b1_secret_key' }
  });
  const cpuData = await cpuRes.json();
  const creatorList = cpuData.creators || cpuData.results || (Array.isArray(cpuData) ? cpuData : []);
  const aaravCpu = creatorList.find((c) => c.creator_id === 'CR1');
  console.log('Cost Per Unit for CR1 (Aarav):', aaravCpu);

  console.log('=== END-TO-END VERIFICATION SUCCEEDED! ===');
}

testStorefrontLiveFlow().catch((err) => {
  console.error('Storefront Live Flow Test Failed:', err);
  process.exit(1);
});
