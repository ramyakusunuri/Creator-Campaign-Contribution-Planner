import fs from 'node:fs';

const seed = JSON.parse(fs.readFileSync('src/data/creator_personas_seed.json', 'utf8'));
const current = JSON.parse(fs.readFileSync('backend/data/creators.json', 'utf8'));
const existingIds = new Set(current.creators.map(c => c.creator_id));

seed.forEach(p => {
  if (!existingIds.has(p.id)) {
    current.creators.push({
      creator_id: p.id,
      name: p.name,
      relationships: [],
      excluded: false,
      fee_inr: p.estimated_rate_inr || 20000
    });
  }
});

fs.writeFileSync('backend/data/creators.json', JSON.stringify(current, null, 2), 'utf8');
console.log('Successfully updated backend/data/creators.json with', current.creators.length, 'creators.');
