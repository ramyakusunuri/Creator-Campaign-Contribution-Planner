# C24 Presentation & Demonstration Walkthrough Script

This step-by-step guide walks through the complete end-to-end presentation flow of the Creator Campaign Contribution Planner.

---

## Pre-requisites
1. Development server running: `npm run dev` (running at `http://localhost:3000`).
2. Server in Demo mode: Verify by checking `http://localhost:3000/health` -> `{"status":"ok","environment":"demo"}`.
3. Open a terminal ready to execute the demo CLI scripts in `scripts/`.

---

## Step 1: Load the Application & Verify Environment
1. Open `http://localhost:3000` in the browser.
2. Note the **Platform Limits & Disclosures Banner** pinned at the top:
   - *"Synthetic data in demo environment."*
   - *"Incremental share is a planning assumption, not a causal guarantee."*
   - *"Promo codes measure attribution, not causation."*
3. Verify the dual-key indicator in the navigation bar:
   - Active Brand: **Brand B1 (AeroWear)**.
   - Active Keys: `demo-brand-key-b1`, `demo-agency-key`.

---

## Step 2: Show a Creator Winning and Losing
1. Navigate to the **Campaign Contribution Planner** table.
2. Observe creator **Aarav Sharma (C1)**:
   - Positive net contribution, high return on investment (ROI > 1.0), highlighted in vibrant green (Winning).
3. Observe creator **Kabir Mehta (C3)**:
   - Higher negotiated fee relative to base incremental units.
   - Shows negative or sub-threshold contribution, labeled with a red warning badge (Losing).

---

## Step 3: Flip a Creator with an Interactive Parameter Slider
1. Locate creator **Kabir Mehta (C3)** in the scenario table.
2. Adjust the **Incremental Share (%)** slider from `20%` up to `65%` or adjust the **Negotiated Fee** slider downward.
3. Observe the dynamic recalculation in real-time:
   - Net contribution flips from negative to positive.
   - The status indicator automatically flips from "Losing" to "Profitable Contribution".
   - The dynamic summary chart recalculates instantaneously without page reload.

---

## Step 4: Show the Commission & Budget Cap Holding
1. Scroll down to the **Campaign Budget & Safety Capping** section.
2. Increase the target sales units or bonus incentives significantly.
3. Observe the **Hard Cap Indicator**:
   - The total campaign payout stops at the configured brand ceiling (e.g., ₹5,00,000 maximum cap).
   - Any excess potential commission is marked as "Capped by Brand Governance Rule".

---

## Step 5: Run the Fake Website E-Commerce Simulator
1. In your terminal, run the standalone simulator:
   ```bash
   node scripts/fake-website.js --repeat 2 --bad-code
   ```
2. Observe the terminal output:
   - Simulator verifies target `/health` returns `environment: "demo"`.
   - Executes pre-checkout check for `AARAV10` -> valid.
   - Executes pre-checkout check for `NONEXISTENT99` -> rejected with reason.
   - Emits paid order redemptions over HTTPS/HTTP with integer paise precision.
   - Re-transmits the same order ID to prove idempotency (`duplicate: true`).

---

## Step 6: Inspect Real-Time Cost Per Unit
1. Switch to the **Cost Per Unit Sold** tab.
2. Review creator **Aarav Sharma**:
   - Fee: ₹2,00,000.
   - Units Sold: Dynamically updated from the newly received website redemptions.
   - Cost Per Unit: `fee_inr / units`, rounded to 2 decimal places.
   - Detailed product and promo code fee allocation table ensures that the sum of line paise equals the total fee exactly (with the last item absorbing rounding paise).

---

## Step 7: Search Creators & Shortlist with Eligibility Enforcement
1. Switch to the **Creator Finder & Shortlists** tab.
2. Paste a set of channel links into the URL parser:
   ```text
   https://youtube.com/@aaravstyle
   https://instagram.com/diyaglow
   https://disallowed-platform.com/user
   https://youtube.com/@aaravstyle
   ```
3. Click **Parse URLs**:
   - YouTube and Instagram canonical handles are recognized.
   - Duplicate link is highlighted and flagged.
   - Disallowed host is rejected with a clear descriptive reason.
4. Examine the platform ranking table:
   - Creators are ranked strictly within their platform.
   - Creator with hidden followers appears in the separate **Unranked (Unknown Count)** group.
5. Click **Add to Shortlist** for an excluded creator:
   - Notice the button is disabled / replaced with a refusal badge: *"Refused: Creator is excluded from brand campaigns (safety/compliance review)."*
6. Shortlist an eligible creator and observe Brand A's shortlist being isolated and invisible to Brand B.

---

## Step 8: Export Evidence & Audit Log
1. Click **Export Audit & Reconciliation Evidence** button.
2. Download the JSON/CSV evidence report containing timestamps, order hashes, and promo code audits.
