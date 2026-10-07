import React from 'react';
import { ScrollView } from 'react-native';
import { H2, Async, Empty } from '../components/ui';
import QRTag from '../components/QRTag';
import { t } from '../theme';
import { useApi } from '../api';

// QR management: every tag the agent has assigned (status ACTIVE). Print/download comes with the web admin.
export default function AgentQr() {
  const state = useApi('/agent/qr');
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      <H2 style={{ marginBottom: 12 }}>QR tags</H2>
      <Async state={state}>{(d) => d.tags.length ? d.tags.map((x) => <React.Fragment key={x.roomId}><QRTag code={x.code} room={x.room} property={x.property} /><H2 style={{ fontSize: 1, height: 12 }}> </H2></React.Fragment>)
        : <Empty title="No tags yet" sub="Tags are created while you verify a property." />}</Async>
    </ScrollView>
  );
}
