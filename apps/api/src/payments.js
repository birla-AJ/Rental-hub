// Payments: Razorpay (production) or a mock that behaves the same way (development / tests).
// The money flow is always: server creates an ORDER for the exact amount → the phone pays it → the server only believes the
// payment after checking the gateway's SIGNATURE (or its signed webhook). The app saying "I paid" is never enough.
import crypto from 'node:crypto';

const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export function mockPayments() {
  const secret = 'mock-key-secret', whSecret = 'mock-webhook-secret'; let n = 0; const refunds = [];
  return {
    name: 'mock', keyId: 'mock', simulate: true, refunds,
    async createOrder({ amount }) { return { id: 'order_mock_' + ++n, amount, currency: 'INR' }; },
    sign: (orderId, paymentId) => hmac(secret, `${orderId}|${paymentId}`),
    verifyPayment: ({ orderId, paymentId, signature }) => same(hmac(secret, `${orderId}|${paymentId}`), signature ?? ''),
    async refund({ paymentId, amount }) { const r = { id: 'rfnd_mock_' + ++n, paymentId, amount, status: 'processed' }; refunds.push(r); return r; },
    signWebhook: (raw) => hmac(whSecret, raw), verifyWebhook: (raw, sig) => same(hmac(whSecret, raw), sig ?? ''),
  };
}

export function razorpayPayments({ keyId, keySecret, webhookSecret }) {
  const auth = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const call = async (path, body) => {
    const r = await fetch('https://api.razorpay.com/v1' + path, { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`Razorpay: ${j.error?.description ?? r.status}`); return j;
  };
  return {
    name: 'razorpay', keyId, simulate: false,
    async createOrder({ amount, receipt, notes }) { const o = await call('/orders', { amount, currency: 'INR', receipt, notes }); return { id: o.id, amount: o.amount, currency: o.currency }; },
    verifyPayment: ({ orderId, paymentId, signature }) => same(hmac(keySecret, `${orderId}|${paymentId}`), signature ?? ''),   // Razorpay's documented checkout signature
    async refund({ paymentId, amount }) { const r = await call(`/payments/${paymentId}/refund`, { amount, speed: 'normal' }); return { id: r.id, paymentId, amount, status: r.status }; },
    verifyWebhook: (raw, sig) => same(hmac(webhookSecret, raw), sig ?? ''),
  };
}

export function createPayments(env = process.env) {
  if (env.PAYMENT_PROVIDER === 'razorpay') {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET || !env.RAZORPAY_WEBHOOK_SECRET) throw new Error('PAYMENT_PROVIDER=razorpay needs RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET');
    return razorpayPayments({ keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET, webhookSecret: env.RAZORPAY_WEBHOOK_SECRET });
  }
  if (env.NODE_ENV === 'production') throw new Error('Set PAYMENT_PROVIDER=razorpay (with its keys) — without it bookings could not be paid for safely');
  return mockPayments();
}
