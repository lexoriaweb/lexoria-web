// Montonio's webhook: POST { orderToken }. Sends the PDFs for PAID orders; the Resend
// idempotency key keeps this from duplicating the e-mail the return handler already sent.
const { readOrder, readMontonioToken, sendOrderEmail } = require('./_lib/orders');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const order = readOrder((req.query || {}).o);
  if (!order) { res.status(400).json({ ok: false, error: 'invalid_order' }); return; }
  const t = readMontonioToken(body && body.orderToken, order);
  if (!t) { res.status(400).json({ ok: false, error: 'invalid_token' }); return; }
  if (t.paymentStatus !== 'PAID') { res.status(200).json({ ok: true, ignored: t.paymentStatus }); return; }
  try {
    await sendOrderEmail(order, { method: t.paymentMethod });
  } catch (e) {
    console.error('notify: mail failed', order.orderNo, e.message);
    // A 5xx makes Montonio retry, which is what we want when the mail provider hiccups
    res.status(e.message === 'send_failed' ? 502 : 200).json({ ok: false, error: e.message });
    return;
  }
  res.status(200).json({ ok: true });
};
