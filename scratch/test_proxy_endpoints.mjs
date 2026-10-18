async function run() {
  console.log('--- 1. Testing GET http://localhost:3002/api/check?code=AARAV10 ---');
  try {
    const res = await fetch('http://localhost:3002/api/check?code=AARAV10');
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', data);
  } catch (err) {
    console.error('Error in check:', err);
  }

  console.log('\n--- 2. Testing POST http://localhost:3002/api/order ---');
  try {
    const orderPayload = {
      order_id: 'TEST_PROXY_' + Date.now(),
      customer_id: 'cust_proxy_test',
      promo_code: 'AARAV10',
      used_at: new Date().toISOString(),
      payment_confirmed_at: new Date().toISOString(),
      discount_inr: 299,
      items: [
        {
          product_id: 'prod_1',
          name: 'The Obsidian Velvet Tuxedo',
          unit_price_inr: 2999,
          quantity: 1,
          line_discount_inr: 299
        }
      ]
    };

    const res = await fetch('http://localhost:3002/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', data);
  } catch (err) {
    console.error('Error in order:', err);
  }
}

run();
