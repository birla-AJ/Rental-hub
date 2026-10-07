import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { server } from '../src/server.js';
import { signToken, verifyToken } from '../src/auth.js';
import { H } from '../test-helpers.mjs';

let base;
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = `http://localhost:${server.address().port}`; });
test.after(() => server.close());
const call = async (m, p, headers = {}, body) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...headers }, body: body && JSON.stringify(body) }); return { status: r.status, ...(await r.json()) }; };
const bearer = (t) => ({ authorization: 'Bearer ' + t });

test('JWT: valid ok; tampered / expired / alg=none / garbage rejected', () => {
  const t = signToken({ sub: 't1', role: 'tenant' });
  assert.deepEqual(verifyToken('Bearer ' + t), { sub: 't1', role: 'tenant' });
  const [h, p, s] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ sub: 't1', role: 'admin', iat: 1, exp: 9999999999 })).toString('base64url');
  assert.equal(verifyToken(`Bearer ${h}.${forged}.${s}`), null);
  assert.equal(verifyToken('Bearer ' + signToken({ sub: 't1', role: 'tenant' }, Date.now() - 8 * 864e5)), null);
  const none = Buffer.from('{"alg":"none"}').toString('base64url');
  assert.equal(verifyToken(`Bearer ${none}.${p}.`), null);
  assert.equal(verifyToken('Bearer x.y.z'), null); assert.equal(verifyToken(undefined), null);
});
test('no token => 401 (x-role header no longer works)', async () => {
  assert.equal((await call('GET', '/rooms/r1')).status, 401);
  assert.equal((await call('GET', '/rooms/r1', { 'x-role': 'admin' })).status, 401);
});
test('OTP login: wrong code rejected, correct works once, 5 bad tries burn the code', async () => {
  const phone = '9876543210';
  const r = await call('POST', '/auth/otp', {}, { phone }); assert.equal(r.status, 200); assert.match(r.devCode, /^\d{6}$/);
  assert.equal((await call('POST', '/auth/otp', {}, { phone })).status, 429);          // resend throttled
  const wrong = r.devCode === '000000' ? '111111' : '000000';
  assert.equal((await call('POST', '/auth/verify', {}, { phone, code: wrong })).status, 400);
  const ok = await call('POST', '/auth/verify', {}, { phone, code: r.devCode });
  assert.equal(ok.status, 200); assert.equal(ok.user.role, 'tenant');
  assert.equal((await call('POST', '/auth/verify', {}, { phone, code: r.devCode })).status, 400); // single use
  assert.equal((await call('GET', '/rooms/r1', bearer(ok.token))).status, 200);
});
test('bad phone rejected; brute force locks the code', async () => {
  assert.equal((await call('POST', '/auth/otp', {}, { phone: '12345' })).status, 422);
  const phone = '9425011111'; const r = await call('POST', '/auth/otp', {}, { phone });
  for (let i = 0; i < 5; i++) await call('POST', '/auth/verify', {}, { phone, code: '999999' === r.devCode ? '888888' : '999999' });
  assert.equal((await call('POST', '/auth/verify', {}, { phone, code: r.devCode })).status, 429);
});
test('roles: new account cannot become agent/admin; switch limited to own roles', async () => {
  const phone = '9111122222'; const r = await call('POST', '/auth/otp', {}, { phone });
  const v = await call('POST', '/auth/verify', {}, { phone, code: r.devCode, role: 'admin' });
  assert.equal(v.user.role, 'tenant'); assert.deepEqual(v.user.roles, ['tenant', 'owner']);
  assert.equal((await call('POST', '/auth/switch', bearer(v.token), { role: 'admin' })).status, 403);
  assert.equal((await call('POST', '/auth/switch', bearer(v.token), { role: 'agent' })).status, 403);
  assert.equal((await call('POST', '/auth/switch', bearer(v.token), { role: 'owner' })).status, 200);
});
test('ownership: other tenants/owners/agents cannot touch someone else’s room', async () => {
  assert.equal((await call('GET', '/rooms/r1', H('tenant', 't2'))).status, 403);
  assert.equal((await call('POST', '/checkout/r1/start', H('tenant', 't2'))).status, 403);
  assert.equal((await call('POST', '/checkout/r1/owner-respond', H('owner', 'o2'), { confirmed: true })).status, 403);
  assert.equal((await call('GET', '/properties/p1', H('agent', 'a2'))).status, 403);
  assert.equal((await call('GET', '/rooms/r1', H('tenant', 't1'))).status, 200);
});
