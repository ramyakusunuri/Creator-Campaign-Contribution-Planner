import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateBrand } from '@/lib/auth';
import { checkShortlistEligibility } from '@/lib/finder';

interface RouteParams {
  params: Promise<{ brandId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { brandId } = await params;
  const auth = authenticateBrand(req, brandId);
  if (!auth.success) {
    return auth.response;
  }

  const db = getDb();
  const shortlist = db.prepare(`
    SELECT s.brand_id, s.creator_id, s.added_at, s.notes,
           c.name, c.category, c.excluded, c.relationships,
           cp.platform, cp.handle, cp.canonical_url,
           cs.count, cs.exact_or_rounded
    FROM shortlists s
    LEFT JOIN creators c ON c.creator_id = s.creator_id
    LEFT JOIN creator_profiles cp ON cp.creator_id = s.creator_id
    LEFT JOIN creator_snapshots cs ON cs.id = (
      SELECT id FROM creator_snapshots 
      WHERE creator_id = s.creator_id 
      ORDER BY id DESC LIMIT 1
    )
    WHERE s.brand_id = ?
    ORDER BY s.added_at DESC;
  `).all(brandId);

  return NextResponse.json({
    brand_id: brandId,
    shortlist
  }, { status: 200 });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { brandId } = await params;
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

  const { creator_id, notes } = body;
  if (!creator_id || typeof creator_id !== 'string') {
    return NextResponse.json({ error: 'Field "creator_id" is required and must be a string.' }, { status: 400 });
  }

  const db = getDb();
  const creator = db.prepare('SELECT * FROM creators WHERE creator_id = ?;').get(creator_id) as any;
  const brand = db.prepare('SELECT * FROM brands WHERE brand_id = ?;').get(brandId) as any;

  if (!brand) {
    return NextResponse.json({ error: `Brand "${brandId}" not found` }, { status: 404 });
  }

  const eligibility = checkShortlistEligibility(creator, brand);
  if (!eligibility.eligible) {
    return NextResponse.json({
      success: false,
      eligible: false,
      refusal_reason: eligibility.reason,
      error: eligibility.reason
    }, { status: 422 });
  }

  const addedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO shortlists (brand_id, creator_id, added_at, notes)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(brand_id, creator_id) DO UPDATE SET
      notes = excluded.notes;
  `).run(brandId, creator_id, addedAt, notes || null);

  return NextResponse.json({
    success: true,
    eligible: true,
    item: {
      brand_id: brandId,
      creator_id,
      added_at: addedAt,
      notes: notes || null
    }
  }, { status: 201 });
}
