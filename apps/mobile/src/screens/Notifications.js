import React from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { Card, H2, P, Async, Empty } from '../components/ui';
import { t } from '../theme';
import { api, useApi } from '../api';
import Icon from '../components/Icon';

const ICON = { CHECKOUT: 'door-open', CASHBACK: 'gift', VACANCY: 'clock', VERIFICATION: 'check', BOOKING: 'calendar', PLACEMENT: 'handshake', KYC: 'id-card', PAYMENT: 'credit-card', ALERT: 'alert' };
const ago = (iso) => { const m = Math.max(1, Math.round((Date.now() - +new Date(iso)) / 60000)); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

// Same screen for every role — the server only returns the caller's own notifications.
export default function Notifications() {
  const state = useApi('/notifications');
  const read = async (body) => { await api('/notifications/read', { method: 'POST', body }); state.retry(); };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <H2>Notifications</H2><Pressable onPress={() => read({ all: true })}><Text style={{ color: t.primary, fontWeight: '700' }}>Mark all read</Text></Pressable></View>
      <Async state={state}>{(d) => d.rows.length === 0 ? <Empty title="You’re all caught up" sub="Updates about your property, bookings and cashback will appear here." /> :
        d.rows.map((n) => (
          <Pressable key={n.id} onPress={() => !n.read && read({ id: n.id })}>
            <Card style={{ marginBottom: 10, flexDirection: 'row', borderLeftWidth: 4, borderLeftColor: n.read ? t.border : t.primary }}>
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: t.accent, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}><Icon name={ICON[n.type] ?? 'bell'} size={21} color={t.primaryDark} /></View>
              <View style={{ flex: 1 }}><Text style={{ fontWeight: n.read ? '600' : '800', color: t.textPrimary }}>{n.title}</Text><P>{n.body}</P><P style={{ fontSize: 11 }}>{ago(n.at)}</P></View>
            </Card></Pressable>))}</Async>
    </ScrollView>
  );
}
