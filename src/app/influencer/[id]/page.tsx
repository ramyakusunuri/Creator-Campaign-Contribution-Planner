import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { couponFor } from "../../../lib/creators";
import { fetchCreators, fetchPersona } from "../../../lib/creators-db";
import CouponEditor from "./CouponEditor";
import { ordersFor, statsFor } from "../../../lib/orders";
import { money, shortMoney, compact } from "../../../lib/format";
import PersonalizedPerformanceGraphs from "../../../components/PersonalizedPerformanceGraphs";
import LiveProfileRefresher from "./LiveProfileRefresher";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateStaticParams(){
  return (await fetchCreators()).map(c=>({id:c.slug}));
}

export default async function InfluencerProfile({params}:{params:{id:string}}){
  const creators = await fetchCreators();
  const c = creators.find(x => x.slug === params.id);
  const p = await fetchPersona(params.id);
  if (!c || !p) notFound();

  // Load live orders placed from storefront
  const liveOrdersFile = path.join(process.cwd(), "data", "live_orders.json");
  let liveOrders: any[] = [];
  try {
    if (fs.existsSync(liveOrdersFile)) {
      const raw = fs.readFileSync(liveOrdersFile, "utf8");
      liveOrders = JSON.parse(raw || "[]");
    }
  } catch {
    liveOrders = [];
  }

  const creatorLiveOrders = liveOrders.filter(o => o.creator_id === params.id);
  const effectiveOrdersCount = c.orders + creatorLiveOrders.length;

  const baseSampleOrders = ordersFor(c);
  // Map live placed orders to table format
  const mappedLiveOrders = creatorLiveOrders.map(o => ({
    customer: o.customer_id || "Storefront Shopper",
    item: o.items?.[0]?.name ? `${o.items[0].name}${o.items.length > 1 ? ` (+${o.items.length - 1} more)` : ''}` : "Fashion Apparel",
    price: o.total_inr || 1199,
    status: "Delivered" as const,
    isLive: true,
    promoCode: o.promo_code,
    discountPercent: o.discount_percent
  }));

  const allOrders = [...mappedLiveOrders, ...baseSampleOrders];
  const s = statsFor(c, baseSampleOrders);

  const stats:[string,string][]=[
    ["Total orders by coupon code", effectiveOrdersCount.toLocaleString("en-IN")],
    ["Influencer cost per item", effectiveOrdersCount > 0 ? money(c.fee / effectiveOrdersCount) : "N/A"],
    ["Orders returned", s.returned.toLocaleString("en-IN")],
    ["Total sale", money(s.totalSale + creatorLiveOrders.reduce((acc, cur) => acc + (cur.total_inr || 0), 0))],
    ["Net profit by influencer", shortMoney(s.netProfit)],
    ["Return rate", `${s.returnRate.toFixed(1)}%`],
    ["AOV", money(Math.round(s.aov))],
    ["Reorder", s.reorder.toLocaleString("en-IN")],
  ];

  return (
    <main className="min-h-screen bg-[#f6f7fb] p-5 text-slate-900 sm:p-8">
      <LiveProfileRefresher creatorId={params.id} />
      <div className="mx-auto max-w-5xl space-y-6">
        
        {/* Navigation & Live Badge */}
        <div className="flex items-center justify-between">
          <a href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition">
            ← Back to Campaign Planner
          </a>
          {creatorLiveOrders.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-3 py-1 text-xs font-bold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {creatorLiveOrders.length} Live Storefront {creatorLiveOrders.length === 1 ? 'Order' : 'Orders'} Placed
            </span>
          )}
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Name / Id</p>
            <h1 className="mt-2 text-2xl font-bold">{c.name}</h1>
            <p className="mt-1 text-sm text-slate-500">{p.id}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Coupon code</p>
            <CouponEditor creatorId={c.slug} initial={couponFor(c)}/>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Social platforms</p>
            <ul className="mt-2 space-y-1.5">
              {Object.entries(p.platform_followers).map(([name,n]) => (
                <li key={name} className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-slate-700">{name}</span>
                  <span className="text-lg font-bold">{compact(n)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Orders Table with Storefront Real Orders Highlighted */}
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-base text-slate-900">Recent Customer Orders</h2>
              <p className="text-xs text-slate-500">Live storefront customer purchases appear instantly at the top.</p>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              Showing {allOrders.length} orders
            </span>
          </div>

          <div className="overflow-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Customer ID / Name</th>
                  <th className="px-4 py-3">Item Purchased</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3">Source & Status</th>
                </tr>
              </thead>
              <tbody>
                {allOrders.map((o: any, i) => (
                  <tr key={i} className={`border-b border-slate-100 transition ${o.isLive ? 'bg-emerald-50/70 hover:bg-emerald-100/70' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <span>{o.customer}</span>
                        {o.isLive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white uppercase tracking-wider">
                            Live Storefront
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span>{o.item}</span>
                        {o.promoCode && (
                          <p className="text-[11px] text-emerald-800 font-mono">Promo: {o.promoCode} (-{o.discountPercent}%)</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {money(o.price)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        o.isLive 
                          ? 'bg-emerald-200 text-emerald-900' 
                          : o.status === "Returned" 
                          ? "bg-rose-100 text-rose-800" 
                          : "bg-slate-100 text-slate-800"
                      }`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(([k,v]) => (
            <div key={k} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{k}</p>
              <p className={`mt-2 text-2xl font-bold ${k==="Net profit by influencer" && s.netProfit<0 ? "text-rose-600" : ""}`}>
                {v}
              </p>
            </div>
          ))}
        </section>

        <PersonalizedPerformanceGraphs 
          name={c.name} 
          monthlyOrders={effectiveOrdersCount} 
          averageOrderValue={Math.round(c.sp * (1 - c.discount / 100))} 
          estimatedRate={c.fee} 
          productCostRate={c.sp > 0 ? c.cp / c.sp : 0.4} 
          growthRate={0.03}
        />
      </div>
    </main>
  );
}
