import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { Card, H1, H2, P, Chip, Row, Button, DayCountdown, Timeline, Async, Empty, inr } from '../components/ui';
import QRTag from '../components/QRTag';
import { t, statusTone } from '../theme';
import { useApi } from '../api';

const COMM = { DUE: ['Commission due', t.warning], PAID: ['Commission paid', t.success], WAIVED: ['Commission Waived', t.primary] };

// One room: who lives there, vacancy countdown, past tenants, placements and its QR tag.
export default function OwnerRoom({ route, navigation }) {
  const state = useApi(`/owner/rooms/${route.params.id}`);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Async state={state}>{({ room: r, stays, placements, checkout }) => (<>
        <Chip label={r.status.replace(/_/g, ' ')} color={statusTone[r.status] ?? t.secondary} />
        <H1 style={{ fontSize: 22, marginVertical: 8 }}>{r.name}</H1><P style={{ marginBottom: 12 }}>{inr(r.rent)} per month</P>

        {r.tenant ? (<Card style={{ marginBottom: 14 }}><H2 style={{ fontSize: 15, marginBottom: 6 }}>Current tenant</H2>
          <Row label="Name" value={r.tenant.name} /><Row label="Mobile" value={`+91 ${r.tenant.phone}`} /><Row label="Living here since" value={r.tenant.since ? r.tenant.since.slice(0, 10) : '—'} />
          <Row label="KYC" value={r.tenant.kyc === 'VERIFIED' ? 'Verified ✓' : 'Not verified yet'} />
          {checkout?.state === 'AWAITING_PARTIES' ? <Button title="Review checkout request" variant="outline" onPress={() => navigation.navigate('OwnerCheckout', { roomId: r.id })} style={{ marginTop: 8 }} /> : null}</Card>) : null}

        {r.vacancy ? (<Card style={{ marginBottom: 14 }}><H2 style={{ fontSize: 15, marginBottom: 10 }}>Placement window</H2>
          <DayCountdown day={r.vacancy.day} expired={r.vacancy.phase === 'EXPIRED'} />
          <H2 style={{ marginTop: 12 }}>{r.vacancy.phase === 'EXPIRED' ? 'Commission Waived' : r.vacancy.label}</H2>
          <P>{r.vacancy.phase === 'EXPIRED' ? 'We keep trying to fill this room at no charge to you.' : 'If we place a new tenant within 7 days you pay 20% of one month’s rent. After that, nothing.'}</P>
          {r.incoming ? <P style={{ marginTop: 8, color: t.info }}>New tenant found: {r.incoming.tenantFirstName}, moving in {r.incoming.moveInDate}.</P> : null}</Card>) : null}

        <H2 style={{ marginBottom: 8 }}>Placements</H2>
        {placements.length === 0 ? <Card style={{ marginBottom: 14 }}><P>No placements yet for this room.</P></Card> : placements.map((c) => { const [l, col] = COMM[c.status]; return (
          <Card key={c.id} style={{ marginBottom: 10 }}><Chip label={l} color={col} />
            <P style={{ marginTop: 6 }}>{c.status === 'WAIVED' ? `Filled after ${c.days ?? '—'} days — you pay nothing.` : `Filled in ${c.days ?? '—'} days · ${inr(c.amount)} (20% of one month’s rent)`}</P></Card>); })}

        <H2 style={{ marginVertical: 8 }}>Tenant history</H2>
        {stays.length === 0 ? <Empty title="No tenants recorded" sub="Past and current tenants appear here." /> :
          <Card style={{ marginBottom: 14 }}><Timeline steps={stays.map((s) => ({ label: s.tenantFirstName, sub: `${s.startedAt.slice(0, 10)} → ${s.endedAt ? s.endedAt.slice(0, 10) : 'now'}` }))} current={stays.findIndex((s) => !s.endedAt)} /></Card>}

        {r.tag ? (<><H2 style={{ marginBottom: 8 }}>Room tag</H2><QRTag code={r.tag.code} room={r.name} property="" size={110} /></>) : <Card><P>The QR tag for this room is added when our agent verifies the property.</P></Card>}
      </>)}</Async>
    </ScrollView>
  );
}
