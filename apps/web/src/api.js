import { useEffect, useState, useCallback } from 'react';
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
let TOKEN = null;                       // memory only (not localStorage) so XSS can't read a stored token; refresh = log in again
export const setToken = (t) => { TOKEN = t; };
export async function api(path, opts = {}) {
  const res = await fetch(BASE + path, { method: opts.method ?? 'GET', headers: { 'content-type': 'application/json', ...(TOKEN ? { authorization: 'Bearer ' + TOKEN } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const json = await res.json();
  if (res.status === 401) { setToken(null); window.dispatchEvent(new Event('rh-logout')); }
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json;
}
export function useApi(path) {
  const [s, setS] = useState({ loading: true, error: null, data: null });
  const load = useCallback(() => { setS((x) => ({ ...x, loading: true, error: null }));
    api(path).then((data) => setS({ loading: false, error: null, data })).catch((e) => setS({ loading: false, error: e.message === 'Failed to fetch' ? 'offline' : e.message, data: null })); }, [path]);
  useEffect(load, [load]);
  return { ...s, retry: load };
}

/** Download a protected file (e.g. an ID photo) with the login token and return a temporary browser URL for it. */
export async function apiBlobUrl(path) {
  const res = await fetch(BASE + path, { headers: TOKEN ? { authorization: 'Bearer ' + TOKEN } : {} });
  if (!res.ok) throw new Error(res.status === 404 ? 'This photo has been deleted (ID photos are removed 90 days after the decision).' : 'You do not have access to this photo');
  return URL.createObjectURL(await res.blob());
}
