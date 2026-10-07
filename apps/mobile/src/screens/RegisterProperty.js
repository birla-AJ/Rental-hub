import React, { useState } from 'react';
import { ScrollView, View, Text, Switch, Image } from 'react-native';
import { pickPhotos, pickVideo, readBase64 } from '../native/media';
import { Screen, H1, H2, P, Button, Input, Card, Chip, Row, inr } from '../components/ui';
import { t } from '../theme';
import { api } from '../api';

const STEPS = ['Property', 'Room & rent', 'Amenities', 'Photos & video', 'Owner & visit', 'Review'];
const TYPES = ['PG', 'Flat', 'House', 'Room'];
const ROOM_TYPES = ['Single', 'Double sharing', '1BHK', '2BHK', '3BHK'];
const AMEN = ['WiFi', 'Meals', 'AC', 'Parking', 'Laundry', 'Lift', 'Security', 'Power backup'];

const Pills = ({ items, on, onPress }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>{items.map((x) => <View key={x} style={{ marginRight: 8, marginBottom: 8 }}>
    <Button title={x} variant={on(x) ? 'primary' : 'outline'} onPress={() => onPress(x)} style={{ height: 40, paddingHorizontal: 16 }} /></View>)}</View>);

export default function RegisterProperty({ navigation }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: '', type: 'PG', address: '', locality: '', roomName: '', roomType: 'Single', rent: '', totalRooms: '1', movedInOn: '', amenities: [], notes: '',
    photos: [], video: null, ownerName: '', ownerPhone: '', agentVisit: true });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(null), [err, setErr] = useState(null);
  const [uploaded, setUploaded] = useState({});   // uri -> server ref, so a retry never re-uploads finished files

  const errors = [
    f.name.trim().length < 2 ? 'Enter the property name' : f.address.trim().length < 10 ? 'Enter the full address (at least 10 characters)' : !f.locality.trim() ? 'Enter the locality' : null,
    !f.roomName.trim() ? 'Enter your room name or number' : !/^\d+$/.test(f.rent) || +f.rent < 500 || +f.rent > 500000 ? 'Enter monthly rent between ₹500 and ₹5,00,000'
      : !/^\d+$/.test(f.totalRooms) || +f.totalRooms < 1 || +f.totalRooms > 50 ? 'Total rooms must be between 1 and 50'
      : f.movedInOn && !/^\d{4}-\d{2}-\d{2}$/.test(f.movedInOn) ? 'Move-in date should look like 2025-06-15' : null,
    null,
    f.photos.length < 3 ? `Add at least 3 photos (${f.photos.length} added)` : null,
    f.ownerName.trim().length < 2 ? 'Enter the owner’s name' : !/^[6-9]\d{9}$/.test(f.ownerPhone) ? 'Enter the owner’s 10-digit mobile number' : !f.agentVisit ? 'An agent visit is needed to verify your property' : null,
    null,
  ];

  async function addPhotos() {
    try { const got = await pickPhotos(12 - f.photos.length); if (got.length) set('photos')([...f.photos, ...got].slice(0, 12)); setErr(null); } catch (e) { setErr(e.message); }
  }
  async function addVideo() {
    try { const v = await pickVideo(); if (v) { setErr(null); set('video')(v); } } catch (e) { setErr(e.message); }
  }

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const refs = []; const items = [...f.photos, ...(f.video ? [f.video] : [])];
      for (let i = 0; i < items.length; i++) {
        const it = items[i]; setProgress(`Uploading ${i + 1} of ${items.length}…`);
        let ref = uploaded[it.uri];
        if (!ref) {
          const data = it.base64 ?? (await readBase64(it.uri));
          ref = (await api('/uploads', { method: 'POST', body: { contentType: it.type, data } })).ref; setUploaded((u) => ({ ...u, [it.uri]: ref }));
        }
        refs.push(ref);
      }
      setProgress('Submitting…');
      const photos = refs.slice(0, f.photos.length), video = f.video ? refs[refs.length - 1] : undefined;
      await api('/properties', { method: 'POST', body: { name: f.name, type: f.type, address: f.address, locality: f.locality, roomName: f.roomName, roomType: f.roomType, rent: +f.rent,
        totalRooms: +f.totalRooms, movedInOn: f.movedInOn || undefined, amenities: f.amenities, notes: f.notes, photos, video, ownerName: f.ownerName, ownerPhone: f.ownerPhone, agentVisit: f.agentVisit } });
      navigation.replace('PropertyStatus', { justSubmitted: true });
    } catch (e) { setErr(e.message === 'Network request failed' ? 'No connection. Your details are saved here — try again.' : e.message); }
    finally { setBusy(false); setProgress(null); }
  }

  return (
    <Screen>
      <H1 style={{ fontSize: 22 }}>Register property</H1>
      <P style={{ marginBottom: 10 }}>Step {step + 1} of {STEPS.length} · {STEPS[step]}</P>
      <View style={{ flexDirection: 'row', marginBottom: 16 }}>{STEPS.map((s, i) => <View key={s} style={{ flex: 1, height: 5, borderRadius: 3, marginRight: 4, backgroundColor: i <= step ? t.primary : t.border }} />)}</View>
      <ScrollView keyboardShouldPersistTaps="handled">
        {step === 0 && (<>
          <Input label="Property name" value={f.name} onChangeText={set('name')} placeholder="Shree Residency" />
          <Text style={{ fontWeight: '600', color: t.textPrimary, marginBottom: 6 }}>Property type</Text>
          <Pills items={TYPES} on={(x) => f.type === x} onPress={set('type')} />
          <Input label="Full address" value={f.address} onChangeText={set('address')} placeholder="Plot 12, Scheme 78, Vijay Nagar, Indore" multiline />
          <Input label="Locality" value={f.locality} onChangeText={set('locality')} placeholder="Vijay Nagar" />
          <P>Our agent will pin the exact location of the whole property during the visit.</P>
        </>)}
        {step === 1 && (<>
          <Input label="Your room name / number" value={f.roomName} onChangeText={set('roomName')} placeholder="Room 101" />
          <Text style={{ fontWeight: '600', color: t.textPrimary, marginBottom: 6 }}>Room type</Text>
          <Pills items={ROOM_TYPES} on={(x) => f.roomType === x} onPress={set('roomType')} />
          <Input label="Your monthly rent (₹)" keyboardType="number-pad" value={f.rent} onChangeText={set('rent')} placeholder="8500" />
          <Input label="Total rooms in the property" keyboardType="number-pad" value={f.totalRooms} onChangeText={set('totalRooms')} />
          <Input label="You moved in on (optional)" value={f.movedInOn} onChangeText={set('movedInOn')} placeholder="2025-06-15" />
          <P>Every room gets its own QR tag when our agent verifies the property.</P>
        </>)}
        {step === 2 && (<>
          <Text style={{ fontWeight: '600', color: t.textPrimary, marginBottom: 6 }}>What does the property offer?</Text>
          <Pills items={AMEN} on={(x) => f.amenities.includes(x)} onPress={(x) => set('amenities')(f.amenities.includes(x) ? f.amenities.filter((a) => a !== x) : [...f.amenities, x])} />
          <Input label="Anything else we should know? (optional)" value={f.notes} onChangeText={set('notes')} multiline />
        </>)}
        {step === 3 && (<>
          <Card style={{ marginBottom: 12 }}><H2>Photos ({f.photos.length}/12)</H2><P style={{ marginBottom: 10 }}>Add at least 3 clear photos — rooms, bathroom, building.</P>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>{f.photos.map((p, i) => <Image key={p.uri + i} source={{ uri: p.uri }} style={{ width: 72, height: 72, borderRadius: 12, marginRight: 8, marginBottom: 8 }} />)}</View>
            <Button title="Add photos" variant="outline" onPress={addPhotos} disabled={f.photos.length >= 12} />
            {f.photos.length ? <Button title="Remove last photo" variant="outline" onPress={() => set('photos')(f.photos.slice(0, -1))} style={{ marginTop: 8, height: 40 }} /> : null}</Card>
          <Card><H2>Video {f.video ? '✓' : '(optional)'}</H2><P style={{ marginBottom: 10 }}>A short walkthrough (up to 25 MB) helps verification.</P>
            <Button title={f.video ? 'Replace video' : 'Add video'} variant="outline" onPress={addVideo} /></Card>
        </>)}
        {step === 4 && (<>
          <Input label="Owner name" value={f.ownerName} onChangeText={set('ownerName')} />
          <Input label="Owner mobile number" keyboardType="number-pad" maxLength={10} value={f.ownerPhone} onChangeText={set('ownerPhone')} />
          <P style={{ marginBottom: 12 }}>We’ll contact your owner only after you submit. They pay nothing to join.</P>
          <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', color: t.textPrimary }}>Allow agent visit</Text><P>An agent will visit to verify your KYC and the property.</P></View>
            <Switch value={f.agentVisit} onValueChange={set('agentVisit')} trackColor={{ true: t.primary }} />
          </Card>
        </>)}
        {step === 5 && (
          <Card>
            <Row label="Property" value={f.name} /><Row label="Type" value={f.type} /><Row label="Locality" value={f.locality} /><Row label="Your room" value={`${f.roomName} · ${f.roomType}`} />
            <Row label="Rent" value={inr(f.rent || 0)} /><Row label="Total rooms" value={f.totalRooms} /><Row label="Photos" value={String(f.photos.length)} /><Row label="Video" value={f.video ? 'Added' : '—'} />
            <Row label="Owner" value={`${f.ownerName} · ${f.ownerPhone}`} /><View style={{ height: 8 }} />
            <Chip label={`Cashback token: ${inr(Math.round((+f.rent || 0) * 0.3))}`} />
            <P style={{ marginTop: 8 }}>Added after our agent verifies your property, and saved for your next booking. No payment needed.</P>
          </Card>)}
      </ScrollView>
      {errors[step] ? <Text style={{ color: t.error, marginVertical: 6 }}>{errors[step]}</Text> : null}
      {err ? <Text style={{ color: t.error, marginVertical: 6 }}>{err}</Text> : null}
      {progress ? <Text style={{ color: t.textSecondary, marginVertical: 6 }}>{progress}</Text> : null}
      <View style={{ flexDirection: 'row', paddingTop: 8 }}>
        {step > 0 ? <Button title="Back" variant="outline" disabled={busy} onPress={() => setStep(step - 1)} style={{ flex: 1, marginRight: 8 }} /> : null}
        <Button title={step === STEPS.length - 1 ? 'Submit property' : 'Next'} loading={busy} disabled={!!errors[step]} onPress={() => (step === STEPS.length - 1 ? submit() : setStep(step + 1))} style={{ flex: 2 }} />
      </View>
    </Screen>
  );
}
