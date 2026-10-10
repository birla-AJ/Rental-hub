import React, { useState, useEffect } from 'react';
import { api, setToken } from './api';
import './styles.css';
import { NAV, PAGES } from './nav';
import Dashboard from './pages/Dashboard';
import TablePage from './pages/TablePage';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Staff from './pages/Staff';
import { AgentHome, OwnerHome } from './pages/RoleHome';
import Icon from './components/Icon';

function Login({ onLogin }) {
  /*
  // ==========================================
  // [OLD CODE] NUMBER & OTP LOGIN LOGIC
  // ==========================================
  const [step, setStep] = useState('phone'); // phone -> otp -> role
  const [phone, setPhone] = useState(''), [code, setCode] = useState(''), [dev, setDev] = useState(null);
  const send = () => run(async () => { const r = await api('/auth/otp', { method: 'POST', body: { phone } }); setDev(r.devCode ?? null); setStep('otp'); });
  const verify = () => run(async () => {
    const r = await api('/auth/verify', { method: 'POST', body: { phone, code } }); setToken(r.token);
    if (r.user.roles.length === 1) onLogin(r.user.role); else { setUser(r.user); setStep('role'); }
  });
  // ==========================================
  */

  // ==========================================
  // [NEW CODE] ID & PASSWORD LOGIN LOGIC
  // ==========================================
  const [step, setStep] = useState('credentials'); // credentials -> role
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [user, setUser] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true); setErr(null);
    try { await fn(); }
    catch (e) { setErr(e.message === 'Failed to fetch' ? 'No connection to the server' : e.message); }
    finally { setBusy(false); }
  };

  const login = () => run(async () => {
    const r = await api('/auth/login', { method: 'POST', body: { loginId, password } });
    setToken(r.token);
    const webRoles = (r.user.roles ?? [r.user.role]).filter((rl) => WEB_ROLES.includes(rl));
    if (webRoles.length === 0) {
      setToken(null);
      throw new Error(`Account '${r.user.name}' (${r.user.role}) is for the mobile app only. Please log in with an Admin, Agent, or Owner account on web.`);
    }
    if (webRoles.length === 1) {
      if (r.user.role !== webRoles[0]) {
        const sw = await api('/auth/switch', { method: 'POST', body: { role: webRoles[0] } });
        setToken(sw.token);
      }
      onLogin(webRoles[0]);
    } else {
      setUser(r.user);
      setStep('role');
    }
  });

  const pick = (role) => run(async () => {
    const r = await api('/auth/switch', { method: 'POST', body: { role } });
    setToken(r.token);
    onLogin(role);
  });

  const WEB_ROLES = ['admin', 'agent', 'owner'];  // tenants use the mobile app

  return (
    <div className="login-page">
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />
      <div className="login-bg-orb login-bg-orb-3" />
      <div className="login-bg-grid" />

      {/*
      // ==========================================
      // [OLD CODE] NUMBER & OTP UI (COMMENTED OUT)
      // ==========================================
      {step === 'phone' && <div className="card"><p className="sub">Enter your mobile number</p><input value={phone} onChange={(e) => setPhone(e.target.value)} /><button onClick={send}>Continue</button></div>}
      {step === 'otp' && <div className="card"><input value={code} onChange={(e) => setCode(e.target.value)} /><button onClick={verify}>Verify</button></div>}
      // ==========================================
      */}

      <div className="login-card">
        <div className="login-brand-row">
          <div className="login-brand-icon">
            <Icon name="home" size={22} strokeWidth={2.2} />
          </div>
          <span className="login-brand-text">RentalHub</span>
          <span className="login-badge">Portal</span>
        </div>

        <h1 className="login-title">Welcome back</h1>
        <p className="login-desc">Please enter your credentials to access your account</p>

        {err ? <div className="login-err">{err}</div> : null}

        {step === 'credentials' && (
          <form onSubmit={(e) => { e.preventDefault(); login(); }}>
            <div className="login-field-group">
              <label className="login-label">Login ID</label>
              <div className="login-input-wrap">
                <span className="login-input-icon"><Icon name="user" size={17} /></span>
                <input
                  className="login-input"
                  placeholder="Username, phone, or email"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="login-field-group">
              <label className="login-label">Password</label>
              <div className="login-input-wrap">
                <span className="login-input-icon"><Icon name="lock" size={17} /></span>
                <input
                  className="login-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="login-toggle-pw"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <Icon name={showPassword ? "eye-off" : "eye"} size={17} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-btn"
              disabled={busy || !loginId.trim() || !password}
            >
              {busy ? (
                <span className="login-spinner" />
              ) : (
                <>
                  <span>Sign in</span>
                  <Icon name="arrow-right" size={16} strokeWidth={2.4} />
                </>
              )}
            </button>
          </form>
        )}

        {step === 'role' && user && (
          <div>
            <p className="login-desc" style={{ marginBottom: 14 }}>Select a role to continue:</p>
            {user.roles.filter((r) => WEB_ROLES.includes(r)).map((r) => (
              <button key={r} className="rolebtn" onClick={() => pick(r)}>
                <b style={{ textTransform: 'capitalize' }}>{r}</b>
              </button>
            ))}
            {!user.roles.some((r) => WEB_ROLES.includes(r)) ? (
              <p className="err">This account is for the mobile app.</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [search, setSearch] = useState('');
  useEffect(() => { const f = () => setRole(null); window.addEventListener('rh-logout', f); return () => window.removeEventListener('rh-logout', f); }, []); // session expired
  if (!role || !NAV[role]) return <Login onLogin={(r) => { setRole(r); setPage('dashboard'); }} />;
  const navItems = NAV[role] ?? [];
  const go = (p) => { setPage(p); setSearch(''); };
  return (<div className="app">
    <aside className="sidebar"><div className="brand"><i><Icon name="home" size={19} /></i><span>RentalHub</span></div>
      {navItems.map(([id, label, ic]) => <button key={id} className={'nav' + (page === id ? ' on' : '')} onClick={() => go(id)}><Icon name={ic} /><span className="lbl">{label}</span></button>)}</aside>
    <div className="main">
      <header className="top"><input placeholder="Search this page…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><span style={{ color: 'var(--text2)' }}>Indore</span><b style={{ textTransform: 'capitalize' }}>{role}</b>
          <button className="btn out" onClick={() => { setToken(null); setRole(null); }}>Sign out</button></div></header>
      <div className="content">
        {page === 'dashboard' ? (role === 'admin' ? <Dashboard role={role} /> : role === 'owner' ? <OwnerHome go={go} /> : <AgentHome go={go} />)
          : page === 'reports' && role === 'admin' ? <Reports /> : page === 'settings' && role === 'admin' ? <Settings />
          : page === 'staff' && role === 'admin' ? <Staff role={role} search={search} />
          : <TablePage key={page + role} role={role} cfg={PAGES[page]} search={search} />}
      </div></div></div>);
}
