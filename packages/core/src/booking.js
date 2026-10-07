import { cashbackAmount } from './cashback.js';

/** Ladder position of a tenant's next booking. Registering a property counts as booking #1, so a registered tenant's first
 *  search-booking is #2 (30%), then #3 (10%), #4+ (7%). */
export const bookingNumberFor = ({ hasRegistered, priorValidBookings }) => priorValidBookings + (hasRegistered ? 2 : 1);

/**
 * Price a booking. Payable = one month's rent - cashback. NO platform fee is added (none exists in the business plan).
 * `reason` explains (in codes the UI turns into plain language) why cashback is 0.
 */
export function quoteBooking({ monthlyRent, months, bookingNumber, token }) {
  let cashback = 0, reason = null;
  if (!token) reason = 'NO_TOKEN';
  else if (token.state !== 'ELIGIBLE') reason = 'TOKEN_NOT_READY';   // dormant: tenant has not completed a verified checkout yet
  else if (bookingNumber < 2) reason = 'FIRST_BOOKING';
  else cashback = Math.min(monthlyRent, cashbackAmount(monthlyRent, bookingNumber));
  return { rent: monthlyRent, months, cashback, payable: monthlyRent - cashback, bookingNumber, reason };
}
