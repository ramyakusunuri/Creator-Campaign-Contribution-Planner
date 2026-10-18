import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { rankCreators, DEFAULT_TIER_SETTINGS } from '@/lib/finder';

export async function GET(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get('platform') || 'all';
  const minCount = req.nextUrl.searchParams.get('min_count') ? Number(req.nextUrl.searchParams.get('min_count')) : 0;
  const maxCount = req.nextUrl.searchParams.get('max_count') ? Number(req.nextUrl.searchParams.get('max_count')) : Infinity;

  const tierSettings = {
    mega: req.nextUrl.searchParams.get('mega') ? Number(req.nextUrl.searchParams.get('mega')) : DEFAULT_TIER_SETTINGS.mega,
    macro: req.nextUrl.searchParams.get('macro') ? Number(req.nextUrl.searchParams.get('macro')) : DEFAULT_TIER_SETTINGS.macro,
    mid: req.nextUrl.searchParams.get('mid') ? Number(req.nextUrl.searchParams.get('mid')) : DEFAULT_TIER_SETTINGS.mid,
    micro: req.nextUrl.searchParams.get('micro') ? Number(req.nextUrl.searchParams.get('micro')) : DEFAULT_TIER_SETTINGS.micro
  };

  const db = getDb();

  let sql = `
    SELECT 
      p.creator_id,
      p.platform,
      p.handle,
      p.canonical_url,
      p.platform_account_id,
      s.count,
      s.exact_or_rounded,
      s.hidden_flag,
      s.fetched_time,
      s.source,
      s.status
    FROM creator_profiles p
    LEFT JOIN creator_snapshots s ON s.id = (
      SELECT id FROM creator_snapshots 
      WHERE creator_id = p.creator_id AND platform = p.platform 
      ORDER BY id DESC LIMIT 1
    )
  `;

  const params: any[] = [];
  if (platform && platform !== 'all') {
    sql += ' WHERE p.platform = ?';
    params.push(platform);
  }
  sql += ' ORDER BY p.creator_id ASC;';

  let rows = db.prepare(sql).all(...params) as Array<any>;

  // If no profiles in database yet, seed from creators table for demo convenience
  if (rows.length === 0) {
    const creators = db.prepare('SELECT * FROM creators ORDER BY creator_id ASC;').all() as Array<any>;
    for (const c of creators) {
      const pPlatform = 'youtube';
      const handle = `@${c.name.toLowerCase().replace(/[^a-z0-9_]/g, '')}`;
      const canonical = `https://youtube.com/${handle}`;
      db.prepare(`
        INSERT INTO creator_profiles (creator_id, platform, handle, canonical_url)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(creator_id, platform) DO NOTHING;
      `).run(c.creator_id, pPlatform, handle, canonical);

      const count = c.creator_id === 'C3' ? null : 150000;
      const hidden = c.creator_id === 'C3' ? 1 : 0;
      db.prepare(`
        INSERT INTO creator_snapshots (creator_id, platform, count, exact_or_rounded, hidden_flag, fetched_time, source, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `).run(c.creator_id, pPlatform, count, 'rounded', hidden, new Date().toISOString(), 'seed', 'ok');
    }
    rows = db.prepare(sql).all(...params) as Array<any>;
  }

  const result = rankCreators(rows, {
    platform,
    minCount,
    maxCount,
    tierSettings
  });

  return NextResponse.json(result, { status: 200 });
}
