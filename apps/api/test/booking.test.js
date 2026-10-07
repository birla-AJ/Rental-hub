import test from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../src/server.js';
import { H } from '../test-helpers.mjs';

let base;
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = `http://localhost:${server.address().port}`; });
test.after(() => server.close());
const call = async (m, p, who, body) => { const [role, sub] = who; const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...H(role, sub) }, body: body && JSON.stringify(body) }); return { status: r.status, ...(await r.json()) }; };
const T1 = ['tenant', 't1'], T2 = ['tenant', 't2'], T3 = ['tenant', 't3'], ADMIN = ['admin'], OWNER1 = ['owner', 'o1'];
const soon = (d = 3) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

test('search: filters, sort, city gating; only tenants may search', async () => {
  const all = await call('GET', '/listings', T1); assert.ok(all.total >= 6);
  assert.ok(all.rows.every((r) => r.verified && r.available));
  const pg = await call('GET', '/listings?type=PG&sort=rent_asc', T1); assert.ok(pg.rows.every((r) => r.type === 'PG'));
  assert.deepEqual(pg.rows.map((r) => r.rent), [...pg.rows.map((r) => r.rent)].sort((a, b) => a - b));
  assert.ok((await call('GET', '/listings?minRent=15000', T1)).rows.every((r) => r.rent >= 15000));
  assert.ok((await call('GET', '/listings?amenities=WiFi,Meals', T1)).rows.every((r) => r.amenities.includes('Meals')));
  assert.equal((await call('GET', '/listings?q=nowhere-xyz', T1)).total, 0);
  const far = await call('GET', '/listings?city=Bhopal', T1); assert.equal(far.comingSoon, true);
  const near = await call('GET', '/listings?sort=distance&lat=22.7533&lng=75.8937', T1); assert.equal(near.rows[0].locality, 'Vijay Nagar');
  assert.equal((await call('GET', '/listings', ['owner', 'o1'])).status, 403);
});
test('detail hides owner contact before booking', async () => {
  const d = await call('GET', '/listings/r6', T1);
  assert.equal(d.owner.firstName, 'Mahesh'); assert.equal(JSON.stringify(d).includes('9826012345'), false);
});
test('full lifecycle: cashback ladder, token hold, move-in, 7-day commission', async () => {
  // t1 completes a verified checkout -> token ELIGIBLE, r1 VACANT + 7-day clock
  await call('POST', '/checkout/r1/start', T1); await call('POST', '/checkout/r1/scan', T1, { qr: 'r1' });
  await call('POST', '/checkout/r1/tenant-confirm', T1, { checkoutDate: soon(0) }); await call('POST', '/checkout/r1/owner-respond', OWNER1, { confirmed: true, checkoutDate: soon(0) });
  let w = await call('GET', '/wallet', T1); assert.equal(w.available, 2550); assert.equal(w.locked, 0);
  assert.equal(JSON.stringify(w).includes('inactivity'), false);       // internal tracking never exposed

  // t1 books r6 (₹6,500): registered tenant's first booking is #2 => 30% = ₹1,950
  const b = (await call('POST', '/bookings', T1, { roomId: 'r6', moveInDate: soon(), months: 11 })).booking;
  assert.equal(b.quote.cashback, 1950); assert.equal(b.quote.payable, 4550); assert.equal(b.quote.bookingNumber, 2);
  assert.equal((await call('POST', `/bookings/${b.id}/pay`, T1, { simulate: 'fail' })).status, 402);      // failed payment charges nothing
  assert.equal((await call('GET', '/listings/r6', T1)).status, 200);                                       // still available after failed payment
  const paid = (await call('POST', `/bookings/${b.id}/pay`, T1, { method: 'UPI' })).booking; assert.equal(paid.status, 'PENDING');
  assert.equal((await call('GET', '/listings/r6', T1)).status, 404);                                       // room held
  w = await call('GET', '/wallet', T1); assert.equal(w.pending, 2550); assert.equal(w.available, 0);
  assert.equal((await call('POST', '/bookings', T1, { roomId: 'r7', moveInDate: soon(), months: 6 })).status, 409);   // one booking at a time
  assert.equal((await call('GET', `/bookings/${b.id}`, T2)).status, 403);                                  // other tenants can't read it
  assert.equal((await call('POST', `/bookings/${b.id}/confirm`, T1)).status, 403);                         // tenant can't self-confirm
  await call('POST', `/bookings/${b.id}/confirm`, ADMIN); await call('POST', `/bookings/${b.id}/movein`, ADMIN);
  w = await call('GET', '/wallet', T1); assert.equal(w.redeemed, 2550); assert.equal(w.pending, 0);

  // t3 (no token) books vacated r1 inside the window => commission due for owner, window closes
  const r1 = await call('GET', '/listings/r1', T3); assert.equal(r1.status, 200); assert.equal(r1.quote.cashback, 0); assert.equal(r1.quote.reason, 'NO_TOKEN');
  const b2 = (await call('POST', '/bookings', T3, { roomId: 'r1', moveInDate: soon(), months: 11 })).booking; assert.equal(b2.quote.payable, 8500);
  await call('POST', `/bookings/${b2.id}/pay`, T3, {}); await call('POST', `/bookings/${b2.id}/confirm`, ADMIN);
  const mi = (await call('POST', `/bookings/${b2.id}/movein`, ADMIN)).booking; assert.equal(mi.status, 'MOVED_IN'); assert.equal(mi.placement.status, 'DUE'); assert.equal(mi.placement.amount, 1700);
  const dash = await call('GET', '/owner/dashboard', OWNER1); assert.equal(dash.commission.due, 1700);
});
test('cancel refunds in full and releases the room; validation rules', async () => {
  const b = (await call('POST', '/bookings', T2, { roomId: 'r9', moveInDate: soon(), months: 6 })).booking;
  await call('POST', `/bookings/${b.id}/pay`, T2, {});
  const c = (await call('POST', `/bookings/${b.id}/cancel`, T2)).booking; assert.equal(c.status, 'CANCELLED'); assert.equal(c.refund.amount, 5500); assert.equal(c.refund.status, 'REFUNDED');
  assert.equal((await call('GET', '/listings/r9', T2)).status, 200);
  assert.equal((await call('POST', '/bookings', T2, { roomId: 'r9', moveInDate: '2020-01-01', months: 6 })).status, 422);
  assert.equal((await call('POST', '/bookings', T2, { roomId: 'r9', moveInDate: soon(), months: 99 })).status, 422);
  assert.equal((await call('POST', '/bookings', T2, { roomId: 'r2', moveInDate: soon(), months: 6 })).status, 409);   // r2 not verified yet
});
