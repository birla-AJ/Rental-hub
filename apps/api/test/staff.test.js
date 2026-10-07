import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { server } from '../src/server.js';
import { H } from '../test-helpers.mjs';

let base;
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = `http://localhost:${server.address().port}`; });
test.after(() => server.close());
const call = async (m, p, who, body) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...(Array.isArray(who) ? H(...who) : { authorization: 'Bearer ' + who }) }, body: body && JSON.stringify(body) }); return { status: r.status, ...(await r.json()) }; };
const ADMIN = ['admin'];
const login = async (phone, role) => { const r = await (await fetch(base + '/auth/otp', { method: 'POST', body: JSON.stringify({ phone }) })).json(); const v = await (await fetch(base + '/auth/verify', { method: 'POST', body: JSON.stringify({ phone, code: r.devCode, role }) })).json(); return v; };

test('only admins manage staff; input is validated', async () => {
  assert.equal((await call('GET', '/staff', ['tenant', 't1'])).status, 403); assert.equal((await call('POST', '/staff', ['agent', 'a1'], { name: 'X Y', phone: '9111100001', role: 'agent' })).status, 403);
  for (const bad of [{ name: 'A', phone: '9111100001', role: 'agent' }, { name: 'Ravi Kumar', phone: '123', role: 'agent' }, { name: 'Ravi Kumar', phone: '9111100001', role: 'owner' }]) assert.equal((await call('POST', '/staff', ADMIN, bad)).status, 422);
});
test('a new agent can log in with an SMS code and sees the agent app; a stranger who guesses the role cannot', async () => {
  const made = await call('POST', '/staff', ADMIN, { name: 'Ravi Kumar', phone: '9111100002', role: 'agent' }); assert.equal(made.status, 200); assert.equal(made.staff.roles, 'agent');
  assert.equal((await call('POST', '/staff', ADMIN, { name: 'Ravi Kumar', phone: '9111100002', role: 'agent' })).status, 409);
  const v = await login('9111100002'); assert.equal(v.user.role, 'agent'); assert.deepEqual(v.user.roles, ['agent']);
  assert.equal((await call('GET', '/agent/dashboard', v.token)).status, 200);
  const stranger = await login('9111100003', 'agent'); assert.equal(stranger.user.role, 'tenant');                      // self-signup can never become staff
  assert.equal((await call('GET', '/agent/dashboard', stranger.token)).status, 403);
});
test('an existing user (a tenant) can be given the agent role and switch to it', async () => {
  const t = await login('9111100004'); assert.deepEqual(t.user.roles, ['tenant', 'owner']);
  await call('POST', '/staff', ADMIN, { name: 'Test Tenant', phone: '9111100004', role: 'agent' });
  assert.equal((await call('POST', '/auth/switch', t.token, { role: 'agent' })).status, 200);
});
test('deactivating an account cuts off access immediately, even with a valid token; reactivation restores it', async () => {
  const v = await login('9111100002'); const staff = (await call('GET', '/staff', ADMIN)).rows.find((r) => r.phone === '9111100002');
  assert.equal((await call('GET', '/agent/dashboard', v.token)).status, 200);
  assert.equal((await call('POST', `/staff/${staff.id}/deactivate`, ADMIN)).staff.status, 'DISABLED');
  assert.equal((await call('GET', '/agent/dashboard', v.token)).status, 401);                                           // the old token is useless now
  const again = await (await fetch(base + '/auth/otp', { method: 'POST', body: JSON.stringify({ phone: '9111100002' }) })).json(); const att = await (await fetch(base + '/auth/verify', { method: 'POST', body: JSON.stringify({ phone: '9111100002', code: again.devCode }) })).json();
  assert.equal((await call('GET', '/agent/dashboard', att.token)).status, 401);                                         // and a fresh login doesn't help
  await call('POST', `/staff/${staff.id}/reactivate`, ADMIN); assert.equal((await call('GET', '/agent/dashboard', v.token)).status, 200);
});
test('safety rails: not yourself, not the last admin, not an agent who still has open properties', async () => {
  assert.equal((await call('POST', '/staff/admin1/deactivate', ADMIN)).status, 409);
  const second = (await call('POST', '/staff', ADMIN, { name: 'Second Admin', phone: '9111100005', role: 'admin' })).staff;
  assert.equal((await call('POST', '/staff/admin1/deactivate', ['admin', second.id])).status, 200);                      // possible once another admin exists
  assert.equal((await call('POST', `/staff/${second.id}/deactivate`, ['admin', second.id])).status, 409);               // yourself
  assert.equal((await call('POST', `/staff/${second.id}/deactivate`, ['admin', 'admin1'])).status, 401);                // admin1 was just deactivated
  await call('POST', '/staff/admin1/reactivate', ['admin', second.id]);
  const busy = (await call('GET', '/staff', ADMIN)).rows.find((r) => r.id === 'a1'); assert.ok(busy.openTasks >= 1);
  const r = await call('POST', '/staff/a1/deactivate', ADMIN); assert.equal(r.status, 409); assert.match(r.error, /Reassign/);
  assert.equal((await call('POST', '/staff/nobody/deactivate', ADMIN)).status, 404);
});

// ---------- a brand-new production server ----------
const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/server.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rh-staff-')); test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
const PROD = { NODE_ENV: 'production', JWT_SECRET: 'y'.repeat(40), SMS_PROVIDER: 'msg91', MSG91_AUTHKEY: 'k', MSG91_TEMPLATE_ID: 't', PAYMENT_PROVIDER: 'razorpay', RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: 's', RAZORPAY_WEBHOOK_SECRET: 'w', SQLITE_PATH: path.join(dir, 'new.db'), PORT: '0' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const adminToken = () => { const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64({ sub: 'admin1', role: 'admin', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }); return `${h}.${p}.${crypto.createHmac('sha256', PROD.JWT_SECRET).update(`${h}.${p}`).digest('base64url')}`; };
const boot = (env) => new Promise((resolve) => { const p = spawn(process.execPath, ['--no-warnings', SERVER], { env: { PATH: process.env.PATH, ...env } }); let out = ''; const done = (v) => resolve({ p, getOut: () => out, ...v });
  p.stdout.on('data', (d) => { out += d; const m = /API on :(\d+)/.exec(out); if (m) done({ started: true, base: `http://localhost:${m[1]}` }); }); p.stderr.on('data', (d) => (out += d)); p.on('exit', (code) => done({ started: false, code }));
  setTimeout(() => { p.kill('SIGKILL'); done({ started: false, timeout: true }); }, 8000).unref(); });

test('production starts EMPTY (no demo data), creates the first admin from BOOTSTRAP_ADMIN_PHONE, and refuses to run with no admin', async () => {
  const noAdmin = await boot({ ...PROD, SQLITE_PATH: path.join(dir, 'none.db') }); assert.equal(noAdmin.started, false); assert.match(noAdmin.getOut(), /no active admin/);
  const env = { ...PROD, BOOTSTRAP_ADMIN_PHONE: '9000000001', BOOTSTRAP_ADMIN_NAME: 'Asha Founder' };
  let s = await boot(env); assert.ok(s.started, s.getOut());
  const get = async (p) => (await fetch(s.base + p, { headers: { authorization: 'Bearer ' + adminToken() } })).json();
  assert.deepEqual((await get('/admin/users')).rows.map((u) => u.name), ['Asha Founder']);                              // only the admin — no Rahul, no Suresh
  for (const t of ['properties', 'rooms', 'bookings', 'commissions', 'cashback', 'qr']) assert.equal((await get('/admin/' + t)).rows.length, 0, t);
  assert.equal((await (await fetch(s.base + '/listings', { headers: { authorization: 'Bearer ' + adminToken() } })).json()).error !== undefined, true);   // nothing to browse either
  s.p.kill('SIGTERM'); await new Promise((r) => s.p.on('exit', r));
  s = await boot(env); assert.ok(s.started, s.getOut());                                                                 // restart: the admin is not duplicated
  assert.equal((await get('/admin/users')).rows.length, 1); s.p.kill('SIGKILL');
  s = await boot({ ...PROD, BOOTSTRAP_ADMIN_PHONE: undefined }); assert.ok(s.started, s.getOut()); s.p.kill('SIGKILL');   // admin already in the database → no env needed
});
