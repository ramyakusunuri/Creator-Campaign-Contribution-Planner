async function test() {
  const brandKey = 'b1_secret_key';
  const agencyKey = 'demo-agency-key';
  
  const tests = [
    { name: 'GET /api/creators?brand_id=B1', url: 'http://localhost:3000/api/creators?brand_id=B1' },
    { name: 'GET /api/brands/B1/promo-codes', url: 'http://localhost:3000/api/brands/B1/promo-codes', headers: { 'X-Brand-Key': brandKey } },
    { name: 'GET /api/brands/B1/feed-status', url: 'http://localhost:3000/api/brands/B1/feed-status', headers: { 'X-Brand-Key': brandKey } },
    { name: 'GET /api/brands/B1/unregistered-uses', url: 'http://localhost:3000/api/brands/B1/unregistered-uses', headers: { 'X-Brand-Key': brandKey } },
    { name: 'GET /api/finder/creators', url: 'http://localhost:3000/api/finder/creators' },
    { name: 'GET /api/brands/B1/shortlist', url: 'http://localhost:3000/api/brands/B1/shortlist', headers: { 'X-Brand-Key': brandKey } },
    { name: 'GET /api/brands/B1/cost-per-unit', url: 'http://localhost:3000/api/brands/B1/cost-per-unit', headers: { 'X-Brand-Key': brandKey } },
    { name: 'GET /api/brands/B1/reconciliation', url: 'http://localhost:3000/api/brands/B1/reconciliation?from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.000Z', headers: { 'X-Brand-Key': brandKey } }
  ];

  for (const t of tests) {
    try {
      const res = await fetch(t.url, { headers: t.headers || {} });
      const text = await res.text();
      console.log(t.name, '-> Status:', res.status, res.ok ? 'OK' : 'FAIL');
      if (!res.ok) {
        console.log('  Error response:', text.slice(0, 200));
      }
    } catch (err) {
      console.log(t.name, '-> Exception:', err.message);
    }
  }
}
test();
