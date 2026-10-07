import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { Card, H1, H2, P, Chip, Button, Row, Timeline, Async, Empty, inr } from '../components/ui';
import { t } from '../theme';
import { useApi } from '../api';
import Icon from '../components/Icon';

const STEPS = [{ label: 'Property submitted' }, { label: 'Agent assigned' }, { label: 'Visit scheduled' }, { label: 'Verification in progress' }, { label: 'Property verified' }];
const CURRENT = { PENDING: 0, ASSIGNED: 1, SCHEDULED: 2, IN_PROGRESS: 3, COMPLETED: 5 };
const HEAD = { PENDING: 'Waiting for an agent', ASSIGNED: 'Agent assigned', SCHEDULED: 'Visit scheduled', IN_PROGRESS: 'Verification in progress', COMPLETED: 'Property verified', FAILED: 'We couldn’t verify this property', REVISIT: 'Agent will visit again' };

// Registration status: agent visit pending/scheduled/assigned/in progress/completed/failed + KYC + owner + cashback token.
export default function PropertyStatus({ route, navigation }) {
  const state = useApi('/properties/mine');
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      {route.params?.justSubmitted ? <Card style={{ backgroundColor: t.primary, marginBottom: 14 }}>
        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}><Icon name="check" size={28} color="#fff" strokeWidth={2.4} /></View><Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginVertical: 4 }}>Property submitted!</Text>
        <Text style={{ color: '#E6FAF8' }}>An agent will visit soon. Your cashback token is added once your property is verified.</Text></Card> : null}
      <H2 style={{ marginBottom: 12 }}>Your registered property</H2>
      <Async state={state}>{(d) => d.rows.length === 0 ? <View><Empty title="Nothing registered yet" sub="Register the home you live in to earn a 30% cashback token." /><Button title="Register property" onPress={() => navigation.navigate('RegisterProperty')} /></View> :
        d.rows.map((p) => (
          <View key={p.id} style={{ marginBottom: 20 }}>
            <Card style={{ marginBottom: 12 }}>
              <Chip label={HEAD[p.stage]} color={p.stage === 'COMPLETED' ? t.success : p.stage === 'FAILED' ? t.error : p.stage === 'REVISIT' ? t.info : t.primary} />
              <H1 style={{ fontSize: 20, marginTop: 8 }}>{p.name}</H1><P>{p.locality} · {p.rooms} room(s)</P>
              {p.stage === 'FAILED' || p.stage === 'REVISIT' ? <P style={{ marginTop: 8, color: p.stage === 'FAILED' ? t.error : t.info }}>{p.reason}</P> : <View style={{ marginTop: 14 }}><Timeline steps={STEPS} current={CURRENT[p.stage] ?? 0} /></View>}
            </Card>
            <Card style={{ marginBottom: 12 }}>
              <Row label="Agent" value={p.agent ?? 'Being assigned'} /><Row label="Visit" value={p.visit} />
              <Row label="Your KYC" value={{ NOT_STARTED: 'Not started', PENDING: 'Under review', VERIFIED: 'Verified', REJECTED: 'Needs re-upload' }[p.kyc]} />
              <Row label="Owner" value={p.ownerConsent ? 'Agreed to list' : 'We’ll contact them'} />
              {p.kyc !== 'VERIFIED' ? <Button title="Complete KYC" variant="outline" onPress={() => navigation.navigate('KYC')} style={{ marginTop: 8 }} /> : null}
            </Card>
            <Card>
              <Chip label={p.token ? 'Saved for later' : 'After verification'} color={p.token ? t.info : t.disabled} />
              <H2 style={{ marginTop: 8 }}>{inr(p.token ? p.token.amount : p.expectedToken)} cashback token</H2>
              <P>{p.token ? 'Your token is safe. Scan the room QR when you move out to make it ready to use.' : '30% of one month’s rent. No payment needed — it’s added when your property is verified.'}</P>
            </Card>
          </View>))}</Async>
    </ScrollView>
  );
}
