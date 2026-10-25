// Banks and card availability for the in-drawer payment method picker, read from
// Montonio's store endpoint and trimmed. Cached in the function instance for 10 minutes.
const { sign } = require('./_lib/jwt');
const { MONTONIO } = require('./_lib/orders');

const COUNTRIES = ['FI', 'EE', 'LV', 'LT'];
let cache = { at: 0, data: null };

async function load() {
  if (cache.data && Date.now() - cache.at < 10 * 60 * 1000) return cache.data;
  const token = sign({ accessKey: MONTONIO.accessKey, exp: Math.floor(Date.now() / 1000) + 600 }, MONTONIO.secretKey);
  const r = await fetch(`${MONTONIO.api}/stores/payment-methods`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('montonio_' + r.status);
  const d = await r.json();
  const pm = d.paymentMethods || {};
  const setup = (pm.paymentInitiation && pm.paymentInitiation.setup) || {};
  const banks = {};
  COUNTRIES.forEach((c) => {
    const list = (setup[c] && setup[c].paymentMethods) || [];
    if (list.length) {
      banks[c] = list
        .filter((b) => !b.supportedCurrencies || b.supportedCurrencies.includes('EUR'))
        .sort((a, b) => (a.uiPosition || 99) - (b.uiPosition || 99))
        .map((b) => ({ code: b.code, name: b.name.replace(/ (Estonia|Finland|Latvia|Lithuania)$/, ''), logo: b.logoUrl }));
    }
  });
  cache = { at: Date.now(), data: { banks, cards: !!pm.cardPayments, sandbox: MONTONIO.sandbox } };
  return cache.data;
}

module.exports = async (req, res) => {
  if (!MONTONIO.accessKey || !MONTONIO.secretKey) { res.status(503).json({ ok: false, error: 'payment_not_configured' }); return; }
  try {
    const data = await load();
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.status(200).json({ ok: true, ...data });
  } catch (e) {
    console.error('payment-methods', e.message);
    res.status(502).json({ ok: false, error: 'payment_failed' });
  }
};
