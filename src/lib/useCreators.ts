"use client";
import { useEffect, useState } from "react";
import { initialCreators, type Creator } from "./creators";
import { fetchCreators } from "./creators-db";

export interface LiveOrderInfo {
  order_id: string;
  customer_id: string;
  creator_id: string;
  creator_name?: string;
  promo_code: string;
  discount_percent: number;
  discount_inr: number;
  total_inr: number;
  items: Array<{ name: string; quantity: number; unit_price_inr: number }>;
  placed_at: string;
}

// Starts with the bundled list (instant render), then integrates DB and live storefront orders in real time.
export function useCreators(): Creator[] {
  const [baseList, setBaseList] = useState<Creator[]>(initialCreators);
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;

    // Fetch base creators
    fetchCreators().then(l => {
      if (active && l && l.length > 0) {
        setBaseList(l);
      }
    });

    // Poll live order counts every 2 seconds
    const pollLiveCounts = async () => {
      try {
        const res = await fetch('/api/orders/live', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (active && data && data.counts) {
            setLiveCounts(data.counts);
          }
        }
      } catch {
        // Silently tolerate transient network poll delays
      }
    };

    pollLiveCounts();
    const timer = setInterval(pollLiveCounts, 2000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return baseList.map(c => {
    const extra = liveCounts[c.slug] || 0;
    return extra > 0 ? { ...c, orders: c.orders + extra } : c;
  });
}

// Hook providing the live order stream for dashboard toast/banner notifications
export function useLiveOrders() {
  const [orders, setOrders] = useState<LiveOrderInfo[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch('/api/orders/live', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (active && data && Array.isArray(data.recent)) {
            setOrders(data.recent);
            setTotalCount(data.total || data.recent.length);
          }
        }
      } catch {}
    };

    poll();
    const timer = setInterval(poll, 2000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return {
    recentOrders: orders,
    latestOrder: orders.length > 0 ? orders[0] : null,
    totalCount
  };
}
