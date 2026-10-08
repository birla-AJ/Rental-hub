// Push notifications: Firebase Cloud Messaging (FCM v1) in production, a recording mock in development / tests.
// FCM v1 needs a short-lived OAuth token, which we get by signing a JWT (RS256) with the Firebase service-account key.
import crypto from 'node:crypto';

export function mockPush() {
  const outbox = [];
  return { name: 'mock', outbox, async send({ token, title, body, data }) { outbox.push({ token, title, body, data }); return { ok: true }; } };
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

/** Builds the signed assertion Google exchanges for an access token. Exported so it can be verified in tests. */
export function serviceAccountAssertion(sa, nowSec) {
  const head = b64({ alg: 'RS256', typ: 'JWT' }), claims = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token', iat: nowSec, exp: nowSec + 3600 });
  return `${head}.${claims}.${crypto.createSign('RSA-SHA256').update(`${head}.${claims}`).sign(sa.private_key, 'base64url')}`;
}

export function fcmPush({ serviceAccount: sa, fetchFn = fetch, now = () => Date.now() }) {
  let cached = null;   // { token, expiresAt }
  async function accessToken(force = false) {
    if (!force && cached && cached.expiresAt > now() + 60_000) return cached.token;
    const r = await fetchFn(sa.token_uri ?? 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: serviceAccountAssertion(sa, Math.floor(now() / 1000)) }).toString() });
    const j = await r.json().catch(() => ({})); if (!r.ok || !j.access_token) throw new Error(`FCM auth failed: ${j.error_description ?? j.error ?? r.status}`);
    cached = { token: j.access_token, expiresAt: now() + (j.expires_in ?? 3600) * 1000 }; return cached.token;
  }
  async function post(message, force) {
    return fetchFn(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, { method: 'POST', headers: { authorization: `Bearer ${await accessToken(force)}`, 'content-type': 'application/json' }, body: JSON.stringify({ message }) });
  }
  return {
    name: 'fcm',
    async send({ token, title, body, data = {} }) {
      const message = { token, notification: { title, body }, data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
        android: { priority: 'HIGH', notification: { channel_id: 'default' } }, apns: { headers: { 'apns-priority': '10' }, payload: { aps: { sound: 'default' } } } };
      let r = await post(message, false);
      if (r.status === 401) r = await post(message, true);                                  // the cached token went stale: get a new one once
      if (r.ok) return { ok: true };
      const j = await r.json().catch(() => ({})), code = j.error?.details?.find((d) => d.errorCode)?.errorCode ?? j.error?.status;
      if (r.status === 404 || code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT') return { ok: false, invalid: true };   // the app was uninstalled / the token is dead: forget it
      throw new Error(`FCM send failed: ${j.error?.message ?? r.status}`);
    },
  };
}

export function createPush(env = process.env) {
  const raw = env.FCM_SERVICE_ACCOUNT_JSON;
  if (raw) {
    let sa; try { sa = JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')); } catch { throw new Error('FCM_SERVICE_ACCOUNT_JSON is not valid JSON (or base64 of it)'); }
    if (!sa.project_id || !sa.client_email || !sa.private_key) throw new Error('FCM_SERVICE_ACCOUNT_JSON must contain project_id, client_email and private_key');
    return fcmPush({ serviceAccount: sa });
  }
  return mockPush();
}
