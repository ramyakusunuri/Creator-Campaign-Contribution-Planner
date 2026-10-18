import { NextRequest, NextResponse } from 'next/server';
import { authenticateBrand } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { calculateCreatorCostPerUnit } from '@/lib/costPerUnit';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { brandId: string; creatorId: string } }
) {
  const { brandId, creatorId } = params;
  const auth = authenticateBrand(req, brandId);
  if (!auth.success) {
    return auth.response;
  }

  const db = getDb();
  const creator = db
    .prepare('SELECT * FROM creators WHERE creator_id = ?;')
    .get(creatorId) as
    | {
        creator_id: string;
        name: string;
        default_fee_inr: number | null;
        default_fee_paise: number | null;
      }
    | undefined;

  if (!creator) {
    return NextResponse.json({ error: `Creator "${creatorId}" not found.` }, { status: 404 });
  }

  const url = new URL(req.url);
  const feeParam = url.searchParams.get('fee_inr');
  let feeInr: number | null;
  if (feeParam !== null) {
    feeInr = feeParam === '' || feeParam === 'null' ? null : Number(feeParam);
  } else {
    feeInr = creator.default_fee_inr;
  }

  const promos = db
    .prepare('SELECT code FROM promo_codes WHERE brand_id = ? AND creator_id = ?;')
    .all(brandId, creatorId) as Array<{ code: string }>;

  const registeredCodes = promos.map((p) => p.code);

  let uses: any[] = [];
  if (registeredCodes.length > 0) {
    const placeholders = registeredCodes.map(() => '?').join(',');
    const orders = db
      .prepare(`
        SELECT id, order_id, promo_code as code_entered, validity_flag, 1 as registered
        FROM orders
        WHERE brand_id = ? AND promo_code IN (${placeholders}) AND validity_flag != 'unregistered';
      `)
      .all(brandId, ...registeredCodes) as Array<{
        id: number;
        order_id: string;
        code_entered: string;
        validity_flag: string;
        registered: number;
      }>;

    uses = orders.map((o) => {
      const items = db
        .prepare('SELECT product_id, name, quantity FROM order_items WHERE order_id_ref = ?;')
        .all(o.id) as Array<{ product_id: string; name: string; quantity: number }>;
      return {
        ...o,
        items
      };
    });
  }

  const result = calculateCreatorCostPerUnit({
    brandId,
    creatorId,
    creatorName: creator.name,
    feeInr,
    registeredCodes,
    uses
  });

  return NextResponse.json(result);
}
