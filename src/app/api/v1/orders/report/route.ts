import { authenticateReportKey } from '../../../../../lib/auth.ts';
import { validateAndIngestOrder } from '../../../../../lib/orderIngestion.ts';
import { validateMoneyDecimals } from '../../../../../lib/moneyValidation.ts';

const MAX_BODY_BYTES = 1024 * 1024; // 1MB

export async function POST(req: Request) {
  // Check Content-Length header if present
  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader && parseInt(contentLengthHeader, 10) > MAX_BODY_BYTES) {
    return Response.json(
      { error: 'Payload Too Large: body exceeds 1MB limit' },
      { status: 413 }
    );
  }

  // Authenticate X-Report-Key
  const auth = authenticateReportKey(req);
  if (!auth.success) {
    return auth.response;
  }

  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return Response.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  if (Buffer.byteLength(rawText, 'utf8') > MAX_BODY_BYTES) {
    return Response.json(
      { error: 'Payload Too Large: body exceeds 1MB limit' },
      { status: 413 }
    );
  }

  let body: any;
  try {
    body = JSON.parse(rawText);
  } catch {
    return Response.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return Response.json({ error: 'Payload must be a JSON object' }, { status: 400 });
  }

  // Pre-controller decimal validation
  const decimalValidation = validateMoneyDecimals(body);
  if (!decimalValidation.valid) {
    return Response.json({ error: decimalValidation.error }, { status: 400 });
  }

  try {
    const result = validateAndIngestOrder(auth.brand.brand_id, body, null, {
      source: 'website',
      saveUnregisteredToSeparateTable: true,
      allowIdempotentDuplicates: true,
      requirePaymentConfirmed: true
    });

    if ('duplicate' in result && result.duplicate) {
      return Response.json(
        { duplicate: true, order_id: result.order_id },
        { status: 200 }
      );
    }

    // Publish to live dashboard feed
    try {
      const { getSseHub } = await import('../../../../../lib/sseHub.ts');
      const eventName = (result as any).registered ? 'use_recorded' : 'unregistered_use_recorded';
      getSseHub().publish(auth.brand.brand_id, eventName, {
        order_id: (result as any).order_id,
        promo_code: (result as any).promo_code,
        registered: (result as any).registered,
        validity_flag: (result as any).validity_flag,
        used_at: body.used_at,
        payment_confirmed_at: body.payment_confirmed_at,
        discount_inr: (result as any).discount_inr,
        subtotal_inr: (result as any).subtotal_inr,
        total_inr: (result as any).total_inr,
        source: 'website'
      });
    } catch {}

    return Response.json(result, { status: 201 });
  } catch (err: any) {
    const status = err.status || 500;
    return Response.json({ error: err.message || 'Internal server error' }, { status });
  }
}
