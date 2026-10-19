#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';

const creators = [
  { code: 'AARAV10', creatorId: 'creator_001' },
  { code: 'DIYA15', creatorId: 'creator_002' },
  { code: 'KABIR8', creatorId: 'creator_003' },
  { code: 'ANANYA20', creatorId: 'creator_004' },
  { code: 'ROHAN10', creatorId: 'creator_005' },
  { code: 'MEERA5', creatorId: 'creator_006' },
  { code: 'ISHAAN12', creatorId: 'creator_007' },
  { code: 'SANA10', creatorId: 'creator_008' },
  // Common testing aliases
  { code: 'SAVE10', creatorId: 'creator_001' },
  { code: 'FASHION20', creatorId: 'creator_006' },
  { code: 'SUMMER20', creatorId: 'creator_002' },
  { code: 'FLASH50', creatorId: 'creator_005' },
];

async function seedAll() {
  const now = Date.now();
  const validFrom = new Date(now - 86400000 * 7).toISOString(); // 7 days ago
  const validTo = new Date(now + 86400000 * 365).toISOString(); // 1 year ahead

  for (const item of creators) {
    try {
      const res = await fetch(`${BASE_URL}/brands/B1/promo-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Brand-Key': 'demo-key-b1'
        },
        body: JSON.stringify({
          code: item.code,
          creator_id: item.creatorId,
          valid_from: validFrom,
          valid_to: validTo
        })
      });

      if (res.status === 201) {
        console.log(`[SUCCESS] Registered ${item.code} for ${item.creatorId}`);
      } else if (res.status === 409) {
        console.log(`[INFO] ${item.code} already registered`);
      } else {
        const text = await res.text();
        console.warn(`[WARNING] Failed ${item.code}: ${res.status} ${text}`);
      }
    } catch (err) {
      console.error(`[ERROR] ${item.code}:`, err.message);
    }
  }
}

seedAll();
