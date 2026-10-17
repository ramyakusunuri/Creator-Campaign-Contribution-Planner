import { getDb } from './db.ts';
import { round2 } from './calculator.ts';

export interface RefundInput {
  brand_id: string;
  refund_id: string;
  order_id: string;
  amount_inr: number;
  is_full_refund?: boolean;
}

export function processRefund(input: RefundInput): {
  success: boolean;
  duplicate: boolean;
  order_status: string;
  refund_id: string;
} {
  const { brand_id, refund_id, order_id, amount_inr } = input;

  if (!brand_id || !refund_id || !order_id) {
    throw { status: 400, message: 'Fields "brand_id", "refund_id", and "order_id" are required.' };
  }

  if (typeof amount_inr !== 'number' || !Number.isFinite(amount_inr) || amount_inr <= 0) {
    throw { status: 400, message: 'Field "amount_inr" must be a finite number > 0.' };
  }

  const db = getDb();

  // Check idempotency
  const existingRefund = db
    .prepare('SELECT id FROM refund_events WHERE brand_id = ? AND refund_id = ?;')
    .get(brand_id, refund_id);
  if (existingRefund) {
    return {
      success: true,
      duplicate: true,
      order_status: 'already_processed',
      refund_id
    };
  }

  // Find order
  const order = db
    .prepare('SELECT * FROM orders WHERE brand_id = ? AND order_id = ?;')
    .get(brand_id, order_id) as
    | {
        id: number;
        subtotal_inr: number;
        total_inr: number | null;
        status: string;
      }
    | undefined;

  if (!order) {
    throw { status: 404, message: `Order "${order_id}" not found for brand "${brand_id}".` };
  }

  const roundedAmount = round2(amount_inr, 'refund_amount');
  const targetTotal = order.total_inr ?? order.subtotal_inr;
  const isFull = input.is_full_refund === true || roundedAmount >= targetTotal;
  const newStatus = isFull ? 'refunded' : 'partially_refunded';

  db.prepare(`
    INSERT INTO refund_events (brand_id, refund_id, order_id, amount_inr, is_full_refund, created_at)
    VALUES (?, ?, ?, ?, ?, ?);
  `).run(
    brand_id,
    refund_id,
    order_id,
    roundedAmount,
    isFull ? 1 : 0,
    new Date().toISOString()
  );

  db.prepare(`
    UPDATE orders
    SET status = ?
    WHERE brand_id = ? AND order_id = ?;
  `).run(newStatus, brand_id, order_id);

  return {
    success: true,
    duplicate: false,
    order_status: newStatus,
    refund_id
  };
}
