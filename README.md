# Creator Campaign Contribution Planner

A Next.js + React + TypeScript + Tailwind CSS starter for comparing influencer campaigns under a ₹25 lakh budget.

## Requirements
- Node.js 18.17 or newer
- npm

## Run locally
1. Extract the ZIP.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open http://localhost:3000.

## Notes
- Influencer names and metrics are sample data only.
- Estimated profit formula: `orders × (SP × (1 - discount / 100) - CP) - creator fee`.
- The demo optimizer checks every subset of the sample influencers and maximizes summed estimated profit within the creator-fee budget.
- It does not yet adjust for returns, non-incremental orders, shared orders between creators, or costs omitted from CP. Add those before using it for real spending decisions.
