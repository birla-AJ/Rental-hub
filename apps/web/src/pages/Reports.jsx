import React from 'react';
import { useApi } from '../api';
import { Async, Chip, inr } from '../components/ui';

import { toCsv } from '../csv';
function download(name, rows) { const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = name + '.csv'; a.click(); URL.revokeObjectURL(url); }

function Section({ title, sub, rows, money = [] }) {
  return (<div className="card" style={{ marginBottom: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><b>{title}</b>{sub ? <div className="sub" style={{ margin: 0 }}>{sub}</div> : null}</div>
      <button className="btn out" onClick={() => download(title.toLowerCase().replace(/\W+/g, '-'), rows)} disabled={!rows.length}>Download CSV</button></div>
    <div className="tablewrap"><table><thead><tr>{rows[0] ? Object.keys(rows[0]).map((k) => <th key={k}>{k.replace(/([A-Z])/g, ' $1').toUpperCase()}</th>) : null}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{Object.entries(r).map(([k, v]) => <td key={k}>{money.includes(k) ? inr(v) : v ?? '—'}</td>)}</tr>)}</tbody></table></div></div>);
}

export default function Reports() {
  const st = useApi('/admin/reports');
  return (<><h1 className="h1">Reports</h1><p className="sub">Computed from live data — nothing here is a sample.</p>
    <Async state={st}>{(r) => (<>
      <Section title="Registration funnel" sub={`Owner conversion: ${r.ownerConversion.agreed} of ${r.ownerConversion.registered} (${r.ownerConversion.rate})`} rows={r.funnel} />
      <Section title="Agent performance" rows={r.agents} />
      <Section title="Placements" sub="Placed within 7 days = 20% of one month's rent; later = waived (₹0)." rows={[{ placed: r.placements.placed, within7Days: r.placements.within7Days, successRate: r.placements.successRate, avgDaysVacantBeforePlacement: r.placements.avgDaysVacantBeforePlacement ?? '—' }]} />
      <Section title="Commission" rows={r.commission} money={['amount']} />
      <Section title="Cashback" sub="Liability = dormant + eligible tokens." rows={r.cashback} money={['amount']} />
      <Section title="Bookings" rows={r.bookings} />
      <Section title="Checkouts" rows={[{ total: r.checkouts.total, verified: r.checkouts.verified, manualReview: r.checkouts.manualReview, disputed: r.checkouts.disputed, avgHoursToVerify: r.checkouts.avgHoursToVerify ?? '—' }]} />
      <p className="sub">Generated {new Date(r.generatedAt).toLocaleString('en-IN')}</p></>)}</Async></>);
}
