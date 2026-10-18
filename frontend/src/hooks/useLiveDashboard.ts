"use client";
import { useState, useEffect, useRef, useCallback } from "react";

export type ConnectionState = "live" | "reconnecting" | "offline";

export interface LiveEventItem {
  id: string;
  type: "use_recorded" | "unregistered_use_recorded" | "code_registered" | "code_updated";
  code: string | null;
  creator: string | null;
  time: string;
  receivedAt: string;
}

export interface PromoCodeItem {
  code: string;
  creator_id: string;
  valid_from: string;
  valid_to: string;
  status: "active" | "upcoming" | "expired";
  use_count: number;
  outside_validity_count: number;
  last_used_at: string | null;
  units: number;
  creator_fee: number | null;
  cost_per_unit: number | null;
  cost_per_unit_status: "ok" | "fee_unknown" | "no_units";
  cost_per_unit_basis: string;
  discount_inr: number | null;
  total_inr: number | null;
}

export interface UnregisteredUseItem {
  order_id: string;
  promo_code?: string;
  code_entered?: string;
  customer_id?: string;
  used_at: string;
  subtotal_inr: number;
  discount_inr?: number | null;
  total_inr?: number | null;
  status?: string;
}

export interface FeedStatusData {
  brand_id?: string;
  last_use_received_at: string | null;
  uses_by_source: {
    website: number;
    synthetic_seed: number;
  };
  unregistered_uses: number;
}

interface UseLiveDashboardOptions {
  brandId: string;
  brandKey: string;
}

export function useLiveDashboard({ brandId, brandKey }: UseLiveDashboardOptions) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>("reconnecting");
  const [liveEvents, setLiveEvents] = useState<LiveEventItem[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([]);
  const [unregisteredUses, setUnregisteredUses] = useState<UnregisteredUseItem[]>([]);
  const [feedStatus, setFeedStatus] = useState<FeedStatusData | null>(null);
  const [highlightedCodes, setHighlightedCodes] = useState<Set<string>>(new Set());
  const [screenReaderAnnouncement, setScreenReaderAnnouncement] = useState<string>("");

  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastAnnounceTimeRef = useRef<number>(0);

  // Announce polite message to screen reader throttled to at most once per 10 seconds
  const announce = useCallback((message: string) => {
    const now = Date.now();
    if (now - lastAnnounceTimeRef.current >= 10000) {
      lastAnnounceTimeRef.current = now;
      setScreenReaderAnnouncement(message);
    }
  }, []);

  // Highlight changed row briefly (skips if user prefers reduced motion)
  const triggerRowHighlight = useCallback((code: string | null) => {
    if (!code) return;
    const cleanCode = code.toUpperCase();
    if (typeof window !== "undefined") {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) return;
    }

    setHighlightedCodes((prev) => new Set(prev).add(cleanCode));
    setTimeout(() => {
      setHighlightedCodes((prev) => {
        const next = new Set(prev);
        next.delete(cleanCode);
        return next;
      });
    }, 2500);
  }, []);

  // Fetch full data snapshot
  const fetchPromoCodes = useCallback(async (bId = brandId, bKey = brandKey) => {
    try {
      const res = await fetch(`/api/brands/${bId}/promo-codes`, {
        headers: { "X-Brand-Key": bKey }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.promo_codes) ? data.promo_codes : []);
        setPromoCodes(list);
      }
    } catch {}
  }, [brandId, brandKey]);

  const fetchFeedStatus = useCallback(async (bId = brandId, bKey = brandKey) => {
    try {
      const res = await fetch(`/api/brands/${bId}/feed-status`, {
        headers: { "X-Brand-Key": bKey }
      });
      if (res.ok) {
        const data = await res.json();
        setFeedStatus(data);
      }
    } catch {}
  }, [brandId, brandKey]);

  const fetchUnregisteredUses = useCallback(async (bId = brandId, bKey = brandKey) => {
    try {
      const res = await fetch(`/api/brands/${bId}/unregistered-uses`, {
        headers: { "X-Brand-Key": bKey }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.unregistered_uses) ? data.unregistered_uses : []);
        setUnregisteredUses(list);
      }
    } catch {}
  }, [brandId, brandKey]);

  const fetchFullSnapshot = useCallback(async (bId = brandId, bKey = brandKey) => {
    await Promise.all([
      fetchPromoCodes(bId, bKey),
      fetchFeedStatus(bId, bKey),
      fetchUnregisteredUses(bId, bKey)
    ]);
  }, [fetchPromoCodes, fetchFeedStatus, fetchUnregisteredUses]);

  // Periodic polling: refetch promo codes every 60 seconds (code statuses change with time)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPromoCodes();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchPromoCodes]);

  // Event stream reader with watchdog and exponential backoff
  useEffect(() => {
    let isCancelled = false;

    // Reset brand-scoped state immediately when brand switches
    setLiveEvents([]);
    setPromoCodes([]);
    setUnregisteredUses([]);
    setFeedStatus(null);
    setConnectionStatus("reconnecting");
    reconnectAttemptRef.current = 0;

    // Helper to reset the 60-second watchdog timer
    const resetWatchdog = (onTimeout: () => void) => {
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = setTimeout(() => {
        onTimeout();
      }, 60000);
    };

    const cleanupTimersAndAbort = () => {
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (isCancelled) return;
      cleanupTimersAndAbort();
      setConnectionStatus("reconnecting");

      // Backoff strategy: 1, 2, 4, 8, 16, max 30 seconds
      const attempt = reconnectAttemptRef.current;
      const delay = Math.min(30000, 1000 * Math.pow(2, attempt));
      reconnectAttemptRef.current = attempt + 1;

      reconnectTimeoutRef.current = setTimeout(() => {
        if (!isCancelled) {
          connectToStream();
        }
      }, delay);
    };

    const connectToStream = async () => {
      if (isCancelled) return;
      cleanupTimersAndAbort();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        // Strict requirement: fetch with stream reader, sending key as header.
        // Never use EventSource. Never put key in URL.
        const res = await fetch(`/api/brands/${brandId}/events`, {
          headers: {
            "X-Brand-Key": brandKey,
            "Accept": "text/event-stream"
          },
          signal: controller.signal
        });

        if (!res.ok) {
          if (res.status === 429) {
            setConnectionStatus("offline");
            announce("Event stream connection rejected: too many active subscribers for this brand.");
          }
          scheduleReconnect();
          return;
        }

        if (!res.body) {
          scheduleReconnect();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");

        // Connected!
        setConnectionStatus("live");
        reconnectAttemptRef.current = 0;

        // Requirement: Refetch full data snapshot after every successful reconnect
        fetchFullSnapshot(brandId, brandKey);
        announce("Live event stream connected. Dashboard data snapshot refreshed.");

        // Watchdog: treat 60 seconds without data (including pings) as dropped
        resetWatchdog(() => {
          if (!isCancelled) {
            scheduleReconnect();
          }
        });

        let buffer = "";

        while (!isCancelled) {
          const { value, done } = await reader.read();
          if (done) break;

          // Received data or ping -> reset watchdog timer
          resetWatchdog(() => {
            if (!isCancelled) {
              scheduleReconnect();
            }
          });

          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split("\n\n");
          buffer = messages.pop() ?? "";

          for (const msg of messages) {
            const trimmed = msg.trim();
            if (!trimmed || trimmed === ": ping" || trimmed.startsWith(": connected") || trimmed.startsWith("retry:")) {
              continue; // heartbeat comments or retry hints
            }

            const lines = trimmed.split("\n");
            let eventType = "";
            let dataStr = "";

            for (const line of lines) {
              if (line.startsWith("event:")) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                dataStr = line.slice(5).trim();
              }
            }

            if (dataStr) {
              try {
                const parsed = JSON.parse(dataStr);
                const type = (eventType || parsed.type || "use_recorded") as LiveEventItem["type"];
                const newItem: LiveEventItem = {
                  id: Math.random().toString(36).slice(2) + Date.now().toString(36),
                  type,
                  code: parsed.code || null,
                  creator: parsed.creator || null,
                  time: parsed.time || new Date().toISOString(),
                  receivedAt: new Date().toISOString()
                };

                // Add to live events panel (prepend, max 50)
                setLiveEvents((prev) => [newItem, ...prev.slice(0, 49)]);

                // Highlight changed row
                triggerRowHighlight(newItem.code);

                // Polite screen-reader announcement (limited to once per 10s)
                const desc = type === "use_recorded"
                  ? `Redemption recorded for promo code ${newItem.code || "unknown"}`
                  : type === "unregistered_use_recorded"
                  ? `Unregistered promo code use received: ${newItem.code || "unknown"}`
                  : type === "code_registered"
                  ? `New promo code registered: ${newItem.code}`
                  : `Promo code updated: ${newItem.code}`;
                announce(desc);

                // Requirement: Refetch ONLY the affected views
                if (type === "use_recorded") {
                  fetchPromoCodes();
                  fetchFeedStatus();
                } else if (type === "unregistered_use_recorded") {
                  fetchFeedStatus();
                  fetchUnregisteredUses();
                } else if (type === "code_registered" || type === "code_updated") {
                  fetchPromoCodes();
                }
              } catch (err) {
                console.error("Failed to parse SSE payload:", err);
              }
            }
          }
        }

        // Stream ended normally or severed
        if (!isCancelled) {
          scheduleReconnect();
        }
      } catch (err: any) {
        if (!isCancelled && err?.name !== "AbortError") {
          scheduleReconnect();
        }
      }
    };

    connectToStream();

    return () => {
      isCancelled = true;
      cleanupTimersAndAbort();
    };
  }, [brandId, brandKey, fetchFullSnapshot, fetchPromoCodes, fetchFeedStatus, fetchUnregisteredUses, triggerRowHighlight, announce]);

  return {
    connectionStatus,
    liveEvents,
    promoCodes,
    unregisteredUses,
    feedStatus,
    highlightedCodes,
    screenReaderAnnouncement,
    fetchPromoCodes,
    fetchFeedStatus,
    fetchUnregisteredUses,
    fetchFullSnapshot
  };
}
