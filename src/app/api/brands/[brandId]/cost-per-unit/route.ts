import { NextRequest, NextResponse } from 'next/server';
import { authenticateBrand } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { calculateCreatorCostPerUnit } from '@/lib/costPerUnit';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { brandId: string } }
) {
  const { brandId } = params;
  const auth = authenticateBrand(req, brandId);
  if (!auth.success) {
    return auth.response;
  }

  const db = getDb();
  const url = new URL(req.url);
  const feeOverrideParam = url.searchParams.get('fee_inr');

  const creators = db.prepare('SELECT * FROM creators ORDER BY creator_id ASC;').all() as Array<{
    creator_id: string;
    name: string;
    default_fee_inr: number | null;
    default_fee_paise: number | null;
  }>;

  const allPromos = db.prepare('SELECT code, creator_id FROM promo_codes WHERE brand_id = ?;').all(brandId) as Array<{
    code: string;
    creator_id: string;
  }>;

  const results = creators.map((creator) => {
    let feeInr: number | null;
    if (feeOverrideParam !== null) {
      feeInr = feeOverrideParam === '' || feeOverrideParam === 'null' ? null : Number(feeOverrideParam);
    } else {
      feeInr = creator.default_fee_inr;
    }

    const creatorPromos = allPromos.filter((p) => p.creator_id === creator.creator_id);
    const registeredCodes = creatorPromos.map((p) => p.code);

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

    return calculateCreatorCostPerUnit({
      brandId,
      creatorId: creator.creator_id,
      creatorName: creator.name,
      feeInr,
      registeredCodes,
      uses
    });
  });

  return NextResponse.json({
    brand_id: brandId,
    creators: results
  });
}
