import React from 'react';
import { View, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { t, radius, cardShadow } from '../theme';
import Icon from './Icon';

/** The room tag: a clean rounded card (not a generic sticker). Used in agent QR preview, print and admin. */
export default function QRTag({ code, room, property, size = 120 }) {
  return (
    <View style={[{ backgroundColor: '#fff', borderRadius: radius.xl, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: t.border }, cardShadow]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginBottom: 10 }}>
        <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center', marginRight: 6 }}><Icon name="home" size={13} color="#fff" strokeWidth={2.2} /></View>
        <Text style={{ fontWeight: '800', color: t.primaryDark }}>RentalHub</Text>
      </View>
      <View style={{ padding: 10, borderRadius: radius.lg, backgroundColor: t.accent }}>
        <QRCode value={code} size={size} color={t.primaryDark} backgroundColor="transparent" />
      </View>
      <Text style={{ marginTop: 10, fontWeight: '900', fontSize: 18, color: t.textPrimary }}>{room}</Text>
      <Text style={{ color: t.textSecondary, fontSize: 12 }}>{property}</Text>
      <Text style={{ color: t.primary, fontSize: 11, marginTop: 6 }}>Scan at checkout</Text>
    </View>
  );
}
