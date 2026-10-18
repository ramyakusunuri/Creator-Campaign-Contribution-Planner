import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

function initShortlistTable(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS finder_shortlist (
      platform TEXT NOT NULL,
      username TEXT NOT NULL,
      username_key TEXT NOT NULL,
      followers INTEGER,
      niche TEXT NOT NULL,
      profile_url TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      PRIMARY KEY(platform, username_key)
    );
  `);
}

export async function GET() {
  const db = getDb();
  initShortlistTable(db);
  const rows = db.prepare('SELECT platform, username, followers, niche, profile_url, fetched_at FROM finder_shortlist ORDER BY fetched_at DESC;').all() as Array<{
    platform: string;
    username: string;
    followers: number | null;
    niche: string;
    profile_url: string;
    fetched_at: string;
  }>;

  const list = rows.map((r) => ({
    platform: r.platform,
    username: r.username,
    followers: r.followers,
    niche: r.niche,
    profileUrl: r.profile_url,
    fetchedAt: r.fetched_at,
  }));

  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  const platform = typeof body.platform === 'string' ? body.platform.trim().toLowerCase() : '';
  const username = typeof body.username === 'string' ? body.username.trim() : '';

  if (!platform || !username) {
    return NextResponse.json({ error: 'Fields "platform" and "username" are required.' }, { status: 400 });
  }

  const db = getDb();
  initShortlistTable(db);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO finder_shortlist (platform, username, username_key, followers, niche, profile_url, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(platform, username_key) DO UPDATE SET
      followers = excluded.followers,
      niche = excluded.niche,
      profile_url = excluded.profile_url,
      fetched_at = excluded.fetched_at;
  `).run(
    platform,
    username,
    username.toLowerCase(),
    typeof body.followers === 'number' ? body.followers : null,
    body.niche || 'General',
    body.profileUrl || `https://www.${platform}.com/${username.replace(/^@/, '')}`,
    body.fetchedAt || now
  );

  return NextResponse.json({ success: true, platform, username }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  let platform = url.searchParams.get('platform');
  let username = url.searchParams.get('username');

  if (!platform || !username) {
    try {
      const b = await req.json();
      platform = b.platform;
      username = b.username;
    } catch {}
  }

  if (!platform || !username) {
    return NextResponse.json({ error: 'Fields "platform" and "username" are required.' }, { status: 400 });
  }

  const db = getDb();
  initShortlistTable(db);
  db.prepare('DELETE FROM finder_shortlist WHERE platform = ? AND username_key = ?;').run(
    platform.toLowerCase(),
    username.toLowerCase()
  );

  return NextResponse.json({ success: true, deleted: username }, { status: 200 });
}
