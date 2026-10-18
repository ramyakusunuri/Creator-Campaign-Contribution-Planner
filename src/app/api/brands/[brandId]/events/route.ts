import { NextRequest, NextResponse } from 'next/server';
import { authenticateBrand } from '@/lib/auth';
import { sseHub } from '@/lib/sseHub';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { brandId: string } }
) {
  const { brandId } = params;
  const auth = authenticateBrand(req, brandId);
  if (!auth.success) {
    return auth.response;
  }

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Create stream adapter for sseHub
  const controllerAdapter = {
    enqueue: (chunk: Uint8Array) => {
      writer.write(chunk).catch(() => {});
    },
    close: () => {
      writer.close().catch(() => {});
    },
    error: (e: any) => {
      writer.abort(e).catch(() => {});
    }
  } as any;

  const subscribed = sseHub.subscribe(brandId, controllerAdapter, req.signal);
  if (!subscribed) {
    return NextResponse.json(
      { error: 'Too many SSE subscribers for brand (limit: 20)' },
      { status: 429 }
    );
  }

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
