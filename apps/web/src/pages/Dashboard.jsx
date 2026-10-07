import React from 'react';
import { useApi } from '../api';
import { Async, Kpi, inr, LineChart, BarChart, Donut, ChartCard } from '../components/ui';

const has = (a) => a.some((v) => v > 0);

export default function Dashboard({ role }) {
  const st = useApi('/admin/overview');
  return (<><h1 className="h1">Dashboard</h1><p className="sub">What needs attention across Indore today.</p>
    <Async state={st}>{({ kpis: k, occupancy: o, series: s }) => (<>
      <div className="grid kpis">
        <Kpi label="Total properties" value={k.totalProperties} /><Kpi label="Verified properties" value={k.verifiedProperties} tone="success" />
        <Kpi label="Pending verification" value={k.pendingVerification} tone="warning" /><Kpi label="Occupied rooms" value={k.occupiedRooms} tone="primary" />
        <Kpi label="Vacant rooms" value={k.vacantRooms} tone="warning" /><Kpi label="Active tenancies" value={k.activeTenancies} />
        <Kpi label="Active bookings" value={k.activeBookings} /><Kpi label="Successful placements" value={k.successfulPlacements} tone="success" />
        <Kpi label="Pending placements" value={k.pendingPlacements} tone="warning" /><Kpi label="Cashback liability" value={inr(k.cashbackLiability)} />
        <Kpi label="Cashback redeemed" value={inr(k.cashbackRedeemed)} /><Kpi label="Commission earned" value={inr(k.commissionEarned)} tone="success" />
        <Kpi label="Commission waived" value={inr(k.commissionWaived)} tone="primary" />
      </div>
      <div className="grid charts">
        <ChartCard title="Occupancy"><Donut parts={[{ label: 'Occupied', value: o.occupied, color: 'var(--primary)' }, { label: 'Vacant', value: o.vacant, color: 'var(--warning)' }, { label: 'Other', value: o.other, color: 'var(--accent)' }]} /></ChartCard>
        <ChartCard title="Property growth (total)" empty={!has(s.propertyGrowth)}><LineChart labels={s.labels} data={s.propertyGrowth} /></ChartCard>
        <ChartCard title="Properties verified per week" empty={!has(s.verificationTrend)}><LineChart labels={s.labels} data={s.verificationTrend} color="var(--secondary)" /></ChartCard>
        <ChartCard title="Vacancies verified per week" empty={!has(s.vacancy)}><BarChart labels={s.labels} data={s.vacancy} color="var(--warning)" /></ChartCard>
        <ChartCard title="Bookings per week" empty={!has(s.bookingTrend)}><LineChart labels={s.labels} data={s.bookingTrend} /></ChartCard>
        <ChartCard title="Placements within 7 days (%)" empty={!has(s.placementSuccess)}><LineChart labels={s.labels} data={s.placementSuccess} color="var(--success)" /></ChartCard>
        <ChartCard title="Cashback redeemed (₹) per week" empty={!has(s.cashbackUsage)}><BarChart labels={s.labels} data={s.cashbackUsage} /></ChartCard>
        <ChartCard title="Commission paid (₹) per week" empty={!has(s.commissionRevenue)}><LineChart labels={s.labels} data={s.commissionRevenue} money /></ChartCard>
        <ChartCard title="Agent performance (verified)" empty={!has(s.agentPerformance.map((a) => a.verified))}><BarChart labels={s.agentPerformance.map((a) => a.name)} data={s.agentPerformance.map((a) => a.verified)} color="var(--primary-light)" /></ChartCard>
        <ChartCard title="Owner consents per week" empty={!has(s.ownerConsents)}><LineChart labels={s.labels} data={s.ownerConsents} color="var(--info)" /></ChartCard>
        <ChartCard title="Repeat bookings per week" empty={!has(s.repeatBookings)}><LineChart labels={s.labels} data={s.repeatBookings} color="var(--secondary)" /></ChartCard>
      </div></>)}</Async></>);
}
