# Creator Campaign Contribution Planner (Case C24)

A high-performance Node.js application built with native `node:http`, native `node:sqlite` persistence, Server-Sent Events (SSE) streaming, and dual-key security for influencer promo code management and e-commerce checkout integration under a ₹25 lakh budget.

> **Notice:** All creator rosters, brand configurations, and initial planning records are **synthetic sample data**. Monetary figures are in Indian Rupees (**INR / ₹**). Stored in SQLite as integer paise. Unknown discounts remain strictly `null`, never converted to zero.

---

## 1. Requirements & Stack
- **Runtime:** Node.js 22.5.0+ (Node 24 recommended, uses built-in `node:sqlite` DatabaseSync with zero compilation dependencies).
- **Architecture:** Plain Node.js (`node:http`, `node:crypto`, `node:sqlite`, `node:fs`). Zero third-party web frameworks or runtime dependencies required for promo services.
- **Frontend:** Vanilla HTML/CSS/JS in `public/` using native `fetch` + stream reader (`ReadableStreamDefaultReader`) with `X-Brand-Key` header authentication.

---

## 2. Running the Application

### 1. Start the Native Promo Server & Live Dashboard:
```bash
npm run start:promo
# Or directly:
node src/server.js
```
The server will start on [http://localhost:3000](http://localhost:3000) (or configured `PORT`).

### 2. Run the E-Commerce Checkout Simulator:
```bash
npm run simulate
# Or directly:
node scripts/fake-website.js
```
The simulator checks that `/health` is in `demo` mode, tests pre-checkout advisory checks (`GET .../check`), reports paid redemptions (`POST .../redemptions`), and tests idempotency duplicate responses.

### 3. Run the Automated Test Suite:
```bash
npm test
```
Executes all contract and integration test suites:
- `tests/promoNativeIntegration.test.js`: Full integration suite covering dual-key auth, 1MB payload limits, canonical hashing, unknown discounts, SSE caps, and persistence.
- `tests/storageContract.test.js`: Identical contract tests across both `SqliteStorage` and `MemoryStorage`.
- `tests/fakeWebsiteSimulator.test.js`: Health check demo guard and simulation execution.
- `tests/promoIntegration.test.js`: Baseline C24 mathematical engine and line item accounting.

---

## 3. Core Architecture & Division of Responsibility

| Capability | Owned By | Description |
| :--- | :--- | :--- |
| **Promo Code Registration** | Brand (C24 Dashboard) | Brand registers the code, influencer association, and validity window. |
| **Discount Rule & Calculation**| **Website** | The e-commerce website owns all discount logic. C24 does not know or calculate discounts; it records what the website reports. |
| **Pre-Checkout Advisory Check**| C24 Service | Website asks C24 whether a promo code is registered and valid *right now*. |
| **Paid Order Reporting** | Website Server | When payment succeeds, website reports order items, paid timestamp, and applied discount to C24. |
| **Attribution & Live Dashboard**| C24 Service | Stores order in SQLite database, updates campaign metrics, and streams live SSE updates over HTTP. |

---

## 4. Dual-Key Authentication & API Endpoints

### Brand Endpoints (`X-Brand-Key: demo-key-b1`)
- `GET /health`: Server health and environment status (`{ status: "ok", environment: "demo" }`).
- `GET /brands/:brandId/creators`: Lists creators with brand-specific eligibility and rival conflict checks.
- `POST /brands/:brandId/promo-codes`: Register promo code with creator and validity dates. Emits `promo_created`.
- `PATCH /brands/:brandId/promo-codes/:code`: Update validity dates (`valid_from`, `valid_to`). Emits `code_updated`.
- `GET /brands/:brandId/promo-codes`: List registered promo codes with derived status (`valid`, `not_yet_valid`, `expired`), order counts, units, and gross revenue.
- `GET /brands/:brandId/promo-codes/:code`: Detailed performance metrics and itemized redemptions.
- `GET /brands/:brandId/unregistered-uses`: Audit list of reported orders using unregistered codes.
- `GET /brands/:brandId/feed-status`: Live feed metrics (website count, synthetic seed count, unregistered count, last received).
- `POST /brands/:brandId/purge-seed`: (Demo only) Purges synthetic seed records.
- `GET /brands/:brandId/events`: Live Server-Sent Events (SSE) feed. 20 client cap per brand (HTTP 429), 25s heartbeat (`: ping\n\n`).

### Website Server Endpoints (`X-Report-Key: demo-report-key-b1`)
- `GET /brands/:brandId/promo-codes/:code/check`: Pre-checkout advisory check. Returns `{ code, valid: true/false, reason: "valid" | "not_found" | "not_yet_valid" | "expired" }`. Never leaks discounts or creator info.
- `POST /brands/:brandId/promo-codes/:code/redemptions`: Reports paid order. Requires `payment_confirmed_at`, line items, and canonical payload hashing for idempotency (same hash $\rightarrow$ 200 `{ duplicate: true }`, different hash $\rightarrow$ 409 Conflict). Max 1MB body limit.
- `GET /brands/:brandId/reconciliation`: Reconciles date range $[from, to)$ (max 5,000 items).

---

## 5. Authoritative C24 Calculation Model
- **Retained Sales:** $\text{retained\_orders} \times \text{AOV} \times (1 - \text{discount\_pct} / 100) - \sum \text{partial\_refunds}$
- **Pre-Fee Contribution:** $\text{retained\_sales} \times (\text{margin\_pct} / 100)$
- **Net Contribution:** $\text{pre\_fee\_contribution} - \text{creator\_fee}$
- **Incremental Contribution:** $(\text{pre\_fee\_contribution} \times \text{incremental\_share}) - \text{creator\_fee}$
- **Break-Even Incremental Share:** $\text{creator\_fee} / \text{pre\_fee\_contribution}$ (returns `null` if pre-fee contribution $\le 0$)
- **Data Integrity Rule:** Missing values are strictly treated as **UNKNOWN (`null`)**, never converted to zero.
