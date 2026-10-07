import React from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { Card, H2, P, Chip, Button, Async, Empty, inr } from '../components/ui';
import { t, statusTone } from '../theme';
import { useApi } from '../api';
import { useSession } from '../session';

const Spine = ({ s }) => {
  const items = [['Property', s.properties], ['Rooms', s.rooms], ['Occupied', s.occupied], ['Vacant', s.vacant], ['Placement', s.inPlacement]];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
      {items.map(([l, n], i) => (
        <React.Fragment key={l}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <View style={{ minWidth: 40, height: 40, borderRadius: 20, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontWeight: '900', color: t.primaryDark }}>{n}</Text></View>
            <Text style={{ fontSize: 10, color: t.textSecondary, marginTop: 3 }}>{l}</Text>
          </View>
          {i < items.length - 1 ? <Text style={{ color: t.disabled }}>›</Text> : null}
        </React.Fragment>
      ))}
    </View>
  );
};
const Kpi = ({ label, value, tone }) => (
  <Card style={{ width: '48%', marginBottom: 12 }}><Text style={{ color: t.textSecondary, fontSize: 12 }}>{label}</Text><Text style={{ fontSize: 22, fontWeight: '900', color: tone ?? t.textPrimary }}>{value}</Text></Card>
);

export default function OwnerDashboard({ navigation }) {
  const { name } = useSession();
  const state = useApi('/owner/dashboard');
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      <H2 style={{ marginBottom: 12 }}>Owner dashboard</H2>
      <Async state={state}>{(d) => {
        const attention = d.rooms.filter((r) => r.awaitingOwner);
        return (<>
          <Spine s={d.spine} />
          <H2 style={{ marginBottom: 8 }}>Needs your attention</H2>
          {attention.length === 0 ? <Card style={{ marginBottom: 14 }}><P>Nothing pending. We'll notify you when a tenant checks out.</P></Card> :
            attention.map((r) => (
              <Card key={r.id} style={{ marginBottom: 12, borderLeftWidth: 4, borderLeftColor: t.warning }}>
                <Chip label="Checkout request" color={t.warning} />
                <H2 style={{ marginTop: 8 }}>{r.name} tenant is moving out</H2>
                <P style={{ marginBottom: 10 }}>Tenant says checkout on {r.tenantCheckoutDate}. Please confirm or tell us if it's wrong.</P>
                <Button title="Review checkout" onPress={() => navigation.navigate('OwnerCheckout', { roomId: r.id })} />
              </Card>))}
          <H2 style={{ marginBottom: 8 }}>Commission</H2>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <Kpi label="Potential (if placed in 7 days)" value={inr(d.commission.potential)} />
            <Kpi label="Due" value={inr(d.commission.due)} tone={d.commission.due ? t.warning : undefined} />
            <Kpi label="Paid" value={inr(d.commission.paid)} tone={t.success} />
            <Kpi label="Waived" value={inr(d.commission.waived)} tone={t.primary} />
          </View>
          <Button title="Commission details" variant="outline" onPress={() => navigation.navigate('Commission')} style={{ marginBottom: 16 }} />
          <H2 style={{ marginBottom: 8 }}>Rooms</H2>
          {d.rooms.length === 0 ? <Empty title="No rooms yet" sub="Rooms appear after your property is verified." /> :
            d.rooms.map((r) => (
              <Card key={r.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View><Text style={{ fontWeight: '800', color: t.textPrimary }}>{r.name}</Text><P>{inr(r.rent)}/month</P></View>
                  <Chip label={r.status.replace(/_/g, ' ')} color={statusTone[r.status] ?? t.secondary} />
                </View>
                {r.vacancy ? <P style={{ marginTop: 6 }}>{r.vacancy.label}</P> : null}
              </Card>))}
          <Pressable onPress={() => navigation.navigate('Consent', { review: true })}><P style={{ textAlign: 'center', color: t.primary, marginTop: 8 }}>View your listing agreement</P></Pressable>
        </>);
      }}</Async>
    </ScrollView>
  );
}
