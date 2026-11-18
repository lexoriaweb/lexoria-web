import { NextResponse } from 'next/server';

// Temporary gate while the client reviews the site. Every path, shop paths included,
// shows a password page until a cookie proves the password from SITE_PASSWORD was
// given. No password configured means locked, not open.
const COOKIE = 'lex_gate';
const OPEN = ['/lexoria-logo-white.png', '/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png', '/og.png'];

async function token(password) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('lexoria-gate:' + password));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function safePath(value) {
  const s = String(value || '/');
  return s.startsWith('/') && !s.startsWith('//') ? s : '/';
}

function esc(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function page(next, wrong) {
  return `<!doctype html>
<html lang="fi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Lexoria</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=4">
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=4">
<meta property="og:title" content="Lexoria">
<meta property="og:description" content="Asianajotoimisto Lexoria Oy · Helsinki">
<meta property="og:site_name" content="Lexoria">
<meta property="og:type" content="website">
<meta property="og:image" content="https://www.lexoria.fi/og.png?v=3">
<meta property="og:image:width" content="240">
<meta property="og:image:height" content="240">
<meta name="twitter:card" content="summary">
<meta name="twitter:image" content="https://www.lexoria.fi/og.png?v=3">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root { --paper: #ECE7DD; --ink: #0F1419; --maroon: #5B21B6; --maroon-soft: #C7BEE5; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 24px;
    background: #0B0E12;
    color: var(--paper);
    font-family: 'Newsreader', serif;
    font-weight: 300;
    -webkit-font-smoothing: antialiased;
    position: relative;
    overflow: hidden;
  }
  body::before {
    content: "";
    position: fixed;
    inset: -20%;
    background:
      radial-gradient(55% 45% at 84% 10%, rgba(199, 190, 229, 0.3), transparent 62%),
      radial-gradient(45% 40% at 8% 92%, rgba(91, 33, 182, 0.22), transparent 62%);
    filter: blur(40px);
    pointer-events: none;
  }
  .card {
    position: relative;
    width: min(440px, 100%);
    padding: 48px 40px 36px;
    background: rgba(236, 231, 221, 0.035);
    border: 1px solid rgba(236, 231, 221, 0.12);
    border-radius: 18px;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    box-shadow: 0 40px 100px -30px rgba(0, 0, 0, 0.85);
    text-align: center;
  }
  .logo { height: 34px; width: auto; display: block; margin: 0 auto; }
  .tag {
    margin-top: 16px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--maroon-soft);
  }
  form { margin-top: 36px; text-align: left; }
  label {
    display: block;
    margin-bottom: 10px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(236, 231, 221, 0.6);
  }
  input {
    width: 100%;
    padding: 16px 18px;
    background: rgba(11, 14, 18, 0.6);
    border: 1px solid rgba(236, 231, 221, 0.18);
    border-radius: 10px;
    color: var(--paper);
    font-family: 'Newsreader', serif;
    font-size: 20px;
    outline: none;
    transition: border-color 0.3s, box-shadow 0.3s;
  }
  input:focus { border-color: var(--maroon-soft); box-shadow: 0 0 0 3px rgba(199, 190, 229, 0.18); }
  button {
    margin-top: 16px;
    width: 100%;
    padding: 17px;
    border: 0;
    border-radius: 999px;
    background: var(--maroon);
    color: var(--paper);
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.3s, letter-spacing 0.3s;
  }
  button:hover { background: #6D2FD1; letter-spacing: 0.28em; }
  .err {
    margin-top: 16px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    text-align: center;
    color: #E8A0A0;
  }
  .foot {
    margin-top: 28px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(236, 231, 221, 0.35);
  }
  @media (max-width: 480px) { .card { padding: 40px 24px 28px; border-radius: 14px; } }
</style>
</head>
<body>
  <main class="card">
    <img class="logo" src="/lexoria-logo-white.png" alt="Lexoria">
    <div class="tag">Private preview</div>
    <form method="post" action="/__gate">
      <input type="hidden" name="next" value="${esc(next)}">
      <label for="pw">Salasana · Password</label>
      <input id="pw" name="password" type="password" autocomplete="current-password" autofocus required>
      <button type="submit">Enter</button>
      ${wrong ? '<div class="err">Väärä salasana · Wrong password</div>' : ''}
    </form>
    <div class="foot">© 2026 Asianajotoimisto Lexoria Oy</div>
  </main>
</body>
</html>`;
}

export async function middleware(req) {
  const { pathname, searchParams } = req.nextUrl;
  if (OPEN.includes(pathname)) return NextResponse.next();

  const password = process.env.SITE_PASSWORD;
  const expected = password ? await token(password) : null;
  if (expected && req.cookies.get(COOKIE)?.value === expected) return NextResponse.next();

  if (req.method === 'POST' && pathname === '/__gate') {
    const form = await req.formData().catch(() => null);
    const next = safePath(form && form.get('next'));
    const given = form ? String(form.get('password') || '') : '';
    if (expected && given === password) {
      const res = NextResponse.redirect(new URL(next, req.url), 303);
      res.cookies.set(COOKIE, expected, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
      return res;
    }
    const back = new URL(next, req.url);
    back.searchParams.set('gate', 'wrong');
    return NextResponse.redirect(back, 303);
  }

  const next = new URL(req.url);
  next.searchParams.delete('gate');
  // 200, not 401: link-preview crawlers (WhatsApp, Slack) drop error responses and
  // would never see the Open Graph tags on this page; noindex keeps search engines away
  return new NextResponse(page(next.pathname + next.search, searchParams.get('gate') === 'wrong'), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export const config = { matcher: '/:path*' };
