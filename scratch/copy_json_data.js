import fs from 'node:fs';
import path from 'node:path';

if (!fs.existsSync('backend/data')) fs.mkdirSync('backend/data', { recursive: true });
fs.copyFileSync('data/brands.json', 'backend/data/brands.json');
fs.copyFileSync('data/creators.json', 'backend/data/creators.json');
console.log('Copied brands.json and creators.json to backend/data/');
