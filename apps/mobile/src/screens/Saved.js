import React from 'react';
import { ScrollView } from 'react-native';
import { H2, Async, Empty } from '../components/ui';
import PropertyCard from '../components/PropertyCard';
import { t } from '../theme';
import { useApi } from '../api';

export default function Saved({ navigation }) {
  const state = useApi('/saved');
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <H2 style={{ marginBottom: 12 }}>Saved homes</H2>
      <Async state={state}>{(d) => d.rows.length === 0 ? <Empty title="Nothing saved yet" sub="Tap the heart on a home to save it here." /> :
        d.rows.map((r) => <PropertyCard key={r.roomId} item={r} onPress={() => navigation.navigate('PropertyDetails', { roomId: r.roomId })} />)}</Async>
    </ScrollView>
  );
}
