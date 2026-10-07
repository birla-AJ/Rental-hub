import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { Card, H2, P, Chip, Row, Timeline, Async, Empty, inr } from '../components/ui';
import { t } from '../theme';
import { useApi } from '../api';
import Icon from '../components/Icon';

const Wrap = ({ title, children }) => <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}><H2 style={{ marginBottom: 12 }}>{title}</H2>{children}</ScrollView>;

// Rental history + portable trust profile (designed to follow the tenant to other cities).
export function RentalHistory() {
  const state = useApi('/history');
  return (<Wrap title="Rental history"><Async state={state}>{({ stays, trust }) => (<>
    <Card style={{ marginBottom: 14, backgroundColor: t.primary }}>
      <Text style={{ color: '#D6F3F0' }}>Your trust profile</Text>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginVertical: 4 }}>{trust.kyc === 'VERIFIED' ? 'KYC verified' : 'KYC pending'} · {trust.noDispute ? 'No disputes' : `${trust.disputes} under review`}</Text>
      <Text style={{ color: '#D6F3F0' }}>{trust.totalStays} stay(s){trust.memberSince ? ` · since ${trust.memberSince.slice(0, 7)}` : ''}</Text>
      <Text style={{ color: '#D6F3F0', marginTop: 8, fontSize: 12 }}>Your rental history travels with you. As we open new cities, it will count there too.</Text>
    </Card>
    <View style={{ flexDirection: 'row', marginBottom: 14 }}>{trust.cities.map((c) => <View key={c} style={{ marginRight: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: t.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}><Icon name="map-pin" size={13} color={t.primaryDark} /><Text style={{ marginLeft: 4, color: t.primaryDark, fontWeight: '700', fontSize: 12 }}>{c}</Text></View>)}</View>
    <H2 style={{ marginBottom: 8 }}>Where you’ve lived</H2>
    {stays.length === 0 ? <Empty title="No stays yet" sub="Your tenancies will appear here." /> :
      <Card><Timeline steps={stays.map((s) => ({ label: `${s.property} · ${s.room}`, sub: `${s.locality}, ${s.city} · from ${s.startedAt.slice(0, 7)}${s.current ? ' · Current' : s.endedAt ? ` to ${s.endedAt.slice(0, 7)}` : ''}` }))} current={stays.findIndex((s) => s.current)} /></Card>}
  </>)}</Async></Wrap>);
}

export function PaymentHistory() {
  const state = useApi('/history');
  return (<Wrap title="Payment history"><Async state={state}>{({ payments }) => payments.length === 0 ? <Empty title="No payments yet" sub="Booking payments and refunds show up here." /> :
    payments.map((p) => <Card key={p.id} style={{ marginBottom: 10 }}><Row label={p.room} value={inr(p.amount)} strong /><P style={{ fontSize: 12 }}>{p.at.slice(0, 10)} · {p.method} · {p.id}</P>{p.refunded ? <Chip label={`Refunded ${inr(p.refunded)}`} color={t.info} /> : null}</Card>)}</Async></Wrap>);
}

export function CashbackHistory() {
  const state = useApi('/wallet');
  return (<Wrap title="Cashback history"><Async state={state}>{(w) => w.tokens.length === 0 ? <Empty title="No cashback yet" sub="Register the home you live in to earn your first token." /> :
    w.tokens.map((k, i) => <Card key={i} style={{ marginBottom: 10 }}><Row label={k.from} value={inr(k.amount)} strong /><Chip label={k.state === 'DORMANT' ? 'Saved' : k.state === 'ELIGIBLE' ? 'Ready to use' : 'Used'} color={k.state === 'ELIGIBLE' ? t.success : k.state === 'REDEEMED' ? t.disabled : t.info} /></Card>)}</Async></Wrap>);
}
