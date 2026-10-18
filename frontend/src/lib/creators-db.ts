import seed from "../data/creator_personas_seed.json";
import { initialCreators, type Creator } from "./creators";
import { getSupabase } from "./supabase/client";

// Reads creators from native backend SQLite API (/api/creators), or Supabase when configured.
// If neither is reachable, falls back to the bundled JSON so the site keeps working.
export type PersonaLite = { id: string; name: string; platform_followers: Record<string, number> };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function reader() {
  if (typeof window !== "undefined") return (await getSupabase())?.sb ?? null;
  if (!url || !key) return null;
  try {
    const pkg = "@supabase/" + "supabase-js";
    const { createClient } = await import(/* webpackIgnore: true */ pkg);
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  } catch {
    return null;
  }
}

type Fin = { orders: number; discount: number; sp: number; cp: number; fee: number };

export async function fetchCreators(): Promise<Creator[]> {
  // 1. First, try native backend SQLite database via /api/creators
  try {
    if (typeof window !== "undefined") {
      const res = await fetch('/api/creators?brand_id=B1');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((c: any, i: number) => {
            const rawSlug = c.slug || c.creator_id || `creator_${i + 1}`;
            const suffix = Number(String(rawSlug).match(/(\d+)$/)?.[1]);
            const stableId = Number.isSafeInteger(suffix) && suffix > 0
              ? suffix
              : (i + 1);
            return {
              id: stableId,
              slug: rawSlug,
              name: c.name,
              category: c.category || c.niche || "Fashion",
              orders: typeof c.orders === 'number' && c.orders >= 0 ? c.orders : (initialCreators[i]?.orders || 1000),
              discount: typeof c.discount === 'number' && c.discount >= 0 ? c.discount : (initialCreators[i]?.discount || 10),
              sp: typeof c.sp === 'number' && c.sp > 0 ? c.sp : (initialCreators[i]?.sp || 1500),
              cp: typeof c.cp === 'number' && c.cp > 0 ? c.cp : (initialCreators[i]?.cp || 600),
              fee: typeof c.fee === 'number' && c.fee > 0 ? c.fee : (initialCreators[i]?.fee || 200000),
            };
          });
        }
      }
    }
  } catch {}

  // 2. Try Supabase if configured
  try {
    const sb = await reader();
    if (sb) {
      const { data, error } = await sb
        .from("creators")
        .select("slug,name,niche,creator_financials!inner(orders,discount,sp,cp,fee)")
        .order("slug");
      if (!error && data && data.length > 0) {
        return data.map((r: { slug: string; name: string; niche: string; creator_financials: Fin | Fin[] }, i: number) => {
          const f = Array.isArray(r.creator_financials) ? r.creator_financials[0] : r.creator_financials;
          const suffix = Number(r.slug.match(/(\d+)$/)?.[1]);
          const stableId = Number.isSafeInteger(suffix) && suffix > 0
            ? suffix
            : Array.from(r.slug).reduce((hash, ch) => ((hash * 31 + ch.charCodeAt(0)) >>> 0), 1);
          return {
            id: stableId, slug: r.slug, name: r.name, category: r.niche,
            orders: Number(f.orders), discount: Number(f.discount), sp: Number(f.sp), cp: Number(f.cp), fee: Number(f.fee),
          };
        });
      }
    }
  } catch {}

  // 3. Fallback to bundled JSON
  return initialCreators;
}

export async function fetchPersona(slug: string): Promise<PersonaLite | null> {
  // 1. Direct seed lookup
  const p = seed.find(x => x.id === slug || x.id.toLowerCase() === slug.toLowerCase() || x.id === `creator_${String(slug).padStart(3, '0')}`);
  if (p) return { id: p.id, name: p.name, platform_followers: p.platform_followers as Record<string, number> };

  // 2. CR1 alias lookup
  if (slug.toLowerCase() === 'cr1') {
    const p1 = seed.find(x => x.id === 'creator_001');
    if (p1) return { id: 'CR1', name: p1.name, platform_followers: p1.platform_followers as Record<string, number> };
  }

  // 3. Check Supabase if configured
  try {
    const sb = await reader();
    if (sb) {
      const { data, error } = await sb.from("creators").select("slug,name,platform_followers").eq("slug", slug).maybeSingle();
      if (!error && data) return { id: data.slug, name: data.name, platform_followers: data.platform_followers ?? {} };
    }
  } catch {}

  // 4. Check dynamic creator in native backend API
  try {
    if (typeof window !== "undefined") {
      const res = await fetch('/api/creators?brand_id=B1');
      if (res.ok) {
        const list = await res.json();
        const found = list.find((c: any) => c.slug === slug || c.creator_id === slug || c.id === slug || c.slug?.toLowerCase() === slug.toLowerCase());
        if (found) {
          const platform = found.primary_platform || 'Instagram';
          return {
            id: found.slug || found.creator_id,
            name: found.name,
            platform_followers: { [platform]: found.followers || 30000 }
          };
        }
      }
    }
  } catch {}

  return null;
}
