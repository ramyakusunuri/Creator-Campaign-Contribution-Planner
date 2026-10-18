import fs from 'node:fs';

const content = fs.readFileSync('src/hooks/useLiveDashboard.ts', 'utf8');
fs.writeFileSync('frontend/src/hooks/useLiveDashboard.ts', content, 'utf8');
fs.writeFileSync('c24-main-backend/src/hooks/useLiveDashboard.ts', content, 'utf8');
console.log('Synchronized useLiveDashboard.ts successfully');
