import { NextRequest, NextResponse } from "next/server";
import { discoverYouTube } from "../../../../lib/finder/youtube";
import { FinderError } from "../../../../lib/finder/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const region = (req.nextUrl.searchParams.get("region") ?? "").trim().toUpperCase();
  if (q.length < 2 || q.length > 100) return NextResponse.json({ error: "Enter a keyword of 2–100 characters." }, { status: 400 });
  if (region && !/^[A-Z]{2}$/.test(region)) return NextResponse.json({ error: "Region must be a 2-letter country code." }, { status: 400 });
  try {
    return NextResponse.json({ creators: await discoverYouTube(q, 25, region || undefined) });
  } catch (e) {
    const err = e instanceof FinderError ? e : new FinderError("Unexpected error.");
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
