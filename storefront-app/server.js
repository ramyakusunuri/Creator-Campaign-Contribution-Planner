import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handlePromoCheck } from './src/api/check.js';
import { handleOrderReport } from './src/api/order.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple .env parser to avoid requiring external npm packages
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const envConfig = {
    C24_WEBSITE_KEY: 'demo-report-key-b1',
    C24_API_URL: 'http://localhost:3000',
    BRAND_ID: 'B1',
    PORT: '3002'
  };

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        envConfig[key] = val;
      }
    }
  }

  // Allow system process.env overrides
  return {
    websiteKey: process.env.C24_WEBSITE_KEY || envConfig.C24_WEBSITE_KEY,
    apiUrl: process.env.C24_API_URL || envConfig.C24_API_URL,
    brandId: process.env.BRAND_ID || envConfig.BRAND_ID,
    port: parseInt(process.env.PORT || envConfig.PORT, 10)
  };
}

const config = loadEnv();
const APP_DIR = path.join(__dirname, 'src', 'app');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. Backend Proxies (Securely injects C24_WEBSITE_KEY)
  if (pathname === '/api/check' && req.method === 'GET') {
    return handlePromoCheck(req, res, config);
  }
  if (pathname === '/api/order' && req.method === 'POST') {
    return handleOrderReport(req, res, config);
  }

  // 2. Static Storefront App Pages
  let filePath = path.join(APP_DIR, pathname === '/' ? 'index.html' : pathname);

  // Prevent directory traversal
  const safePath = path.normalize(filePath);
  if (!safePath.startsWith(APP_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    fs.createReadStream(safePath).pipe(res);
  });
});

server.listen(config.port, '0.0.0.0', () => {
  console.log(`================================================================`);
  console.log(`[STOREFRONT-APP] Running on port: http://localhost:${config.port}`);
  console.log(`[STOREFRONT-APP] Connected to C24 Backend at: ${config.apiUrl}`);
  console.log(`[STOREFRONT-APP] Using backend proxy for C24_WEBSITE_KEY`);
  console.log(`================================================================`);
});

export default server;
