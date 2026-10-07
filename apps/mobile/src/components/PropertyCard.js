import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { BASE } from '../api';
import { Chip, inr } from './ui';
import { t, radius, cardShadow } from '../theme';
import Icon from './Icon';

const FURN = { FURNISHED: 'Furnished', SEMI: 'Semi-furnished', UNFURNISHED: 'Unfurnished' };
const ICON = { PG: 'bed', Flat: 'building', House: 'home', Room: 'building' };

/** Large visual card. `photos[0]` is shown when the property has uploaded photos; otherwise a clean teal placeholder. */
export default function PropertyCard({ item, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, marginBottom: 16 })}>
      <View style={[{ backgroundColor: t.card, borderRadius: radius.xl, overflow: 'hidden' }, cardShadow]}>
        <View style={{ height: 150, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
          {item.photos?.[0] ? <Image source={{ uri: BASE + item.photos[0] }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" /> : <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name={ICON[item.type] ?? 'home'} size={32} color={t.primaryDark} /></View>}
          <View style={{ position: 'absolute', top: 12, left: 12 }}><Chip label="Verified" color={t.success} /></View>
          <View style={{ position: 'absolute', bottom: 12, right: 12, backgroundColor: t.primary, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>{inr(item.rent)}/month</Text>
          </View>
        </View>
        <View style={{ padding: 14 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: t.textPrimary }}>{item.title}</Text>
          <Text style={{ color: t.textSecondary, marginTop: 2 }}>{item.room} · {item.locality}{item.distanceKm != null ? ` · ${item.distanceKm} km` : ''}</Text>
          <Text style={{ color: t.textSecondary, marginTop: 8, fontSize: 12 }}>{item.type} · {item.beds} bed · {item.baths} bath · {FURN[item.furnished]}</Text>
        </View>
      </View>
    </Pressable>
  );
}
export { FURN };
