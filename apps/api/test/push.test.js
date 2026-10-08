import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { server, _push } from '../src/server.js';
import { fcmPush, serviceAccountAssertion, createPush } from '../src/push.js';
import { H } from '../test-helpers.mjs';

let base;
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = `http://localhost:${server.address().port}`; });
test.after(() => server.close());
const call = async (m, p, who, body) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...H(...who) }, body: body && JSON.stringify(body) }); return { status: r.status, ...(await r.json()) }; };
const tick = () => new Promise((r) => setTimeout(r, 30));
const T1 = ['tenant', 't1'], T2 = ['tenant', 't2'], O1 = ['owner', 'o1'];
const TOK = (n) => 'fcm-device-token-' + n.repeat(10);

test('devices: register, validate, move to the latest user, remove; max 5 per person', async () => {
  assert.equal((await call('POST', '/devices', T1, { token: 'short', platform: 'android' })).status, 422);
  assert.equal((await call('POST', '/devices', T1, { token: TOK('a'), platform: 'windows' })).status, 422);
  assert.equal((await call('POST', '/devices', T1, { token: TOK('a'), platform: 'android' })).status, 200);
  await call('POST', '/devices', T2, { token: TOK('a'), platform: 'android' });                              // same phone, someone else logs in: it follows them
  _push.outbox.length = 0; await call('POST', '/saved/r6', T2); /* no push for saves */
  await call('POST', '/profile', T1, { name: 'Rahul Verma' });
  assert.equal(_push.outbox.length, 0);
  for (const n of 'bcdefg') await call('POST', '/devices', T1, { token: TOK(n), platform: 'ios' });         // 6 more → oldest dropped (limit 5)
  await call('POST', '/devices/remove', T1, { token: TOK('g'), platform: 'ios' });
});
test('a notification reaches the phones of THAT person only; the in-app copy is still created', async () => {
  await call('POST', '/devices', O1, { token: TOK('o'), platform: 'android' }); _push.outbox.length = 0;
  // t1 starts a checkout and confirms: the OWNER gets "Checkout request"
  await call('POST', '/checkout/r1/start', T1); await call('POST', '/checkout/r1/scan', T1, { qr: 'r1' }); await call('POST', '/checkout/r1/tenant-confirm', T1, { checkoutDate: new Date().toISOString().slice(0, 10) }); await tick();
  const sent = _push.outbox.filter((m) => m.title === 'Checkout request');
  assert.equal(sent.length, 1); assert.equal(sent[0].token, TOK('o')); assert.equal(sent[0].data.type, 'CHECKOUT');
  assert.ok(!_push.outbox.some((m) => m.token === TOK('o') && m.title === 'Cashback ready to use'));            // nothing meant for the tenant
  assert.ok((await call('GET', '/notifications', O1)).rows.some((n) => n.title === 'Checkout request'));
  await call('POST', '/devices/remove', O1, { token: TOK('o') }); _push.outbox.length = 0;
  await call('POST', '/checkout/r1/owner-respond', O1, { confirmed: true, checkoutDate: new Date().toISOString().slice(0, 10) }); await tick();
  assert.equal(_push.outbox.filter((m) => m.token === TOK('o')).length, 0);                                    // removed phone gets nothing
  // t1's phones: 'a' moved to t2, 'b' fell off the 5-phone limit, 'g' was removed → exactly c, d, e, f
  const tokens = [...new Set(_push.outbox.filter((m) => m.title === 'Cashback ready to use').map((m) => m.token))].sort();
  assert.deepEqual(tokens, [TOK('c'), TOK('d'), TOK('e'), TOK('f')]);
});
test('a push failure never breaks the action; a dead token is forgotten', async () => {
  const day = () => new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10), real = _push.send;
  await call('POST', '/devices', T2, { token: TOK('z'), platform: 'android' });
  const book = async (room) => { const b = (await call('POST', '/bookings', T2, { roomId: room, moveInDate: day(), months: 6 })).booking; return { b, paid: await call('POST', `/bookings/${b.id}/pay`, T2, {}) }; };
  _push.send = async () => { throw new Error('FCM down'); };
  const one = await book('r9'); assert.equal(one.paid.status, 200); assert.equal(one.paid.booking.status, 'PENDING');          // the push failed; the booking still went through
  await call('POST', `/bookings/${one.b.id}/cancel`, T2);
  _push.send = async () => ({ ok: false, invalid: true });                                                                 // the gateway says these tokens are dead
  const two = await book('r10'); await tick(); await call('POST', `/bookings/${two.b.id}/cancel`, T2);
  _push.send = real; _push.outbox.length = 0;
  const three = await book('r9'); await tick();
  assert.equal(three.paid.status, 200); assert.equal(_push.outbox.filter((m) => m.title === 'Booking received').length, 0);   // dead tokens were forgotten: nobody to send to
  assert.ok((await call('GET', '/notifications', T2)).rows.filter((n) => n.title === 'Booking received').length >= 3);        // the in-app copies are unaffected
  await call('POST', `/bookings/${three.b.id}/cancel`, T2);
});

// ---------- the real FCM sender, with a fake network ----------
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const SA = { project_id: 'rentalhub-test', client_email: 'push@rentalhub-test.iam.gserviceaccount.com', private_key: privateKey };
const resp = (status, json) => ({ status, ok: status < 300, json: async () => json });

test('FCM auth: the signed assertion verifies with the public key and carries the right claims', () => {
  const [h, c, sig] = serviceAccountAssertion(SA, 1_800_000_000).split('.');
  assert.ok(crypto.createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, sig, 'base64url'));
  const claims = JSON.parse(Buffer.from(c, 'base64url')); assert.equal(claims.iss, SA.client_email); assert.equal(claims.scope, 'https://www.googleapis.com/auth/firebase.messaging'); assert.equal(claims.aud, 'https://oauth2.googleapis.com/token'); assert.equal(claims.exp - claims.iat, 3600);
  assert.equal(JSON.parse(Buffer.from(h, 'base64url')).alg, 'RS256');
});
test('FCM send: builds the right request, reuses the access token, retries once on 401, forgets dead tokens, surfaces real errors', async () => {
  const calls = []; let sendStatus = [200];
  const fetchFn = async (url, opts) => { calls.push({ url, opts });
    if (url.includes('oauth2')) return resp(200, { access_token: 'ya29.token' + calls.length, expires_in: 3600 });
    const st = sendStatus.shift() ?? 200; return st === 404 ? resp(404, { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }) : st === 500 ? resp(500, { error: { message: 'boom' } }) : resp(st, {}); };
  const f = fcmPush({ serviceAccount: SA, fetchFn, now: () => 1_800_000_000_000 });
  assert.deepEqual(await f.send({ token: 'tok1', title: 'Hi', body: 'There', data: { type: 'BOOKING', n: 5 } }), { ok: true });
  const send = calls.find((c) => c.url.includes('messages:send')); assert.equal(send.url, 'https://fcm.googleapis.com/v1/projects/rentalhub-test/messages:send');
  const msg = JSON.parse(send.opts.body).message; assert.deepEqual([msg.token, msg.notification.title, msg.data.type, msg.data.n], ['tok1', 'Hi', 'BOOKING', '5']);   // data values are strings
  assert.match(send.opts.headers.authorization, /^Bearer ya29\./);
  const authCalls = () => calls.filter((c) => c.url.includes('oauth2')).length;
  await f.send({ token: 'tok2', title: 'a', body: 'b' }); assert.equal(authCalls(), 1);                      // access token reused
  sendStatus = [401, 200]; assert.deepEqual(await f.send({ token: 'tok3', title: 'a', body: 'b' }), { ok: true }); assert.equal(authCalls(), 2);   // 401 → fresh token → success
  sendStatus = [404]; assert.deepEqual(await f.send({ token: 'dead', title: 'a', body: 'b' }), { ok: false, invalid: true });
  sendStatus = [500]; await assert.rejects(f.send({ token: 'tok4', title: 'a', body: 'b' }), /boom/);
});
test('createPush: mock without credentials, validates the service-account setting', () => {
  assert.equal(createPush({}).name, 'mock'); assert.equal(createPush({ FCM_SERVICE_ACCOUNT_JSON: JSON.stringify(SA) }).name, 'fcm');
  assert.equal(createPush({ FCM_SERVICE_ACCOUNT_JSON: Buffer.from(JSON.stringify(SA)).toString('base64') }).name, 'fcm');   // base64 is easier to put in an env file
  assert.throws(() => createPush({ FCM_SERVICE_ACCOUNT_JSON: '{"project_id":"x"}' }), /must contain/); assert.throws(() => createPush({ FCM_SERVICE_ACCOUNT_JSON: 'not json' }), /not valid JSON/);
});
