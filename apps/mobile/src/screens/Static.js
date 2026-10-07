import React from 'react';
import { ScrollView } from 'react-native';
import { H2, P, Card } from '../components/ui';
import { t } from '../theme';

// Placeholder copy — replace with the client's legal text before launch.
const PAGES = {
  help: ['Help & support', ['How do I earn cashback?', 'Register the home you live in. After an agent verifies it, you get a 30% cashback token, saved for later.', 'When does my cashback become ready?', 'When you move out: scan the QR on your room and confirm with your owner. Once both confirm, your cashback is ready for your next booking.', 'Need more help?', 'Contact support: support@rentalhub.example (placeholder).']],
  privacy: ['Privacy', ['What we collect', 'Your mobile number, profile, property details and the checks needed to verify them.', 'ID details', 'We record only the type of ID you used, never the ID number.', 'Your owner', 'Owners only see your first name until a booking is confirmed.']],
  terms: ['Terms', ['Placeholder', 'The full terms of service will be provided by RentalHub before launch.']],
};
export default function Static({ route }) {
  const [title, blocks] = PAGES[route.params.page];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 16 }}>
      <H2 style={{ marginBottom: 12 }}>{title}</H2>
      <Card>{blocks.map((b, i) => i % 2 === 0 ? <H2 key={i} style={{ fontSize: 15, marginTop: i ? 12 : 0 }}>{b}</H2> : <P key={i}>{b}</P>)}</Card>
    </ScrollView>
  );
}
