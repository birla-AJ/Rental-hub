import { startWindow } from './vacancy.js';
import { markEligible } from './cashback.js';

// INITIATED -> QR_SCANNED -> (tenant + owner respond) -> VERIFIED | DISPUTED | MANUAL_REVIEW
export function initiateCheckout({ roomId, tenantId, ownerId, now = new Date() }) {
  return { roomId, tenantId, ownerId, state: 'INITIATED', qrScannedAt: null, tenant: null, owner: null, log: [{ at: now.toISOString(), ev: 'INITIATED' }] };
}
const log = (c, ev, now, extra = {}) => ({ ...c, log: [...c.log, { at: new Date(now).toISOString(), ev, ...extra }] });

export function scanQr(c, { scannedRoomId, now = new Date() }) {
  if (scannedRoomId !== c.roomId) throw new Error('QR does not match this room');
  return log({ ...c, state: 'QR_SCANNED', qrScannedAt: new Date(now).toISOString() }, 'QR_SCANNED', now);
}
/** Tenant confirmation is impossible without the QR scan (mandatory trigger). */
export function tenantConfirm(c, { checkoutDate, now = new Date() }) {
  if (!c.qrScannedAt) throw new Error('Scan the room QR to continue — required for cashback eligibility');
  return log({ ...c, tenant: { checkoutDate, at: new Date(now).toISOString() } }, 'TENANT_CONFIRMED', now);
}
export function ownerRespond(c, { confirmed, checkoutDate, now = new Date() }) {
  return log({ ...c, owner: { confirmed, checkoutDate, at: new Date(now).toISOString() } }, confirmed ? 'OWNER_CONFIRMED' : 'OWNER_REJECTED', now);
}

/** AI cross-verification. Dates must agree within toleranceDays (default 1 — assumption, configurable). */
export function crossVerify(c, { toleranceDays = 1, now = new Date() } = {}) {
  if (!c.tenant) return c;                                   // still before the tenant's confirmation: keep INITIATED / QR_SCANNED
  if (!c.owner) return { ...c, state: 'AWAITING_PARTIES' };
  if (!c.owner.confirmed) return log({ ...c, state: 'DISPUTED' }, 'DISPUTED', now, { reason: 'owner_rejected' });
  const diff = Math.abs(+new Date(c.tenant.checkoutDate) - +new Date(c.owner.checkoutDate)) / 86_400_000;
  if (diff > toleranceDays) return log({ ...c, state: 'MANUAL_REVIEW' }, 'MANUAL_REVIEW', now, { reason: 'date_mismatch', diffDays: diff });
  return log({ ...c, state: 'VERIFIED', verifiedAt: new Date(now).toISOString() }, 'VERIFIED', now);
}

/** Side-effects of a VERIFIED exit — the ONLY path to vacancy + cashback eligibility + 7-day clock. */
export function applyVerifiedExit(c, { room, token }) {
  if (c.state !== 'VERIFIED') throw new Error('Exit not dual-verified');
  return {
    room: { ...room, status: 'VACANT' },
    token: token ? markEligible(token, new Date(c.verifiedAt)) : null,   // a room may have no cashback token (tenant never registered it)
    window: startWindow(c.verifiedAt),
  };
}

/** Too many unclear replies / no answer in time: a person at RentalHub decides. */
export function escalate(c, { reason, now = new Date() }) {
  if (['VERIFIED', 'MANUAL_REVIEW', 'REJECTED'].includes(c.state)) return c;
  return log({ ...c, state: 'MANUAL_REVIEW' }, 'MANUAL_REVIEW', now, { reason });
}

/** Admin decision on a disputed / manual-review checkout. Approve = treated as a verified exit; reject = tenant stays. */
export function adminResolve(c, { approve, note = '', now = new Date() }) {
  if (!['DISPUTED', 'MANUAL_REVIEW'].includes(c.state)) throw new Error('This checkout is not waiting for review');
  return approve ? log({ ...c, state: 'VERIFIED', verifiedAt: new Date(now).toISOString() }, 'ADMIN_APPROVED', now, { reason: note })
                 : log({ ...c, state: 'REJECTED' }, 'ADMIN_REJECTED', now, { reason: note });
}
