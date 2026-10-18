import { getDb } from "./db";
import seed from "../data/creator_personas_seed.json";
import { initialCreators, type Creator } from "./creators";

export type PersonaLite = { id: string; name: string; platform_followers: Record<string, number> };

export async function getServerCreators(): Promise<Creator[]> {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM creators ORDER BY creator_id ASC;').all() as any[];
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((c: any, i: number) => {
        const rawSlug = c.slug || c.creator_id || `creator_${i + 1}`;
        const suffix = Number(String(rawSlug).match(/(\d+)$/)?.[1]);
        const stableId = Number.isSafeInteger(suffix) && suffix > 0 ? suffix : (i + 1);
        return {
          id: stableId,
          slug: rawSlug,
          name: c.name,
          category: c.category || c.niche || "Fashion",
          orders: typeof c.orders === 'number' && c.orders >= 0 ? c.orders : (initialCreators[i]?.orders || 1000),
          discount: typeof c.discount === 'number' && c.discount >= 0 ? c.discount : (initialCreators[i]?.discount || 10),
          sp: typeof c.sp_inr === 'number' && c.sp_inr > 0 ? c.sp_inr : (typeof c.default_sp_inr === 'number' ? c.default_sp_inr : 1500),
          cp: typeof c.cp_inr === 'number' && c.cp_inr > 0 ? c.cp_inr : (typeof c.default_cp_inr === 'number' ? c.default_cp_inr : 600),
          fee: typeof c.fee_inr === 'number' && c.fee_inr > 0 ? c.fee_inr : (typeof c.default_fee_inr === 'number' ? c.default_fee_inr : 200000),
        };
      });
    }
  } catch {}
  return initialCreators;
}

export async function getServerPersona(slug: string): Promise<PersonaLite | null> {
  // 1. Direct seed lookup
  const p = seed.find(x => x.id === slug || x.id.toLowerCase() === slug.toLowerCase() || x.id === `creator_${String(slug).padStart(3, '0')}`);
  if (p) return { id: p.id, name: p.name, platform_followers: p.platform_followers as Record<string, number> };

  // 2. CR1 alias lookup
  if (slug.toLowerCase() === 'cr1') {
    const p1 = seed.find(x => x.id === 'creator_001');
    if (p1) return { id: 'CR1', name: p1.name, platform_followers: p1.platform_followers as Record<string, number> };
  }

  // 3. Direct SQLite query
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM creators WHERE slug = ? OR creator_id = ? OR LOWER(slug) = LOWER(?) OR LOWER(creator_id) = LOWER(?);').get(slug, slug, slug, slug) as any;
    if (row) {
      const platform = row.primary_platform || 'Instagram';
      return {
        id: row.slug || row.creator_id,
        name: row.name,
        platform_followers: { [platform]: row.followers || 30000 }
      };
    }
  } catch {}

  return null;
}
