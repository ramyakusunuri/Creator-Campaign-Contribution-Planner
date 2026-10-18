"use client";
import React, { useEffect, useState, useCallback } from "react";
import { money, shortMoney } from "../lib/format";

interface ProductAllocation {
  product_id: string;
  name: string;
  units: number;
  allocated_fee_paise: number | null;
  allocated_fee_inr: number | null;
}

interface CodeAllocation {
  code: string;
  units: number;
  allocated_fee_paise: number | null;
  allocated_fee_inr: number | null;
}

interface CreatorCpuRecord {
  brand_id: string;
  creator_id: string;
  creator_name: string;
  fee_inr: number | null;
  fee_paise: number | null;
  units_sold: number;
  cost_per_unit: number | null;
  cost_per_unit_paise: number | null;
  cost_per_kept_unit: number | null;
  status: "ok" | "fee_unknown" | "no_units";
  basis_text: string;
  reference_note: string;
  by_product: ProductAllocation[];
  by_code: CodeAllocation[];
}

interface CostPerUnitPanelProps {
  selectedBrand: string;
  brandKey: string;
  pulseTrigger?: number;
}

export function CostPerUnitPanel({ selectedBrand, brandKey, pulseTrigger }: CostPerUnitPanelProps) {
  const [cpuData, setCpuData] = useState<CreatorCpuRecord | null>(null);
  const [selectedCreator, setSelectedCreator] = useState("CR1");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchCpu = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/brands/${selectedBrand}/creators/${selectedCreator}/cost-per-unit`, {
        headers: { "X-Brand-Key": brandKey }
      });
      if (res.ok) {
        const data = await res.json();
        setCpuData(data);
        setLastUpdated(new Date().toLocaleTimeString("en-IN"));
      }
    } catch (err) {
      console.warn("Failed to fetch CPU:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedBrand, selectedCreator, brandKey]);

  useEffect(() => {
    fetchCpu();
  }, [fetchCpu, pulseTrigger]);

  // Listen to global cache invalidation event
  useEffect(() => {
    const handleInvalidate = () => {
      fetchCpu();
    };
    window.addEventListener("c24:use_recorded", handleInvalidate);
    window.addEventListener("c24:invalidate_queries", handleInvalidate);
    return () => {
      window.removeEventListener("c24:use_recorded", handleInvalidate);
      window.removeEventListener("c24:invalidate_queries", handleInvalidate);
    };
  }, [fetchCpu]);

  return (
    <section id="cost-per-unit" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 font-bold text-sm">
              ₹
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Dynamic Unit Economics</span>
          </div>
          <h2 className="mt-1 text-xl font-bold">Cost Per Unit Sold Live Layer</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Computed on read from integer paise. Automatically invalidates and recalculates upon every paid order event.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedCreator}
            onChange={(e) => setSelectedCreator(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="CR1">CR1 - Aarav Sharma</option>
            <option value="CR2">CR2 - Diya Patel</option>
            <option value="CR3">CR3 - Rohan Verma</option>
            <option value="CR4">CR4 - Ananya Singh</option>
            <option value="CR7">CR7 - Vivaan Rao</option>
            <option value="CR8">CR8 - Diya Malhotra</option>
          </select>
          <button
            onClick={fetchCpu}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
          >
            {loading ? "Calculating..." : "↻ Recalculate"}
          </button>
        </div>
      </div>

      {cpuData && (
        <div className="space-y-4">
          {/* Key Metric Tiles */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-xs font-medium text-slate-500">Creator Fee</span>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {cpuData.fee_inr !== null ? money(cpuData.fee_inr) : "Unknown"}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Total contracted fee</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-xs font-medium text-slate-500">Gross Units Sold</span>
              <p className="mt-1 text-2xl font-bold text-indigo-700">
                {cpuData.units_sold.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Tracked attribution volume</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Cost Per Unit</span>
              <p className="mt-1 text-2xl font-black text-emerald-700">
                {cpuData.status === "ok" && cpuData.cost_per_unit !== null
                  ? money(cpuData.cost_per_unit)
                  : cpuData.status === "fee_unknown"
                  ? "Fee Unknown"
                  : "No Units Sold"}
              </p>
              <p className="mt-1 text-[11px] text-emerald-700">Fee / Gross Units Sold</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-xs font-medium text-slate-500">Status &amp; Sync</span>
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  ● Real-Time Sync
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Updated: {lastUpdated || "Live"}</p>
            </div>
          </div>

          {/* Breakdown Tables: By Product and By Code */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* By Product */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Fee Allocation by Product</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 text-[11px] font-semibold text-slate-500">
                    <tr>
                      <th className="py-2">Product</th>
                      <th className="py-2 text-right">Units</th>
                      <th className="py-2 text-right">Allocated Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cpuData.by_product.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-slate-400 italic">No product volume yet.</td>
                      </tr>
                    ) : (
                      cpuData.by_product.map((p) => (
                        <tr key={p.product_id} className="hover:bg-slate-50/60">
                          <td className="py-2 font-medium text-slate-800">{p.name || p.product_id}</td>
                          <td className="py-2 text-right font-bold text-indigo-700">{p.units}</td>
                          <td className="py-2 text-right font-mono text-slate-700">{p.allocated_fee_inr !== null ? money(p.allocated_fee_inr) : "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* By Code */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Fee Allocation by Promo Code</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 text-[11px] font-semibold text-slate-500">
                    <tr>
                      <th className="py-2">Promo Code</th>
                      <th className="py-2 text-right">Units</th>
                      <th className="py-2 text-right">Allocated Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cpuData.by_code.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-slate-400 italic">No code volume yet.</td>
                      </tr>
                    ) : (
                      cpuData.by_code.map((c) => (
                        <tr key={c.code} className="hover:bg-slate-50/60">
                          <td className="py-2 font-mono font-bold text-indigo-700">{c.code}</td>
                          <td className="py-2 text-right font-bold text-indigo-700">{c.units}</td>
                          <td className="py-2 text-right font-mono text-slate-700">{c.allocated_fee_inr !== null ? money(c.allocated_fee_inr) : "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 italic">
            * {cpuData.basis_text}
          </p>
        </div>
      )}
    </section>
  );
}
