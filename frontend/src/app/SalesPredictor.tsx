 "use client";

import { useMemo, useState } from "react";
import type { Creator } from "../lib/creators";
import { money, shortMoney } from "../lib/format";

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
          </div>
        </div>
      </div>

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
        </div>
      </div>
    </section>
  );
}
