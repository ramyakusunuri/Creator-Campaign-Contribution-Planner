import { getSupabase } from "./supabase/client";
import { BUDGET_KEY } from "./creators";
import type { FoundCreator } from "./finder/types";

// Persistence layer: Supabase when configured, localStorage as mirror/fallback.
const SHORTLIST_KEY = "finder-shortlist-v1";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // matches the 30-day retention rule in the database

const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };
const lsDel = (k: string) => { try { localStorage.removeItem(k); } catch {} };

// ---- Budget ----------------------------------------------------------------
export async function loadBudget(): Promise<number | null> {
  const s = await getSupabase();
  if (s) {
    const { data } = await s.sb.from("campaign_settings").select("budget").maybeSingle();
    if (data && Number(data.budget) > 0) return Number(data.budget);
  }
  const v = Number(lsGet(BUDGET_KEY));
  return v > 0 ? v : null;
}

let budgetTimer: ReturnType<typeof setTimeout> | undefined;
export function saveBudget(v: number) {
  lsSet(BUDGET_KEY, String(v));
  if (!(v > 0)) return;
  clearTimeout(budgetTimer); // the budget input fires on every keystroke
  budgetTimer = setTimeout(async () => {
    const s = await getSupabase();
    if (s) await s.sb.from("campaign_settings").upsert({ user_id: s.uid, budget: v, updated_at: new Date().toISOString() });
  }, 500);
}

// ---- Coupon codes ----------------------------------------------------------
export async function loadCoupon(creatorSlug: string): Promise<string | null> {
  const s = await getSupabase();
  if (s) {
    const { data } = await s.sb.from("coupon_codes").select("code").eq("creator_slug", creatorSlug).maybeSingle();
    if (data?.code) return data.code;
  }
  return lsGet(`coupon:${creatorSlug}`);
}

const couponTimers: Record<string, ReturnType<typeof setTimeout>> = {};
export function saveCoupon(creatorSlug: string, code: string) {
  if (code) lsSet(`coupon:${creatorSlug}`, code); else lsDel(`coupon:${creatorSlug}`);
  clearTimeout(couponTimers[creatorSlug]);
  couponTimers[creatorSlug] = setTimeout(async () => {
    const s = await getSupabase();
    if (!s) return;
    if (!code) await s.sb.from("coupon_codes").delete().eq("creator_slug", creatorSlug); // empty = back to the derived default
    else await s.sb.from("coupon_codes").upsert({ user_id: s.uid, creator_slug: creatorSlug, code, updated_at: new Date().toISOString() });
  }, 500);
}

// ---- Finder shortlist ------------------------------------------------------
const fresh = (c: FoundCreator) => Date.now() - new Date(c.fetchedAt).getTime() < MAX_AGE_MS;
const localShortlist = (): FoundCreator[] => { try { return (JSON.parse(lsGet(SHORTLIST_KEY) ?? "[]") as FoundCreator[]).filter(fresh); } catch { return []; } };
const keyOf = (c: Pick<FoundCreator, "platform" | "username">) => `${c.platform}:${c.username.toLowerCase()}`;

export async function loadShortlist(): Promise<FoundCreator[]> {
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
  return localShortlist();
}

export async function addShortlist(c: FoundCreator) {
  lsSet(SHORTLIST_KEY, JSON.stringify([...localShortlist().filter(x => keyOf(x) !== keyOf(c)), c]));
  const s = await getSupabase();
  if (s) await s.sb.from("finder_shortlist").upsert(
    { user_id: s.uid, platform: c.platform, username: c.username, followers: c.followers, niche: c.niche, profile_url: c.profileUrl, fetched_at: c.fetchedAt },
    { onConflict: "user_id,platform,username_key" },
  );
}

export async function removeShortlist(c: FoundCreator) {
  lsSet(SHORTLIST_KEY, JSON.stringify(localShortlist().filter(x => keyOf(x) !== keyOf(c))));
  const s = await getSupabase();
  if (s) await s.sb.from("finder_shortlist").delete().eq("platform", c.platform).eq("username_key", c.username.toLowerCase());
}
