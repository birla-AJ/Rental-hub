import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { Screen, H1, H2, P, Button, Card } from '../components/ui';
import { t } from '../theme';
import { api, useApi } from '../api';
import Icon from '../components/Icon';

// Owner consent flow. Wording is locked by the business plan — do not soften or rename.
const PAGES = [
  { icon: 'home', title: 'Your property is already registered', body: 'A tenant living in your property has registered it with RentalHub, and our agent has verified it. Here is what that means for you.' },
  { icon: 'wallet', title: 'No upfront payment', body: 'You pay nothing to join. No registration fee, no subscription. Tracking your rooms and records on your dashboard is free.' },
  { icon: 'handshake', title: 'Commission only on success', body: 'If we place a new tenant in a vacant room, you pay 20% of one month’s rent — once. If we don’t place anyone, you pay nothing.' },
  { icon: 'clock', title: 'The 7-day window', body: 'When a tenant leaves and both of you confirm, we start finding a new tenant. The 7-day window begins from that confirmation.' },
  { icon: 'check', title: 'Vacancy guarantee = commission waiver', body: 'If it takes more than 7 days, you pay no commission and we keep trying at no charge.', note: 'This is not compensation for lost rent. RentalHub does not pay you money if a room stays vacant.' },
  { icon: 'location', title: 'What’s covered', body: 'This applies to rooms we help fill. Rooms where you find a tenant yourself are outside this service. Repair coordination is not part of the base service.' },
];
export default function Consent({ navigation, route }) {
  const state = useApi('/owner/consents');   // properties a tenant already registered under this owner's mobile number
  if (state.loading) return <Screen style={{ justifyContent: 'center', alignItems: 'center' }}><Text>Loading…</Text></Screen>;
  const pending = state.data?.rows?.[0] ?? null;
  const review = route.params?.review;   // opened from the dashboard to re-read the agreement
  useEffect(() => { if (!state.loading && !pending && !review) navigation.reset({ index: 0, routes: [{ name: 'Main' }] }); }, [state.loading, pending, review]);
  if (!pending && !review) return null;
  return <Flow navigation={navigation} pending={pending} />;
}

function Flow({ navigation, pending }) {
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(null);
  const respond = async (accept) => { setBusy(true); setErr(null);
    try { if (pending) await api(`/owner/consent/${pending.id}`, { method: 'POST', body: { accept } }); if (accept) setDone(true); else navigation.reset({ index: 0, routes: [{ name: 'Main' }] }); }
    catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const [agree, setAgree] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return (
    <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 76, height: 76, borderRadius: 28, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="party" size={40} color={t.primaryDark} /></View><H1 style={{ marginVertical: 8 }}>You’re all set</H1>
      <P style={{ textAlign: 'center', marginBottom: 20 }}>Your property is now active. We’ll tell you when a room needs your attention.</P>
      <Button title="Go to dashboard" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] })} style={{ alignSelf: 'stretch' }} />
    </Screen>);
  const last = i === PAGES.length;
  const p = i === 0 && pending ? { ...PAGES[0], body: `${pending.tenantFirstName}, who lives at ${pending.name} (${pending.locality}), registered it with RentalHub, and our agent is verifying it. Here is what that means for you.` } : PAGES[i];
  return (
    <Screen>
      <View style={{ flexDirection: 'row', marginBottom: 20 }}>{[...PAGES, 0].map((_, k) => <View key={k} style={{ flex: 1, height: 5, borderRadius: 3, marginRight: 4, backgroundColor: k <= i ? t.primary : t.border }} />)}</View>
      {!last ? (<ScrollView>
        <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name={p.icon} size={36} color={t.primaryDark} /></View>
        <H1 style={{ fontSize: 24, marginVertical: 10 }}>{p.title}</H1>
        <P style={{ fontSize: 16, lineHeight: 24 }}>{p.body}</P>
        {p.note ? <Card style={{ marginTop: 14, backgroundColor: t.accent }}><Text style={{ color: t.primaryDark, fontWeight: '700' }}>{p.note}</Text></Card> : null}
      </ScrollView>) : (<ScrollView>
        <H1 style={{ fontSize: 24, marginBottom: 10 }}>Agree to list with RentalHub</H1>
        <Card style={{ marginBottom: 14 }}>
          <P>• No upfront payment{'\n'}• 20% of one month’s rent, only on successful placement{'\n'}• More than 7 days = no commission{'\n'}• Not compensation for lost rent</P>
        </Card>
        <Pressable onPress={() => setAgree(!agree)} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: t.primary, backgroundColor: agree ? t.primary : 'transparent', marginRight: 10, alignItems: 'center', justifyContent: 'center' }}>{agree ? <Text style={{ color: '#fff' }}>✓</Text> : null}</View>
          <Text style={{ flex: 1, color: t.textPrimary }}>I agree to let RentalHub list and market my property when a room becomes vacant.</Text>
        </Pressable>
      </ScrollView>)}
      <View style={{ flexDirection: 'row', paddingTop: 12 }}>
        {i > 0 ? <Button title="Back" variant="outline" onPress={() => setI(i - 1)} style={{ flex: 1, marginRight: 8 }} /> : null}
        <Button title={last ? (pending ? 'Accept & activate' : 'Done') : 'Next'} loading={busy} disabled={last && pending && !agree} onPress={() => (last ? (pending ? respond(true) : navigation.reset({ index: 0, routes: [{ name: 'Main' }] })) : setI(i + 1))} style={{ flex: 2 }} />
      </View>
      {err ? <Text style={{ color: t.error, marginTop: 6 }}>{err}</Text> : null}
      {last && pending ? <Pressable onPress={() => respond(false)}><P style={{ textAlign: 'center', marginTop: 10 }}>Not now</P></Pressable> : null}
    </Screen>);
}
