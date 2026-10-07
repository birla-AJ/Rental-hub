import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { Card, GradientCard, H2, P, Chip, Row, Async, Empty, inr } from '../components/ui';
import { useApi } from '../api';
import { t, textSize } from '../theme';

const LADDER = [
  { n: '1st', pct: '30%', sub: 'Token on registration', tag: 'Saved for later' },
  { n: '2nd', pct: '30%', sub: 'Redeemed on booking', tag: 'Cashback' },
  { n: '3rd', pct: '10%', sub: 'Redeemed on booking', tag: 'Cashback' },
  { n: '4th+', pct: '7%', sub: 'Every booking after', tag: 'Cashback' },
];
export function LadderCards() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
      {LADDER.map((l) => (
        <Card key={l.n} style={{ width: '48%', marginBottom: 12 }}>
          <Text style={{ color: t.textSecondary, fontWeight: '700' }}>{l.n} booking</Text>
          <Text style={{ fontSize: textSize(28), fontWeight: '900', color: t.primary }}>{l.pct}</Text>
          <P style={{ fontSize: 12 }}>{l.sub}</P>
        </Card>
      ))}
      <P style={{ fontSize: 12 }}>Percentages are of one month's rent.</P>
    </View>
  );
}

const STATES = { DORMANT: ['Saved', t.info], ELIGIBLE: ['Ready to use', t.success], REDEEMED: ['Used', t.disabled], UNDER_REVIEW: ['Under review', t.warning] };
export default function Wallet() {
  const state = useApi('/wallet');   // tenant view: no expiry date, no internal tracking
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <Async state={state}>{(w) => <>
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, backgroundColor: t.background }}>
          <H2 style={{ marginBottom: 12 }}>Wallet</H2>
          <GradientCard colors={['#6CA583', '#315B43', '#173728']} style={{ minHeight: 196 }} contentStyle={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ color: '#EAF6ED' }}>Available cashback</Text>
            <Text style={{ color: '#fff', fontSize: textSize(38), fontWeight: '900', letterSpacing: -.8 }}>{inr(w.available)}</Text>
            <Text style={{ color: '#D8EEDC', marginTop: 6 }}>Total earned {inr(w.total)}</Text>
          </GradientCard>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 110 }}>
          <Card style={{ marginBottom: 14 }}>
            <Row label="Pending (on a booking)" value={inr(w.pending)} /><Row label="Saved for later" value={inr(w.locked)} /><Row label="Redeemed" value={inr(w.redeemed)} />
          </Card>
          {w.tokens.length === 0 ? <Empty title="No cashback yet" sub="Register the property you live in to earn a 30% cashback token." /> : w.tokens.map((k, i) => { const [label, color] = STATES[k.reserved ? 'UNDER_REVIEW' : k.state]; return (
            <Card key={i} style={{ marginBottom: 14 }}>
              <Chip label={k.reserved ? 'On a booking' : label} color={color} /><H2 style={{ marginTop: 8 }}>{inr(k.amount)} cashback token</H2><P>From {k.from}</P>
              <P style={{ marginTop: 8 }}>{k.state === 'DORMANT' ? 'Your token is safe. Scan the room QR when you check out to make it ready to use.' : k.state === 'ELIGIBLE' ? 'Ready to use on your next booking.' : k.state === 'REDEEMED' ? 'Used on a booking.' : ''}</P>
            </Card>); })}
          <H2 style={{ marginVertical: 8 }}>Cashback ladder</H2>
          <LadderCards />
        </ScrollView>
      </>}</Async>
    </View>
  );
}
