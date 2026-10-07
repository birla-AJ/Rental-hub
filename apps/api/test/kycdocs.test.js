import test from 'node:test';
import assert from 'node:assert/strict';
import { server, purgeKycDocs } from '../src/server.js';
import { H } from '../test-helpers.mjs';

let base;
test.before(async () => { await new Promise((r) => server.listen(0, r)); base = `http://localhost:${server.address().port}`; });
test.after(() => server.close());
const raw = async (m, p, who, body) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...(who ? H(...who) : {}) }, body: body && JSON.stringify(body) }); const ct = r.headers.get('content-type') ?? ''; return { status: r.status, ct, cache: r.headers.get('cache-control'), ...(ct.includes('json') ? await r.json() : { buf: Buffer.from(await r.arrayBuffer()) }) }; };
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('my-aadhaar-photo')]);
const up = (who, extra = {}) => raw('POST', '/uploads', who, { purpose: 'kyc', contentType: 'image/png', data: PNG.toString('base64'), ...extra });
const submit = (who, docRef) => raw('POST', '/kyc/submit', who, { idType: 'Aadhaar', fullName: 'Test Person', dob: '1995-01-01', docRef });
const T1 = ['tenant', 't1'], T2 = ['tenant', 't2'], T3 = ['tenant', 't3'], ADMIN = ['admin'];

test('ID photos: images only, real content, and never public', async () => {
  assert.equal((await up(T3, { contentType: 'video/mp4' })).status, 415);
  assert.equal((await up(T3, { data: Buffer.from('<html>not a photo</html>').toString('base64') })).status, 415);
  const ok = await up(T3); assert.equal(ok.status, 200); assert.match(ok.ref, /^\/private\/[0-9a-f-]{36}\.png$/);
  assert.equal((await raw('GET', ok.ref.replace('/private/', '/files/'))).status, 404);                 // not in the public folder
  assert.equal((await raw('GET', ok.ref, null)).status, 401);                                            // no login
});
test('who can look at an ID photo: the owner, admins and the assigned agent — nobody else', async () => {
  const doc = (await up(T3)).ref;                                                                         // t3 registered p3, which agent a1 handles
  const own = await raw('GET', doc, T3); assert.equal(own.status, 200); assert.equal(own.ct, 'image/png'); assert.ok(own.buf.equals(PNG)); assert.match(own.cache, /no-store/);
  assert.equal((await raw('GET', doc, ADMIN)).status, 200);
  assert.equal((await raw('GET', doc, ['agent', 'a1'])).status, 200);
  assert.equal((await raw('GET', doc, ['agent', 'a2'])).status, 403);                                   // an agent with no link to this tenant
  assert.equal((await raw('GET', doc, T2)).status, 403); assert.equal((await raw('GET', doc, ['owner', 'o1'])).status, 403);
  assert.equal((await raw('GET', '/private/..%2F..%2Fetc%2Fpasswd', T3)).status, 404); assert.equal((await raw('GET', '/private/00000000-0000-0000-0000-000000000000.png', ADMIN)).status, 404);
});
test('KYC needs your own photo, used once', async () => {
  assert.equal((await submit(T2, undefined)).status, 422); assert.equal((await submit(T2, '/files/whatever.png')).status, 422);
  const theirs = (await up(T3)).ref; assert.equal((await submit(T2, theirs)).status, 422);               // someone else's photo
  const mine = (await up(T2)).ref; assert.equal((await submit(T2, mine)).status, 200);
  assert.equal((await submit(T3, mine)).status, 422);
  const row = (await raw('GET', '/admin/kyc', ADMIN)).rows.find((r) => r.id === 't2'); assert.equal(row.docRef, mine);   // the reviewer gets the (protected) link
});
test('retention: the ID photo is deleted 90 days after the decision, and unused uploads after a week', async () => {
  const mine = (await raw('GET', '/admin/kyc', ADMIN)).rows.find((r) => r.id === 't2').docRef;
  assert.equal(purgeKycDocs(new Date()), 0);                                                              // still pending: kept
  assert.equal((await raw('POST', '/kyc/t2/verify', ADMIN)).state, 'VERIFIED');
  purgeKycDocs(new Date(Date.now() + 80 * 864e5)); assert.equal((await raw('GET', mine, ADMIN)).status, 200);   // day 80: this photo is kept (only abandoned uploads go)
  assert.ok(purgeKycDocs(new Date(Date.now() + 91 * 864e5)) >= 1);                                       // day 91: gone
  assert.equal((await raw('GET', mine, ADMIN)).status, 404); assert.equal((await raw('GET', mine, T2)).status, 404);
  assert.equal((await raw('GET', '/kyc', T2)).history[0].docRef, null); assert.equal((await raw('GET', '/kyc', T2)).state, 'VERIFIED');   // the decision stays, the photo doesn't
  const stray = (await up(['tenant', 't1'])).ref; assert.equal((await raw('GET', stray, T1)).status, 200);
  purgeKycDocs(new Date(Date.now() + 8 * 864e5)); assert.equal((await raw('GET', stray, T1)).status, 404);   // abandoned upload cleaned up
});
