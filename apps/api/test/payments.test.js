import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { server, _pay, retryRefunds } from '../src/server.js';
import { razorpayPayments } from '../src/payments.js';
import crypto from 'node:crypto';
import { H } from '../test-helpers.mjs';

let base;
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = `http://localhost:${server.address().port}`; });
test.after(() => server.close());
const call = async (m, p, who, body) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...H(...who) }, body: body && JSON.stringify(body) }); return { status: r.status, ...(await r.json()) }; };
const hook = async (obj, sig) => { const raw = JSON.stringify(obj); const r = await fetch(base + '/webhooks/razorpay', { method: 'POST', headers: { 'content-type': 'application/json', 'x-razorpay-signature': sig ?? _pay.signWebhook(raw) }, body: raw }); return r.status; };
const T2 = ['tenant', 't2'], T3 = ['tenant', 't3'], ADMIN = ['admin'];
const soon = () => new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
const book = async (who, room) => (await call('POST', '/bookings', who, { roomId: room, moveInDate: soon(), months: 6 })).booking;

test('Razorpay signature maths matches the documented formula (order_id|payment_id, HMAC-SHA256 with the key secret)', () => {
  const rz = razorpayPayments({ keyId: 'rzp_test_1', keySecret: 'topsecret', webhookSecret: 'whsec' });
  const sig = crypto.createHmac('sha256', 'topsecret').update('order_ABC|pay_XYZ').digest('hex');
  assert.equal(rz.verifyPayment({ orderId: 'order_ABC', paymentId: 'pay_XYZ', signature: sig }), true);
  for (const bad of [{ orderId: 'order_ABD', paymentId: 'pay_XYZ', signature: sig }, { orderId: 'order_ABC', paymentId: 'pay_XYY', signature: sig }, { orderId: 'order_ABC', paymentId: 'pay_XYZ', signature: sig.replace(/.$/, '0') }, { orderId: 'order_ABC', paymentId: 'pay_XYZ', signature: '' }, { orderId: 'order_ABC', paymentId: 'pay_XYZ' }]) assert.equal(rz.verifyPayment(bad), false);
  assert.equal(rz.verifyWebhook('{"a":1}', crypto.createHmac('sha256', 'whsec').update('{"a":1}').digest('hex')), true); assert.equal(rz.verifyWebhook('{"a":2}', crypto.createHmac('sha256', 'whsec').update('{"a":1}').digest('hex')), false);
});
test('secure flow: order for the exact amount → verified signature → booking paid; forged / replayed / foreign confirmations are refused', async () => {
  const b = await book(T2, 'r9');                                                                    // ₹5,500 room
  const s = await call('POST', `/bookings/${b.id}/pay/start`, T2); assert.equal(s.amount, 550000); assert.equal(s.currency, 'INR'); assert.equal(s.provider, 'mock');
  assert.equal((await call('POST', `/bookings/${b.id}/pay/start`, T2)).orderId, s.orderId);        // tapping Pay twice doesn't create a second order
  assert.equal((await call('POST', `/bookings/${b.id}/pay/start`, T3)).status, 403);               // someone else's booking
  const bad = await call('POST', `/bookings/${b.id}/pay/confirm`, T2, { orderId: s.orderId, paymentId: 'pay_1', signature: 'forged' });
  assert.equal(bad.status, 400); assert.equal((await call('GET', `/bookings/${b.id}`, T2)).booking.status, 'REQUESTED');   // nothing happened
  assert.equal((await call('POST', `/bookings/${b.id}/pay/confirm`, T2, { orderId: 'order_other', paymentId: 'pay_1', signature: _pay.sign('order_other', 'pay_1') })).status, 400);   // valid signature, but for a different order
  const sig = _pay.sign(s.orderId, 'pay_1');
  assert.equal((await call('POST', `/bookings/${b.id}/pay/confirm`, T3, { orderId: s.orderId, paymentId: 'pay_1', signature: sig })).status, 403);
  const ok = await call('POST', `/bookings/${b.id}/pay/confirm`, T2, { orderId: s.orderId, paymentId: 'pay_1', signature: sig }); assert.equal(ok.booking.status, 'PENDING'); assert.equal(ok.booking.payment.amount, 5500);
  assert.equal((await call('POST', `/bookings/${b.id}/pay/confirm`, T2, { orderId: s.orderId, paymentId: 'pay_1', signature: sig })).booking.status, 'PENDING');   // a retried confirm is harmless
  assert.equal((await call('GET', '/listings/r9', T3)).status, 404);                               // room is held
  await call('POST', `/bookings/${b.id}/cancel`, T2);
  const c = (await call('GET', `/bookings/${b.id}`, T2)).booking; assert.deepEqual([c.status, c.refund.status, c.refund.amount], ['CANCELLED', 'REFUNDED', 5500]);
  assert.equal(_pay.refunds.at(-1).paymentId, 'pay_1'); assert.equal(_pay.refunds.at(-1).amount, 550000);       // refunded through the gateway, in paise
});
test('webhook finishes a payment the app never confirmed; duplicate and unsigned webhooks do nothing wrong', async () => {
  const b = await book(T3, 'r10'); const s = await call('POST', `/bookings/${b.id}/pay/start`, T3);        // ₹5,000 room; the phone pays, then loses signal
  const ev = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_wh1', order_id: s.orderId, amount: s.amount, method: 'upi' } } } };
  assert.equal(await hook(ev, 'nope'), 401); assert.equal((await call('GET', `/bookings/${b.id}`, T3)).booking.status, 'REQUESTED');
  assert.equal(await hook(ev), 200); assert.equal((await call('GET', `/bookings/${b.id}`, T3)).booking.status, 'PENDING');
  assert.equal(await hook(ev), 200); assert.equal((await call('GET', `/bookings/${b.id}`, T3)).booking.history.filter((h) => h.status === 'PENDING').length, 1);   // not processed twice
  const wrongAmount = { ...ev, payload: { payment: { entity: { id: 'pay_wh2', order_id: s.orderId, amount: 100, method: 'upi' } } } }; assert.equal(await hook(wrongAmount), 200);
  assert.equal((await call('GET', `/bookings/${b.id}`, T3)).booking.payment.id, 'pay_wh1');
  await call('POST', `/bookings/${b.id}/cancel`, T3);
});
test('money that arrives for a booking that is already closed is refunded, not kept', async () => {
  const b = await book(T2, 'r7'); const s = await call('POST', `/bookings/${b.id}/pay/start`, T2); await call('POST', `/bookings/${b.id}/cancel`, T2);   // cancelled while the payment was in flight
  const before = _pay.refunds.length;
  await hook({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_late', order_id: s.orderId, amount: s.amount, method: 'card' } } } });
  assert.equal(_pay.refunds.length, before + 1); assert.equal(_pay.refunds.at(-1).paymentId, 'pay_late');
  assert.equal((await call('GET', `/bookings/${b.id}`, T2)).booking.refund.status, 'REFUNDED');
});
test('a refund the gateway rejects is kept, flagged to admin, and retried later', async () => {
  const b = await book(T3, 'r9'); const s = await call('POST', `/bookings/${b.id}/pay/start`, T3); await call('POST', `/bookings/${b.id}/pay/confirm`, T3, { orderId: s.orderId, paymentId: 'pay_rf', signature: _pay.sign(s.orderId, 'pay_rf') });
  const real = _pay.refund; _pay.refund = async () => { throw new Error('gateway down'); };
  const c = (await call('POST', `/bookings/${b.id}/cancel`, T3)).booking; assert.equal(c.status, 'CANCELLED'); assert.equal(c.refund.status, 'RETRY');   // the cancel still succeeds
  assert.ok((await call('GET', '/notifications', ADMIN)).rows.some((n) => n.title === 'Refund needs attention'));
  _pay.refund = real; assert.equal(await retryRefunds(), 1); assert.equal((await call('GET', `/bookings/${b.id}`, T3)).booking.refund.status, 'REFUNDED'); assert.equal(await retryRefunds(), 0);
});
const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/server.js');
test('with a real gateway configured, the free one-step /pay is gone and a gateway outage never marks anything paid', async () => {
  const env = { PATH: process.env.PATH, NODE_ENV: 'development', PORT: '0', PAYMENT_PROVIDER: 'razorpay', RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: 's', RAZORPAY_WEBHOOK_SECRET: 'w' };
  const s = await new Promise((resolve) => { const p = spawn(process.execPath, ['--no-warnings', SERVER], { env }); let out = ''; p.stdout.on('data', (d) => { out += d; const m = /API on :(\d+)/.exec(out); if (m) resolve({ p, base: `http://localhost:${m[1]}` }); }); setTimeout(() => { p.kill('SIGKILL'); resolve({ p, out }); }, 8000).unref(); });
  assert.ok(s.base, s.out);
  const c = async (m, p, who, body) => { const r = await fetch(s.base + p, { method: m, headers: { 'content-type': 'application/json', ...H(...who) }, body: body && JSON.stringify(body) }); return { status: r.status, ...(await r.json()) }; };
  const b = (await c('POST', '/bookings', T2, { roomId: 'r9', moveInDate: soon(), months: 6 })).booking;
  const direct = await c('POST', `/bookings/${b.id}/pay`, T2, {}); assert.equal(direct.status, 403); assert.match(direct.error, /secure payment flow/);
  const start = await c('POST', `/bookings/${b.id}/pay/start`, T2); assert.equal(start.status, 502); assert.equal(JSON.stringify(start).includes('rzp_'), false);   // no network to Razorpay here: safe, generic error
  assert.equal((await c('GET', `/bookings/${b.id}`, T2)).booking.status, 'REQUESTED');
  assert.equal((await c('GET', '/admin/settings', ADMIN)).system.payments, 'razorpay');
  s.p.kill('SIGKILL');
});
