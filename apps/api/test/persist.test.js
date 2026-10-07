import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, sqliteAdapter, COLLECTIONS } from '../src/persist.js';

const emptyDb = () => Object.fromEntries(Object.entries(COLLECTIONS).map(([k, v]) => [k, v === 'map' ? {} : []]));
const fakeAdapter = () => { const rows = new Map(); return { rows, calls: [], failNext: false,
  async loadAll() { return [...rows.values()].map((r) => structuredClone(r)); },
  async apply({ upserts, deletes }) { if (this.failNext) { this.failNext = false; throw new Error('disk full'); } this.calls.push({ up: upserts.length, del: deletes.length });
    for (const u of upserts) rows.set(u.coll + u.key, { ...u, data: structuredClone(u.data) }); for (const d of deletes) rows.delete(d.coll + d.key); } }; };

test('flush writes only what changed (new, edited, removed)', async () => {
  const db = emptyDb(), ad = fakeAdapter(), st = createStore(ad, db);
  db.rooms.r1 = { id: 'r1', rent: 5000 }; db.users.push({ id: 'u1', name: 'A' }); db.notifications.unshift({ id: 'n1' });
  assert.deepEqual(await st.flush(), { upserts: 3, deletes: 0 });
  assert.deepEqual(await st.flush(), { upserts: 0, deletes: 0 });                    // nothing changed -> no database work
  db.rooms.r1.rent = 6000; assert.deepEqual(await st.flush(), { upserts: 1, deletes: 0 });
  delete db.rooms.r1; assert.deepEqual(await st.flush(), { upserts: 0, deletes: 1 });
});
test('round trip keeps order, including newest-first lists', async () => {
  const db = emptyDb(), ad = fakeAdapter(), st = createStore(ad, db);
  for (const id of ['a', 'b', 'c']) db.users.push({ id });
  for (const id of ['n1', 'n2', 'n3']) { db.notifications.unshift({ id }); await st.flush(); }   // n3 newest, first in memory
  const db2 = emptyDb(); await createStore(ad, db2).load();
  assert.deepEqual(db2.users.map((u) => u.id), ['a', 'b', 'c']); assert.deepEqual(db2.notifications.map((n) => n.id), ['n3', 'n2', 'n1']);
});
test('failed save rejects, keeps the change dirty, and the next flush retries it', async () => {
  const db = emptyDb(), ad = fakeAdapter(), st = createStore(ad, db);
  db.rooms.r1 = { id: 'r1' }; ad.failNext = true;
  await assert.rejects(st.flush(), /disk full/);
  assert.deepEqual(await st.flush(), { upserts: 1, deletes: 0 }); assert.equal(ad.rows.size, 1);
});
test('list items without an id are refused (would be unsaveable)', async () => {
  const db = emptyDb(); db.tenancies.push({ roomId: 'r1' });
  await assert.rejects(createStore(fakeAdapter(), db).flush(), /needs an id/);
});
test('SQLite adapter really stores and reloads, and rolls back a failed transaction', async () => {
  const ad = await sqliteAdapter(':memory:');
  await ad.apply({ upserts: [{ coll: 'rooms', key: 'r1', seq: 1, data: { id: 'r1', a: [1, 2] } }], deletes: [] });
  assert.deepEqual((await ad.loadAll())[0].data, { id: 'r1', a: [1, 2] });
  await assert.rejects(ad.apply({ upserts: [{ coll: 'rooms', key: 'r2', seq: 2, data: { id: 'r2' } }, { coll: 'rooms', key: null, seq: 3, data: {} }], deletes: [] }));
  assert.equal((await ad.loadAll()).length, 1);                                       // r2 was rolled back with the failed batch
});
