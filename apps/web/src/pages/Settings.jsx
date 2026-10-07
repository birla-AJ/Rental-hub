import React from 'react';
import { useApi } from '../api';
import { Async, Chip } from '../components/ui';

const Row = ({ k, v }) => <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}><span style={{ color: 'var(--text2)' }}>{k}</span><b>{v}</b></div>;

export default function Settings() {
  const st = useApi('/admin/settings');
  return (<><h1 className="h1">Settings</h1><p className="sub">Business rules are locked and shown here for reference. Changing them needs a code change and client sign-off.</p>
    <Async state={st}>{({ rules, system }) => (<div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))' }}>
      <div className="card"><b>Business rules</b>
        <Row k="Owner commission (successful placement within window)" v={`${rules.commissionRate * 100}% of one month's rent`} />
        <Row k="Placement window" v={`${rules.placementWindowDays} days`} /><Row k="After the window" v="Commission waived (₹0) — no cash compensation" />
        <Row k="Registration cashback token" v={`${rules.registrationTokenRate * 100}% (deferred)`} />
        {rules.cashbackLadder.map((l) => <Row key={l.booking} k={`Booking ${l.booking}${l.booking === 4 ? ' onward' : ''}`} v={`${l.rate * 100}%${l.kind === 'token' ? ' (token)' : ''}`} />)}
        <Row k="Owner-found rooms covered by placement" v={system.ownerFoundRoomsCoveredByPlacement ? 'Yes' : 'No'} /><Row k="Repair coordination in base service" v={system.repairCoordinationIncluded ? 'Yes' : 'No (future add-on)'} /></div>
      <div className="card"><b>System</b>
        <Row k="Storage" v={<Chip v={system.storage === 'durable' ? 'ACTIVE' : 'PENDING'} />} /><Row k="WhatsApp provider" v={system.whatsapp} /><Row k="SMS provider" v={system.sms} /><Row k="Environment" v={system.environment} />
        {system.storage !== 'durable' ? <p className="err" style={{ textAlign: 'left', padding: '12px 0 0' }}>Memory-only storage: data is lost on restart.</p> : null}
        {system.whatsapp === 'mock' || system.sms === 'mock' ? <p className="sub" style={{ marginTop: 12 }}>“mock” means messages are recorded but not actually sent.</p> : null}</div>
    </div>)}</Async></>);
}
