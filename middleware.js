import { NextResponse } from 'next/server';

// Temporary gate while the client reviews the site: the whole domain, shop paths
// included, asks for HTTP Basic Auth. Any username, password from SITE_PASSWORD.
// No password configured means locked, not open.
export function middleware(req) {
  const expected = process.env.SITE_PASSWORD;
  const header = req.headers.get('authorization') || '';
  if (expected && header.startsWith('Basic ')) {
    let given = '';
    try { given = atob(header.slice(6)).split(':').slice(1).join(':'); } catch (e) {}
    if (given === expected) return NextResponse.next();
  }
  return new NextResponse('Lexoria.fi is not public yet.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Lexoria", charset="UTF-8"', 'Cache-Control': 'no-store' },
  });
}

export const config = { matcher: '/:path*' };
