import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import { GradientCard } from '../components/ui';
import { t, textSize } from '../theme';
import Icon from '../components/Icon';
import BrandLogo from '../components/BrandLogo';

/** Brand splash shown for a short, deliberate moment before the app resolves its session. */
export default function Splash({ onContinue }) {
  const logo = useRef(new Animated.Value(0)).current;
  const copy = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logo, { toValue: 1, friction: 7, tension: 55, useNativeDriver: true }),
      Animated.timing(copy, { toValue: 1, duration: 650, delay: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 0.62, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.25, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [copy, glow, logo]);

  return (
    <GradientCard colors={['#102D21', '#315B43', '#6DA27F']} style={{ flex: 1, borderRadius: 0 }} contentStyle={{ flex: 1, padding: 0 }}>
      <Animated.View style={{ position: 'absolute', width: 330, height: 330, borderRadius: 165, backgroundColor: '#DDEBDD', top: -130, right: -95, opacity: glow }} />
      <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(221,235,221,.12)', bottom: -90, left: -95 }} />
      <View style={{ position: 'absolute', width: 118, height: 118, borderRadius: 32, backgroundColor: 'rgba(255,255,255,.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,.13)', top: '20%', left: -48, transform: [{ rotate: '24deg' }] }} />

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
        <Animated.View style={{ opacity: logo, transform: [{ scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }, { translateY: logo.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
          <View style={{ width: 132, height: 132, borderRadius: 44, backgroundColor: 'rgba(255,255,255,.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,.42)', alignItems: 'center', justifyContent: 'center', shadowColor: '#071B11', shadowOpacity: .32, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 }}>
            <View style={{ width: 88, height: 88, borderRadius: 31, backgroundColor: 'rgba(255,255,255,.20)', borderWidth: 1, borderColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' }}>
              <BrandLogo size={58} />
            </View>
          </View>
        </Animated.View>
        <Animated.View style={{ alignItems: 'center', opacity: copy, transform: [{ translateY: copy.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
          <Text style={{ color: '#FFFFFF', fontSize: textSize(32), fontWeight: '900', letterSpacing: -.8, marginTop: 24 }}>RentalHub</Text>
          <Text style={{ color: '#E4F2E7', fontSize: textSize(15), lineHeight: textSize(22), textAlign: 'center', marginTop: 9 }}>A better place to call home.</Text>
        </Animated.View>
      </View>

      <View style={{ marginHorizontal: 22, padding: 16, flexDirection: 'row', alignItems: 'center', borderRadius: 24, backgroundColor: 'rgba(255,255,255,.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,.22)' }}>
        <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.18)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Icon name="building" size={20} color="#FFFFFF" /></View>
        <View><Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>Verified homes. Better moves.</Text><Text style={{ color: '#D8ECDC', fontSize: 12, marginTop: 2 }}>Loading your RentalHub experience</Text></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Continue" onPress={onContinue} style={({ pressed }) => ({ alignSelf: 'center', width: 62, height: 62, borderRadius: 31, marginTop: 16, marginBottom: 28, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', opacity: pressed ? .8 : 1, shadowColor: '#000', shadowOpacity: .2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 })}>
        <Icon name="chevron-right" size={30} color={t.primaryDark} strokeWidth={2.6} />
      </Pressable>
    </GradientCard>
  );
}
