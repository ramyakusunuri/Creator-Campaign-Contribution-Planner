import { NextRequest, NextResponse } from 'next/server';
import { authenticateBrand } from '@/lib/auth';
import { validateAndIngestOrder } from '@/lib/orderIngestion';

export async function POST(
  req: NextRequest,
  { params }: { params: { brandId: string } }
) {
  const brandId = params.brandId;
  const auth = authenticateBrand(req, brandId);
  if (!auth.success) {
    return auth.response;
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  const ordersToSync: any[] = Array.isArray(body.orders) ? body.orders : [];
  let ingestedCount = 0;
  let skippedDuplicates = 0;
  const errors: Array<{ order_id: string; error: string }> = [];

  for (const orderData of ordersToSync) {
    try {
      validateAndIngestOrder(brandId, orderData, orderData.promo_code);
      ingestedCount++;
    } catch (err: any) {
      if (err.status === 409) {
        skippedDuplicates++;
      } else {
        errors.push({
          order_id: orderData?.order_id || 'unknown',
          error: err.message || 'Validation error'
        });
      }
    }
  }

  return NextResponse.json({
    brand_id: brandId,
    total_received: ordersToSync.length,
    ingested: ingestedCount,
    duplicates_skipped: skippedDuplicates,
    errors
  });
}
