import React from 'react';
import { ScrollView, View, Text, Pressable, Alert } from 'react-native';
import { Card, H2, P, Chip, Async } from '../components/ui';
import { t } from '../theme';
import { useApi } from '../api';
import { useSession } from '../session';
import Icon from '../components/Icon';

const KYC = { NOT_STARTED: ['Not started', t.disabled], PENDING: ['Under review', t.warning], VERIFIED: ['Verified', t.success], REJECTED: ['Needs re-upload', t.error] };

// One Profile screen for every role (Tenant / Agent / Owner). Tenants get the extra rental-trust items.
export default function Profile({ navigation }) {
  const { role, logout } = useSession();
  const state = useApi('/profile');
  const items = [
    ['user', 'My profile', 'EditProfile'],
    ['id-card', 'KYC', 'KYC'],
    ...(role === 'tenant' ? [['history', 'Rental history', 'RentalHistory'], ['credit-card', 'Payment history', 'PaymentHistory'], ['gift', 'Cashback history', 'CashbackHistory'], ['heart', 'Saved homes', 'Saved']] : []),
    ['bell', 'Notifications', 'Notifications'],
    ['help', 'Help & support', 'Static', { page: 'help' }],
    ['lock', 'Privacy', 'Static', { page: 'privacy' }],
    ['file', 'Terms', 'Static', { page: 'terms' }],
  ];
  const confirmLogout = () => Alert.alert('Log out?', 'You can log back in anytime with your mobile number.', [{ text: 'Stay', style: 'cancel' },
    { text: 'Log out', style: 'destructive', onPress: () => logout() }]);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
      <Async state={state}>{({ user, kyc, unread }) => { const [kl, kc] = KYC[kyc] ?? KYC.NOT_STARTED; return (<>
        <Card style={{ alignItems: 'center', marginBottom: 16 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>{user.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</Text></View>
          <H2 style={{ marginTop: 10 }}>{user.name}</H2><P>+91 {user.phone} · <Text style={{ textTransform: 'capitalize' }}>{role}</Text></P>
          <View style={{ marginTop: 8 }}><Chip label={`KYC ${kl}`} color={kc} /></View>
        </Card>
        <Card style={{ padding: 4 }}>
          {items.map(([ic, label, screen, params]) => (
            <Pressable key={label} onPress={() => navigation.navigate(screen, params)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', padding: 14, opacity: pressed ? 0.6 : 1 })}>
              <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}><Icon name={ic} size={20} color={t.primaryDark} /></View><Text style={{ flex: 1, color: t.textPrimary, fontWeight: '600' }}>{label}</Text>
              {label === 'Notifications' && unread ? <View style={{ backgroundColor: t.error, borderRadius: 10, paddingHorizontal: 8, marginRight: 8 }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{unread}</Text></View> : null}
              <Icon name="chevron-right" size={19} color={t.disabled} /></Pressable>))}
        </Card>
        <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={confirmLogout} style={({ pressed }) => ({ marginTop: 16, minHeight: 62, padding: 10, borderRadius: 20, borderWidth: 1, borderColor: '#F3C8C5', backgroundColor: pressed ? '#FCE7E5' : '#FFF5F4', flexDirection: 'row', alignItems: 'center', opacity: pressed ? .88 : 1 })}>
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#FCE0DE', alignItems: 'center', justifyContent: 'center', marginRight: 11 }}><Icon name="logout" size={21} color={t.error} strokeWidth={2} /></View>
          <View style={{ flex: 1 }}><Text style={{ color: t.error, fontWeight: '800', fontSize: 15 }}>Log out</Text><Text style={{ color: '#9D5A56', fontSize: 11, marginTop: 1 }}>You can sign in again anytime</Text></View>
          <Icon name="chevron-right" size={19} color={t.error} strokeWidth={2.2} />
        </Pressable>
      </>); }}</Async>
    </ScrollView>
  );
}
