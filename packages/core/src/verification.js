// Agent physical verification rules (plan: KYC + owner contact + WHOLE-property geo-tag + QR on EVERY room).
export const CHECKLIST = Object.freeze({
  photosMatch: 'Photos/video match the property',
  roomsCounted: 'All rooms in the property counted',
  ownerContactCaptured: 'Owner contact captured',
  tenantKycVerified: 'Tenant KYC verified',
  geoTagged: 'Whole property geo-tagged',
  qrApplied: 'QR tag applied to every room',
});

export const qrPayload = (roomId) => `rentalhub://room/${roomId}`;
export const parseQr = (data) => { const m = /^rentalhub:\/\/room\/([\w-]+)$/.exec(String(data)); return m ? m[1] : null; };

const validGeo = (g) => g && Number.isFinite(g.lat) && Number.isFinite(g.lng) && Math.abs(g.lat) <= 90 && Math.abs(g.lng) <= 180;

/** Returns a list of human-readable gaps. Empty list = ready to submit. */
export function validateSubmission({ checklist = {}, geo, propertyRoomIds = [], qrRoomIds = [] }) {
  const missing = [];
  for (const [k, label] of Object.entries(CHECKLIST)) if (!checklist[k]) missing.push(label);
  if (!validGeo(geo)) missing.push('Valid property location (geo-tag)');
  const noQr = propertyRoomIds.filter((r) => !qrRoomIds.includes(r));
  if (noQr.length) missing.push(`QR not assigned for ${noQr.length} room(s)`);
  return missing;
}
