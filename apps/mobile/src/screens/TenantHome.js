import React from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { Card, H2, P, Button, Chip, Async, inr } from '../components/ui';
import { t, statusTone, textSize } from '../theme';
import { useApi } from '../api';
import { LadderCards } from './Wallet';

const STAGE = { PENDING: 'Waiting for an agent', ASSIGNED: 'Agent assigned', SCHEDULED: 'Visit scheduled', IN_PROGRESS: 'Verification in progress', COMPLETED: 'Verified', FAILED: 'Not verified', REVISIT: 'Agent will revisit' };

// "What needs my attention?" — current stay, booking, registered property, cashback.
export default function TenantHome({ navigation }) {
  const state = useApi('/home');
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
      <Async state={state}>{(h) => (<>
        <H2 style={{ marginBottom: 14, marginTop: 4 }}>Namaste, {h.name.split(' ')[0] || 'there'}</H2>

        {h.current ? (
          <Card style={{ marginBottom: 14 }}>
            <Chip label={h.current.status === 'CHECKOUT_REQUESTED' ? 'CHECKOUT IN PROGRESS' : 'OCCUPIED'} color={statusTone.OCCUPIED} />
            <H2 style={{ marginTop: 8 }}>{h.current.property}, {h.current.locality}</H2><P>{h.current.room} · {inr(h.current.rent)}/month</P>
            <View style={{ height: 12 }} />
            <Button title={h.current.status === 'CHECKOUT_REQUESTED' ? 'Continue checkout' : 'I’m moving out'} variant="outline" disabled={!h.current.tagReady}
              onPress={() => navigation.navigate('Checkout', { roomId: h.current.roomId })} />
            <P style={{ marginTop: 8, fontSize: 12 }}>{h.current.tagReady ? 'Scan QR at checkout to activate your cashback eligibility.' : 'Your room tag will be added when our agent verifies the property.'}</P>
          </Card>) : null}

        {h.booking ? (
          <Pressable onPress={() => navigation.navigate('BookingDetails', { id: h.booking.id })}><Card style={{ marginBottom: 14, borderLeftWidth: 4, borderLeftColor: t.info }}>
            <Chip label="BOOKING" color={t.info} /><H2 style={{ marginTop: 8 }}>{h.booking.room}</H2><P>{h.booking.status === 'PENDING' ? 'Paid — we’re confirming your room.' : h.booking.status === 'CONFIRMED' ? 'Confirmed! Move-in is coming up.' : 'Finish your payment to hold the room.'}</P></Card></Pressable>) : null}

        {h.registered.length ? (
          <Pressable onPress={() => navigation.navigate('PropertyStatus')}><Card style={{ marginBottom: 14 }}>
            <Chip label="YOUR REGISTERED PROPERTY" color={t.primary} /><H2 style={{ marginTop: 8 }}>{h.registered[0].name}</H2><P>{STAGE[h.registered[0].stage]} · tap for details</P></Card></Pressable>
        ) : (
          <Card style={{ marginBottom: 14, backgroundColor: t.primary }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Earn cashback by registering a property</Text>
            <Text style={{ color: '#E6FAF8', marginTop: 4, marginBottom: 12 }}>Add the home you live in. Get a 30% cashback token — no payment needed.</Text>
            <Button title="Register property" onPress={() => navigation.navigate('RegisterProperty')} style={{ backgroundColor: '#fff' }} />
          </Card>)}

        <Pressable onPress={() => navigation.navigate('Wallet')}><Card style={{ marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
          <View><P>Ready to use</P><Text style={{ fontSize: textSize(20), fontWeight: '900', color: t.success }}>{inr(h.wallet.available)}</Text></View>
          <View style={{ alignItems: 'flex-end' }}><P>Saved for later</P><Text style={{ fontSize: textSize(20), fontWeight: '900', color: t.info }}>{inr(h.wallet.saved)}</Text></View></Card></Pressable>

        <H2 style={{ marginBottom: 8 }}>How your cashback grows</H2>
        <LadderCards />
      </>)}</Async>
    </ScrollView>
  );
}
