import React, { useState } from 'react';
import { Text } from 'react-native';
import { Screen, H1, P, Card, Button, Chip, Row, Async } from '../components/ui';
import { t } from '../theme';
import { api, useApi } from '../api';

export default function OwnerCheckout({ route, navigation }) {
  const { roomId } = route.params;
  const state = useApi(`/checkout/${roomId}`);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);

  const respond = async (confirmed, tenantDate) => {
    setBusy(true); setErr(null);
    try { const r = await api(`/checkout/${roomId}/owner-respond`, { method: 'POST', body: { confirmed, checkoutDate: tenantDate } }); setResult(r.checkout.state); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  if (result) return (
    <Screen style={{ paddingTop: 60, justifyContent: 'center' }}>
      <H1 style={{ fontSize: 22 }}>{result === 'VERIFIED' ? 'Checkout confirmed' : 'Thanks — we’ll review this'}</H1>
      <P style={{ marginVertical: 10 }}>{result === 'VERIFIED'
        ? 'The room is now marked vacant. We start finding you a new tenant — a 7-day window begins now. You pay nothing unless we place someone.'
        : 'Our team will check the details with both of you. The room stays as it is until then.'}</P>
      <Button title="Back to dashboard" onPress={() => navigation.popToTop()} />
    </Screen>);

  return (
    <Screen>
      <Async state={state}>{({ checkout: c }) => (<>
        <Chip label="Checkout request" color={t.warning} />
        <H1 style={{ fontSize: 22, marginVertical: 8 }}>Is this tenant moving out?</H1>
        <Card style={{ marginBottom: 14 }}>
          <Row label="Room" value={roomId.toUpperCase()} /><Row label="Tenant scanned room QR" value="Yes ✓" />
          <Row label="Checkout date (tenant)" value={c.tenant?.checkoutDate ?? '—'} />
        </Card>
        <P style={{ marginBottom: 14 }}>Confirm only if the tenant has actually left or is leaving on this date.</P>
        {err ? <Text style={{ color: t.error, marginBottom: 8 }}>{err}</Text> : null}
        <Button title="Yes, confirm checkout" loading={busy} onPress={() => respond(true, c.tenant.checkoutDate)} />
        <Button title="No, something is wrong" variant="outline" disabled={busy} onPress={() => respond(false)} style={{ marginTop: 10 }} />
      </>)}</Async>
    </Screen>);
}
