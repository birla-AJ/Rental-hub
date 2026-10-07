import React from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { t, radius, cardShadow, font, textSize } from '../theme';
import Icon from './Icon';

export const Screen = ({ children, style }) => <View style={[{ flex: 1, backgroundColor: t.background, padding: 16 }, style]}>{children}</View>;
export const H1 = ({ children, style }) => <Text style={[{ fontSize: font.h1, fontWeight: '800', color: t.textPrimary }, style]}>{children}</Text>;
export const H2 = ({ children, style }) => <Text style={[{ fontSize: font.h2, fontWeight: '700', color: t.textPrimary }, style]}>{children}</Text>;
export const P = ({ children, style }) => <Text style={[{ fontSize: font.body, color: t.textSecondary, lineHeight: textSize(19) }, style]}>{children}</Text>;

export const Card = ({ children, style }) => <View style={[{ backgroundColor: t.card, borderRadius: radius.lg, padding: 16 }, cardShadow, style]}>{children}</View>;

/** A restrained, image-free gradient surface for premium cards and the splash screen. */
export function GradientCard({ children, colors = ['#4F7D61', '#315B43'], style, contentStyle, start = { x: '0%', y: '0%' }, end = { x: '100%', y: '100%' } }) {
  return <View style={[{ overflow: 'hidden', borderRadius: radius.xl }, cardShadow, style]}>
    <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs><LinearGradient id="rentalhub-gradient" x1={start.x} y1={start.y} x2={end.x} y2={end.y}>{colors.map((color, index) => <Stop key={color + index} offset={`${(index / Math.max(1, colors.length - 1)) * 100}%`} stopColor={color} />)}</LinearGradient></Defs>
      <Rect width="100%" height="100%" fill="url(#rentalhub-gradient)" />
    </Svg>
    <View style={[{ padding: 16 }, contentStyle]}>{children}</View>
  </View>;
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, style, textColor }) {
  const filled = variant === 'primary';
  const bg = disabled ? t.disabled : filled ? t.primary : 'transparent';
  return (
    <Pressable onPress={onPress} disabled={disabled || loading}
      style={({ pressed }) => [{ height: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: bg,
        borderWidth: filled ? 0 : 1.5, borderColor: t.primary, opacity: pressed ? 0.85 : 1 }, style]}>
      {loading ? <ActivityIndicator color={textColor ?? '#fff'} /> : <Text style={{ color: textColor ?? (filled ? '#fff' : t.primary), fontWeight: '700', fontSize: textSize(15) }}>{title}</Text>}
    </Pressable>
  );
}

export function Input({ label, error, prefix, ...props }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={{ color: t.textPrimary, fontWeight: '600', marginBottom: 6 }}>{label}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: error ? t.error : t.border, backgroundColor: t.surface, paddingHorizontal: 14 }}>
        {prefix ? <Text style={{ color: t.textSecondary, fontSize: textSize(15), marginRight: 8 }}>{prefix}</Text> : null}
        <TextInput placeholderTextColor={t.disabled} {...props} style={{ flex: 1, fontSize: textSize(15), color: t.textPrimary, paddingVertical: 0 }} />
      </View>
      {error ? <Text style={{ color: t.error, marginTop: 4, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}

export const Chip = ({ label, color = t.primary }) => (
  <View style={{ alignSelf: 'flex-start', backgroundColor: color + '22', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 }}>
    <Text style={{ color, fontWeight: '700', fontSize: 12 }}>{label}</Text>
  </View>
);

/** Vertical timeline. steps: [{label, sub}], current: index of active step (steps before it are done). */
export function Timeline({ steps, current }) {
  return (
    <View>
      {steps.map((s, i) => {
        const done = i < current, active = i === current;
        const c = done ? t.success : active ? t.primary : t.border;
        return (
          <View key={s.label} style={{ flexDirection: 'row', minHeight: 48 }}>
            <View style={{ alignItems: 'center', width: 28 }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: done || active ? c : t.surface, borderWidth: 2, borderColor: c, alignItems: 'center', justifyContent: 'center' }}>
                {done ? <Text style={{ color: '#fff', fontSize: 11 }}>✓</Text> : null}
              </View>
              {i < steps.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: done ? t.success : t.border }} /> : null}
            </View>
            <View style={{ flex: 1, paddingLeft: 10, paddingBottom: 12 }}>
              <Text style={{ fontWeight: active ? '800' : '600', color: done || active ? t.textPrimary : t.textSecondary }}>{s.label}</Text>
              {s.sub ? <Text style={{ color: t.textSecondary, fontSize: 12 }}>{s.sub}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** DAY 1 → DAY 7 countdown. expired=true shows the waived state (never a penalty). */
export function DayCountdown({ day, expired }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {[1, 2, 3, 4, 5, 6, 7].map((d) => {
          const reached = expired || d <= day;
          return (
            <View key={d} style={{ alignItems: 'center' }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: reached ? (expired ? t.warning : t.primary) : t.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: reached ? '#fff' : t.primaryDark, fontWeight: '800' }}>{d}</Text>
              </View>
              <Text style={{ fontSize: 10, color: t.textSecondary, marginTop: 3 }}>DAY</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export const Row = ({ label, value, strong }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
    <Text style={{ color: t.textSecondary }}>{label}</Text>
    <Text style={{ color: t.textPrimary, fontWeight: strong ? '800' : '600' }}>{value}</Text>
  </View>
);

export const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');

/** Wraps a useApi result: skeleton-ish loader, offline, error + retry. */
export function Async({ state, children }) {
  if (state.loading) return <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={t.primary} /><Text style={{ color: t.textSecondary, marginTop: 8 }}>Loading…</Text></View>;
  if (state.error === 'offline') return <Card style={{ margin: 16 }}><H2>No connection</H2><P style={{ marginVertical: 8 }}>Check your internet and try again.</P><Button title="Retry" onPress={state.retry} /></Card>;
  if (state.error) return <Card style={{ margin: 16 }}><H2>Something went wrong</H2><P style={{ marginVertical: 8 }}>{state.error}</P><Button title="Retry" onPress={state.retry} /></Card>;
  return children(state.data);
}
export const Empty = ({ title, sub }) => <View style={{ alignItems: 'center', padding: 32 }}><View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="building" size={27} color={t.primaryDark} /></View><H2 style={{ marginTop: 12 }}>{title}</H2><P style={{ textAlign: 'center' }}>{sub}</P></View>;
