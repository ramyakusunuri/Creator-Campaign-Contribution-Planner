import Link from "next/link";
import { notFound } from "next/navigation";
import { DEMO_CREATORS } from "../../../../lib/finder/demo-creators";
import PersonalizedPerformanceGraphs from "../../../../components/PersonalizedPerformanceGraphs";
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);
export function generateStaticParams(){return DEMO_CREATORS.map(c=>({id:c.demoId}));}
export default async function DemoCreatorProfile({params}:{params:{id:string}}){
 const c=DEMO_CREATORS.find(x=>x.demoId===params.id); if(!c) notFound();
 const baselineRevenue=c.monthlyOrders*c.averageOrderValue;
 const monthlyProfit=baselineRevenue*(1-c.productCostRate)-c.estimatedRate;
 return <main className="min-h-screen bg-[#f6f7fb] p-5 text-slate-900 sm:p-8"><div className="mx-auto max-w-5xl space-y-6">
  <Link href="/finder" className="text-sm font-semibold text-indigo-700 hover:underline">← Back to Influencer Finder</Link>
  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Presentation demo profile.</strong> This creator and all metrics are fictional sample data, not a real or verified social account.</div>
  <section className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 md:col-span-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{c.platform} · Demo creator</p><h1 className="mt-2 text-2xl font-bold">{c.displayName}</h1><p className="mt-1 text-sm text-slate-500">@{c.username}</p><p className="mt-3 text-sm text-slate-700">{c.niche} · fictional creator profile for campaign planning and judge presentation.</p><a className="mt-3 inline-block text-sm font-semibold text-indigo-700 hover:underline" href={c.profileUrl} target="_blank" rel="noreferrer">Example profile URL (not verified) ↗</a></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Audience size</p><p className="mt-2 text-2xl font-bold">{(c.followers ?? 0).toLocaleString("en-IN")}</p><p className="mt-1 text-sm text-slate-500">Estimated campaign fee: {money(c.estimatedRate)}</p></div></section>
  <section className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Baseline monthly orders</p><p className="mt-2 text-2xl font-bold">{c.monthlyOrders}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Baseline monthly revenue</p><p className="mt-2 text-2xl font-bold">{money(baselineRevenue)}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Estimated first-month profit</p><p className={`mt-2 text-2xl font-bold ${monthlyProfit<0?"text-rose-600":"text-emerald-700"}`}>{money(monthlyProfit)}</p></div></section>
  <PersonalizedPerformanceGraphs name={c.displayName} monthlyOrders={c.monthlyOrders} averageOrderValue={c.averageOrderValue} estimatedRate={c.estimatedRate} productCostRate={c.productCostRate} growthRate={c.growthRate}/>
 </div></main>;
}
