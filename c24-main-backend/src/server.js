import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const DB_PATH = process.env.DB_PATH || path.join(ROOT_DIR, 'data', 'promo.db');
const APP_ENV = process.env.APP_ENV || 'demo';

const { server, close } = createApp({
  dbPath: DB_PATH,
  appEnv: APP_ENV
});

server.listen(PORT, HOST, () => {
  console.log(`[C24 Promo Server] Running on http://${HOST}:${PORT}`);
  console.log(`[C24 Promo Server] Environment: ${APP_ENV}`);
  console.log(`[C24 Promo Server] Database: ${DB_PATH}`);
});

function shutdown() {
  console.log('\n[C24 Promo Server] Shutting down gracefully...');
  close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
