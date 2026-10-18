import { verifyHmacSha256, type IEcommerceAdapter, type NormalizedWebhookEvent } from './adapter.ts';

export class MockAdapter implements IEcommerceAdapter {
  verifySignature(rawBody: string, headers: Headers, secret: string): boolean {
    const signature = headers.get('x-webhook-signature');
    if (!signature) {
      // If brand key is provided instead, allow authenticated calls
      return !!headers.get('x-brand-key');
    }
    return verifyHmacSha256(rawBody, signature, secret, 'hex');
  }

  normalizeWebhookPayload(body: any, headers?: Headers): NormalizedWebhookEvent {
    const brandId = headers?.get('x-brand-id') || body.brand_id || 'B1';
    const eventId = headers?.get('x-event-id') || body.event_id || `evt_${body.order_id || Date.now()}`;
    const promoCode = body.promo_code || body.code || null;

    let eventType: NormalizedWebhookEvent['event_type'] = 'order.created';
    if (body.event_type) {
      eventType = body.event_type;
    }

    return {
      brand_id: brandId,
      event_id: eventId,
      event_type: eventType,
      promo_code: promoCode ? String(promoCode).trim().toUpperCase() : null,
      order: {
        order_id: String(body.order_id || body.order?.order_id),
        customer_id: String(body.customer_id || body.order?.customer_id),
        used_at: body.used_at || body.order?.used_at || new Date().toISOString(),
        items: body.items || body.order?.items || [],
        discount_inr: 'discount_inr' in body ? body.discount_inr : body.order?.discount_inr
      },
      refund: body.refund
    };
  }
}
