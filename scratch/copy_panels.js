import fs from 'node:fs';

const comps = ['PromoCodesPanel.tsx', 'CostPerUnitPanel.tsx'];
for (const c of comps) {
  const content = fs.readFileSync(`src/components/${c}`, 'utf8');
  if (!fs.existsSync('frontend/src/components')) fs.mkdirSync('frontend/src/components', { recursive: true });
  if (!fs.existsSync('c24-main-backend/src/components')) fs.mkdirSync('c24-main-backend/src/components', { recursive: true });
  fs.writeFileSync(`frontend/src/components/${c}`, content, 'utf8');
  fs.writeFileSync(`c24-main-backend/src/components/${c}`, content, 'utf8');
  console.log(`Copied ${c} to frontend/ and c24-main-backend/`);
}
