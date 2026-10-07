import React, { useState } from 'react';
import { Text } from 'react-native';
import { Screen, H1, Input, Button, Async } from '../components/ui';
import { t } from '../theme';
import { api, useApi } from '../api';
import { useSession } from '../session';

export default function EditProfile({ navigation }) {
  const state = useApi('/profile');
  return <Screen><H1 style={{ fontSize: 22, marginBottom: 14 }}>My profile</H1><Async state={state}>{({ user }) => <Form user={user} navigation={navigation} />}</Async></Screen>;
}
function Form({ user, navigation }) {
  const { update } = useSession();
  const [name, setName] = useState(user.name), [email, setEmail] = useState(user.email ?? '');
  const [busy, setBusy] = useState(false), [err, setErr] = useState(null);
  const save = async () => { setBusy(true); setErr(null);
    try { await api('/profile', { method: 'POST', body: { name, email: email || undefined } }); update({ name }); navigation.goBack(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  return (<>
    <Input label="Full name" value={name} onChangeText={setName} />
    <Input label="Email (optional)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
    <Input label="Mobile number" value={`+91 ${user.phone}`} editable={false} />
    {err ? <Text style={{ color: t.error, marginBottom: 8 }}>{err}</Text> : null}
    <Button title="Save" loading={busy} disabled={name.trim().length < 2} onPress={save} />
  </>);
}
