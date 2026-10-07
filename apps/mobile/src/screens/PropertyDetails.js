import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, Linking, Image, Dimensions, Pressable } from 'react-native';
import { Card, H1, H2, P, Chip, Button, Row, Async, inr } from '../components/ui';
import { FURN } from '../components/PropertyCard';
import { t, textSize } from '../theme';
import { api, useApi, BASE } from '../api';
import Icon from '../components/Icon';

export const CASHBACK_WHY = {
  NO_TOKEN: 'Register a property you live in to earn cashback on future bookings.',
  TOKEN_NOT_READY: 'Your cashback unlocks when you scan the room QR at checkout.',
  FIRST_BOOKING: 'Cashback applies from your next booking.',
};

export default function PropertyDetails({ route, navigation }) {
  const { roomId, coords } = route.params;
  const [saved, setSaved] = useState(false);
  useEffect(() => { api('/saved').then((d) => setSaved(d.ids.includes(roomId))).catch(() => {}); }, [roomId]);
  const toggle = async () => { try { const r = await api(`/saved/${roomId}`, { method: 'POST' }); setSaved(r.saved); } catch {} };
  const state = useApi(`/listings/${roomId}` + (coords ? `?lat=${coords.lat}&lng=${coords.lng}` : ''));
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <Async state={state}>{(d) => (<>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ height: 230, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
            {d.photos?.length ? <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ position: 'absolute', width: '100%', height: 230 }}>{d.photos.map((u) => <Image key={u} source={{ uri: BASE + u }} style={{ width: Dimensions.get('window').width, height: 230 }} resizeMode="cover" />)}</ScrollView> : <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="home" size={42} color={t.primaryDark} /></View>}
            <Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Remove saved home' : 'Save home'} style={{ position: 'absolute', top: 16, right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }} onPress={toggle}><Icon name="heart" size={23} color={saved ? t.error : t.primaryDark} strokeWidth={saved ? 2.6 : 1.8} /></Pressable></View>
          <View style={{ padding: 16 }}>
            <Chip label="✓ Verified in person" color={t.success} />
            <H1 style={{ fontSize: textSize(22), marginTop: 8 }}>{d.title}</H1>
            <P>{d.room} · {d.locality}{d.distanceKm != null ? ` · ${d.distanceKm} km away` : ''}</P>
            <Text style={{ fontSize: textSize(26), fontWeight: '900', color: t.primary, marginVertical: 10 }}>{inr(d.rent)}<Text style={{ fontSize: textSize(13), color: t.textSecondary }}> /month</Text></Text>
            <Card style={{ marginBottom: 14 }}>
              <Row label="Type" value={d.type} /><Row label="Room" value={d.roomType} /><Row label="Bedrooms" value={String(d.beds)} /><Row label="Bathrooms" value={String(d.baths)} /><Row label="Furnishing" value={FURN[d.furnished]} /><Row label="Availability" value="Available now" />
            </Card>
            <H2 style={{ marginBottom: 8 }}>About</H2><P style={{ marginBottom: 14 }}>{d.description}</P>
            <H2 style={{ marginBottom: 8 }}>Amenities</H2>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 }}>{d.amenities.map((a) => <View key={a} style={{ marginRight: 8, marginBottom: 8 }}><Chip label={a} /></View>)}</View>
            <H2 style={{ marginBottom: 8 }}>Location</H2>
            <Card style={{ marginBottom: 14 }}><P>{d.address}</P>
              {d.geo ? <Button title="Open in Maps" variant="outline" onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${d.geo.lat},${d.geo.lng}`)} style={{ marginTop: 10 }} /> : null}</Card>
            <H2 style={{ marginBottom: 8 }}>Owner</H2>
            <Card style={{ marginBottom: 14 }}><Text style={{ fontWeight: '800', color: t.textPrimary }}>{d.owner.firstName} · Verified owner</Text><P>Full contact details are shared after your booking is confirmed.</P></Card>
            <Card style={{ backgroundColor: t.accent }}>
              <Text style={{ fontWeight: '800', color: t.primaryDark }}>{d.quote.cashback > 0 ? `You save ${inr(d.quote.cashback)} with your cashback` : 'Cashback'}</Text>
              <P>{d.quote.cashback > 0 ? `Pay ${inr(d.quote.payable)} for your first month instead of ${inr(d.rent)}.` : CASHBACK_WHY[d.quote.reason]}</P>
            </Card>
          </View>
        </ScrollView>
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: t.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
          <Button title="Book now" onPress={() => navigation.navigate('BookProperty', { listing: d })} />
        </View>
      </>)}</Async>
    </View>
  );
}
