import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, Modal } from 'react-native';
import { getPosition } from '../native/location';
import { H2, P, Button, Card, Async, Empty } from '../components/ui';
import PropertyCard from '../components/PropertyCard';
import { t, radius } from '../theme';
import { useApi } from '../api';
import { useSession } from '../session';
import Icon from '../components/Icon';

const TYPES = ['PG', 'Flat', 'House', 'Room'];
const RENTS = [['Any', null, null], ['Under ₹6k', null, 6000], ['₹6k–12k', 6000, 12000], ['₹12k+', 12000, null]];
const FURNS = [['Any', null], ['Furnished', 'FURNISHED'], ['Semi', 'SEMI'], ['Unfurnished', 'UNFURNISHED']];
const AMEN = ['WiFi', 'Meals', 'AC', 'Parking', 'Laundry', 'Lift', 'Security', 'Power backup'];
const SORTS = [['relevance', 'Relevance'], ['rent_asc', 'Rent: low to high'], ['rent_desc', 'Rent: high to low'], ['distance', 'Nearest']];
const CITIES = [['Indore', true], ['Bhopal', false], ['Pune', false], ['Bengaluru', false]];   // scalable: add a city = add a row

const Pill = ({ label, on, onPress }) => (
  <Pressable onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, marginRight: 8, marginBottom: 8, backgroundColor: on ? t.primary : t.surface, borderWidth: 1.5, borderColor: on ? t.primary : t.border }}>
    <Text style={{ color: on ? '#fff' : t.textPrimary, fontWeight: '600' }}>{label}</Text>
  </Pressable>);

export default function Search({ navigation }) {
  const { city, update } = useSession();
  const [text, setText] = useState('');
  const [f, setF] = useState({ type: null, rent: 0, beds: null, furnished: null, amenities: [], sort: 'relevance' });
  const [coords, setCoords] = useState(null);
  const [sheet, setSheet] = useState(false), [cityOpen, setCityOpen] = useState(false);

  const qs = new URLSearchParams({ city, ...(text.trim() ? { q: text.trim() } : {}), ...(f.type ? { type: f.type } : {}), ...(RENTS[f.rent][1] ? { minRent: RENTS[f.rent][1] } : {}),
    ...(RENTS[f.rent][2] ? { maxRent: RENTS[f.rent][2] } : {}), ...(f.beds ? { beds: f.beds } : {}), ...(f.furnished ? { furnished: f.furnished } : {}),
    ...(f.amenities.length ? { amenities: f.amenities.join(',') } : {}), sort: f.sort, ...(coords ?? {}) }).toString();
  const state = useApi('/listings?' + qs);
  const active = [f.type, f.rent, f.beds, f.furnished].filter(Boolean).length + f.amenities.length;
  const nearMe = async () => {
    try { const p = await getPosition(); setCoords({ lat: p.lat, lng: p.lng }); setF({ ...f, sort: 'distance' }); } catch { /* permission denied or GPS off: stay on normal search */ }
  };
  const reset = () => { setF({ type: null, rent: 0, beds: null, furnished: null, amenities: [], sort: 'relevance' }); setText(''); };

  return (
    <View style={{ flex: 1, backgroundColor: t.background, paddingTop: 16 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <Pressable onPress={() => setCityOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}><Icon name="map-pin" size={18} color={t.primary} /><Text style={{ color: t.textSecondary, marginLeft: 5 }}>{city}</Text><Icon name="chevron-right" size={16} color={t.textSecondary} /></Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput value={text} onChangeText={setText} placeholder="Search area, PG or flat" placeholderTextColor={t.disabled}
            style={{ flex: 1, height: 48, borderRadius: radius.pill, backgroundColor: t.surface, paddingHorizontal: 18, borderWidth: 1.5, borderColor: t.border, color: t.textPrimary }} />
          <Pressable onPress={() => setSheet(true)} style={{ marginLeft: 8, height: 48, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: t.primary, justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Filters{active ? ` · ${active}` : ''}</Text></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
          <Pill label="Near me" on={!!coords} onPress={coords ? () => { setCoords(null); setF({ ...f, sort: 'relevance' }); } : nearMe} />
          {TYPES.map((x) => <Pill key={x} label={x} on={f.type === x} onPress={() => setF({ ...f, type: f.type === x ? null : x })} />)}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 110 }}>
        <Async state={state}>{(d) => {
          if (d.comingSoon) return <Empty title={`${d.city} is coming soon`} sub="We're starting in Indore. Your rental history will work in new cities as we open them." />;
          if (!d.rows.length) return (<View><Empty title="No homes found" sub="Try changing your filters or searching a nearby area." /><Button title="Clear filters" variant="outline" onPress={reset} /></View>);
          return (<><P style={{ marginBottom: 10 }}>{d.total} verified {d.total === 1 ? 'home' : 'homes'}</P>
            {d.rows.map((r) => <PropertyCard key={r.roomId} item={r} onPress={() => navigation.navigate('PropertyDetails', { roomId: r.roomId, coords })} />)}</>);
        }}</Async>
      </ScrollView>

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,46,51,.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: t.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' }}>
            <ScrollView>
              <H2 style={{ marginBottom: 12 }}>Filters</H2>
              <P style={{ marginBottom: 6 }}>Property type</P><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{TYPES.map((x) => <Pill key={x} label={x} on={f.type === x} onPress={() => setF({ ...f, type: f.type === x ? null : x })} />)}</View>
              <P style={{ marginVertical: 6 }}>Monthly rent</P><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{RENTS.map(([l], i) => <Pill key={l} label={l} on={f.rent === i} onPress={() => setF({ ...f, rent: i })} />)}</View>
              <P style={{ marginVertical: 6 }}>Bedrooms</P><View style={{ flexDirection: 'row' }}>{[null, 1, 2, 3].map((n) => <Pill key={String(n)} label={n ? `${n}+` : 'Any'} on={f.beds === n} onPress={() => setF({ ...f, beds: n })} />)}</View>
              <P style={{ marginVertical: 6 }}>Furnishing</P><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{FURNS.map(([l, v]) => <Pill key={l} label={l} on={f.furnished === v} onPress={() => setF({ ...f, furnished: v })} />)}</View>
              <P style={{ marginVertical: 6 }}>Amenities</P><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{AMEN.map((a) => <Pill key={a} label={a} on={f.amenities.includes(a)} onPress={() => setF({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] })} />)}</View>
              <P style={{ marginVertical: 6 }}>Sort by</P><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{SORTS.filter(([k]) => k !== 'distance' || coords).map(([k, l]) => <Pill key={k} label={l} on={f.sort === k} onPress={() => setF({ ...f, sort: k })} />)}</View>
              <P style={{ fontSize: 12 }}>All homes shown are verified in person by our agents.</P>
            </ScrollView>
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <Button title="Reset" variant="outline" onPress={reset} style={{ flex: 1, marginRight: 8 }} /><Button title="Show homes" onPress={() => setSheet(false)} style={{ flex: 2 }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={cityOpen} transparent animationType="fade" onRequestClose={() => setCityOpen(false)}>
        <Pressable onPress={() => setCityOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(15,46,51,.4)', justifyContent: 'center', padding: 24 }}>
          <Card><H2 style={{ marginBottom: 10 }}>Choose city</H2>
            {CITIES.map(([c, live]) => <Pressable key={c} onPress={() => { update({ city: c }); setCityOpen(false); }} style={{ paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: c === city ? '800' : '500', color: t.textPrimary }}>{c === city ? '✓ ' : ''}{c}</Text>{!live ? <Text style={{ color: t.textSecondary }}>Coming soon</Text> : null}</Pressable>)}
          </Card></Pressable>
      </Modal>
    </View>
  );
}
