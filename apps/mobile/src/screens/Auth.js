import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Animated, TextInput, ActivityIndicator } from 'react-native';
import { Screen, GradientCard, Button } from '../components/ui';
import { t, textSize } from '../theme';
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
          <View style={{ width: 74, height: 74, borderRadius: 25, backgroundColor: 'rgba(255,255,255,.20)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="home" size={38} color="#fff" strokeWidth={2.2} />
          </View>
        </View>
        <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -.8, marginTop: 22 }}>RentalHub</Text>
        <Text style={{ color: '#E3F1E6', fontSize: 16, textAlign: 'center', lineHeight: 23, marginTop: 8, maxWidth: 280 }}>Find a verified place or manage your rental properties with trust.</Text>
      </View>
      <View style={{ backgroundColor: 'rgba(255,255,255,.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,.28)', borderRadius: 28, padding: 14 }}>
        <Button title="Get Started" onPress={() => navigation.navigate('Login')} style={{ backgroundColor: '#fff' }} textColor={t.primaryDark} />
        <Pressable onPress={() => navigation.navigate('Login')} style={{ height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>I already have an account</Text>
        </Pressable>
      </View>
    </GradientCard>
  );
}

export function Login({ navigation }) {
  const { signIn } = useSession();

  // Mode: 'login' | 'signup'
  const [mode, setMode] = useState('login');

  // Shared Form Fields
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Signup-specific fields
  const [role, setRole] = useState('tenant'); // 'tenant' | 'owner'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);

  // States
  const [busy, setBusy] = useState(false);
  const [apiErr, setApiErr] = useState(null);

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 45, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [mode]);

  const handleLogin = async () => {
    if (busy || !loginId.trim() || !password) return;
    setBusy(true);
    setApiErr(null);
    try {
      const r = await api('/auth/login', {
        method: 'POST',
        body: { loginId: loginId.trim(), password }
      });
      await signIn(r);
      const roles = r.user?.roles ?? [r.user?.role];
      if (roles.length > 1) {
        navigation.navigate('Role');
      } else if (r.user?.role === 'owner') {
        navigation.navigate('Consent');
      } else {
        navigation.navigate('Main');
      }
    } catch (e) {
      setApiErr(e.message === 'Network request failed' ? 'Could not reach server. Please check your internet connection.' : e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async () => {
    if (busy) return;
    if (!name.trim()) return setApiErr('Please enter your full name');
    if (!/^[6-9]\d{9}$/.test(phone.trim())) return setApiErr('Please enter a valid 10-digit Indian mobile number');
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setApiErr('Please enter a valid email address');
    if (password.length < 6) return setApiErr('Password must be at least 6 characters long');
    if (password !== confirmPassword) return setApiErr('Passwords do not match');
    if (!agreeTerms) return setApiErr('Please accept the Terms and Privacy Policy');

    setBusy(true);
    setApiErr(null);
    try {
      const r = await api('/auth/register', {
        method: 'POST',
        body: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          password,
          role,
          city: 'Indore',
        }
      });
      await signIn(r);
      const roles = r.user?.roles ?? [r.user?.role];
      if (roles.length > 1) {
        navigation.navigate('Role');
      } else if (r.user?.role === 'owner') {
        navigation.navigate('Consent');
      } else {
        navigation.navigate('Main');
      }
    } catch (e) {
      setApiErr(e.message === 'Network request failed' ? 'Could not reach server. Please check your internet connection.' : e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {/* Header Banner */}
      <View style={{ height: 160, overflow: 'hidden', backgroundColor: '#173728', paddingHorizontal: 24, paddingTop: 24 }}>
        <View style={{ position: 'absolute', width: 250, height: 250, borderRadius: 125, right: -82, top: -140, backgroundColor: 'rgba(169,214,181,.18)' }} />
        <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, left: -76, bottom: -82, backgroundColor: 'rgba(255,255,255,.08)' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
          <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(255,255,255,.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,.28)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <BrandLogo size={28} />
          </View>
          <View>
            <Text style={{ color: '#fff', fontSize: textSize(20), fontWeight: '900', letterSpacing: -.3 }}>
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </Text>
            <Text style={{ color: '#CFE5D5', fontSize: textSize(12), marginTop: 2, fontWeight: '500' }}>
              {mode === 'login' ? 'Sign in to access your properties & bookings' : 'Join RentalHub as a Tenant or Owner'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 36 }}>
        {/* Toggle Tabs: Sign In / Create Account */}
        <View style={{ flexDirection: 'row', backgroundColor: '#EAEFEA', borderRadius: 16, padding: 4, marginTop: 16, marginBottom: 16 }}>
          <Pressable
            onPress={() => { setMode('login'); setApiErr(null); }}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: mode === 'login' ? '#fff' : 'transparent', alignItems: 'center', elevation: mode === 'login' ? 2 : 0 }}>
            <Text style={{ fontWeight: '800', fontSize: textSize(13), color: mode === 'login' ? '#173728' : '#6F7F74' }}>Sign In</Text>
          </Pressable>
          <Pressable
            onPress={() => { setMode('signup'); setApiErr(null); }}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: mode === 'signup' ? '#fff' : 'transparent', alignItems: 'center', elevation: mode === 'signup' ? 2 : 0 }}>
            <Text style={{ fontWeight: '800', fontSize: textSize(13), color: mode === 'signup' ? '#173728' : '#6F7F74' }}>New Account</Text>
          </Pressable>
        </View>

        <Animated.View style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          padding: 22,
          borderRadius: 24,
          backgroundColor: '#FFFFFF',
          shadowColor: '#173728',
          shadowOpacity: .08,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 16,
          elevation: 3
        }}>
          {/* Error Banner */}
          {apiErr ? (
            <View style={{ borderRadius: 12, backgroundColor: '#FFF0EF', borderWidth: 1, borderColor: '#FFCCC7', padding: 12, marginBottom: 16 }}>
              <Text style={{ color: t.error, fontSize: textSize(12), fontWeight: '600' }}>{apiErr}</Text>
            </View>
          ) : null}

          {/* ===================== SIGN IN FORM ===================== */}
          {mode === 'login' ? (
            <View>
              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: t.textPrimary, fontWeight: '700', fontSize: textSize(13), marginBottom: 6 }}>Mobile Number or Email</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 14, borderWidth: 1.2, borderColor: t.border, backgroundColor: t.surface, paddingHorizontal: 12 }}>
                  <Icon name="user" size={18} color={t.textSecondary} />
                  <TextInput
                    style={{ flex: 1, fontSize: textSize(14), color: t.textPrimary, marginLeft: 10 }}
                    placeholder="Enter 10-digit mobile or email"
                    placeholderTextColor={t.disabled}
                    autoCapitalize="none"
                    value={loginId}
                    onChangeText={setLoginId}
                  />
                </View>
              </View>

              <View style={{ marginBottom: 18 }}>
                <Text style={{ color: t.textPrimary, fontWeight: '700', fontSize: textSize(13), marginBottom: 6 }}>Password</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 14, borderWidth: 1.2, borderColor: t.border, backgroundColor: t.surface, paddingHorizontal: 12 }}>
                  <Icon name="lock" size={18} color={t.textSecondary} />
                  <TextInput
                    style={{ flex: 1, fontSize: textSize(14), color: t.textPrimary, marginLeft: 10 }}
                    placeholder="Enter password"
                    placeholderTextColor={t.disabled}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    value={password}
                    onChangeText={setPassword}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={12}>
                    <Icon name={showPassword ? "eye-off" : "eye"} size={18} color={t.textSecondary} />
                  </Pressable>
                </View>
              </View>

              <Button
                title="Sign In"
                loading={busy}
                disabled={busy || !loginId.trim() || !password}
                onPress={handleLogin}
                style={{
                  height: 50,
                  borderRadius: 14,
                  backgroundColor: (busy || !loginId.trim() || !password) ? t.disabled : '#1E4530',
                }}
              />
            </View>
          ) : (
            /* ===================== SIGN UP FORM ===================== */
            <View>
              {/* Role Selection Tabs */}
              <Text style={{ color: t.textPrimary, fontWeight: '700', fontSize: textSize(13), marginBottom: 8 }}>I want to sign up as:</Text>
              <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                <Pressable
                  onPress={() => setRole('tenant')}
                  style={{
                    flex: 1,
                    marginRight: 6,
                    padding: 12,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: role === 'tenant' ? '#1E4530' : t.border,
                    backgroundColor: role === 'tenant' ? '#F0F6F2' : '#FAFAFA',
                    alignItems: 'center'
                  }}>
                  <Icon name="user" size={20} color={role === 'tenant' ? '#1E4530' : t.textSecondary} />
                  <Text style={{ fontWeight: '800', fontSize: textSize(12), marginTop: 4, color: role === 'tenant' ? '#1E4530' : t.textSecondary }}>Tenant</Text>
                </Pressable>

                <Pressable
                  onPress={() => setRole('owner')}
                  style={{
                    flex: 1,
                    marginLeft: 6,
                    padding: 12,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: role === 'owner' ? '#1E4530' : t.border,
                    backgroundColor: role === 'owner' ? '#F0F6F2' : '#FAFAFA',
                    alignItems: 'center'
                  }}>
                  <Icon name="home" size={20} color={role === 'owner' ? '#1E4530' : t.textSecondary} />
                  <Text style={{ fontWeight: '800', fontSize: textSize(12), marginTop: 4, color: role === 'owner' ? '#1E4530' : t.textSecondary }}>Property Owner</Text>
                </Pressable>
              </View>

              {/* Full Name */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: t.textPrimary, fontWeight: '700', fontSize: textSize(13), marginBottom: 5 }}>Full Name</Text>
                <TextInput
                  style={{ height: 48, borderRadius: 12, borderWidth: 1.2, borderColor: t.border, backgroundColor: t.surface, paddingHorizontal: 12, fontSize: textSize(14), color: t.textPrimary }}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor={t.disabled}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              {/* Mobile Phone */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: t.textPrimary, fontWeight: '700', fontSize: textSize(13), marginBottom: 5 }}>Mobile Number (10 Digits)</Text>
                <TextInput
                  style={{ height: 48, borderRadius: 12, borderWidth: 1.2, borderColor: t.border, backgroundColor: t.surface, paddingHorizontal: 12, fontSize: textSize(14), color: t.textPrimary }}
                  placeholder="e.g. 9826012345"
                  placeholderTextColor={t.disabled}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>

              {/* Email Address (Optional) */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: t.textPrimary, fontWeight: '700', fontSize: textSize(13), marginBottom: 5 }}>Email Address (Optional)</Text>
                <TextInput
                  style={{ height: 48, borderRadius: 12, borderWidth: 1.2, borderColor: t.border, backgroundColor: t.surface, paddingHorizontal: 12, fontSize: textSize(14), color: t.textPrimary }}
                  placeholder="e.g. rahul@example.com"
                  placeholderTextColor={t.disabled}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              {/* Password */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: t.textPrimary, fontWeight: '700', fontSize: textSize(13), marginBottom: 5 }}>Create Password</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 12, borderWidth: 1.2, borderColor: t.border, backgroundColor: t.surface, paddingHorizontal: 12 }}>
                  <Icon name="lock" size={18} color={t.textSecondary} />
                  <TextInput
                    style={{ flex: 1, fontSize: textSize(14), color: t.textPrimary, marginLeft: 10 }}
                    placeholder="Minimum 6 characters"
                    placeholderTextColor={t.disabled}
                    secureTextEntry={!showSignupPassword}
                    autoCapitalize="none"
                    value={password}
                    onChangeText={setPassword}
                  />
                  <Pressable onPress={() => setShowSignupPassword(!showSignupPassword)} hitSlop={12}>
                    <Icon name={showSignupPassword ? "eye-off" : "eye"} size={18} color={t.textSecondary} />
                  </Pressable>
                </View>
              </View>

              {/* Confirm Password */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: t.textPrimary, fontWeight: '700', fontSize: textSize(13), marginBottom: 5 }}>Confirm Password</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 12, borderWidth: 1.2, borderColor: t.border, backgroundColor: t.surface, paddingHorizontal: 12 }}>
                  <Icon name="lock" size={18} color={t.textSecondary} />
                  <TextInput
                    style={{ flex: 1, fontSize: textSize(14), color: t.textPrimary, marginLeft: 10 }}
                    placeholder="Re-enter password"
                    placeholderTextColor={t.disabled}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={12}>
                    <Icon name={showConfirmPassword ? "eye-off" : "eye"} size={18} color={t.textSecondary} />
                  </Pressable>
                </View>
              </View>

              {/* Terms Checkbox */}
              <Pressable onPress={() => setAgreeTerms(!agreeTerms)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
                <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: agreeTerms ? '#1E4530' : t.border, backgroundColor: agreeTerms ? '#1E4530' : '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  {agreeTerms ? <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>✓</Text> : null}
                </View>
                <Text style={{ flex: 1, fontSize: textSize(12), color: t.textSecondary }}>I agree to RentalHub Terms of Service and Privacy Policy</Text>
              </Pressable>

              <Button
                title={`Register as ${role === 'tenant' ? 'Tenant' : 'Property Owner'}`}
                loading={busy}
                disabled={busy || !name.trim() || !phone.trim() || !password || !confirmPassword || !agreeTerms}
                onPress={handleSignup}
                style={{
                  height: 50,
                  borderRadius: 14,
                  backgroundColor: (busy || !name.trim() || !phone.trim() || !password || !confirmPassword || !agreeTerms) ? t.disabled : '#1E4530',
                }}
              />
            </View>
          )}
        </Animated.View>

        <View style={{ alignItems: 'center', paddingTop: 24 }}>
          <Text style={{ color: t.textSecondary, fontSize: textSize(11), textAlign: 'center' }}>
            Protected by RentalHub Security • Indore Pilot
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

export function Otp({ navigation }) {
  return (
    <View style={{ flex: 1, backgroundColor: t.background, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
      <BrandLogo size={48} />
      <Text style={{ fontSize: textSize(20), fontWeight: '900', color: t.textPrimary, marginTop: 16 }}>
        Password Authentication Active
      </Text>
      <Text style={{ fontSize: textSize(13), color: t.textSecondary, textAlign: 'center', marginTop: 8, maxWidth: 280 }}>
        RentalHub now uses secure password login instead of SMS OTP.
      </Text>
      <Button
        title="Go to Sign In"
        onPress={() => navigation.navigate('Login')}
        style={{ marginTop: 24, minWidth: 200, backgroundColor: '#1E4530' }}
      />
    </View>
  );
}

export function ChooseRole({ navigation }) {
  const { roles, signIn } = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const select = async (targetRole) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api('/auth/switch', {
        method: 'POST',
        body: { role: targetRole }
      });
      await signIn(r);
      if (targetRole === 'owner') {
        navigation.navigate('Consent');
      } else {
        navigation.navigate('Main');
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const userRoles = Array.isArray(roles) && roles.length ? roles : ['tenant', 'owner'];

  return (
    <View style={{ flex: 1, backgroundColor: t.background, padding: 24, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <BrandLogo size={44} />
        <Text style={{ fontSize: textSize(22), fontWeight: '900', color: t.textPrimary, marginTop: 14 }}>
          Select Active Role
        </Text>
        <Text style={{ fontSize: textSize(13), color: t.textSecondary, textAlign: 'center', marginTop: 4 }}>
          Your account has access to multiple roles. Choose which one to open:
        </Text>
      </View>

      {err ? (
        <View style={{ backgroundColor: '#FFF0EF', borderWidth: 1, borderColor: '#FFCCC7', padding: 12, borderRadius: 12, marginBottom: 16 }}>
          <Text style={{ color: t.error, fontSize: textSize(12), fontWeight: '600' }}>{err}</Text>
        </View>
      ) : null}

      {userRoles.map((r) => {
        const isOwner = r === 'owner';
        const isAgent = r === 'agent';
        const title = isOwner ? 'Property Owner' : isAgent ? 'Field Agent' : 'Tenant';
        const desc = isOwner ? 'Manage your rental properties & rooms' : isAgent ? 'Verification visits & property tasks' : 'Browse listings & view bookings';
        const iconName = isOwner ? 'home' : isAgent ? 'check' : 'user';

        return (
          <Pressable
            key={r}
            disabled={busy}
            onPress={() => select(r)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderRadius: 16,
              backgroundColor: '#fff',
              borderWidth: 1.5,
              borderColor: t.border,
              marginBottom: 12,
              shadowColor: '#000',
              shadowOpacity: 0.04,
              shadowOffset: { width: 0, height: 2 },
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#F0F6F2', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Icon name={iconName} size={22} color="#1E4530" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: textSize(15), fontWeight: '800', color: t.textPrimary }}>{title}</Text>
              <Text style={{ fontSize: textSize(12), color: t.textSecondary, marginTop: 2 }}>{desc}</Text>
            </View>
            <Icon name="chevron-right" size={18} color={t.textSecondary} />
          </Pressable>
        );
      })}
    </View>
  );
}

