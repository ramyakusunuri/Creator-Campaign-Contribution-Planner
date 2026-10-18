import { NextResponse } from 'next/server';
import { LATEST_SCHEMA_VERSION } from '@/lib/migrations';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    environment: process.env.APP_ENV || 'demo',
    storage: 'sqlite',
    schema_version: LATEST_SCHEMA_VERSION,
    timestamp: new Date().toISOString()
  });
}
