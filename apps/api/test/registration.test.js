import test from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../src/server.js';
import { H } from '../test-helpers.mjs';

let base, TOKEN;
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = `http://localhost:${server.address().port}`; });
test.after(() => server.close());
const raw = async (m, p, headers, body) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...headers }, body }); const ct = r.headers.get('content-type'); return { status: r.status, ct, ...(ct?.includes('json') ? await r.json() : { buf: Buffer.from(await r.arrayBuffer()) }) }; };
const call = (m, p, who, body) => raw(m, p, Array.isArray(who) ? H(...who) : { authorization: 'Bearer ' + who }, body && JSON.stringify(body));
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('fake-image-body')]);
const upload = (who, buf = png, contentType = 'image/png') => call('POST', '/uploads', who, { contentType, data: buf.toString('base64') });
const ADMIN = ['admin'];

test('uploads: type allow-list, real content check, size cap, safe file serving', async () => {
  const r = await raw('POST', '/auth/otp', {}, JSON.stringify({ phone: '9000011111' }));
  const v = await raw('POST', '/auth/verify', {}, JSON.stringify({ phone: '9000011111', code: r.devCode })); TOKEN = v.token;
  assert.equal((await upload(TOKEN, png, 'application/pdf')).status, 415);
  assert.equal((await upload(TOKEN, Buffer.from('<script>alert(1)</script>'), 'image/png')).status, 415);          // mislabeled file
  assert.equal((await upload(TOKEN, Buffer.concat([png, Buffer.alloc(5_100_000)]))).status, 413);
  const ok = await upload(TOKEN); assert.equal(ok.status, 200); assert.match(ok.ref, /^\/files\/[0-9a-f-]{36}\.png$/);
  const f = await raw('GET', ok.ref, {}); assert.equal(f.status, 200); assert.equal(f.ct, 'image/png'); assert.ok(f.buf.equals(png));
  assert.equal((await raw('GET', '/files/..%2F..%2Fetc%2Fpasswd', {})).status, 404); assert.equal((await raw('GET', '/files/nothing.png', {})).status, 404);
  assert.equal((await raw('POST', '/uploads', {}, JSON.stringify({}))).status, 401);                                // login required to upload
});
test('malformed JSON no longer crashes the server', async () => {
  assert.equal((await raw('POST', '/profile', H('tenant', 't1'), '{not json')).status, 400);
  assert.equal((await call('GET', '/profile', ['tenant', 't1'])).status, 200);
});

const base0 = { name: 'Lotus Residency', type: 'PG', address: 'Plot 7, Scheme 54, Vijay Nagar, Indore', locality: 'Vijay Nagar', roomName: 'Room 305', rent: 7200, totalRooms: 3, ownerName: 'Mahesh Joshi', ownerPhone: '9826012345', agentVisit: true, amenities: ['WiFi', 'Meals'] };
test('registration: validation, assignment, placeholder rooms, duplicate guard', async () => {
  const photos = []; for (let i = 0; i < 3; i++) photos.push((await upload(TOKEN)).ref);
  const bad = async (patch, status = 422) => assert.equal((await call('POST', '/properties', TOKEN, { ...base0, photos, ...patch })).status, status);
  await bad({ photos: photos.slice(0, 2) }); await bad({ photos: ['/files/00000000-0000-0000-0000-000000000000.png', ...photos.slice(1)] });
  await bad({ agentVisit: false }); await bad({ ownerPhone: '12345' }); await bad({ ownerPhone: '9000011111' });                 // owner can't be the registering tenant
  await bad({ rent: 100 }); await bad({ type: 'Castle' }); await bad({ totalRooms: 0 }); await bad({ address: 'short' });
  const before = (await call('GET', '/listings', ['tenant', 't1'])).total;
  const ok = await call('POST', '/properties', TOKEN, { ...base0, photos }); assert.equal(ok.status, 200); assert.equal(ok.property.stage, 'ASSIGNED');
  await bad({}, 409);                                                                                                       // same address again
  const mine = (await call('GET', '/properties/mine', TOKEN)).rows[0];
  assert.equal(mine.stage, 'ASSIGNED'); assert.equal(mine.expectedToken, 2160); assert.equal(mine.token, null); assert.equal(mine.rooms, 3);
  assert.equal((await call('GET', '/listings', ['tenant', 't1'])).total, before);                                           // unverified rooms are never searchable
  assert.equal((await call('GET', '/properties/mine', ['tenant', 't1'])).rows.some((r) => r.name === 'Lotus Residency'), false); // other tenants can't see it
  assert.ok((await call('GET', '/notifications', ADMIN)).rows.some((n) => n.title === 'New property registered'));
  globalThis.PID = mine.id;
});
test('visit → verification → token → owner consent → checkout readiness', async () => {
  const PID = globalThis.PID, when = new Date(Date.now() + 864e5).toISOString();
  const agent = (await call('POST', `/properties/${PID}/schedule`, ['agent', 'a1'], { visitAt: when })).status === 200 ? ['agent', 'a1'] : ['agent', 'a2'];
  assert.equal((await call('POST', `/properties/${PID}/schedule`, agent, { visitAt: when })).status, 200);
  const other = agent[1] === 'a1' ? ['agent', 'a2'] : ['agent', 'a1']; assert.equal((await call('POST', `/properties/${PID}/schedule`, other, { visitAt: when })).status, 403);
  assert.equal((await call('POST', `/properties/${PID}/schedule`, agent, { visitAt: '2020-01-01' })).status, 422);
  assert.equal((await call('GET', '/properties/mine', TOKEN)).rows[0].stage, 'SCHEDULED');
  await call('POST', `/properties/${PID}/start`, agent); assert.equal((await call('GET', '/properties/mine', TOKEN)).rows[0].stage, 'IN_PROGRESS');
  const home0 = await call('GET', '/home', TOKEN); assert.equal(home0.current.tagReady, false);
  const co = await call('POST', `/checkout/${home0.current.roomId}/start`, TOKEN); assert.equal(co.status, 409);               // no QR tag yet
  const full = { photosMatch: 1, roomsCounted: 1, ownerContactCaptured: 1, tenantKycVerified: 1, geoTagged: 1, qrApplied: 1 };
  assert.equal((await call('POST', `/properties/${PID}/verify`, agent, { checklist: full, geo: { lat: 22.75, lng: 75.89 } })).status, 422);   // QR missing
  await call('POST', `/properties/${PID}/qr`, agent);
  assert.equal((await call('POST', `/properties/${PID}/verify`, agent, { checklist: full, geo: { lat: 22.75, lng: 75.89 } })).status, 200);
  const mine = (await call('GET', '/properties/mine', TOKEN)).rows[0]; assert.equal(mine.stage, 'COMPLETED'); assert.equal(mine.token.amount, 2160); assert.equal(mine.token.state, 'DORMANT'); assert.equal('internal' in mine.token, false);
  const home = await call('GET', '/home', TOKEN); assert.equal(home.current.tagReady, true); assert.equal(home.wallet.saved, 2160);
  // owner consent: only the owner whose phone was given
  assert.ok((await call('GET', '/owner/consents', ['owner', 'o2'])).rows.some((r) => r.id === PID));
  assert.equal((await call('GET', '/owner/consents', ['owner', 'o3'])).rows.some((r) => r.id === PID), false);
  assert.equal((await call('POST', `/owner/consent/${PID}`, ['owner', 'o3'], { accept: true })).status, 403);
  assert.equal((await call('POST', `/owner/consent/${PID}`, ['owner', 'o2'], { accept: true })).accepted, true);
  assert.ok((await call('GET', '/owner/dashboard', ['owner', 'o2'])).rooms.some((r) => r.id === home.current.roomId));
  assert.equal((await call('POST', `/owner/consent/${PID}`, ['owner', 'o2'], { accept: true })).status, 409);
  assert.equal((await call('POST', `/checkout/${home.current.roomId}/start`, TOKEN)).status, 200);                           // now checkout works
});
