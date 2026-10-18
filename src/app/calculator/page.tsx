"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { initialCreators, categories, profit, optimizeRange, DEFAULT_BUDGET, BUDGET_KEY } from "../../lib/creators";
import { money, shortMoney } from "../../lib/format";

type SortBy = "profit" | "cost";
const MAX_CREATORS = initialCreators.length;
const toCount = (v: string) => Math.min(MAX_CREATORS, Math.max(0, Math.floor(Number(v) || 0)));

export default function Calculator(){
 const [budget,setBudget]=useState(DEFAULT_BUDGET);
 const [min,setMin]=useState(1);
 const [max,setMax]=useState(MAX_CREATORS);
 const [category,setCategory]=useState("All");
 const [sortBy,setSortBy]=useState<SortBy>("profit");
 useEffect(()=>{try{const v=Number(localStorage.getItem(BUDGET_KEY));if(v>0)setBudget(v);}catch{}},[]);
 const changeBudget=(v:number)=>{setBudget(v);try{localStorage.setItem(BUDGET_KEY,String(v));}catch{}};
 // Keep min <= max: raising min past max lifts max; lowering max below min lowers min.
 const changeMin=(v:number)=>{setMin(v);if(v>max)setMax(v);};
 const changeMax=(v:number)=>{setMax(v);if(v<min)setMin(v);};

 const eligible=useMemo(()=>initialCreators.filter(c=>category==="All"||c.category===category),[category]);
 const rec=useMemo(()=>optimizeRange(eligible,budget,Math.max(1,min),max),[eligible,budget,min,max]);
 // List runs from highest to lowest on the chosen measure.
 const list=useMemo(()=>rec?[...rec.creators].sort((a,b)=>sortBy==="profit"?profit(b)-profit(a):b.fee-a.fee):[],[rec,sortBy]);

 const card="rounded-2xl border border-slate-200 bg-white p-5";
 const input="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-2xl font-bold outline-none focus:border-indigo-500";
 return <main className="min-h-screen bg-[#f6f7fb] p-5 text-slate-900 sm:p-8"><div className="mx-auto max-w-4xl space-y-6">
  <Link href="/" className="text-sm font-semibold text-indigo-700 hover:underline">← Back to overview</Link>
  <div><h1 className="text-2xl font-bold">Campaign Calculator</h1><p className="mt-1 text-sm text-slate-500">Set your limits and filters. The calculator picks the highest-profit combination that fits them.</p></div>

  <section className="grid gap-4 sm:grid-cols-3">
   <label className={card}><span className="text-sm text-slate-500">Minimum influencers</span><input type="number" min={0} max={MAX_CREATORS} value={min} onChange={e=>changeMin(toCount(e.target.value))} className={input}/></label>
   <label className={card}><span className="text-sm text-slate-500">Maximum influencers</span><input type="number" min={0} max={MAX_CREATORS} value={max} onChange={e=>changeMax(toCount(e.target.value))} className={input}/></label>
   <label className={card}><span className="text-sm text-slate-500">Budget (₹)</span><input type="number" min={0} step={50000} value={budget} onChange={e=>changeBudget(Math.max(0,Number(e.target.value)||0))} className={input}/></label>
  </section>

  <section className="grid gap-4 sm:grid-cols-2">
   <label className={card}><span className="text-sm text-slate-500">Type of creator</span><select value={category} onChange={e=>setCategory(e.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-semibold outline-none focus:border-indigo-500"><option>All</option>{categories.map(k=><option key={k}>{k}</option>)}</select></label>
   <div className={card}><span className="text-sm text-slate-500">Rank list by</span><div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Rank list by">{(["profit","cost"] as SortBy[]).map(k=><button key={k} role="radio" aria-checked={sortBy===k} onClick={()=>setSortBy(k)} className={`rounded-xl border px-3 py-2.5 font-semibold capitalize ${sortBy===k?"border-indigo-600 bg-indigo-600 text-white":"border-slate-200 hover:bg-slate-50"}`}>{k}</button>)}</div></div>
  </section>

  <section className={card+" sm:p-6"}>
   <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl font-bold">Recommended influencers</h2><p className="text-sm text-slate-500">Highest to lowest {sortBy}{category!=="All"?` · ${category}`:""}</p></div>
   {!rec?<p className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">No combination of {Math.max(1,min)}–{max} {category==="All"?"":category+" "}influencers fits within {money(budget)}. Lower the minimum, raise the budget, or change the type.</p>:<>
    <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Influencers</p><p className="mt-1 text-2xl font-bold">{rec.creators.length}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Total cost (fees)</p><p className="mt-1 text-2xl font-bold">{shortMoney(rec.spend)}</p></div><div className={`rounded-xl p-4 ${rec.profit>=0?"bg-emerald-50":"bg-rose-50"}`}><p className="text-xs text-slate-500">Total est. profit</p><p className={`mt-1 text-2xl font-bold ${rec.profit>=0?"text-emerald-700":"text-rose-600"}`}>{shortMoney(rec.profit)}</p></div></div>
    <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">#</th><th className="px-3 py-3">Influencer</th><th className={`px-3 py-3 text-right ${sortBy==="cost"?"text-indigo-700":""}`}>Cost (fee){sortBy==="cost"?" ↓":""}</th><th className={`px-3 py-3 text-right ${sortBy==="profit"?"text-indigo-700":""}`}>Est. profit{sortBy==="profit"?" ↓":""}</th></tr></thead><tbody>{list.map((c,i)=><tr key={c.id} className="border-b border-slate-100"><td className="px-3 py-3 text-slate-400">{i+1}</td><td className="px-3 py-3"><Link href={`/influencer/${c.slug}`} className="font-semibold text-indigo-700 hover:underline">{c.name}</Link><p className="text-xs text-slate-500">{c.category}</p></td><td className="px-3 py-3 text-right">{shortMoney(c.fee)}</td><td className={`px-3 py-3 text-right font-semibold ${profit(c)>=0?"text-emerald-700":"text-rose-600"}`}>{shortMoney(profit(c))}</td></tr>)}</tbody></table></div>
    <p className="mt-4 text-sm text-slate-500">Budget remaining: {money(budget-rec.spend)} · {eligible.length} {category==="All"?"":category+" "}influencers available</p></>}
  </section>
 </div></main>;
}
