# Creator Campaign Contribution Planner (Case C24)

A high-performance Node.js application built with native `node:http`, native `node:sqlite` persistence, Server-Sent Events (SSE) streaming, and multi-key security for influencer promo code management, creator finding & ranking, and e-commerce checkout integration under a ₹25 lakh budget.

> **CRITICAL ARCHITECTURAL NOTICES:**
> 1. **Single Instance Architecture:** This application runs as a single self-contained instance utilizing local WAL-mode SQLite storage (`node:sqlite`).
> 2. **Synthetic Data in Demo:** All creator profiles, follower snapshots, historical orders, and brand configurations are **synthetic sample data** generated for testing and demonstration.
> 3. **Planning Assumptions vs Reality:** 
>    - Incremental share is a **planning assumption**, not a causal guarantee.
>    - Promo codes demonstrate **attribution**, not causation.
> 4. **Committed Keys are Demo Only:** Keys such as `demo-brand-key-b1`, `demo-report-key-b1`, and `demo-agency-key` are committed strictly for demonstration and testing. In production environments, keys must be supplied exclusively through secure environment variables (`BRAND_KEY_*`, `REPORT_KEY_*`, `AGENCY_KEY`).
> 5. **Security Restrictions:** No HTTP endpoint may ever create simulated data, and there is strictly **no HTTP purge endpoint**.

---

<<<<<<< HEAD
## 1. Requirements & Stack
- **Runtime:** Node.js 22.5.0+ (uses built-in `node:sqlite` DatabaseSync with zero native compilation dependencies).
- **Backend Architecture:** Native Node.js HTTP server (`src/app.js`, `src/server.js`) with zero heavy framework bloat.
- **Frontend:** Next.js with React 19 and Tailwind CSS with custom glassmorphism and real-time SSE stream integration.
- **Monetary Storage:** Handled exclusively in **integer paise** (`paise = Math.round(inr * 100)`). Stored in SQLite as integer paise. Missing discounts and hidden follower counts remain strictly `null` (UNKNOWN), never converted to zero.

---

## 2. Project Structure

The project conforms to the official hackathon modular architecture:

```
/your-project-root
├── /c24-main-backend      # The core C24 engine and dashboard
│   ├── /src               # App router, components, calculation engine, storage
│   └── package.json
│
└── /storefront-app        # Luxury fashion storefront (Atelier 24)
    ├── /src
    │   ├── /app           # Storefront pages, cart, catalog & checkout
    │   └── /api           # Backend proxies (check.js, order.js holding C24_WEBSITE_KEY)
    ├── .env               # Holds C24_WEBSITE_KEY (never exposed to browser)
    └── package.json
```

### Security & Backend Proxy Pattern:
- **`storefront-app/.env`**: Exclusively stores `C24_WEBSITE_KEY=demo-report-key-b1`, `C24_API_URL`, and `BRAND_ID`.
- **`storefront-app/src/api/check.js`**: Backend proxy that queries C24 for promo validity and returns only `{ code, valid, reason }` without revealing secrets.
- **`storefront-app/src/api/order.js`**: Backend proxy that injects `X-Report-Key` server-side when submitting confirmed orders to `/api/v1/orders/report`.
- **Client Security**: The storefront browser code only ever calls `/api/check` and `/api/order`. The website key is never visible in network request headers, source code, or browser DOM.


---

## 3. Running the Application

### 1. Start the Frontend (Next.js Dashboard):
```bash
npm run dev
# Or explicitly:
npm run dev:frontend
```
The dashboard will start on [http://localhost:3000](http://localhost:3000).

### 2. Start the Backend (Standalone Native HTTP API Server):
```bash
npm run dev:backend
# Or:
npm run start:promo
```
The backend API server starts on [http://localhost:3001](http://localhost:3001).

### 3. Run the Database Seed Script:
```bash
node scripts/seed.js
```
Populates baseline creators, creator profiles (YouTube & Instagram), follower snapshots, and active promo codes. Refuses if server is not in `demo` mode.

### 4. Run the E-Commerce Simulator (Phase B9):
```bash
# Standard run:
node scripts/fake-website.js

# With custom repetitions and invalid code injection:
node scripts/fake-website.js --repeat 3 --bad-code
```
The simulator checks that `/health` is in `demo` mode, tests pre-checkout advisory checks (`GET .../check`), reports paid redemptions (`POST .../redemptions`), and tests idempotency duplicate responses.

### 5. Run the Automated Test Suite:
```bash
npm test
# Or test backend workspace specifically:
npm run test:backend
```

---

## 3. Division of Responsibility & Security Model

| Capability | Owned By | Description |
| :--- | :--- | :--- |
| **Promo Code Registration** | Brand (`X-Brand-Key`) | Brand registers codes, influencer associations, and validity windows. |
| **Creator Catalog & Ingestion** | Agency (`X-Agency-Key`) | Shared creator profile management and transactional CSV ingestion. |
| **Creator Shortlisting** | Brand (`X-Brand-Key`) | Brand-scoped creator shortlists with automated rival conflict and exclusion checks. |
| **Discount Rule & Calculation**| **Website** | E-commerce website owns all discount logic. The planner records reported redemptions. |
| **Pre-Checkout Advisory Check**| C24 Service (`X-Report-Key`) | Fast check whether a code is valid *right now* without leaking influencer details. |
| **Paid Order Reporting** | Website Server (`X-Report-Key`) | When payment succeeds, website reports order items, timestamp, and discount. |
| **Attribution & Live Dashboard**| C24 Service | Stores orders in SQLite, updates campaign metrics, and streams live SSE updates. |

---

## 4. API Endpoints

### Finder Endpoints (Phase B6)
- `POST /api/finder/parse-urls`: Strictly non-fetching URL parser for YouTube and Instagram handles.
- `POST /api/finder/csv`: All-or-nothing transactional CSV ingestion (requires `X-Agency-Key`).
- `GET /api/finder/creators`: Platform-isolated rankings with "unranked" group for unknown counts and assumption tier thresholds.

### Brand Endpoints (`X-Brand-Key`)
- `GET /health`: Health check and environment verification (`{ status: "ok", environment: "demo" }`).
- `GET /brands/:brandId/shortlist`: Returns brand-scoped shortlist (completely invisible to other brands).
- `POST /brands/:brandId/shortlist`: Adds creator to shortlist after verifying eligibility and rival relationships.
- `DELETE /brands/:brandId/shortlist/:creatorId`: Removes creator from brand shortlist.
- `GET /brands/:brandId/cost-per-unit`: Computes real-time cost per unit sold dynamically on read with integer paise allocation.
- `GET /brands/:brandId/events`: Live Server-Sent Events (SSE) feed with 20-subscriber cap.

### Website Server Endpoints (`X-Report-Key`)
- `GET /brands/:brandId/promo-codes/:code/check`: Pre-checkout advisory check.
- `POST /brands/:brandId/promo-codes/:code/redemptions`: Reports paid order with canonical payload hashing.
- `GET /brands/:brandId/reconciliation`: Reconciles date range $[from, to)$.

---

## 5. Authoritative C24 Calculation Model
- **Retained Sales:** $\text{retained\_orders} \times \text{AOV} \times (1 - \text{discount\_pct} / 100) - \sum \text{partial\_refunds}$
- **Pre-Fee Contribution:** $\text{retained\_sales} \times (\text{margin\_pct} / 100)$
- **Net Contribution:** $\text{pre\_fee\_contribution} - \text{creator\_fee}$
- **Incremental Contribution:** $(\text{pre\_fee\_contribution} \times \text{incremental\_share}) - \text{creator\_fee}$
- **Break-Even Incremental Share:** $\text{creator\_fee} / \text{pre\_fee\_contribution}$ (returns `null` if pre-fee contribution $\le 0$)
- **Cost Per Unit Sold:** $\text{creator\_fee} / \text{units\_sold}$ (allocated per product and code with integer paise exact sum)
=======
## Notes
- Influencer names and metrics are sample data only.
- Estimated profit formula: `orders × (SP × (1 - discount / 100) - CP) - creator fee`.
- The demo optimizer checks every subset of the sample influencers and maximizes summed estimated profit within the creator-fee budget.
- It does not yet adjust for returns, non-incremental orders, shared orders between creators, or costs omitted from CP. Add those before using it for real spending decisions.

## Influencer Finder (`/finder`)
Discovers creators through the official APIs and keeps only: username, follower count, niche (plus platform and profile link).
1. Copy `.env.local.example` to `.env.local` and fill it in. Keys stay server-side (API routes under `src/app/api/finder`).
2. **YouTube**: create a Google Cloud project, enable *YouTube Data API v3*, create an API key. Keyword discovery works. Default quota: 100 `search.list` calls/day plus 10,000 units/day for everything else. Results are cached for 6 hours.
3. **Instagram**: needs the Instagram API with Facebook Login (a Business/Creator account linked to a Facebook Page, a Meta app, and a token with `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`). Business Discovery looks up **known usernames only**, and only Business/Creator accounts. There is no keyword search.
4. Niche is inferred from public text (title, description, topic tags, bio) in `src/lib/finder/niche.ts`. Edit the rules to match your categories.
5. Stored shortlist entries expire after 30 days. Check YouTube's API Services Developer Policies and Meta's Platform Terms for current retention rules.

## Supabase backend
Budget, custom coupon codes and the finder shortlist are stored in Supabase (falling back to the browser's localStorage if Supabase isn't configured). Each visitor gets an anonymous account, and Row Level Security means they can only see their own rows.
1. Create a project at https://supabase.com/dashboard.
2. **Authentication → Sign In / Providers**: turn on **Allow anonymous sign-ins**.
3. **SQL Editor**: paste and run `supabase/migrations/20261018000000_init.sql`, then run `supabase/seed.sql` (loads the sample creator catalogue and its initial financial records). Then run `supabase/migrations/20261018010000_creator_management.sql` to enable add/remove influencer operations and allow zero-order records.
4. **Project Settings → API**: copy the Project URL and the anon (or publishable) key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. `npm install`, then `npm run dev`.
6. Optional: enable the `pg_cron` extension (Database → Extensions) *before* step 3 so the 30-day shortlist purge is scheduled automatically.

Notes: anonymous data lives with that browser's session (clearing site data loses access to it) until you add real sign-in. The creator list and financials are read from the `creators` and `creator_financials` tables. The Overview page includes a Manage influencers section for adding and removing records. If Supabase isn't configured or can't be reached, the site falls back to `src/data/creator_personas_seed.json`. Only creators that have a `creator_financials` row appear in the planner. The optimizer tests every combination of creators (2^n), so keep that list to roughly 20 or fewer. The `orders` table is ready for real order data, but the pages still show generated sample orders. The influencer cost-per-product display has been removed from profile pages.

**Security warning:** the supplied management migration allows any authenticated session (including anonymous sign-ins) to change the shared creator catalogue. This is acceptable only for a private prototype. Before public deployment, replace these write policies with an admin-only authorization model.

\n## Influencer management changes\n
- Overview now includes **Manage influencers**: add a creator and their commercial figures, or remove an existing creator. New records persist in Supabase and appear in the planner after reload.
- Profile pages no longer show the **Influencer cost per product** table.
- Creator reads and financial values come from Supabase when configured; budget, coupon codes and finder shortlist have Supabase persistence with localStorage fallback.
- **Orders are not yet connected to live order records in the UI**: the profile currently generates illustrative sample orders. The database `orders` table is present but needs an order-entry/import flow before those numbers can be treated as real.
- Exact combination optimization supports at most 20 influencers because exhaustive subset search grows exponentially. The form blocks adding beyond 20.
- Apply `supabase/migrations/20261018010000_creator_management.sql` after the initial migration and seed SQL. If you already ran the initial migration, run this new migration in the SQL Editor before using Add/Remove.

## Presentation demo: Influencer Finder and profile graphs

- Open `/finder` to see 15 fictional YouTube demo creators and 15 fictional Instagram demo creators without needing API keys.
- Switch platform tabs to browse each platform's 15 sample profiles. Use **Load presentation demo** to restore demo data after trying live API lookup.
- Select **View profile** beside any demo creator to open their individualized six-month sales/revenue/net-profit graph and explanation.
- Existing `/influencer/[id]` creator profiles also include a personalized performance forecast.
- Demo handles, audience counts, campaign fees, orders, and forecasts are illustrative sample values only. They are not verified real creator accounts or actual results.
- Live API lookup still requires valid provider credentials configured in `.env.local`.
>>>>>>> 645e923d9db1ddd99aa786db5a42fc0827f40359
