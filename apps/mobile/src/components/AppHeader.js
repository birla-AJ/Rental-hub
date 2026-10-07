import React from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { t } from '../theme';
import Icon from './Icon';
import BrandLogo from './BrandLogo';
import { useSession } from '../session';

const DISPLAY = { Home: 'Home', Search: 'Discover', Bookings: 'Bookings', Wallet: 'Wallet', Profile: 'Profile', Dashboard: 'Dashboard', Properties: 'Properties', Vacancy: 'Vacancy', Placements: 'Placements', Tasks: 'Tasks', 'QR Tags': 'QR tags', History: 'History' };
// React Navigation measures a custom header inside its own content container.
// A numeric window width avoids that container clipping an edge-to-edge header.
const HEADER_WIDTH = Dimensions.get('window').width;
const HEADER_HEIGHT = 56;

/** Shared navigation header for tab and detail screens. */
export default function AppHeader({ navigation, route, options, back }) {
  const { city } = useSession();
  const title = options?.title || DISPLAY[route.name] || route.name;
  const isNotifications = route.name === 'Notifications';
  const openNotifications = () => {
    const parent = navigation.getParent?.();
    if (parent) parent.navigate('Notifications'); else navigation.navigate('Notifications');
  };
  return (
    <View style={{ width: HEADER_WIDTH, height: HEADER_HEIGHT, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
      <Svg width={HEADER_WIDTH} height={HEADER_HEIGHT} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Rect width={HEADER_WIDTH} height={HEADER_HEIGHT} fill="#173728" />
      </Svg>
      <View style={{ position: 'absolute', width: 142, height: 142, borderRadius: 71, right: -42, top: -92, backgroundColor: 'rgba(255,255,255,.10)' }} />
      {back ? <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')} hitSlop={12} style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,.30)', alignItems: 'center', justifyContent: 'center', marginRight: 9 }}><Icon name="chevron-left" size={20} color="#fff" strokeWidth={2.4} /></Pressable>
        : <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,.28)', alignItems: 'center', justifyContent: 'center', marginRight: 9 }}><BrandLogo size={25} /></View>}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{back ? title : 'RentalHub'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}><Icon name="map-pin" size={12} color="#DDEBDD" /><Text style={{ color: '#DDEBDD', fontSize: 11, marginLeft: 3 }}>{city || 'Indore'}</Text></View>
      </View>
      {!isNotifications ? <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={openNotifications} hitSlop={12} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 14, backgroundColor: pressed ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,.28)', alignItems: 'center', justifyContent: 'center' })}>
        <Icon name="bell" size={19} color="#fff" strokeWidth={2} />
      </Pressable> : <View style={{ width: 38 }} />}
    </View>
  );
}
