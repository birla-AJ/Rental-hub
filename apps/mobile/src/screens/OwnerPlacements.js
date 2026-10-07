import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { Card, H2, P, Chip, DayCountdown, Async, Empty, inr } from '../components/ui';
import { t } from '../theme';
import { useApi } from '../api';

const COMM = { DUE: ['Commission due', t.warning], PAID: ['Commission paid', t.success], WAIVED: ['Commission Waived', t.primary] };

// Vacancy → verified → 7-day window → marketed → booking → placement → commission, for every room.
export default function OwnerPlacements() {
  const state = useApi('/owner/placements');
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
      <H2 style={{ marginBottom: 4 }}>Placements</H2>
      <P style={{ marginBottom: 14 }}>No upfront payment. Commission only if we place a new tenant within 7 days. After 7 days it’s waived and we keep trying.</P>
      <Async state={state}>{(d) => (<>
        <H2 style={{ marginBottom: 8 }}>In progress</H2>
        {d.inProgress.length === 0 ? <Card style={{ marginBottom: 16 }}><P>No vacant rooms right now.</P></Card> : d.inProgress.map((v) => { const exp = v.vacancy.phase === 'EXPIRED'; return (
          <Card key={v.roomId} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontWeight: '800', color: t.textPrimary }}>{v.room}</Text><Chip label={exp ? 'Commission Waived' : v.incoming ? 'New tenant found' : 'Finding a tenant'} color={exp ? t.primary : v.incoming ? t.info : t.warning} /></View>
            <P style={{ marginBottom: 10 }}>{v.property}</P>
            <DayCountdown day={v.vacancy.day} expired={exp} />
            <P style={{ marginTop: 10 }}>{exp ? 'We keep trying to fill this room at no charge to you.' : `Placed within 7 days: ${inr(v.potentialCommission)} (20% of one month’s rent). Otherwise ₹0.`}</P>
            {v.incoming ? <P style={{ marginTop: 6, color: t.info }}>{v.incoming.tenantFirstName} has booked this room — moving in {v.incoming.moveInDate}.{v.incoming.status === 'PENDING' ? ' We’re confirming it.' : ''}</P> : null}
          </Card>); })}
        <H2 style={{ marginVertical: 8 }}>History</H2>
        {d.history.length === 0 ? <Empty title="No placements yet" sub="Filled rooms and their commission show up here." /> : d.history.map((c) => { const [l, col] = COMM[c.status]; return (
          <Card key={c.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontWeight: '800', color: t.textPrimary }}>{c.room}</Text><Chip label={l} color={col} /></View>
            <P>{c.property}{c.newTenantFirstName ? ` · new tenant ${c.newTenantFirstName}` : ''}</P>
            <P style={{ fontSize: 12 }}>{c.status === 'WAIVED' ? `Filled after ${c.days ?? '—'} days — nothing to pay.` : `Filled in ${c.days ?? '—'} days · ${inr(c.amount)}`} · {c.at.slice(0, 10)}</P>
          </Card>); })}
      </>)}</Async>
    </ScrollView>
  );
}
