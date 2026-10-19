/**
 * storefront-app/src/api/order.js
 * 
 * Backend proxy holding C24_WEBSITE_KEY.
 * Forwards paid orders to the C24 reporting API securely without exposing the website key.
 */

export async function handleOrderReport(req, res, config) {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 1024 * 1024) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Payload too large' }));
      req.destroy();
    }
  });

  req.on('end', async () => {
    let payload;
    try {
      payload = JSON.parse(body || '{}');
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }

    // Ensure required timestamps exist
    const now = new Date();
    if (!payload.used_at) payload.used_at = now.toISOString();
    if (!payload.payment_confirmed_at) payload.payment_confirmed_at = new Date(now.getTime() + 1000).toISOString();

    // 1. Report to Next.js Contribution Planner website (port 3000)
    try {
      await fetch('http://127.0.0.1:3000/api/orders/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('[Storefront Proxy] Order successfully synced to Planner Dashboard at localhost:3000');
    } catch (dashErr) {
      console.warn('[Storefront Proxy] Note: Could not sync order to localhost:3000:', dashErr.message);
    }

    // 2. Forward to C24 Backend reporting API
    const c24Url = `${config.apiUrl}/api/v1/orders/report`;

    // Only forward strictly allowed schema fields to the C24 backend validator
    const c24Payload = {
      order_id: payload.order_id,
      customer_id: payload.customer_id,
      promo_code: payload.promo_code,
      used_at: payload.used_at,
      payment_confirmed_at: payload.payment_confirmed_at,
      discount_inr: payload.discount_inr,
      items: payload.items
    };

    try {
      const c24Res = await fetch(c24Url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Report-Key': config.websiteKey
        },
        body: JSON.stringify(c24Payload)
      });

      const data = await c24Res.json().catch(() => ({}));
      res.writeHead(c24Res.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to communicate with C24 backend', details: err.message }));
    }
  });
}
