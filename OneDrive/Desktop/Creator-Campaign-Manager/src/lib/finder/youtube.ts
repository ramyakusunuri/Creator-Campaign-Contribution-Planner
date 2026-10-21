import { FinderError, type FoundCreator } from "./types";
import { detectNiche } from "./niche";

const BASE = "https://www.googleapis.com/youtube/v3";

async function yt(path: string, params: Record<string, string>) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new FinderError("YOUTUBE_API_KEY is not set on the server.", 503);
  const url = new URL(`${BASE}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set("key", apiKey);
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) {
    const reason: string | undefined = data?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded") throw new FinderError("YouTube daily quota is used up. It resets at midnight Pacific Time.", 429);
    throw new FinderError(data?.error?.message ?? "YouTube API request failed.", 502);
  }
  return data;
}

// Cache results so repeat searches don't burn the (small) daily search quota. In-memory: resets on redeploy / per serverless instance.
const TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; data: FoundCreator[] }>();

export async function discoverYouTube(query: string, max = 25, region?: string): Promise<FoundCreator[]> {
  const cacheKey = `${query.toLowerCase()}|${region ?? ""}|${max}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  // 1) search.list finds channel ids for the keyword (has its own small daily limit).
  const search = await yt("search", {
    part: "snippet", type: "channel", q: query, maxResults: String(max), ...(region ? { regionCode: region } : {}),
  });
  const ids: string[] = (search.items ?? []).map((i: any) => i.id?.channelId).filter(Boolean);
  if (ids.length === 0) return [];

  // 2) channels.list returns follower (subscriber) counts and topic tags for up to 50 ids in one call.
  const channels = await yt("channels", { part: "snippet,statistics,topicDetails", id: ids.join(","), maxResults: "50" });
  const now = new Date().toISOString();
  const data: FoundCreator[] = (channels.items ?? []).map((c: any) => {
    const handle: string | undefined = c.snippet?.customUrl; // e.g. "@aaravframes"
    const topics = (c.topicDetails?.topicCategories ?? []).map((u: string) => decodeURIComponent(u.split("/").pop() ?? "").replace(/_/g, " "));
    return {
      platform: "youtube" as const,
      username: handle ?? c.snippet?.title ?? c.id,
      followers: c.statistics?.hiddenSubscriberCount ? null : Number(c.statistics?.subscriberCount ?? 0),
      niche: detectNiche(c.snippet?.title, c.snippet?.description, ...topics),
      profileUrl: handle ? `https://www.youtube.com/${handle}` : `https://www.youtube.com/channel/${c.id}`,
      fetchedAt: now,
    };
  });
  cache.set(cacheKey, { at: Date.now(), data });
  return data;
}
