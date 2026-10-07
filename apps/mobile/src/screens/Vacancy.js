import React from 'react';
import { ScrollView } from 'react-native';
import { Card, H2, P, Chip, DayCountdown, Row, Async, Empty, inr } from '../components/ui';
import { t } from '../theme';
import { useApi } from '../api';

// Live vacancy + 7-day countdown (owner view). Data from /owner/dashboard (core windowStatus()).
export default function Vacancy() {
  const state = useApi('/owner/dashboard');
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 16 }}>
      <H2 style={{ marginBottom: 12 }}>Vacancy</H2>
      <Async state={state}>{(d) => {
        const vacant = d.rooms.filter((r) => r.vacancy);
        if (!vacant.length) return <Empty title="No vacant rooms" sub="When a tenant leaves and the exit is confirmed, you'll see the 7-day countdown here." />;
        return vacant.map((r) => { const expired = r.vacancy.phase === 'EXPIRED'; return (
          <Card key={r.id} style={{ marginBottom: 14 }}>
            <Chip label="VACANT" color={t.warning} />
            <H2 style={{ marginVertical: 8 }}>{r.name}</H2>
            <DayCountdown day={r.vacancy.day} expired={expired} />
            <H2 style={{ marginTop: 14 }}>{expired ? 'Commission Waived' : r.vacancy.label}</H2>
            <P style={{ marginBottom: 8 }}>{expired ? 'We keep trying to fill this room at no charge to you.' : 'We are finding a new tenant for you.'}</P>
            <Row label="If placed within 7 days" value={`20% = ${inr(r.rent * 0.2)}`} />
            <Row label="If it takes longer" value="₹0 — waived" strong />
            <P style={{ fontSize: 12 }}>This is a fee waiver, not compensation for lost rent.</P>
          </Card>); });
      }}</Async>
    </ScrollView>
  );
}
