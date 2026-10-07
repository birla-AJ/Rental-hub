import React, { useState } from 'react';
import { useApi } from '../api';
import { Async, DataTable } from '../components/ui';

/** Config-driven admin list page: title + endpoint + formatting. Tabs optionally filter by a column. */
export default function TablePage({ role, cfg, search }) {
  // Admin reads /admin/*; agents and owners read the same tables scoped to their own data via /me/*
  const st = useApi(role === 'admin' ? cfg.path : cfg.path.replace('/admin/', '/me/'));
  const [tab, setTab] = useState('All');
  return (<><h1 className="h1">{cfg.title}</h1><p className="sub">{cfg.sub}</p>
    <Async state={st}>{({ rows }) => {
      const tabs = cfg.tabBy ? ['All', ...new Set(rows.map((r) => r[cfg.tabBy]))] : [];
      const shown = tab === 'All' ? rows : rows.filter((r) => r[cfg.tabBy] === tab);
      return (<>{tabs.length ? <div className="tabs">{tabs.map((x) => <button key={x} className={'btn' + (tab === x ? '' : ' out')} onClick={() => setTab(x)}>{x}</button>)}</div> : null}
        <DataTable rows={shown} money={cfg.money} chips={cfg.chips} search={search} empty={cfg.empty} actions={role === 'admin' ? cfg.actions : []} onChanged={st.retry} /></>);
    }}</Async></>);
}
