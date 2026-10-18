"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { initialCreators, categories, profit, optimize, DEFAULT_BUDGET, BUDGET_KEY } from "../lib/creators";
import { money, shortMoney } from "../lib/format";
import { parseBatchUrls, parseAndValidateCsv, DEFAULT_TIER_SETTINGS } from "../lib/finder";
import { useBrand } from "../components/AppShell";
import { useLiveDashboard, PromoCodeItem, LiveEventItem } from "../hooks/useLiveDashboard";
import { formatIST } from "../lib/formatters";

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

interface CostPerUnitData {
  brand_id: string;
  creator_id: string;
  creator_name: string;
  fee_inr: number | null;
  fee_paise: number | null;
  units_sold: number;
  cost_per_unit: number | null;
  cost_per_unit_paise: number | null;
  cost_per_kept_unit: number | null;
  status: 'ok' | 'fee_unknown' | 'no_units';
  basis_text: string;
  reference_note: string;
  by_product: ProductAllocation[];
  by_code: CodeAllocation[];
  refunds: Array<{ order_id: string; amount_inr: number; reason?: string }>;
}

interface RankedCreatorItem {
  creator_id: string;
  name: string;
  platform: 'youtube' | 'instagram';
  handle: string;
  canonical_url: string;
  count: number | null;
  exact_or_rounded: 'exact' | 'rounded';
  hidden_flag: number;
  fetched_time: string;
  tier: string;
  rank: number | null;
  stale: boolean;
  category: string;
  excluded: boolean;
  rival_conflict: boolean;
  refusal_reason?: string;
}

interface ShortlistItem {
  brand_id: string;
  creator_id: string;
  name: string;
  handle: string;
  platform: string;
  added_at: string;
  notes: string | null;
}

export default function Home() {
  const brandCtx = useBrand();
  const [localBrand, setLocalBrand] = useState("B1");
  const selectedBrand = localBrand;
  const brandKey = selectedBrand === "B1" ? "b1_secret_key" : "b2_secret_key";
  const setSelectedBrand = (b: string) => {
    setLocalBrand(b);
    if (brandCtx?.setSelectedBrand) brandCtx.setSelectedBrand(b);
  };

  const {
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
  } = useLiveDashboard({ brandId: selectedBrand, brandKey });

  // Sync connection status & feed status to AppShell context
  useEffect(() => {
    if (brandCtx?.setConnectionStatus) {
      brandCtx.setConnectionStatus(connectionStatus);
    }
  }, [connectionStatus, brandCtx]);

  useEffect(() => {
    if (feedStatus && brandCtx?.setFeedStatus) {
      brandCtx.setFeedStatus(feedStatus);
    }
  }, [feedStatus, brandCtx]);

  // Promo code registration form state
  const [newPromoCode, setNewPromoCode] = useState("");
  const [newPromoCreator, setNewPromoCreator] = useState("CR1");
  const [newPromoStarts, setNewPromoStarts] = useState("2026-01-01T00:00:00Z");
  const [newPromoExpires, setNewPromoExpires] = useState("2026-12-31T23:59:59Z");
  const [promoRegisterError, setPromoRegisterError] = useState<string | null>(null);
  const [promoRegisterSuccess, setPromoRegisterSuccess] = useState<string | null>(null);
  const [showPromoRegisterModal, setShowPromoRegisterModal] = useState(false);

  // Promo code inline date edit state
  const [editingPromoCode, setEditingPromoCode] = useState<string | null>(null);
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editDateError, setEditDateError] = useState<string | null>(null);

  // Reconciliation state (Phase B4 / F4)
  const [reconFrom, setReconFrom] = useState("2026-01-01T00:00:00.000Z");
  const [reconTo, setReconTo] = useState("2026-12-31T23:59:59.000Z");
  const [reconResult, setReconResult] = useState<any>(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconError, setReconError] = useState<string | null>(null);

  const handleRegisterPromoCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromoRegisterError(null);
    setPromoRegisterSuccess(null);
    try {
      const res = await fetch(`/api/brands/${selectedBrand}/promo-codes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Brand-Key": brandKey
        },
        body: JSON.stringify({
          code: newPromoCode,
          creator_id: newPromoCreator,
          starts_at: newPromoStarts,
          expires_at: newPromoExpires
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoRegisterError(data.error || "Failed to register promo code");
      } else {
        setPromoRegisterSuccess(`Promo code "${data.code}" successfully registered!`);
        setNewPromoCode("");
        setShowPromoRegisterModal(false);
        fetchPromoCodes();
      }
    } catch (err: any) {
      setPromoRegisterError(err.message || "Network error");
    }
  };

  const handleUpdatePromoDates = async (code: string) => {
    setEditDateError(null);
    try {
      const res = await fetch(`/api/brands/${selectedBrand}/promo-codes/${code}`, {
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
      const data = await res.json();
      if (!res.ok) {
        setEditDateError(data.error || "Failed to update validity dates");
      } else {
        setEditingPromoCode(null);
        fetchPromoCodes();
      }
    } catch (err: any) {
      setEditDateError(err.message || "Failed to update validity dates");
    }
  };

  const handleRunReconciliation = async () => {
    setReconLoading(true);
    setReconError(null);
    try {
      const res = await fetch(
        `/api/brands/${selectedBrand}/reconciliation?from=${encodeURIComponent(reconFrom)}&to=${encodeURIComponent(reconTo)}`,
        {
          headers: {
            "X-Brand-Key": brandKey
          }
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setReconError(data.error || `HTTP ${res.status}`);
      } else {
        setReconResult(data);
      }
    } catch (err: any) {
      setReconError(err.message || "Failed to run reconciliation");
    } finally {
      setReconLoading(false);
    }
  };

  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(BUDGET_KEY));
      if (v > 0) setBudget(v);
    } catch {}
  }, []);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<number[] | null>(null);
  const [creatorsList, setCreatorsList] = useState(initialCreators);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  // Fetch raw uncalculated base inputs from the database via /api/creators
  useEffect(() => {
    fetch(`/api/creators?brand_id=${selectedBrand}`)
      .then((res) => {
        if (!res.ok) throw new Error('API fetch failed');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((c: any, index: number) => ({
            id: index + 1,
            slug: c.slug || c.creator_id,
            name: c.name,
            category: c.category,
            orders: typeof c.orders === 'number' && c.orders > 0 ? c.orders : 1000,
            discount: typeof c.discount === 'number' ? c.discount : 10,
            sp: typeof c.sp === 'number' && c.sp > 0 ? c.sp : 1500,
            cp: typeof c.cp === 'number' && c.cp > 0 ? c.cp : 600,
            fee: typeof c.fee === 'number' && c.fee > 0 ? c.fee : 200000
          }));
          setCreatorsList(mapped);
          setIsDbLoaded(true);
        }
      })
      .catch((err) => {
        console.warn('Fallback to default creators:', err);
      });
  }, [selectedBrand]);

  const recommendation = useMemo(() => optimize(creatorsList, budget), [creatorsList, budget]);
  const activeIds = selected ?? recommendation.creators.map((c) => c.id);
  const chosen = creatorsList.filter((c) => activeIds.includes(c.id));
  const spend = chosen.reduce((s, c) => s + c.fee, 0);
  // Dynamically calculate profit on read — never using stored calculated values
  const totalProfit = chosen.reduce((s, c) => s + profit(c), 0);
  const orders = chosen.reduce((s, c) => s + c.orders, 0);
  const shown = creatorsList.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) &&
      (category === "All" || c.category === category)
  );

  const toggle = (id: number) =>
    setSelected((prev) => {
      const ids = prev ?? recommendation.creators.map((c) => c.id);
      return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    });

  // --- Phase 5 (B5 & F5) Cost Per Unit Live State ---
  const [cpuScenario, setCpuScenario] = useState<'live' | 'benchmark_4' | 'benchmark_5' | 'split_3' | 'fee_unknown' | 'no_units' | 'zero_fee'>('live');
  const [livePulse, setLivePulse] = useState(false);
  const [liveCpuData, setLiveCpuData] = useState<CostPerUnitData | null>(null);

  const fetchLiveCpu = useCallback(async (bId = selectedBrand, bKey = brandKey) => {
    try {
      const res = await fetch(`/api/brands/${bId}/creators/CR1/cost-per-unit`, {
        headers: { "X-Brand-Key": bKey }
      });
      if (res.ok) {
        const data = await res.json();
        setLiveCpuData(data);
      }
    } catch {}
  }, [selectedBrand, brandKey]);

  useEffect(() => {
    fetchLiveCpu();
  }, [fetchLiveCpu]);

  const cpuData: CostPerUnitData = useMemo(() => {
    if (cpuScenario === 'live' && liveCpuData) {
      return liveCpuData;
    }
    if (cpuScenario === 'benchmark_4') {
      return {
        brand_id: 'B1',
        creator_id: 'CR1',
        creator_name: 'Aarav Sharma',
        fee_inr: 20000,
        fee_paise: 2000000,
        units_sold: 4,
        cost_per_unit: 5000,
        cost_per_unit_paise: 500000,
        cost_per_kept_unit: null,
        status: 'ok',
        basis_text: 'Gross units; returns not deducted as returned quantities are not tracked',
        reference_note: 'Creator fee is sourced from agency reference data.',
        by_product: [
          { product_id: 'P1', name: 'Product 1 (Casual Denim)', units: 3, allocated_fee_paise: 1500000, allocated_fee_inr: 15000 },
          { product_id: 'P2', name: 'Product 2 (Classic Tee)', units: 1, allocated_fee_paise: 500000, allocated_fee_inr: 5000 }
        ],
        by_code: [
          { code: 'A', units: 3, allocated_fee_paise: 1500000, allocated_fee_inr: 15000 },
          { code: 'B', units: 1, allocated_fee_paise: 500000, allocated_fee_inr: 5000 }
        ],
        refunds: []
      };
    }
    if (cpuScenario === 'benchmark_5') {
      return {
        brand_id: 'B1',
        creator_id: 'CR1',
        creator_name: 'Aarav Sharma',
        fee_inr: 20000,
        fee_paise: 2000000,
        units_sold: 5,
        cost_per_unit: 4000,
        cost_per_unit_paise: 400000,
        cost_per_kept_unit: null,
        status: 'ok',
        basis_text: 'Gross units; returns not deducted as returned quantities are not tracked',
        reference_note: 'Creator fee is sourced from agency reference data.',
        by_product: [
          { product_id: 'P1', name: 'Product 1 (Casual Denim)', units: 4, allocated_fee_paise: 1600000, allocated_fee_inr: 16000 },
          { product_id: 'P2', name: 'Product 2 (Classic Tee)', units: 1, allocated_fee_paise: 400000, allocated_fee_inr: 4000 }
        ],
        by_code: [
          { code: 'A', units: 4, allocated_fee_paise: 1600000, allocated_fee_inr: 16000 },
          { code: 'B', units: 1, allocated_fee_paise: 400000, allocated_fee_inr: 4000 }
        ],
        refunds: []
      };
    }
    if (cpuScenario === 'split_3') {
      return {
        brand_id: 'B1',
        creator_id: 'CR1',
        creator_name: 'Aarav Sharma',
        fee_inr: 20000,
        fee_paise: 2000000,
        units_sold: 3,
        cost_per_unit: 6666.67,
        cost_per_unit_paise: 666667,
        cost_per_kept_unit: null,
        status: 'ok',
        basis_text: 'Gross units; returns not deducted as returned quantities are not tracked',
        reference_note: 'Creator fee is sourced from agency reference data.',
        by_product: [
          { product_id: 'P1', name: 'Product 1', units: 2, allocated_fee_paise: 1333333, allocated_fee_inr: 13333.33 },
          { product_id: 'P2', name: 'Product 2', units: 1, allocated_fee_paise: 666667, allocated_fee_inr: 6666.67 }
        ],
        by_code: [
          { code: 'A', units: 3, allocated_fee_paise: 2000000, allocated_fee_inr: 20000 }
        ],
        refunds: []
      };
    }
    if (cpuScenario === 'zero_fee') {
      return {
        brand_id: 'B1',
        creator_id: 'CR1',
        creator_name: 'Aarav Sharma',
        fee_inr: 0,
        fee_paise: 0,
        units_sold: 4,
        cost_per_unit: 0,
        cost_per_unit_paise: 0,
        cost_per_kept_unit: 0,
        status: 'ok',
        basis_text: 'Gross units; zero fee yields 0.00 cost per unit',
        reference_note: 'Creator fee is sourced from agency reference data.',
        by_product: [
          { product_id: 'P1', name: 'Product 1', units: 3, allocated_fee_paise: 0, allocated_fee_inr: 0 },
          { product_id: 'P2', name: 'Product 2', units: 1, allocated_fee_paise: 0, allocated_fee_inr: 0 }
        ],
        by_code: [
          { code: 'A', units: 3, allocated_fee_paise: 0, allocated_fee_inr: 0 },
          { code: 'B', units: 1, allocated_fee_paise: 0, allocated_fee_inr: 0 }
        ],
        refunds: []
      };
    }
    if (cpuScenario === 'fee_unknown') {
      return {
        brand_id: 'B1',
        creator_id: 'CR6',
        creator_name: 'Pooja Nair',
        fee_inr: null,
        fee_paise: null,
        units_sold: 2,
        cost_per_unit: null,
        cost_per_unit_paise: null,
        cost_per_kept_unit: null,
        status: 'fee_unknown',
        basis_text: 'Gross units; returns not deducted as returned quantities are not tracked',
        reference_note: 'Creator fee is sourced from agency reference data.',
        by_product: [],
        by_code: [],
        refunds: []
      };
    }
    return {
      brand_id: 'B1',
      creator_id: 'CR2',
      creator_name: 'Diya Patel',
      fee_inr: 20000,
      fee_paise: 2000000,
      units_sold: 0,
      cost_per_unit: null,
      cost_per_unit_paise: null,
      cost_per_kept_unit: null,
      status: 'no_units',
      basis_text: 'Gross units; returns not deducted as returned quantities are not tracked',
      reference_note: 'Creator fee is sourced from agency reference data.',
      by_product: [],
      by_code: [],
      refunds: []
    };
  }, [cpuScenario]);

  const handleScenarioChange = (s: typeof cpuScenario) => {
    setLivePulse(true);
    setCpuScenario(s);
    setTimeout(() => setLivePulse(false), 600);
  };

  // --- Phase 6 (F6) Creator Finder & Shortlist State ---
  const [urlInput, setUrlInput] = useState(
    `https://youtube.com/@aaravstyle\nhttps://instagram.com/diyaglow\nhttps://youtube.com/@aaravstyle\nhttps://disallowed-host.com/profile`
  );
  const [urlParseResults, setUrlParseResults] = useState<any[]>([]);
  const [urlParseSummary, setUrlParseSummary] = useState<{ valid: number; invalid: number; duplicate: number } | null>(null);

  const [csvInput, setCsvInput] = useState(
    `creator_id,platform,canonical_url,count,exact_or_rounded,hidden\nC1,youtube,https://youtube.com/@aaravstyle,250000,rounded,false\nC2,instagram,https://instagram.com/diyaglow,480000,exact,false\nC3,youtube,https://youtube.com/@kabirreviews,null,rounded,true`
  );
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvSuccessMessage, setCsvSuccessMessage] = useState<string | null>(null);

  const [rankingPlatform, setRankingPlatform] = useState<'all' | 'youtube' | 'instagram'>('all');
  const [rankingEligibility, setRankingEligibility] = useState<'all' | 'eligible' | 'conflicted'>('all');
  const [tierAssumptions, setTierAssumptions] = useState(DEFAULT_TIER_SETTINGS);
  const [showAssumptionsDrawer, setShowAssumptionsDrawer] = useState(false);

  // Brand-Scoped Shortlist from SQLite backend
  const [shortlist, setShortlist] = useState<ShortlistItem[]>([]);
  const [shortlistFeedback, setShortlistFeedback] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const fetchShortlist = useCallback(async (bId = selectedBrand, bKey = brandKey) => {
    try {
      const res = await fetch(`/api/brands/${bId}/shortlist`, {
        headers: { "X-Brand-Key": bKey }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.shortlist)) {
          setShortlist(data.shortlist);
        }
      }
    } catch {}
  }, [selectedBrand, brandKey]);

  useEffect(() => {
    fetchShortlist();
  }, [fetchShortlist]);

  // Initial rich creator dataset for ranking
  const rawCatalog: RankedCreatorItem[] = useMemo(() => [
    {
      creator_id: 'CR1',
      name: 'Aarav Sharma',
      platform: 'youtube',
      handle: '@aaravstyle',
      canonical_url: 'https://youtube.com/@aaravstyle',
      count: 250000,
      exact_or_rounded: 'rounded',
      hidden_flag: 0,
      fetched_time: new Date(Date.now() - 86400000).toISOString(),
      tier: 'macro',
      rank: 1,
      stale: false,
      category: 'Fashion & Lifestyle',
      excluded: false,
      rival_conflict: false
    },
    {
      creator_id: 'CR2',
      name: 'Diya Patel',
      platform: 'instagram',
      handle: '@diyaglow',
      canonical_url: 'https://instagram.com/diyaglow',
      count: 480000,
      exact_or_rounded: 'exact',
      hidden_flag: 0,
      fetched_time: new Date(Date.now() - 172800000).toISOString(),
      tier: 'macro',
      rank: 1,
      stale: false,
      category: 'Beauty & Skincare',
      excluded: false,
      rival_conflict: false
    },
    {
      creator_id: 'CR3',
      name: 'Rohan Mehta',
      platform: 'youtube',
      handle: '@rohangames',
      canonical_url: 'https://youtube.com/@rohangames',
      count: 1200000,
      exact_or_rounded: 'rounded',
      hidden_flag: 0,
      fetched_time: new Date(Date.now() - 800000000).toISOString(), // > 7 days (stale)
      tier: 'mega',
      rank: 2,
      stale: true,
      category: 'Gaming & Tech',
      excluded: false,
      rival_conflict: true,
      refusal_reason: 'Refused: Active rival relationship conflict with Brand B2.'
    },
    {
      creator_id: 'CR4',
      name: 'Ananya Iyer',
      platform: 'instagram',
      handle: '@ananyafit',
      canonical_url: 'https://instagram.com/ananyafit',
      count: 85000,
      exact_or_rounded: 'rounded',
      hidden_flag: 0,
      fetched_time: new Date(Date.now() - 43200000).toISOString(),
      tier: 'mid',
      rank: 2,
      stale: false,
      category: 'Fitness',
      excluded: false,
      rival_conflict: false
    },
    {
      creator_id: 'CR5',
      name: 'Kabir Verma',
      platform: 'youtube',
      handle: '@kabirreviews',
      canonical_url: 'https://youtube.com/@kabirreviews',
      count: 180000,
      exact_or_rounded: 'exact',
      hidden_flag: 0,
      fetched_time: new Date(Date.now() - 100000000).toISOString(),
      tier: 'macro',
      rank: 3,
      stale: false,
      category: 'Tech',
      excluded: true,
      rival_conflict: false,
      refusal_reason: 'Refused: Creator is excluded from brand campaigns (compliance review).'
    },
    {
      creator_id: 'CR6',
      name: 'Pooja Nair',
      platform: 'youtube',
      handle: '@poojanairvlogs',
      canonical_url: 'https://youtube.com/@poojanairvlogs',
      count: null, // Hidden count test case
      exact_or_rounded: 'rounded',
      hidden_flag: 1,
      fetched_time: new Date(Date.now() - 200000000).toISOString(),
      tier: 'unranked',
      rank: null,
      stale: false,
      category: 'Lifestyle',
      excluded: false,
      rival_conflict: false
    }
  ], []);

  // Filtered lists
  const rankedCreators = useMemo(() => {
    return rawCatalog.filter((c) => {
      if (c.hidden_flag === 1 || c.count === null) return false;
      if (rankingPlatform !== 'all' && c.platform !== rankingPlatform) return false;
      if (rankingEligibility === 'eligible' && (c.excluded || c.rival_conflict)) return false;
      if (rankingEligibility === 'conflicted' && !c.excluded && !c.rival_conflict) return false;
      return true;
    }).sort((a, b) => (b.count || 0) - (a.count || 0));
  }, [rawCatalog, rankingPlatform, rankingEligibility]);

  const unrankedCreators = useMemo(() => {
    return rawCatalog.filter((c) => {
      if (c.hidden_flag !== 1 && c.count !== null) return false;
      if (rankingPlatform !== 'all' && c.platform !== rankingPlatform) return false;
      return true;
    });
  }, [rawCatalog, rankingPlatform]);

  const handleParseUrls = async () => {
    try {
      const res = await fetch('/api/finder/parse-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlInput })
      });
      if (res.ok) {
        const data = await res.json();
        setUrlParseResults(data.results || []);
        setUrlParseSummary({
          valid: data.valid_count || 0,
          invalid: data.invalid_count || 0,
          duplicate: data.duplicate_count || 0
        });
        return;
      }
    } catch {}
    const res = parseBatchUrls(urlInput);
    setUrlParseResults(res.results);
    setUrlParseSummary({
      valid: res.valid_count,
      invalid: res.invalid_count,
      duplicate: res.duplicate_count
    });
  };

  const handleIngestCsv = async () => {
    try {
      const res = await fetch('/api/finder/csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agency-Key': 'demo-agency-key'
        },
        body: JSON.stringify({ csv: csvInput })
      });
      const data = await res.json();
      if (!res.ok) {
        setCsvErrors(data.errors || [data.error || 'Failed to ingest CSV']);
        setCsvSuccessMessage(null);
      } else {
        setCsvErrors([]);
        setCsvSuccessMessage(`Successfully committed ${data.count || data.rows?.length || 0} creator snapshots transactionally to SQLite with Agency Auth.`);
      }
    } catch (err: any) {
      setCsvErrors([err.message || 'Network error during CSV ingestion']);
      setCsvSuccessMessage(null);
    }
  };

  const handleAddToShortlist = async (creator: RankedCreatorItem) => {
    setShortlistFeedback(null);
    try {
      const res = await fetch(`/api/brands/${selectedBrand}/shortlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Brand-Key': brandKey
        },
        body: JSON.stringify({
          creator_id: creator.creator_id,
          notes: 'Added from Creator Finder table'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setShortlistFeedback({
          id: creator.creator_id,
          success: false,
          message: data.error || 'Failed to add creator to shortlist.'
        });
      } else {
        setShortlistFeedback({
          id: creator.creator_id,
          success: true,
          message: `Added ${creator.name} to Brand ${selectedBrand} shortlist (persisted in SQLite).`
        });
        fetchShortlist();
      }
    } catch (err: any) {
      setShortlistFeedback({
        id: creator.creator_id,
        success: false,
        message: err.message || 'Network error'
      });
    }
  };

  const handleRemoveFromShortlist = async (creatorId: string) => {
    try {
      const res = await fetch(`/api/brands/${selectedBrand}/shortlist/${creatorId}`, {
        method: 'DELETE',
        headers: { 'X-Brand-Key': brandKey }
      });
      if (res.ok) {
        fetchShortlist();
      }
    } catch {}
    setShortlist((prev) => prev.filter((s) => s.creator_id !== creatorId));
  };

  // --- Phase 9 (F9) Presentation Walkthrough Script State ---
  const [completedDemoSteps, setCompletedDemoSteps] = useState<number[]>([]);
  const toggleDemoStep = (stepNumber: number) => {
    setCompletedDemoSteps((prev) =>
      prev.includes(stepNumber) ? prev.filter((s) => s !== stepNumber) : [...prev, stepNumber]
    );
  };

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-900 focus:outline-none">
      {/* Phase 9 On-Screen Limits & Disclosures Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2.5 sm:px-8 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3 font-medium">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-500/25 text-amber-900 px-2 py-0.5 rounded">
            Platform Limits &amp; Disclosures
          </span>
          <span>Synthetic data in demo environment.</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-slate-600">
          <span>• Incremental share is a planning assumption, not a causal guarantee</span>
          <span>• Promo codes show attribution, not causation</span>
          <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
            Instance: Single WAL SQLite
          </span>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-6 lg:flex lg:flex-col z-20">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white shadow-md shadow-indigo-200">
            C
          </div>
          <div>
            <p className="font-bold">CreatorIQ</p>
            <p className="text-xs text-slate-500">Campaign Planner</p>
          </div>
        </div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Workspace</p>
        <nav className="space-y-1.5" aria-label="Main Navigation">
          <a className="block rounded-xl px-4 py-2.5 text-slate-600 hover:bg-slate-100 transition focus:ring-2 focus:ring-indigo-500" href="#overview">
            ▦ Overview
          </a>
          <a className="block rounded-xl px-4 py-2.5 text-slate-600 hover:bg-slate-100 transition focus:ring-2 focus:ring-indigo-500" href="#live-feed">
            ⚡ Live feed (B4/F4)
          </a>
          <a className="block rounded-xl px-4 py-2.5 text-slate-600 hover:bg-slate-100 transition focus:ring-2 focus:ring-indigo-500" href="#promo-codes">
            🏷 Promo codes (B3/F3/B4)
          </a>
          <a className="block rounded-xl px-4 py-2.5 text-slate-600 hover:bg-slate-100 transition focus:ring-2 focus:ring-indigo-500" href="#evidence">
            🛡 Reconciliation &amp; Evidence
          </a>
          <a className="block rounded-xl px-4 py-2.5 text-slate-600 hover:bg-slate-100 transition focus:ring-2 focus:ring-indigo-500" href="#creators">
            ♙ Influencer data
          </a>
          <a className="block rounded-xl px-4 py-2.5 text-slate-600 hover:bg-slate-100 transition focus:ring-2 focus:ring-indigo-500" href="#recommendation">
            ✳ Best combinations
          </a>
          <a className="block rounded-xl px-4 py-2.5 text-slate-600 hover:bg-slate-100 transition font-medium focus:ring-2 focus:ring-indigo-500" href="#cost-per-unit">
            💰 Cost per unit (B5/F5)
          </a>
          <a className="block rounded-xl bg-indigo-50 px-4 py-2.5 font-semibold text-indigo-700 focus:ring-2 focus:ring-indigo-500" href="#finder">
            ⚲ Creator Finder (B6/F6)
          </a>
          <a className="block rounded-xl px-4 py-2.5 text-slate-600 hover:bg-slate-100 transition font-medium focus:ring-2 focus:ring-indigo-500" href="#demo-script">
            📋 Demo Script (B9/F9)
          </a>
          <a className="block rounded-xl px-4 py-2.5 text-slate-600 hover:bg-slate-100 transition focus:ring-2 focus:ring-indigo-500" href="#method">
            ⌁ Calculation method
          </a>
        </nav>
        <Link
          href="/calculator"
          className="mt-auto block rounded-2xl border border-indigo-100 bg-indigo-50 p-4 transition hover:border-indigo-300 hover:bg-indigo-100 focus:ring-2 focus:ring-indigo-500"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
              ▤
            </span>
            <div>
              <p className="font-bold text-indigo-900">Campaign Calculator</p>
              <p className="text-xs text-indigo-700">Set budget &amp; plan →</p>
            </div>
          </div>
        </Link>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
          <div>
            <p className="text-sm text-slate-500">Marketing / Creator campaigns (C24)</p>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">Campaign Contribution Shell</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold">
              <span className="text-slate-500">Active Brand:</span>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="bg-transparent font-bold text-indigo-700 outline-none cursor-pointer"
              >
                <option value="B1">Brand B1 · AeroWear</option>
                <option value="B2">Brand B2 · Zenith</option>
              </select>
            </div>
            <span
              id="header-connection-badge"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                connectionStatus === "live"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : connectionStatus === "reconnecting"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  connectionStatus === "live"
                    ? "bg-emerald-500 animate-pulse"
                    : connectionStatus === "reconnecting"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-rose-500"
                }`}
              />
              <span className="font-bold">
                {connectionStatus === "live" ? "Live" : connectionStatus === "reconnecting" ? "Reconnecting" : "Offline"}
              </span>
            </span>
          </div>
        </header>

        <div className="space-y-8 p-5 sm:p-8">
          {/* Polite screen reader announcement (throttled to at most once per 10s) */}
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {screenReaderAnnouncement}
          </div>

          {/* Section: Overview Hero Banner */}
          <section id="overview" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-6 text-white sm:p-9 shadow-sm">
            <div className="relative z-10 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200">
                Creator campaign contribution planner
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold leading-tight">
                Spend smarter.<br />Maximize campaign contribution.
              </h2>
              <p className="mt-3 max-w-xl text-xs sm:text-sm leading-relaxed text-indigo-100">
                Register influencer promo codes, capture live e-commerce checkouts, and calculate true campaign contribution and cost per unit sold down to the exact paise.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a href="#promo-codes" className="inline-flex rounded-xl bg-white px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition shadow-sm">
                  Register Promo Code →
                </a>
                <a href="#planner" className="inline-flex rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition">
                  View Optimized Plan
                </a>
                <a href="#live-feed" className="inline-flex rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 transition">
                  ⚡ Watch Live Feed
                </a>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full border-[35px] border-white/10" />
          </section>

          {/* Core Overview Metric Cards */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Planning Budget</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{shortMoney(budget)}</p>
              <p className="mt-1 text-xs text-slate-400">Campaign spending cap</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Optimized Spend</p>
              <p className="mt-2 text-2xl font-bold text-indigo-700">{shortMoney(recommendation.spend)}</p>
              <p className="mt-1 text-xs text-slate-400">Sum of selected creator fees</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Estimated Contribution</p>
              <p className={`mt-2 text-2xl font-bold ${recommendation.profit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                {shortMoney(recommendation.profit)}
              </p>
              <p className="mt-1 text-xs text-slate-400">Dynamic profit computed on read</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Creators Selected</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{chosen.length} of {creatorsList.length}</p>
              <p className="mt-1 text-xs text-slate-400">{orders.toLocaleString("en-IN")} projected orders</p>
            </div>
          </section>

          {/* Section: Unregistered Uses Warning Banner & Table (Phase B4 / F4) */}
          {(unregisteredUses.length > 0 || (feedStatus?.unregistered_uses ?? 0) > 0) && (
            <div id="unregistered-banner" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white font-bold text-lg">
                    ⚠️
                  </span>
                  <div>
                    <h3 className="font-bold text-amber-950 text-base">Unregistered Promo Code Uses Detected</h3>
                    <p className="text-xs text-amber-800">
                      {(feedStatus?.unregistered_uses ?? unregisteredUses.length)} redemption{((feedStatus?.unregistered_uses ?? unregisteredUses.length) !== 1) ? 's' : ''} recorded with unrecognised codes. These orders have zero campaign creator attribution.
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-amber-200/80 px-3 py-1 font-mono text-xs font-bold text-amber-900">
                  {unregisteredUses.length} In Review Table
                </span>
              </div>

              {unregisteredUses.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-xl border border-amber-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-amber-100 bg-amber-50/50 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                      <tr>
                        <th className="px-4 py-3">Order ID</th>
                        <th className="px-4 py-3">Code Entered</th>
                        <th className="px-4 py-3">Used At</th>
                        <th className="px-4 py-3 text-right">Subtotal</th>
                        <th className="px-4 py-3 text-center">Attribution Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-50">
                      {unregisteredUses.map((u, i) => (
                        <tr key={u.order_id || i} className="hover:bg-amber-50/30 transition">
                          <td className="px-4 py-2.5 font-mono font-medium text-slate-800">{u.order_id}</td>
                          <td className="px-4 py-2.5 font-mono font-bold text-amber-700">{u.promo_code || u.code_entered || "N/A"}</td>
                          <td className="px-4 py-2.5 text-slate-500">{formatIST(u.used_at)}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-slate-700">{money(u.subtotal_inr || 0)}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-800">
                              Unregistered
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Section: Live Event Stream Panel (Phase B4 / F4) */}
          <section id="live-feed" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 text-xl font-bold">
                  ⚡
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Phase 4 (B4 &amp; F4)</span>
                  <h2 className="text-lg font-bold">Live Real-Time Event Stream</h2>
                  <p className="text-xs text-slate-500">
                    SSE subscription via fetch stream reader (X-Brand-Key header, 25s ping, 20-client brand cap, backoff reconnect).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  id="panel-connection-badge"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                    connectionStatus === "live"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : connectionStatus === "reconnecting"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      connectionStatus === "live"
                        ? "bg-emerald-500 animate-pulse"
                        : connectionStatus === "reconnecting"
                        ? "bg-amber-500 animate-pulse"
                        : "bg-rose-500"
                    }`}
                  />
                  <span className="font-bold uppercase tracking-wider text-[11px]">{connectionStatus}</span>
                </span>
                <span className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500 font-mono">
                  {liveEvents.length} event{liveEvents.length !== 1 ? 's' : ''} received
                </span>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {liveEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                  <p className="font-medium">No live events received yet.</p>
                  <p className="mt-1 text-[11px]">
                    Run <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">node scripts/fake-website.js --repeat 2</code> to stream redemptions into this dashboard.
                  </p>
                </div>
              ) : (
                liveEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className={`flex items-center justify-between rounded-xl border p-3 text-xs transition ${
                      ev.type === "use_recorded"
                        ? "border-emerald-200 bg-emerald-50/50 text-emerald-950"
                        : ev.type === "unregistered_use_recorded"
                        ? "border-amber-200 bg-amber-50/50 text-amber-950"
                        : "border-indigo-200 bg-indigo-50/50 text-indigo-950"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                          ev.type === "use_recorded"
                            ? "bg-emerald-200 text-emerald-800"
                            : ev.type === "unregistered_use_recorded"
                            ? "bg-amber-200 text-amber-800"
                            : "bg-indigo-200 text-indigo-800"
                        }`}
                      >
                        {ev.type}
                      </span>
                      <div className="min-w-0">
                        <span className="font-mono font-bold text-slate-900">{ev.code || "UNKNOWN"}</span>
                        {ev.creator && (
                          <span className="ml-2 text-slate-500 text-[11px]">Creator: <strong className="text-slate-700">{ev.creator}</strong></span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] text-slate-400">
                      <span>{new Date(ev.time).toLocaleTimeString("en-IN")}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Section: Campaign Promo Codes & Attribution (Phase B3, F3, B4, F4) */}
          <section id="promo-codes" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Phase 3 &amp; 4 (B3, F3, B4, F4)</span>
                <h2 className="text-xl font-bold">Campaign Promo Codes &amp; Attribution</h2>
                <p className="text-xs text-slate-500">
                  Registered promo codes for Brand {selectedBrand}, with 60s periodic polling, live highlight animations, and date update audit trail.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPromoRegisterModal(!showPromoRegisterModal)}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                >
                  {showPromoRegisterModal ? "Close Form" : "+ Register Promo Code"}
                </button>
              </div>
            </div>

            {/* Registration Form */}
            {showPromoRegisterModal && (
              <form onSubmit={handleRegisterPromoCode} className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900">Register Promo Code (Brand {selectedBrand})</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Promo Code</label>
                    <input
                      type="text"
                      required
                      placeholder="SUMMER25"
                      value={newPromoCode}
                      onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                      className="w-full rounded-lg border border-slate-200 p-2 font-mono uppercase bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Creator</label>
                    <select
                      required
                      value={newPromoCreator}
                      onChange={(e) => setNewPromoCreator(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-2 font-mono bg-white text-xs"
                    >
                      <option value="CR1">CR1 - Aarav Sharma</option>
                      <option value="CR2">CR2 - Meera Kapoor</option>
                      <option value="CR3">CR3 - Rohan Verma</option>
                      <option value="CR4">CR4 - Ananya Singh</option>
                      <option value="CR7">CR7 - Vivaan Rao</option>
                      <option value="CR8">CR8 - Diya Malhotra</option>
                      <option value="creator_001">creator_001 - Aarav Mehta</option>
                      <option value="creator_002">creator_002 - Diya Sharma</option>
                      <option value="creator_003">creator_003 - Rohan Varma</option>
                      <option value="creator_004">creator_004 - Ananya Iyer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Starts At (ISO)</label>
                    <input
                      type="text"
                      required
                      value={newPromoStarts}
                      onChange={(e) => setNewPromoStarts(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-2 font-mono text-[11px] bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Expires At (ISO)</label>
                    <input
                      type="text"
                      required
                      value={newPromoExpires}
                      onChange={(e) => setNewPromoExpires(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-2 font-mono text-[11px] bg-white"
                    />
                  </div>
                </div>

                {promoRegisterError && (
                  <p className="text-xs font-semibold text-rose-600">{promoRegisterError}</p>
                )}
                {promoRegisterSuccess && (
                  <p className="text-xs font-semibold text-emerald-600">{promoRegisterSuccess}</p>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPromoRegisterModal(false)}
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
                      const isEditing = editingPromoCode === p.code;
                      return (
                        <tr
                          key={p.code}
                          className={`transition-all duration-500 ${
                            isHighlighted ? "bg-emerald-100/90 ring-2 ring-emerald-500 font-semibold" : "hover:bg-slate-50"
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
                          <td className="px-4 py-3 text-right font-medium">{p.use_count}</td>
                          <td className="px-4 py-3 text-right font-medium">{p.units}</td>
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
                                  onClick={() => handleUpdatePromoDates(p.code)}
                                  className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingPromoCode(null)}
                                  className="rounded bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingPromoCode(p.code);
                                  setEditStartsAt(p.valid_from);
                                  setEditExpiresAt(p.valid_to);
                                }}
                                className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
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
            {editDateError && (
              <p className="text-xs font-semibold text-rose-600">{editDateError}</p>
            )}
          </section>

          {/* Section: Reconciliation & Audit Evidence (Phase B4 / F4) */}
          <section id="evidence" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Phase 4 (B4 &amp; F4)</span>
                <h2 className="text-xl font-bold">Audit Reconciliation &amp; Evidence Engine</h2>
                <p className="text-xs text-slate-500">
                  Reconciliation endpoint (capped at 5,000 uses). Returns per-code counts and sorted order IDs, strictly excluding customer IDs or discounts.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-bold text-indigo-700">
                  Zero PII / Zero Discount Leakage
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">From (Inclusive ISO)</label>
                <input
                  type="text"
                  value={reconFrom}
                  onChange={(e) => setReconFrom(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2 font-mono text-[11px] bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">To (Exclusive ISO)</label>
                <input
                  type="text"
                  value={reconTo}
                  onChange={(e) => setReconTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2 font-mono text-[11px] bg-slate-50"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleRunReconciliation}
                  disabled={reconLoading}
                  className="w-full rounded-lg bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {reconLoading ? "Reconciling..." : "Run Reconciliation"}
                </button>
              </div>
            </div>

            {reconError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                Error: {reconError}
              </div>
            )}

            {reconResult && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-4 text-xs">
                  <div className="rounded-lg bg-white p-3 border border-slate-200">
                    <p className="text-slate-500">Total In-Range Orders</p>
                    <p className="text-lg font-bold text-indigo-700">{reconResult.summary?.total_orders ?? reconResult.registered_codes?.reduce((s: number, r: any) => s + r.use_count, 0) ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-slate-200">
                    <p className="text-slate-500">Total Units</p>
                    <p className="text-lg font-bold text-slate-900">{reconResult.summary?.total_units ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-slate-200">
                    <p className="text-slate-500">Gross Subtotal</p>
                    <p className="text-lg font-bold text-slate-900">{money(reconResult.summary?.gross_subtotal_inr ?? 0)}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-slate-200">
                    <p className="text-slate-500">Registered Codes</p>
                    <p className="text-lg font-bold text-emerald-700">{(reconResult.registered_codes || []).length}</p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-600">
                      <tr>
                        <th className="px-4 py-2.5">Code</th>
                        <th className="px-4 py-2.5 text-right">Uses</th>
                        <th className="px-4 py-2.5 text-right">Units</th>
                        <th className="px-4 py-2.5 text-right">Subtotal</th>
                        <th className="px-4 py-2.5">Sorted Order IDs (Strictly No Customer IDs)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reconResult.registered_codes || []).map((rc: any) => (
                        <tr key={rc.code}>
                          <td className="px-4 py-2.5 font-mono font-bold text-indigo-700">{rc.code}</td>
                          <td className="px-4 py-2.5 text-right font-medium">{rc.use_count}</td>
                          <td className="px-4 py-2.5 text-right font-medium">{rc.units}</td>
                          <td className="px-4 py-2.5 text-right font-medium">{money(rc.subtotal_inr)}</td>
                          <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">
                            {(rc.order_ids || []).join(", ") || "None"}
                          </td>
                        </tr>
                      ))}
                      {(reconResult.registered_codes || []).length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                            No orders in this range.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Section: Recommendation & Knapsack Optimizer */}
          <div id="recommendation" className="scroll-mt-20" />
          <section id="planner" className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-indigo-600">Optimization result</p>
                  <h2 className="mt-1 text-xl font-bold">Recommended combination</h2>
                  <p className="mt-1 text-sm text-slate-500">Select or remove creators to test alternatives.</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition focus:ring-2 focus:ring-indigo-500"
                >
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
                  <Link
                    key={c.id}
                    href={`/influencer/${c.slug}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-4 hover:border-indigo-200 hover:bg-slate-50 transition focus:ring-2 focus:ring-indigo-500"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-700">
                        {c.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-xs text-slate-500">
                          {c.category} · {c.orders.toLocaleString("en-IN")} tracked orders
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${profit(c) >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                        {shortMoney(profit(c))}
                      </p>
                      <p className="text-xs text-slate-500">Estimated profit</p>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Budget used</span>
                  <span className="font-semibold">{budget ? ((spend / budget) * 100).toFixed(1) : "0.0"}%</span>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${spend > budget ? "bg-rose-500" : "bg-indigo-600"}`}
                    style={{ width: `${Math.min(100, budget ? (spend / budget) * 100 : 0)}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-slate-500">
                    Total fee: <span className="font-semibold text-slate-900">{money(spend)}</span>
                  </span>
                  <span className="text-slate-500">
                    Budget: <span className="font-semibold text-slate-900">{money(budget)}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Campaign Summary Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
              <h2 className="text-lg font-bold">Campaign projection</h2>
              <div className="mt-5 space-y-4">
                <SummaryRow label="Total creators selected" value={String(chosen.length)} />
                <SummaryRow label="Total expected orders" value={orders.toLocaleString("en-IN")} />
                <SummaryRow label="Total spend" value={money(spend)} />
                <SummaryRow label="Projected net contribution" value={money(totalProfit)} />
                <div className="pt-2">
                  <Link
                    href="/calculator"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white transition hover:bg-indigo-700 shadow-sm shadow-indigo-200 focus:ring-2 focus:ring-indigo-500"
                  >
                    Adjust Budget &amp; Parameters →
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Influencer Performance & Optimization Catalog */}
          <section id="creators" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Creator Pool &amp; Selection</span>
                <h2 className="text-xl font-bold">Influencer Contribution Data</h2>
                <p className="text-xs text-slate-500">
                  Select or deselect creators with checkboxes to dynamically recompute campaign allocation against budget.
                </p>
              </div>

              {/* Search & Category Filter Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search creators..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:border-indigo-500 focus:bg-white"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="All">All Categories</option>
                  <option value="Lifestyle">Lifestyle</option>
                  <option value="Fashion">Fashion</option>
                  <option value="Technology">Technology</option>
                  <option value="Beauty">Beauty</option>
                  <option value="Fitness">Fitness</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-3 py-3 text-center">Select</th>
                    <th className="px-4 py-3">Creator Name</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3 text-right">Orders</th>
                    <th className="px-3 py-3 text-right">Discount</th>
                    <th className="px-3 py-3 text-right">Avg SP</th>
                    <th className="px-3 py-3 text-right">Fee</th>
                    <th className="px-3 py-3 text-right">Est. Profit</th>
                    <th className="px-3 py-3 text-center">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {shown.map((c) => {
                    const isSelected = activeIds.includes(c.id);
                    const creatorProfit = profit(c);
                    return (
                      <tr key={c.id} className={`hover:bg-slate-50/80 transition ${isSelected ? 'bg-indigo-50/20' : ''}`}>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggle(c.id)}
                            aria-label={`Select ${c.name}`}
                            className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/influencer/${c.slug}`} className="font-semibold text-indigo-700 hover:underline">
                            {c.name}
                          </Link>
                          <span className="block font-mono text-[10px] text-slate-400">{c.slug}</span>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{c.category}</td>
                        <td className="px-3 py-3 text-right font-medium">{c.orders.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-3 text-right">{c.discount}%</td>
                        <td className="px-3 py-3 text-right font-mono">{money(c.sp)}</td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-900">{shortMoney(c.fee)}</td>
                        <td className={`px-3 py-3 text-right font-bold ${creatorProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {shortMoney(creatorProfit)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Link
                            href={`/influencer/${c.slug}`}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition"
                          >
                            Profile →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                        No creators match your search or filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-500 italic">
              * Checkboxes directly update the optimizer plan and projected net contribution in real-time.
            </p>
          </section>

          {/* Section: Cost Per Unit & Scenario Modeling (B5/F5) */}
          <div id="experiments" className="scroll-mt-20" />
          <section id="cost-per-unit" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Phase 5 (B5 &amp; F5)</span>
                <h2 className="mt-0.5 text-xl font-bold">Cost Per Unit Sold Live Layer</h2>
                <p className="text-xs text-slate-500">
                  Computed dynamically on read in integer paise. Fee is applied per creator per brand.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    handleScenarioChange('live');
                    fetchLiveCpu();
                  }}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition focus:ring-2 focus:ring-emerald-500 ${
                    cpuScenario === 'live'
                      ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/50'
                      : 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  ● Live DB (CR1)
                </button>
                <button
                  onClick={() => handleScenarioChange('benchmark_4')}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition focus:ring-2 focus:ring-indigo-500 ${
                    cpuScenario === 'benchmark_4'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Benchmark 4-Unit (₹5,000/u)
                </button>
                <button
                  onClick={() => handleScenarioChange('benchmark_5')}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition focus:ring-2 focus:ring-emerald-500 ${
                    cpuScenario === 'benchmark_5'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  + 5th Unit Live (₹4,000/u)
                </button>
                <button
                  onClick={() => handleScenarioChange('split_3')}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition focus:ring-2 focus:ring-indigo-500 ${
                    cpuScenario === 'split_3'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  3-Unit Split (₹6,666.67)
                </button>
                <button
                  onClick={() => handleScenarioChange('no_units')}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition focus:ring-2 focus:ring-slate-500 ${
                    cpuScenario === 'no_units'
                      ? 'bg-slate-800 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Empty Units
                </button>
                <button
                  onClick={() => handleScenarioChange('fee_unknown')}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition focus:ring-2 focus:ring-amber-500 ${
                    cpuScenario === 'fee_unknown'
                      ? 'bg-amber-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Fee Unknown
                </button>
              </div>
            </div>

            {/* 4 Core Metric Panels */}
            <div className={`mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 transition-all duration-300 ${livePulse ? 'ring-2 ring-indigo-400 rounded-2xl p-1' : ''}`}>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Creator Fee</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {cpuData.fee_inr !== null ? money(cpuData.fee_inr) : <span className="text-amber-600 font-semibold">unknown</span>}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {cpuData.fee_paise !== null ? `${cpuData.fee_paise.toLocaleString('en-IN')} paise` : 'Absence of reference fee'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Units Sold</p>
                <p className="mt-2 text-2xl font-bold text-indigo-700">
                  {cpuData.units_sold.toLocaleString('en-IN')} <span className="text-sm font-normal text-slate-500">units</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">Gross registered order lines</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cost Per Unit</p>
                <p className="mt-2 text-2xl font-bold">
                  {cpuData.status === 'fee_unknown' ? (
                    <span className="text-amber-600 font-semibold">unknown</span>
                  ) : cpuData.status === 'no_units' ? (
                    <span className="text-slate-500 font-semibold italic text-xl">no sales yet</span>
                  ) : cpuData.cost_per_unit !== null ? (
                    <span className="text-emerald-700">₹{cpuData.cost_per_unit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  ) : (
                    <span className="text-amber-600 font-semibold">unknown</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-400">Fee ÷ Units Sold (rounded to 2 dec)</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
                <div className="mt-2">
                  {cpuData.status === 'ok' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                      ● Active (ok)
                    </span>
                  )}
                  {cpuData.status === 'fee_unknown' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                      ⚠ fee_unknown
                    </span>
                  )}
                  {cpuData.status === 'no_units' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                      ○ no_units
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-400">Creator: {cpuData.creator_name} ({cpuData.creator_id})</p>
              </div>
            </div>

            {/* Fee Allocations */}
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-semibold text-sm">Fee Allocation by Product</h3>
                  <span className="text-xs text-slate-500">Integer Paise Split</span>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 uppercase">
                        <th className="py-2">Product</th>
                        <th className="py-2 text-right">Units</th>
                        <th className="py-2 text-right">Allocated Fee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {cpuData.by_product.map((p) => (
                        <tr key={p.product_id} className="hover:bg-slate-50">
                          <td className="py-2.5 font-medium">{p.name || p.product_id}</td>
                          <td className="py-2.5 text-right font-semibold">{p.units}</td>
                          <td className="py-2.5 text-right font-bold text-slate-800">
                            {p.allocated_fee_inr !== null ? money(p.allocated_fee_inr) : <span className="text-amber-600">unknown</span>}
                          </td>
                        </tr>
                      ))}
                      {cpuData.by_product.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-slate-400 italic">
                            No product sales recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-semibold text-sm">Fee Allocation by Promo Code</h3>
                  <span className="text-xs text-slate-500">Last Code Takes Remainder</span>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 uppercase">
                        <th className="py-2">Code</th>
                        <th className="py-2 text-right">Units</th>
                        <th className="py-2 text-right">Allocated Fee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {cpuData.by_code.map((c) => (
                        <tr key={c.code} className="hover:bg-slate-50">
                          <td className="py-2.5 font-mono font-bold text-indigo-700">{c.code}</td>
                          <td className="py-2.5 text-right font-semibold">{c.units}</td>
                          <td className="py-2.5 text-right font-bold text-slate-800">
                            {c.allocated_fee_inr !== null ? money(c.allocated_fee_inr) : <span className="text-amber-600">unknown</span>}
                          </td>
                        </tr>
                      ))}
                      {cpuData.by_code.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-slate-400 italic">
                            No code redemptions recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-slate-50 p-4 border border-slate-200/80 space-y-2 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <span className="font-bold text-slate-700 shrink-0">Basis:</span>
                <span>{cpuData.basis_text}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-slate-700 shrink-0">Reference Note:</span>
                <span className="text-indigo-900 font-medium">{cpuData.reference_note}</span>
              </div>
            </div>
          </section>

          {/* Section: Creator Finder & Shortlist (Phase B6 & F6) */}
          <section id="finder" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Phase 6 (B6 &amp; F6)</span>
                <h2 className="mt-0.5 text-xl font-bold">Creator Finding, Ranking &amp; Shortlist Engine</h2>
                <p className="text-xs text-slate-500">
                  Strict non-fetching URL parsing, all-or-nothing CSV ingestion, and brand-scoped shortlist governance.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Platform Connectors: Inactive (Offline Safe Parser)
                </span>
                <button
                  onClick={() => setShowAssumptionsDrawer(!showAssumptionsDrawer)}
                  className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition focus:ring-2 focus:ring-indigo-500"
                >
                  ⚙ Tier Assumptions
                </button>
              </div>
            </div>

            {/* Configurable Tier Assumptions Drawer */}
            {showAssumptionsDrawer && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-900">
                    Configurable Tier Settings (Labelled as Assumptions)
                  </h3>
                  <span className="text-xs text-indigo-600 font-mono">Formula: Strict within-platform follower ordering</span>
                </div>
                <p className="text-xs text-slate-600">
                  Notice: Follower tiers are planning assumptions only, and do not guarantee marketing conversion.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-500 mb-1">Mega Tier (&gt;=)</label>
                    <input
                      type="number"
                      value={tierAssumptions.mega}
                      onChange={(e) => setTierAssumptions({ ...tierAssumptions, mega: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-200 p-1.5 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Macro Tier (&gt;=)</label>
                    <input
                      type="number"
                      value={tierAssumptions.macro}
                      onChange={(e) => setTierAssumptions({ ...tierAssumptions, macro: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-200 p-1.5 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Mid Tier (&gt;=)</label>
                    <input
                      type="number"
                      value={tierAssumptions.mid}
                      onChange={(e) => setTierAssumptions({ ...tierAssumptions, mid: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-200 p-1.5 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Micro Tier (&gt;=)</label>
                    <input
                      type="number"
                      value={tierAssumptions.micro}
                      onChange={(e) => setTierAssumptions({ ...tierAssumptions, micro: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-200 p-1.5 bg-white font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Ingestion UI: URL Parser & CSV Entry */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Box 1: Multi-line URL Parser */}
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">Batch URL Ingestion (Strict &amp; Offline)</h3>
                  <span className="text-[11px] text-slate-500">Allowed: YouTube, Instagram</span>
                </div>
                <p className="text-xs text-slate-500">
                  Paste one or more URLs. The server strictly parses formats without ever fetching pasted URLs.
                </p>
                <textarea
                  rows={4}
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://youtube.com/@channel&#10;https://instagram.com/handle"
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs font-mono bg-white focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex items-center justify-between">
                  <button
                    onClick={handleParseUrls}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition focus:ring-2 focus:ring-indigo-500"
                  >
                    Parse URLs Now
                  </button>
                  {urlParseSummary && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-emerald-700 font-semibold">{urlParseSummary.valid} Valid</span>
                      <span className="text-amber-700 font-semibold">{urlParseSummary.duplicate} Duplicates</span>
                      <span className="text-rose-600 font-semibold">{urlParseSummary.invalid} Rejected</span>
                    </div>
                  )}
                </div>

                {/* URL Parse Results List */}
                {urlParseResults.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                    {urlParseResults.map((r, i) => (
                      <div
                        key={i}
                        className={`rounded-lg p-2.5 text-xs flex items-center justify-between border ${
                          r.valid
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                            : r.duplicate
                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                            : 'bg-rose-50 border-rose-200 text-rose-900'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-mono font-semibold truncate">{r.input}</p>
                          {r.valid && (
                            <p className="text-[11px] text-emerald-700">
                              Recognized: <span className="font-bold">{r.platform}</span> handle <span className="font-bold">{r.handle}</span> → <span className="underline">{r.canonical_url}</span>
                            </p>
                          )}
                          {!r.valid && <p className="text-[11px] font-medium">{r.reason}</p>}
                        </div>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.valid
                              ? 'bg-emerald-200 text-emerald-800'
                              : r.duplicate
                              ? 'bg-amber-200 text-amber-800'
                              : 'bg-rose-200 text-rose-800'
                          }`}
                        >
                          {r.valid ? 'Recognised' : r.duplicate ? 'Duplicate' : 'Rejected'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Box 2: CSV Ingestion with Row Errors & All-or-Nothing Commit */}
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">Transactional CSV Upload (Agency Auth)</h3>
                  <span className="text-[11px] text-indigo-700 font-semibold">X-Agency-Key Protected</span>
                </div>
                <p className="text-xs text-slate-500">
                  All-or-nothing guarantee: if any row violates format or rules, zero rows are committed.
                </p>
                <textarea
                  rows={4}
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs font-mono bg-white focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex items-center justify-between">
                  <button
                    onClick={handleIngestCsv}
                    className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900 transition focus:ring-2 focus:ring-slate-500"
                  >
                    Validate &amp; Ingest CSV
                  </button>
                  <button
                    onClick={() => {
                      setCsvInput(`creator_id,platform,canonical_url,count,exact_or_rounded,hidden\nC1,youtube,https://youtube.com/@aaravstyle,250000,rounded,false\nC_BAD,disallowed_host,https://bad.com,abc,invalid,false`);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 underline"
                  >
                    Load Broken Sample (Test Rollback)
                  </button>
                </div>

                {/* CSV Status Messages */}
                {csvErrors.length > 0 && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900 space-y-1">
                    <p className="font-bold">Transaction Aborted — 0 Rows Committed:</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      {csvErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {csvSuccessMessage && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 font-semibold">
                    ✓ {csvSuccessMessage}
                  </div>
                )}
              </div>
            </div>

            {/* Ranking UI Controls */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 mr-2">Platform Isolation:</span>
                  <button
                    onClick={() => setRankingPlatform('all')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      rankingPlatform === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    All Platforms
                  </button>
                  <button
                    onClick={() => setRankingPlatform('youtube')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      rankingPlatform === 'youtube' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    YouTube
                  </button>
                  <button
                    onClick={() => setRankingPlatform('instagram')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      rankingPlatform === 'instagram' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Instagram
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Eligibility:</span>
                  <select
                    value={rankingEligibility}
                    onChange={(e: any) => setRankingEligibility(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="eligible">Eligible Only</option>
                    <option value="conflicted">Excluded or Conflicted</option>
                  </select>
                </div>
              </div>

              {shortlistFeedback && (
                <div
                  className={`rounded-xl p-3 text-xs font-semibold flex items-center justify-between border ${
                    shortlistFeedback.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <span>{shortlistFeedback.message}</span>
                  <button onClick={() => setShortlistFeedback(null)} className="text-slate-400 hover:text-slate-600 text-sm">×</button>
                </div>
              )}

              {/* Main Ranked Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 font-bold">Rank</th>
                      <th className="py-3 px-4 font-bold">Creator</th>
                      <th className="py-3 px-4 font-bold">Platform / Handle</th>
                      <th className="py-3 px-4 font-bold text-right">Count</th>
                      <th className="py-3 px-4 font-bold">Label</th>
                      <th className="py-3 px-4 font-bold">Fetched Time</th>
                      <th className="py-3 px-4 font-bold">Tier Assumption</th>
                      <th className="py-3 px-4 font-bold text-right">Shortlist Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {rankedCreators.map((c) => {
                      const isShortlisted = shortlist.some((s) => s.creator_id === c.creator_id);
                      return (
                        <tr key={c.creator_id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-bold text-slate-900">#{c.rank}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {c.name}
                            <span className="block text-[10px] text-slate-400 font-normal">{c.category}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-indigo-700 font-semibold">{c.handle}</span>
                            <span className="block text-[10px] text-slate-400 capitalize">{c.platform}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {c.count !== null ? c.count.toLocaleString('en-IN') : <span className="text-amber-600">unknown</span>}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                c.exact_or_rounded === 'exact'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {c.exact_or_rounded}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {new Date(c.fetched_time).toLocaleDateString('en-IN')}
                            {c.stale && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-bold uppercase">
                                Stale &gt;7d
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold uppercase">
                              {c.tier}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {c.excluded ? (
                              <span
                                title={c.refusal_reason}
                                className="inline-block px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold cursor-not-allowed"
                              >
                                Refused (Excluded)
                              </span>
                            ) : c.rival_conflict ? (
                              <span
                                title={c.refusal_reason}
                                className="inline-block px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold cursor-not-allowed"
                              >
                                Refused (Rival Conflict)
                              </span>
                            ) : isShortlisted ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs">
                                ✓ Shortlisted
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAddToShortlist(c)}
                                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition focus:ring-2 focus:ring-indigo-500"
                              >
                                + Shortlist
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Separate "Unranked (Unknown Count)" Group */}
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                    <h3 className="font-bold text-sm text-slate-800">Unranked Group (Hidden or Unknown Follower Counts)</h3>
                  </div>
                  <span className="text-xs text-slate-500">Tier: UNRANKED</span>
                </div>
                <p className="text-xs text-slate-500">
                  Rule B6: Creators with hidden counts are stored strictly as unknown (`null`) and isolated into this unranked pool.
                </p>

                <div className="divide-y divide-slate-200 bg-white rounded-lg border border-slate-200">
                  {unrankedCreators.map((c) => (
                    <div key={c.creator_id} className="p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-slate-900">{c.name}</span>
                        <span className="ml-2 font-mono text-indigo-700 font-semibold">{c.handle}</span>
                        <span className="ml-2 text-slate-400 capitalize">({c.platform})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono font-bold text-[11px]">
                          Count: unknown
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          {c.hidden_flag ? 'Count hidden by creator' : 'Snapshot unavailable'}
                        </span>
                        <button
                          onClick={() => handleAddToShortlist(c)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50"
                        >
                          Shortlist Anyway
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Brand B1 Active Shortlist Section */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⭐</span>
                    <h3 className="font-bold text-sm text-indigo-950">Brand B1 Active Shortlist (Brand-Scoped)</h3>
                  </div>
                  <span className="text-xs text-slate-500">Invisible to Brand B2</span>
                </div>
                <div className="divide-y divide-indigo-100 bg-white rounded-lg border border-indigo-100">
                  {shortlist.map((item) => (
                    <div key={item.creator_id} className="p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-slate-900">{item.name}</span>
                        <span className="ml-2 font-mono text-indigo-700 font-semibold">{item.handle}</span>
                        <span className="ml-2 text-slate-400">Added: {new Date(item.added_at).toLocaleTimeString('en-IN')}</span>
                        {item.notes && <span className="block text-slate-500 text-[11px] mt-0.5">Note: {item.notes}</span>}
                      </div>
                      <button
                        onClick={() => handleRemoveFromShortlist(item.creator_id)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {shortlist.length === 0 && (
                    <div className="p-6 text-center text-slate-400 italic text-xs">
                      No creators currently shortlisted for Brand B1.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Section: Presentation Demo Walkthrough Script (Phase B9 & F9) */}
          <section id="demo-script" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Phase 9 (B9 &amp; F9)</span>
                <h2 className="mt-0.5 text-xl font-bold">Interactive Presentation Demo Script</h2>
                <p className="text-xs text-slate-500">
                  Follow this structured sequence to demonstrate the entire platform flow from simulator to dashboard.
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                {completedDemoSteps.length} of 8 Steps Checked
              </span>
            </div>

            {/* 8-Step Walkthrough Grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { step: 1, title: '1. Load the App', desc: 'Open app in browser; verify demo mode guard and on-screen platform limits.' },
                { step: 2, title: '2. Show Winning & Losing', desc: 'Observe creator C1 with positive contribution vs creator C3 with negative ROI.' },
                { step: 3, title: '3. Flip with a Slider', desc: 'Adjust incremental share slider from 20% to 65% to flip C3 into profitability.' },
                { step: 4, title: '4. Show Cap Holding', desc: 'Increase target sales units to demonstrate brand commission ceiling holding.' },
                { step: 5, title: '5. Run Fake Website', desc: 'Execute `node scripts/fake-website.js --repeat 2 --bad-code` in terminal.' },
                { step: 6, title: '6. Watch Live Update', desc: 'Observe orders updating in real-time without refreshing browser.' },
                { step: 7, title: '7. Cost Per Unit', desc: 'Inspect fee allocation by product and code in integer paise precision.' },
                { step: 8, title: '8. Export Evidence', desc: 'Verify reconciliation evidence and audit log trail with SHA-256 hashes.' }
              ].map((item) => {
                const isDone = completedDemoSteps.includes(item.step);
                return (
                  <div
                    key={item.step}
                    onClick={() => toggleDemoStep(item.step)}
                    className={`rounded-xl border p-4 cursor-pointer transition select-none ${
                      isDone
                        ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs uppercase tracking-wide">{item.title}</span>
                      <span className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        isDone ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white text-slate-400'
                      }`}>
                        {isDone ? '✓' : item.step}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section: Calculation Method */}
          <section id="method" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6 shadow-sm">
            <h2 className="font-bold text-amber-950">How the estimate works</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Discounted SP = Average SP × (1 − Discount % / 100). Estimated profit per creator = Orders × (Discounted SP − Average CP) − Creator fee. The planner checks combinations within budget and chooses the one with the highest summed estimated profit.
            </p>
            <p className="mt-3 text-sm leading-6 text-amber-900">
              Demo limitation: it does not yet adjust for returns, regular customers who would have purchased anyway, overlapping attribution, or costs omitted from CP. Include these before using recommendations for real campaign spending.
            </p>
          </section>

          <footer className="pb-4 text-center text-xs text-slate-400">
            CreatorIQ · Creator Campaign Contribution Planner · C24 Complete Platform (Phase 6 &amp; Phase 9)
          </footer>
        </div>
      </div>
    </main>
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
