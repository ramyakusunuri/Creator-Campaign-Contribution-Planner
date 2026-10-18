import { createClient } from "@supabase/supabase-js";
import seed from "../data/creator_personas_seed.json";
import { initialCreators, type Creator } from "./creators";
import { getSupabase } from "./supabase/client";

// Reads creators from Supabase (creators + creator_financials). If Supabase isn't configured or
// the request fails, falls back to the bundled JSON so the site keeps working.
export type PersonaLite = { id: string; name: string; platform_followers: Record<string, number> };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// creators/creator_financials are public-read, so no sign-in is needed on the server.
async function reader() {
  if (typeof window !== "undefined") return (await getSupabase())?.sb ?? null;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

type Fin = { orders: number; discount: number; sp: number; cp: number; fee: number };

export async function fetchCreators(): Promise<Creator[]> {
  try {
    const sb = await reader();
    if (!sb) return initialCreators;
    const { data, error } = await sb
      .from("creators")
      .select("slug,name,niche,creator_financials!inner(orders,discount,sp,cp,fee)")
      .order("slug");
    if (error || !data) return initialCreators;
    if (data.length === 0) return [];
    // id = position (1-based), same as the bundled data: the optimizer and sample orders key off it.
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
  } catch {
    return initialCreators;
  }
}

export async function fetchPersona(slug: string): Promise<PersonaLite | null> {
  try {
    const sb = await reader();
    if (sb) {
      const { data, error } = await sb.from("creators").select("slug,name,platform_followers").eq("slug", slug).maybeSingle();
      if (!error && data) return { id: data.slug, name: data.name, platform_followers: data.platform_followers ?? {} };
      if (!error) return null; // reachable, and no such creator
    }
  } catch { }
  const p = seed.find(x => x.id === slug);
  return p ? { id: p.id, name: p.name, platform_followers: p.platform_followers as unknown as Record<string, number> } : null;
}
