import { API_URL } from './config';
export const BASE = API_URL;
let TOKEN = null;   // in memory; src/session.js keeps a copy in the Keychain/Keystore
let onAuthLost = null;
export const setToken = (t) => { TOKEN = t; };
export const setAuthLostHandler = (fn) => { onAuthLost = fn; };   // called when the server says the login is no longer valid
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(TOKEN ? { authorization: 'Bearer ' + TOKEN } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (netErr) {
    throw new Error('Network request failed');
  }

  let json = {};
  try {
    json = await res.json();
  } catch {
    json = { error: res.statusText || 'Server error' };
  }

  // Only trigger logout if an authenticated session expired, not on invalid credentials during login/signup
  if (res.status === 401 && !path.startsWith('/auth/')) {
    setToken(null);
    onAuthLost?.();
  }

  if (!res.ok) throw new Error(json.error ?? 'Something went wrong');
  return json;
}

import { useEffect, useState, useCallback } from 'react';
/** Loading / error / data with retry — every data screen uses this so no screen is happy-path only. */
export function useApi(path, role = 'owner') {
  const [st, setSt] = useState({ loading: true, error: null, data: null });
  const load = useCallback(() => {
    setSt((s) => ({ ...s, loading: true, error: null }));
    api(path).then((data) => setSt({ loading: false, error: null, data }))
      .catch((e) => setSt({ loading: false, error: e.message === 'Network request failed' ? 'offline' : e.message, data: null }));
  }, [path]);
  useEffect(load, [load]);
  return { ...st, retry: load };
}
