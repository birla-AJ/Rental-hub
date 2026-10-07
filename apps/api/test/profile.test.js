import test from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../src/server.js';
import { H } from '../test-helpers.mjs';

let base;
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = `http://localhost:${server.address().port}`; });
test.after(() => server.close());
const call = async (m, p, who, body) => { const [role, sub] = who; const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...H(role, sub) }, body: body && JSON.stringify(body) }); return { status: r.status, ...(await r.json()) }; };
const T1 = ['tenant', 't1'], T2 = ['tenant', 't2'], T3 = ['tenant', 't3'], ADMIN = ['admin'], AGENT = ['agent'];
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('id-card')]);
const idPhoto = async (who) => (await call('POST', '/uploads', who, { purpose: 'kyc', contentType: 'image/png', data: PNG.toString('base64') })).ref;
const soon = () => new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);

test('profile: name/email validation, only own record changes', async () => {
  assert.equal((await call('POST', '/profile', T2, { name: 'A' })).status, 422);
  assert.equal((await call('POST', '/profile', T2, { name: 'Neha Sharma', email: 'bad' })).status, 422);
  assert.equal((await call('POST', '/profile', T2, { name: 'Neha S. Sharma', email: 'neha@example.com' })).status, 200);
  assert.equal((await call('GET', '/profile', T2)).user.name, 'Neha S. Sharma');
  assert.notEqual((await call('GET', '/profile', T1)).user.name, 'Neha S. Sharma');
});
test('KYC lifecycle: submit → pending → reject (reason) → re-upload → verify; history kept; no ID number stored', async () => {
  assert.equal((await call('POST', '/kyc/submit', T3, { idType: 'Passport', fullName: 'Amit Patel', dob: '1998-05-01', docRef: await idPhoto(T3) })).status, 422);
  assert.equal((await call('POST', '/kyc/submit', T3, { idType: 'PAN', fullName: 'Amit Patel', dob: '2015-05-01', docRef: await idPhoto(T3) })).status, 422);          // must be 18+
  const s = await call('POST', '/kyc/submit', T3, { idType: 'PAN', fullName: 'Amit Patel', dob: '1998-05-01', idNumber: 'ABCDE1234F', docRef: await idPhoto(T3) });
  assert.equal(s.status, 200); assert.equal((await call('POST', '/kyc/submit', T3, { idType: 'PAN', fullName: 'Amit Patel', dob: '1998-05-01', docRef: await idPhoto(T3) })).status, 409);   // already pending
  const h = await call('GET', '/kyc', T3); assert.equal(h.state, 'PENDING'); assert.equal(JSON.stringify(h).includes('ABCDE1234F'), false);
  assert.equal((await call('POST', '/kyc/t3/verify', T3)).status, 403);                           // can't verify yourself
  assert.equal((await call('POST', '/kyc/t3/reject', ADMIN, {})).status, 422);
  assert.equal((await call('POST', '/kyc/t3/reject', ADMIN, { reason: 'Photo is blurry' })).status, 200);
  assert.equal((await call('GET', '/kyc', T3)).state, 'REJECTED');
  await call('POST', '/kyc/submit', T3, { idType: 'Aadhaar', fullName: 'Amit Patel', dob: '1998-05-01', docRef: await idPhoto(T3) });
  assert.equal((await call('POST', '/kyc/t3/verify', AGENT)).status, 200);
  const k = await call('GET', '/kyc', T3); assert.equal(k.state, 'VERIFIED'); assert.equal(k.history.length, 2);
  const n = await call('GET', '/notifications', T3); assert.ok(n.rows.some((x) => x.title === 'KYC verified') && n.rows.some((x) => x.title === 'KYC needs another look'));
});
test('notifications: booking events reach tenant + admin; read only affects the caller', async () => {
  const b = (await call('POST', '/bookings', T2, { roomId: 'r10', moveInDate: soon(), months: 6 })).booking;
  await call('POST', `/bookings/${b.id}/pay`, T2, {});
  const n2 = await call('GET', '/notifications', T2); assert.ok(n2.unread >= 1); assert.ok(n2.rows.some((x) => x.title === 'Booking received'));
  assert.ok((await call('GET', '/notifications', ADMIN)).rows.some((x) => x.title === 'New booking'));
  await call('POST', '/notifications/read', T1, { all: true });                                      // someone else marking read…
  assert.ok((await call('GET', '/notifications', T2)).unread >= 1);                                   // …doesn't touch T2's
  await call('POST', '/notifications/read', T2, { all: true }); assert.equal((await call('GET', '/notifications', T2)).unread, 0);
  await call('POST', `/bookings/${b.id}/cancel`, T2);
});
test('rental history + trust profile; tenants only', async () => {
  const h = await call('GET', '/history', T1);
  assert.ok(h.stays.some((x) => x.room === 'Room 101')); assert.equal(h.trust.noDispute, true); assert.deepEqual(h.trust.cities, ['Indore']);
  assert.equal((await call('GET', '/history', ['owner', 'o1'])).status, 403);
});
test('saved homes toggle per tenant', async () => {
  assert.equal((await call('POST', '/saved/r6', T1)).saved, true);
  assert.deepEqual((await call('GET', '/saved', T1)).ids, ['r6']); assert.deepEqual((await call('GET', '/saved', T3)).ids, []);
  assert.equal((await call('POST', '/saved/r6', T1)).saved, false);
});
