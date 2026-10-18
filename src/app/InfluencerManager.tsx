"use client";
import { FormEvent, useMemo, useState } from "react";
import { getSupabase } from "../lib/supabase/client";
import { useCreators } from "../lib/useCreators";
import { money } from "../lib/format";

const field = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500";
const initial = { name:"", niche:"", platform:"Instagram", followers:"", orders:"0", discount:"0", sp:"0", cp:"0", fee:"0", clicks:"0", buys:"0" };

export default function InfluencerManager() {
 const creators = useCreators();
 const [form,setForm] = useState(initial);
 const [busy,setBusy] = useState(false);
 const [message,setMessage] = useState("");
 const [error,setError] = useState("");
 const [open,setOpen] = useState(false);
 const slug = useMemo(()=>form.name.trim().toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,""),[form.name]);
 const update=(key:keyof typeof initial,value:string)=>setForm(old=>({...old,[key]:value}));
<<<<<<< HEAD

=======
>>>>>>> 645e923d9db1ddd99aa786db5a42fc0827f40359
 const submit=async(e:FormEvent)=>{
  e.preventDefault(); setMessage(""); setError("");
  if(!form.name.trim()||!form.niche.trim()){setError("Enter the influencer name and niche.");return;}
  if(creators.length>=20){setError("The exact campaign optimizer supports up to 20 influencers. Remove one before adding another.");return;}
  const nums=["followers","orders","discount","sp","cp","fee","clicks","buys"] as const;
  for(const key of nums){const n=Number(form[key]);if(!Number.isFinite(n)||n<0){setError(`${key} must be a non-negative number.`);return;}}
  if(Number(form.discount)>100){setError("Discount must be between 0 and 100.");return;}
  if(Number(form.buys)>Number(form.clicks)){setError("Buys cannot exceed clicks.");return;}
<<<<<<< HEAD

  setBusy(true);
  const base=slug || `influencer_${Date.now()}`;
  const creatorSlug=`${base}_${Date.now().toString().slice(-6)}`;

  try {
    // 1. Save directly into backend SQLite database
    const res = await fetch('/api/creators', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agency-Key': 'demo-agency-key'
      },
      body: JSON.stringify({
        name: form.name.trim(),
        category: form.niche.trim(),
        primary_platform: form.platform,
        followers: Number(form.followers),
        orders: Number(form.orders),
        discount: Number(form.discount),
        default_sp_inr: Number(form.sp),
        default_cp_inr: Number(form.cp),
        default_fee_inr: Number(form.fee),
        clicks: Number(form.clicks),
        buys: Number(form.buys),
        slug: creatorSlug,
        creator_id: creatorSlug
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Server returned ${res.status}`);
    }

    // 2. Also mirror to Supabase if configured
    try {
      const s = await getSupabase();
      if (s) {
        await s.sb.from("creators").insert({
          slug: creatorSlug, name: form.name.trim(), niche: form.niche.trim(), primary_platform: form.platform,
          platforms: [form.platform], followers: Number(form.followers), estimated_rate_inr: Number(form.fee),
          clicks: Number(form.clicks), buys: Number(form.buys), platform_followers: { [form.platform]: Number(form.followers) }
        });
        await s.sb.from("creator_financials").insert({
          creator_slug: creatorSlug, orders: Number(form.orders), discount: Number(form.discount),
          sp: Number(form.sp), cp: Number(form.cp), fee: Number(form.fee)
        });
      }
    } catch {}

    setBusy(false);
    setForm(initial);
    setMessage("Influencer added successfully.");
    window.location.reload();
  } catch (err: any) {
    setBusy(false);
    setError(`Could not add influencer: ${err.message}`);
  }
 };

 const remove=async(slug:string,name:string)=>{
  if(!window.confirm(`Remove ${name}? This deletes the influencer and their records from the database.`))return;
  setMessage("");setError("");

  try {
    // 1. Delete from backend SQLite database
    const res = await fetch(`/api/creators?slug=${encodeURIComponent(slug)}`, {
      method: 'DELETE',
      headers: { 'X-Agency-Key': 'demo-agency-key' }
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Server returned ${res.status}`);
    }

    // 2. Also delete from Supabase if configured
    try {
      const s = await getSupabase();
      if (s) await s.sb.from("creators").delete().eq("slug", slug);
    } catch {}

    setMessage(`${name} removed.`);
    window.location.reload();
  } catch (err: any) {
    setError(`Could not remove influencer: ${err.message}`);
  }
 };

 return <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Manage influencers</h2><p className="mt-1 text-sm text-slate-500">Add influencer records to the database or remove an existing record. Exact optimization supports up to 20 records.</p></div><button type="button" onClick={()=>setOpen(v=>!v)} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">{open?"Close form":"＋ Add influencer"}</button></div>
=======
  const s=await getSupabase();
  if(!s){setError("Supabase is not configured or anonymous sign-in failed. Check .env.local and enable anonymous sign-ins in Supabase.");return;}
  setBusy(true);
  const base=slug || `influencer_${Date.now()}`;
  const creatorSlug=`${base}_${Date.now().toString().slice(-6)}`;
  const {error:creatorError}=await s.sb.from("creators").insert({
   slug:creatorSlug,name:form.name.trim(),niche:form.niche.trim(),primary_platform:form.platform,
   platforms:[form.platform],followers:Number(form.followers),estimated_rate_inr:Number(form.fee),
   clicks:Number(form.clicks),buys:Number(form.buys),platform_followers:{[form.platform]:Number(form.followers)}
  });
  if(creatorError){setBusy(false);setError(`Could not add influencer: ${creatorError.message}`);return;}
  const {error:financialError}=await s.sb.from("creator_financials").insert({
   creator_slug:creatorSlug,orders:Number(form.orders),discount:Number(form.discount),
   sp:Number(form.sp),cp:Number(form.cp),fee:Number(form.fee)
  });
  if(financialError){
   await s.sb.from("creators").delete().eq("slug",creatorSlug);
   setBusy(false);setError(`Financial data could not be saved, so the influencer record was rolled back: ${financialError.message}`);return;
  }
  setBusy(false);setForm(initial);setMessage("Influencer added successfully.");window.location.reload();
 };
 const remove=async(slug:string,name:string)=>{
  if(!window.confirm(`Remove ${name}? This deletes the influencer and their financial record from the shared database.`))return;
  setMessage("");setError("");
  const s=await getSupabase();if(!s){setError("Supabase connection unavailable.");return;}
  const {error}=await s.sb.from("creators").delete().eq("slug",slug);
  if(error){setError(`Could not remove influencer: ${error.message}`);return;}
  setMessage(`${name} removed.`);window.location.reload();
 };
 return <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Manage influencers</h2><p className="mt-1 text-sm text-slate-500">Add influencer records to Supabase or remove an existing record. Exact optimization supports up to 20 records.</p></div><button type="button" onClick={()=>setOpen(v=>!v)} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">{open?"Close form":"＋ Add influencer"}</button></div>
>>>>>>> 645e923d9db1ddd99aa786db5a42fc0827f40359
  {message&&<p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
  {error&&<p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
  {open&&<form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
   <label className="text-sm font-medium">Influencer name<input className={field+" mt-1"} value={form.name} onChange={e=>update("name",e.target.value)} required maxLength={100} placeholder="e.g. Riya Sharma"/></label>
   <label className="text-sm font-medium">Niche / category<input className={field+" mt-1"} value={form.niche} onChange={e=>update("niche",e.target.value)} required maxLength={80} placeholder="e.g. Fashion"/></label>
   <label className="text-sm font-medium">Primary platform<select className={field+" mt-1"} value={form.platform} onChange={e=>update("platform",e.target.value)}><option>Instagram</option><option>YouTube</option><option>Facebook</option><option>TikTok</option><option>Other</option></select></label>
   <label className="text-sm font-medium">Followers<input type="number" min="0" step="1" className={field+" mt-1"} value={form.followers} onChange={e=>update("followers",e.target.value)} required/></label>
   <label className="text-sm font-medium">Tracked orders<input type="number" min="0" step="1" className={field+" mt-1"} value={form.orders} onChange={e=>update("orders",e.target.value)} required/></label>
   <label className="text-sm font-medium">Discount (%)<input type="number" min="0" max="100" step="0.1" className={field+" mt-1"} value={form.discount} onChange={e=>update("discount",e.target.value)} required/></label>
   <label className="text-sm font-medium">Average selling price (₹)<input type="number" min="0" step="0.01" className={field+" mt-1"} value={form.sp} onChange={e=>update("sp",e.target.value)} required/></label>
   <label className="text-sm font-medium">Average product cost (₹)<input type="number" min="0" step="0.01" className={field+" mt-1"} value={form.cp} onChange={e=>update("cp",e.target.value)} required/></label>
   <label className="text-sm font-medium">Creator campaign fee (₹)<input type="number" min="0" step="0.01" className={field+" mt-1"} value={form.fee} onChange={e=>update("fee",e.target.value)} required/></label>
   <label className="text-sm font-medium">Link clicks<input type="number" min="0" step="1" className={field+" mt-1"} value={form.clicks} onChange={e=>update("clicks",e.target.value)} required/></label>
   <label className="text-sm font-medium">Buys from clicks<input type="number" min="0" step="1" className={field+" mt-1"} value={form.buys} onChange={e=>update("buys",e.target.value)} required/></label>
   <div className="flex items-end"><button disabled={busy} className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy?"Saving…":"Save influencer"}</button></div>
<<<<<<< HEAD
   <p className="sm:col-span-2 lg:col-span-3 text-xs leading-5 text-slate-500">Estimated profit = orders × (selling price × (1 − discount / 100) − product cost) − creator fee. Records are persisted to the database.</p>
=======
   <p className="sm:col-span-2 lg:col-span-3 text-xs leading-5 text-slate-500">Estimated profit = orders × (selling price × (1 − discount / 100) − product cost) − creator fee. This is shared reference data; see the security note in README before deploying publicly.</p>
>>>>>>> 645e923d9db1ddd99aa786db5a42fc0827f40359
  </form>}
  <div className="mt-5 divide-y divide-slate-100">{creators.map(c=><div key={c.slug} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{c.name}</p><p className="text-xs text-slate-500">{c.category} · {c.orders.toLocaleString("en-IN")} orders · fee {money(c.fee)}</p></div><button type="button" onClick={()=>remove(c.slug,c.name)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50">Remove</button></div>)}</div>
 </section>;
}
