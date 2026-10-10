import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Animated, TextInput } from 'react-native';
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
  /*
  // ==========================================
  // [OLD CODE] NUMBER & OTP LOGIN LOGIC
  // ==========================================
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
  // ==========================================
  */

  // ==========================================
  // [NEW CODE] ID & PASSWORD LOGIN LOGIC
  // ==========================================
  const { signIn } = useSession();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [idFocused, setIdFocused] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [apiErr, setApiErr] = useState(null);

  // Smooth entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 45,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!loginId.trim() || !password) return;
    setBusy(true);
    setApiErr(null);
    try {
      const r = await api('/auth/login', {
        method: 'POST',
        body: { loginId: loginId.trim(), password }
      });
      await signIn(r);
      // Single-role accounts (agent/admin/owner/tenant provisioned) skip the picker.
      navigation.navigate(r.user.roles.length === 1 ? 'Main' : 'Role');
      if (r.user.roles.length === 1 && r.user.role === 'owner') navigation.navigate('Consent');
    } catch (e) {
      setApiErr(e.message === 'Network request failed' ? 'No connection. Check your internet and try again.' : e.message);
    } finally {
      setBusy(false);
    }
  };
  // ==========================================

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <View style={{ height: 184, overflow: 'hidden', backgroundColor: '#173728', paddingHorizontal: 24, paddingTop: 26 }}>
        <View style={{ position: 'absolute', width: 250, height: 250, borderRadius: 125, right: -82, top: -140, backgroundColor: 'rgba(169,214,181,.18)' }} />
        <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, left: -76, bottom: -82, backgroundColor: 'rgba(255,255,255,.08)' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <Animated.View style={{ transform: [{ scale: logoScale }] }}>
            <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,.28)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <BrandLogo size={32} />
            </View>
          </Animated.View>
          <View>
            <Text style={{ color: '#fff', fontSize: textSize(22), fontWeight: '900', letterSpacing: -.35 }}>Welcome back</Text>
            <Text style={{ color: '#CFE5D5', fontSize: textSize(12), marginTop: 2, fontWeight: '500' }}>Sign in to continue to RentalHub</Text>
          </View>
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 30 }}>
        {/*
        // ==========================================
        // [OLD CODE] NUMBER & OTP UI (COMMENTED OUT)
        // ==========================================
        <View style={{ marginTop: 26, padding: 20, borderRadius: 28, backgroundColor: '#FFFFFF' }}>
          <Text>Enter your number</Text>
          <Input label="Mobile number" prefix="+91" value={phone} onChangeText={setPhone} />
          <Button title="Get verification code" onPress={send} />
        </View>
        // ==========================================
        */}

        <Animated.View style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          marginTop: 20,
          padding: 24,
          borderRadius: 28,
          backgroundColor: '#FFFFFF',
          shadowColor: '#173728',
          shadowOpacity: .12,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 20,
          elevation: 4
        }}>
          <Text style={{ color: t.textPrimary, fontSize: textSize(22), fontWeight: '800', letterSpacing: -.3 }}>Sign In</Text>
          <Text style={{ color: t.textSecondary, fontSize: textSize(13), marginTop: 4, marginBottom: 20 }}>Please enter your credentials to continue</Text>

          {/* Login ID Input with icon */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: t.textPrimary, fontWeight: '700', fontSize: textSize(13), marginBottom: 7 }}>Login ID</Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              height: 52,
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: idFocused ? t.primary : t.border,
              backgroundColor: idFocused ? '#fff' : t.surface,
              paddingHorizontal: 14
            }}>
              <Icon name="user" size={19} color={idFocused ? t.primary : t.textSecondary} />
              <TextInput
                style={{ flex: 1, fontSize: textSize(15), color: t.textPrimary, paddingVertical: 0, marginLeft: 10 }}
                placeholder="User ID, mobile, or email"
                placeholderTextColor={t.disabled}
                autoCapitalize="none"
                value={loginId}
                onChangeText={setLoginId}
                onFocus={() => setIdFocused(true)}
                onBlur={() => setIdFocused(false)}
              />
            </View>
          </View>

          {/* Password Input with icon & eye toggle */}
          <View style={{ marginBottom: 18 }}>
            <Text style={{ color: t.textPrimary, fontWeight: '700', fontSize: textSize(13), marginBottom: 7 }}>Password</Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              height: 52,
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: pwFocused ? t.primary : t.border,
              backgroundColor: pwFocused ? '#fff' : t.surface,
              paddingHorizontal: 14
            }}>
              <Icon name="lock" size={19} color={pwFocused ? t.primary : t.textSecondary} />
              <TextInput
                style={{ flex: 1, fontSize: textSize(15), color: t.textPrimary, paddingVertical: 0, marginLeft: 10 }}
                placeholder="Enter password"
                placeholderTextColor={t.disabled}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPwFocused(true)}
                onBlur={() => setPwFocused(false)}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={12} style={{ padding: 4 }}>
                <Icon name={showPassword ? "eye-off" : "eye"} size={20} color={t.textSecondary} />
              </Pressable>
            </View>
          </View>

          {apiErr ? (
            <View style={{ borderRadius: 12, backgroundColor: '#FFF0EF', borderWidth: 1, borderColor: '#FFCCC7', padding: 12, marginBottom: 14 }}>
              <Text style={{ color: t.error, fontSize: textSize(12), fontWeight: '600' }}>{apiErr}</Text>
            </View>
          ) : null}

          <Button
            title="Sign In"
            loading={busy}
            disabled={!loginId.trim() || !password}
            onPress={handleLogin}
            style={{
              marginTop: 4,
              height: 52,
              borderRadius: 16,
              backgroundColor: (!loginId.trim() || !password) ? t.disabled : '#1E4530',
              shadowColor: '#1E4530',
              shadowOpacity: (!loginId.trim() || !password) ? 0 : 0.25,
              shadowOffset: { width: 0, height: 6 },
              shadowRadius: 12,
              elevation: (!loginId.trim() || !password) ? 0 : 4
            }}
          />
        </Animated.View>

        <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingTop: 32 }}>
          <Text style={{ color: t.textSecondary, fontSize: textSize(11), textAlign: 'center' }}>By continuing, you agree to RentalHub’s Terms and Privacy Policy.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

/*
// ==========================================
// [OLD CODE] OTP SCREEN (COMMENTED OUT)
// ==========================================
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
// ==========================================
*/

// Fallback component kept to avoid breaking navigation routes referencing 'Otp'
export function Otp() {
  return null;
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
