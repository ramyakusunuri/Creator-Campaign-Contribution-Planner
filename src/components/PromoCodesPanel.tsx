"use client";
import React, { useState } from "react";
import { PromoCodeItem } from "../hooks/useLiveDashboard";
import { formatIST } from "../lib/formatters";
import { money } from "../lib/format";

interface PromoCodesPanelProps {
  promoCodes: PromoCodeItem[];
  highlightedCodes: Set<string>;
  selectedBrand: string;
  brandKey: string;
  onRefresh: () => void;
}

export function PromoCodesPanel({
  promoCodes,
  highlightedCodes,
  selectedBrand,
  brandKey,
  onRefresh
}: PromoCodesPanelProps) {
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newCreator, setNewCreator] = useState("CR1");
  const [startsAt, setStartsAt] = useState("2026-01-01T00:00:00Z");
  const [expiresAt, setExpiresAt] = useState("2026-12-31T23:59:59Z");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);

  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    setRegisterSuccess(null);

    try {
      const res = await fetch(`/api/brands/${selectedBrand}/promo-codes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Brand-Key": brandKey
        },
        body: JSON.stringify({
          code: newCode.trim().toUpperCase(),
          creator_id: newCreator,
          starts_at: startsAt,
          expires_at: expiresAt
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to register code");
      }

      setRegisterSuccess(`Code ${data.code} successfully registered!`);
      setNewCode("");
      onRefresh();
      setTimeout(() => {
        setShowRegisterModal(false);
        setRegisterSuccess(null);
      }, 1200);
    } catch (err: any) {
      setRegisterError(err.message);
    }
  };

  const handleUpdateDates = async (code: string) => {
    try {
      const res = await fetch(`/api/brands/${selectedBrand}/promo-codes/${encodeURIComponent(code)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Brand-Key": brandKey
        },
        body: JSON.stringify({
          starts_at: editStartsAt,
          expires_at: editExpiresAt
        })
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert("Failed to update: " + (d.error || res.statusText));
        return;
      }

      setEditingCode(null);
      onRefresh();
    } catch (err: any) {
      alert("Error updating promo code dates: " + err.message);
    }
  };

  return (
    <section id="promo-codes" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-bold text-sm">
              🏷
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Real-Time Promo Engine</span>
          </div>
          <h2 className="mt-1 text-xl font-bold">Campaign Promo Codes &amp; Live Tracking</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time attribution feed active. Row flashes green and unit count increments immediately when orders are reported.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRegisterModal(!showRegisterModal)}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-sm"
          >
            {showRegisterModal ? "Close Form" : "+ Register Promo Code"}
          </button>
          <button
            onClick={onRefresh}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
            title="Refresh promo codes"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Registration Modal / Inline Form */}
      {showRegisterModal && (
        <form onSubmit={handleRegister} className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
            Register Promo Code (Brand {selectedBrand})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div>
              <label className="block text-slate-600 mb-1 font-medium">Promo Code</label>
              <input
                type="text"
                required
                placeholder="AARAV10"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-slate-200 p-2 font-mono uppercase bg-white outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-medium">Creator</label>
              <select
                required
                value={newCreator}
                onChange={(e) => setNewCreator(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2 font-mono bg-white text-xs outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="CR1">CR1 - Aarav Sharma</option>
                <option value="CR2">CR2 - Diya Patel</option>
                <option value="CR3">CR3 - Rohan Verma</option>
                <option value="CR4">CR4 - Ananya Singh</option>
                <option value="CR7">CR7 - Vivaan Rao</option>
                <option value="CR8">CR8 - Diya Malhotra</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-medium">Starts At (ISO)</label>
              <input
                type="text"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2 font-mono text-[11px] bg-white outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-medium">Expires At (ISO)</label>
              <input
                type="text"
                required
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2 font-mono text-[11px] bg-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {registerError && <p className="text-xs font-semibold text-rose-600">{registerError}</p>}
          {registerSuccess && <p className="text-xs font-semibold text-emerald-600">{registerSuccess}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowRegisterModal(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Submit Registration
            </button>
          </div>
        </form>
      )}

      {/* Promo Codes Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Creator</th>
              <th className="px-4 py-3">Validity Window</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Uses</th>
              <th className="px-4 py-3 text-right">Units</th>
              <th className="px-4 py-3 text-right">Cost / Unit</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {promoCodes.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                  No registered promo codes found for Brand {selectedBrand}. Click &quot;+ Register Promo Code&quot; to add one.
                </td>
              </tr>
            ) : (
              promoCodes.map((p) => {
                const isHighlighted = highlightedCodes.has(p.code);
                const isEditing = editingCode === p.code;
                return (
                  <tr
                    key={p.code}
                    id={`promo-row-${p.code}`}
                    className={`transition-all duration-500 ${
                      isHighlighted
                        ? "bg-emerald-100/95 ring-2 ring-emerald-500 font-semibold animate-pulse"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700">{p.code}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{p.creator_id}</td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={editStartsAt}
                            onChange={(e) => setEditStartsAt(e.target.value)}
                            className="rounded border p-1 text-[10px] w-32 font-mono"
                          />
                          <input
                            type="text"
                            value={editExpiresAt}
                            onChange={(e) => setEditExpiresAt(e.target.value)}
                            className="rounded border p-1 text-[10px] w-32 font-mono"
                          />
                        </div>
                      ) : (
                        <span>
                          {formatIST(p.valid_from)} &rarr; {formatIST(p.valid_to)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          p.status === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : p.status === "upcoming"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {p.use_count}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-700">
                      <span className={`inline-block px-1.5 py-0.5 rounded ${isHighlighted ? 'bg-emerald-200 text-emerald-950 scale-110 font-black transition-transform' : ''}`}>
                        {p.units}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {p.cost_per_unit_status === "ok" && p.cost_per_unit !== null
                        ? money(p.cost_per_unit)
                        : p.cost_per_unit_status === "fee_unknown"
                        ? "fee unknown"
                        : "no units"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleUpdateDates(p.code)}
                            className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingCode(null)}
                            className="rounded bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingCode(p.code);
                            setEditStartsAt(p.valid_from);
                            setEditExpiresAt(p.valid_to);
                          }}
                          className="rounded border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100"
                        >
                          Edit Dates
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400 italic">
        * As paid orders are ingested from the Atelier 24 store, units and uses increment automatically without page refresh.
      </p>
    </section>
  );
}
