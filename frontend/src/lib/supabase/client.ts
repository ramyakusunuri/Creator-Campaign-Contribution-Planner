// Browser-side client. If Supabase is configured via NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY,
// it connects to Supabase. Otherwise, it safely resolves to null so the app seamlessly uses SQLite and localStorage.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: any = null;
let ready: Promise<{ sb: any; uid: string } | null> | null = null;

export function getSupabase(): Promise<{ sb: any; uid: string } | null> {
  if (!url || !key || typeof window === "undefined") return Promise.resolve(null);
  if (!ready) {
    ready = (async () => {
      try {
        const pkgName = "@supabase/" + "supabase-js";
        const { createClient } = await import(/* webpackIgnore: true */ pkgName);
        client ??= createClient(url, key);
        const { data: { session } } = await client.auth.getSession();
        if (session) return { sb: client, uid: session.user.id };
        const { data, error } = await client.auth.signInAnonymously();
        if (error || !data.user) throw error ?? new Error("No user");
        return { sb: client, uid: data.user.id };
      } catch {
        ready = null;
        return null;
      }
    })();
  }
  return ready;
}
