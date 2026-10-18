import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateAgencyKey } from '@/lib/auth';
import { parseAndValidateCsv } from '@/lib/finder';

export async function POST(req: NextRequest) {
  const auth = authenticateAgencyKey(req);
  if (!auth.success) {
    return auth.response;
  }

  let csvContent = '';
  const contentType = req.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      const body = await req.json();
      csvContent = body.csv || body.data || '';
    } else {
      csvContent = await req.text();
    }
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to read request payload' }, { status: 400 });
  }

  const parseResult = parseAndValidateCsv(csvContent);
  if (!parseResult.valid) {
    return NextResponse.json({
      success: false,
      errors: parseResult.errors
    }, { status: 400 });
  }

  const db = getDb();
  // All-or-nothing transactional commit
  db.exec('BEGIN IMMEDIATE;');
  try {
    const insertProfile = db.prepare(`
      INSERT INTO creator_profiles (creator_id, platform, handle, canonical_url, platform_account_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(creator_id, platform) DO UPDATE SET
        handle = excluded.handle,
        canonical_url = excluded.canonical_url;
    `);

    const insertSnapshot = db.prepare(`
      INSERT INTO creator_snapshots (creator_id, platform, count, exact_or_rounded, hidden_flag, fetched_time, source, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `);

    for (const row of parseResult.rows) {
      insertProfile.run(row.creator_id, row.platform, row.handle, row.canonical_url, null);
      insertSnapshot.run(
        row.creator_id,
        row.platform,
        row.count,
        row.exact_or_rounded || 'rounded',
        row.hidden_flag || 0,
        row.fetched_time || new Date().toISOString(),
        row.source || 'csv_upload',
        row.status || 'ok'
      );
    }
    db.exec('COMMIT;');

    return NextResponse.json({
      success: true,
      count: parseResult.rows.length,
      rows: parseResult.rows
    }, { status: 201 });
  } catch (err: any) {
    db.exec('ROLLBACK;');
    return NextResponse.json({
      success: false,
      error: `Failed to commit batch: ${err.message}`
    }, { status: 500 });
  }
}
