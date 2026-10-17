#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

async function seedPromoCodes() {
  console.log('[Seed] Registering initial demo promo codes for B1 and B2...');

  const promos = [
    {
      brandId: 'B1',
      brandKey: 'demo-key-b1',
      code: 'AARAV10',
      creatorId: 'CR1',
      fromOffsetHours: -24,
      toOffsetDays: 30
    },
    {
      brandId: 'B1',
      brandKey: 'demo-key-b1',
      code: 'DIYA15',
      creatorId: 'CR2',
      fromOffsetHours: -48,
      toOffsetDays: 14
    },
    {
      brandId: 'B2',
      brandKey: 'demo-key-b2',
      code: 'ROHAN20',
      creatorId: 'CR3',
      fromOffsetHours: -12,
      toOffsetDays: 45
    }
  ];

  const now = Date.now();

  for (const p of promos) {
    const validFrom = new Date(now + p.fromOffsetHours * 3600000).toISOString();
    const validTo = new Date(now + p.toOffsetDays * 86400000).toISOString();

    const res = await fetch(`${BASE_URL}/brands/${p.brandId}/promo-codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Brand-Key': p.brandKey
      },
      body: JSON.stringify({
        code: p.code,
        creator_id: p.creatorId,
        valid_from: validFrom,
        valid_to: validTo
      })
    });

    const data = await res.json();
    if (res.status === 201) {
      console.log(`[Seed SUCCESS] Registered ${p.code} for ${p.brandId} (Creator: ${p.creatorId})`);
    } else if (res.status === 409) {
      console.log(`[Seed INFO] Promo ${p.code} already exists for ${p.brandId}`);
    } else {
      console.warn(`[Seed WARNING] Could not register ${p.code}:`, data);
    }
  }

  console.log('[Seed] Completed.\n');
}

seedPromoCodes().catch(err => {
  console.error('[Seed ERROR]', err);
  process.exit(1);
});
