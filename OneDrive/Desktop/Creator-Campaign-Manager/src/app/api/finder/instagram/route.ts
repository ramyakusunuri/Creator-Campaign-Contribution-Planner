import { NextRequest, NextResponse } from "next/server";
import { lookupInstagram } from "../../../../lib/finder/instagram";
import { FinderError } from "../../../../lib/finder/types";

export const dynamic = "force-dynamic";
const MAX_USERNAMES = 10;

export async function GET(req: NextRequest) {
  const names = Array.from(new Set(
    (req.nextUrl.searchParams.get("usernames") ?? "").split(/[\s,]+/).map(s => s.replace(/^@/, "").trim()).filter(Boolean),
  ));
  if (names.length === 0) return NextResponse.json({ error: "Enter at least one Instagram username." }, { status: 400 });
  if (names.length > MAX_USERNAMES) return NextResponse.json({ error: `Look up at most ${MAX_USERNAMES} usernames at a time.` }, { status: 400 });
  // Instagram usernames: letters, numbers, periods, underscores, max 30. Also keeps the Graph field expression safe.
  if (names.some(n => !/^[A-Za-z0-9._]{1,30}$/.test(n))) return NextResponse.json({ error: "Invalid Instagram username." }, { status: 400 });
  try {
    const results = await Promise.all(names.map(lookupInstagram));
    return NextResponse.json({
      creators: results.flatMap(r => (r.ok ? [r.creator] : [])),
      failed: results.flatMap(r => (r.ok ? [] : [{ username: r.username, reason: r.reason }])),
    });
  } catch (e) {
    const err = e instanceof FinderError ? e : new FinderError("Unexpected error.");
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
