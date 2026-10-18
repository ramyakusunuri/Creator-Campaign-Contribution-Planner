/**
 * storefront-app/src/api/check.js
 * 
 * Backend proxy holding C24_WEBSITE_KEY.
 * Validates promo codes against C24 service without leaking the website key to client browsers.
 */

export async function handlePromoCheck(req, res, config) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const code = (parsedUrl.searchParams.get('code') || '').trim().toUpperCase();

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing promo code parameter: code' }));
    return;
  }

  const c24Url = `${config.apiUrl}/brands/${config.brandId}/promo-codes/${encodeURIComponent(code)}/check`;

  try {
    const c24Res = await fetch(c24Url, {
      method: 'GET',
      headers: {
        'X-Report-Key': config.websiteKey
      }
    });

    const data = await c24Res.json().catch(() => ({}));
    res.writeHead(c24Res.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (err) {
    // If backend is momentarily unreachable, fail open gracefully
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      code,
      valid: false,
      reason: 'service_unavailable',
      status: 'unknown'
    }));
  }
}
