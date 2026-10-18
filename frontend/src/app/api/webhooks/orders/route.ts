import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ShopifyAdapter } from '@/lib/ecommerce/shopifyAdapter';
import { MockAdapter } from '@/lib/ecommerce/mockAdapter';
import { validateAndIngestOrder } from '@/lib/orderIngestion';
import { processRefund } from '@/lib/refundProcessor';

export async function POST(req: NextRequest) {
  let rawBodyText = '';
  try {
    rawBodyText = await req.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body.' }, { status: 400 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBodyText);
  } catch {
    return NextResponse.json({ error: 'Payload must be valid JSON.' }, { status: 400 });
  }

  const brandId = req.headers.get('x-brand-id') || body.brand_id || 'B1';
  const db = getDb();
  const brand = db
    .prepare('SELECT * FROM brands WHERE brand_id = ?;')
    .get(brandId) as
    | {
        brand_id: string;
        webhook_secret: string | null;
        platform_type: string;
      }
    | undefined;

  if (!brand) {
    return NextResponse.json({ error: `Brand "${brandId}" not found.` }, { status: 404 });
  }

  // Adapter selection
  const adapter =
    brand.platform_type === 'shopify' ? new ShopifyAdapter() : new MockAdapter();

  // Signature verification
  const secret = brand.webhook_secret || 'default_secret';
  const isVerified = adapter.verifySignature(rawBodyText, req.headers, secret);
  if (!isVerified) {
    return NextResponse.json({ error: 'Unauthorized: Invalid webhook signature.' }, { status: 401 });
  }

  // Normalize event
  let normalizedEvent: ReturnType<typeof adapter.normalizeWebhookPayload>;
  try {
    normalizedEvent = adapter.normalizeWebhookPayload(body, req.headers);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Invalid webhook payload structure.' }, { status: 400 });
  }

  // Idempotency check on event_id
  const eventId = normalizedEvent.event_id;
  const existingEvent = db
    .prepare('SELECT id FROM webhook_idempotency_log WHERE brand_id = ? AND event_id = ?;')
    .get(brandId, eventId);

  if (existingEvent) {
    return NextResponse.json(
      { success: true, message: 'Event already processed (idempotent ignore).' },
      { status: 200 }
    );
  }

  try {
    if (normalizedEvent.event_type === 'refund.created' && normalizedEvent.refund) {
      processRefund({
        brand_id: brandId,
        refund_id: normalizedEvent.refund.refund_id,
        order_id: normalizedEvent.refund.order_id,
        amount_inr: normalizedEvent.refund.amount_inr,
        is_full_refund: normalizedEvent.refund.is_full_refund
      });
    } else if (normalizedEvent.event_type === 'order.cancelled') {
      const orderId = normalizedEvent.order.order_id;
      db.prepare(`UPDATE orders SET status = 'cancelled' WHERE brand_id = ? AND order_id = ?;`).run(
        brandId,
        orderId
      );
    } else {
      // Order created or updated
      validateAndIngestOrder(brandId, normalizedEvent.order, normalizedEvent.promo_code);
    }

    // Record idempotency
    db.prepare(`
      INSERT INTO webhook_idempotency_log (brand_id, event_id, processed_at)
      VALUES (?, ?, ?);
    `).run(brandId, eventId, new Date().toISOString());

    return NextResponse.json(
      { success: true, event_id: eventId, event_type: normalizedEvent.event_type },
      { status: 200 }
    );
  } catch (err: any) {
    const statusCode = err.status || 500;
    return NextResponse.json({ error: err.message || 'Error processing webhook event' }, { status: statusCode });
  }
}
