async function runFullJourney() {
  console.log('=== Step 1: Register New Promo Code on Brand Dashboard ===');
  const code = 'JOURNEY' + Math.floor(Math.random() * 1000);
  const registerPayload = {
    code: code,
    creator_id: 'CR1', // Aarav Sharma
    starts_at: new Date(Date.now() - 3600000).toISOString(),
    expires_at: new Date(Date.now() + 86400000 * 30).toISOString()
  };

  const regRes = await fetch('http://localhost:3000/api/brands/B1/promo-codes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Brand-Key': 'b1_secret_key'
    },
    body: JSON.stringify(registerPayload)
  });
  const regData = await regRes.json();
  console.log('Registration Status:', regRes.status, regData);
  if (!regRes.ok) throw new Error('Registration failed: ' + JSON.stringify(regData));

  console.log('\n=== Step 2: Storefront Advisory Check (Pre-checkout) ===');
  const checkRes = await fetch(`http://localhost:3000/brands/B1/promo-codes/${code}/check`, {
    headers: {
      'Origin': 'http://localhost:3002',
      'X-Report-Key': 'demo-report-key-b1'
    }
  });
  const checkData = await checkRes.json();
  console.log('Check Status:', checkRes.status, checkData);
  if (!checkData.valid) throw new Error('Advisory check failed for code: ' + code);

  console.log('\n=== Step 3: Shopper Order Redemption at Checkout ===');
  const orderId = 'ORD-JOURNEY-' + Date.now();
  const redemptionPayload = {
    order_id: orderId,
    customer_id: 'CUST-ANANYA',
    used_at: new Date().toISOString(),
    payment_confirmed_at: new Date().toISOString(),
    discount_inr: 300,
    promo_code: code,
    items: [
      {
        product_id: 'PRD-1',
        name: 'Performance Athletic Track Pants',
        unit_price_inr: 1499,
        quantity: 2,
        line_discount_inr: 300
      }
    ]
  };

  const redeemRes = await fetch(`http://localhost:3000/brands/B1/promo-codes/${code}/redemptions`, {
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:3002',
      'Content-Type': 'application/json',
      'X-Report-Key': 'demo-report-key-b1'
    },
    body: JSON.stringify(redemptionPayload)
  });
  const redeemData = await redeemRes.json();
  console.log('Redemption Status:', redeemRes.status, redeemData);
  if (!redeemRes.ok || !redeemData.success) throw new Error('Redemption failed: ' + JSON.stringify(redeemData));

  console.log('\n=== Step 4: Verify Promo Code Stats & Units on Dashboard ===');
  const promoRes = await fetch('http://localhost:3000/api/brands/B1/promo-codes', {
    headers: { 'X-Brand-Key': 'b1_secret_key' }
  });
  const promoList = await promoRes.json();
  const found = promoList.find(p => p.code === code);
  console.log('Registered Promo in Dashboard List:', found);
  if (!found || found.units !== 2 || found.use_count !== 1) {
    throw new Error('Dashboard stats mismatch: ' + JSON.stringify(found));
  }

  console.log('\n=== Step 5: Verify Live Feed Status on Dashboard ===');
  const feedRes = await fetch('http://localhost:3000/api/brands/B1/feed-status', {
    headers: { 'X-Brand-Key': 'b1_secret_key' }
  });
  const feedData = await feedRes.json();
  console.log('Feed Status:', feedData);

  console.log('\n=== Step 6: Verify Cost Per Unit Computation on Read ===');
  const cpuRes = await fetch('http://localhost:3000/api/brands/B1/creators/CR1/cost-per-unit', {
    headers: { 'X-Brand-Key': 'b1_secret_key' }
  });
  const cpuData = await cpuRes.json();
  console.log('CR1 Cost Per Unit:', cpuData);

  console.log('\n>>> CRITICAL USER JOURNEY COMPLETELY SUCCESSFUL! <<<');
}

runFullJourney().catch(err => {
  console.error('Journey Failed:', err);
  process.exit(1);
});
