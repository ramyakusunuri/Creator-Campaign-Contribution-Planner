"use client";
import { useEffect, useState } from "react";

export default function CouponEditor({ creatorId, initial }: { creatorId: string; initial: string }) {
  const key = `coupon:${creatorId}`;
  const [code, setCode] = useState(initial);
  const [syncStatus, setSyncStatus] = useState<string>("");

  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v) setCode(v);
    } catch {}
    
    // Register initial code in backend if not already active
    if (initial && initial.length >= 3) {
      fetch('/api/brands/B1/promo-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Brand-Key': 'demo-brand-key-b1'
        },
        body: JSON.stringify({
          code: initial,
          creator_id: creatorId,
          starts_at: '2026-01-01T00:00:00.000Z',
          expires_at: '2026-12-31T23:59:59.000Z'
        })
      })
      .then((res) => {
        if (res.ok || res.status === 409) setSyncStatus("synced");
      })
      .catch(() => {});
    }
  }, [key, creatorId, initial]);

  const change = (v: string) => {
    const next = v.toUpperCase().replace(/\s/g, "");
    setCode(next);
    try {
      localStorage.setItem(key, next);
    } catch {}

    if (next.length >= 3) {
      fetch('/api/brands/B1/promo-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Brand-Key': 'demo-brand-key-b1'
        },
        body: JSON.stringify({
          code: next,
          creator_id: creatorId,
          starts_at: '2026-01-01T00:00:00.000Z',
          expires_at: '2026-12-31T23:59:59.000Z'
        })
      })
      .then((res) => {
        if (res.ok || res.status === 409) setSyncStatus("synced");
      })
      .catch(() => {});
    }
  };

  return (
    <div>
      <input
        value={code}
        onChange={(e) => change(e.target.value)}
        maxLength={20}
        aria-label="Coupon code"
        className="mt-2 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xl font-bold tracking-wider text-indigo-700 outline-none focus:border-indigo-500"
      />
      {syncStatus === "synced" && (
        <span className="mt-1 block text-[11px] font-semibold text-emerald-600">
          ✓ Active in store promo engine
        </span>
      )}
    </div>
  );
}
