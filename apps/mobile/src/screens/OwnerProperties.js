import React from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { Card, H2, P, Chip, Async, Empty } from '../components/ui';
import { t } from '../theme';
import { useApi } from '../api';

// PROPERTY → ROOM → TENANT → OCCUPIED/VACANT → PLACEMENT → COMMISSION: this is the PROPERTY level.
export default function OwnerProperties({ navigation }) {
  const state = useApi('/owner/properties');
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
      <H2 style={{ marginBottom: 12 }}>My properties</H2>
      <Async state={state}>{(d) => d.rows.length === 0
        ? <Empty title="No properties yet" sub="When a tenant registers one of your properties and you agree to list it, it appears here." />
        : d.rows.map((p) => (
          <Pressable key={p.id} onPress={() => navigation.navigate('OwnerProperty', { id: p.id })}>
            <Card style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontWeight: '800', color: t.textPrimary, fontSize: 16, flex: 1 }}>{p.name}</Text>
                <Chip label={p.verified ? 'Verified' : 'Being verified'} color={p.verified ? t.success : t.warning} />
              </View>
              <P>{p.locality}{p.type ? ` · ${p.type}` : ''}</P>
              <View style={{ flexDirection: 'row', marginTop: 10 }}>
                {[['Rooms', p.rooms, t.textPrimary], ['Occupied', p.occupied, t.primary], ['Vacant', p.vacant, t.warning]].map(([l, n, c]) => (
                  <View key={l} style={{ marginRight: 24 }}><Text style={{ fontSize: 20, fontWeight: '900', color: c }}>{n}</Text><Text style={{ fontSize: 11, color: t.textSecondary }}>{l}</Text></View>))}
              </View>
            </Card>
          </Pressable>))}</Async>
    </ScrollView>
  );
}
