// Simulated checkout: validates the order, then e-mails the purchased PDFs via Resend.
// Payment (Montonio) is not wired yet — nothing is charged.
const fs = require('fs');
const path = require('path');

const CATALOG = {
  'doc-01': { price: 29, file: 'toimeksiantosopimus.pdf', fi: 'Toimeksiantosopimus', en: 'Engagement agreement' },
  'doc-02': { price: 39, file: 'testamentti-fi-ee.pdf', fi: 'Testamentti suomi–viro', en: 'Will, Finnish–Estonian' },
  'doc-03': { price: 29, file: 'testamentti-luonnos.pdf', fi: 'Testamentti toimeenpanijalla', en: 'Will with executor' },
  'doc-04': { price: 39, file: 'edunvalvontavaltuutus.pdf', fi: 'Edunvalvontavaltuutus', en: 'Continuing power of attorney' },
  'doc-05': { price: 15, file: 'kirjepohja.pdf', fi: 'Lexorian kirjepohja', en: 'Lexoria letterhead' },
};

const PDF_DIR = path.join(__dirname, '_pdfs');
const FROM = process.env.MAIL_FROM || 'Lexoria Document Bank <onboarding@resend.dev>';
const REPLY_TO = process.env.MAIL_REPLY_TO || 'info@lexoria.fi';

const COPY = {
  fi: {
    subject: (n) => `Asiakirjasi Lexorian asiakirjapankista (${n})`,
    hi: (name) => `Hei ${name},`,
    lead: 'Kiitos tilauksestasi. Ostamasi asiakirjat ovat tämän viestin liitteinä PDF-muodossa.',
    items: 'Tilatut asiakirjat',
    total: 'Yhteensä',
    vat: 'sis. ALV 25,5 %',
    test: 'Testitilaus · maksua ei veloitettu.',
    help: 'Tarvitsetko räätälöidyn asiakirjan? Vastaa tähän viestiin tai varaa konsultaatio osoitteessa lexoria.fi.',
    sign: 'Asianajotoimisto Lexoria Oy · Helsinki – Tallinna',
  },
  en: {
    subject: (n) => `Your documents from the Lexoria Document Bank (${n})`,
    hi: (name) => `Hello ${name},`,
    lead: 'Thank you for your order. The documents you purchased are attached to this e-mail as PDF files.',
    items: 'Ordered documents',
    total: 'Total',
    vat: 'incl. VAT 25.5%',
    test: 'Test order · no payment was charged.',
    help: 'Need a bespoke document? Reply to this e-mail or book a consultation at lexoria.fi.',
    sign: 'Asianajotoimisto Lexoria Oy · Helsinki – Tallinn',
  },
};

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function buildHtml(lang, name, items, total, orderNo) {
  const c = COPY[lang];
  const rows = items.map((it) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #DDD5C5;font-family:Georgia,'Times New Roman',serif;font-size:16px;color:#0F1419;">${esc(it[lang])}</td>
      <td style="padding:10px 0;border-bottom:1px solid #DDD5C5;font-family:Menlo,Consolas,monospace;font-size:12px;color:#6B6B6B;text-align:right;white-space:nowrap;">${it.price} €</td>
    </tr>`).join('');
  return `<!doctype html><html><body style="margin:0;padding:0;background:#ECE7DD;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECE7DD;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ECE7DD;">
        <tr><td style="padding:0 0 28px;font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#0F1419;">
          LEXORIA <span style="color:#6B6B6B;">· ${lang === 'fi' ? 'Asiakirjapankki' : 'Document Bank'}</span>
        </td></tr>
        <tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.15;color:#0F1419;padding:0 0 18px;">${esc(c.hi(name))}</td></tr>
        <tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.5;color:#0F1419;padding:0 0 28px;">${c.lead}</td></tr>
        <tr><td style="font-family:Menlo,Consolas,monospace;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:#5B21B6;padding:0 0 6px;border-bottom:1px solid #0F1419;">${c.items} · #${orderNo}</td></tr>
        <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}
          <tr>
            <td style="padding:14px 0 0;font-family:Menlo,Consolas,monospace;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:#5B21B6;">${c.total} <span style="color:#6B6B6B;letter-spacing:0.12em;">· ${c.vat}</span></td>
            <td style="padding:14px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#0F1419;text-align:right;">${total} €</td>
          </tr>
        </table></td></tr>
        <tr><td style="padding:28px 0 0;font-family:Menlo,Consolas,monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#6B6B6B;">${c.test}</td></tr>
        <tr><td style="padding:28px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.5;color:#0F1419;">${c.help}</td></tr>
        <tr><td style="padding:36px 0 0;font-family:Menlo,Consolas,monospace;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#6B6B6B;border-top:1px solid #DDD5C5;margin-top:20px;">${c.sign}</td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object') { res.status(400).json({ ok: false, error: 'bad_request' }); return; }

  const name = String(body.name || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().slice(0, 200);
  const lang = body.lang === 'fi' ? 'fi' : 'en';
  const skus = Array.isArray(body.skus) ? [...new Set(body.skus.map(String))] : [];
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const items = skus.filter((s) => CATALOG[s]).map((s) => ({ sku: s, ...CATALOG[s] }));

  if (!name || !emailOk || items.length === 0) {
    res.status(400).json({ ok: false, error: 'invalid_fields' });
    return;
  }

  const total = items.reduce((s, it) => s + it.price, 0);
  const orderNo = 'LX' + Date.now().toString(36).toUpperCase().slice(-6);

  let attachments;
  try {
    attachments = items.map((it) => ({
      filename: `Lexoria-${it.file}`,
      content: fs.readFileSync(path.join(PDF_DIR, it.file)).toString('base64'),
    }));
  } catch (e) {
    res.status(500).json({ ok: false, error: 'files_missing' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(503).json({ ok: false, error: 'mail_not_configured' });
    return;
  }

  const c = COPY[lang];
  const payload = {
    from: FROM,
    to: [email],
    reply_to: REPLY_TO,
    subject: c.subject(orderNo),
    html: buildHtml(lang, name, items, total, orderNo),
    text: `${c.hi(name)}\n\n${c.lead}\n\n${c.items} #${orderNo}:\n${items.map((it) => `- ${it[lang]} · ${it.price} €`).join('\n')}\n${c.total}: ${total} € (${c.vat})\n\n${c.test}\n\n${c.help}\n\n${c.sign}`,
    attachments,
    tags: [{ name: 'source', value: 'document-bank' }, { name: 'mode', value: 'test' }],
  };
  if (process.env.ORDER_NOTIFY_EMAIL) payload.bcc = [process.env.ORDER_NOTIFY_EMAIL];

  let r;
  try {
    r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: 'send_failed' });
    return;
  }
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    console.error('resend error', r.status, detail);
    res.status(502).json({ ok: false, error: 'send_failed' });
    return;
  }
  const data = await r.json().catch(() => ({}));
  res.status(200).json({ ok: true, order: orderNo, id: data.id || null, total, items: items.map((it) => it.sku) });
};
