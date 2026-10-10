// Zero-dependency Firebase Cloud Messaging (FCM HTTP v1) sender using OAuth2 service account.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

let serviceAccount = null;
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? path.resolve(process.cwd(), 'apps/api/service-account.json');
const altPath = path.resolve(process.cwd(), 'service-account.json');

try {
  const p = fs.existsSync(credPath) ? credPath : (fs.existsSync(altPath) ? altPath : null);
  if (p) {
    serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
} catch (e) {
  console.warn('[fcm] Could not load service account:', e.message);
}

let cachedToken = null;
let tokenExpiresAt = 0;

/** Obtain Google OAuth2 access token for FCM HTTP v1 */
async function getAccessToken() {
  if (!serviceAccount) return null;
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < tokenExpiresAt - 60) return cachedToken;

  try {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })).toString('base64url');

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(serviceAccount.private_key, 'base64url');
    const jwt = `${header}.${payload}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[fcm] OAuth2 token error:', res.status, errText);
      return null;
    }

    const data = await res.json();
    cachedToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in ?? 3600);
    return cachedToken;
  } catch (e) {
    console.error('[fcm] Token exchange failed:', e.message);
    return null;
  }
}

/**
 * Send an FCM push notification to one or multiple device tokens
 * @param {string|string[]} fcmTokens
 * @param {{ title: string, body: string, data?: object }} content
 */
export async function sendPushNotification(fcmTokens, { title, body, data = {} }) {
  if (!serviceAccount) return { ok: false, skipped: true };
  const tokens = (Array.isArray(fcmTokens) ? fcmTokens : [fcmTokens]).filter(Boolean);
  if (tokens.length === 0) return { ok: false, skipped: true };

  const accessToken = await getAccessToken();
  if (!accessToken) return { ok: false, error: 'no_access_token' };

  const url = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
  const results = await Promise.all(tokens.map(async (token) => {
    try {
      const message = {
        message: {
          token,
          notification: { title, body },
          data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channel_id: 'default',
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              },
            },
          },
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      return { token, ok: res.ok };
    } catch (e) {
      return { token, ok: false, error: e.message };
    }
  }));

  return { ok: true, results };
}

export const isFcmConfigured = () => !!serviceAccount;

