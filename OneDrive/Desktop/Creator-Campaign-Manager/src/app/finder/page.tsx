"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { FoundCreator, Platform } from "../../lib/finder/types";
import { NICHES } from "../../lib/finder/niche";
import { compact } from "../../lib/format";
import { loadShortlist, addShortlist, removeShortlist } from "../../lib/store";
import { DEMO_CREATORS } from "../../lib/finder/demo-creators";

const idOf = (c: FoundCreator) => `${c.platform}:${c.username.toLowerCase()}`;
const followersText = (n: number | null) => (n === null ? "Hidden" : compact(n));

export default function Finder() {
  const [tab, setTab] = useState<Platform>("youtube");
  const [keyword, setKeyword] = useState("");
  const [region, setRegion] = useState("IN");
  const [usernames, setUsernames] = useState("");
  const [results, setResults] = useState<FoundCreator[]>(DEMO_CREATORS.filter(c => c.platform === "youtube"));
  const [demoMode, setDemoMode] = useState(true);
  const [failed, setFailed] = useState<{ username: string; reason: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [minF, setMinF] = useState("");
  const [maxF, setMaxF] = useState("");
  const [niche, setNiche] = useState("All");
  const [shortlist, setShortlist] = useState<FoundCreator[]>([]);

  useEffect(() => { loadShortlist().then(setShortlist); }, []);
  const toggle = (c: FoundCreator) => {
    const on = shortlist.some(s => idOf(s) === idOf(c));
    setShortlist(on ? shortlist.filter(s => idOf(s) !== idOf(c)) : [...shortlist, c]);
    if (on) removeShortlist(c); else addShortlist(c);
  };

  async function run() {
    setLoading(true); setError(""); setFailed([]); setDemoMode(false);
    try {
      const qs = tab === "youtube" ? `youtube?q=${encodeURIComponent(keyword)}&region=${encodeURIComponent(region)}` : `instagram?usernames=${encodeURIComponent(usernames)}`;
      const res = await fetch(`/api/finder/${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResults(data.creators ?? []); setFailed(data.failed ?? []);
    } catch (e) { setResults([]); setError(e instanceof Error ? e.message : "Request failed"); }
    setLoading(false);
  }

  // Filtered list, highest followers first.
  const shown = useMemo(() => {
    const lo = minF ? Number(minF) : 0, hi = maxF ? Number(maxF) : Infinity;
    return results
      .filter(c => (niche === "All" || c.niche === niche) && c.followers !== null && c.followers >= lo && c.followers <= hi)
      .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0));
  }, [results, minF, maxF, niche]);

  const card = "rounded-2xl border border-slate-200 bg-white p-5";
  const field = "rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500";
  return <main className="min-h-screen bg-[#f6f7fb] p-5 text-slate-900 sm:p-8"><div className="mx-auto max-w-5xl space-y-6">
    <Link href="/" className="text-sm font-semibold text-indigo-700 hover:underline">← Back to overview</Link>
    <div><h1 className="text-2xl font-bold">Influencer Finder</h1><p className="mt-1 text-sm text-slate-500">Presentation-ready finder with 15 fictional demo creators per platform. Live API lookup is also available when API credentials are configured.</p></div>

    <section className={card}>
      <div className="flex gap-2" role="tablist">{(["youtube", "instagram"] as Platform[]).map(p => <button key={p} role="tab" aria-selected={tab === p} onClick={() => { setTab(p); setResults(DEMO_CREATORS.filter(c => c.platform === p)); setDemoMode(true); setFailed([]); setError(""); }} className={`rounded-xl border px-4 py-2 text-sm font-semibold capitalize ${tab === p ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 hover:bg-slate-50"}`}>{p}</button>)}</div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${demoMode ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{demoMode ? "Demo data · fictional creators" : "Live API results"}</span><button type="button" onClick={() => { setResults(DEMO_CREATORS.filter(c => c.platform === tab)); setDemoMode(true); setFailed([]); setError(""); }} className="rounded-xl border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">Load presentation demo</button></div>
      {tab === "youtube"
        ? <form onSubmit={e => { e.preventDefault(); run(); }} className="mt-4 flex flex-wrap gap-3"><input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Keyword, e.g. skincare routine" className={`${field} min-w-[240px] flex-1`} aria-label="Keyword" /><input value={region} onChange={e => setRegion(e.target.value.toUpperCase().slice(0, 2))} placeholder="IN" className={`${field} w-20`} aria-label="Country code" /><button disabled={loading || keyword.trim().length < 2} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Searching…" : "Discover channels"}</button></form>
        : <form onSubmit={e => { e.preventDefault(); run(); }} className="mt-4 space-y-3"><textarea value={usernames} onChange={e => setUsernames(e.target.value)} rows={3} placeholder="Usernames separated by commas or spaces (max 10), e.g. @bluebottle, natgeo" className={`${field} w-full`} aria-label="Instagram usernames" /><p className="text-xs text-slate-500">Instagram cannot be searched by keyword. Business Discovery only looks up usernames you already know, and only for Business/Creator accounts.</p><button disabled={loading || !usernames.trim()} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Looking up…" : "Look up accounts"}</button></form>}
      {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}
    </section>

    {results.length > 0 && <section className={card}>
      <div className="flex flex-wrap items-center gap-3"><span className="text-sm font-semibold">Filters</span><input type="number" min={0} value={minF} onChange={e => setMinF(e.target.value)} placeholder="Min followers" className={`${field} w-36`} aria-label="Minimum followers" /><input type="number" min={0} value={maxF} onChange={e => setMaxF(e.target.value)} placeholder="Max followers" className={`${field} w-36`} aria-label="Maximum followers" /><select value={niche} onChange={e => setNiche(e.target.value)} className={field} aria-label="Niche"><option>All</option>{NICHES.map(n => <option key={n}>{n}</option>)}</select><span className="ml-auto text-xs text-slate-500">Highest followers first · {shown.length} of {results.length}</span></div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Username</th><th className="px-3 py-3">Platform</th><th className="px-3 py-3 text-right">Followers</th><th className="px-3 py-3">Niche</th><th className="px-3 py-3 text-right">Est. campaign fee</th><th className="px-3 py-3 text-right">Shortlist</th></tr></thead><tbody>{shown.map(c => { const on = shortlist.some(s => idOf(s) === idOf(c)); return <tr key={idOf(c)} className="border-b border-slate-100"><td className="px-3 py-3"><div className="font-semibold">{c.displayName || c.username}</div><a href={c.profileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-700 hover:underline">@{c.username}</a>{c.demoId && <Link href={`/finder/demo/${c.demoId}`} className="ml-2 inline-block rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">View profile ↗</Link>}</td><td className="px-3 py-3 capitalize">{c.platform}</td><td className="px-3 py-3 text-right font-semibold">{followersText(c.followers)}</td><td className="px-3 py-3">{c.niche}</td><td className="px-3 py-3 text-right">{c.estimatedRate ? `₹${c.estimatedRate.toLocaleString("en-IN")}` : "—"}</td><td className="px-3 py-3 text-right"><button onClick={() => toggle(c)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 hover:bg-slate-50"}`}>{on ? "Added ✓" : "Add"}</button></td></tr>; })}{shown.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No results match these filters.</td></tr>}</tbody></table></div>
      {failed.length > 0 && <ul className="mt-4 space-y-1 text-xs text-amber-800">{failed.map(f => <li key={f.username}>@{f.username}: {f.reason}</li>)}</ul>}
    </section>}

    <section className={card}>
      <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">Shortlist</h2><span className="text-xs text-slate-500">Saved to your account · entries expire after 30 days</span></div>
      {shortlist.length === 0 ? <p className="mt-3 text-sm text-slate-500">Nothing yet. Add creators from the results above.</p> : <ul className="mt-3 divide-y divide-slate-100">{[...shortlist].sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0)).map(c => <li key={idOf(c)} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><a href={c.profileUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-700 hover:underline">{c.displayName || c.username}</a><span className="ml-2 text-xs capitalize text-slate-500">{c.platform} · {c.niche}</span></div><div className="flex items-center gap-4"><span className="font-semibold">{followersText(c.followers)}</span><button onClick={() => toggle(c)} className="text-xs font-semibold text-rose-600 hover:underline">Remove</button></div></li>)}</ul>}
    </section>
  </div></main>;
}
