import React, { useState } from 'react';
import { ScrollView, View, Text, Image } from 'react-native';
import { Screen, H1, H2, P, Card, Chip, Button, Input, Timeline, Async } from '../components/ui';
import { t } from '../theme';
import { api, useApi } from '../api';
import { pickIdPhoto } from '../native/media';

const IDS = ['Aadhaar', 'PAN', 'Driving licence', 'Voter ID'];
const TONE = { PENDING: ['Under review', t.warning], VERIFIED: ['Verified', t.success], REJECTED: ['Rejected', t.error] };

// KYC: intro → details → ID type → submit → pending → verified / rejected → re-upload. History is kept.
export default function Kyc() {
  const state = useApi('/kyc');
  return <Screen><Async state={state}>{(d) => <Body d={d} reload={state.retry} />}</Async></Screen>;
}
function Body({ d, reload }) {
  const [form, setForm] = useState(false);
  const [idType, setIdType] = useState(null), [fullName, setFullName] = useState(''), [dob, setDob] = useState('');
  const [busy, setBusy] = useState(false), [err, setErr] = useState(null);
  const [photo, setPhoto] = useState(null), [ref, setRef] = useState(null);   // ref = already uploaded, so a retry never uploads twice
  const take = async (cam) => { try { const p = await pickIdPhoto(cam); if (p) { setPhoto(p); setRef(null); setErr(null); } } catch (e) { setErr(e.message); } };
  const last = d.history.at(-1);
  const submit = async () => { setBusy(true); setErr(null);
    try {
      let docRef = ref; if (!docRef) { docRef = (await api('/uploads', { method: 'POST', body: { purpose: 'kyc', contentType: photo.type, data: photo.base64 } })).ref; setRef(docRef); }
      await api('/kyc/submit', { method: 'POST', body: { idType, fullName, dob, docRef } }); setForm(false); setPhoto(null); setRef(null); reload();
    } catch (e) { setErr(e.message); } finally { setBusy(false); } };

  if (form) return (<ScrollView keyboardShouldPersistTaps="handled">
    <H1 style={{ fontSize: 22 }}>Verify your identity</H1><P style={{ marginBottom: 14 }}>Choose an ID you have with you. We never store your ID number.</P>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>{IDS.map((x) => <View key={x} style={{ marginRight: 8, marginBottom: 8 }}><Button title={x} variant={idType === x ? 'primary' : 'outline'} onPress={() => setIdType(x)} style={{ height: 40, paddingHorizontal: 14 }} /></View>)}</View>
    <Input label="Full name (as on ID)" value={fullName} onChangeText={setFullName} />
    <Input label="Date of birth (YYYY-MM-DD)" value={dob} onChangeText={setDob} keyboardType="numbers-and-punctuation" placeholder="1998-05-21" />
    <H2 style={{ fontSize: 15, marginBottom: 6 }}>Photo of your ID</H2>
    {photo ? <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 170, borderRadius: 12, marginBottom: 8 }} resizeMode="cover" /> : null}
    <View style={{ flexDirection: 'row', marginBottom: 6 }}><Button title="Take photo" variant="outline" onPress={() => take(true)} style={{ flex: 1, marginRight: 8, height: 44 }} /><Button title="Choose from gallery" variant="outline" onPress={() => take(false)} style={{ flex: 1, height: 44 }} /></View>
    <P style={{ fontSize: 12, marginBottom: 10 }}>Only our verification team (and your assigned agent) can see this photo. It is deleted 90 days after the decision. Our agent also checks your original ID in person.</P>
    {err ? <Text style={{ color: t.error, marginBottom: 8 }}>{err}</Text> : null}
    <Button title="Submit for review" loading={busy} disabled={!photo || !idType || fullName.trim().length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(dob)} onPress={submit} />
  </ScrollView>);

  const st = d.state;
  return (<ScrollView>
    <H1 style={{ fontSize: 22, marginBottom: 10 }}>KYC</H1>
    {st === 'VERIFIED' ? <Card style={{ marginBottom: 14 }}><Chip label="Verified ✓" color={t.success} /><H2 style={{ marginTop: 8 }}>Your identity is verified</H2><P>This verification stays with you and counts towards your rental trust profile.</P></Card>
      : st === 'PENDING' && last?.status === 'PENDING' ? <Card style={{ marginBottom: 14 }}><Chip label="Under review" color={t.warning} /><H2 style={{ marginTop: 8 }}>We’re checking your details</H2><P>You’ll get a notification as soon as it’s done.</P></Card>
      : st === 'REJECTED' ? <Card style={{ marginBottom: 14 }}><Chip label="Needs another look" color={t.error} /><H2 style={{ marginTop: 8 }}>We couldn’t verify your ID</H2><P style={{ marginBottom: 10 }}>{last?.reason}</P><Button title="Upload again" onPress={() => setForm(true)} /></Card>
      : <Card style={{ marginBottom: 14 }}><H2>Why KYC?</H2><P style={{ marginVertical: 8 }}>A verified identity builds your rental trust profile and helps owners say yes faster.</P><Button title="Start KYC" onPress={() => setForm(true)} /></Card>}
    {d.history.length ? (<><H2 style={{ marginBottom: 8 }}>KYC history</H2>
      <Card><Timeline steps={[...d.history].reverse().map((h) => ({ label: `${h.idType} — ${TONE[h.status][0]}`, sub: `${h.at.slice(0, 10)}${h.reason ? ` · ${h.reason}` : ''}` }))} current={0} /></Card></>) : null}
  </ScrollView>);
}
