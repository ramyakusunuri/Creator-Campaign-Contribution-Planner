const payload = {
  order_id: 'ORD-IN-' + Date.now(),
  customer_id: 'CUST-Ananya-Sharma',
  promo_code: 'AARAV10',
  discount_percent: 25,
  discount_inr: 375,
  total_inr: 1258,
  items: [
    { product_id: 'PRD-1', name: 'Performance Athletic Track Pants', unit_price_inr: 1499, quantity: 1, line_discount_inr: 375 }
  ]
};

console.log('Sending order to storefront API at http://localhost:3002/api/order...');
try {
  const res = await fetch('http://localhost:3002/api/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log('Storefront /api/order response status:', res.status, data);

  // Now check Next.js live endpoint
  const liveRes = await fetch('http://localhost:3000/api/orders/live');
  const liveData = await liveRes.json();
  console.log('Next.js /api/orders/live response:', liveData);
} catch (err) {
  console.error('Error during test:', err);
}
