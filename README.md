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

## Influencer Finder (`/finder`)
Discovers creators through the official APIs and keeps only: username, follower count, niche (plus platform and profile link).
1. Copy `.env.local.example` to `.env.local` and fill it in. Keys stay server-side (API routes under `src/app/api/finder`).
2. **YouTube**: create a Google Cloud project, enable *YouTube Data API v3*, create an API key. Keyword discovery works. Default quota: 100 `search.list` calls/day plus 10,000 units/day for everything else. Results are cached for 6 hours.
3. **Instagram**: needs the Instagram API with Facebook Login (a Business/Creator account linked to a Facebook Page, a Meta app, and a token with `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`). Business Discovery looks up **known usernames only**, and only Business/Creator accounts. There is no keyword search.
4. Niche is inferred from public text (title, description, topic tags, bio) in `src/lib/finder/niche.ts`. Edit the rules to match your categories.
5. Stored shortlist entries expire after 30 days. Check YouTube's API Services Developer Policies and Meta's Platform Terms for current retention rules.
