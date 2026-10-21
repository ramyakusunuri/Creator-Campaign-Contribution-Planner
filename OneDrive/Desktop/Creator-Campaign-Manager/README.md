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
