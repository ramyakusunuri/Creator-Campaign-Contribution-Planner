import fs from 'node:fs';
const text = fs.readFileSync('frontend/src/app/page.tsx', 'utf8');
const ids = ['planner', 'finder', 'promo-codes', 'live-feed', 'cost-per-unit', 'experiments', 'evidence'];
ids.forEach(id => {
  const needle = `id="${id}"`;
  console.log(id, '->', text.includes(needle) ? 'FOUND' : 'MISSING');
});
