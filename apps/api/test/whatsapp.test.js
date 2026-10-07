import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { H } from '../test-helpers.mjs';

process.env.WHATSAPP_APP_SECRET = 'test-app-secret'; process.env.WHATSAPP_VERIFY_TOKEN = 'verify-me';
const { server, _ai, _provider } = await import('../src/server.js');
let base;
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = `http://localhost:${server.address().port}`; });
test.after(() => server.close());

const call = async (m, p, who, body) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...H(...who) }, body: body && JSON.stringify(body) }); return { status: r.status, ...(await r.json()) }; };
const T = { r1: ['tenant', 't1'], r2: ['tenant', 't2'], r5: ['tenant', 't3'] }, O = { r1: ['owner', 'o1'], r2: ['owner', 'o2'], r5: ['owner', 'o3'] };
const PH = { t1: '9876543210', o1: '9425011111', t2: '9876432109', o2: '9826012345', t3: '9765432109', o3: '9893098930' }, ADMIN = ['admin'];
const SECRET = 'test-app-secret';
const wa = (from, text, id = crypto.randomUUID(), { secret = SECRET, sig } = {}) => {
  const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from: '91' + from, id, type: 'text', text: { body: text } }] } }] }] });
  return fetch(base + '/webhooks/whatsapp', { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig ?? 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex') }, body }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
};
const sent = (to) => _provider.outbox.filter((m) => m.to === to).map((m) => m.text);
const today = () => { const d = new Date(); return `${d.getDate()} ${['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][d.getMonth()]}`; };
const tick = () => new Promise((r) => setTimeout(r, 20));      // provider sends are async
const startCheckout = async (room) => { await call('POST', `/checkout/${room}/start`, T[room]); await call('POST', `/checkout/${room}/scan`, T[room], { qr: room }); await tick(); };
const state = async (room) => (await call('GET', `/admin/checkouts`, ADMIN)).rows.find((r) => r.id === room)?.status;
const roomStatus = async (room) => (await call('GET', '/admin/rooms', ADMIN)).rows.find((r) => r.id === room).status;

test('webhook security: handshake, bad/missing signature rejected', async () => {
  assert.equal((await fetch(base + '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345')).status, 200);
  assert.equal(await (await fetch(base + '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345')).text(), '12345');
  assert.equal((await fetch(base + '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1')).status, 403);
  assert.equal((await wa(PH.o1, 'yes', undefined, { secret: 'attacker-secret' })).status, 401);
  assert.equal((await wa(PH.o1, 'yes', undefined, { sig: 'sha256=' })).status, 401);
  assert.equal((await fetch(base + '/webhooks/whatsapp', { method: 'POST', body: '{}' })).status, 401);
});

test('happy path on WhatsApp: tenant sends the date, owner says YES → vacant, cashback ready, 7-day clock', async () => {
  await startCheckout('r1');
  assert.ok(sent(PH.t1).some((t) => /move-out date/.test(t)));                                   // AI contacts the tenant
  assert.equal((await wa(PH.t1, 'yes')).handled, 1);                                              // a bare YES has no date → asks again
  assert.ok(sent(PH.t1).some((t) => /didn't catch/.test(t)));
  await wa(PH.t1, today()); await tick();
  assert.ok(sent(PH.o1).some((t) => /Reply YES to confirm/.test(t)));                             // AI contacts the owner
  assert.equal(await state('r1'), 'AWAITING_PARTIES'); assert.equal(await roomStatus('r1'), 'CHECKOUT_REQUESTED');   // still NOT vacant: dual confirmation pending
  assert.equal((await wa(PH.o1, 'YES', 'dup-1')).handled, 1); await tick();
  assert.equal((await wa(PH.o1, 'YES', 'dup-1')).handled, 1);                                     // provider retry of the same message: no double effect
  assert.equal(await state('r1'), 'VERIFIED'); assert.equal(await roomStatus('r1'), 'VACANT');
  const w = await call('GET', '/wallet', T.r1); assert.equal(w.available, 2550);                   // cashback eligible only now
  assert.ok(sent(PH.o1).some((t) => /marked vacant/.test(t) && !/compensat/i.test(t)));           // wording: no "compensation"
  assert.ok(sent(PH.t1).some((t) => /verified/.test(t)));
  assert.equal(Object.values((await call('GET', '/admin/conversations', ADMIN)).rows).filter((c) => c.room === 'Room 101' && c.status !== 'DONE').length, 0);
});

test('WhatsApp cannot skip the QR scan; strangers are ignored', async () => {
  await call('POST', '/properties/p2/qr', ADMIN);
  await call('POST', '/checkout/r2/start', T.r2);                                                  // started but QR NOT scanned
  assert.equal(_provider.outbox.filter((m) => m.to === PH.t2).length, 0);                          // no conversation until the scan
  assert.equal((await wa('9000099999', today())).handled, 1);                                      // unknown number: accepted by the webhook, ignored by the AI
  assert.equal(await state('r2'), 'INITIATED');
});

test('unclear owner replies → clarification twice → hand-over to a person → admin approves', async () => {
  await call('POST', '/checkout/r2/scan', T.r2, { qr: 'r2' }); await tick();
  await wa(PH.t2, today()); await tick();
  await wa(PH.o2, 'hmm who is this?'); await wa(PH.o2, 'maybe later'); 
  assert.equal(sent(PH.o2).filter((t) => /didn't catch/.test(t)).length, 2); assert.equal(await state('r2'), 'AWAITING_PARTIES');
  await wa(PH.o2, '???'); await tick();
  assert.equal(await state('r2'), 'MANUAL_REVIEW'); assert.equal(await roomStatus('r2'), 'VERIFICATION_PENDING');
  assert.ok((await call('GET', '/notifications', ADMIN)).rows.some((n) => n.title === 'Checkout needs review'));
  assert.equal((await call('POST', '/checkout/r2/resolve', T.r2, { approve: true })).status, 403);   // tenants can't resolve their own checkout
  assert.equal((await call('POST', '/checkout/r2/resolve', ADMIN, { approve: false })).status, 422); // rejecting needs a reason
  const ok = await call('POST', '/checkout/r2/resolve', ADMIN, { approve: true, note: 'owner confirmed by phone' });
  assert.equal(ok.checkout.state, 'VERIFIED'); assert.equal(ok.roomStatus, 'VACANT');
  assert.equal((await call('POST', '/checkout/r2/resolve', ADMIN, { approve: true })).status, 400);  // already finished
});

test('owner says NO → dispute; silence → reminder at 6 h, hand-over at 48 h; admin can reject', async () => {
  await call('POST', '/properties/p3/qr', ADMIN); await startCheckout('r5'); await wa(PH.t3, today()); await tick();
  const reply = await wa(PH.o3, 'nahi'); assert.equal(reply.handled, 1);
  assert.equal(await state('r5'), 'DISPUTED'); assert.equal(await roomStatus('r5'), 'VERIFICATION_PENDING');
  assert.equal((await call('POST', '/checkout/r5/resolve', ADMIN, { approve: false, note: 'owner says tenant still lives there' })).checkout.state, 'REJECTED');
  assert.equal(await roomStatus('r5'), 'OCCUPIED');                                                // tenant stays; nothing vacated, no cashback
  assert.equal((await call('GET', '/wallet', T.r5)).available, 0);
});

test('timers: reminder after 6 h, escalation after 48 h of silence', async () => {
  // r5 is occupied again; run a fresh checkout and let the owner stay silent
  await call('POST', '/checkout/r5/start', T.r5); await call('POST', '/checkout/r5/scan', T.r5, { qr: 'r5' });
  await call('POST', '/checkout/r5/tenant-confirm', T.r5, { checkoutDate: new Date().toISOString().slice(0, 10) }); await tick();
  const ai = _ai(); const before = sent(PH.o3).length;
  assert.deepEqual(ai.sweep(new Date(Date.now() + 1 * 3600e3)), { reminded: 0, escalated: 0 });
  assert.deepEqual(ai.sweep(new Date(Date.now() + 7 * 3600e3)), { reminded: 1, escalated: 0 }); await tick();
  assert.equal(sent(PH.o3).length, before + 1); assert.ok(sent(PH.o3).at(-1).startsWith('Reminder'));
  assert.deepEqual(ai.sweep(new Date(Date.now() + 8 * 3600e3)), { reminded: 0, escalated: 0 });  // only one reminder
  assert.deepEqual(ai.sweep(new Date(Date.now() + 49 * 3600e3)), { reminded: 0, escalated: 1 });
  assert.equal(await state('r5'), 'MANUAL_REVIEW');
});
