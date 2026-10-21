# Deploying on Vercel

1. Push this project folder to your GitHub repository, with `package.json` at the repository root.
2. In Vercel, import that GitHub repository. Keep the Root Directory set to `./` (the folder containing `package.json`).
3. Vercel detects Next.js. Build and install commands are configured in `vercel.json`.
4. Deploy. The app can run in demo/sample mode without API credentials.
5. Optional: add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel Project Settings → Environment Variables if you have configured the Supabase schema and anonymous sign-in. Add `YOUTUBE_API_KEY`, `IG_USER_ID`, `IG_ACCESS_TOKEN`, and optionally `IG_GRAPH_VERSION` only if you want live creator lookup. Never add a Supabase service-role key to a `NEXT_PUBLIC_` variable.
6. After adding or changing environment variables, redeploy.

If Vercel still shows the previous `Expected '}', got '<eof>'` error in `src/lib/creators-db.ts`, the deployment is building an older GitHub commit. Commit/push the corrected file from this archive and redeploy the latest commit.
