"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { initialCreators, profit, optimize, DEFAULT_BUDGET, BUDGET_KEY } from "../../lib/creators";
import { money, shortMoney } from "../../lib/format";

export default function Calculator(){
 const [budget,setBudget]=useState(DEFAULT_BUDGET);
 useEffect(()=>{try{const v=Number(localStorage.getItem(BUDGET_KEY));if(v>0)setBudget(v);}catch{}},[]);
 const change=(v:number)=>{setBudget(v);try{localStorage.setItem(BUDGET_KEY,String(v));}catch{}};
 const rec=useMemo(()=>optimize(initialCreators,budget),[budget]);
 return <main className="min-h-screen bg-[#f6f7fb] p-5 text-slate-900 sm:p-8"><div className="mx-auto max-w-3xl space-y-6">
  <Link href="/" className="text-sm font-semibold text-indigo-700 hover:underline">← Back to overview</Link>
  <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h1 className="text-2xl font-bold">Campaign Calculator</h1><p className="mt-1 text-sm text-slate-500">Set the maximum creator-fee budget. The overview uses this budget to pick the best combination.</p>
   <label className="mt-5 flex flex-wrap items-center gap-3 text-sm font-semibold">Budget (₹)<input type="number" min="0" step="50000" value={budget} onChange={e=>change(Math.max(0,Number(e.target.value)||0))} className="w-44 rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-indigo-500"/></label>
   <button onClick={()=>change(DEFAULT_BUDGET)} className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Reset to {money(DEFAULT_BUDGET)}</button></section>
  <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><p className="text-sm font-medium text-indigo-600">Best combination for this budget</p>
   <div className="mt-4 grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Creators</p><p className="mt-1 text-2xl font-bold">{rec.creators.length}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Creator fees</p><p className="mt-1 text-2xl font-bold">{shortMoney(rec.spend)}</p></div><div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs text-emerald-800">Est. profit</p><p className="mt-1 text-2xl font-bold text-emerald-700">{shortMoney(rec.profit)}</p></div></div>
   <ul className="mt-5 space-y-2">{rec.creators.map(c=><li key={c.id} className="flex justify-between rounded-xl border border-slate-100 px-4 py-3 text-sm"><Link href={`/influencer/${c.slug}`} className="font-semibold text-indigo-700 hover:underline">{c.name}</Link><span className="text-slate-500">Fee {shortMoney(c.fee)} · Profit {shortMoney(profit(c))}</span></li>)}{rec.creators.length===0&&<li className="text-sm text-slate-500">No creator fits within this budget.</li>}</ul>
   <p className="mt-4 text-sm text-slate-500">Budget remaining: {money(budget-rec.spend)}</p></section>
 </div></main>;
}
