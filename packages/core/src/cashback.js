import { CASHBACK_LADDER, REGISTRATION_TOKEN_RATE } from './constants.js';

/** Cashback rate for the tenant's Nth booking (4th onward = 7%). */
export function cashbackRate(bookingNumber) {
  if (!Number.isInteger(bookingNumber) || bookingNumber < 1) throw new Error('bookingNumber must be >= 1');
  const step = CASHBACK_LADDER.find((s) => s.booking === bookingNumber) ?? CASHBACK_LADDER.at(-1);
  return step.rate;
}
export const cashbackAmount = (monthlyRent, bookingNumber) => Math.round(monthlyRent * cashbackRate(bookingNumber));

/** Token minted when tenant's registration is agent-verified. Deferred: never cash at this point. */
export function mintRegistrationToken({ propertyId, roomId, tenantId = null, monthlyRent, now = new Date() }) {
  return {
    propertyId, roomId, tenantId,
    amount: Math.round(monthlyRent * REGISTRATION_TOKEN_RATE),
    state: 'DORMANT',
    createdAt: now.toISOString(),
    eligibleAt: null, redeemedAt: null,
    // internal only (admin). NEVER send to tenant UI — token appears permanent.
    internal: { inactivityTrackedFrom: now.toISOString() },
  };
}

/** Only a verified (dual-confirmed) checkout makes a token eligible. */
export function markEligible(token, now = new Date()) {
  if (token.state !== 'DORMANT' && token.state !== 'LOCKED') throw new Error(`cannot make ${token.state} token eligible`);
  return { ...token, state: 'ELIGIBLE', eligibleAt: now.toISOString() };
}

/** Redeem against 2nd+ booking. Returns the credited value + new token. */
export function redeem(token, { monthlyRent, bookingNumber, now = new Date() }) {
  if (token.state !== 'ELIGIBLE') throw new Error('token is not eligible — complete a verified checkout first');
  if (bookingNumber < 2) throw new Error('token redeems from the 2nd booking onward');
  return { credit: cashbackAmount(monthlyRent, bookingNumber), token: { ...token, state: 'REDEEMED', redeemedAt: now.toISOString() } };
}

/** Strip internal fields before sending to tenant clients (no expiry shown). */
export const toTenantView = ({ internal, ...rest }) => rest;
