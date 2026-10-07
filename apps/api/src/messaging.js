// WhatsApp messaging. Default provider is a MOCK that only records messages (dev/tests).
// Set WHATSAPP_TOKEN + WHATSAPP_PHONE_ID to send through Meta's WhatsApp Cloud API.
// NOTE: WhatsApp only lets a business start a conversation with an APPROVED TEMPLATE message; free text is allowed only
// inside 24 h after the person writes to you. Before launch, register templates for the owner/tenant messages in ai.js.
import crypto from 'node:crypto';

export function mockProvider() {
  const outbox = [];
  return { name: 'mock', outbox, async send({ to, text }) { const id = 'mock-' + (outbox.length + 1); outbox.push({ id, to, text, at: new Date().toISOString() }); return { id }; } };
}

export function whatsappCloudProvider({ token, phoneId, version = 'v20.0' }) {
  return {
    name: 'whatsapp-cloud',
    async send({ to, text }) {
      const r = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: '91' + String(to).slice(-10), type: 'text', text: { body: text } }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`WhatsApp send failed: ${j.error?.message ?? r.status}`);
      return { id: j.messages?.[0]?.id };
    },
  };
}
export const createProvider = (env = process.env) => (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID ? whatsappCloudProvider({ token: env.WHATSAPP_TOKEN, phoneId: env.WHATSAPP_PHONE_ID }) : mockProvider());

/** Meta signs each webhook body: header "x-hub-signature-256: sha256=<hmac of the RAW body with your app secret>". */
export function verifySignature(rawBody, header, secret) {
  if (!secret || !header?.startsWith('sha256=')) return false;
  const want = Buffer.from(crypto.createHmac('sha256', secret).update(rawBody).digest('hex')), got = Buffer.from(header.slice(7));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

/** Pulls text messages out of Meta's webhook payload -> [{ id, from (10 digits), text }] */
export function extractInbound(payload) {
  const out = [];
  for (const e of payload?.entry ?? []) for (const ch of e.changes ?? []) for (const m of ch.value?.messages ?? [])
    if (m.type === 'text' && m.text?.body) out.push({ id: m.id, from: String(m.from).replace(/\D/g, '').slice(-10), text: m.text.body });
  return out;
}
