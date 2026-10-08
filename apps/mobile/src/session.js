import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api, setToken, setAuthLostHandler } from './api';
import { saveToken, loadToken, clearToken } from './native/secureToken';
import { registerPush, unregisterPush } from './native/push';

const Ctx = createContext(null);
const EMPTY = { phone: '', role: null, roles: null, name: '', city: 'Indore', loggedIn: false };

// role: 'tenant' | 'agent' | 'owner'. City is scalable; Indore is the only active city for now.
export function SessionProvider({ children, onLoggedOut }) {
  const [s, setS] = useState({ ...EMPTY, restoring: true });
  const update = useCallback((p) => setS((x) => ({ ...x, ...p })), []);
  const loggedOutCb = useRef(onLoggedOut);
  loggedOutCb.current = onLoggedOut;

  const signIn = useCallback(async ({ token, user }) => {           // after OTP verification or a role switch
    setToken(token); await saveToken(token);
    setS((x) => ({ ...x, loggedIn: true, name: user.name, role: user.role, roles: user.roles }));
    registerPush();
  }, []);
  const logout = useCallback(async () => { await unregisterPush(); setToken(null); await clearToken(); setS({ ...EMPTY, restoring: false }); loggedOutCb.current?.(); }, []);

  useEffect(() => { setAuthLostHandler(() => { clearToken(); setS({ ...EMPTY, restoring: false }); loggedOutCb.current?.(); }); }, []);
  useEffect(() => {                                                    // restore a saved login when the app starts
    (async () => {
      const token = await loadToken();
      if (token) {
        setToken(token);
        try { const r = await api('/profile'); setS((x) => ({ ...x, loggedIn: true, name: r.user.name, role: r.user.role, roles: r.user.roles, restoring: false })); registerPush(); return; }
        catch (e) { if (e.message !== 'Network request failed') { setToken(null); await clearToken(); } }   // offline: stay on the login screen but keep the saved token
      }
      setS((x) => ({ ...x, restoring: false }));
    })();
  }, []);

  return <Ctx.Provider value={{ ...s, update, signIn, logout }}>{children}</Ctx.Provider>;
}
export const useSession = () => useContext(Ctx);
