import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { Card, H2, P, Chip, Async, Empty } from '../components/ui';
import { t } from '../theme';
import { useApi } from '../api';
import Icon from '../components/Icon';

const TASK = { PENDING: ['Pending', t.warning], VERIFIED: ['Verified', t.success], REJECTED: ['Rejected', t.error], REVISIT: ['Revisit required', t.info] };
export const TaskCard = ({ task, onPress }) => { const [l, c] = TASK[task.task]; return (
  <Pressable onPress={onPress}><Card style={{ marginBottom: 10 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontWeight: '800', color: t.textPrimary, flex: 1 }}>{task.name}</Text><Chip label={l} color={c} /></View>
    <P>{task.locality} · {task.rooms} room(s)</P><View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}><Icon name="clock" size={14} color={t.textSecondary} /><P style={{ fontSize: 12, marginLeft: 5 }}>{task.visit}</P></View>
    {task.note ? <P style={{ fontSize: 12, color: t.info }}>{task.note}</P> : null}
  </Card></Pressable>); };

export default function AgentDashboard({ navigation }) {
  const state = useApi('/agent/dashboard');
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      <H2 style={{ marginBottom: 12 }}>Agent dashboard</H2>
      <Async state={state}>{(d) => {
        const todo = d.tasks.filter((x) => x.task === 'PENDING' || x.task === 'REVISIT');
        const tiles = [['Assigned', d.counts.assigned], ['Pending', d.counts.pending], ['Verified', d.counts.verified], ['Rejected', d.counts.rejected], ['Revisit', d.counts.revisit], ['Completed', d.counts.completed]];
        return (<>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {tiles.map(([l, n]) => <Card key={l} style={{ width: '31%', marginBottom: 10, alignItems: 'center', padding: 12 }}><Text style={{ fontSize: 22, fontWeight: '900', color: t.primary }}>{n}</Text><Text style={{ fontSize: 11, color: t.textSecondary }}>{l}</Text></Card>)}
          </View>
          <H2 style={{ marginVertical: 8 }}>Next visits</H2>
          {todo.length === 0 ? <Empty title="All caught up" sub="New verification tasks will show up here." /> :
            todo.map((x) => <TaskCard key={x.id} task={x} onPress={() => navigation.navigate('VerifyProperty', { id: x.id })} />)}
        </>);
      }}</Async>
    </ScrollView>
  );
}
