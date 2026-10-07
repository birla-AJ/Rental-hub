// Understands short WhatsApp replies ("YES", "nahi", "5 oct", "05/10/2026", Hindi too). Pure, so it is fully testable.
const YES = new Set(['yes', 'y', 'yep', 'yeah', 'ok', 'okay', 'confirm', 'confirmed', 'correct', 'right', 'sahi', 'haan', 'han', 'ha', 'haa', 'theek', 'thik', 'हाँ', 'हां', 'सही', 'ठीक']);
const NO = new Set(['no', 'n', 'nope', 'nahi', 'nahin', 'nahee', 'galat', 'wrong', 'incorrect', 'नहीं', 'नही', 'गलत']);
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAY = 864e5;

const iso = (y, m, d) => { const dt = new Date(Date.UTC(y, m - 1, d)); return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null; };
const withYear = (m, d, y, now) => { // no year given: this year, or next year if that would be long in the past
  if (y) return iso(y < 100 ? 2000 + y : y, m, d);
  let r = iso(now.getUTCFullYear(), m, d); if (r && +new Date(r) < +now - 60 * DAY) r = iso(now.getUTCFullYear() + 1, m, d); return r;
};

export function parseDate(text, now = new Date()) {
  const s = String(text).toLowerCase();
  let m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(s); if (m) return iso(+m[1], +m[2], +m[3]);
  m = /\b(\d{1,2})\s*(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s*,?\s*(\d{4}))?\b/.exec(s); if (m) return withYear(MONTHS.indexOf(m[2]) + 1, +m[1], m[3] ? +m[3] : 0, now);
  m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/.exec(s); if (m) return withYear(MONTHS.indexOf(m[1]) + 1, +m[2], m[3] ? +m[3] : 0, now);
  m = /\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/.exec(s); if (m) return withYear(+m[2], +m[1], m[3] ? +m[3] : 0, now);   // Indian order: day first
  return null;
}

/** -> { intent: 'CONFIRM' | 'REJECT' | 'DATE' | 'UNCLEAR', date? }. A date wins ("no, he left on 6 oct" = correction). */
export function parseReply(text, now = new Date()) {
  const date = parseDate(text, now);
  if (date) return { intent: 'DATE', date };
  const words = String(text).toLowerCase().split(/[\s,.!?;:()"'\-/]+/u).filter(Boolean);
  const yes = words.some((w) => YES.has(w)), no = words.some((w) => NO.has(w));
  if (yes && !no) return { intent: 'CONFIRM' };
  if (no && !yes) return { intent: 'REJECT' };
  return { intent: 'UNCLEAR' };
}

/** A move-out date is believable if it is at most 3 days ago and at most 60 days ahead. */
export const plausibleCheckoutDate = (isoDate, now = new Date()) => { const t = +new Date(isoDate); return Number.isFinite(t) && t >= +now - 3 * DAY && t <= +now + 60 * DAY; };
