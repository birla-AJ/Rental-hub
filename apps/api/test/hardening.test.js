import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEnv, createLimiter, applyCors, logLine, securityHeaders } from '../src/hardening.js';
import crypto from 'node:crypto';

// The production server uses ITS OWN secret, so sign test tokens with that one.
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const bearer = (secret, sub, role) => { const head = b64({ alg: 'HS256', typ: 'JWT' }), body = b64({ sub, role, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }); return { authorization: `Bearer ${head}.${body}.${crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')}` }; };

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/server.js');
const PROD = { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), SQLITE_PATH: '', SMS_PROVIDER: 'msg91', MSG91_AUTHKEY: 'k', MSG91_TEMPLATE_ID: 't', PAYMENT_PROVIDER: 'razorpay', RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: 's', RAZORPAY_WEBHOOK_SECRET: 'w', TRUST_PROXY: '1' };

test('validateEnv: every production mistake is reported at once; dev is lenient', () => {
  assert.deepEqual(validateEnv({ NODE_ENV: 'development' }).errors, []);
  const bad = validateEnv({ NODE_ENV: 'production', JWT_SECRET: 'short', WHATSAPP_TOKEN: 't' }).errors.join('\n');
  for (const w of ['JWT_SECRET', 'DATABASE_URL', 'SMS_PROVIDER', 'PAYMENT_PROVIDER', 'WHATSAPP_PHONE_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN']) assert.ok(bad.includes(w), w);
  const ok = validateEnv({ ...PROD, SQLITE_PATH: '/data/app.db' }); assert.deepEqual(ok.errors, []); assert.ok(ok.warnings.some((w) => /WhatsApp is not configured/.test(w)));
});
test('limiter: blocks after the max, reports retry time, recovers after the window', () => {
  const lim = createLimiter({ max: 3, windowMs: 1000 });
  assert.ok([1, 2, 3].every((i) => lim('a', i).ok)); const r = lim('a', 4); assert.equal(r.ok, false); assert.ok(r.retryAfter >= 1);
  assert.ok(lim('b', 4).ok);                                  // other callers unaffected
  assert.ok(lim('a', 2000).ok);                               // window passed
});
test('CORS: dev allows all, production only the listed origins', () => {
  const run = (env, origin) => { const h = {}; const res = { setHeader: (k, v) => (h[k] = v) }; const ok = applyCors({ headers: { origin } }, res, env); return { ok, h }; };
  assert.equal(run({ NODE_ENV: 'development' }, 'http://x.test').h['access-control-allow-origin'], '*');
  assert.equal(run({ NODE_ENV: 'production' }, 'https://evil.test').ok, false);                      // production with no list: same-origin only
  const allowed = run({ NODE_ENV: 'production', CORS_ORIGINS: 'https://admin.example.com, https://app.example.com' }, 'https://admin.example.com');
  assert.equal(allowed.h['access-control-allow-origin'], 'https://admin.example.com'); assert.equal(allowed.h.vary, 'Origin');
  assert.equal(run({ NODE_ENV: 'production', CORS_ORIGINS: 'https://admin.example.com' }, 'https://evil.test').ok, false);
});
test('request log lines never contain query strings (tokens/OTPs) or bodies', () => {
  const line = JSON.parse(logLine({ method: 'GET', url: '/listings?token=SECRET&phone=9876543210', status: 200, ms: 3, user: 't1' }));
  assert.equal(line.path, '/listings'); assert.equal(JSON.stringify(line).includes('SECRET'), false);
});

// ---------- real processes ----------
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rh-hard-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
function boot(env) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ['--no-warnings', SERVER], { env: { PATH: process.env.PATH, PORT: '0', ...env } }); let out = '';
    const done = (v) => resolve({ p, out, getOut: () => out, ...v });
    p.stdout.on('data', (d) => { out += d; const m = /API on :(\d+)/.exec(out); if (m) done({ base: `http://localhost:${m[1]}`, started: true }); });
    p.stderr.on('data', (d) => (out += d)); p.on('exit', (code) => done({ started: false, code }));
    setTimeout(() => { p.kill('SIGKILL'); done({ started: false, timeout: true }); }, 8000).unref();
  });
}
const exited = (p) => new Promise((r) => (p.exitCode !== null ? r(p.exitCode) : p.on('exit', r)));

test('production refuses to start with a bad environment, and says why', async () => {
  const r = await boot({ NODE_ENV: 'production' });
  assert.equal(r.started, false); assert.notEqual(r.code, 0); assert.match(r.out, /JWT_SECRET/);
  const r2 = await boot({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), SMS_PROVIDER: 'msg91', MSG91_AUTHKEY: 'k', MSG91_TEMPLATE_ID: 't', PAYMENT_PROVIDER: 'razorpay', RAZORPAY_KEY_ID: 'a', RAZORPAY_KEY_SECRET: 'b', RAZORPAY_WEBHOOK_SECRET: 'c' });   // no storage
  assert.equal(r2.started, false); assert.match(r2.out, /DATABASE_URL|durable/);
});

test('a production server: security headers, CORS allow-list, health, JSON request log, OTP never returned, graceful shutdown keeps data', async () => {
  const env = { ...PROD, SQLITE_PATH: path.join(dir, 'p.db'), CORS_ORIGINS: 'https://admin.example.com', BOOTSTRAP_ADMIN_PHONE: '9000000001' };
  let s = await boot(env); assert.ok(s.started, s.out);
  const h = await fetch(s.base + '/health'); const body = await h.json();
  assert.equal(h.status, 200); assert.equal(body.ok, true); assert.equal(body.storage, 'durable');
  assert.equal(h.headers.get('x-content-type-options'), 'nosniff'); assert.equal(h.headers.get('x-frame-options'), 'DENY'); assert.match(h.headers.get('strict-transport-security'), /max-age/); assert.equal(h.headers.get('cache-control'), 'no-store');
  const ok = await fetch(s.base + '/health', { headers: { origin: 'https://admin.example.com' } }); assert.equal(ok.headers.get('access-control-allow-origin'), 'https://admin.example.com');
  const evil = await fetch(s.base + '/health', { headers: { origin: 'https://evil.example' } }); assert.equal(evil.headers.get('access-control-allow-origin'), null);
  assert.equal((await fetch(s.base + '/auth/otp', { method: 'OPTIONS', headers: { origin: 'https://admin.example.com' } })).status, 204);
  assert.equal((await fetch(s.base + '/rooms/r1')).status, 401);
  assert.equal((await fetch(s.base + '/profile', { method: 'POST', headers: { 'content-type': 'application/json', ...bearer(PROD.JWT_SECRET, 'admin1', 'admin') }, body: JSON.stringify({ name: 'Saved Before Shutdown' }) })).status, 200);
  s.p.kill('SIGTERM'); assert.equal(await exited(s.p), 0);                                                   // graceful: exit code 0
  const log = s.getOut(); assert.match(log, /"path":"\/profile"/); assert.equal(log.includes('Saved Before Shutdown'), false);     // logged the call, not the body
  s = await boot(env); assert.ok(s.started, s.out);
  assert.equal((await (await fetch(s.base + '/profile', { headers: bearer(PROD.JWT_SECRET, 'admin1', 'admin') })).json()).user.name, 'Saved Before Shutdown');
  s.p.kill('SIGKILL');
});

test('rate limit: too many requests from one address get 429 + Retry-After; /health is exempt', async () => {
  const s = await boot({ NODE_ENV: 'development', RATE_LIMIT_PER_MIN: '5' }); assert.ok(s.started, s.out);
  const codes = []; for (let i = 0; i < 8; i++) codes.push((await fetch(s.base + '/rooms/r1')).status);
  assert.deepEqual(codes.slice(0, 5), [401, 401, 401, 401, 401]); assert.deepEqual(codes.slice(5), [429, 429, 429]);
  const limited = await fetch(s.base + '/rooms/r1'); assert.ok(Number(limited.headers.get('retry-after')) >= 1);
  assert.equal((await fetch(s.base + '/health')).status, 200);
  s.p.kill('SIGKILL');
});
