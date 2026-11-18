// Validates the order and creates a Montonio order; the browser is sent to the returned
// paymentUrl. The PDFs are e-mailed only after Montonio confirms payment
// (see montonio-return.js and montonio-notify.js).
const { sign } = require('./_lib/jwt');
const { COPY, MONTONIO, SHOP_URL, itemsOf, totalOf, signOrder } = require('./_lib/orders');

const COUNTRY = { fi: 'FI', et: 'EE', en: 'FI' };
const DESC = { fi: 'Lexoria asiakirjapankki', en: 'Lexoria document bank', et: 'Lexoria dokumendipank' };

const BACK_HOSTS = ['www.lexoria.fi', 'lexoria.fi', 'lexoriaweb.vercel.app', 'lexoriashop.vercel.app', new URL(SHOP_URL).hostname];
// The return address comes from the browser, so only our own pages are accepted
function safeBack(value) {
  try {
    const u = new URL(String(value || ''));
    if (u.hostname === 'localhost') return u.origin + u.pathname;
    if (u.protocol !== 'https:' || !BACK_HOSTS.includes(u.hostname)) return null;
    return u.origin + u.pathname;
  } catch (e) { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method_not_allowed' }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object') { res.status(400).json({ ok: false, error: 'bad_request' }); return; }

  const name = String(body.name || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().slice(0, 200);
  const lang = COPY[body.lang] ? body.lang : 'en';
  const items = itemsOf(Array.isArray(body.skus) ? body.skus : []);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  if (!name || !emailOk || items.length === 0) { res.status(400).json({ ok: false, error: 'invalid_fields' }); return; }
  // The e-mail confirms the buyer's waiver of the withdrawal right, so it must really have been given
  if (body.consent !== true) { res.status(400).json({ ok: false, error: 'consent_required' }); return; }
  if (!MONTONIO.accessKey || !MONTONIO.secretKey) { res.status(503).json({ ok: false, error: 'payment_not_configured' }); return; }

  const total = totalOf(items);
  const orderNo = 'LX' + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(2, 5).toUpperCase();
  // Where to send the buyer afterwards: the shop page they came from (main domain or shop domain)
  const back = safeBack(body.back) || `${SHOP_URL}/`;
  const orderToken = signOrder({ orderNo, name, email, lang, skus: items.map((it) => it.sku), back });

  // Method picked in the drawer: a bank (BIC + country) goes straight to that bank,
  // 'card' to Montonio's card page; nothing picked falls back to Montonio's own selection page
  const provider = /^[A-Z0-9]{8,11}$/.test(String(body.provider || '')) ? body.provider : null;
  const country = /^[A-Z]{2}$/.test(String(body.country || '')) ? body.country : COUNTRY[lang];
  const card = body.method === 'card';

  const parts = name.split(/\s+/);
  const payload = {
    accessKey: MONTONIO.accessKey,
    merchantReference: orderNo,
    merchantReferenceDisplay: orderNo,
    returnUrl: `${SHOP_URL}/api/montonio-return?o=${orderToken}`,
    notificationUrl: `${SHOP_URL}/api/montonio-notify?o=${orderToken}`,
    currency: 'EUR',
    grandTotal: total,
    locale: lang,
    billingAddress: { firstName: parts[0], lastName: parts.slice(1).join(' ') || parts[0], email, country: COUNTRY[lang] },
    lineItems: items.map((it) => ({ name: it[lang], quantity: 1, finalPrice: it.price })),
    payment: card ? {
      method: 'cardPayments',
      methodDisplay: DESC[lang],
      amount: total,
      currency: 'EUR',
    } : {
      method: 'paymentInitiation',
      methodDisplay: DESC[lang],
      methodOptions: Object.assign(
        { preferredCountry: country, preferredLocale: lang, paymentDescription: `${DESC[lang]} ${orderNo}` },
        provider ? { preferredProvider: provider } : {}
      ),
      amount: total,
      currency: 'EUR',
    },
    expiresIn: 30,
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
  };

  let r, data;
  try {
    r = await fetch(`${MONTONIO.api}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: sign(payload, MONTONIO.secretKey) }),
    });
    data = await r.json().catch(() => ({}));
  } catch (e) {
    res.status(502).json({ ok: false, error: 'payment_failed' });
    return;
  }
  if (!r.ok || !data.paymentUrl) {
    console.error('montonio error', r.status, JSON.stringify(data).slice(0, 500));
    res.status(502).json({ ok: false, error: 'payment_failed' });
    return;
  }
  res.status(200).json({ ok: true, order: orderNo, paymentUrl: data.paymentUrl, total, items: items.map((it) => it.sku) });
};
