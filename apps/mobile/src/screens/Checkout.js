import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import { Screen, H1, H2, P, Button, Input, Card, Chip, Timeline } from '../components/ui';
import { api } from '../api';
import { t } from '../theme';

const TIMELINE = [
  { label: 'Room QR scanned' }, { label: 'You confirmed' }, { label: 'Owner confirmation' }, { label: 'Cross-check complete' },
  { label: 'Exit verified' }, { label: 'Room marked vacant' }, { label: 'Cashback ready to use' },
];
const STATE_TO_STEP = { INITIATED: 0, QR_SCANNED: 1, AWAITING_PARTIES: 2, VERIFIED: 7, DISPUTED: 2, MANUAL_REVIEW: 3 };

export default function Checkout({ navigation, route }) {
  const ROOM_ID = route.params.roomId;   // the tenant's own room, from Home
  const [phase, setPhase] = useState('intro'); // intro | scan | confirm | status
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [co, setCo] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn) => { setBusy(true); setErr(null); try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };

  const start = () => run(async () => { await api(`/checkout/${ROOM_ID}/start`, { method: 'POST' }); setPhase('scan'); });
  const onScanned = (value) => { if (busy || phase !== 'scan') return; run(async () => {
    const res = await api(`/checkout/${ROOM_ID}/scan`, { method: 'POST', body: { qr: String(value).split('/').pop() } });
    setCo(res.checkout); setPhase('confirm');
  }); };
  // Hooks must run on every render (before any early return), so the scanner is set up here.
  const codeScanner = useCodeScanner({ codeTypes: ['qr'], onCodeScanned: (codes) => { const v = codes[0]?.value; if (v) onScanned(v); } });
  const confirm = () => run(async () => {
    const res = await api(`/checkout/${ROOM_ID}/tenant-confirm`, { method: 'POST', body: { checkoutDate: date } });
    setCo(res.checkout); setPhase('status');
  });

  if (phase === 'scan') {
    if (!hasPermission) return (
      <Screen style={{ justifyContent: 'center' }}>
        <H2>Camera needed</H2><P style={{ marginBottom: 16 }}>Allow camera to scan the QR tag on your room.</P>
        <Button title="Allow camera" onPress={requestPermission} />
      </Screen>);
    if (!device) return (<Screen style={{ justifyContent: 'center' }}><H2>No camera found</H2><P>This device has no usable back camera.</P></Screen>);
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Camera style={{ flex: 1 }} device={device} isActive={phase === 'scan'} codeScanner={codeScanner} />
        <View style={{ position: 'absolute', bottom: 40, left: 16, right: 16 }}>
          <Card><Text style={{ fontWeight: '700', color: t.textPrimary }}>Point at the QR tag on your room</Text>{err ? <Text style={{ color: t.error, marginTop: 4 }}>{err}</Text> : null}</Card>
        </View>
      </View>);
  }
  if (phase === 'confirm') return (
    <Screen>
      <Chip label="QR scanned ✓" color={t.success} />
      <H1 style={{ fontSize: 22, marginTop: 10 }}>Confirm your checkout</H1>
      <P style={{ marginBottom: 16 }}>Your owner will also be asked to confirm. Your cashback becomes ready once both of you confirm.</P>
      <Input label="Checkout date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      {err ? <Text style={{ color: t.error, marginBottom: 8 }}>{err}</Text> : null}
      <Button title="Confirm checkout" loading={busy} disabled={!/^\d{4}-\d{2}-\d{2}$/.test(date)} onPress={confirm} />
    </Screen>);
  if (phase === 'status') {
    const state = co?.state; const disputed = state === 'DISPUTED' || state === 'MANUAL_REVIEW';
    return (
      <Screen>
        <H1 style={{ fontSize: 22 }}>{state === 'VERIFIED' ? 'Checkout verified' : disputed ? 'We need a quick review' : 'Waiting for your owner'}</H1>
        <P style={{ marginBottom: 14 }}>{disputed ? 'Our team will review the details and get back to you. Your cashback stays safe.' : 'We are confirming with your owner on WhatsApp. This usually takes a short while.'}</P>
        <Card><ScrollView><Timeline steps={TIMELINE} current={STATE_TO_STEP[state] ?? 2} /></ScrollView></Card>
        <View style={{ flex: 1 }} />
        <Button title="Back to home" variant="outline" onPress={() => navigation.popToTop()} />
      </Screen>);
  }
  return (
    <Screen>
      <H1 style={{ fontSize: 22 }}>Moving out?</H1>
      <P style={{ marginBottom: 16 }}>Scan QR at checkout to activate your cashback eligibility.</P>
      <Card style={{ marginBottom: 16 }}>
        <Timeline steps={[{ label: 'Scan the QR tag on your room' }, { label: 'Confirm your checkout date' }, { label: 'Owner confirms' }, { label: 'Cashback becomes ready to use' }]} current={0} />
      </Card>
      {err ? <Text style={{ color: t.error, marginBottom: 8 }}>{err}</Text> : null}
      <Button title="Start checkout" loading={busy} onPress={start} />
    </Screen>);
}
