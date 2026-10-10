// Production hardening helpers: security headers, CORS allow-list, rate limiting, request logging, environment checks.

export function securityHeaders(res, prod) {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('cache-control', 'no-store');                                   // API answers are personal; never cache them
  if (prod) res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
}

/** Dev with no CORS_ORIGINS: allow all. Otherwise only the listed origins (production with none listed = same-origin only). */
export function applyCors(req, res, env = process.env) {
  const list = (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.origin;
  const allowAll = list.includes('*') || (!list.length && env.NODE_ENV !== 'production');
  if (!origin) return true;
  if (!(allowAll || list.includes(origin))) return false;
  res.setHeader('access-control-allow-origin', allowAll ? '*' : origin);
  if (!allowAll) res.setHeader('vary', 'Origin');
  res.setHeader('access-control-allow-headers', 'content-type,authorization');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-max-age', '600');
  return true;
}

export function createLimiter({ max, windowMs = 60_000 }) {
  const hits = new Map();
  return (key, now = Date.now()) => {
    if (hits.size > 10_000) for (const [k, v] of hits) if (!v.length || now - v.at(-1) > windowMs) hits.delete(k);   // keep memory bounded
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs); recent.push(now); hits.set(key, recent);
    return recent.length > max ? { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000)) } : { ok: true };
  };
}

export const clientIp = (req, env = process.env) =>
  (env.TRUST_PROXY === '1' && String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';

/** One JSON line per request. Only the path (never the query string or body) is logged, so tokens and OTPs never reach the logs. */
export const logLine = ({ method, url, status, ms, user }) => JSON.stringify({ t: new Date().toISOString(), method, path: String(url).split('?')[0], status, ms, user: user ?? null });

/** Returns { errors, warnings } for a deployment's environment. Errors mean "do not start". */
export function validateEnv(env = process.env) {
  const errors = [], warnings = [];
  if (env.NODE_ENV !== 'production') return { errors, warnings: ['NODE_ENV is not "production" — fine for development, not for a live server.'] };
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) errors.push('JWT_SECRET must be set to a random string of at least 32 characters.');
  if (!env.DATABASE_URL && !env.SQLITE_PATH) errors.push('Set DATABASE_URL (PostgreSQL) or SQLITE_PATH — production needs durable storage.');
  if (!env.SMS_PROVIDER || env.SMS_PROVIDER === 'mock' || env.SMS_PROVIDER === 'none') warnings.push('SMS_PROVIDER is not configured with MSG91 — SMS OTPs will be simulated in memory. ID/Password login is active.');
  if (env.SMS_PROVIDER === 'msg91' && (!env.MSG91_AUTHKEY || !env.MSG91_TEMPLATE_ID)) errors.push('MSG91_AUTHKEY and MSG91_TEMPLATE_ID are required for SMS_PROVIDER=msg91.');
  if (env.PAYMENT_PROVIDER !== 'razorpay') errors.push('Set PAYMENT_PROVIDER=razorpay — bookings cannot be paid for safely without a payment gateway.');
  else for (const k of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET']) if (!env[k]) errors.push(`${k} is required for PAYMENT_PROVIDER=razorpay.`);
  if (env.WHATSAPP_TOKEN && !env.WHATSAPP_PHONE_ID) errors.push('WHATSAPP_PHONE_ID is required together with WHATSAPP_TOKEN.');
  if (env.WHATSAPP_TOKEN && !env.WHATSAPP_APP_SECRET) errors.push('WHATSAPP_APP_SECRET is required to verify inbound WhatsApp webhooks.');
  if (env.WHATSAPP_TOKEN && !env.WHATSAPP_VERIFY_TOKEN) errors.push('WHATSAPP_VERIFY_TOKEN is required for the WhatsApp webhook handshake.');
  if (env.SEED_DEMO === '1') warnings.push('SEED_DEMO=1 puts fake demo users and properties on a live server. Remove it.');
  if (!env.BOOTSTRAP_ADMIN_PHONE) warnings.push('BOOTSTRAP_ADMIN_PHONE is not set: fine if an admin already exists, but a brand-new database will refuse to start without it.');
  if (!env.WHATSAPP_TOKEN) warnings.push('WhatsApp is not configured: the AI assistant will record messages but send none.');
  if (!env.CORS_ORIGINS) warnings.push('CORS_ORIGINS is not set: browsers on other domains (e.g. a separately hosted admin site) will be blocked.');
  if (env.TRUST_PROXY !== '1') warnings.push('TRUST_PROXY is not 1: behind a reverse proxy every user will look like the same IP and share rate limits.');
  if (env.DATABASE_URL && env.SQLITE_PATH) warnings.push('Both DATABASE_URL and SQLITE_PATH are set; DATABASE_URL wins.');
  return { errors, warnings };
}
