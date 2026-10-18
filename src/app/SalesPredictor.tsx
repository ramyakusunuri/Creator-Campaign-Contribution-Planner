<<<<<<< HEAD
 "use client";
=======
"use client";
>>>>>>> 645e923d9db1ddd99aa786db5a42fc0827f40359

import { useMemo, useState } from "react";
import type { Creator } from "../lib/creators";
import { money, shortMoney } from "../lib/format";

<<<<<<< HEAD
type ForecastPoint = { month: string; units: number; revenue: number };

const MONTHS = ["Month 1", "Month 2", "Month 3", "Month 4", "Month 5", "Month 6"];

export default function SalesPredictor({ creators }: { creators: Creator[] }) {
  const [monthlyGrowth, setMonthlyGrowth] = useState(5);

  const forecast = useMemo<ForecastPoint[]>(() => {
    const baselineUnits = creators.reduce((sum, creator) => sum + Math.max(0, creator.orders), 0);
    const averageSellingPrice = baselineUnits > 0
      ? creators.reduce((sum, creator) => sum + Math.max(0, creator.orders) * creator.sp * (1 - creator.discount / 100), 0) / baselineUnits
      : 0;

    return MONTHS.map((month, index) => {
      const units = Math.round(baselineUnits * Math.pow(1 + monthlyGrowth / 100, index));
      return { month, units, revenue: Math.round(units * averageSellingPrice) };
    });
  }, [creators, monthlyGrowth]);

  const baselineUnits = creators.reduce((sum, creator) => sum + Math.max(0, creator.orders), 0);
  const totalFees = creators.reduce((sum, creator) => sum + creator.fee, 0);
  const averageSellingPrice = baselineUnits > 0
    ? creators.reduce((sum, creator) => sum + Math.max(0, creator.orders) * creator.sp * (1 - creator.discount / 100), 0) / baselineUnits
    : 0;
  const first = forecast[0];
  const last = forecast[forecast.length - 1];
  const maxRevenue = Math.max(1, ...forecast.map(point => point.revenue));
  const points = forecast.map((point, index) => {
    const x = 36 + index * 66;
    const y = 170 - (point.revenue / maxRevenue) * 130;
    return `${x},${y}`;
  }).join(" ");
  const chartCard = "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6";

  return (
    <section id="sales-predictor" className="space-y-4">
      <div className={chartCard}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-indigo-600">Scenario forecast</p>
            <h2 className="mt-1 text-xl font-bold">Sales predictor</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              A six-month scenario based on the selected creators’ tracked order counts and discounted average selling prices.
            </p>
          </div>
          <div className="rounded-xl bg-indigo-50 px-4 py-3">
            <p className="text-xs font-medium text-indigo-700">Month 6 estimated sales</p>
            <p className="mt-1 text-xl font-bold text-indigo-900">{shortMoney(last.revenue)}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_250px]">
          <div className="min-w-0 rounded-xl bg-slate-50 p-3 sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Estimated sales revenue</h3>
              <span className="text-xs text-slate-500">₹ INR</span>
            </div>
            <svg viewBox="0 0 430 205" role="img" aria-label="Line graph of estimated sales revenue over six months" className="w-full overflow-visible">
              {[0, 1, 2, 3].map(tick => {
                const y = 170 - tick * (130 / 3);
                return <g key={tick}>
                  <line x1="30" y1={y} x2="420" y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
                  <text x="26" y={y + 4} textAnchor="end" fontSize="9" fill="#64748b">
                    {shortMoney(maxRevenue * tick / 3)}
                  </text>
                </g>;
              })}
              <polyline points={points} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {forecast.map((point, index) => {
                const x = 36 + index * 66;
                const y = 170 - (point.revenue / maxRevenue) * 130;
                return <g key={point.month}>
                  <circle cx={x} cy={y} r="4" fill="#4f46e5" stroke="white" strokeWidth="2" />
                  <text x={x} y="192" textAnchor="middle" fontSize="9" fill="#64748b">{`M${index + 1}`}</text>
                </g>;
              })}
            </svg>
            <p className="mt-1 text-xs text-slate-500">The line shows the revenue implied by the selected monthly growth assumption; it is not a guaranteed result.</p>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <label htmlFor="sales-growth" className="text-sm font-semibold">Assumed monthly order growth</label>
            <p className="mt-1 text-xs leading-5 text-slate-500">Adjust the scenario to see how the forecast changes.</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <input id="sales-growth" type="range" min="-10" max="20" step="1" value={monthlyGrowth} onChange={event => setMonthlyGrowth(Number(event.target.value))} className="w-full accent-indigo-600" />
              <span className="min-w-[48px] text-right text-lg font-bold">{monthlyGrowth}%</span>
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-400"><span>-10%</span><span>+20%</span></div>
            <div className="mt-5 space-y-3">
              <div><p className="text-xs text-slate-500">Selected creators</p><p className="font-semibold">{creators.length}</p></div>
              <div><p className="text-xs text-slate-500">Baseline tracked orders</p><p className="font-semibold">{baselineUnits.toLocaleString("en-IN")}</p></div>
              <div><p className="text-xs text-slate-500">Weighted discounted price</p><p className="font-semibold">{money(Math.round(averageSellingPrice))}</p></div>
            </div>
=======
type ForecastPoint = { month: string; units: number; revenue: number; cumulativeProfit: number };
const MONTHS = ["Month 1", "Month 2", "Month 3", "Month 4", "Month 5", "Month 6"];
const card = "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6";

export default function SalesPredictor({ creators }: { creators: Creator[] }) {
  const [selectedSlug, setSelectedSlug] = useState(creators[0]?.slug ?? "");
  const [monthlyGrowth, setMonthlyGrowth] = useState(5);
  const selected = creators.find(c => c.slug === selectedSlug) ?? creators[0];

  const forecast = useMemo<ForecastPoint[]>(() => {
    if (!selected) return [];
    const sellingPrice = selected.sp * (1 - selected.discount / 100);
    const contributionPerItem = sellingPrice - selected.cp;
    let cumulativeUnits = 0;
    return MONTHS.map((month, index) => {
      // The tracked order count is used as the illustrative first-month baseline.
      const units = Math.max(0, Math.round(selected.orders * Math.pow(1 + monthlyGrowth / 100, index)));
      cumulativeUnits += units;
      const revenue = Math.round(units * sellingPrice);
      // Creator fee is charged once per campaign; profit is cumulative through this month.
      const cumulativeProfit = Math.round(cumulativeUnits * contributionPerItem - selected.fee);
      return { month, units, revenue, cumulativeProfit };
    });
  }, [selected, monthlyGrowth]);

  if (!selected) {
    return <section id="sales-predictor" className={card}><h2 className="text-xl font-bold">Individual influencer sales &amp; profit predictor</h2><p className="mt-2 text-sm text-slate-500">Select at least one influencer to estimate their sales and profit.</p></section>;
  }

  const sellingPrice = selected.sp * (1 - selected.discount / 100);
  const contributionPerItem = sellingPrice - selected.cp;
  const last = forecast[forecast.length - 1];
  const maxRevenue = Math.max(1, ...forecast.map(point => point.revenue));
  const points = forecast.map((point, index) => `${36 + index * 66},${170 - (point.revenue / maxRevenue) * 130}`).join(" ");
  const sixMonthUnits = forecast.reduce((sum, point) => sum + point.units, 0);
  const sixMonthRevenue = forecast.reduce((sum, point) => sum + point.revenue, 0);
  const sixMonthProfit = Math.round(sixMonthUnits * contributionPerItem - selected.fee);

  return (
    <section id="sales-predictor" className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-600">Creator-specific scenario</p>
            <h2 className="mt-1 text-xl font-bold">Individual influencer sales &amp; profit predictor</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Forecast each influencer separately. Select a creator to see their estimated sales revenue, campaign profit, and the assumptions behind the estimate.</p>
          </div>
          <div className="min-w-[230px]">
            <label htmlFor="forecast-creator" className="mb-1 block text-sm font-semibold">Choose influencer</label>
            <select id="forecast-creator" value={selected.slug} onChange={event => setSelectedSlug(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500">
              {creators.map(creator => <option key={creator.slug} value={creator.slug}>{creator.name}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Tracked order baseline" value={selected.orders.toLocaleString("en-IN")} />
          <Metric label="Estimated 6-month revenue" value={shortMoney(sixMonthRevenue)} />
          <Metric label="Creator campaign fee" value={shortMoney(selected.fee)} />
          <Metric label="Estimated 6-month net profit" value={shortMoney(sixMonthProfit)} positive={sixMonthProfit >= 0} />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0 rounded-xl bg-slate-50 p-3 sm:p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold">{selected.name}: estimated monthly sales revenue</h3><span className="text-xs text-slate-500">₹ INR</span></div>
            <svg viewBox="0 0 430 205" role="img" aria-label={`${selected.name} estimated sales revenue over six months`} className="w-full overflow-visible">
              {[0, 1, 2, 3].map(tick => { const y = 170 - tick * (130 / 3); return <g key={tick}><line x1="30" y1={y} x2="420" y2={y} stroke="#e2e8f0" strokeDasharray="4 4" /><text x="26" y={y + 4} textAnchor="end" fontSize="9" fill="#64748b">{shortMoney(maxRevenue * tick / 3)}</text></g>; })}
              <polyline points={points} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {forecast.map((point, index) => { const x = 36 + index * 66; const y = 170 - (point.revenue / maxRevenue) * 130; return <g key={point.month}><circle cx={x} cy={y} r="4" fill="#4f46e5" stroke="white" strokeWidth="2" /><text x={x} y="192" textAnchor="middle" fontSize="9" fill="#64748b">{`M${index + 1}`}</text></g>; })}
            </svg>
            <p className="mt-1 text-xs text-slate-500">Revenue is shown separately from profit. Profit subtracts estimated product cost and the influencer fee.</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <label htmlFor="sales-growth" className="text-sm font-semibold">Assumed monthly order growth</label>
            <p className="mt-1 text-xs leading-5 text-slate-500">Adjust this scenario for {selected.name} only.</p>
            <div className="mt-4 flex items-center justify-between gap-3"><input id="sales-growth" type="range" min="-10" max="20" step="1" value={monthlyGrowth} onChange={event => setMonthlyGrowth(Number(event.target.value))} className="w-full accent-indigo-600" /><span className="min-w-[48px] text-right text-lg font-bold">{monthlyGrowth}%</span></div>
            <div className="mt-2 flex justify-between text-xs text-slate-400"><span>-10%</span><span>+20%</span></div>
            <div className="mt-5 space-y-3"><div><p className="text-xs text-slate-500">Discounted selling price / item</p><p className="font-semibold">{money(Math.round(sellingPrice))}</p></div><div><p className="text-xs text-slate-500">Product cost / item</p><p className="font-semibold">{money(selected.cp)}</p></div><div><p className="text-xs text-slate-500">Contribution before creator fee / item</p><p className={`font-semibold ${contributionPerItem >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{money(Math.round(contributionPerItem))}</p></div></div>
>>>>>>> 645e923d9db1ddd99aa786db5a42fc0827f40359
          </div>
        </div>
      </div>

<<<<<<< HEAD
      <div className="grid gap-4 md:grid-cols-2">
        <div className={chartCard}>
          <h3 className="font-bold">Forecast by month</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[340px] text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="py-2 pr-3">Period</th><th className="py-2 pr-3 text-right">Units</th><th className="py-2 text-right">Estimated sales</th></tr></thead>
              <tbody>{forecast.map(point => <tr key={point.month} className="border-b border-slate-100 last:border-0"><td className="py-3 pr-3">{point.month}</td><td className="py-3 pr-3 text-right">{point.units.toLocaleString("en-IN")}</td><td className="py-3 text-right font-semibold">{shortMoney(point.revenue)}</td></tr>)}</tbody>
            </table>
          </div>
        </div>

        <div className={chartCard}>
          <h3 className="font-bold">Why this prediction?</h3>
          <p className="mt-1 text-sm text-slate-500">The estimate is driven by these visible inputs:</p>
          <ul className="mt-4 space-y-3 text-sm leading-6">
            <li className="flex gap-2"><span className="mt-0.5 text-indigo-600">●</span><span><strong>Creator selection:</strong> the baseline uses the tracked order counts of the {creators.length} currently selected creator{creators.length === 1 ? "" : "s"} ({baselineUnits.toLocaleString("en-IN")} orders combined).</span></li>
            <li className="flex gap-2"><span className="mt-0.5 text-indigo-600">●</span><span><strong>Discounted price:</strong> estimated sales use the order-weighted average price after each creator’s discount ({money(Math.round(averageSellingPrice))} per item).</span></li>
            <li className="flex gap-2"><span className="mt-0.5 text-indigo-600">●</span><span><strong>Growth assumption:</strong> orders change by {monthlyGrowth}% per month, compounded. This is a user-adjustable scenario input, not a measured trend.</span></li>
            <li className="flex gap-2"><span className="mt-0.5 text-indigo-600">●</span><span><strong>Campaign fees:</strong> the selected creators’ fees total {money(totalFees)} and are not subtracted from sales revenue. Sales are revenue, not profit.</span></li>
          </ul>
          {creators.length === 0 && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Select at least one creator in the Influencer performance table to generate a meaningful forecast.</p>}
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Important: the source data is illustrative and contains order totals, not a verified month-by-month time series. Treat this as a transparent what-if projection. Accuracy improves when you replace sample figures with actual historical monthly orders, returns, and conversion data.</p>
=======
      <div className="grid gap-4 xl:grid-cols-2">
        <div className={card}>
          <h3 className="font-bold">{selected.name}: monthly forecast</h3>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[440px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="py-2 pr-3">Period</th><th className="py-2 pr-3 text-right">Units</th><th className="py-2 pr-3 text-right">Revenue</th><th className="py-2 text-right">Cumulative profit</th></tr></thead><tbody>{forecast.map(point => <tr key={point.month} className="border-b border-slate-100 last:border-0"><td className="py-3 pr-3">{point.month}</td><td className="py-3 pr-3 text-right">{point.units.toLocaleString("en-IN")}</td><td className="py-3 pr-3 text-right">{shortMoney(point.revenue)}</td><td className={`py-3 text-right font-semibold ${point.cumulativeProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{shortMoney(point.cumulativeProfit)}</td></tr>)}</tbody></table></div>
        </div>
        <div className={card}>
          <h3 className="font-bold">Why {selected.name} is predicted to earn this profit</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6">
            <li><strong>Order baseline:</strong> {selected.orders.toLocaleString("en-IN")} tracked orders are used as the illustrative first-month baseline.</li>
            <li><strong>Revenue per item:</strong> listed price {money(selected.sp)} less {selected.discount}% discount gives an estimated selling price of {money(Math.round(sellingPrice))}.</li>
            <li><strong>Product cost:</strong> estimated cost is {money(selected.cp)} per item, leaving {money(Math.round(contributionPerItem))} contribution per kept item before the influencer fee.</li>
            <li><strong>Influencer fee:</strong> {money(selected.fee)} is deducted once from cumulative contribution to calculate campaign net profit.</li>
            <li><strong>Growth assumption:</strong> orders change by {monthlyGrowth}% per month, compounded. The six-month scenario estimates {sixMonthUnits.toLocaleString("en-IN")} units, {shortMoney(sixMonthRevenue)} revenue, and {shortMoney(sixMonthProfit)} net profit.</li>
          </ul>
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">This is an illustrative scenario, not a guaranteed forecast. The app's order count is not verified monthly sales history, and the model assumes the creator fee is charged once for this campaign. Replace sample figures with actual orders, returns, product costs, and fee data for a more reliable estimate.</p>
>>>>>>> 645e923d9db1ddd99aa786db5a42fc0827f40359
        </div>
      </div>
    </section>
  );
}
<<<<<<< HEAD
=======

function Metric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-xl font-bold ${positive === undefined ? "text-slate-900" : positive ? "text-emerald-700" : "text-rose-600"}`}>{value}</p></div>;
}
>>>>>>> 645e923d9db1ddd99aa786db5a42fc0827f40359
