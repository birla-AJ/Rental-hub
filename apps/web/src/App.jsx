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
  const [step, setStep] = useState('phone'); // phone -> otp -> role
  const [phone, setPhone] = useState(''), [code, setCode] = useState(''), [dev, setDev] = useState(null), [user, setUser] = useState(null);
  const [err, setErr] = useState(null), [busy, setBusy] = useState(false);
  const run = async (fn) => { setBusy(true); setErr(null); try { await fn(); } catch (e) { setErr(e.message === 'Failed to fetch' ? 'No connection to the server' : e.message); } finally { setBusy(false); } };
  const send = () => run(async () => { const r = await api('/auth/otp', { method: 'POST', body: { phone } }); setDev(r.devCode ?? null); setStep('otp'); });
  const verify = () => run(async () => {
    const r = await api('/auth/verify', { method: 'POST', body: { phone, code } }); setToken(r.token);
    if (r.user.roles.length === 1) onLogin(r.user.role); else { setUser(r.user); setStep('role'); }
  });
  const pick = (role) => run(async () => { const r = await api('/auth/switch', { method: 'POST', body: { role } }); setToken(r.token); onLogin(role); });
  const WEB_ROLES = ['admin', 'agent', 'owner'];  // tenants use the mobile app
  return (<div className="login"><div className="card"><div className="brand"><i><Icon name="home" size={19} /></i>RentalHub</div>
    <h2 style={{ margin: '8px 0 2px' }}>Sign in</h2>
    {step === 'phone' && <><p className="sub">Enter your mobile number to get a code.</p>
      <input className="field" placeholder="10-digit mobile number" value={phone} maxLength={10} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
      <button className="btn" style={{ width: '100%', marginTop: 12 }} disabled={busy || !/^[6-9]\d{9}$/.test(phone)} onClick={send}>Continue</button></>}
    {step === 'otp' && <><p className="sub">Code sent to +91 {phone}{dev ? ` (dev code: ${dev})` : ''}</p>
      <input className="field" placeholder="6-digit code" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
      <button className="btn" style={{ width: '100%', marginTop: 12 }} disabled={busy || code.length !== 6} onClick={verify}>Verify</button></>}
    {step === 'role' && <><p className="sub">Continue as</p>{user.roles.filter((r) => WEB_ROLES.includes(r)).map((r) => <button key={r} className="rolebtn" onClick={() => pick(r)}><b style={{ textTransform: 'capitalize' }}>{r}</b></button>)}
      {!user.roles.some((r) => WEB_ROLES.includes(r)) ? <p className="err">This account is for the mobile app.</p> : null}</>}
    {err ? <p style={{ color: 'var(--error)', marginTop: 10 }}>{err}</p> : null}
  </div></div>);
}

export default function App() {
  const [role, setRole] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [search, setSearch] = useState('');
  useEffect(() => { const f = () => setRole(null); window.addEventListener('rh-logout', f); return () => window.removeEventListener('rh-logout', f); }, []); // session expired
  if (!role) return <Login onLogin={(r) => { setRole(r); setPage('dashboard'); }} />;
  const go = (p) => { setPage(p); setSearch(''); };
  return (<div className="app">
    <aside className="sidebar"><div className="brand"><i><Icon name="home" size={19} /></i><span>RentalHub</span></div>
      {NAV[role].map(([id, label, ic]) => <button key={id} className={'nav' + (page === id ? ' on' : '')} onClick={() => go(id)}><Icon name={ic} /><span className="lbl">{label}</span></button>)}</aside>
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
