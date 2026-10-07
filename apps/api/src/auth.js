// Zero-dependency auth: HS256 JWT + phone OTP (SMS via a provider — see createSmsProvider).
import crypto from 'node:crypto';

const PROD = process.env.NODE_ENV === 'production';
const SECRET = process.env.JWT_SECRET ?? (PROD ? null : 'dev-only-secret-change-me');
if (!SECRET || (PROD && SECRET.length < 32)) throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production');

const b64 = (b) => Buffer.from(b).toString('base64url');
const hmac = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export const TOKEN_TTL_SEC = 7 * 24 * 3600; // TODO: short access token + refresh token before launch

export function signToken({ sub, role }, now = Date.now(), ttl = TOKEN_TTL_SEC) {
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({ sub, role, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + ttl }));
  return `${head}.${body}.${hmac(`${head}.${body}`)}`;
}

/** Returns {sub, role} or null. Rejects tampering, wrong alg (incl. "none") and expiry. */
export function verifyToken(header, now = Date.now()) {
  const raw = /^Bearer (.+)$/.exec(header ?? '')?.[1];
  const parts = raw?.split('.');
  if (parts?.length !== 3) return null;
  try {
    const h = JSON.parse(Buffer.from(parts[0], 'base64url'));
    if (h.alg !== 'HS256') return null;
    if (!safeEq(hmac(`${parts[0]}.${parts[1]}`), parts[2])) return null;
    const p = JSON.parse(Buffer.from(parts[1], 'base64url'));
    if (!p.sub || !p.role || p.exp * 1000 <= now) return null;
    return { sub: p.sub, role: p.role };
  } catch { return null; }
}

// ---------- OTP ----------
const OTP_TTL_MS = 5 * 60_000, RESEND_MS = 30_000, MAX_ATTEMPTS = 5;
const otps = new Map(); // phone -> { hash, expiresAt, attempts, sentAt }
export const validPhone = (p) => /^[6-9]\d{9}$/.test(String(p));
const otpHash = (phone, code) => hmac(`otp:${phone}:${code}`);

// ---------- SMS providers ----------
// India requires DLT-registered sender + templates: register an OTP template with your SMS provider before launch.
export function mockSmsProvider() { const outbox = []; return { name: 'mock', outbox, async sendOtp({ phone, code }) { outbox.push({ phone, code, at: new Date().toISOString() }); } }; }
export function msg91Provider({ authKey, templateId, otpVar = 'OTP' }) {
  return {
    name: 'msg91',
    async sendOtp({ phone, code }) {
      const r = await fetch('https://control.msg91.com/api/v5/flow/', { method: 'POST', headers: { authkey: authKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ template_id: templateId, short_url: '0', recipients: [{ mobiles: '91' + phone, [otpVar]: code }] }) });
      const j = await r.json().catch(() => ({})); if (!r.ok || j.type === 'error') throw new Error(`MSG91: ${j.message ?? r.status}`);
    },
  };
}
export function createSmsProvider(env = process.env) {
  if (env.SMS_PROVIDER === 'msg91') {
    if (!env.MSG91_AUTHKEY || !env.MSG91_TEMPLATE_ID) throw new Error('SMS_PROVIDER=msg91 needs MSG91_AUTHKEY and MSG91_TEMPLATE_ID');
    return msg91Provider({ authKey: env.MSG91_AUTHKEY, templateId: env.MSG91_TEMPLATE_ID, otpVar: env.MSG91_OTP_VAR ?? 'OTP' });
  }
  if (env.NODE_ENV === 'production') throw new Error('Set SMS_PROVIDER (e.g. msg91) — OTP codes cannot be delivered in production without one');
  return mockSmsProvider();
}
export const sms = createSmsProvider();

// ---------- abuse limits (SMS costs money; OTP endpoints invite bombing) ----------
const hits = new Map();   // key -> [timestamps]
const LIMITS = { phone: 5, ip: 20 }, WINDOW_MS = 3600e3;
function overLimit(key, max, now) {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS); recent.push(now); hits.set(key, recent);
  return recent.length > max;
}

export async function requestOtp(phone, now = Date.now(), { ip = 'unknown' } = {}) {
  if (!validPhone(phone)) return { status: 422, error: 'Enter a valid 10-digit mobile number' };
  const prev = otps.get(phone);
  if (prev && now - prev.sentAt < RESEND_MS) return { status: 429, error: 'Please wait a few seconds before asking for another code' };
  if (overLimit('phone:' + phone, LIMITS.phone, now) || overLimit('ip:' + ip, LIMITS.ip, now)) return { status: 429, error: 'Too many requests. Please try again in an hour.' };
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  otps.set(phone, { hash: otpHash(phone, code), expiresAt: now + OTP_TTL_MS, attempts: 0, sentAt: now });
  try { await sms.sendOtp({ phone, code }); }
  catch (e) { otps.delete(phone); console.error('[sms] send failed:', e.message); return { status: 502, error: 'We could not send the SMS. Please try again.' }; }   // never leak provider details to the client
  return { status: 200, ok: true, ...(PROD ? {} : { devCode: code }) }; // devCode NEVER returned in production
}

/** One-time: a code can be used once; 5 wrong tries burns it. */
export function checkOtp(phone, code, now = Date.now()) {
  const o = otps.get(phone);
  if (!o || now > o.expiresAt) return { ok: false, status: 400, error: 'Code expired — request a new one' };
  if (o.attempts >= MAX_ATTEMPTS) return { ok: false, status: 429, error: 'Too many attempts — request a new code' };
  o.attempts++;
  if (!safeEq(o.hash, otpHash(phone, String(code)))) return { ok: false, status: 400, error: 'Incorrect code' };
  otps.delete(phone);
  return { ok: true };
}
