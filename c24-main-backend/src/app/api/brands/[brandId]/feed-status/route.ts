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

  let unregTableCount = 0;
  let unregLast: string | null = null;
  try {
    const unregRow = db.prepare(`
      SELECT COUNT(*) as count, MAX(used_at) as last_used
      FROM unregistered_code_uses
      WHERE brand_id = ?;
    `).get(brandId) as { count: number; last_used: string | null } | undefined;
    if (unregRow) {
      unregTableCount = unregRow.count || 0;
      unregLast = unregRow.last_used;
    }
  } catch {}

  const totalUnregistered = (row?.unreg_count || 0) + unregTableCount;
  const dates = [row?.last_received, unregLast].filter((d): d is string => Boolean(d));
  dates.sort();
  const lastReceived = dates.length > 0 ? dates[dates.length - 1] : null;

  return NextResponse.json({
    brand_id: brandId,
    last_use_received_at: lastReceived,
    uses_by_source: {
      website: (row?.total_count || 0) + unregTableCount,
      synthetic_seed: 0
    },
    unregistered_uses: totalUnregistered
  });
}
