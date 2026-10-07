import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../src/index.js';

const NOW = new Date('2026-10-05T10:00:00Z');
test('replies: yes / no in English, Hinglish and Hindi', () => {
  for (const t of ['YES', 'yes.', 'Haan ji', 'ok', 'sahi hai', 'हाँ', 'ठीक है']) assert.equal(c.parseReply(t, NOW).intent, 'CONFIRM', t);
  for (const t of ['no', 'NO!', 'nahi', 'galat hai', 'नहीं']) assert.equal(c.parseReply(t, NOW).intent, 'REJECT', t);
});
test('replies: dates in the formats people really send (day first)', () => {
  assert.deepEqual(c.parseReply('5 oct', NOW), { intent: 'DATE', date: '2026-10-05' });
  assert.equal(c.parseReply('Oct 7th', NOW).date, '2026-10-07'); assert.equal(c.parseReply('07/10/2026', NOW).date, '2026-10-07');
  assert.equal(c.parseReply('7-10', NOW).date, '2026-10-07'); assert.equal(c.parseReply('2026-10-08', NOW).date, '2026-10-08');
  assert.equal(c.parseReply('no, he left on 6 October', NOW).intent, 'DATE');          // a correction, not a plain "no"
  assert.equal(c.parseDate('31 feb', NOW), null); assert.equal(c.parseDate('hello', NOW), null);
  assert.equal(c.parseDate('3 jan', new Date('2026-12-20T00:00:00Z')), '2027-01-03');   // rolls into next year
});
test('replies: ambiguous or unrelated text is UNCLEAR, never guessed', () => {
  for (const t of ['maybe', 'who is this?', 'yes no', '', 'know']) assert.equal(c.parseReply(t, NOW).intent, 'UNCLEAR', t);
});
test('plausible move-out dates', () => {
  assert.equal(c.plausibleCheckoutDate('2026-10-07', NOW), true); assert.equal(c.plausibleCheckoutDate('2026-09-01', NOW), false); assert.equal(c.plausibleCheckoutDate('2027-03-01', NOW), false);
});
test('escalate + admin resolve', () => {
  let k = c.tenantConfirm(c.scanQr(c.initiateCheckout({ roomId: 'r1', tenantId: 't', ownerId: 'o' }), { scannedRoomId: 'r1' }), { checkoutDate: '2026-10-05' });
  k = c.escalate(k, { reason: 'no_reply' }); assert.equal(k.state, 'MANUAL_REVIEW');
  const ok = c.adminResolve(k, { approve: true, note: 'owner confirmed by phone', now: NOW }); assert.equal(ok.state, 'VERIFIED'); assert.equal(ok.verifiedAt, NOW.toISOString());
  assert.equal(c.adminResolve(k, { approve: false }).state, 'REJECTED');
  assert.throws(() => c.adminResolve(ok, { approve: true }), /not waiting/);
  assert.equal(c.escalate(ok, { reason: 'x' }).state, 'VERIFIED');                      // a finished checkout can't be pushed back to review
});

test('a verified exit works even when the room has no cashback token', () => {
  let k = c.initiateCheckout({ roomId: 'r9', tenantId: 't', ownerId: 'o' });
  k = c.crossVerify(c.ownerRespond(c.tenantConfirm(c.scanQr(k, { scannedRoomId: 'r9' }), { checkoutDate: '2026-10-05' }), { confirmed: true, checkoutDate: '2026-10-05' }), { now: NOW });
  const out = c.applyVerifiedExit(k, { room: { id: 'r9', status: 'CHECKOUT_REQUESTED' }, token: undefined });
  assert.equal(out.room.status, 'VACANT'); assert.equal(out.token, null); assert.ok(out.window.endsAt);
});
