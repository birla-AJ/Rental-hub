import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { H2, Button, Async, Empty } from '../components/ui';
import { TaskCard } from './AgentDashboard';
import { t } from '../theme';
import { useApi } from '../api';

const FILTERS = [['ALL', 'All'], ['PENDING', 'Pending'], ['REVISIT', 'Revisit'], ['VERIFIED', 'Verified'], ['REJECTED', 'Rejected']];
export default function AgentTasks({ navigation, route }) {
  const [f, setF] = useState(route?.params?.filter ?? 'ALL');
  const state = useApi('/agent/dashboard');
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      <H2 style={{ marginBottom: 10 }}>Tasks</H2>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {FILTERS.map(([k, l]) => <View key={k} style={{ marginRight: 8 }}><Button title={l} variant={f === k ? 'primary' : 'outline'} onPress={() => setF(k)} style={{ height: 38, paddingHorizontal: 16 }} /></View>)}
      </ScrollView>
      <Async state={state}>{(d) => {
        const list = d.tasks.filter((x) => f === 'ALL' || x.task === f);
        return list.length ? list.map((x) => <TaskCard key={x.id} task={x} onPress={() => navigation.navigate('VerifyProperty', { id: x.id })} />)
          : <Empty title="Nothing here" sub="No tasks match this filter." />;
      }}</Async>
    </ScrollView>
  );
}
