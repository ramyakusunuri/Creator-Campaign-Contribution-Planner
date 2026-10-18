async function testRedemption() {
  const payload = {
    order_id: 'ORD-TEST-' + Date.now(),
    customer_id: 'CUST-9999',
    used_at: new Date().toISOString(),
    payment_confirmed_at: new Date().toISOString(),
    discount_inr: 200,
    items: [
      {
        product_id: 'PRD-1',
        name: 'Performance Track Pants',
        unit_price_inr: 1499,
        quantity: 1,
        line_discount_inr: 200
      }
    ]
  };

  try {
    const res = await fetch('http://localhost:3000/brands/B1/promo-codes/SUMMER25/redemptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Report-Key': 'demo-report-key-b1'
      },
      body: JSON.stringify(payload)
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Data:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}
testRedemption();
