import { NextRequest, NextResponse } from 'next/server';

export function validateApiKey(request: NextRequest): NextResponse | null {
  const expected = process.env.MTB_API_KEY;
  if (!expected) {
    return NextResponse.json({ error: 'MTB_API_KEY not configured' }, { status: 500 });
  }
  const provided = request.headers.get('x-mtb-api-key');
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
