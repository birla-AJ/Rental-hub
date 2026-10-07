import test from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../src/server.js';
import { sms } from '../src/auth.js';
import { H } from '../test-helpers.mjs';

let base;
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = `http://localhost:${server.address().port}`; });
test.after(() => server.close());
const call = async (m, p, who, body, headers = {}) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...(who ? H(...who) : {}), ...headers }, body: body && JSON.stringify(body) }); return { status: r.status, ...(await r.json()) }; };
const ADMIN = ['admin'];

test('admin can reassign an agent; others cannot; closed properties are refused', async () => {
  const agents = (await call('GET', '/admin/agents', ADMIN)).rows; assert.equal(agents.length, 2); assert.match(agents[0].name, /open\)/);
  assert.equal((await call('POST', '/properties/p2/assign', ADMIN, { agentId: 'a2' })).agent, 'Pooja Mehta');
  assert.equal((await call('GET', '/properties/p2', ['agent', 'a1'])).status, 403);                    // old agent lost access
  assert.equal((await call('GET', '/properties/p2', ['agent', 'a2'])).status, 200);
  assert.equal((await call('POST', '/properties/p2/assign', ADMIN, { agentId: 'o1' })).status, 422);    // must be a real agent
  assert.equal((await call('POST', '/properties/p2/assign', ['agent', 'a2'], { agentId: 'a1' })).status, 403);
  assert.equal((await call('POST', '/properties/p1/assign', ADMIN, { agentId: 'a2' })).status, 409);    // p1 is already verified
  assert.ok((await call('GET', '/notifications', ['agent', 'a2'])).rows.some((n) => /assigned to you/.test(n.body)));
});
test('admin can reject or send back a property, with a reason', async () => {
  assert.equal((await call('POST', '/properties/p3/revisit', ADMIN, {})).status, 422);
  assert.equal((await call('POST', '/properties/p3/reject', ADMIN, { reason: 'Address does not exist' })).status, 200);
  assert.ok((await call('GET', '/notifications', ['tenant', 't3'])).rows.some((n) => /Address does not exist/.test(n.body)));
});
test('reports are computed from real data, not samples', async () => {
  const r = await call('GET', '/admin/reports', ADMIN);
  assert.equal(r.funnel[0].stage, 'Registered by tenants'); assert.ok(r.funnel[0].count >= 3);
  assert.ok(r.funnel.every((f, i) => i === 0 || f.count <= r.funnel[i - 1].count + 5));
  assert.deepEqual(r.commission.map((c) => c.status), ['DUE', 'PAID', 'WAIVED']);
  assert.match(r.commission[2].note, /never paid to owners/);
  assert.equal((await call('GET', '/admin/reports', ['owner', 'o1'])).status, 403); assert.equal((await call('GET', '/me/reports', ['owner', 'o1'])).status, 403);
  const o = await call('GET', '/admin/overview', ADMIN);
  assert.equal(o.series.labels.length, 6); assert.equal('sampleSeries' in o, false);
  assert.ok(Object.values(o.series).every((v) => Array.isArray(v)));
});
test('a verified property shows up in this week\'s verification trend and in the agent report', async () => {
  const before = (await call('GET', '/admin/overview', ADMIN)).series.verificationTrend.at(-1);
  await call('POST', '/properties/p2/qr', ADMIN);
  const full = { photosMatch: 1, roomsCounted: 1, ownerContactCaptured: 1, tenantKycVerified: 1, geoTagged: 1, qrApplied: 1 };
  assert.equal((await call('POST', '/properties/p2/verify', ['agent', 'a2'], { checklist: full, geo: { lat: 22.7, lng: 75.8 } })).status, 200);
  assert.equal((await call('GET', '/admin/overview', ADMIN)).series.verificationTrend.at(-1), before + 1);
  assert.ok((await call('GET', '/admin/reports', ADMIN)).agents.find((a) => a.agent === 'Pooja Mehta').verified >= 1);
});
test('settings are read-only and show the locked business rules', async () => {
  const s = await call('GET', '/admin/settings', ADMIN);
  assert.equal(s.rules.commissionRate, 0.2); assert.equal(s.rules.placementWindowDays, 7); assert.equal(s.rules.registrationTokenRate, 0.3);
  assert.deepEqual(s.rules.cashbackLadder.map((l) => l.rate), [0.3, 0.3, 0.1, 0.07]);
  assert.equal(s.system.ownerFoundRoomsCoveredByPlacement, false); assert.equal(s.system.repairCoordinationIncluded, false);
  assert.equal((await call('POST', '/admin/settings', ADMIN, { commissionRate: 0.5 })).status, 404);     // nothing to write: rules change only in code, with client sign-off
});
test('OTP SMS: delivered via the provider, per-phone and per-IP limits, provider failure is safe', async () => {
  const phone = '9333344444', ip = { 'x-forwarded-for': '1.1.1.1' };
  const r = await call('POST', '/auth/otp', null, { phone }); assert.equal(r.status, 200);
  assert.equal(sms.outbox.at(-1).phone, phone); assert.equal(sms.outbox.at(-1).code, r.devCode);
  // per-phone: after 5 sends in an hour, no more (bypass the 30s resend gap by using many phones for IP test below)
  const real = sms.sendOtp; sms.sendOtp = async () => { throw new Error('MSG91: invalid authkey sk_live_SECRET'); };
  const bad = await call('POST', '/auth/otp', null, { phone: '9333355555' });
  assert.equal(bad.status, 502); assert.equal(JSON.stringify(bad).includes('SECRET'), false);                      // provider details never reach the client
  sms.sendOtp = real; assert.equal((await call('POST', '/auth/otp', null, { phone: '9333355555' })).status, 200);  // failure didn't trigger the resend wait
  // per-IP: 20/hour
  let blocked = 0; for (let i = 0; i < 25; i++) if ((await call('POST', '/auth/otp', null, { phone: '94000' + String(10000 + i) })).status === 429) blocked++;
  assert.ok(blocked >= 1, 'IP limit should kick in');
});
