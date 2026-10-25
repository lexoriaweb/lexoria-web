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
    order: 'Tilaus',
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
    order: 'Order',
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
    order: 'Tellimus',
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
  const serif = "font-family:Georgia,'Times New Roman',serif;";
  const mono = "font-family:Menlo,Consolas,monospace;";
  const rows = items.map((it) => `
          <tr>
            <td class="tx" style="padding:9px 0;${serif}font-size:16px;line-height:1.35;color:#0F1419;">${esc(it[lang])}</td>
            <td class="tx" style="padding:9px 0 9px 16px;${serif}font-size:16px;color:#0F1419;text-align:right;white-space:nowrap;">${it.price} €</td>
          </tr>`).join('');
  return `<!doctype html><html lang="${lang}"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    /* Clients that honour dark mode get an intentional dark version instead of an inverted light one */
    @media (prefers-color-scheme: dark) {
      .bg, .bg td.bg { background-color: #0F1419 !important; }
      .card { background-color: #1A1F26 !important; }
      .tx { color: #ECE7DD !important; }
      .mu { color: #A39F96 !important; }
      .rule { border-top-color: #2E343C !important; }
      a.tx { color: #ECE7DD !important; }
      a.mu { color: #A39F96 !important; }
      .logo-light { display: none !important; }
      .logo-dark { display: block !important; max-height: none !important; }
    }
    [data-ogsc] .logo-light { display: none !important; }
    [data-ogsc] .logo-dark { display: block !important; max-height: none !important; }
    [data-ogsc] .bg, [data-ogsb] .bg { background-color: #0F1419 !important; }
    [data-ogsc] .card, [data-ogsb] .card { background-color: #1A1F26 !important; }
    [data-ogsc] .tx { color: #ECE7DD !important; }
    [data-ogsc] .mu { color: #A39F96 !important; }
    [data-ogsc] .rule { border-top-color: #2E343C !important; }
  </style>
  </head><body class="bg" style="margin:0;padding:0;background:#FFFFFF;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="background:#FFFFFF;padding:40px 16px 48px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">
        <tr><td style="padding:0 0 36px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;"><img class="logo-light" src="${SHOP_URL}/lexoria-logo-chip.png" width="150" height="58" alt="Lexoria" style="display:block;width:150px;height:auto;border:0;margin-left:-24px;border-radius:4px;"><!--[if !mso]><!--><img class="logo-dark" src="${SHOP_URL}/lexoria-logo-white.png" width="104" height="25" alt="" style="display:none;width:104px;max-height:0;height:auto;overflow:hidden;border:0;mso-hide:all;"><!--<![endif]--></td>
            <td class="mu" style="vertical-align:middle;text-align:right;${mono}font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#6B6B6B;">${esc(c.order)} ${orderNo}</td>
          </tr></table>
        </td></tr>
        <tr><td class="tx" style="${serif}font-size:26px;line-height:1.2;color:#0F1419;padding:0 0 14px;">${esc(c.hi(name))}</td></tr>
        <tr><td class="tx" style="${serif}font-size:16px;line-height:1.55;color:#0F1419;padding:0 0 28px;">${c.lead}</td></tr>
        <tr><td class="card" style="background:#F4F4F1;padding:22px 24px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td colspan="2" class="mu" style="padding:0 0 6px;${mono}font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#6B6B6B;">${c.items}</td></tr>
            ${rows}
            <tr>
              <td class="mu rule" style="padding:16px 0 0;border-top:1px solid #DDD5C5;${mono}font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#6B6B6B;">${c.total}<br><span style="letter-spacing:0.1em;">${c.vat}</span></td>
              <td class="tx rule" style="padding:14px 0 0 16px;border-top:1px solid #DDD5C5;${serif}font-size:26px;color:#0F1419;text-align:right;white-space:nowrap;">${total} €</td>
            </tr>
            <tr><td colspan="2" class="mu" style="padding:18px 0 0;${mono}font-size:10px;letter-spacing:0.08em;line-height:1.6;color:#6B6B6B;">${esc(statusLine)}</td></tr>
          </table>
        </td></tr>
        <tr><td class="tx" style="padding:28px 0 0;${serif}font-size:15px;line-height:1.55;color:#0F1419;">${c.help.replace('lexoria.fi', '<a href="https://www.lexoria.fi" class="tx" style="color:#0F1419;">lexoria.fi</a>')}</td></tr>
        <tr><td class="mu" style="padding:18px 0 0;${serif}font-size:13px;line-height:1.5;color:#6B6B6B;">${c.consent} <a href="${TERMS_URL}" class="mu" style="color:#6B6B6B;">${c.terms}</a></td></tr>
        <tr><td class="mu" style="padding:40px 0 0;${mono}font-size:10px;letter-spacing:0.06em;line-height:1.9;color:#6B6B6B;">
          <span class="tx" style="color:#0F1419;">Asianajotoimisto Lexoria Oy</span><br>
          <a href="https://maps.google.com/?q=Vekarakatu+14,+13500+H%C3%A4meenlinna" class="mu" style="color:#6B6B6B;text-decoration:none;">Vekarakatu 14, 13500 Hämeenlinna</a><br>
          <a href="tel:+358456560060" class="mu" style="color:#6B6B6B;text-decoration:none;">+358 (0)45 656 0060</a><br>
          <a href="https://www.lexoria.fi" class="mu" style="color:#6B6B6B;text-decoration:none;">www.lexoria.fi</a><br>
          Y-tunnus 3561005-2
        </td></tr>
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
