import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { Screen, H1, H2, P, Card, Button, Row, inr } from '../components/ui';
import { CASHBACK_WHY } from './PropertyDetails';
import { t, radius } from '../theme';
import { api } from '../api';

const days = Array.from({ length: 10 }, (_, i) => { const d = new Date(Date.now() + (i + 1) * 864e5); return { iso: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) }; });
const MONTHS = [3, 6, 11, 12];
const Pill = ({ label, on, onPress }) => (
  <Pressable onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, marginRight: 8, backgroundColor: on ? t.primary : t.surface, borderWidth: 1.5, borderColor: on ? t.primary : t.border }}>
    <Text style={{ color: on ? '#fff' : t.textPrimary, fontWeight: '600' }}>{label}</Text></Pressable>);

export default function BookProperty({ route, navigation }) {
  const l = route.params.listing;
  const [date, setDate] = useState(days[2].iso), [months, setMonths] = useState(11);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(null);
  const q = l.quote;
  const go = async () => {
    setBusy(true); setErr(null);
    try { const r = await api('/bookings', { method: 'POST', body: { roomId: l.roomId, moveInDate: date, months } }); navigation.navigate('Payment', { booking: r.booking }); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <ScrollView>
        <H1 style={{ fontSize: 22 }}>Book {l.room}</H1><P style={{ marginBottom: 14 }}>{l.title}, {l.locality}</P>
        <H2 style={{ marginBottom: 8 }}>Move-in date</H2>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>{days.map((d) => <Pill key={d.iso} label={d.label} on={date === d.iso} onPress={() => setDate(d.iso)} />)}</ScrollView>
        <H2 style={{ marginBottom: 8 }}>How long will you stay?</H2>
        <View style={{ flexDirection: 'row', marginBottom: 16 }}>{MONTHS.map((m) => <Pill key={m} label={`${m} months`} on={months === m} onPress={() => setMonths(m)} />)}</View>
        <H2 style={{ marginBottom: 8 }}>Rent breakdown</H2>
        <Card>
          <Row label="First month's rent" value={inr(l.rent)} />
          <Row label="Cashback applied" value={q.cashback ? `− ${inr(q.cashback)}` : '₹0'} />
          <View style={{ height: 1, backgroundColor: t.border, marginVertical: 6 }} />
          <Row label="You pay now" value={inr(q.payable)} strong />
          {!q.cashback ? <P style={{ marginTop: 6, fontSize: 12 }}>{CASHBACK_WHY[q.reason]}</P> : <P style={{ marginTop: 6, fontSize: 12 }}>No extra fees from RentalHub.</P>}
        </Card>
      </ScrollView>
      {err ? <Text style={{ color: t.error, marginVertical: 6 }}>{err}</Text> : null}
      <Button title="Continue to payment" loading={busy} onPress={go} />
    </Screen>
  );
}
