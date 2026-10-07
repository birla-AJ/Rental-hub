import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Screen, H1, H2, P, Card, Button, Row, inr } from '../components/ui';
import { t, radius } from '../theme';
import RazorpayCheckout from 'react-native-razorpay';
import { api } from '../api';
import Icon from '../components/Icon';

const METHODS = ['UPI', 'Card', 'Net banking'];
// states: summary -> processing -> success | failed
export default function Payment({ route, navigation }) {
  const [b, setB] = useState(route.params.booking);
  const [method, setMethod] = useState('UPI');
  const [phase, setPhase] = useState('summary');
  const [err, setErr] = useState(null);

  // 1) the server creates an order for the exact amount  2) the gateway collects the money  3) the server verifies the gateway's signature
  const pay = async (simulate) => {
    setPhase('processing'); setErr(null);
    try {
      const o = await api(`/bookings/${b.id}/pay/start`, { method: 'POST' });
      if (o.free) { setB(o.booking); setPhase('success'); return; }
      if (o.provider === 'mock') {                                  // development server: no real money, one simulated step
        const r = await api(`/bookings/${b.id}/pay`, { method: 'POST', body: { method, simulate } }); setB(r.booking); setPhase('success'); return;
      }
      let paid;
      try {
        paid = await RazorpayCheckout.open({ key: o.keyId, order_id: o.orderId, amount: o.amount, currency: o.currency, name: 'RentalHub', description: `Booking · ${b.room}`, prefill: { contact: o.prefill?.contact }, theme: { color: t.primary } });
      } catch (e) { throw new Error(e?.error?.description ?? e?.description ?? 'Payment was cancelled.'); }
      const r = await api(`/bookings/${b.id}/pay/confirm`, { method: 'POST', body: { orderId: paid.razorpay_order_id, paymentId: paid.razorpay_payment_id, signature: paid.razorpay_signature, method } });
      setB(r.booking); setPhase('success');
    } catch (e) { setErr(e.message === 'Network request failed' ? 'No connection. If money was deducted, it will be confirmed or refunded automatically.' : e.message); setPhase('failed'); }
  };

  if (phase === 'processing') return <Screen style={{ justifyContent: 'center', alignItems: 'center' }}><View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="clock" size={36} color={t.primaryDark} /></View><H2 style={{ marginTop: 10 }}>Processing payment…</H2><P>Please don’t close the app.</P></Screen>;
  if (phase === 'success') return (
    <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 76, height: 76, borderRadius: 28, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={42} color={t.success} strokeWidth={2.4} /></View><H1 style={{ marginVertical: 8 }}>Booking requested</H1>
      <P style={{ textAlign: 'center', marginBottom: 6 }}>We received {inr(b.payment.amount)}. We’ll confirm your room shortly and share the owner’s details.</P>
      <P style={{ textAlign: 'center', marginBottom: 20, fontSize: 12 }}>Payment ID {b.payment.id}</P>
      <Button title="View booking" onPress={() => navigation.reset({ index: 1, routes: [{ name: 'Main' }, { name: 'BookingDetails', params: { id: b.id } }] })} style={{ alignSelf: 'stretch' }} />
    </Screen>);
  if (phase === 'failed') return (
    <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 76, height: 76, borderRadius: 28, backgroundColor: '#F9E4E4', alignItems: 'center', justifyContent: 'center' }}><Icon name="alert" size={42} color={t.error} strokeWidth={2.2} /></View><H1 style={{ marginVertical: 8 }}>Payment didn’t go through</H1>
      <P style={{ textAlign: 'center', marginBottom: 20 }}>{err} You have not been charged twice — if money was deducted, it is confirmed or refunded automatically.</P>
      <Button title="Try again" onPress={() => setPhase('summary')} style={{ alignSelf: 'stretch' }} /><Button title="Back to home" variant="outline" onPress={() => navigation.popToTop()} style={{ alignSelf: 'stretch', marginTop: 10 }} />
    </Screen>);

  return (
    <Screen>
      <H1 style={{ fontSize: 22, marginBottom: 14 }}>Payment summary</H1>
      <Card style={{ marginBottom: 14 }}>
        <Row label="Room" value={`${b.room}, ${b.property}`} /><Row label="Move-in" value={b.moveInDate} /><Row label="Stay" value={`${b.months} months`} />
        <Row label="First month's rent" value={inr(b.quote.rent)} /><Row label="Cashback applied" value={b.quote.cashback ? `− ${inr(b.quote.cashback)}` : '₹0'} />
        <View style={{ height: 1, backgroundColor: t.border, marginVertical: 6 }} /><Row label="Amount payable" value={inr(b.quote.payable)} strong />
      </Card>
      <H2 style={{ marginBottom: 8 }}>Pay with</H2>
      <View style={{ flexDirection: 'row', marginBottom: 14 }}>{METHODS.map((m) => <Pressable key={m} onPress={() => setMethod(m)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, marginRight: 8, borderWidth: 1.5, borderColor: method === m ? t.primary : t.border, backgroundColor: method === m ? t.accent : t.surface }}><Text style={{ fontWeight: '700', color: t.textPrimary }}>{m}</Text></Pressable>)}</View>
      <P style={{ fontSize: 12 }}>Free cancellation before move-in — you get a full refund.</P>
      <View style={{ flex: 1 }} />
      <Button title={`Pay ${inr(b.quote.payable)}`} onPress={() => pay()} />
      {__DEV__ ? <Button title="(dev) simulate failed payment" variant="outline" onPress={() => pay('fail')} style={{ marginTop: 8 }} /> : null}
    </Screen>);
}
