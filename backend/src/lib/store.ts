import { getSupabase } from "./supabase/client";
import { BUDGET_KEY } from "./creators";
import type { FoundCreator } from "./finder/types";

<<<<<<< HEAD
// Persistence layer: Real backend API / SQLite database, with Supabase when configured and localStorage as mirror/fallback.
const SHORTLIST_KEY = "finder-shortlist-v1";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
=======
// Persistence layer: Supabase when configured, localStorage as mirror/fallback.
const SHORTLIST_KEY = "finder-shortlist-v1";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // matches the 30-day retention rule in the database
>>>>>>> 7f23eb20e1f19260431b3724a9dc13637d5cc50f

const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };
const lsDel = (k: string) => { try { localStorage.removeItem(k); } catch {} };

// ---- Budget ----------------------------------------------------------------
export async function loadBudget(): Promise<number | null> {
<<<<<<< HEAD
  // 1. Try local native backend API
  try {
    if (typeof window !== "undefined") {
      const res = await fetch('/api/settings/budget');
      if (res.ok) {
        const data = await res.json();
        if (data && Number(data.budget) > 0) {
          lsSet(BUDGET_KEY, String(data.budget));
          return Number(data.budget);
        }
      }
    }
  } catch {}

  // 2. Try Supabase if configured
  try {
    const s = await getSupabase();
    if (s) {
      const { data } = await s.sb.from("campaign_settings").select("budget").maybeSingle();
      if (data && Number(data.budget) > 0) return Number(data.budget);
    }
  } catch {}

  // 3. Fallback to localStorage
=======
  const s = await getSupabase();
  if (s) {
    const { data } = await s.sb.from("campaign_settings").select("budget").maybeSingle();
    if (data && Number(data.budget) > 0) return Number(data.budget);
  }
>>>>>>> 7f23eb20e1f19260431b3724a9dc13637d5cc50f
  const v = Number(lsGet(BUDGET_KEY));
  return v > 0 ? v : null;
}

let budgetTimer: ReturnType<typeof setTimeout> | undefined;
export function saveBudget(v: number) {
  lsSet(BUDGET_KEY, String(v));
  if (!(v > 0)) return;
<<<<<<< HEAD

  clearTimeout(budgetTimer);
  budgetTimer = setTimeout(async () => {
    // 1. Save to native backend SQLite
    try {
      await fetch('/api/settings/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget: v })
      });
    } catch {}

    // 2. Also save to Supabase if configured
    try {
      const s = await getSupabase();
      if (s) await s.sb.from("campaign_settings").upsert({ user_id: s.uid, budget: v, updated_at: new Date().toISOString() });
    } catch {}
=======
  clearTimeout(budgetTimer); // the budget input fires on every keystroke
  budgetTimer = setTimeout(async () => {
    const s = await getSupabase();
    if (s) await s.sb.from("campaign_settings").upsert({ user_id: s.uid, budget: v, updated_at: new Date().toISOString() });
>>>>>>> 7f23eb20e1f19260431b3724a9dc13637d5cc50f
  }, 500);
}

// ---- Coupon codes ----------------------------------------------------------
export async function loadCoupon(creatorSlug: string): Promise<string | null> {
<<<<<<< HEAD
  try {
    const s = await getSupabase();
    if (s) {
      const { data } = await s.sb.from("coupon_codes").select("code").eq("creator_slug", creatorSlug).maybeSingle();
      if (data?.code) return data.code;
    }
  } catch {}
=======
  const s = await getSupabase();
  if (s) {
    const { data } = await s.sb.from("coupon_codes").select("code").eq("creator_slug", creatorSlug).maybeSingle();
    if (data?.code) return data.code;
  }
>>>>>>> 7f23eb20e1f19260431b3724a9dc13637d5cc50f
  return lsGet(`coupon:${creatorSlug}`);
}

const couponTimers: Record<string, ReturnType<typeof setTimeout>> = {};
export function saveCoupon(creatorSlug: string, code: string) {
  if (code) lsSet(`coupon:${creatorSlug}`, code); else lsDel(`coupon:${creatorSlug}`);
  clearTimeout(couponTimers[creatorSlug]);
  couponTimers[creatorSlug] = setTimeout(async () => {
<<<<<<< HEAD
    // 1. Register with backend promo code system
    if (code && code.length >= 3) {
      try {
        await fetch('/api/brands/B1/promo-codes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Brand-Key': 'demo-brand-key-b1'
          },
          body: JSON.stringify({
            code,
            creator_id: creatorSlug,
            starts_at: '2026-01-01T00:00:00.000Z',
            expires_at: '2026-12-31T23:59:59.000Z'
          })
        });
      } catch {}
    }

    // 2. Also save to Supabase if configured
    try {
      const s = await getSupabase();
      if (!s) return;
      if (!code) await s.sb.from("coupon_codes").delete().eq("creator_slug", creatorSlug);
      else await s.sb.from("coupon_codes").upsert({ user_id: s.uid, creator_slug: creatorSlug, code, updated_at: new Date().toISOString() });
    } catch {}
=======
    const s = await getSupabase();
    if (!s) return;
    if (!code) await s.sb.from("coupon_codes").delete().eq("creator_slug", creatorSlug); // empty = back to the derived default
    else await s.sb.from("coupon_codes").upsert({ user_id: s.uid, creator_slug: creatorSlug, code, updated_at: new Date().toISOString() });
>>>>>>> 7f23eb20e1f19260431b3724a9dc13637d5cc50f
  }, 500);
}

// ---- Finder shortlist ------------------------------------------------------
const fresh = (c: FoundCreator) => Date.now() - new Date(c.fetchedAt).getTime() < MAX_AGE_MS;
const localShortlist = (): FoundCreator[] => { try { return (JSON.parse(lsGet(SHORTLIST_KEY) ?? "[]") as FoundCreator[]).filter(fresh); } catch { return []; } };
const keyOf = (c: Pick<FoundCreator, "platform" | "username">) => `${c.platform}:${c.username.toLowerCase()}`;

export async function loadShortlist(): Promise<FoundCreator[]> {
<<<<<<< HEAD
  // 1. Try local native backend SQLite shortlist
  try {
    if (typeof window !== "undefined") {
      const res = await fetch('/api/finder/shortlist');
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          lsSet(SHORTLIST_KEY, JSON.stringify(list));
          return list;
        }
      }
    }
  } catch {}

  // 2. Try Supabase if configured
  try {
    const s = await getSupabase();
    if (s) {
      const { data, error } = await s.sb.from("finder_shortlist").select("platform,username,followers,niche,profile_url,fetched_at");
      if (!error && data) {
        const list: FoundCreator[] = data.map(r => ({
          platform: r.platform, username: r.username, followers: r.followers, niche: r.niche,
          profileUrl: r.profile_url, fetchedAt: r.fetched_at,
        }));
        lsSet(SHORTLIST_KEY, JSON.stringify(list));
        return list;
      }
    }
  } catch {}

  // 3. Fallback to localStorage
=======
  const s = await getSupabase();
  if (s) {
    const { data, error } = await s.sb.from("finder_shortlist").select("platform,username,followers,niche,profile_url,fetched_at");
    if (!error && data) {
      const list: FoundCreator[] = data.map(r => ({
        platform: r.platform, username: r.username, followers: r.followers, niche: r.niche,
        profileUrl: r.profile_url, fetchedAt: r.fetched_at,
      }));
      lsSet(SHORTLIST_KEY, JSON.stringify(list));
      return list;
    }
  }
>>>>>>> 7f23eb20e1f19260431b3724a9dc13637d5cc50f
  return localShortlist();
}

export async function addShortlist(c: FoundCreator) {
  lsSet(SHORTLIST_KEY, JSON.stringify([...localShortlist().filter(x => keyOf(x) !== keyOf(c)), c]));
<<<<<<< HEAD

  // 1. Save to native backend SQLite
  try {
    await fetch('/api/finder/shortlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c)
    });
  } catch {}

  // 2. Also save to Supabase if configured
  try {
    const s = await getSupabase();
    if (s) await s.sb.from("finder_shortlist").upsert(
      { user_id: s.uid, platform: c.platform, username: c.username, followers: c.followers, niche: c.niche, profile_url: c.profileUrl, fetched_at: c.fetchedAt },
      { onConflict: "user_id,platform,username_key" },
    );
  } catch {}
=======
  const s = await getSupabase();
  if (s) await s.sb.from("finder_shortlist").upsert(
    { user_id: s.uid, platform: c.platform, username: c.username, followers: c.followers, niche: c.niche, profile_url: c.profileUrl, fetched_at: c.fetchedAt },
    { onConflict: "user_id,platform,username_key" },
  );
>>>>>>> 7f23eb20e1f19260431b3724a9dc13637d5cc50f
}

export async function removeShortlist(c: FoundCreator) {
  lsSet(SHORTLIST_KEY, JSON.stringify(localShortlist().filter(x => keyOf(x) !== keyOf(c))));
<<<<<<< HEAD

  // 1. Delete from native backend SQLite
  try {
    await fetch(`/api/finder/shortlist?platform=${encodeURIComponent(c.platform)}&username=${encodeURIComponent(c.username)}`, {
      method: 'DELETE'
    });
  } catch {}

  // 2. Also delete from Supabase if configured
  try {
    const s = await getSupabase();
    if (s) await s.sb.from("finder_shortlist").delete().eq("platform", c.platform).eq("username_key", c.username.toLowerCase());
  } catch {}
=======
  const s = await getSupabase();
  if (s) await s.sb.from("finder_shortlist").delete().eq("platform", c.platform).eq("username_key", c.username.toLowerCase());
>>>>>>> 7f23eb20e1f19260431b3724a9dc13637d5cc50f
}
