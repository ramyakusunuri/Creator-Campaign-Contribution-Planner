import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateBrand } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ brandId: string; creatorId: string }>;
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { brandId, creatorId } = await params;
  const auth = authenticateBrand(req, brandId);
  if (!auth.success) {
    return auth.response;
  }

  const db = getDb();
  db.prepare('DELETE FROM shortlists WHERE brand_id = ? AND creator_id = ?;').run(brandId, creatorId);

  return NextResponse.json({
    success: true,
    creator_id: creatorId
  }, { status: 200 });
}
