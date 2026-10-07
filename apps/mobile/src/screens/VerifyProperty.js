import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, Pressable, Linking } from 'react-native';
import { getPosition } from '../native/location';
import { Screen, H1, H2, P, Button, Input, Card, Chip, Row, Async } from '../components/ui';
import QRTag from '../components/QRTag';
import { t } from '../theme';
import { api, useApi } from '../api';
import Icon from '../components/Icon';

const STEPS = ['Details', 'KYC', 'Location', 'Room QR tags', 'Checklist'];
const CHECK = { photosMatch: 'Photos/video match the property', roomsCounted: 'All rooms in the property counted', ownerContactCaptured: 'Owner contact captured',
  tenantKycVerified: 'Tenant KYC verified', geoTagged: 'Whole property geo-tagged', qrApplied: 'QR tag applied to every room' };
const IDS = ['Aadhaar', 'PAN', 'Driving licence', 'Voter ID'];

export default function VerifyProperty({ route, navigation }) {
  const state = useApi(`/properties/${route.params.id}`);
  return <Screen><Async state={state}>{(d) => <Flow data={d} navigation={navigation} />}</Async></Screen>;
}

function Flow({ data, navigation }) {
  const { property: p } = data;
  const [step, setStep] = useState(0);
  const [idType, setIdType] = useState(null);
  const [geo, setGeo] = useState(null);
  const [tags, setTags] = useState(data.rooms.filter((r) => r.qr).map((r) => ({ roomId: r.id, room: r.name, ...r.qr })));
  const [checks, setChecks] = useState({ ownerContactCaptured: false, photosMatch: false, roomsCounted: false });
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [outcome, setOutcome] = useState(null); // verified | rejected | revisit
  const [kycOk, setKycOk] = useState(false);
  const [visit, setVisit] = useState(p.visit);
  useEffect(() => { if (!p.startedAt) api(`/properties/${p.id}/start`, { method: 'POST' }).catch(() => {}); }, []);   // tells the tenant verification has begun
  const slots = [['Today 5 PM', 0, 17], ['Tomorrow 11 AM', 1, 11], ['Tomorrow 4 PM', 1, 16]];
  const schedule = (days, hour) => call(async () => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); const r = await api(`/properties/${p.id}/schedule`, { method: 'POST', body: { visitAt: d.toISOString() } }); setVisit(r.visit); });

  const call = async (fn) => { setBusy(true); setErr(null); try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const tagWhole = () => call(async () => { setGeo(await getPosition()); });
  const genQr = () => call(async () => { const r = await api(`/properties/${p.id}/qr`, { method: 'POST' }); setTags(r.tags); });
  const submit = () => call(async () => {
    const checklist = { ...checks, tenantKycVerified: kycOk, geoTagged: !!geo, qrApplied: tags.length === data.rooms.length };
    await api(`/properties/${p.id}/verify`, { method: 'POST', body: { checklist, geo, notes } });
    setOutcome('verified');
  });
  const flag = (kind) => call(async () => { await api(`/properties/${p.id}/${kind}`, { method: 'POST', body: { reason } }); setOutcome(kind === 'reject' ? 'rejected' : 'revisit'); });

  if (outcome) {
    const m = { verified: ['check', t.success, 'Verification submitted', 'The property is verified. The tenant’s 30% cashback token has been added (saved for their next booking).'],
      rejected: ['alert', t.error, 'Property rejected', 'We’ve recorded your reason. The tenant will be informed.'], revisit: ['history', t.info, 'Revisit scheduled', 'The property is back in your tasks as “Revisit required”.'] }[outcome];
    return (<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><View style={{ width: 78, height: 78, borderRadius: 28, backgroundColor: m[1] + '20', alignItems: 'center', justifyContent: 'center' }}><Icon name={m[0]} size={42} color={m[1]} strokeWidth={2.4} /></View><H1 style={{ fontSize: 22, marginVertical: 8 }}>{m[2]}</H1>
      <P style={{ textAlign: 'center', marginBottom: 20 }}>{m[3]}</P><Button title="Back to tasks" onPress={() => navigation.popToTop()} style={{ alignSelf: 'stretch' }} /></View>);
  }

  return (<>
    <H1 style={{ fontSize: 22 }}>{p.name}</H1>
    <P style={{ marginBottom: 8 }}>Step {step + 1} of {STEPS.length} · {STEPS[step]}</P>
    <View style={{ flexDirection: 'row', marginBottom: 14 }}>{STEPS.map((s, i) => <View key={s} style={{ flex: 1, height: 5, borderRadius: 3, marginRight: 4, backgroundColor: i <= step ? t.primary : t.border }} />)}</View>
    <ScrollView keyboardShouldPersistTaps="handled">
      {step === 0 && (<>
        <Card style={{ marginBottom: 12 }}><Chip label="Registered by tenant" /><H2 style={{ marginTop: 8 }}>{p.tenantName}</H2><P>Living in {data.rooms.find((r) => r.id === p.tenantRoomId)?.name}</P></Card>
        <Card style={{ marginBottom: 12 }}><Row label="Address" value={p.locality} /><P>{p.address}</P><Row label="Rooms" value={String(data.rooms.length)} /><Row label="Visit" value={visit} />
          {!p.visitAt && visit === 'To be scheduled' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>{slots.map(([l, d, h]) => <View key={l} style={{ marginRight: 8, marginBottom: 8 }}><Button title={l} variant="outline" onPress={() => schedule(d, h)} style={{ height: 38, paddingHorizontal: 12 }} /></View>)}</View> : null}</Card>
        <Card><Row label="Owner" value={p.ownerName} /><Row label="Mobile" value={p.ownerPhone} />
          <Button title="Call owner" variant="outline" onPress={() => Linking.openURL(`tel:${p.ownerPhone}`)} style={{ marginTop: 8 }} />
          <Pressable onPress={() => setChecks({ ...checks, ownerContactCaptured: !checks.ownerContactCaptured })}><P style={{ marginTop: 10, color: t.primary }}>{checks.ownerContactCaptured ? '✓ Owner contact confirmed' : 'Tap to confirm owner contact is correct'}</P></Pressable></Card>
      </>)}
      {step === 1 && (<>
        <H2 style={{ marginBottom: 8 }}>Tenant KYC</H2><P style={{ marginBottom: 10 }}>Check the original ID in person. Don’t write down ID numbers.</P>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{IDS.map((x) => <View key={x} style={{ marginRight: 8, marginBottom: 8 }}><Button title={x} variant={idType === x ? 'primary' : 'outline'} onPress={() => setIdType(x)} style={{ height: 40, paddingHorizontal: 14 }} /></View>)}</View>
        <Button title={kycOk ? '✓ KYC verified' : 'Mark KYC verified'} disabled={!idType} variant={kycOk ? 'outline' : 'primary'} onPress={() => setKycOk(!kycOk)} style={{ marginTop: 10 }} />
      </>)}
      {step === 2 && (<>
        <H2 style={{ marginBottom: 6 }}>Geo-tag the whole property</H2><P style={{ marginBottom: 12 }}>Stand at the main entrance. This tags the entire building, not just one room.</P>
        {geo ? <Card style={{ marginBottom: 12 }}><Chip label="Location captured ✓" color={t.success} /><Row label="Latitude" value={geo.lat.toFixed(5)} /><Row label="Longitude" value={geo.lng.toFixed(5)} /><Row label="Accuracy" value={`±${geo.accuracy} m`} /></Card> : null}
        <Button title={geo ? 'Recapture location' : 'Capture location'} loading={busy} variant={geo ? 'outline' : 'primary'} onPress={tagWhole} />
      </>)}
      {step === 3 && (<>
        <H2 style={{ marginBottom: 6 }}>QR tag for every room</H2><P style={{ marginBottom: 12 }}>{data.rooms.length} room(s) in this property. Generate tags, then stick one on each room.</P>
        {tags.length < data.rooms.length ? <Button title="Generate QR tags" loading={busy} onPress={genQr} /> :
          tags.map((x) => <View key={x.roomId} style={{ marginBottom: 12 }}><QRTag code={x.code} room={x.room} property={p.name} size={110} /></View>)}
      </>)}
      {step === 4 && (<>
        <H2 style={{ marginBottom: 8 }}>Checklist</H2>
        {Object.entries(CHECK).map(([k, l]) => {
          const auto = { tenantKycVerified: kycOk, geoTagged: !!geo, qrApplied: tags.length === data.rooms.length }; const on = k in auto ? auto[k] : checks[k];
          return <Pressable key={k} disabled={k in auto} onPress={() => setChecks({ ...checks, [k]: !checks[k] })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
            <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: on ? t.success : t.border, backgroundColor: on ? t.success : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>{on ? <Text style={{ color: '#fff' }}>✓</Text> : null}</View>
            <Text style={{ color: t.textPrimary, flex: 1 }}>{l}</Text></Pressable>; })}
        <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
        <Card style={{ marginTop: 6 }}><H2 style={{ fontSize: 15 }}>Can’t verify?</H2><Input placeholder="Reason" value={reason} onChangeText={setReason} />
          <View style={{ flexDirection: 'row' }}><Button title="Revisit later" variant="outline" disabled={!reason.trim() || busy} onPress={() => flag('revisit')} style={{ flex: 1, marginRight: 8 }} />
            <Button title="Reject" variant="outline" disabled={!reason.trim() || busy} onPress={() => flag('reject')} style={{ flex: 1 }} /></View></Card>
      </>)}
    </ScrollView>
    {err ? <Text style={{ color: t.error, marginVertical: 6 }}>{err}</Text> : null}
    <View style={{ flexDirection: 'row', paddingTop: 8 }}>
      {step > 0 ? <Button title="Back" variant="outline" onPress={() => setStep(step - 1)} style={{ flex: 1, marginRight: 8 }} /> : null}
      <Button title={step === STEPS.length - 1 ? 'Submit verification' : 'Next'} loading={busy && step === STEPS.length - 1} onPress={() => (step === STEPS.length - 1 ? submit() : setStep(step + 1))} style={{ flex: 2 }} />
    </View>
  </>);
}
