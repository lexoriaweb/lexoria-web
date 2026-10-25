// Shared by checkout (creates the Montonio order), montonio-return and montonio-notify
// (both verify the payment and e-mail the PDFs). The whole order lives in a signed token
// that travels through Montonio's return and notification URLs, so no database is needed.
const fs = require('fs');
const path = require('path');
const { sign, verify } = require('./jwt');

const CATALOG = {
  'will-fi': { price: 29, file: 'testamentti-perusmalli-fi.pdf', fi: 'Testamentti · suomeksi', en: 'Will · in Finnish', et: 'Testament · soome keeles' },
  'will-en': { price: 29, file: 'testamentti-perusmalli-en.pdf', fi: 'Testamentti · englanniksi', en: 'Will · in English', et: 'Testament · inglise keeles' },
  'will-et': { price: 29, file: 'testamentti-perusmalli-et.pdf', fi: 'Testamentti · viroksi', en: 'Will · in Estonian', et: 'Testament · eesti keeles' },
};
const LANGS = ['fi', 'en', 'et'];

const PDF_DIR = path.join(__dirname, '..', '_pdfs');
const FROM = process.env.MAIL_FROM || 'Lexoria Document Bank <onboarding@resend.dev>';
const REPLY_TO = process.env.MAIL_REPLY_TO || 'info@lexoria.fi';
const SHOP_URL = (process.env.SHOP_URL || 'https://lexoriashop.vercel.app').replace(/\/$/, '');
const TERMS_URL = SHOP_URL + '/#terms';

const MONTONIO = {
  sandbox: process.env.MONTONIO_ENV !== 'live',
  accessKey: process.env.MONTONIO_ACCESS_KEY || '',
  secretKey: process.env.MONTONIO_SECRET_KEY || '',
};
MONTONIO.api = MONTONIO.sandbox ? 'https://sandbox-stargate.montonio.com/api' : 'https://stargate.montonio.com/api';
// Our own order token is signed with a separate secret when one is set
const ORDER_SECRET = process.env.ORDER_SECRET || MONTONIO.secretKey;

const COPY = {
  fi: {
    subject: (n) => `Asiakirjasi Lexorian asiakirjapankista (${n})`,
    hi: (name) => `Hei ${name},`,
    lead: 'Kiitos tilauksestasi. Ostamasi asiakirjat ovat tämän viestin liitteinä PDF-muodossa.',
    items: 'Tilatut asiakirjat',
    total: 'Yhteensä',
    vat: 'sis. ALV 25,5 %',
    paid: 'Maksettu Montonion kautta',
    test: 'Testitilaus · Montonion testiympäristö, rahaa ei veloitettu.',
    consent: 'Hyväksyit tilaus- ja toimitusehdot ja pyysit välitöntä toimitusta, joten 14 päivän peruuttamisoikeus päättyi, kun tiedostot lähetettiin.',
    terms: 'Tilaus- ja toimitusehdot',
    help: 'Tarvitsetko räätälöidyn asiakirjan? Vastaa tähän viestiin tai varaa konsultaatio osoitteessa lexoria.fi.',
    sign: 'Asianajotoimisto Lexoria Oy · Hämeenlinna',
  },
  en: {
    subject: (n) => `Your documents from the Lexoria Document Bank (${n})`,
    hi: (name) => `Hello ${name},`,
    lead: 'Thank you for your order. The documents you purchased are attached to this e-mail as PDF files.',
    items: 'Ordered documents',
    total: 'Total',
    vat: 'incl. VAT 25.5%',
    paid: 'Paid via Montonio',
    test: 'Test order · Montonio sandbox, no money was charged.',
    consent: 'You accepted the terms of sale and asked for immediate delivery, so the 14-day right of withdrawal ended when these files were sent.',
    terms: 'Terms of sale',
    help: 'Need a bespoke document? Reply to this e-mail or book a consultation at lexoria.fi.',
    sign: 'Asianajotoimisto Lexoria Oy · Hämeenlinna',
  },
  et: {
    subject: (n) => `Sinu dokumendid Lexoria dokumendipangast (${n})`,
    hi: (name) => `Tere, ${name}!`,
    lead: 'Täname tellimuse eest. Ostetud dokumendid on selle kirja manuses PDF-vormingus.',
    items: 'Tellitud dokumendid',
    total: 'Kokku',
    vat: 'sis. KM 25,5%',
    paid: 'Makstud Montonio kaudu',
    test: 'Testtellimus · Montonio testkeskkond, raha ei võetud.',
    consent: 'Nõustusid müügitingimustega ja palusid kohest tarnet, mistõttu 14-päevane taganemisõigus lõppes failide saatmisega.',
    terms: 'Müügitingimused',
    help: 'Vajad just sulle koostatud dokumenti? Vasta sellele kirjale või broneeri konsultatsioon aadressil lexoria.fi.',
    sign: 'Asianajotoimisto Lexoria Oy · Hämeenlinna',
  },
};
const SHOP_NAME = { fi: 'Asiakirjapankki', en: 'Document Bank', et: 'Dokumendipank' };

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function itemsOf(skus) {
  return [...new Set((skus || []).map(String))].filter((s) => CATALOG[s]).map((s) => ({ sku: s, ...CATALOG[s] }));
}
function totalOf(items) {
  return items.reduce((s, it) => s + it.price, 0);
}

function buildHtml(lang, name, items, total, orderNo, statusLine) {
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
          LEXORIA <span style="color:#6B6B6B;">· ${SHOP_NAME[lang]}</span>
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
        <tr><td style="padding:28px 0 0;font-family:Menlo,Consolas,monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#6B6B6B;">${esc(statusLine)}</td></tr>
        <tr><td style="padding:28px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.5;color:#0F1419;">${c.help}</td></tr>
        <tr><td style="padding:20px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.5;color:#6B6B6B;">${c.consent} <a href="${TERMS_URL}" style="color:#5B21B6;">${c.terms}</a></td></tr>
        <tr><td style="padding:36px 0 0;font-family:Menlo,Consolas,monospace;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#6B6B6B;border-top:1px solid #DDD5C5;margin-top:20px;">${c.sign}</td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

// E-mails the PDFs once per order: Resend's Idempotency-Key makes the return handler and the
// webhook safe to both call this. Throws with a short error code on failure.
async function sendOrderEmail(order, payment) {
  const { orderNo, name, email, lang } = order;
  const items = itemsOf(order.skus);
  const total = totalOf(items);
  const c = COPY[lang];
  const statusLine = MONTONIO.sandbox ? c.test : `${c.paid}${payment && payment.method ? ' · ' + payment.method : ''}`;

  const attachments = items.map((it) => ({
    filename: `Lexoria-${it.file}`,
    content: fs.readFileSync(path.join(PDF_DIR, it.file)).toString('base64'),
  }));

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('mail_not_configured');

  const payload = {
    from: FROM,
    to: [email],
    reply_to: REPLY_TO,
    subject: c.subject(orderNo),
    html: buildHtml(lang, name, items, total, orderNo, statusLine),
    text: `${c.hi(name)}\n\n${c.lead}\n\n${c.items} #${orderNo}:\n${items.map((it) => `- ${it[lang]} · ${it.price} €`).join('\n')}\n${c.total}: ${total} € (${c.vat})\n\n${statusLine}\n\n${c.help}\n\n${c.consent}\n${c.terms}: ${TERMS_URL}\n\n${c.sign}`,
    attachments,
    tags: [{ name: 'source', value: 'document-bank' }, { name: 'mode', value: MONTONIO.sandbox ? 'sandbox' : 'live' }],
  };
  if (process.env.ORDER_NOTIFY_EMAIL) payload.bcc = [process.env.ORDER_NOTIFY_EMAIL];

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `order/${orderNo}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    console.error('resend error', r.status, detail);
    if (r.status === 403 && /own email address/i.test(detail)) throw new Error('test_recipient');
    throw new Error('send_failed');
  }
  return r.json().catch(() => ({}));
}

// ---- our order token (name, e-mail, language, skus, where to send the buyer back) ----
function signOrder(order) {
  return sign({ ...order, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 3 }, ORDER_SECRET);
}
function readOrder(token) {
  const o = verify(token, ORDER_SECRET);
  if (!o || !o.orderNo || !o.email || !COPY[o.lang] || itemsOf(o.skus).length === 0) return null;
  return o;
}

// ---- Montonio order token (return URL `order-token` / webhook `orderToken`) ----
// Returns the decoded token when it is genuine and belongs to this order, otherwise null.
function readMontonioToken(token, order) {
  const t = verify(token, MONTONIO.secretKey);
  if (!t) return null;
  if (t.accessKey !== MONTONIO.accessKey) return null;
  if (t.merchantReference !== order.orderNo) return null;
  return t;
}

module.exports = { CATALOG, LANGS, COPY, MONTONIO, SHOP_URL, itemsOf, totalOf, sendOrderEmail, signOrder, readOrder, readMontonioToken };
