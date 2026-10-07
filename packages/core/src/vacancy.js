import { COMMISSION_RATE, PLACEMENT_WINDOW_DAYS, DAY_MS } from './constants.js';

export function startWindow(verifiedVacantAt) {
  const start = new Date(verifiedVacantAt);
  return { startedAt: start.toISOString(), endsAt: new Date(+start + PLACEMENT_WINDOW_DAYS * DAY_MS).toISOString() };
}

/** UI helper: DAY 1..7 progress, or expired (commission waived, still trying free). */
export function windowStatus(win, now = new Date()) {
  const elapsed = +new Date(now) - +new Date(win.startedAt);
  if (elapsed > PLACEMENT_WINDOW_DAYS * DAY_MS) {
    return { phase: 'EXPIRED', day: PLACEMENT_WINDOW_DAYS, label: 'Commission Waived', continuePlacement: true };
  }
  const day = Math.min(PLACEMENT_WINDOW_DAYS, Math.floor(elapsed / DAY_MS) + 1);
  return { phase: 'ACTIVE', day, daysLeft: PLACEMENT_WINDOW_DAYS - day, label: `Day ${day} of ${PLACEMENT_WINDOW_DAYS}` };
}

/**
 * Commission outcome. Placed <=7d: 20% of ONE month's rent. Otherwise ₹0 — WAIVED.
 * There is NO compensation field anywhere: owner never receives cash from the platform.
 */
export function commissionOutcome({ monthlyRent, window: win, placedAt }) {
  const within = +new Date(placedAt) - +new Date(win.startedAt) <= PLACEMENT_WINDOW_DAYS * DAY_MS;
  return within
    ? { status: 'DUE', rate: COMMISSION_RATE, amount: Math.round(monthlyRent * COMMISSION_RATE) }
    : { status: 'WAIVED', rate: 0, amount: 0, note: 'Commission waived. Platform continues placement at no charge.' };
}
