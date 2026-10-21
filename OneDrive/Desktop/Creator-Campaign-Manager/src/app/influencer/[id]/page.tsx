import { notFound } from "next/navigation";
import { couponFor } from "../../../lib/creators";
import { fetchCreators, fetchPersona } from "../../../lib/creators-db";
import CouponEditor from "./CouponEditor";
import { ordersFor, statsFor } from "../../../lib/orders";
import { money, shortMoney, compact } from "../../../lib/format";
import PersonalizedPerformanceGraphs from "../../../components/PersonalizedPerformanceGraphs";

export const revalidate=60; // re-read the database at most once a minute
export async function generateStaticParams(){return (await fetchCreators()).map(c=>({id:c.slug}));}

export default async function InfluencerProfile({params}:{params:{id:string}}){
 const c=(await fetchCreators()).find(x=>x.slug===params.id);const p=await fetchPersona(params.id);
 if(!c||!p)notFound();
 const orders=ordersFor(c);const s=statsFor(c,orders);
 const stats:[string,string][]=[
  ["Total orders by coupon code",s.total.toLocaleString("en-IN")],
  ["Influencer cost per item",c.orders > 0 ? money(c.fee / c.orders) : "N/A"],
  ["Orders returned",s.returned.toLocaleString("en-IN")],
  ["Total sale",money(s.totalSale)],
  ["Net profit by influencer",shortMoney(s.netProfit)],
  ["Return rate",`${s.returnRate.toFixed(1)}%`],
  ["AOV",money(Math.round(s.aov))],
  ["Reorder",s.reorder.toLocaleString("en-IN")],
 ];
 return <main className="min-h-screen bg-[#f6f7fb] p-5 text-slate-900 sm:p-8"><div className="mx-auto max-w-5xl space-y-6">
  <section className="grid gap-4 md:grid-cols-3">
   <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Name / Id</p><h1 className="mt-2 text-2xl font-bold">{c.name}</h1><p className="mt-1 text-sm text-slate-500">{p.id}</p></div>
   <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Coupon code</p><CouponEditor creatorId={c.slug} initial={couponFor(c)}/></div>
   <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Social platforms</p><ul className="mt-2 space-y-1.5">{Object.entries(p.platform_followers).map(([name,n])=><li key={name} className="flex items-baseline justify-between gap-3"><span className="text-sm font-medium text-slate-700">{name}</span><span className="text-lg font-bold">{compact(n)}</span></li>)}</ul></div>
  </section>
  <section className="rounded-2xl border border-slate-200 bg-white"><div className="overflow-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="sticky top-0 bg-white"><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Name of person / Customer Id</th><th className="px-4 py-3">Item</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{orders.map((o,i)=><tr key={i} className="border-b border-slate-100"><td className="px-4 py-3 font-medium">{o.customer}</td><td className="px-4 py-3">{o.item}</td><td className="px-4 py-3 text-right">{o.price}</td><td className={`px-4 py-3 ${o.status==="Returned"?"text-rose-600":o.status==="Delivered"?"text-emerald-700":"text-amber-700"}`}>{o.status}</td></tr>)}</tbody></table></div></section>
  <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stats.map(([k,v])=><div key={k} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{k}</p><p className={`mt-2 text-2xl font-bold ${k==="Net profit by influencer"&&s.netProfit<0?"text-rose-600":""}`}>{v}</p></div>)}</section>
  <PersonalizedPerformanceGraphs name={c.name} monthlyOrders={c.orders} averageOrderValue={Math.round(c.sp*(1-c.discount/100))} estimatedRate={c.fee} productCostRate={c.sp>0?c.cp/c.sp:0.4} growthRate={0.03}/>
 </div></main>;
}
