import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

function initTable(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_settings (
      user_id TEXT PRIMARY KEY,
      budget REAL NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

export async function GET() {
  const db = getDb();
  initTable(db);
  const row = db.prepare('SELECT budget FROM campaign_settings WHERE user_id = ?;').get('default_user') as { budget: number } | undefined;
  return NextResponse.json({ budget: row ? row.budget : 2500000 });
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  const budget = Number(body.budget);
  if (!Number.isFinite(budget) || budget <= 0) {
    return NextResponse.json({ error: 'Budget must be a positive number' }, { status: 400 });
  }

  const db = getDb();
  initTable(db);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO campaign_settings (user_id, budget, updated_at)
    VALUES ('default_user', ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET budget = excluded.budget, updated_at = excluded.updated_at;
  `).run(budget, now);

  return NextResponse.json({ success: true, budget });
}
