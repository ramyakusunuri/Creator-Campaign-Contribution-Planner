<<<<<<< HEAD
// Browser-side client. If Supabase is configured via NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY,
// it connects to Supabase. Otherwise, it safely resolves to null so the app seamlessly uses SQLite and localStorage.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: any = null;
let ready: Promise<{ sb: any; uid: string } | null> | null = null;

export function getSupabase(): Promise<{ sb: any; uid: string } | null> {
=======
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser-side client. The URL and anon/publishable key are safe to expose: Row Level Security
// (see supabase/migrations) is what protects the data. NEVER put the service_role / secret key here.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;
let ready: Promise<{ sb: SupabaseClient; uid: string } | null> | null = null;

// Resolves to a signed-in client (anonymous sign-in on first visit), or null when Supabase isn't
// configured / reachable, so callers can fall back to localStorage and the app keeps working.
export function getSupabase(): Promise<{ sb: SupabaseClient; uid: string } | null> {
>>>>>>> 645e923d9db1ddd99aa786db5a42fc0827f40359
  if (!url || !key || typeof window === "undefined") return Promise.resolve(null);
  if (!ready) {
    ready = (async () => {
      try {
<<<<<<< HEAD
        const pkgName = "@supabase/" + "supabase-js";
        const { createClient } = await import(/* webpackIgnore: true */ pkgName);
=======
>>>>>>> 645e923d9db1ddd99aa786db5a42fc0827f40359
        client ??= createClient(url, key);
        const { data: { session } } = await client.auth.getSession();
        if (session) return { sb: client, uid: session.user.id };
        const { data, error } = await client.auth.signInAnonymously();
        if (error || !data.user) throw error ?? new Error("No user");
        return { sb: client, uid: data.user.id };
      } catch {
<<<<<<< HEAD
        ready = null;
=======
        ready = null; // allow a retry on the next call
>>>>>>> 645e923d9db1ddd99aa786db5a42fc0827f40359
        return null;
      }
    })();
  }
  return ready;
}
