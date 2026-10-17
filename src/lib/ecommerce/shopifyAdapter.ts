import { verifyHmacSha256, type IEcommerceAdapter, type NormalizedWebhookEvent } from './adapter.ts';

export class ShopifyAdapter implements IEcommerceAdapter {
  verifySignature(rawBody: string, headers: Headers, secret: string): boolean {
    const signature = headers.get('x-shopify-hmac-sha256');
    if (!signature) return false;
    return verifyHmacSha256(rawBody, signature, secret, 'base64');
  }

  normalizeWebhookPayload(body: any, headers?: Headers): NormalizedWebhookEvent {
    const eventTopic = headers?.get('x-shopify-topic') || 'orders/create';
    const brandId = headers?.get('x-brand-id') || 'B1';
    const eventId = headers?.get('x-shopify-webhook-id') || `shp_${body.id}_${Date.now()}`;

    // Extract promo code
    let promoCode: string | null = null;
    if (Array.isArray(body.discount_codes) && body.discount_codes.length > 0) {
      promoCode = String(body.discount_codes[0].code).trim().toUpperCase();
    }

    const items = (body.line_items || []).map((li: any) => ({
      product_id: String(li.product_id || li.id),
      name: li.title || li.name || null,
      unit_price_inr: parseFloat(li.price) || 0,
      quantity: parseInt(li.quantity, 10) || 1,
      line_discount_inr: li.total_discount ? parseFloat(li.total_discount) : null
    }));

    const discountInr = body.total_discounts ? parseFloat(body.total_discounts) : null;

    let eventType: NormalizedWebhookEvent['event_type'] = 'order.created';
    if (eventTopic.includes('refund')) {
      eventType = 'refund.created';
    } else if (eventTopic.includes('cancelled')) {
      eventType = 'order.cancelled';
    } else if (eventTopic.includes('updated')) {
      eventType = 'order.updated';
    }

    let refund: NormalizedWebhookEvent['refund'] = undefined;
    if (eventType === 'refund.created' && body.refund_line_items) {
      const refundAmount = parseFloat(body.transactions?.[0]?.amount || body.total_refunded || '0');
      refund = {
        refund_id: `ref_${body.id}`,
        order_id: String(body.order_id || body.id),
        amount_inr: refundAmount,
        is_full_refund: refundAmount >= (parseFloat(body.total_price) || 0)
      };
    }

    return {
      brand_id: brandId,
      event_id: eventId,
      event_type: eventType,
      promo_code: promoCode,
      order: {
        order_id: String(body.id),
        customer_id: String(body.customer?.id || 'anon_cust'),
        used_at: body.created_at || new Date().toISOString(),
        items,
        discount_inr: discountInr
      },
      refund
    };
  }
}
