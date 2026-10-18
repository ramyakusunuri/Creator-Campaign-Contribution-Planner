import Database from 'better-sqlite3';
import { canonicalHash } from './src/lib/promoLogic.ts';

const db = new Database('data/planner.db');
const row = db.prepare('SELECT order_id, raw_payload FROM orders WHERE brand_id = "B1" ORDER BY id DESC LIMIT 1').get();
console.log('Order ID:', row?.order_id);
console.log('Raw payload:', row?.raw_payload);
if (row?.raw_payload) {
  const parsed = JSON.parse(row.raw_payload);
  console.log('Hash from DB parsed:', canonicalHash(parsed));
}
