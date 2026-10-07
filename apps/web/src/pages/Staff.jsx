import React, { useState } from 'react';
import { api } from '../api';
import TablePage from './TablePage';
import { PAGES } from '../nav';

// Add an admin or agent (they then sign in with an SMS code on their own phone), plus the staff list with deactivate / reactivate.
export default function Staff({ role, search }) {
  const [f, setF] = useState({ name: '', phone: '', role: 'agent' }), [err, setErr] = useState(null), [busy, setBusy] = useState(false), [n, setN] = useState(0), [ok, setOk] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: k === 'phone' ? e.target.value.replace(/\D/g, '') : e.target.value });
  const add = async () => { setBusy(true); setErr(null); setOk(null);
    try { const r = await api('/staff', { method: 'POST', body: f }); setOk(`${r.staff.name} can now sign in with ${r.staff.phone}.`); setF({ name: '', phone: '', role: 'agent' }); setN(n + 1); }
    catch (e) { setErr(e.message); } finally { setBusy(false); } };
  return (<>
    <div className="card" style={{ marginBottom: 16 }}>
      <b>Add staff</b>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        <input className="field" style={{ flex: '2 1 180px' }} placeholder="Full name" value={f.name} onChange={set('name')} />
        <input className="field" style={{ flex: '1 1 150px' }} placeholder="10-digit mobile" maxLength={10} value={f.phone} onChange={set('phone')} />
        <select className="field" style={{ flex: '1 1 110px' }} value={f.role} onChange={set('role')}><option value="agent">Agent</option><option value="admin">Admin</option></select>
        <button className="btn" disabled={busy || f.name.trim().length < 2 || !/^[6-9]\d{9}$/.test(f.phone)} onClick={add}>Add</button></div>
      {err ? <p style={{ color: 'var(--error)' }}>{err}</p> : null}{ok ? <p style={{ color: 'var(--success)' }}>{ok}</p> : null}
    </div>
    <TablePage key={n} role={role} cfg={PAGES.staff} search={search} /></>);
}
