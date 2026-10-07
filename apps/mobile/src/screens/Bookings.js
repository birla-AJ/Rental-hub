import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable, Alert } from 'react-native';
import { Screen, H1, H2, P, Card, Chip, Button, Row, Timeline, Async, Empty, inr } from '../components/ui';
import { t } from '../theme';
import { api, useApi } from '../api';

const ST = { REQUESTED: ['Not paid', t.warning], PENDING: ['Awaiting confirmation', t.info], CONFIRMED: ['Confirmed', t.success], MOVED_IN: ['Moved in', t.primary], REJECTED: ['Rejected', t.error], CANCELLED: ['Cancelled', t.disabled] };
const STEPS = ['REQUESTED', 'PENDING', 'CONFIRMED', 'MOVED_IN'];
const LABEL = { REQUESTED: 'Booking requested', PENDING: 'Paid — awaiting confirmation', CONFIRMED: 'Booking confirmed', MOVED_IN: 'Moved in — tenancy created' };

export default function Bookings({ navigation }) {
  const [tab, setTab] = useState('Active');
  const state = useApi('/bookings');
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
      <H2 style={{ marginBottom: 10 }}>My bookings</H2>
      <View style={{ flexDirection: 'row', marginBottom: 12 }}>{['Active', 'Past'].map((x) => <View key={x} style={{ flex: 1, marginRight: 8 }}><Button title={x} variant={tab === x ? 'primary' : 'outline'} onPress={() => setTab(x)} style={{ height: 40 }} /></View>)}</View>
      <Async state={state}>{(d) => {
        const rows = d.rows.filter((b) => (tab === 'Active') === ['REQUESTED', 'PENDING', 'CONFIRMED', 'MOVED_IN'].includes(b.status));
        return rows.length ? rows.map((b) => { const [l, c] = ST[b.status]; return (
          <Pressable key={b.id} onPress={() => navigation.navigate('BookingDetails', { id: b.id })}><Card style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontWeight: '800', color: t.textPrimary, flex: 1 }}>{b.property}</Text><Chip label={l} color={c} /></View>
            <P>{b.room} · {b.locality}</P><P style={{ fontSize: 12 }}>Move-in {b.moveInDate} · {inr(b.quote.payable)} paid</P></Card></Pressable>); })
          : <Empty title={tab === 'Active' ? 'No active bookings' : 'No past bookings'} sub={tab === 'Active' ? 'Find a verified home in Search.' : 'Cancelled and rejected bookings appear here.'} />;
      }}</Async>
    </ScrollView>
  );
}

export function BookingDetails({ route, navigation }) {
  const state = useApi(`/bookings/${route.params.id}`);
  const [busy, setBusy] = useState(false);
  const cancel = (b) => Alert.alert('Cancel booking?', b.payment ? `You'll get a full refund of ${inr(b.payment.amount)}.` : 'This booking will be cancelled.', [
    { text: 'Keep booking', style: 'cancel' },
    { text: 'Cancel booking', style: 'destructive', onPress: async () => { setBusy(true); try { await api(`/bookings/${b.id}/cancel`, { method: 'POST' }); state.retry(); } finally { setBusy(false); } } }]);
  return (
    <Screen>
      <Async state={state}>{({ booking: b }) => {
        const [l, c] = ST[b.status]; const idx = STEPS.indexOf(b.status); const closed = idx === -1;
        return (<ScrollView>
          <Chip label={l} color={c} /><H1 style={{ fontSize: 22, marginVertical: 8 }}>{b.property}</H1><P style={{ marginBottom: 12 }}>{b.room} · {b.locality}</P>
          <Card style={{ marginBottom: 14 }}><Row label="Move-in" value={b.moveInDate} /><Row label="Stay" value={`${b.months} months`} /><Row label="First month's rent" value={inr(b.quote.rent)} />
            <Row label="Cashback applied" value={b.quote.cashback ? `− ${inr(b.quote.cashback)}` : '₹0'} /><Row label="Paid" value={b.payment ? inr(b.payment.amount) : '—'} strong />
            {b.refund ? <Row label={b.refund.status === 'REFUNDED' ? 'Refunded' : 'Refund on its way'} value={inr(b.refund.amount)} /> : null}</Card>
          {closed ? <Card style={{ marginBottom: 14 }}><P>{b.status === 'REJECTED' ? `We couldn't confirm this booking${b.reason ? `: ${b.reason}` : ''}. You've been refunded in full.` : b.refund ? 'You cancelled this booking and were refunded in full.' : 'This booking was cancelled.'}</P></Card> :
            <Card style={{ marginBottom: 14 }}><H2 style={{ marginBottom: 8 }}>Move-in timeline</H2><Timeline steps={STEPS.map((s) => ({ label: LABEL[s] }))} current={b.status === 'MOVED_IN' ? 4 : idx} /></Card>}
          {['REQUESTED', 'PENDING', 'CONFIRMED'].includes(b.status) ? <Button title="Cancel booking" variant="outline" loading={busy} onPress={() => cancel(b)} /> : null}
          {b.status === 'REQUESTED' ? <Button title="Pay now" onPress={() => navigation.navigate('Payment', { booking: b })} style={{ marginTop: 10 }} /> : null}
        </ScrollView>);
      }}</Async>
    </Screen>
  );
}
