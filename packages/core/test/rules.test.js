import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../src/index.js';

const RENT = 10000;
test('cashback ladder 30/30/10/7', () => {
  assert.deepEqual([1,2,3,4,5,9].map(c.cashbackRate), [0.3,0.3,0.1,0.07,0.07,0.07]);
  assert.equal(c.cashbackAmount(RENT, 3), 1000);
});
test('registration mints deferred 30% token, hides internal tracking from tenant', () => {
  const t = c.mintRegistrationToken({ propertyId:'p1', roomId:'r1', monthlyRent: RENT });
  assert.equal(t.amount, 3000); assert.equal(t.state, 'DORMANT');
  assert.equal('internal' in c.toTenantView(t), false);
  assert.ok(!JSON.stringify(c.toTenantView(t)).toLowerCase().includes('expir'));
});
test('commission: <=7d => 20% of one month, >7d => waived 0', () => {
  const win = c.startWindow('2026-10-01T00:00:00Z');
  assert.deepEqual(c.commissionOutcome({ monthlyRent: RENT, window: win, placedAt: '2026-10-07T23:00:00Z' }), { status:'DUE', rate:0.2, amount:2000 });
  const late = c.commissionOutcome({ monthlyRent: RENT, window: win, placedAt: '2026-10-09T00:00:00Z' });
  assert.equal(late.status, 'WAIVED'); assert.equal(late.amount, 0);
  assert.ok(!('compensation' in late));
});
test('window status Day1..Day7 then waived + continue', () => {
  const win = c.startWindow('2026-10-01T00:00:00Z');
  assert.equal(c.windowStatus(win, new Date('2026-10-01T05:00:00Z')).day, 1);
  assert.equal(c.windowStatus(win, new Date('2026-10-04T05:00:00Z')).day, 4);
  const ex = c.windowStatus(win, new Date('2026-10-09T00:00:00Z'));
  assert.equal(ex.label, 'Commission Waived'); assert.equal(ex.continuePlacement, true);
});
test('checkout: QR mandatory; only dual verification vacates room & unlocks cashback', () => {
  let k = c.initiateCheckout({ roomId:'r1', tenantId:'t1', ownerId:'o1' });
  assert.throws(() => c.tenantConfirm(k, { checkoutDate:'2026-10-01' }), /Scan the room QR/);
  assert.throws(() => c.scanQr(k, { scannedRoomId:'WRONG' }));
  k = c.scanQr(k, { scannedRoomId:'r1' });
  k = c.tenantConfirm(k, { checkoutDate:'2026-10-01' });
  assert.equal(c.crossVerify(k).state, 'AWAITING_PARTIES');
  assert.throws(() => c.applyVerifiedExit(c.crossVerify(k), {}), /dual-verified/);
  k = c.ownerRespond(k, { confirmed:true, checkoutDate:'2026-10-01' });
  k = c.crossVerify(k, { now: new Date('2026-10-01T10:00:00Z') });
  assert.equal(k.state, 'VERIFIED');
  const token = c.mintRegistrationToken({ propertyId:'p1', roomId:'r1', monthlyRent:RENT });
  const out = c.applyVerifiedExit(k, { room:{ id:'r1', status:'CHECKOUT_REQUESTED' }, token });
  assert.equal(out.room.status, 'VACANT'); assert.equal(out.token.state, 'ELIGIBLE');
  assert.equal(c.windowStatus(out.window, new Date('2026-10-01T12:00:00Z')).day, 1);
});
test('checkout: owner rejection -> dispute; date mismatch -> manual review', () => {
  const base = () => c.tenantConfirm(c.scanQr(c.initiateCheckout({ roomId:'r1', tenantId:'t', ownerId:'o' }), { scannedRoomId:'r1' }), { checkoutDate:'2026-10-01' });
  assert.equal(c.crossVerify(c.ownerRespond(base(), { confirmed:false })).state, 'DISPUTED');
  assert.equal(c.crossVerify(c.ownerRespond(base(), { confirmed:true, checkoutDate:'2026-10-10' })).state, 'MANUAL_REVIEW');
});
test('token cannot be redeemed before verified checkout, nor on 1st booking', () => {
  const t = c.mintRegistrationToken({ propertyId:'p', roomId:'r', monthlyRent:RENT });
  assert.throws(() => c.redeem(t, { monthlyRent:RENT, bookingNumber:2 }), /not eligible/);
  const e = c.markEligible(t);
  assert.throws(() => c.redeem(e, { monthlyRent:RENT, bookingNumber:1 }));
  assert.equal(c.redeem(e, { monthlyRent:RENT, bookingNumber:2 }).credit, 3000);
});
