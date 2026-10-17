"use client";
import { useEffect, useMemo, useState } from "react";

type Creator = {
  id: number;
  creator_id?: string;
  name: string;
  category: string;
  orders: number;
  discount: number;
  sp: number;
  cp: number;
  fee: number;
  // Live Observed Metrics (if available)
  liveOrders?: number;
  liveReturns?: number;
  liveAov?: number | null;
  liveDiscountPct?: number | null;
  liveRetainedSales?: number | null;
  liveNetContribution?: number | null;
  isLive?: boolean;
};

type RegisteredPromo = {
  code: string;
  creator_id: string;
  valid_from: string;
  valid_to: string;
  status: 'not_yet_valid' | 'valid' | 'expired';
  use_count: number;
  last_used_at: string | null;
  discount_inr: number | null;
  total_inr: number | null;
};

type CreatorOption = {
  creator_id: string;
  name: string;
  category: string;
  eligible: boolean;
  eligibility_reason?: string;
};

type RedemptionItem = {
  order_id: string;
  customer_id: string;
  used_at: string;
  subtotal_inr: number;
  discount_inr: number | null;
  discount_basis: string | null;
  total_inr: number | null;
  status: string;
  validity_flag: string;
  items?: Array<{
    product_id: string;
    name: string | null;
    unit_price_inr: number;
    quantity: number;
    gross_inr: number;
    line_discount_inr: number | null;
    net_inr: number | null;
  }>;
};

const BUDGET = 2_500_000;

const initialCreators: Creator[] = [
  { id: 1, creator_id: "CR1", name: "Aarav Sharma", category: "Lifestyle", orders: 1800, discount: 10, sp: 1800, cp: 700, fee: 400000 },
  { id: 2, creator_id: "CR2", name: "Meera Kapoor", category: "Fashion", orders: 1300, discount: 15, sp: 1500, cp: 600, fee: 250000 },
  { id: 3, creator_id: "CR3", name: "Rohan Verma", category: "Technology", orders: 2400, discount: 8, sp: 2200, cp: 900, fee: 600000 },
  { id: 4, creator_id: "CR4", name: "Ananya Singh", category: "Beauty", orders: 900, discount: 20, sp: 1200, cp: 500, fee: 150000 },
  { id: 5, creator_id: "CR5", name: "Kabir Mehta", category: "Fitness", orders: 1600, discount: 10, sp: 1600, cp: 650, fee: 300000 },
  { id: 6, creator_id: "CR6", name: "Isha Patel", category: "Lifestyle", orders: 700, discount: 5, sp: 2000, cp: 800, fee: 100000 },
  { id: 7, creator_id: "CR7", name: "Vivaan Rao", category: "Technology", orders: 2000, discount: 12, sp: 2100, cp: 850, fee: 500000 },
  { id: 8, creator_id: "CR8", name: "Diya Malhotra", category: "Fashion", orders: 1100, discount: 10, sp: 1400, cp: 550, fee: 200000 },
];

const money = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "unknown"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const shortMoney = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "unknown";
  return Math.abs(n) >= 100000
    ? `₹${(n / 100000).toFixed(2)}L`
    : Math.abs(n) >= 1000
    ? `₹${(n / 1000).toFixed(1)}K`
    : money(n);
};

function toISTISOString(d: Date): string {
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const istDate = new Date(d.getTime() + istOffsetMs);
  return istDate.toISOString().slice(0, 19) + "+05:30";
}

const formatIST = (dateStr: string | null | undefined) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return (
      new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(d) + " IST"
    );
  } catch {
    return dateStr;
  }
};

const formatISTDateOnly = (dateStr: string | null | undefined) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return dateStr;
  }
};

function profit(c: Creator) {
  if (c.isLive && c.liveNetContribution !== undefined && c.liveNetContribution !== null) {
    return c.liveNetContribution;
  }
  return c.orders * (c.sp * (1 - c.discount / 100) - c.cp) - c.fee;
}

function optimize(creators: Creator[], budget: number) {
  let bestMask = 0,
    bestProfit = 0,
    bestSpend = 0;
  for (let mask = 1; mask < 1 << creators.length; mask++) {
    let spend = 0,
      total = 0;
    for (let i = 0; i < creators.length; i++) {
      if (mask & (1 << i)) {
        spend += creators[i].fee;
        total += profit(creators[i]);
      }
    }
    if (spend <= budget && total > bestProfit) {
      bestMask = mask;
      bestProfit = total;
      bestSpend = spend;
    }
  }
  return {
    creators: creators.filter((_, i) => bestMask & (1 << i)),
    profit: bestProfit,
    spend: bestSpend,
  };
}

export default function Home() {
  const [budget, setBudget] = useState(BUDGET);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<number[] | null>(null);

  // Brand Auth & Multi-tenant State
  const [selectedBrand, setSelectedBrand] = useState("B1");
  const [brandKey, setBrandKey] = useState("b1_secret_key");

  // Promo Code State
  const [registeredPromos, setRegisteredPromos] = useState<RegisteredPromo[]>([]);
  const [creatorOptions, setCreatorOptions] = useState<CreatorOption[]>([]);
  const [liveCreatorMetrics, setLiveCreatorMetrics] = useState<Record<string, any>>({});

  // Promo Code Registration Form (IST Defaults)
  const now = new Date();
  const plus30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [formCode, setFormCode] = useState("");
  const [formCreatorId, setFormCreatorId] = useState("CR1");
  const [formValidFrom, setFormValidFrom] = useState(toISTISOString(now));
  const [formValidTo, setFormValidTo] = useState(toISTISOString(plus30Days));
  const [formStatusMsg, setFormStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Order Redemptions Modal / Drawer
  const [activePromoModal, setActivePromoModal] = useState<string | null>(null);
  const [modalRedemptions, setModalRedemptions] = useState<RedemptionItem[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [simulatingOrder, setSimulatingOrder] = useState(false);

  // Fetch creator options and registered promos for brand
  const refreshBrandData = async (brandId: string, key: string) => {
    try {
      // 1. Fetch creators with eligibility
      const resCreators = await fetch(`/api/creators?brand_id=${brandId}`);
      if (resCreators.ok) {
        const data = await resCreators.json();
        setCreatorOptions(data);
      }

      // 2. Fetch registered promos
      const resPromos = await fetch(`/api/brands/${brandId}/promo-codes`, {
        headers: { "X-Brand-Key": key },
      });
      if (resPromos.ok) {
        const promos: RegisteredPromo[] = await resPromos.json();
        setRegisteredPromos(promos);

        // Fetch detailed live metrics for each promo code
        const metricsMap: Record<string, any> = {};
        for (const p of promos) {
          try {
            const resDetail = await fetch(`/api/brands/${brandId}/promo-codes/${p.code}`, {
              headers: { "X-Brand-Key": key },
            });
            if (resDetail.ok) {
              const detail = await resDetail.json();
              if (detail.orders > 0) {
                metricsMap[detail.creator_id] = detail;
              }
            }
          } catch {}
        }
        setLiveCreatorMetrics(metricsMap);
      } else {
        setRegisteredPromos([]);
        setLiveCreatorMetrics({});
      }
    } catch {
      setRegisteredPromos([]);
    }
  };

  useEffect(() => {
    refreshBrandData(selectedBrand, brandKey);
  }, [selectedBrand, brandKey]);

  // Handle Brand Switch
  const handleBrandChange = (newBrand: string) => {
    setSelectedBrand(newBrand);
    const newKey = newBrand === "B1" ? "b1_secret_key" : "b2_secret_key";
    setBrandKey(newKey);
    setFormStatusMsg(null);
  };

  // Submit Promo Code Registration
  const handleRegisterPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormStatusMsg(null);

    try {
      const res = await fetch(`/api/brands/${selectedBrand}/promo-codes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Brand-Key": brandKey,
        },
        body: JSON.stringify({
          code: formCode.trim().toUpperCase(),
          creator_id: formCreatorId,
          valid_from: formValidFrom,
          valid_to: formValidTo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormStatusMsg({ type: "error", text: data.error || "Failed to register promo code." });
      } else {
        setFormStatusMsg({
          type: "success",
          text: `Promo code "${data.code}" successfully registered! Status: ${data.status}.`,
        });
        setFormCode("");
        await refreshBrandData(selectedBrand, brandKey);
      }
    } catch (err: any) {
      setFormStatusMsg({ type: "error", text: err.message || "Network error registering promo code." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Redemptions Drawer
  const openRedemptionsModal = async (code: string) => {
    setActivePromoModal(code);
    setLoadingModal(true);
    try {
      const res = await fetch(`/api/brands/${selectedBrand}/promo-codes/${code}/redemptions`, {
        headers: { "X-Brand-Key": brandKey },
      });
      if (res.ok) {
        const data = await res.json();
        setModalRedemptions(data);
      } else {
        setModalRedemptions([]);
      }
    } catch {
      setModalRedemptions([]);
    } finally {
      setLoadingModal(false);
    }
  };

  // Simulate Webhook Order For Demo & Testing
  const handleSimulateOrder = async (code: string) => {
    setSimulatingOrder(true);
    try {
      const sampleOrderId = `ORD-${Date.now().toString().slice(-5)}`;
      const res = await fetch(`/api/brands/${selectedBrand}/promo-codes/${code}/redemptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Brand-Key": brandKey,
        },
        body: JSON.stringify({
          order_id: sampleOrderId,
          customer_id: `CUST-${Math.floor(100 + Math.random() * 900)}`,
          used_at: toISTISOString(new Date()),
          discount_inr: 250,
          items: [
            { product_id: "P-101", name: "Premium Apparel", unit_price_inr: 1000, quantity: 2 },
            { product_id: "P-102", name: "Accessories Pack", unit_price_inr: 500, quantity: 1 },
          ],
        }),
      });

      if (res.ok) {
        await refreshBrandData(selectedBrand, brandKey);
        await openRedemptionsModal(code);
      } else {
        const err = await res.json();
        alert(`Simulation error: ${err.error}`);
      }
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    } finally {
      setSimulatingOrder(false);
    }
  };

  // Merge live observed data into creators roster
  const creatorsWithLiveData: Creator[] = useMemo(() => {
    return initialCreators.map((c) => {
      const live = c.creator_id ? liveCreatorMetrics[c.creator_id] : null;
      if (live && live.orders > 0) {
        return {
          ...c,
          isLive: true,
          liveOrders: live.orders,
          liveReturns: live.returns,
          liveAov: live.retained_orders > 0 ? live.subtotal_inr / live.orders : null,
          liveDiscountPct: live.implied_discount_pct_derived,
          liveRetainedSales: live.retained_sales_inr,
          liveNetContribution: live.net_contribution_inr,
        };
      }
      return { ...c, isLive: false };
    });
  }, [liveCreatorMetrics]);

  const recommendation = useMemo(() => optimize(creatorsWithLiveData, budget), [budget, creatorsWithLiveData]);

  const activeIds = selected ?? recommendation.creators.map((c) => c.id);
  const chosen = creatorsWithLiveData.filter((c) => activeIds.includes(c.id));
  const spend = chosen.reduce((s, c) => s + c.fee, 0);
  const totalProfit = chosen.reduce((s, c) => s + profit(c), 0);
  const orders = chosen.reduce((s, c) => s + (c.isLive ? c.liveOrders ?? c.orders : c.orders), 0);
  const shown = creatorsWithLiveData.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) && (category === "All" || c.category === category)
  );

  const toggle = (id: number) =>
    setSelected((prev) => {
      const ids = prev ?? recommendation.creators.map((c) => c.id);
      return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    });

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-900">
      {/* Side Navigation */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-6 lg:block">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">
            C
          </div>
          <div>
            <p className="font-bold">CreatorIQ</p>
            <p className="text-xs text-slate-500">Campaign Planner (C24)</p>
          </div>
        </div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Workspace</p>
        <nav className="space-y-2">
          <a className="block rounded-xl bg-indigo-50 px-4 py-3 font-semibold text-indigo-700" href="#overview">
            ▦ Overview
          </a>
          <a className="block rounded-xl px-4 py-3 text-slate-600 hover:bg-slate-100" href="#promo-integration">
            🏷 Promo Codes & E-Com
          </a>
          <a className="block rounded-xl px-4 py-3 text-slate-600 hover:bg-slate-100" href="#creators">
            ♙ Influencer data
          </a>
          <a className="block rounded-xl px-4 py-3 text-slate-600 hover:bg-slate-100" href="#recommendation">
            ✳ Best combinations
          </a>
          <a className="block rounded-xl px-4 py-3 text-slate-600 hover:bg-slate-100" href="#method">
            ⌁ Calculation method
          </a>
        </nav>
        <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-semibold">Planning budget</p>
          <p className="mt-1 text-xl font-bold">{shortMoney(budget)}</p>
          <p className="mt-1 text-xs text-slate-500">Maximum campaign spend</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Top Header with Multi-Brand Switcher */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
          <div>
            <p className="text-sm text-slate-500">Marketing / Creator campaigns (Case C24)</p>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">Campaign overview</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold">
              <span className="text-slate-500">Active Brand:</span>
              <select
                value={selectedBrand}
                onChange={(e) => handleBrandChange(e.target.value)}
                className="bg-transparent font-bold text-indigo-700 outline-none"
              >
                <option value="B1">B1 · Brand Nova</option>
                <option value="B2">B2 · Brand Zenith</option>
              </select>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              ● Planning & Tracking Mode
            </span>
          </div>
        </header>

        {/* Fixed Synthetic Data Notice Banner */}
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-xs font-medium text-amber-900 sm:px-8">
          ⚠️ <strong>Notice:</strong> Website not connected yet. All use data shown is synthetic sample data. Returns: not available (not tracked by this service).
        </div>

        <div className="space-y-8 p-5 sm:p-8">
          {/* Hero Banner */}
          <section id="overview" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-6 text-white sm:p-9">
            <div className="relative z-10 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-indigo-200">
                Creator campaign contribution planner
              </p>
              <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
                Spend smarter.<br />Maximize campaign contribution.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-indigo-100 sm:text-base">
                Register influencer promo codes and capture actual e-commerce checkout data to observe true campaign retained sales and pre-fee contribution.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="#promo-integration" className="inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-indigo-700 hover:bg-indigo-50">
                  Register Promo Code →
                </a>
                <a href="#recommendation" className="inline-flex rounded-xl border border-white/20 bg-white/10 px-5 py-3 font-semibold text-white hover:bg-white/20">
                  View Optimized Plan
                </a>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full border-[35px] border-white/10" />
          </section>

          {/* Metric Cards */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric title="Total budget" value={shortMoney(budget)} subtitle="Campaign spending limit" icon="₹" />
            <Metric title="Recommended spend" value={shortMoney(recommendation.spend)} subtitle="Selected creator fees" icon="↗" />
            <Metric title="Estimated contribution" value={shortMoney(recommendation.profit)} subtitle="Authoritative C24 Net Model" icon="✳" />
            <Metric title="Creators selected" value={String(chosen.length)} subtitle={`${Object.keys(liveCreatorMetrics).length} with live verified data`} icon="♙" />
          </section>

          {/* PART 1 & 2: PROMO CODE INTEGRATION & REGISTRATION CARD */}
          <section id="promo-integration" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                  Brand Data Integration
                </span>
                <h2 className="mt-2 text-xl font-bold">Register Influencer Promo Code</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Register promo codes dedicated to specific creators. Status is derived from validity dates and system clock.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">X-Brand-Key:</span>
                <input
                  type="password"
                  value={brandKey}
                  onChange={(e) => setBrandKey(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs outline-none focus:border-indigo-500"
                  placeholder="Brand API Key"
                />
              </div>
            </div>

            {formStatusMsg && (
              <div
                className={`mt-4 rounded-xl p-4 text-sm ${
                  formStatusMsg.type === "success"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {formStatusMsg.text}
              </div>
            )}

            <form onSubmit={handleRegisterPromo} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Promo Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AARAV10"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold uppercase outline-none focus:border-indigo-500"
                />
                <p className="mt-1 text-[11px] text-slate-400">4–20 alphanumeric, no spaces.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Assigned Influencer *
                </label>
                <select
                  value={formCreatorId}
                  onChange={(e) => setFormCreatorId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                >
                  {creatorOptions.map((opt) => (
                    <option key={opt.creator_id} value={opt.creator_id} disabled={!opt.eligible}>
                      {opt.creator_id} - {opt.name} ({opt.category}) {!opt.eligible ? `[Blocked: ${opt.eligibility_reason}]` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">Enforces rival brand conflict check.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Valid From (IST) *
                </label>
                <input
                  type="text"
                  required
                  value={formValidFrom}
                  onChange={(e) => setFormValidFrom(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono outline-none focus:border-indigo-500"
                />
                <p className="mt-1 text-[11px] text-slate-400">Indian Standard Time (+05:30)</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Valid To (IST) *
                </label>
                <input
                  type="text"
                  required
                  value={formValidTo}
                  onChange={(e) => setFormValidTo(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono outline-none focus:border-indigo-500"
                />
                <p className="mt-1 text-[11px] text-slate-400">Indian Standard Time (+05:30)</p>
              </div>

              <div className="sm:col-span-2 lg:col-span-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Registering..." : "Submit / Register Promo Code"}
                </button>
              </div>
            </form>

            {/* Registered Codes Table */}
            <div className="mt-8">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Registered Promo Codes ({registeredPromos.length})
              </h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <th className="py-3">Code</th>
                      <th className="py-3">Creator</th>
                      <th className="py-3">Validity Window</th>
                      <th className="py-3">Status</th>
                      <th className="py-3 text-right">Uses</th>
                      <th className="py-3 text-right">Reported Discount</th>
                      <th className="py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registeredPromos.map((p) => (
                      <tr key={p.code} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 font-mono font-bold text-indigo-700">{p.code}</td>
                        <td className="py-3">{p.creator_id}</td>
                        <td className="py-3 text-xs text-slate-500">
                          {formatISTDateOnly(p.valid_from)} to {formatISTDateOnly(p.valid_to)} IST
                        </td>
                        <td className="py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              p.status === "valid"
                                ? "bg-emerald-50 text-emerald-700"
                                : p.status === "not_yet_valid"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            ● {p.status}
                          </span>
                        </td>
                        <td className="py-3 text-right font-semibold">{p.use_count}</td>
                        <td className="py-3 text-right font-medium text-slate-600">
                          {p.discount_inr !== null ? money(p.discount_inr) : "unknown"}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openRedemptionsModal(p.code)}
                              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold hover:bg-slate-100"
                            >
                              View Orders
                            </button>
                            <button
                              onClick={() => handleSimulateOrder(p.code)}
                              disabled={simulatingOrder}
                              className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                            >
                              + Simulate Order
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {registeredPromos.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400">
                          No promo codes registered for this brand yet. Register one above to track checkout uses.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Recommendation & Plan Summary */}
          <section id="recommendation" className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-indigo-600">Optimization result</p>
                  <h2 className="mt-1 text-xl font-bold">Recommended combination</h2>
                  <p className="mt-1 text-sm text-slate-500">Select or remove creators to test alternatives.</p>
                </div>
                <button onClick={() => setSelected(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                  Reset recommendation
                </button>
              </div>

              <div className="mt-6 space-y-3">
                {chosen.length === 0 && (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                    Select creators from the table below to build a plan.
                  </p>
                )}
                {chosen.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-700">
                        {c.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{c.name}</p>
                          {c.isLive ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              LIVE ACTUALS
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                              SIMULATED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {c.category} · {c.isLive ? `${c.liveOrders} live orders` : `${c.orders.toLocaleString("en-IN")} tracked orders`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${profit(c) >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                        {shortMoney(profit(c))}
                      </p>
                      <p className="text-xs text-slate-500">Estimated contribution</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Budget used</span>
                  <span className="font-semibold">{budget ? ((spend / budget) * 100).toFixed(1) : "0.0"}%</span>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${spend > budget ? "bg-rose-500" : "bg-indigo-600"}`}
                    style={{ width: `${Math.min(100, budget ? (spend / budget) * 100 : 0)}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-slate-500">Spend: {money(spend)}</span>
                  <span className={spend > budget ? "font-semibold text-rose-600" : "font-semibold text-emerald-700"}>
                    {spend > budget ? `Over budget by ${money(spend - budget)}` : `Remaining: ${money(budget - spend)}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Summary Row Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="text-xl font-bold">Plan summary</h2>
              <p className="mt-1 text-sm text-slate-500">Results for your selected combination.</p>
              <div className="mt-6 rounded-2xl bg-emerald-50 p-5">
                <p className="text-sm font-medium text-emerald-800">Estimated total net contribution</p>
                <p className={`mt-2 text-3xl font-bold ${totalProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  {money(totalProfit)}
                </p>
                <p className="mt-2 text-xs leading-5 text-emerald-800">
                  Applies the authoritative C24 contribution model with live order integration when available.
                </p>
              </div>
              <div className="mt-5 space-y-4">
                <SummaryRow label="Creators selected" value={String(chosen.length)} />
                <SummaryRow label="Tracked orders (sum)" value={orders.toLocaleString("en-IN")} />
                <SummaryRow label="Total creator fees" value={money(spend)} />
                <SummaryRow label="Budget remaining" value={money(budget - spend)} />
                <SummaryRow label="Contribution per ₹1 spent" value={spend > 0 ? `₹${(totalProfit / spend).toFixed(2)}` : "—"} />
              </div>
              {spend > budget && (
                <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                  This plan exceeds the budget. Remove one or more creators.
                </p>
              )}
            </div>
          </section>

          {/* Influencer Performance Table with Data Provenance Column */}
          <section id="creators" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Influencer performance</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Baseline historical fixtures conditionally updated with live observed promo orders.
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search creators..."
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                >
                  <option>All</option>
                  <option>Lifestyle</option>
                  <option>Fashion</option>
                  <option>Technology</option>
                  <option>Beauty</option>
                  <option>Fitness</option>
                </select>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-4">Select</th>
                    <th className="px-3 py-4">Influencer</th>
                    <th className="px-3 py-4">Data Source</th>
                    <th className="px-3 py-4 text-right">Orders</th>
                    <th className="px-3 py-4 text-right">Discount</th>
                    <th className="px-3 py-4 text-right">Avg. SP / AOV</th>
                    <th className="px-3 py-4 text-right">Creator fee</th>
                    <th className="px-3 py-4 text-right">Retained Sales</th>
                    <th className="px-3 py-4 text-right">Net Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-4">
                        <input
                          type="checkbox"
                          checked={activeIds.includes(c.id)}
                          onChange={() => toggle(c.id)}
                          aria-label={`Select ${c.name}`}
                          className="h-4 w-4 accent-indigo-600"
                        />
                      </td>
                      <td className="px-3 py-4">
                        <p className="font-semibold">{c.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {c.creator_id ? `[${c.creator_id}] ` : ""}
                          {c.category}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        {c.isLive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live Observed
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                            Simulated Scenario
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-right">
                        {c.isLive ? `${c.liveOrders} (${c.liveReturns} ret)` : c.orders.toLocaleString("en-IN")}
                      </td>
                      <td className="px-3 py-4 text-right">
                        {c.isLive
                          ? c.liveDiscountPct !== null
                            ? `${c.liveDiscountPct.toFixed(1)}% (derived)`
                            : "unknown"
                          : `${c.discount}%`}
                      </td>
                      <td className="px-3 py-4 text-right">
                        {c.isLive && c.liveAov !== null ? money(c.liveAov) : money(c.sp)}
                      </td>
                      <td className="px-3 py-4 text-right">{shortMoney(c.fee)}</td>
                      <td className="px-3 py-4 text-right font-medium">
                        {c.isLive ? money(c.liveRetainedSales) : "—"}
                      </td>
                      <td className={`px-3 py-4 text-right font-semibold ${profit(c) >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                        {shortMoney(profit(c))}
                      </td>
                    </tr>
                  ))}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-10 text-center text-slate-500">
                        No influencers match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              * Note: When a creator has 0 live promo orders, the table preserves existing baseline planning figures.
            </p>
          </section>

          {/* Methodology Explanations */}
          <section id="method" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
            <h2 className="font-bold text-amber-950">How the C24 Calculation Model Works</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              <strong>Retained Sales:</strong> (Orders − Returns) × Discounted AOV.<br />
              <strong>Pre-Fee Contribution:</strong> Retained Sales × (Pre-fee Contribution % / 100). Includes variable product and delivery costs in margin.<br />
              <strong>Incremental Contribution:</strong> (Pre-fee Contribution × Incremental Share Assumption) − Creator Fee.<br />
              <strong>Break-Even Share:</strong> Creator Fee / Pre-Fee Contribution (returns null if pre-fee contribution is zero or negative).
            </p>
            <p className="mt-3 text-sm leading-6 text-amber-900">
              <strong>Data Integrity Convention:</strong> Missing values are strictly treated as UNKNOWN (null), never silently converted into zero.
            </p>
          </section>

          <footer className="pb-4 text-center text-xs text-slate-400">
            CreatorIQ · Creator Campaign Contribution Planner · Case C24 · Synthetic reference data
          </footer>
        </div>
      </div>

      {/* Redemptions Order Audit Modal / Drawer */}
      {activePromoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  E-Commerce Attribution Audit
                </span>
                <h3 className="text-xl font-bold">
                  Order Redemptions for <span className="font-mono text-indigo-700">{activePromoModal}</span>
                </h3>
              </div>
              <button
                onClick={() => setActivePromoModal(null)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 text-xs">
              <div>
                <p className="font-semibold text-slate-700">Privacy & Integrity Rules:</p>
                <p className="text-slate-500">Customer PII (names, emails, phones, addresses) is completely excluded.</p>
              </div>
              <button
                onClick={() => handleSimulateOrder(activePromoModal)}
                disabled={simulatingOrder}
                className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {simulatingOrder ? "Simulating..." : "+ Simulate Webhook Order (₹250 disc)"}
              </button>
            </div>

            {loadingModal ? (
              <p className="py-12 text-center text-sm text-slate-500">Loading order audit trail...</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 uppercase text-slate-500">
                      <th className="py-3">Order ID</th>
                      <th className="py-3">Customer ID</th>
                      <th className="py-3">Timestamp</th>
                      <th className="py-3">Validity</th>
                      <th className="py-3">Status</th>
                      <th className="py-3 text-right">Subtotal</th>
                      <th className="py-3 text-right">Discount</th>
                      <th className="py-3 text-right">Basis</th>
                      <th className="py-3 text-right">Net Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalRedemptions.map((o) => (
                      <tr key={o.order_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 font-mono font-bold">{o.order_id}</td>
                        <td className="py-3 font-mono text-slate-500">{o.customer_id}</td>
                        <td className="py-3 text-slate-600 font-medium">{formatIST(o.used_at)}</td>
                        <td className="py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 font-semibold ${
                              o.validity_flag === "valid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {o.validity_flag}
                          </span>
                        </td>
                        <td className="py-3 font-semibold text-slate-700">{o.status}</td>
                        <td className="py-3 text-right">{money(o.subtotal_inr)}</td>
                        <td className="py-3 text-right">{o.discount_inr !== null ? money(o.discount_inr) : "unknown"}</td>
                        <td className="py-3 text-right text-slate-500">{o.discount_basis || "none"}</td>
                        <td className="py-3 text-right font-bold">{o.total_inr !== null ? money(o.total_inr) : "unknown"}</td>
                      </tr>
                    ))}
                    {modalRedemptions.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          No order redemptions recorded for this promo code yet. Click "+ Simulate Webhook Order" above to test live order processing!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function Metric({ title, value, subtitle, icon }: { title: string; value: string; subtitle: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500">{title}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-700">
          {icon}
        </span>
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}
