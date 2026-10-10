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
  const [tab, setTab] = useState('login'); // 'login' | 'signup'

  // Login form state
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Signup form state
  const [signupRole, setSignupRole] = useState('tenant'); // 'tenant' | 'owner'
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [city, setCity] = useState('Indore');
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Common state
  const [step, setStep] = useState('form'); // 'form' | 'role'
  const [user, setUser] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true); setErr(null);
    try { await fn(); }
    catch (e) { setErr(e.message === 'Failed to fetch' ? 'Cannot connect to the server. Please check your connection.' : e.message); }
    finally { setBusy(false); }
  };

  const login = () => run(async () => {
    const r = await api('/auth/login', { method: 'POST', body: { loginId, password } });
    setToken(r.token);
    const availableRoles = r.user.roles ?? [r.user.role];
    if (availableRoles.length === 1) {
      onLogin(availableRoles[0]);
    } else {
      setUser(r.user);
      setStep('role');
    }
  });

  const signup = () => run(async () => {
    if (!fullName.trim()) throw new Error('Please enter your full name');
    if (!/^[6-9]\d{9}$/.test(phone.trim())) throw new Error('Please enter a valid 10-digit Indian mobile number');
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) throw new Error('Please enter a valid email address');
    if (signupPassword.length < 6) throw new Error('Password must be at least 6 characters');
    if (signupPassword !== confirmPassword) throw new Error('Passwords do not match');
    if (!agreeTerms) throw new Error('Please agree to the Terms of Service and Privacy Policy');

    const r = await api('/auth/register', {
      method: 'POST',
      body: {
        name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        password: signupPassword,
        role: signupRole,
        city: city || 'Indore',
      }
    });

    setToken(r.token);
    onLogin(r.user.role || signupRole);
  });

  const pick = (role) => run(async () => {
    const r = await api('/auth/switch', { method: 'POST', body: { role } });
    setToken(r.token);
    onLogin(role);
  });

  return (
    <div className="login-page">
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />
      <div className="login-bg-orb login-bg-orb-3" />
      <div className="login-bg-grid" />

      <div className="login-card" style={{ maxWidth: 440 }}>
        <div className="login-brand-row">
          <div className="login-brand-icon">
            <Icon name="home" size={22} strokeWidth={2.2} />
          </div>
          <span className="login-brand-text">RentalHub</span>
          <span className="login-badge">Portal</span>
        </div>

        {/* Tab Switcher */}
        {step === 'form' && (
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.04)', borderRadius: 12, padding: 4, marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => { setTab('login'); setErr(null); }}
              style={{
                flex: 1, padding: '9px 0', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                background: tab === 'login' ? '#fff' : 'transparent', color: tab === 'login' ? '#0d9488' : '#64748b',
                boxShadow: tab === 'login' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setTab('signup'); setErr(null); }}
              style={{
                flex: 1, padding: '9px 0', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                background: tab === 'signup' ? '#fff' : 'transparent', color: tab === 'signup' ? '#0d9488' : '#64748b',
                boxShadow: tab === 'signup' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              Create Account
            </button>
          </div>
        )}

        <h1 className="login-title">{tab === 'login' ? 'Welcome back' : 'Join RentalHub'}</h1>
        <p className="login-desc">
          {tab === 'login'
            ? 'Enter your credentials to access your account'
            : 'Register in seconds to discover or list rental homes'}
        </p>

        {err ? <div className="login-err">{err}</div> : null}

        {step === 'form' && tab === 'login' && (
          <form onSubmit={(e) => { e.preventDefault(); login(); }}>
            <div className="login-field-group">
              <label className="login-label">Login Identifier</label>
              <div className="login-input-wrap">
                <span className="login-input-icon"><Icon name="user" size={17} /></span>
                <input
                  className="login-input"
                  placeholder="Mobile number, email, or user ID"
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
              {busy ? <span className="login-spinner" /> : <><span>Sign In</span><Icon name="arrow-right" size={16} strokeWidth={2.4} /></>}
            </button>
          </form>
        )}

        {step === 'form' && tab === 'signup' && (
          <form onSubmit={(e) => { e.preventDefault(); signup(); }}>
            {/* Account Type Selector */}
            <div style={{ marginBottom: 14 }}>
              <label className="login-label">I want to register as:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setSignupRole('tenant')}
                  style={{
                    padding: '10px 8px', borderRadius: 10, border: signupRole === 'tenant' ? '2px solid #0d9488' : '1px solid #cbd5e1',
                    background: signupRole === 'tenant' ? '#f0fdfa' : '#fff', cursor: 'pointer', textAlign: 'center',
                    fontWeight: 700, color: signupRole === 'tenant' ? '#0f766e' : '#475569', fontSize: 13
                  }}
                >
                  🧑‍💼 Tenant
                </button>
                <button
                  type="button"
                  onClick={() => setSignupRole('owner')}
                  style={{
                    padding: '10px 8px', borderRadius: 10, border: signupRole === 'owner' ? '2px solid #0d9488' : '1px solid #cbd5e1',
                    background: signupRole === 'owner' ? '#f0fdfa' : '#fff', cursor: 'pointer', textAlign: 'center',
                    fontWeight: 700, color: signupRole === 'owner' ? '#0f766e' : '#475569', fontSize: 13
                  }}
                >
                  🏢 Property Owner
                </button>
              </div>
            </div>

            <div className="login-field-group">
              <label className="login-label">Full Name</label>
              <div className="login-input-wrap">
                <input
                  className="login-input"
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="login-field-group">
              <label className="login-label">Mobile Number (10 digits)</label>
              <div className="login-input-wrap">
                <input
                  className="login-input"
                  placeholder="e.g. 9826012345"
                  value={phone}
                  maxLength={10}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="login-field-group">
              <label className="login-label">Email Address (Optional)</label>
              <div className="login-input-wrap">
                <input
                  className="login-input"
                  type="email"
                  placeholder="e.g. rahul@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="login-field-group">
              <label className="login-label">Password (Min. 6 chars)</label>
              <div className="login-input-wrap">
                <input
                  className="login-input"
                  type="password"
                  placeholder="Create a secure password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="login-field-group">
              <label className="login-label">Confirm Password</label>
              <div className="login-input-wrap">
                <input
                  className="login-input"
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input
                type="checkbox"
                id="terms"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                style={{ cursor: 'pointer', width: 16, height: 16 }}
              />
              <label htmlFor="terms" style={{ fontSize: 12, color: '#64748b', cursor: 'pointer' }}>
                I agree to RentalHub Terms of Service and Privacy Policy
              </label>
            </div>

            <button
              type="submit"
              className="login-btn"
              disabled={busy || !fullName.trim() || !phone.trim() || !signupPassword}
            >
              {busy ? <span className="login-spinner" /> : <><span>Create {signupRole === 'tenant' ? 'Tenant' : 'Owner'} Account</span><Icon name="arrow-right" size={16} strokeWidth={2.4} /></>}
            </button>
          </form>
        )}

        {step === 'role' && user && (
          <div>
            <p className="login-desc" style={{ marginBottom: 14 }}>Select a role to continue:</p>
            {user.roles.map((r) => (
              <button key={r} className="rolebtn" onClick={() => pick(r)} style={{ marginBottom: 8 }}>
                <b style={{ textTransform: 'capitalize' }}>{r}</b>
              </button>
            ))}
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

  useEffect(() => {
    const f = () => setRole(null);
    window.addEventListener('rh-logout', f);
    return () => window.removeEventListener('rh-logout', f);
  }, []);

  if (!role || !NAV[role]) {
    return <Login onLogin={(r) => { setRole(r.toLowerCase()); setPage(r === 'tenant' ? 'browse' : 'dashboard'); }} />;
  }

  const navItems = NAV[role] ?? [];
  const go = (p) => { setPage(p); setSearch(''); };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <i><Icon name="home" size={19} /></i>
          <span>RentalHub</span>
        </div>
        {navItems.map(([id, label, ic]) => (
          <button key={id} className={'nav' + (page === id ? ' on' : '')} onClick={() => go(id)}>
            <Icon name={ic} />
            <span className="lbl">{label}</span>
          </button>
        ))}
      </aside>

      <div className="main">
        <header className="top">
          <input placeholder="Search this page…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ color: 'var(--text2)' }}>Indore</span>
            <b style={{ textTransform: 'capitalize' }}>{role}</b>
            <button className="btn out" onClick={() => { setToken(null); setRole(null); }}>Sign out</button>
          </div>
        </header>

        <div className="content">
          {page === 'dashboard' ? (
            role === 'admin' ? <Dashboard role={role} /> :
            role === 'owner' ? <OwnerHome go={go} /> :
            role === 'agent' ? <AgentHome go={go} /> :
            <TablePage key={page + role} role={role} cfg={PAGES.browse} search={search} />
          )
            : page === 'reports' && role === 'admin' ? <Reports />
            : page === 'settings' && role === 'admin' ? <Settings />
            : page === 'staff' && role === 'admin' ? <Staff role={role} search={search} />
            : <TablePage key={page + role} role={role} cfg={PAGES[page] ?? PAGES.browse} search={search} />}
        </div>
      </div>
    </div>
  );
}
