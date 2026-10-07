import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../src/index.js';

const tok = (state) => ({ ...c.mintRegistrationToken({ propertyId: 'p', roomId: 'r', tenantId: 't', monthlyRent: 10000 }), state });
test('booking number: registration counts as #1', () => {
  assert.equal(c.bookingNumberFor({ hasRegistered: true, priorValidBookings: 0 }), 2);
  assert.equal(c.bookingNumberFor({ hasRegistered: true, priorValidBookings: 2 }), 4);
  assert.equal(c.bookingNumberFor({ hasRegistered: false, priorValidBookings: 0 }), 1);
});
test('quote: eligible token on 2nd booking = 30% off one month, no extra fees', () => {
  assert.deepEqual(c.quoteBooking({ monthlyRent: 9000, months: 11, bookingNumber: 2, token: tok('ELIGIBLE') }), { rent: 9000, months: 11, cashback: 2700, payable: 6300, bookingNumber: 2, reason: null });
  assert.equal(c.quoteBooking({ monthlyRent: 9000, months: 6, bookingNumber: 3, token: tok('ELIGIBLE') }).cashback, 900);
  assert.equal(c.quoteBooking({ monthlyRent: 9000, months: 6, bookingNumber: 5, token: tok('ELIGIBLE') }).cashback, 630);
});
test('quote: dormant token gives nothing and says why; no token; cashback never exceeds rent', () => {
  assert.equal(c.quoteBooking({ monthlyRent: 9000, months: 6, bookingNumber: 2, token: tok('DORMANT') }).reason, 'TOKEN_NOT_READY');
  assert.equal(c.quoteBooking({ monthlyRent: 9000, months: 6, bookingNumber: 1, token: null }).reason, 'NO_TOKEN');
  assert.equal(c.quoteBooking({ monthlyRent: 9000, months: 6, bookingNumber: 2, token: tok('DORMANT') }).payable, 9000);
  assert.ok(c.quoteBooking({ monthlyRent: 100, months: 1, bookingNumber: 2, token: tok('ELIGIBLE') }).payable >= 0);
});
