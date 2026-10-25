// Minimal HS256 JWT, enough for Montonio's order tokens and our own order state token.
const crypto = require('crypto');

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function fromB64url(s) {
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(payload, secret) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}

// Returns the payload, or null when the signature is wrong, the token is malformed or expired.
function verify(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  const expect = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest();
  const got = fromB64url(sig);
  if (got.length !== expect.length || !crypto.timingSafeEqual(got, expect)) return null;
  let h, payload;
  try {
    h = JSON.parse(fromB64url(head).toString('utf8'));
    payload = JSON.parse(fromB64url(body).toString('utf8'));
  } catch (e) { return null; }
  if (!h || h.alg !== 'HS256') return null;
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  return payload;
}

module.exports = { sign, verify };
