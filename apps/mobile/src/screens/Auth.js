import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Screen, GradientCard, H1, P, Button, Input, Card } from '../components/ui';
import { t, radius, textSize } from '../theme';
import { useSession } from '../session';
import { api } from '../api';
import Icon from '../components/Icon';
import BrandLogo from '../components/BrandLogo';

export function Welcome({ navigation }) {
  return (
    <GradientCard colors={['#173728', '#315B43', '#6FA686']} style={{ flex: 1, borderRadius: 0 }} contentStyle={{ flex: 1, padding: 24, paddingTop: 54 }}>
      <View style={{ position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(255,255,255,.09)', top: -90, right: -70 }} />
      <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(219,238,221,.12)', bottom: 110, left: -70 }} />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: 112, height: 112, borderRadius: 36, backgroundColor: 'rgba(255,255,255,.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,.38)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 74, height: 74, borderRadius: 25, backgroundColor: 'rgba(255,255,255,.20)', alignItems: 'center', justifyContent: 'center' }}><Icon name="home" size={38} color="#fff" strokeWidth={2.2} /></View>
        </View>
        <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -.8, marginTop: 22 }}>RentalHub</Text>
        <Text style={{ color: '#E3F1E6', fontSize: 16, textAlign: 'center', lineHeight: 23, marginTop: 8, maxWidth: 280 }}>Find a place that feels like home.</Text>
      </View>
      <View style={{ backgroundColor: 'rgba(255,255,255,.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,.28)', borderRadius: 28, padding: 14 }}>
        <Button title="Get Started" onPress={() => navigation.navigate('Login')} style={{ backgroundColor: '#fff' }} textColor={t.primaryDark} />
        <Pressable onPress={() => navigation.navigate('Login')} style={{ height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}><Text style={{ color: '#fff', fontWeight: '800' }}>I already have an account</Text></Pressable>
      </View>
    </GradientCard>
  );
}

export function Login({ navigation }) {
  const { update } = useSession();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [apiErr, setApiErr] = useState(null);
  const send = async () => {
    setBusy(true); setApiErr(null);
    try { const r = await api('/auth/otp', { method: 'POST', body: { phone } }); update({ phone, devCode: r.devCode ?? null }); navigation.navigate('Otp'); }
    catch (e) { setApiErr(e.message === 'Network request failed' ? 'No connection. Check your internet and try again.' : e.message); }
    finally { setBusy(false); }
  };
  const err = phone && !/^[6-9]\d{9}$/.test(phone) ? 'Enter a valid 10-digit mobile number' : null;
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <View style={{ height: 196, overflow: 'hidden', backgroundColor: '#173728', paddingHorizontal: 24, paddingTop: 28 }}>
        <View style={{ position: 'absolute', width: 250, height: 250, borderRadius: 125, right: -82, top: -140, backgroundColor: 'rgba(169,214,181,.18)' }} />
        <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, left: -76, bottom: -82, backgroundColor: 'rgba(255,255,255,.08)' }} />
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => navigation.goBack()} hitSlop={12} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,.28)', backgroundColor: pressed ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.13)', alignItems: 'center', justifyContent: 'center' })}><Icon name="chevron-left" size={20} color="#fff" strokeWidth={2.3} /></Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 21 }}>
          <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,.27)', alignItems: 'center', justifyContent: 'center', marginRight: 13 }}><BrandLogo size={33} /></View>
          <View><Text style={{ color: '#fff', fontSize: textSize(21), fontWeight: '900', letterSpacing: -.35 }}>Welcome back</Text><Text style={{ color: '#CFE5D5', fontSize: textSize(12), marginTop: 3 }}>Sign in to RentalHub</Text></View>
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 30 }}>
        <View style={{ marginTop: -26, padding: 20, borderRadius: 28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FFFFFF', shadowColor: '#173728', shadowOpacity: .12, shadowOffset: { width: 0, height: 8 }, shadowRadius: 18, elevation: 4 }}>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }}><Icon name="phone" size={21} color={t.primaryDark} /></View>
          <Text style={{ color: t.textPrimary, fontSize: textSize(20), fontWeight: '800', letterSpacing: -.25 }}>Enter your number</Text>
          <Text style={{ color: t.textSecondary, fontSize: textSize(13), lineHeight: textSize(19), marginTop: 5, marginBottom: 20 }}>We’ll send a secure one-time code to verify your mobile number.</Text>
          <Input label="Mobile number" prefix="+91" keyboardType="number-pad" maxLength={10} value={phone} onChangeText={setPhone} placeholder="98765 43210" error={err} />
          {apiErr ? <View style={{ borderRadius: 12, backgroundColor: '#FFF0EF', padding: 10, marginBottom: 12 }}><Text style={{ color: t.error, fontSize: textSize(12) }}>{apiErr}</Text></View> : null}
          <Button title="Get verification code" loading={busy} disabled={!/^[6-9]\d{9}$/.test(phone)} onPress={send} style={{ marginTop: 2 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}><Icon name="lock" size={14} color={t.textSecondary} /><Text style={{ color: t.textSecondary, fontSize: textSize(11), marginLeft: 5 }}>Your number stays private and secure</Text></View>
        </View>
        <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingTop: 28 }}><Text style={{ color: t.textSecondary, fontSize: textSize(11), textAlign: 'center' }}>By continuing, you agree to RentalHub’s Terms and Privacy Policy.</Text></View>
      </ScrollView>
    </View>
  );
}

export function Otp({ navigation }) {
  const { phone, devCode, signIn } = useSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const verify = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api('/auth/verify', { method: 'POST', body: { phone, code } });
      await signIn(r);
      // Single-role accounts (agent/admin/owner/tenant provisioned) skip the picker.
      navigation.navigate(r.user.roles.length === 1 ? 'Main' : 'Role');
      if (r.user.roles.length === 1 && r.user.role === 'owner') navigation.navigate('Consent');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <H1 style={{ marginTop: 24 }}>Verify OTP</H1>
      <P style={{ marginBottom: 20 }}>Sent to +91 {phone}</P>
      <Input label="6-digit code" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} />
      {devCode ? <P style={{ marginBottom: 10 }}>Dev mode code: {devCode}</P> : null}
      {err ? <Text style={{ color: t.error, marginBottom: 8 }}>{err}</Text> : null}
      <Button title="Verify" loading={busy} disabled={code.length !== 6} onPress={verify} />
    </Screen>
  );
}

const ROLES = [
  { id: 'tenant', title: 'Tenant', sub: 'Find & register properties', icon: 'user' },
  { id: 'agent', title: 'Agent', sub: 'Verify & manage properties', icon: 'dashboard' },
  { id: 'owner', title: 'Owner', sub: 'Manage your properties', icon: 'key' },
];
export function ChooseRole({ navigation }) {
  const { signIn, roles } = useSession();
  const [err, setErr] = useState(null);
  // Only roles this account really has (agent/admin are provisioned by the platform, never self-picked).
  const choose = async (id) => {
    try { const r = await api('/auth/switch', { method: 'POST', body: { role: id } }); await signIn({ token: r.token, user: { ...r.user, role: id } });
      navigation.reset({ index: 0, routes: [{ name: id === 'owner' ? 'Consent' : 'Main' }] }); }
    catch (e) { setErr(e.message); }
  };
  return (
    <Screen>
      <H1 style={{ marginTop: 24, marginBottom: 16 }}>Choose your role</H1>
      {err ? <Text style={{ color: t.error, marginBottom: 8 }}>{err}</Text> : null}
      {ROLES.filter((r) => (roles ?? ['tenant', 'owner']).includes(r.id)).map((r) => (
        <Pressable key={r.id} onPress={() => choose(r.id)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}><Icon name={r.icon} size={24} color={t.primaryDark} /></View>
            <View><Text style={{ fontWeight: '800', color: t.textPrimary, fontSize: 16 }}>{r.title}</Text><P>{r.sub}</P></View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
