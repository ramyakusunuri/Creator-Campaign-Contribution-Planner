type Props = {
  name: string;
  monthlyOrders: number;
  averageOrderValue: number;
  estimatedRate: number;
  productCostRate: number;
  growthRate: number;
};
const money = (n:number) => new Intl.NumberFormat("en-IN", {style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);
export default function PersonalizedPerformanceGraphs({name,monthlyOrders,averageOrderValue,estimatedRate,productCostRate,growthRate}:Props){
  const months=["Month 1","Month 2","Month 3","Month 4","Month 5","Month 6"];
  const forecast=months.map((month,i)=>{
    const orders=Math.max(0,Math.round(monthlyOrders*Math.pow(1+growthRate,i)));
    const revenue=orders*averageOrderValue;
    const productCosts=revenue*productCostRate;
    const creatorFee=i===0?estimatedRate:0;
    const profit=revenue-productCosts-creatorFee;
    return {month,orders,revenue,productCosts,creatorFee,profit};
  });
  const max=Math.max(1,...forecast.map(x=>Math.max(x.revenue,Math.abs(x.profit))));
  const maxProfit=Math.max(1,...forecast.map(x=>Math.abs(x.profit)));
  const totalRevenue=forecast.reduce((s,x)=>s+x.revenue,0);
  const totalProfit=forecast.reduce((s,x)=>s+x.profit,0);
  const barW=46,gap=25,width=6*(barW+gap)+20,height=190;
  const points=forecast.map((x,i)=>`${20+i*(barW+gap)+barW/2},${height-22-(x.revenue/max)*(height-50)}`).join(" ");
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Personalized performance forecast</h2><p className="mt-1 text-sm text-slate-500">Six-month estimate for {name}. Demo assumptions, not verified results.</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">Illustrative forecast</span></div>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Forecast revenue</p><p className="mt-1 text-xl font-bold">{money(totalRevenue)}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Forecast net profit</p><p className={`mt-1 text-xl font-bold ${totalProfit<0?"text-rose-600":"text-emerald-700"}`}>{money(totalProfit)}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Estimated orders</p><p className="mt-1 text-xl font-bold">{forecast.reduce((s,x)=>s+x.orders,0).toLocaleString("en-IN")}</p></div></div>
    <div className="overflow-x-auto"><svg role="img" aria-label={`Six-month revenue and profit graph for ${name}`} viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[480px]"><line x1="8" y1={height-22} x2={width-4} y2={height-22} stroke="#cbd5e1" strokeWidth="1"/>{forecast.map((x,i)=>{const bx=20+i*(barW+gap);const bh=Math.max(2,x.profit/maxProfit*(height-55));return <g key={x.month}><rect x={bx} y={height-22-bh} width={barW} height={bh} rx="5" fill={x.profit<0?"#fb7185":"#818cf8"}/><text x={bx+barW/2} y={height-7} textAnchor="middle" fontSize="10" fill="#64748b">M{i+1}</text></g>})}<polyline points={points} fill="none" stroke="#059669" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>{forecast.map((x,i)=>{const cx=20+i*(barW+gap)+barW/2,cy=height-22-(x.revenue/max)*(height-50);return <circle key={x.month} cx={cx} cy={cy} r="4" fill="#059669"><title>{`${x.month}: revenue ${money(x.revenue)}`}</title></circle>})}</svg><div className="mt-1 flex flex-wrap gap-4 text-xs text-slate-500"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-400"/> Monthly net profit (bar)</span><span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-emerald-600"/> Monthly revenue (line)</span></div></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2 pr-3">Month</th><th className="px-3 py-2 text-right">Orders</th><th className="px-3 py-2 text-right">Revenue</th><th className="px-3 py-2 text-right">Creator fee</th><th className="px-3 py-2 text-right">Net profit</th></tr></thead><tbody>{forecast.map(x=><tr key={x.month} className="border-b border-slate-100"><td className="py-2 pr-3">{x.month}</td><td className="px-3 py-2 text-right">{x.orders}</td><td className="px-3 py-2 text-right">{money(x.revenue)}</td><td className="px-3 py-2 text-right">{money(x.creatorFee)}</td><td className={`px-3 py-2 text-right font-semibold ${x.profit<0?"text-rose-600":"text-emerald-700"}`}>{money(x.profit)}</td></tr>)}</tbody></table></div>
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4"><h3 className="font-semibold text-slate-800">Why this prediction?</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600"><li>Baseline is {monthlyOrders.toLocaleString("en-IN")} orders per month, estimated for this creator.</li><li>Average order value is {money(averageOrderValue)} and estimated product cost is {(productCostRate*100).toFixed(0)}% of revenue.</li><li>The assumed monthly order growth is {(growthRate*100).toFixed(0)}%; this is a scenario input, not a guaranteed trend.</li><li>The estimated creator campaign fee of {money(estimatedRate)} is deducted once in Month 1.</li></ul></div>
  </section>;
}
