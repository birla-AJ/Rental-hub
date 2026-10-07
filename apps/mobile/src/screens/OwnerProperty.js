import React from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { Card, H1, H2, P, Chip, Row, Async, inr } from '../components/ui';
import { t, statusTone } from '../theme';
import { useApi } from '../api';
import Icon from '../components/Icon';

export default function OwnerProperty({ route, navigation }) {
  const state = useApi(`/owner/properties/${route.params.id}`);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Async state={state}>{({ property: p, rooms }) => (<>
        <Chip label={p.verified ? '✓ Verified in person' : 'Verification in progress'} color={p.verified ? t.success : t.warning} />
        <H1 style={{ fontSize: 22, marginVertical: 8 }}>{p.name}</H1><P style={{ marginBottom: 12 }}>{p.address}</P>
        <Card style={{ marginBottom: 14 }}>
          <Row label="Location pinned" value={p.geoTagged ? 'Whole property ✓' : 'Not yet'} /><Row label="Verified on" value={p.verifiedAt ? p.verifiedAt.slice(0, 10) : '—'} />
          <Row label="You agreed to list" value={p.agreedAt ? p.agreedAt.slice(0, 10) : '—'} />
        </Card>
        <H2 style={{ marginBottom: 8 }}>Rooms</H2>
        {rooms.map((r) => (
          <Pressable key={r.id} onPress={() => navigation.navigate('OwnerRoom', { id: r.id })}>
            <Card style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View><Text style={{ fontWeight: '800', color: t.textPrimary }}>{r.name}</Text><P>{inr(r.rent)}/month</P></View>
                <Chip label={r.status.replace(/_/g, ' ')} color={statusTone[r.status] ?? t.secondary} />
              </View>
              {r.tenant ? <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}><Icon name="user" size={15} color={t.textSecondary} /><P style={{ marginLeft: 5 }}>{r.tenant.name}</P></View> : null}
              {r.vacancy ? <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}><Icon name="clock" size={15} color={t.textSecondary} /><P style={{ marginLeft: 5 }}>{r.vacancy.label}</P></View> : null}
              {r.incoming ? <P style={{ marginTop: 6, color: t.info }}>New tenant found: {r.incoming.tenantFirstName} · moving in {r.incoming.moveInDate}</P> : null}
            </Card>
          </Pressable>))}
      </>)}</Async>
    </ScrollView>
  );
}
