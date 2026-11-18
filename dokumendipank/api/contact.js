// Contact form of the main site. The main site proxies /api/contact here because this
// project already holds the Resend key and the verified sender.
const FROM = process.env.MAIL_FROM || 'Lexoria <onboarding@resend.dev>';
const TO = process.env.CONTACT_EMAIL || 'liisa@lexoria.fi';

const line = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method_not_allowed' }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object') { res.status(400).json({ ok: false, error: 'bad_request' }); return; }

  // Hidden field no person fills in; bots get a normal-looking answer and nothing is sent
  if (body.website) { res.status(200).json({ ok: true }); return; }

  const name = line(body.name, 120);
  const email = line(body.email, 200);
  const tel = line(body.tel, 40);
  const message = String(body.message || '').trim().slice(0, 5000);
  const lang = line(body.lang, 2);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { res.status(400).json({ ok: false, error: 'invalid_fields' }); return; }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { res.status(503).json({ ok: false, error: 'mail_not_configured' }); return; }

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      reply_to: email,
      subject: `Yhteydenotto lexoria.fi · ${name}`,
      text: `Nimi: ${name}\nSähköposti: ${email}\nPuhelin: ${tel || '-'}\nKieli: ${lang || '-'}\n\n${message || '(ei viestiä)'}`,
      tags: [{ name: 'source', value: 'contact-form' }],
    }),
  });
  if (!r.ok) {
    console.error('contact resend error', r.status, await r.text().catch(() => ''));
    res.status(502).json({ ok: false, error: 'send_failed' });
    return;
  }
  res.status(200).json({ ok: true });
};
