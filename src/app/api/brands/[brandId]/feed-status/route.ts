import { NextRequest, NextResponse } from 'next/server';
import { authenticateBrand } from '@/lib/auth';
import { getDb } from '@/lib/db';

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
  const row = db.prepare(`
    SELECT 
      MAX(used_at) as last_received,
      COUNT(*) as total_count,
      SUM(CASE WHEN validity_flag = 'unregistered' THEN 1 ELSE 0 END) as unreg_count
    FROM orders
    WHERE brand_id = ?;
  `).get(brandId) as { last_received: string | null; total_count: number; unreg_count: number } | undefined;

  const total = row?.total_count || 0;
  const unreg = row?.unreg_count || 0;

  return NextResponse.json({
    brand_id: brandId,
    last_use_received_at: row?.last_received || null,
    uses_by_source: {
      website: total,
      synthetic_seed: 0
    },
    unregistered_uses: unreg
  });
}
