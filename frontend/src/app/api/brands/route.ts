import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const brands = db.prepare('SELECT brand_id, name, platform_type, rivals FROM brands;').all() as Array<{
    brand_id: string;
    name: string;
    platform_type: string;
    rivals: string;
  }>;

  const result = brands.map((b) => ({
    brand_id: b.brand_id,
    name: b.name,
    platform_type: b.platform_type,
    rivals: JSON.parse(b.rivals || '[]')
  }));

  return NextResponse.json(result, { status: 200 });
}
