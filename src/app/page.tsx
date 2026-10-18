"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { useBrand } from "@/components/AppShell";
import { formatINR, formatINRWithPaise, shortINR, renderOrUnknown, formatIST, formatISTDateOnly } from "@/lib/formatters";
import { api, ApiError } from "@/lib/apiClient";

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
  units?: number;
  creator_fee?: number | null;
  cost_per_unit?: number | null;
  cost_per_unit_status?: 'ok' | 'fee_unknown' | 'no_units';
  cost_per_unit_basis?: string;
  discount_inr: number | null;
  total_inr: number | null;
};

type CreatorOption = {
  creator_id: string;
  name: string;
  category: string;
  eligible: boolean;
  eligibility_reason?: string;
  default_fee_inr?: number;
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
  source?: string;
};

type UnregisteredOrder = {
  order_id: string;
  promo_code: string;
  customer_id: string;
  used_at: string;
  subtotal_inr: number;
  discount_inr: number | null;
  total_inr: number | null;
  status: string;
};

type LiveEvent = {
  id: string;
  timestamp: string;
  event: string;
  payload: any;
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

function toISTISOString(d: Date): string {
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const istDate = new Date(d.getTime() + istOffsetMs);
  return istDate.toISOString().slice(0, 19) + "+05:30";
}

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
  const {
    selectedBrand,
    brandKey,
    reportKey,
    agencyKey,
    setConnectionStatus,
    feedStatus,
    setFeedStatus
  } = useBrand();

  const [budget, setBudget] = useState(BUDGET);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<number[] | null>(null);

  // Data states
  const [registeredPromos, setRegisteredPromos] = useState<RegisteredPromo[]>([]);
  const [creatorOptions, setCreatorOptions] = useState<CreatorOption[]>([]);
  const [liveCreatorMetrics, setLiveCreatorMetrics] = useState<Record<string, any>>({});
  const [unregisteredOrders, setUnregisteredOrders] = useState<UnregisteredOrder[]>([]);
  const [recentEvents, setRecentEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Live feed stream controls
  const [isStreamPaused, setIsStreamPaused] = useState(false);
  const isStreamPausedRef = useRef(false);
  useEffect(() => {
    isStreamPausedRef.current = isStreamPaused;
  }, [isStreamPaused]);
  const [feedFilter, setFeedFilter] = useState("all");

  // Pre-checkout advisory tester
  const [testCodeInput, setTestCodeInput] = useState("");
  const [testCodeResult, setTestCodeResult] = useState<{ code: string; valid: boolean; reason: string } | null>(null);
  const [isTestingCode, setIsTestingCode] = useState(false);

  // Promo code filter
  const [promoStatusFilter, setPromoStatusFilter] = useState<string>("all");

  // Reconciliation state
  const defaultReconFrom = toISTISOString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const defaultReconTo = toISTISOString(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [reconFrom, setReconFrom] = useState(defaultReconFrom);
  const [reconTo, setReconTo] = useState(defaultReconTo);
  const [reconData, setReconData] = useState<any>(null);
  const [loadingRecon, setLoadingRecon] = useState(false);
  const [reconError, setReconError] = useState<string | null>(null);
  const [expandedReconCodes, setExpandedReconCodes] = useState<Record<string, boolean>>({});

  // Promo Code Registration Form
  const now = new Date();
  const plus30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [formCode, setFormCode] = useState("");
  const [formCreatorId, setFormCreatorId] = useState("CR1");
  const [formValidFrom, setFormValidFrom] = useState(toISTISOString(now));
  const [formValidTo, setFormValidTo] = useState(toISTISOString(plus30Days));
  const [formStatusMsg, setFormStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Drawer & Modal States
  const [activePromoModal, setActivePromoModal] = useState<string | null>(null);
  const [modalRedemptions, setModalRedemptions] = useState<RedemptionItem[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<RegisteredPromo | null>(null);
  const [editValidFrom, setEditValidFrom] = useState("");
  const [editValidTo, setEditValidTo] = useState("");
  const [editStatusMsg, setEditStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleTestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testCodeInput.trim()) return;
    setIsTestingCode(true);
    setTestCodeResult(null);
    try {
      const code = testCodeInput.trim().toUpperCase();
      const res = await api.get<any>(`/api/brands/${selectedBrand}/promo-codes/${code}/check`, {
        keyRole: "report",
        apiKey: reportKey
      });
      setTestCodeResult(res);
    } catch (err: any) {
      setTestCodeResult({ code: testCodeInput.toUpperCase(), valid: false, reason: err.message || "Failed" });
    } finally {
      setIsTestingCode(false);
    }
  };

  const executeReconciliation = async (fromVal?: string, toVal?: string) => {
    const f = fromVal || reconFrom;
    const t = toVal || reconTo;
    setLoadingRecon(true);
    setReconError(null);
    try {
      const data = await api.get<any>(`/api/brands/${selectedBrand}/reconciliation?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`, {
        keyRole: "brand",
        apiKey: brandKey
      });
      setReconData(data);
    } catch (err: any) {
      setReconError(err.message || "Reconciliation query failed");
      setReconData(null);
    } finally {
      setLoadingRecon(false);
    }
  };

  // Fetch full brand data
  const refreshBrandData = async (brandId: string, key: string) => {
    try {
      setLoading(true);
      // 1. Fetch creators with eligibility
      try {
        const creatorsData = await api.get<CreatorOption[]>(`/api/creators?brand_id=${brandId}`);
        setCreatorOptions(creatorsData);
      } catch {}

      // 2. Fetch registered promos
      try {
        const promos = await api.get<RegisteredPromo[]>(`/api/brands/${brandId}/promo-codes`, {
          keyRole: "brand",
          apiKey: key
        });
        setRegisteredPromos(promos);

        // Fetch detailed economics for each promo code
        const metricsMap: Record<string, any> = {};
        for (const p of promos) {
          try {
            const detail = await api.get<any>(`/api/brands/${brandId}/promo-codes/${p.code}`, {
              keyRole: "brand",
              apiKey: key
            });
            if (detail.orders > 0) {
              metricsMap[detail.creator_id] = detail;
            }
          } catch {}
        }
        setLiveCreatorMetrics(metricsMap);
      } catch {
        setRegisteredPromos([]);
        setLiveCreatorMetrics({});
      }

      // 3. Fetch Feed Status
      try {
        const feed = await api.get<any>(`/api/brands/${brandId}/feed-status`, {
          keyRole: "brand",
          apiKey: key
        });
        setFeedStatus(feed);
      } catch {}

      // 4. Fetch Unregistered Uses
      try {
        const unreg = await api.get<UnregisteredOrder[]>(`/api/brands/${brandId}/unregistered-uses`, {
          keyRole: "brand",
          apiKey: key
        });
        setUnregisteredOrders(unreg);
      } catch {
        setUnregisteredOrders([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // SSE Stream with fetch reader
  useEffect(() => {
    let isCancelled = false;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let watchdogTimer: NodeJS.Timeout | null = null;
    let retryCount = 0;

    const resetWatchdog = () => {
      if (watchdogTimer) clearTimeout(watchdogTimer);
      watchdogTimer = setTimeout(() => {
        if (!isCancelled) {
          console.warn("[SSE] Watchdog timeout (>35s), reconnecting...");
          if (reader) reader.cancel().catch(() => {});
        }
      }, 35000);
    };

    const connectSse = async () => {
      if (isCancelled) return;
      setConnectionStatus("connecting");

      try {
        const res = await fetch(`/api/brands/${selectedBrand}/events`, {
          headers: {
            "X-Brand-Key": brandKey,
            Accept: "text/event-stream"
          }
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        setConnectionStatus("connected");
        retryCount = 0;
        resetWatchdog();

        refreshBrandData(selectedBrand, brandKey);

        const body = res.body;
        if (!body) throw new Error("No response body");

        reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!isCancelled) {
          const { done, value } = await reader.read();
          if (done) break;

          resetWatchdog();
          buffer += decoder.decode(value, { stream: true });

          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";

          for (const block of blocks) {
            if (!block.trim()) continue;
            let eventType = "message";
            let eventData = "";

            for (const rawLine of block.split("\n")) {
              const line = rawLine.trim();
              if (line.startsWith(":")) continue;
              if (line.startsWith("event:")) eventType = line.slice(6).trim();
              else if (line.startsWith("data:")) eventData = line.slice(5).trim();
            }

            if (eventType === "ping") continue;

            if (eventData) {
              try {
                const parsed = JSON.parse(eventData);
                const newEvent: LiveEvent = {
                  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  timestamp: new Date().toISOString(),
                  event: eventType,
                  payload: parsed
                };
                if (!isStreamPausedRef.current) {
                  setRecentEvents((prev) => [newEvent, ...prev.slice(0, 29)]);
                }
                refreshBrandData(selectedBrand, brandKey);

                if (activePromoModal && (parsed.code === activePromoModal || parsed.promo_code === activePromoModal)) {
                  openRedemptionsModal(activePromoModal);
                }
              } catch (err) {
                console.error("[SSE] JSON parse error:", err);
              }
            }
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setConnectionStatus("disconnected");
        }
      } finally {
        if (!isCancelled) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          retryCount++;
          reconnectTimer = setTimeout(connectSse, delay);
        }
      }
    };

    connectSse();

    const interval = setInterval(() => {
      refreshBrandData(selectedBrand, brandKey);
    }, 60000);

    return () => {
      isCancelled = true;
      if (reader) reader.cancel().catch(() => {});
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (watchdogTimer) clearTimeout(watchdogTimer);
      clearInterval(interval);
    };
  }, [selectedBrand, brandKey, activePromoModal]);

  // Register Promo Code Handler
  const handleRegisterPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormStatusMsg(null);

    try {
      const data = await api.post(`/api/brands/${selectedBrand}/promo-codes`, {
        code: formCode.trim().toUpperCase(),
        creator_id: formCreatorId,
        valid_from: formValidFrom,
        valid_to: formValidTo
      }, {
        keyRole: "brand",
        apiKey: brandKey
      });

      setFormStatusMsg({
        type: "success",
        text: `Promo code "${data.code}" successfully registered! Status: ${data.status}.`
      });
      setFormCode("");
      await refreshBrandData(selectedBrand, brandKey);
    } catch (err: any) {
      setFormStatusMsg({ type: "error", text: err.message || "Failed to register promo code." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Redemptions Drawer
  const openRedemptionsModal = async (code: string) => {
    setActivePromoModal(code);
    setLoadingModal(true);
    try {
      const data = await api.get<RedemptionItem[]>(`/api/brands/${selectedBrand}/promo-codes/${code}/redemptions`, {
        keyRole: "brand",
        apiKey: brandKey
      });
      setModalRedemptions(data || []);
    } catch {
      setModalRedemptions([]);
    } finally {
      setLoadingModal(false);
    }
  };

  // Edit Dates Modal Handlers
  const openEditModal = (p: RegisteredPromo) => {
    setEditingPromo(p);
    setEditValidFrom(p.valid_from);
    setEditValidTo(p.valid_to);
    setEditStatusMsg(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPromo) return;
    setIsSavingEdit(true);
    setEditStatusMsg(null);

    try {
      await api.patch(`/api/brands/${selectedBrand}/promo-codes/${editingPromo.code}`, {
        valid_from: editValidFrom,
        valid_to: editValidTo
      }, {
        keyRole: "brand",
        apiKey: brandKey
      });

      setEditingPromo(null);
      await refreshBrandData(selectedBrand, brandKey);
    } catch (err: any) {
      setEditStatusMsg({ type: "error", text: err.message || "Failed to update validity dates." });
    } finally {
      setIsSavingEdit(false);
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

  const hasSeedData = (feedStatus?.uses_by_source?.synthetic_seed ?? 0) > 0;
  const noWebsiteReports = (feedStatus?.uses_by_source?.website ?? 0) === 0;

  return (
    <div className="space-y-8 p-5 sm:p-8">
      {/* Data-Driven Banners */}
      {hasSeedData && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          ⚠️ <strong>Notice:</strong> Contains synthetic sample data. Observed results include pre-configured simulation runs.
        </div>
      )}

      {noWebsiteReports && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs font-medium text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
          ℹ️ <strong>Feed Status:</strong> No website reports received yet. Orders placed on the store checkout using <code>X-Report-Key</code> will appear here automatically.
        </div>
      )}

      {unregisteredOrders.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          🚨 <strong>Integrity Alert:</strong> {unregisteredOrders.length} order(s) placed with unregistered promo codes. These are tracked under Unregistered Uses without altering creator contribution economics.
        </div>
      )}

      {/* SECTION 1: PLANNER (#planner) */}
      <section id="planner" className="space-y-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-6 text-white sm:p-9 shadow-xl shadow-indigo-600/10">
          <div className="relative z-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-200">
              C24 Platform · Section 1: Planner
            </p>
            <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
              Spend smarter.<br />Maximize campaign contribution.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-indigo-100 sm:text-base">
              Mathematically optimized influencer selection using integer-paise storage and authoritatively validated contribution economics.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#promo-codes" className="inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-white">
                Register Promo Code →
              </a>
              <a href="#experiments" className="inline-flex rounded-xl border border-white/20 bg-white/10 px-5 py-3 font-semibold text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white">
                View Optimized Combination
              </a>
            </div>
          </div>
          <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full border-[35px] border-white/10" />
        </div>

        {/* Metric Overview Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Total budget" value={shortINR(budget)} subtitle="Campaign spending limit" icon="₹" />
          <MetricCard title="Recommended spend" value={shortINR(recommendation.spend)} subtitle="Selected creator fees" icon="↗" />
          <MetricCard title="Estimated contribution" value={shortINR(recommendation.profit)} subtitle="Authoritative C24 Net Model" icon="✳" />
          <MetricCard title="Creators selected" value={String(chosen.length)} subtitle={`${Object.keys(liveCreatorMetrics).length} with live verified data`} icon="♙" />
        </div>
      </section>

      {/* SECTION 2: FINDER (#finder) */}
      <section id="finder" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
          <div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
              Section 2: Finder
            </span>
            <h2 className="mt-2 text-xl font-bold">Influencer Roster & Agency Catalog</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Discover eligible creators, review rival brand conflicts, and select collaborators for your plan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search creator name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
            >
              {["All", "Fashion", "Beauty", "Lifestyle", "Fitness", "Technology"].map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {shown.map((c) => {
            const isSelected = activeIds.includes(c.id);
            return (
              <div
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`cursor-pointer rounded-2xl border p-5 transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/30 ring-2 ring-indigo-600/20 dark:border-indigo-500 dark:bg-indigo-950/30"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {c.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}>
                    {isSelected ? "Selected" : "Excluded"}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{c.name}</p>
                    {c.isLive && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        LIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {c.category} · {c.creator_id || "Unregistered"}
                  </p>
                </div>
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Orders:</span>
                    <span className="font-semibold">{c.isLive ? c.liveOrders : c.orders.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Creator fee:</span>
                    <span className="font-semibold">{formatINR(c.fee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Contribution:</span>
                    <span className={`font-semibold ${profit(c) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {formatINR(profit(c))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: PROMO CODES (#promo-codes) */}
      <section id="promo-codes" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
          <div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
              Section 3: Promo Codes
            </span>
            <h2 className="mt-2 text-xl font-bold">Register Influencer Promo Code</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Assign codes to creators with strict validity windows. Status is automatically derived from the system clock.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-400">Authorized: X-Brand-Key</span>
        </div>

        {formStatusMsg && (
          <div className={`mt-4 rounded-xl p-4 text-sm ${
            formStatusMsg.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
          }`}>
            {formStatusMsg.text}
          </div>
        )}

        <form onSubmit={handleRegisterPromo} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Promo Code (Uppercase)</label>
            <input
              type="text"
              placeholder="e.g. AARAV10"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value.toUpperCase())}
              required
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono font-bold outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Assigned Creator</label>
            <select
              value={formCreatorId}
              onChange={(e) => setFormCreatorId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
            >
              {creatorOptions.map((c) => (
                <option key={c.creator_id} value={c.creator_id} disabled={!c.eligible}>
                  {c.name} ({c.creator_id}) {!c.eligible ? `· Blocked (${c.eligibility_reason})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Valid From (IST)</label>
            <input
              type="text"
              value={formValidFrom}
              onChange={(e) => setFormValidFrom(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Valid To (IST)</label>
            <input
              type="text"
              value={formValidTo}
              onChange={(e) => setFormValidTo(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-indigo-600 px-6 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {isSubmitting ? "Registering..." : "+ Register Promo Code"}
            </button>
          </div>
        </form>

        {/* Pre-checkout Advisory Check Tester */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                  🔍
                </span>
                <h4 className="text-sm font-bold">E-Commerce Checkout Advisory Tester (<code>GET .../check</code>)</h4>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Simulates pre-checkout validation with <code>X-Report-Key</code>. Returns eligibility without leaking confidential margins or creator identities.
              </p>
            </div>
            <span className="font-mono text-[11px] text-slate-400">Auth: X-Report-Key</span>
          </div>

          <form onSubmit={handleTestCode} className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="e.g. SUMMER25, AARAV10..."
              value={testCodeInput}
              onChange={(e) => setTestCodeInput(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs uppercase outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              type="submit"
              disabled={isTestingCode}
              className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-700"
            >
              {isTestingCode ? "Checking..." : "Test Advisory Check"}
            </button>
            {testCodeResult && (
              <div className={`flex items-center gap-2 rounded-xl px-3 py-1 text-xs font-semibold ${
                testCodeResult.valid
                  ? "border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
              }`}>
                <span>{testCodeResult.valid ? "✓ Valid for Checkout" : "✗ Ineligible"}</span>
                <span className="font-mono text-[10px] opacity-75">
                  ({testCodeResult.reason}) · No margins or creator leaked
                </span>
              </div>
            )}
          </form>
        </div>

        {/* Registered Codes Table */}
        <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold">Registered Promo Codes ({registeredPromos.length})</h3>
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold dark:bg-slate-800">
              {[
                { id: "all", label: "All" },
                { id: "valid", label: "Active" },
                { id: "not_yet_valid", label: "Scheduled" },
                { id: "expired", label: "Expired" }
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setPromoStatusFilter(filter.id)}
                  className={`rounded-lg px-2.5 py-1 transition-all ${
                    promoStatusFilter === filter.id
                      ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
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
                {registeredPromos
                  .filter((p) => promoStatusFilter === "all" || p.status === promoStatusFilter)
                  .map((p) => (
                  <tr key={p.code} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                    <td className="py-3 font-mono font-bold text-indigo-700 dark:text-indigo-400">{p.code}</td>
                    <td className="py-3">{p.creator_id}</td>
                    <td className="py-3 text-xs text-slate-500 dark:text-slate-400">
                      {formatISTDateOnly(p.valid_from)} to {formatISTDateOnly(p.valid_to)} IST
                    </td>
                    <td className="py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        p.status === "valid"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                          : p.status === "not_yet_valid"
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                      }`}>
                        ● {p.status}
                      </span>
                    </td>
                    <td className="py-3 text-right font-semibold">{p.use_count}</td>
                    <td className="py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                      {formatINR(p.discount_inr)}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(p)}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Edit Dates
                        </button>
                        <button
                          onClick={() => openRedemptionsModal(p.code)}
                          className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300"
                        >
                          View Orders
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {registeredPromos.filter((p) => promoStatusFilter === "all" || p.status === promoStatusFilter).length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No promo codes match this filter. Register one above to begin tracking live checkout redemptions.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION 4: LIVE FEED (#live-feed) */}
      <section id="live-feed" className="rounded-2xl border border-slate-200 bg-slate-900 p-5 sm:p-6 text-white dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <span className={`h-2.5 w-2.5 rounded-full ${isStreamPaused ? "bg-amber-400" : "bg-emerald-400 animate-ping"}`} />
            <h3 className="font-bold text-sm text-slate-100">Section 4: Live Ingestion Event Stream</h3>
            {isStreamPaused && (
              <span className="rounded bg-amber-900/60 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                PAUSED
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsStreamPaused((p) => !p)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                isStreamPaused
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              {isStreamPaused ? "▶ Resume Stream" : "⏸ Pause Stream"}
            </button>
            <button
              onClick={() => setRecentEvents([])}
              className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            >
              Clear Feed
            </button>
            <span className="text-[11px] font-mono text-slate-500">X-Brand-Key</span>
          </div>
        </div>

        {/* Live Feed Status Bar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-800/50 p-2.5 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <span>Last Activity: <strong className="text-slate-200">{feedStatus?.last_use_received_at ? formatIST(feedStatus.last_use_received_at) : "None yet"}</strong></span>
            <span>Website Reports: <strong className="text-emerald-400">{feedStatus?.uses_by_source?.website ?? 0}</strong></span>
            <span>Synthetic: <strong className="text-slate-300">{feedStatus?.uses_by_source?.synthetic_seed ?? 0}</strong></span>
            {(feedStatus?.unregistered_uses ?? 0) > 0 && (
              <span>Unregistered Attempts: <strong className="text-rose-400">{feedStatus?.unregistered_uses}</strong></span>
            )}
          </div>
          {/* Event Filter Pills */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-800 p-0.5 text-[11px]">
            {[
              { id: "all", label: "All" },
              { id: "orders", label: "Orders" },
              { id: "unregistered", label: "Unregistered" },
              { id: "promos", label: "Promos" }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFeedFilter(f.id)}
                className={`rounded px-2 py-0.5 ${
                  feedFilter === f.id
                    ? "bg-indigo-600 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto font-mono text-xs">
          {recentEvents
            .filter((ev) => {
              if (feedFilter === "all") return true;
              if (feedFilter === "orders") return ev.event === "use_recorded";
              if (feedFilter === "unregistered") return ev.event === "unregistered_use_recorded";
              if (feedFilter === "promos") return ev.event === "promo_created" || ev.event === "promo_updated";
              return true;
            })
            .length === 0 ? (
            <p className="py-8 text-center text-slate-500">
              Awaiting live checkout orders or events from the website / simulator...
            </p>
          ) : (
            recentEvents
              .filter((ev) => {
                if (feedFilter === "all") return true;
                if (feedFilter === "orders") return ev.event === "use_recorded";
                if (feedFilter === "unregistered") return ev.event === "unregistered_use_recorded";
                if (feedFilter === "promos") return ev.event === "promo_created" || ev.event === "promo_updated";
                return true;
              })
              .map((ev) => (
              <div key={ev.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-800/80 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    ev.event === "use_recorded"
                      ? "border border-emerald-800 bg-emerald-950 text-emerald-400"
                      : ev.event === "unregistered_use_recorded"
                      ? "border border-amber-800 bg-amber-950 text-amber-400"
                      : ev.event === "promo_created"
                      ? "border border-indigo-800 bg-indigo-950 text-indigo-400"
                      : "border border-cyan-800 bg-cyan-950 text-cyan-400"
                  }`}>
                    {ev.event}
                  </span>
                  <span className="font-bold text-slate-200">{renderOrUnknown(ev.payload.code || ev.payload.promo_code)}</span>
                  {ev.payload.order_id && <span className="text-slate-400 text-[11px]">[{ev.payload.order_id}]</span>}
                  {ev.payload.discount_inr !== undefined && (
                    <span className="text-emerald-400 text-[11px]">disc: {formatINR(ev.payload.discount_inr)}</span>
                  )}
                  {ev.payload.source && (
                    <span className="rounded bg-slate-700 px-1 py-0.2 text-[9px] text-slate-300">{ev.payload.source}</span>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-slate-500">{formatIST(ev.timestamp)}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* SECTION 5: COST PER UNIT (#cost-per-unit) */}
      <section id="cost-per-unit" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
          Section 5: Cost Per Unit
        </span>
        <h2 className="mt-2 text-xl font-bold">Creator Unit Economics & Fee Allocation</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Authoritative fee allocation across gross merchandise units. Cost per unit basis is strictly &ldquo;returns not deducted&rdquo;.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                <th className="py-3">Code</th>
                <th className="py-3">Creator</th>
                <th className="py-3 text-right">Fee (Paise Converted)</th>
                <th className="py-3 text-right">Units Sold</th>
                <th className="py-3 text-right">Cost / Unit</th>
                <th className="py-3 text-right">Basis</th>
              </tr>
            </thead>
            <tbody>
              {registeredPromos.map((p) => (
                <tr key={p.code} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                  <td className="py-3 font-mono font-bold text-indigo-700 dark:text-indigo-400">{p.code}</td>
                  <td className="py-3">{p.creator_id}</td>
                  <td className="py-3 text-right font-medium">{formatINR(p.creator_fee)}</td>
                  <td className="py-3 text-right font-semibold">{p.units !== undefined ? p.units : "—"}</td>
                  <td className="py-3 text-right font-bold text-slate-900 dark:text-slate-100">
                    {p.cost_per_unit_status === "ok" && p.cost_per_unit !== null
                      ? formatINRWithPaise(p.cost_per_unit)
                      : p.cost_per_unit_status === "no_units"
                      ? "no units"
                      : p.cost_per_unit_status === "fee_unknown"
                      ? "fee unknown"
                      : "unknown"}
                  </td>
                  <td className="py-3 text-right text-xs text-slate-500 dark:text-slate-400">returns not deducted</td>
                </tr>
              ))}
              {registeredPromos.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No active campaign data to calculate unit costs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 6: EXPERIMENTS (#experiments) */}
      <section id="experiments" className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                Section 6: Experiments
              </span>
              <h2 className="mt-2 text-xl font-bold">Scenario Modeling & Combination Testing</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Include or exclude creators to observe impact on net contribution.</p>
            </div>
            <button onClick={() => setSelected(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              Reset recommendation
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {chosen.length === 0 && (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                Select creators from the roster above to test a scenario combination.
              </p>
            )}
            {chosen.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                    {c.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{c.name}</p>
                      {c.isLive ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                          LIVE ACTUALS
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          SIMULATED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {c.category} · {c.isLive ? `${c.liveOrders} live orders` : `${c.orders.toLocaleString("en-IN")} tracked orders`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${profit(c) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {shortINR(profit(c))}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Estimated contribution</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Budget utilized</span>
              <span className="font-semibold">{budget ? ((spend / budget) * 100).toFixed(1) : "0.0"}%</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className={`h-full rounded-full ${spend > budget ? "bg-rose-500" : "bg-indigo-600"}`}
                style={{ width: `${Math.min(100, budget ? (spend / budget) * 100 : 0)}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
              <span className="text-slate-500 dark:text-slate-400">Spend: {formatINR(spend)}</span>
              <span className={spend > budget ? "font-semibold text-rose-600 dark:text-rose-400" : "font-semibold text-emerald-600 dark:text-emerald-400"}>
                {spend > budget ? `Over budget by ${formatINR(spend - budget)}` : `Remaining: ${formatINR(budget - spend)}`}
              </span>
            </div>
          </div>
        </div>

        {/* Experiment Results Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-bold">Plan summary</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Optimized mathematical solution.</p>
          <div className="mt-6 rounded-2xl bg-emerald-50 p-5 dark:bg-emerald-950/40">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Estimated total net contribution</p>
            <p className={`mt-2 text-3xl font-bold ${totalProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {formatINR(totalProfit)}
            </p>
            <p className="mt-2 text-xs leading-5 text-emerald-800 dark:text-emerald-400">
              C24 Authoritative Contribution Model with integer paise precision.
            </p>
          </div>
          <div className="mt-5 space-y-4">
            <SummaryRow label="Creators selected" value={String(chosen.length)} />
            <SummaryRow label="Total campaign spend" value={formatINR(spend)} />
            <SummaryRow label="Target orders" value={orders.toLocaleString("en-IN")} />
            <SummaryRow label="ROAS / Return multiple" value={`${spend ? (totalProfit / spend).toFixed(2) : "0.00"}x`} />
          </div>
        </div>
      </section>

      {/* SECTION 7: EVIDENCE & RECONCILIATION (#evidence) */}
      <section id="evidence" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5 dark:border-slate-800">
          <div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
              Section 7: Evidence & Reconciliation
            </span>
            <h2 className="mt-2 text-xl font-bold">Financial Reconciliation & Audit Trail</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Authoritatively reconciles website checkout transactions against influencer attributed orders with integer paise precision.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-400">Auth: X-Brand-Key / X-Report-Key</span>
        </div>

        {/* Date Range Query Controls */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Reconciliation Audit Window (ISO 8601 with IST Timezone)
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const f = toISTISOString(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
                  const t = toISTISOString(new Date(Date.now() + 24 * 60 * 60 * 1000));
                  setReconFrom(f);
                  setReconTo(t);
                  executeReconciliation(f, t);
                }}
                className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  const f = toISTISOString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
                  const t = toISTISOString(new Date(Date.now() + 24 * 60 * 60 * 1000));
                  setReconFrom(f);
                  setReconTo(t);
                  executeReconciliation(f, t);
                }}
                className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  const f = "2026-01-01T00:00:00+05:30";
                  const t = "2026-12-31T23:59:59+05:30";
                  setReconFrom(f);
                  setReconTo(t);
                  executeReconciliation(f, t);
                }}
                className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Year 2026
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">From Timestamp:</label>
              <input
                type="text"
                value={reconFrom}
                onChange={(e) => setReconFrom(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">To Timestamp:</label>
              <input
                type="text"
                value={reconTo}
                onChange={(e) => setReconTo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => executeReconciliation()}
                disabled={loadingRecon}
                className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loadingRecon ? "Reconciling..." : "Run Audit Reconciliation →"}
              </button>
            </div>
          </div>

          {reconError && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              Error: {reconError}
            </div>
          )}
        </div>

        {/* Reconciliation Results Section */}
        {reconData && (
          <div className="mt-6 space-y-6">
            {/* Summary KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500">Reported Orders</span>
                <p className="mt-2 text-2xl font-bold">{reconData.summary.total_orders}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {reconData.summary.registered_orders_count} registered · {reconData.summary.unregistered_orders_count} unregistered
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500">Gross Attributed Revenue</span>
                <p className="mt-2 text-2xl font-bold">{formatINR(reconData.summary.gross_subtotal_inr)}</p>
                <p className="mt-1 text-[11px] font-mono text-slate-500">
                  {reconData.summary.gross_subtotal_paise?.toLocaleString()} paise
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500">Total Discounts</span>
                <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {formatINR(reconData.summary.total_discount_inr)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Net: {formatINR(reconData.summary.net_total_inr)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500">Refunds & Discrepancies</span>
                <p className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {formatINR(reconData.summary.refund_amount_inr)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {reconData.summary.refund_events_count} returns · {reconData.summary.discrepancies_count} discrepancies
                </p>
              </div>
            </div>

            {/* Reconciled Promo Code Table */}
            <div className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
              <h4 className="text-sm font-bold">Registered Promo Attributions ({reconData.registered_codes?.length || 0})</h4>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 uppercase text-slate-500 dark:border-slate-700">
                      <th className="py-2.5">Promo Code</th>
                      <th className="py-2.5 text-right">Orders</th>
                      <th className="py-2.5 text-right">Units</th>
                      <th className="py-2.5 text-right">Subtotal (INR)</th>
                      <th className="py-2.5 text-right">Subtotal (Paise)</th>
                      <th className="py-2.5 text-right">Audit Trail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconData.registered_codes?.map((r: any) => {
                      const isExpanded = expandedReconCodes[r.code];
                      return (
                        <React.Fragment key={r.code}>
                          <tr className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                            <td className="py-2.5 font-mono font-bold text-indigo-700 dark:text-indigo-400">{r.code}</td>
                            <td className="py-2.5 text-right font-semibold">{r.use_count}</td>
                            <td className="py-2.5 text-right">{r.units}</td>
                            <td className="py-2.5 text-right font-medium">{formatINR(r.subtotal_inr)}</td>
                            <td className="py-2.5 text-right font-mono text-slate-500">{r.subtotal_paise?.toLocaleString()}</td>
                            <td className="py-2.5 text-right">
                              <button
                                onClick={() =>
                                  setExpandedReconCodes((prev) => ({
                                    ...prev,
                                    [r.code]: !prev[r.code]
                                  }))
                                }
                                className="rounded px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950"
                              >
                                {isExpanded ? "Hide Orders ▲" : `Inspect (${r.order_ids?.length || 0}) ▼`}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                              <td colSpan={6} className="p-3">
                                <p className="font-semibold text-slate-600 dark:text-slate-400">Attributed Order IDs:</p>
                                <div className="mt-1 flex flex-wrap gap-1.5 font-mono text-[11px]">
                                  {r.order_ids?.map((id: string) => (
                                    <span key={id} className="rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                      {id}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {(!reconData.registered_codes || reconData.registered_codes.length === 0) && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          No registered promo orders in this date range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Unregistered Uses List */}
            {reconData.unregistered_uses?.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
                <div className="flex items-center gap-2">
                  <span className="text-amber-600 dark:text-amber-400">⚠️</span>
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300">
                    Unregistered Codes Attempted ({reconData.unregistered_uses.length})
                  </h4>
                </div>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  Orders placed with codes not registered for this brand. Tracked separately to ensure creator contribution integrity is never distorted.
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-amber-200/60 uppercase text-amber-800 dark:border-amber-900 dark:text-amber-400">
                        <th className="py-2">Order ID</th>
                        <th className="py-2">Entered Code</th>
                        <th className="py-2">Timestamp (IST)</th>
                        <th className="py-2 text-right">Units</th>
                        <th className="py-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconData.unregistered_uses.map((u: any) => (
                        <tr key={u.order_id} className="border-b border-amber-100/60 dark:border-amber-900/40">
                          <td className="py-2 font-mono font-bold">{u.order_id}</td>
                          <td className="py-2 font-mono text-amber-700 dark:text-amber-300">{u.code_entered}</td>
                          <td className="py-2">{formatIST(u.used_at)}</td>
                          <td className="py-2 text-right">{u.units}</td>
                          <td className="py-2 text-right font-medium">{formatINR(u.subtotal_inr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Refund Deductions Log */}
            {reconData.refunds?.length > 0 && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/30 p-4 dark:border-rose-900/60 dark:bg-rose-950/20">
                <div className="flex items-center gap-2">
                  <span className="text-rose-600 dark:text-rose-400">↩</span>
                  <h4 className="text-sm font-bold text-rose-900 dark:text-rose-300">
                    Refund & Returns Audit Log ({reconData.refunds.length})
                  </h4>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-rose-200/60 uppercase text-rose-800 dark:border-rose-900 dark:text-rose-400">
                        <th className="py-2">Refund ID</th>
                        <th className="py-2">Order ID</th>
                        <th className="py-2">Processed (IST)</th>
                        <th className="py-2">Type</th>
                        <th className="py-2 text-right">Refund Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconData.refunds.map((ref: any) => (
                        <tr key={ref.refund_id} className="border-b border-rose-100/60 dark:border-rose-900/40">
                          <td className="py-2 font-mono font-bold">{ref.refund_id}</td>
                          <td className="py-2 font-mono">{ref.order_id}</td>
                          <td className="py-2">{formatIST(ref.created_at)}</td>
                          <td className="py-2">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              ref.is_full_refund ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}>
                              {ref.is_full_refund ? "Full Return" : "Partial Refund"}
                            </span>
                          </td>
                          <td className="py-2 text-right font-bold text-rose-700 dark:text-rose-300">
                            {formatINR(ref.amount_inr)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mathematical Formulation Reference Cards */}
        <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Authoritative C24 Net Contribution Formulation Rules
          </h4>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Enforced across all backend queries and reconciliation reconcilers:
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
              <p className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400">Retained Sales</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed dark:text-slate-300">
                <code>retained_orders = eligible_orders - full_returns</code><br />
                <code>sales = (retained_orders × aov × (1 - discount)) - partial_refunds</code>
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
              <p className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400">Pre-Fee Contribution</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed dark:text-slate-300">
                <code>pre_fee_contrib = retained_sales × margin_pct</code>
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
              <p className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400">Net Contribution</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed dark:text-slate-300">
                <code>net_contrib = pre_fee_contrib - creator_fee</code>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Redemptions Order Audit Drawer */}
      {activePromoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                  Order Audit Trail
                </span>
                <h3 className="mt-2 text-xl font-bold">
                  Redemptions for Promo Code: <span className="font-mono text-indigo-700 dark:text-indigo-400">{activePromoModal}</span>
                </h3>
              </div>
              <button
                onClick={() => setActivePromoModal(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-xs dark:bg-slate-800/50">
              <p className="font-semibold text-slate-700 dark:text-slate-300">Privacy & Integrity Rules:</p>
              <p className="text-slate-500 dark:text-slate-400">Customer PII is strictly excluded. Stored with integer paise precision.</p>
            </div>

            {loadingModal ? (
              <p className="py-12 text-center text-sm text-slate-500">Loading audit trail...</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 uppercase text-slate-500 dark:border-slate-700">
                      <th className="py-3">Order ID</th>
                      <th className="py-3">Customer ID</th>
                      <th className="py-3">Timestamp</th>
                      <th className="py-3">Validity</th>
                      <th className="py-3 text-right">Subtotal</th>
                      <th className="py-3 text-right">Discount</th>
                      <th className="py-3 text-right">Basis</th>
                      <th className="py-3 text-right">Net Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalRedemptions.map((o) => (
                      <tr key={o.order_id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                        <td className="py-3 font-mono font-bold">{renderOrUnknown(o.order_id)}</td>
                        <td className="py-3 font-mono text-slate-500 dark:text-slate-400">{renderOrUnknown(o.customer_id)}</td>
                        <td className="py-3 text-slate-600 dark:text-slate-300">{formatIST(o.used_at)}</td>
                        <td className="py-3">
                          <span className={`rounded-full px-2 py-0.5 font-semibold ${
                            o.validity_flag === "valid" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                          }`}>
                            {o.validity_flag}
                          </span>
                        </td>
                        <td className="py-3 text-right">{formatINR(o.subtotal_inr)}</td>
                        <td className="py-3 text-right">{formatINR(o.discount_inr)}</td>
                        <td className="py-3 text-right text-slate-500">{renderOrUnknown(o.discount_basis)}</td>
                        <td className="py-3 text-right font-bold">{formatINR(o.total_inr)}</td>
                      </tr>
                    ))}
                    {modalRedemptions.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No order redemptions recorded for this promo code yet.
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

      {/* Edit Validity Dates Modal */}
      {editingPromo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold">Edit Validity Window</h3>
                <p className="text-xs text-slate-500">
                  Promo Code: <span className="font-mono font-bold text-indigo-700 dark:text-indigo-400">{editingPromo.code}</span>
                </p>
              </div>
              <button onClick={() => setEditingPromo(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
            </div>

            {editStatusMsg && (
              <div className={`mt-4 rounded-xl p-3 text-xs ${
                editStatusMsg.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
              }`}>
                {editStatusMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Valid From (ISO with Timezone):</label>
                <input
                  type="text"
                  value={editValidFrom}
                  onChange={(e) => setEditValidFrom(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Valid To (ISO with Timezone):</label>
                <input
                  type="text"
                  value={editValidTo}
                  onChange={(e) => setEditValidTo(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPromo(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon }: { title: string; value: string; subtitle: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
          {icon}
        </span>
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 text-sm last:border-0 dark:border-slate-800">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}
