async function run() {
  const r1 = await fetch('http://localhost:3000/brands/B1/promo-codes/SUMMER25/check', {headers: {'X-Report-Key': 'demo-report-key-b1'}}).then(async r => ({url: '3000/brands', status: r.status, data: await r.json()})).catch(e => ({err: e.message}));
  const r2 = await fetch('http://localhost:3000/api/brands/B1/promo-codes/SUMMER25/check', {headers: {'X-Report-Key': 'demo-report-key-b1'}}).then(async r => ({url: '3000/api', status: r.status, data: await r.json()})).catch(e => ({err: e.message}));
  const r3 = await fetch('http://localhost:3001/brands/B1/promo-codes/SUMMER25/check', {headers: {'X-Report-Key': 'demo-report-key-b1'}}).then(async r => ({url: '3001/brands', status: r.status, data: await r.json()})).catch(e => ({err: e.message}));
  console.log(JSON.stringify({r1, r2, r3}, null, 2));
}
run();
