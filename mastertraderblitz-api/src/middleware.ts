import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const expected = process.env.MTB_API_KEY;
  if (!expected) {
    return NextResponse.json({ error: 'MTB_API_KEY not configured' }, { status: 500 });
  }

  const provided = request.headers.get('x-mtb-api-key');
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
