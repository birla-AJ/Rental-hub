import test from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../src/server.js';
import { H } from '../test-helpers.mjs';

let base;
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = `http://localhost:${server.address().port}`; });
test.after(() => server.close());
const call = async (m, p, who, body) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...H(...who) }, body: body && JSON.stringify(body) }); return { status: r.status, ...(await r.json()) }; };
const O1 = ['owner', 'o1'], O2 = ['owner', 'o2'], T1 = ['tenant', 't1'], T3 = ['tenant', 't3'], ADMIN = ['admin'];
const soon = () => new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);

test('owners see only their own properties and rooms; tenants and other owners are refused', async () => {
  const p1 = await call('GET', '/owner/properties', O1); assert.deepEqual(p1.rows.map((r) => r.id), ['p1']); assert.equal(p1.rows[0].occupied, 1);
  const p2 = (await call('GET', '/owner/properties', O2)).rows.map((r) => r.id); assert.ok(p2.includes('p4') && p2.includes('p7') && !p2.includes('p1'));
  assert.equal((await call('GET', '/owner/properties/p4', O1)).status, 403);      // someone else's property
  assert.equal((await call('GET', '/owner/rooms/r6', O1)).status, 403);
  assert.equal((await call('GET', '/owner/properties', T1)).status, 403);
  const d = await call('GET', '/owner/properties/p1', O1); assert.equal(d.property.verified, true); assert.equal(d.rooms[0].tenant.name, 'Rahul Verma'); assert.equal(d.rooms[0].tag.status, 'ACTIVE');
});
test('placement journey as the owner sees it: occupied → vacant (day 1) → new tenant found → placed with 20% commission', async () => {
  await call('POST', '/checkout/r1/start', T1); await call('POST', '/checkout/r1/scan', T1, { qr: 'r1' });
  await call('POST', '/checkout/r1/tenant-confirm', T1, { checkoutDate: soon() }); await call('POST', '/checkout/r1/owner-respond', O1, { confirmed: true, checkoutDate: soon() });
  let pl = await call('GET', '/owner/placements', O1); assert.equal(pl.inProgress.length, 1);
  assert.equal(pl.inProgress[0].vacancy.day, 1); assert.equal(pl.inProgress[0].potentialCommission, 1700); assert.equal(pl.inProgress[0].incoming, null); assert.equal(pl.history.length, 0);
  let room = await call('GET', '/owner/rooms/r1', O1); assert.equal(room.room.tenant, null);                                  // nobody lives there now
  assert.equal(room.stays[0].tenantFirstName, 'Rahul'); assert.ok(room.stays[0].endedAt);                                      // the stay is closed with a date

  const b = (await call('POST', '/bookings', T3, { roomId: 'r1', moveInDate: soon(), months: 11 })).booking; await call('POST', `/bookings/${b.id}/pay`, T3, {});
  pl = await call('GET', '/owner/placements', O1); assert.equal(pl.inProgress[0].incoming.tenantFirstName, 'Amit'); assert.equal(pl.inProgress[0].incoming.status, 'PENDING');
  assert.equal(JSON.stringify(pl).includes('9765432109'), false);                                                             // a prospective tenant's phone is never shown

  await call('POST', `/bookings/${b.id}/confirm`, ADMIN); await call('POST', `/bookings/${b.id}/movein`, ADMIN);
  pl = await call('GET', '/owner/placements', O1); assert.equal(pl.inProgress.length, 0); assert.equal(pl.history.length, 1);
  assert.deepEqual([pl.history[0].status, pl.history[0].amount, pl.history[0].newTenantFirstName], ['DUE', 1700, 'Amit']);
  room = await call('GET', '/owner/rooms/r1', O1); assert.equal(room.room.tenant.name, 'Amit Patel'); assert.equal(room.room.status, 'OCCUPIED'); assert.equal(room.stays.length, 2); assert.equal(room.placements[0].status, 'DUE');
  // the old tenant no longer has access to the room they left
  assert.equal((await call('GET', '/rooms/r1', T1)).status, 403);
  assert.equal((await call('GET', '/history', T1)).stays.find((s) => s.room === 'Room 101').current, false);
});
