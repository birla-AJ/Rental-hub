// Locked business constants (source: Tenant_Sourced_Rental_Model_Plan.docx). Do not change without client sign-off.
export const COMMISSION_RATE = 0.2;          // 20% of ONE month's rent, success-based only
export const PLACEMENT_WINDOW_DAYS = 7;      // starts at verified-vacancy timestamp
export const REGISTRATION_TOKEN_RATE = 0.3;  // 30% deferred token on 1st registration
// booking number -> % of one month's rent
export const CASHBACK_LADDER = [
  { booking: 1, rate: 0.3, kind: 'token' },   // 1st = deferred token (registration)
  { booking: 2, rate: 0.3, kind: 'redeem' },  // 2nd = 30% redeemed
  { booking: 3, rate: 0.1, kind: 'redeem' },
  { booking: 4, rate: 0.07, kind: 'redeem' }, // 4th onward
];
export const DAY_MS = 86_400_000;

export const PROPERTY_STATUS = Object.freeze([
  'DRAFT','PENDING_VERIFICATION','VERIFICATION_IN_PROGRESS','VERIFIED','REJECTED',
  'OCCUPIED','VACANT','PLACEMENT_IN_PROGRESS','PLACED','INACTIVE',
]);
export const ROOM_STATUS = Object.freeze([
  'AVAILABLE','OCCUPIED','CHECKOUT_REQUESTED','VERIFICATION_PENDING','VACANT',
  'PLACEMENT_IN_PROGRESS','BOOKED','RESERVED',
]);
export const CASHBACK_STATE = Object.freeze(['LOCKED','DORMANT','ELIGIBLE','REDEEMED','CANCELLED','UNDER_REVIEW']);
