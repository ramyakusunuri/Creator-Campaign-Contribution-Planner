import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'X-Report-Key, X-Brand-Key, X-Agency-Key, Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Pass through for other requests, setting CORS headers on response
  const response = NextResponse.next();
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'X-Report-Key, X-Brand-Key, X-Agency-Key, Content-Type, Authorization');

  return response;
}

export const config = {
  matcher: ['/brands/:path*', '/api/:path*', '/health'],
};
