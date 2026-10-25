// Montonio sends the buyer back here with `order-token`. On a paid order the PDFs are
// e-mailed (idempotent with the webhook) and the buyer lands on the shop with ?order=…&status=paid.
const { readOrder, readMontonioToken, sendOrderEmail } = require('./_lib/orders');

function redirect(res, back, params) {
  const u = new URL(back);
  Object.entries(params).forEach(([k, v]) => { if (v != null) u.searchParams.set(k, v); });
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 303;
  res.setHeader('Location', u.toString());
  res.end();
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const order = readOrder(q.o);
  if (!order) { res.status(400).send('Invalid order token'); return; }
  const t = readMontonioToken(q['order-token'], order);
  if (!t || t.paymentStatus !== 'PAID') {
    redirect(res, order.back, { order: order.orderNo, status: t && t.paymentStatus === 'PENDING' ? 'pending' : 'failed' });
    return;
  }
  let status = 'paid';
  try {
    await sendOrderEmail(order, { method: t.paymentMethod });
  } catch (e) {
    console.error('return: mail failed', order.orderNo, e.message);
    status = 'paid-mail-' + e.message;
  }
  redirect(res, order.back, { order: order.orderNo, status, email: order.email });
};
