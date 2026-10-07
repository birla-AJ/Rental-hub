import React from 'react';
import { useApi } from '../api';
import { Async, Kpi, Chip, inr } from '../components/ui';

// "What needs my attention?" for owners and agents on the web.
export function OwnerHome({ go }) {
  const st = useApi('/owner/dashboard');
  return (<><h1 className="h1">Dashboard</h1><p className="sub">PROPERTY → ROOM → TENANT → OCCUPIED / VACANT → PLACEMENT → COMMISSION</p>
    <Async state={st}>{(d) => { const wait = d.rooms.filter((r) => r.awaitingOwner); return (<>
      <div className="grid kpis">
        <Kpi label="Properties" value={d.spine.properties} /><Kpi label="Rooms" value={d.spine.rooms} /><Kpi label="Occupied" value={d.spine.occupied} tone="primary" />
        <Kpi label="Vacant" value={d.spine.vacant} tone="warning" /><Kpi label="In 7-day placement" value={d.spine.inPlacement} tone="warning" />
        <Kpi label="Potential commission" value={inr(d.commission.potential)} /><Kpi label="Commission due" value={inr(d.commission.due)} tone={d.commission.due ? 'warning' : undefined} />
        <Kpi label="Commission paid" value={inr(d.commission.paid)} tone="success" /><Kpi label="Commission waived" value={inr(d.commission.waived)} tone="primary" /></div>
      <h3 style={{ margin: '24px 0 8px' }}>Needs your attention</h3>
      {wait.length === 0 ? <div className="card empty">Nothing pending. We'll tell you when a tenant checks out.</div> : wait.map((r) => (
        <div key={r.id} className="card" style={{ marginBottom: 10, borderLeft: '4px solid var(--warning)' }}><Chip v="PENDING" /> <b style={{ marginLeft: 8 }}>{r.name}</b>
          <p style={{ margin: '6px 0 0', color: 'var(--text2)' }}>Tenant says they are moving out on {r.tenantCheckoutDate}. Please confirm in the RentalHub app (or reply to our WhatsApp message).</p></div>))}
      <p className="sub" style={{ marginTop: 16 }}>Placement window: if we place a new tenant within 7 days you pay 20% of one month's rent; after 7 days the commission is waived — it is not rent compensation.</p>
      <button className="btn out" onClick={() => go('vacancy')}>See vacant rooms</button></>); }}</Async></>);
}

export function AgentHome({ go }) {
  const st = useApi('/agent/dashboard');
  return (<><h1 className="h1">Dashboard</h1><p className="sub">Your verification work.</p>
    <Async state={st}>{(d) => { const next = d.tasks.filter((t) => ['PENDING', 'REVISIT'].includes(t.task)); return (<>
      <div className="grid kpis">{[['Assigned', d.counts.assigned], ['Pending', d.counts.pending], ['Verified', d.counts.verified], ['Rejected', d.counts.rejected], ['Revisit', d.counts.revisit], ['Completed', d.counts.completed]].map(([l, n]) => <Kpi key={l} label={l} value={n} />)}</div>
      <h3 style={{ margin: '24px 0 8px' }}>Next visits</h3>
      {next.length === 0 ? <div className="card empty">All caught up.</div> : next.map((t) => (
        <div key={t.id} className="card" style={{ marginBottom: 10 }}><b>{t.name}</b> <Chip v={t.task} /><p style={{ margin: '6px 0 0', color: 'var(--text2)' }}>{t.locality} · {t.rooms} room(s) · {t.visit}{t.note ? ` · ${t.note}` : ''}</p></div>))}
      <p className="sub" style={{ marginTop: 16 }}>Property verification (KYC check, whole-property location, QR tag on every room) is done in the RentalHub mobile app, on site.</p>
      <button className="btn out" onClick={() => go('properties')}>See assigned properties</button></>); }}</Async></>);
}
