"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { formatIST } from "@/lib/formatters";

interface FeedStatus {
  last_use_received_at: string | null;
  uses_by_source: {
    website: number;
    synthetic_seed: number;
  };
  unregistered_uses: number;
}

interface BrandContextType {
  selectedBrand: string;
  brandKey: string;
  agencyKey: string;
  setSelectedBrand: (b: string) => void;
  setBrandKey: (k: string) => void;
  setAgencyKey: (k: string) => void;
  connectionStatus: "connected" | "connecting" | "disconnected";
  setConnectionStatus: (s: "connected" | "connecting" | "disconnected") => void;
  feedStatus: FeedStatus | null;
  setFeedStatus: React.Dispatch<React.SetStateAction<FeedStatus | null>>;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const BrandContext = createContext<BrandContextType | null>(null);

export function useBrand() {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error("useBrand must be used within an AppShell");
  return ctx;
}

const NAV_ITEMS = [
  { id: "planner", label: "Planner", icon: "▦", href: "#planner", subtitle: "Budget optimization" },
  { id: "finder", label: "Finder", icon: "♙", href: "#finder", subtitle: "Creator discovery & roster" },
  { id: "promo-codes", label: "Promo codes", icon: "🏷", href: "#promo-codes", subtitle: "Registration & tracking" },
  { id: "live-feed", label: "Live feed", icon: "⚡", href: "#live-feed", subtitle: "Real-time event stream" },
  { id: "cost-per-unit", label: "Cost per unit", icon: "₹", href: "#cost-per-unit", subtitle: "Fee allocation & unit volume" },
  { id: "experiments", label: "Experiments", icon: "✳", href: "#experiments", subtitle: "Scenario modeling" },
  { id: "evidence", label: "Evidence", icon: "🛡", href: "#evidence", subtitle: "Reconciliation & returns" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [selectedBrand, setSelectedBrand] = useState("B1");
  const [brandKey, setBrandKey] = useState("b1_secret_key");
  const [agencyKey, setAgencyKey] = useState("demo-agency-key");
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "disconnected">("connecting");
  const [feedStatus, setFeedStatus] = useState<FeedStatus | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("planner");

  // Dark mode initial check and toggle
  useEffect(() => {
    const isDark = localStorage.getItem("c24_theme") === "dark" ||
      (!("c24_theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("c24_theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("c24_theme", "light");
      }
      return next;
    });
  };

  const handleBrandChange = (brand: string) => {
    setSelectedBrand(brand);
    setBrandKey(brand === "B1" ? "b1_secret_key" : "b2_secret_key");
  };

  return (
    <BrandContext.Provider
      value={{
        selectedBrand,
        brandKey,
        agencyKey,
        setSelectedBrand: handleBrandChange,
        setBrandKey,
        setAgencyKey,
        connectionStatus,
        setConnectionStatus,
        feedStatus,
        setFeedStatus,
        darkMode,
        toggleDarkMode,
      }}
    >
      <div className={`min-h-screen ${darkMode ? "dark bg-slate-950 text-slate-100" : "bg-[#f6f7fb] text-slate-900"}`}>
        {/* Skip to Content for Keyboard Accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-xl focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-white"
        >
          Skip to main content
        </a>

        {/* Desktop Sidebar (Persistent across route changes) */}
        <aside
          aria-label="Main Navigation"
          className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:block z-30"
        >
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white shadow-md shadow-indigo-600/30">
              C
            </div>
            <div>
              <p className="font-bold tracking-tight">CreatorIQ</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Campaign Planner (C24)</p>
            </div>
          </div>

          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Platform Sections
          </p>

          <nav className="space-y-1.5" role="navigation" aria-label="Section Links">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={() => setActiveSection(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <div className="min-w-0">
                    <p className="leading-tight">{item.label}</p>
                    <p className="text-[10px] font-normal text-slate-400 dark:text-slate-500 truncate">{item.subtitle}</p>
                  </div>
                </a>
              );
            })}
          </nav>

          {/* Quick Info Badge in Sidebar */}
          <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Environment</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                Demo
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Integer paise storage active with zero drift.
            </p>
          </div>
        </aside>

        {/* Main Layout Area */}
        <div className="lg:pl-64 flex flex-col min-h-screen">
          {/* Top Header */}
          <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-3.5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 sm:px-8">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle Navigation Menu"
                className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-800 dark:text-slate-300 lg:hidden"
              >
                ☰
              </button>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Marketing / Creator campaigns (C24)</p>
                <h1 className="text-lg font-bold sm:text-xl">Campaign Contribution Shell</h1>
              </div>
            </div>

            {/* Header Controls: Brand, Agency Key, Status, Theme */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Brand Switcher */}
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Brand:</span>
                <select
                  value={selectedBrand}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  className="bg-transparent font-bold text-indigo-700 outline-none dark:text-indigo-400"
                >
                  <option value="B1">B1 · Brand Nova</option>
                  <option value="B2">B2 · Brand Zenith</option>
                </select>
              </div>

              {/* Agency Key Input */}
              <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs dark:border-slate-800 dark:bg-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Agency Key:</span>
                <input
                  type="password"
                  value={agencyKey}
                  onChange={(e) => setAgencyKey(e.target.value)}
                  className="w-24 bg-transparent font-mono text-[11px] outline-none"
                  placeholder="X-Agency-Key"
                  title="Agency level key for shared creator writes"
                />
              </div>

              {/* Live SSE Status Badge */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  connectionStatus === "connected"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
                    : connectionStatus === "connecting"
                    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
                    : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-400"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    connectionStatus === "connected"
                      ? "bg-emerald-500 animate-pulse"
                      : connectionStatus === "connecting"
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                />
                <span className="hidden sm:inline">
                  {connectionStatus === "connected" ? "Live Connected" : connectionStatus === "connecting" ? "Connecting..." : "Disconnected"}
                </span>
              </span>

              {/* Dark Mode Toggle */}
              <button
                type="button"
                onClick={toggleDarkMode}
                aria-label="Toggle dark mode"
                className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-semibold hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                {darkMode ? "☀️" : "🌙"}
              </button>
            </div>
          </header>

          {/* Mobile Drawer */}
          {mobileMenuOpen && (
            <div className="border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
              <nav className="grid grid-cols-2 gap-2" role="navigation">
                {NAV_ITEMS.map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    onClick={() => {
                      setActiveSection(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-2 rounded-lg p-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </a>
                ))}
              </nav>
            </div>
          )}

          {/* Feed Status Summary Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-2.5 text-xs text-slate-600 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 sm:px-8">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <span className="text-slate-500 dark:text-slate-500">Website Redemptions:</span>{" "}
                <span className="font-bold text-indigo-700 dark:text-indigo-400">{feedStatus?.uses_by_source?.website ?? 0}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-500">Synthetic Seed:</span>{" "}
                <span className="font-bold text-slate-700 dark:text-slate-300">{feedStatus?.uses_by_source?.synthetic_seed ?? 0}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-500">Unregistered Uses:</span>{" "}
                <span
                  className={`font-bold ${
                    (feedStatus?.unregistered_uses ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {feedStatus?.unregistered_uses ?? 0}
                </span>
              </div>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500">Last Ingestion:</span>{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">{formatIST(feedStatus?.last_use_received_at)}</span>
            </div>
          </div>

          {/* Persistent Page Content Container */}
          <main id="main-content" tabIndex={-1} className="flex-1 focus-visible:outline-none">
            {children}
          </main>
        </div>
      </div>
    </BrandContext.Provider>
  );
}
