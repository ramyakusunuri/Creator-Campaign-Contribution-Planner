import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

import seed from '../../../../data/creator_personas_seed.json';

const LIVE_ORDERS_FILE = path.join(process.cwd(), 'data', 'live_orders.json');

// Map of promo code prefix/exact to creator slug
const CODE_TO_CREATOR: Record<string, string> = {
  AARAV10: 'creator_001',
  DIYA15: 'creator_002',
  KABIR8: 'creator_003',
  ANANYA20: 'creator_004',
  ROHAN10: 'creator_005',
  MEERA5: 'creator_006',
  ISHAAN12: 'creator_007',
  SANA10: 'creator_008',
  SAVE10: 'creator_001',
  FASHION20: 'creator_006',
  SUMMER20: 'creator_002',
  FLASH50: 'creator_005'
};

function resolveCreator(code: string): { id: string; name: string } {
  const clean = (code || '').trim().toUpperCase();
  if (CODE_TO_CREATOR[clean]) {
    const id = CODE_TO_CREATOR[clean];
    const found = seed.find(s => s.id === id);
    return { id, name: found ? found.name : 'Aarav Mehta' };
  }

  for (const person of seed) {
    const firstName = person.name.split(' ')[0].toUpperCase();
    if (clean.includes(firstName) || clean.startsWith(firstName)) {
      return { id: person.id, name: person.name };
    }
  }

  const idMatch = clean.match(/CREATOR_?(\d+)/i);
  if (idMatch) {
    const num = idMatch[1].padStart(3, '0');
    const id = `creator_${num}`;
    const found = seed.find(s => s.id === id);
    return { id, name: found ? found.name : 'Creator' };
  }

  return { id: 'creator_001', name: 'Aarav Mehta' };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = (body.promo_code || body.code || '').trim().toUpperCase();
    const creator = resolveCreator(code);
    const creatorId = creator.id;
    const creatorName = creator.name;

    let orders: any[] = [];
    try {
      if (fs.existsSync(LIVE_ORDERS_FILE)) {
        const raw = fs.readFileSync(LIVE_ORDERS_FILE, 'utf8');
        orders = JSON.parse(raw || '[]');
      }
    } catch {
      orders = [];
    }

    const newOrder = {
      order_id: body.order_id || `ORD-${Date.now()}`,
      customer_id: body.customer_id || body.customer || 'Shopper',
      creator_id: creatorId,
      creator_name: creatorName,
      promo_code: code,
      discount_percent: body.discount_percent || 20,
      discount_inr: body.discount_inr || 0,
      total_inr: body.total_inr || body.subtotal_inr || 0,
      items: body.items || [],
      status: 'Delivered',
      placed_at: new Date().toISOString()
    };

    // Avoid duplicate order_id
    const existingIdx = orders.findIndex(o => o.order_id === newOrder.order_id);
    if (existingIdx !== -1) {
      orders[existingIdx] = newOrder;
    } else {
      orders.unshift(newOrder); // newest first
    }

    fs.writeFileSync(LIVE_ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');

    // Also forward to C24 Backend at port 3001 if alive
    try {
      await fetch('http://127.0.0.1:3001/api/v1/orders/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Report-Key': 'demo-report-key-b1'
        },
        body: JSON.stringify({
          order_id: newOrder.order_id,
          customer_id: newOrder.customer_id,
          promo_code: code,
          used_at: newOrder.placed_at,
          payment_confirmed_at: newOrder.placed_at,
          discount_inr: newOrder.discount_inr,
          items: newOrder.items
        })
      });
    } catch {}

    const creatorCount = orders.filter(o => o.creator_id === creatorId).length;

    return NextResponse.json({
      success: true,
      order: newOrder,
      creator_id: creatorId,
      creator_live_orders: creatorCount,
      total_live_orders: orders.length
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
