import React, { useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { Card, H2, P, Chip, Button, Row, Async, Empty, inr } from '../components/ui';
import { t } from '../theme';
import { api, useApi } from '../api';

const TONE = { DUE: [t.warning, 'Due'], PAID: [t.success, 'Paid'], WAIVED: [t.primary, 'Commission Waived'] };
export default function Commission() {
  const state = useApi('/owner/dashboard');
  const [busy, setBusy] = useState(null);
  const pay = async (id) => { setBusy(id); try { await api('/commission/pay', { method: 'POST', body: { id } }); state.retry(); } finally { setBusy(null); } };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 16 }}>
      <H2 style={{ marginBottom: 4 }}>Commission</H2>
      <P style={{ marginBottom: 12 }}>20% of one month's rent — only when we place a new tenant within 7 days. If it takes longer, you pay nothing.</P>
      <Async state={state}>{(d) => (<>
        <Card style={{ marginBottom: 14 }}>
          <Row label="Potential" value={inr(d.commission.potential)} /><Row label="Due" value={inr(d.commission.due)} strong />
          <Row label="Paid" value={inr(d.commission.paid)} /><Row label="Waived" value={inr(d.commission.waived)} />
        </Card>
        <H2 style={{ marginBottom: 8 }}>History</H2>
        {d.ledger.length === 0 ? <Empty title="No commission yet" sub="You'll see placements and any waived commission here." /> :
          d.ledger.map((c) => { const [col, label] = TONE[c.status]; return (
            <Card key={c.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontWeight: '800', color: t.textPrimary }}>{c.room}</Text><Chip label={label} color={col} /></View>
              <P style={{ marginTop: 6 }}>{c.status === 'WAIVED' ? 'Placement took more than 7 days, so no commission is charged. We keep trying at no cost.' : `${inr(c.amount)} · 20% of one month's rent`}</P>
              {c.status === 'DUE' ? <Button title={`Pay ${inr(c.amount)}`} loading={busy === c.id} onPress={() => pay(c.id)} style={{ marginTop: 10 }} /> : null}
            </Card>); })}
      </>)}</Async>
    </ScrollView>
  );
}
