import React, { useMemo, useState, useEffect } from 'react';
import { api, apiBlobUrl } from '../api';

export const inr = (n) => '₹' + Number(n ?? 0).toLocaleString('en-IN');
const TONE = { VERIFIED: 'success', OCCUPIED: 'primary', PLACED: 'success', PAID: 'success', ACTIVE: 'success', ELIGIBLE: 'success', DORMANT: 'info', REDEEMED: 'disabled',
  PENDING: 'warning', PENDING_VERIFICATION: 'warning', DUE: 'warning', VACANT: 'warning', REJECTED: 'error', DISPUTED: 'error', MANUAL_REVIEW: 'error', WAIVED: 'primary', EXPIRED: 'primary', REVISIT: 'info', AVAILABLE: 'disabled' };
export function Chip({ v }) {
  const c = `var(--${TONE[String(v)] ?? 'secondary'})`;
  return <span className="chip" style={{ background: `color-mix(in srgb, ${c} 15%, white)`, color: c }}>{String(v).replace(/_/g, ' ')}</span>;
}
/** ID photo viewer: the image is fetched with the login token (a plain <img> could not), and shown only while the drawer is open. */
export function PrivateImage({ path }) {
  const [url, setUrl] = useState(null), [err, setErr] = useState(null), [show, setShow] = useState(false);
  useEffect(() => { if (!show) return; let u; apiBlobUrl(path).then((x) => { u = x; setUrl(x); }).catch((e) => setErr(e.message)); return () => { if (u) URL.revokeObjectURL(u); }; }, [show, path]);
  if (!show) return <button className="btn out" onClick={() => setShow(true)}>View ID photo</button>;
  return err ? <span style={{ color: 'var(--error)' }}>{err}</span> : url ? <img src={url} alt="ID" style={{ maxWidth: '100%', borderRadius: 12, border: '1px solid var(--border)' }} /> : <span>Loading…</span>;
}
export const Kpi = ({ label, value, tone }) => <div className="card kpi"><div className="l">{label}</div><div className="v" style={tone ? { color: `var(--${tone})` } : null}>{value}</div></div>;

export function Async({ state, children }) {
  if (state.loading) return <div className="empty">Loading…</div>;
  if (state.error === 'offline') return <div className="err">No connection to the server. <button className="btn out" onClick={state.retry}>Retry</button></div>;
  if (state.error) return <div className="err">{state.error} <button className="btn out" onClick={state.retry}>Retry</button></div>;
  return children(state.data);
}

/** Generic searchable table with row drawer. money: keys formatted as ₹. */
export function DataTable({ rows, money = [], chips = [], search = '', empty = 'Nothing here yet.', actions = [], onChanged }) {
  const [open, setOpen] = useState(null);
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState(null);
  const [choices, setChoices] = useState({}), [pick, setPick] = useState('');
  useEffect(() => {   // load pick-lists (e.g. agents) the first time a row with such an action is opened
    if (!open) return; setPick('');
    for (const a of actions) if (a.choicesPath && a.when(open) && !choices[a.choicesPath]) api(a.choicesPath).then((r) => setChoices((c) => ({ ...c, [a.choicesPath]: r.rows }))).catch(() => {});
  }, [open]);
  const act = async (a) => {
    if (a.reason && !reason.trim()) { setErr('Please add a reason'); return; }
    if (a.choicesPath && !pick) { setErr('Please choose one'); return; }
    setBusy(true); setErr(null);
    try { await api(a.path(open), { method: 'POST', body: a.body ? a.body(reason, pick) : a.reason ? { reason } : {} }); setOpen(null); setReason(''); onChanged?.(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const q = search.trim().toLowerCase();
  const list = useMemo(() => (q ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q)) : rows), [rows, q]);
  if (!rows.length) return <div className="card empty">{empty}</div>;
  const cols = Object.keys(rows[0]).filter((c) => c !== 'docRef');
  const fmt = (k, v) => (money.includes(k) ? inr(v) : chips.includes(k) ? <Chip v={v} /> : v ?? '—');
  return (<>
    <div className="card tablewrap"><table><thead><tr>{cols.map((c) => <th key={c}>{c.replace(/([A-Z])/g, ' $1').toUpperCase()}</th>)}</tr></thead>
      <tbody>{list.map((r, i) => <tr key={r.id ?? i} className="row" onClick={() => setOpen(r)}>{cols.map((c) => <td key={c}>{fmt(c, r[c])}</td>)}</tr>)}</tbody></table>
      {!list.length ? <div className="empty">No results for “{search}”.</div> : null}</div>
    {open ? <div className="drawer"><button className="btn out" onClick={() => { setOpen(null); setErr(null); setReason(''); }}>Close</button>
      <h3>Details</h3>{Object.entries(open).map(([k, v]) => <p key={k}><b style={{ color: 'var(--text2)', fontSize: 12 }}>{k.toUpperCase()}</b><br />{k === 'docRef' && String(v).startsWith('/private/') ? <PrivateImage key={v} path={v} /> : fmt(k, v)}</p>)}
      {actions.filter((a) => a.when(open)).length ? <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <b>Actions</b>
        {actions.some((a) => a.reason && a.when(open)) ? <input className="field" style={{ margin: '8px 0' }} placeholder="Reason (needed to reject)" value={reason} onChange={(e) => setReason(e.target.value)} /> : null}
        {actions.filter((a) => a.choicesPath && a.when(open)).map((a) => <select key={a.choicesPath} className="field" style={{ margin: '8px 0' }} value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Choose…</option>{(choices[a.choicesPath] ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>)}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>{actions.filter((a) => a.when(open)).map((a) => <button key={a.label} className={'btn' + (a.reason ? ' out' : '')} disabled={busy} onClick={() => act(a)}>{a.label}</button>)}</div>
        {err ? <p style={{ color: 'var(--error)' }}>{err}</p> : null}</div> : null}
    </div> : null}
  </>);
}

/* ---- tiny SVG charts (no dependency) ---- */
const W = 320, H = 150, P = 24;
export function LineChart({ labels, data, color = 'var(--primary)', money }) {
  const max = Math.max(...data, 1), x = (i) => P + (i * (W - 2 * P)) / (data.length - 1), y = (v) => H - P - (v / max) * (H - 2 * P);
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  return <svg viewBox={`0 0 ${W} ${H}`} width="100%"><path d={`${d} L${x(data.length - 1)},${H - P} L${x(0)},${H - P}Z`} fill={color} opacity=".1" /><path d={d} fill="none" stroke={color} strokeWidth="2.5" />
    {data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill={color}><title>{money ? inr(v) : v}</title></circle>)}
    {labels.map((l, i) => <text key={l} x={x(i)} y={H - 6} fontSize="9" textAnchor="middle" fill="var(--text2)">{l}</text>)}</svg>;
}
export function BarChart({ labels, data, color = 'var(--secondary)' }) {
  const max = Math.max(...data, 1), bw = (W - 2 * P) / data.length;
  return <svg viewBox={`0 0 ${W} ${H}`} width="100%">{data.map((v, i) => { const h = (v / max) * (H - 2 * P); return <g key={i}>
    <rect x={P + i * bw + 6} y={H - P - h} width={bw - 12} height={h} rx="6" fill={color}><title>{v}</title></rect>
    <text x={P + i * bw + bw / 2} y={H - 6} fontSize="9" textAnchor="middle" fill="var(--text2)">{labels[i]}</text></g>; })}</svg>;
}
export function Donut({ parts }) { // parts: [{label, value, color}]
  const total = parts.reduce((a, p) => a + p.value, 0) || 1; let acc = 0; const R = 50, C = 2 * Math.PI * R;
  return <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}><svg viewBox="0 0 140 140" width="140">
    {parts.map((p) => { const len = (p.value / total) * C, el = <circle key={p.label} cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth="22" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform="rotate(-90 70 70)" />; acc += len; return el; })}
    <text x="70" y="75" textAnchor="middle" fontWeight="800" fontSize="18" fill="var(--text)">{total}</text></svg>
    <div>{parts.map((p) => <div key={p.label} style={{ fontSize: 13, margin: '4px 0' }}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: p.color, marginRight: 6 }} />{p.label}: <b>{p.value}</b></div>)}</div></div>;
}
export const ChartCard = ({ title, empty, children }) => <div className="card"><div style={{ fontWeight: 700, marginBottom: 8 }}>{title}<span className="badge">Live</span></div>{empty ? <div className="empty" style={{ padding: 28 }}>No activity in the last 6 weeks yet.</div> : children}</div>;
