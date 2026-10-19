import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('backend/data/promo.db');
const rows = db.prepare('SELECT order_id, payload_hash, code_entered FROM uses;').all();
console.log('Uses count:', rows.length);
console.log('Uses in promo.db:', rows);
