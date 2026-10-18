import { notFound } from "next/navigation";
import Link from "next/link";
import { couponFor } from "../../../lib/creators";
import { getServerCreators, getServerPersona } from "../../../lib/server-creators";
import CouponEditor from "./CouponEditor";
import { ordersFor, statsFor, productsFor } from "../../../lib/orders";
import { money, shortMoney, compact } from "../../../lib/format";

export const revalidate = 60;
export const dynamicParams = true;
export async function generateStaticParams() {
  return (await getServerCreators()).map((c) => ({ id: c.slug }));
}

export default async function InfluencerProfile({ params }: { params: { id: string } }) {
  const allCreators = await getServerCreators();
  const c = allCreators.find(x => x.slug === params.id || x.slug.toLowerCase() === params.id.toLowerCase() || (x as any).creator_id === params.id || (x as any).creator_id?.toLowerCase() === params.id.toLowerCase());
  const p = await getServerPersona(params.id);
  if (!c || !p) notFound();
  const orders = ordersFor(c);
  const products = productsFor(c);
  const s = statsFor(c, orders);
  const stats: [string, string][] = [
    ["Total orders by coupon code", s.total.toLocaleString("en-IN")],
    ["Orders returned", s.returned.toLocaleString("en-IN")],
    ["Total sale", money(s.totalSale)],
    ["Net profit by influencer", shortMoney(s.netProfit)],
    ["Return rate", `${s.returnRate.toFixed(1)}%`],
    ["AOV", money(Math.round(s.aov))],
    ["Reorder", s.reorder.toLocaleString("en-IN")],
  ];
  return (
    <main className="min-h-screen bg-[#f6f7fb] p-5 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:text-indigo-900 transition"
          >
            ← Back to Overview
          </Link>
        </div>
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Name / Id</p>
            <h1 className="mt-2 text-2xl font-bold">{c.name}</h1>
            <p className="mt-1 text-sm text-slate-500">{p.id}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Coupon code</p>
            <CouponEditor creatorId={c.slug} initial={couponFor(c)} />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Social platforms</p>
            <ul className="mt-2 space-y-1.5">
              {Object.entries(p.platform_followers).map(([name, n]) => (
                <li key={name} className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-slate-700">{name}</span>
                  <span className="text-lg font-bold">{compact(n)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Name of person / Customer Id</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium">{o.customer}</td>
                    <td className="px-4 py-3">{o.item}</td>
                    <td className="px-4 py-3 text-right">{o.price}</td>
                    <td
                      className={`px-4 py-3 ${
                        o.status === "Returned"
                          ? "text-rose-600"
                          : o.status === "Delivered"
                          ? "text-emerald-700"
                          : "text-amber-700"
                      }`}
                    >
                      {o.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="font-bold">Influencer cost per product</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Total paid to influencer ({money(c.fee)}) ÷ orders by code ({c.orders.toLocaleString("en-IN")})
            </p>
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Influencer cost</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.item} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium">{p.item}</td>
                    <td className="px-4 py-3 text-right">{p.price}</td>
                    <td className="px-4 py-3 text-right">{money(p.influencerCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">{k}</p>
              <p className={`mt-2 text-2xl font-bold ${k === "Net profit by influencer" && s.netProfit < 0 ? "text-rose-600" : ""}`}>
                {v}
              </p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
