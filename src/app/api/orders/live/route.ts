import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LIVE_ORDERS_FILE = path.join(process.cwd(), 'data', 'live_orders.json');

export async function GET() {
  try {
    let orders: any[] = [];
    if (fs.existsSync(LIVE_ORDERS_FILE)) {
      const raw = fs.readFileSync(LIVE_ORDERS_FILE, 'utf8');
      orders = JSON.parse(raw || '[]');
    }

    const counts: Record<string, number> = {};
    for (const o of orders) {
      if (o.creator_id) {
        counts[o.creator_id] = (counts[o.creator_id] || 0) + 1;
      }
    }

    return NextResponse.json({
      success: true,
      counts,
      total: orders.length,
      recent: orders.slice(0, 20)
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
