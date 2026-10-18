import crypto from 'node:crypto';
import type { OrderInputPayload } from '../../types/ecommerce.ts';

export interface NormalizedWebhookEvent {
  brand_id: string;
  event_id: string;
  event_type: 'order.created' | 'order.updated' | 'refund.created' | 'order.cancelled';
  order: OrderInputPayload;
  promo_code: string | null;
  refund?: {
    refund_id: string;
    order_id: string;
    amount_inr: number;
    is_full_refund: boolean;
  };
}

export interface IEcommerceAdapter {
  verifySignature(rawBody: string, headers: Headers, secret: string): boolean;
  normalizeWebhookPayload(body: any, headers?: Headers): NormalizedWebhookEvent;
}

export function verifyHmacSha256(rawBody: string, signature: string, secret: string, encoding: 'hex' | 'base64' = 'hex'): boolean {
  if (!signature || !secret) return false;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody, 'utf8');
  const digest = hmac.digest(encoding);
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(digest, 'utf8'));
  } catch {
    return false;
  }
}
