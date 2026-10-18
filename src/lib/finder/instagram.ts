import { FinderError, type FoundCreator } from "./types";
import { detectNiche } from "./niche";

const GRAPH = `https://graph.facebook.com/${process.env.IG_GRAPH_VERSION ?? "v25.0"}`;

export type IgResult = { ok: true; creator: FoundCreator } | { ok: false; username: string; reason: string };

// Instagram has no keyword/niche search. Business Discovery looks up ONE known username at a time, and only
// works when that account is an Instagram Business or Creator (professional) account.
export async function lookupInstagram(username: string): Promise<IgResult> {
  const token = process.env.IG_ACCESS_TOKEN;
  const igUserId = process.env.IG_USER_ID;
  if (!token || !igUserId) throw new FinderError("IG_ACCESS_TOKEN / IG_USER_ID are not set on the server.", 503);

  const url = new URL(`${GRAPH}/${igUserId}`);
  url.searchParams.set("fields", `business_discovery.username(${username}){username,followers_count,biography}`);
  url.searchParams.set("access_token", token);
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.business_discovery) {
    const reason = data?.error?.message ?? "Not found, or not a Business/Creator account.";
    return { ok: false, username, reason: String(reason).replace(token, "***") };
  }
  const d = data.business_discovery;
  return {
    ok: true,
    creator: {
      platform: "instagram",
      username: `@${d.username ?? username}`,
      followers: typeof d.followers_count === "number" ? d.followers_count : null,
      niche: detectNiche(d.biography),
      profileUrl: `https://www.instagram.com/${d.username ?? username}`,
      fetchedAt: new Date().toISOString(),
    },
  };
}
