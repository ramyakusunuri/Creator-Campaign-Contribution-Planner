import { NextRequest, NextResponse } from 'next/server';
import { parseBatchUrls } from '@/lib/finder';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrls = body.urls !== undefined ? body.urls : (body.url !== undefined ? body.url : '');
    const parsed = parseBatchUrls(rawUrls);
    return NextResponse.json(parsed, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Invalid JSON body' }, { status: 400 });
  }
}
