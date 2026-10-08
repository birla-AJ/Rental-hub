// Reference API (in-memory data, REAL auth: phone OTP + JWT). Next step: swap `db` for Prisma/Postgres (see prisma/schema.prisma).
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import * as core from '../../../packages/core/src/index.js';
import { signToken, verifyToken, requestOtp, checkOtp, validPhone, sms } from './auth.js';
import { createPersistence, COLLECTIONS } from './persist.js';
import { createProvider, verifySignature, extractInbound } from './messaging.js';
import { createAi } from './ai.js';
import { createPayments } from './payments.js';
import { createPush } from './push.js';
import { securityHeaders, applyCors, createLimiter, clientIp, logLine, validateEnv } from './hardening.js';

const db = {
  rooms: {
    r2: { id: 'r2', propertyId: 'p2', name: 'Room 201', rent: 7000, status: 'OCCUPIED', tenantId: 't2', ownerId: 'o2' },
    r3: { id: 'r3', propertyId: 'p2', name: 'Room 202', rent: 7000, status: 'AVAILABLE', ownerId: 'o2' },
    r4: { id: 'r4', propertyId: 'p2', name: 'Room 203', rent: 7500, status: 'AVAILABLE', ownerId: 'o2' },
    r5: { id: 'r5', propertyId: 'p3', name: 'Room 1', rent: 9000, status: 'OCCUPIED', tenantId: 't3', ownerId: 'o3' },
    r1: { id: 'r1', propertyId: 'p1', name: 'Room 101', rent: 8500, status: 'OCCUPIED', tenantId: 't1', ownerId: 'o1' } },
  tokens: { r1: core.mintRegistrationToken({ propertyId: 'p1', roomId: 'r1', tenantId: 't1', monthlyRent: 8500 }) },
  checkouts: {}, windows: {}, audit: [], conversations: {}, privateFiles: {}, devices: {}, bookings: {}, kyc: {}, notifications: [], saved: {},
  tenancies: [
    { id: 'ten1', roomId: 'r1', tenantId: 't1', startedAt: '2026-04-02T00:00:00Z' }, { id: 'ten2', roomId: 'r2', tenantId: 't2', startedAt: '2026-06-15T00:00:00Z' }, { id: 'ten3', roomId: 'r5', tenantId: 't3', startedAt: '2026-08-01T00:00:00Z' } ],
  users: [
    { id: 't1', name: 'Rahul Verma', role: 'tenant', roles: ['tenant'], phone: '9876543210', kyc: 'VERIFIED', city: 'Indore' },
    { id: 't2', name: 'Neha Sharma', role: 'tenant', roles: ['tenant'], phone: '9876432109', kyc: 'PENDING', city: 'Indore' },
    { id: 't3', name: 'Amit Patel', role: 'tenant', roles: ['tenant'], phone: '9765432109', kyc: 'PENDING', city: 'Indore' },
    { id: 'o1', name: 'Suresh Agrawal', role: 'owner', roles: ['owner'], phone: '9425011111', kyc: 'VERIFIED', city: 'Indore' },
    { id: 'o2', name: 'Mahesh Joshi', role: 'owner', roles: ['owner'], phone: '9826012345', kyc: 'PENDING', city: 'Indore' },
    { id: 'o3', name: 'Kavita Rao', role: 'owner', roles: ['owner'], phone: '9893098930', kyc: 'PENDING', city: 'Indore' },
    { id: 'admin1', name: 'Platform Admin', role: 'admin', roles: ['admin'], phone: '9000000000', kyc: 'VERIFIED', city: 'Indore' },
    { id: 'a2', name: 'Pooja Mehta', role: 'agent', roles: ['agent'], phone: '9770054321', kyc: 'VERIFIED', city: 'Indore' },
    { id: 'a1', name: 'Vikram Solanki', role: 'agent', roles: ['agent'], phone: '9770012345', kyc: 'VERIFIED', city: 'Indore' },
  ], commissions: [], qr: { r1: { code: core.qrPayload('r1'), status: 'ACTIVE', assignedAt: '2026-04-02T10:00:00Z' } },
  properties: {
    p2: { id: 'p2', registeredBy: 't2', name: 'Sai Kripa PG', locality: 'Palasia', address: '45, Palasia Square, Indore', status: 'PENDING_VERIFICATION', agentTask: 'PENDING', agent: 'a1', visit: 'Today, 4:00 PM',
      roomIds: ['r2', 'r3', 'r4'], tenantRoomId: 'r2', tenantName: 'Neha Sharma', ownerName: 'Mahesh Joshi', ownerPhone: '9826012345' },
    p3: { id: 'p3', registeredBy: 't3', name: 'Green Villa', locality: 'Bhawarkua', address: '12, Bhawarkua Main Rd, Indore', status: 'PENDING_VERIFICATION', agentTask: 'REVISIT', agent: 'a1', visit: 'Tomorrow, 11:00 AM',
      roomIds: ['r5'], tenantRoomId: 'r5', tenantName: 'Amit Patel', ownerName: 'Kavita Rao', ownerPhone: '9893098930', note: 'Owner was away — revisit' },
    p1: { id: 'p1', registeredBy: 't1', ownerConsentAt: '2026-04-05T00:00:00Z', name: 'Shree Residency', locality: 'Vijay Nagar', address: 'Scheme 78, Vijay Nagar, Indore', status: 'OCCUPIED', agentTask: 'VERIFIED', agent: 'a1', visit: 'Done',
      roomIds: ['r1'], tenantRoomId: 'r1', tenantName: 'Rahul Verma', ownerName: 'Suresh Agrawal', ownerPhone: '9425011111' },
  },
};
// Verified, marketable properties for search (coordinates are approximate area centres, for demo).
const SEED = [
  ['p4', 'Shree Ganesh PG', 'Vijay Nagar', 'PG', 22.7533, 75.8937, 'o2', [['r6', 'Room A1', 'Single', 6500, 1, 1, 'FURNISHED', ['WiFi', 'Meals', 'Laundry', 'Power backup']], ['r7', 'Room A2', 'Double sharing', 4500, 2, 1, 'FURNISHED', ['WiFi', 'Meals', 'Laundry']]]],
  ['p5', 'Palasia Heights', 'Palasia', 'Flat', 22.7240, 75.8830, 'o3', [['r8', '2BHK - 3rd floor', '2BHK', 16000, 2, 2, 'SEMI', ['Parking', 'Lift', 'Security', 'Power backup']]]],
  ['p6', 'Bhawarkua Student Stay', 'Bhawarkua', 'PG', 22.6960, 75.8700, 'o3', [['r9', 'Room 12', 'Single', 5500, 1, 1, 'FURNISHED', ['WiFi', 'Meals', 'AC']], ['r10', 'Room 14', 'Single', 5000, 1, 1, 'SEMI', ['WiFi', 'Meals']]]],
  ['p7', 'Scheme 54 Residency', 'Scheme 54', 'Flat', 22.7510, 75.8800, 'o2', [['r11', '1BHK - Ground', '1BHK', 9500, 1, 1, 'UNFURNISHED', ['Parking', 'Security']]]],
  ['p8', 'Annapurna Villa', 'Annapurna', 'House', 22.6900, 75.8400, 'o3', [['r12', 'Independent floor', '3BHK', 21000, 3, 3, 'SEMI', ['Parking', 'Garden', 'Security', 'Power backup']]]],
];
for (const [pid, name, locality, type, lat, lng, owner, rs] of SEED) {
  db.properties[pid] = { id: pid, name, locality, type, address: `${name}, ${locality}, Indore`, status: 'VERIFIED', agentTask: 'VERIFIED', agent: 'a2', visit: 'Done', roomIds: rs.map((r) => r[0]), tenantRoomId: null,
    ownerName: db.users.find((u) => u.id === owner).name, ownerPhone: db.users.find((u) => u.id === owner).phone, geo: { lat, lng, scope: 'PROPERTY' }, city: 'Indore', ownerConsentAt: '2026-09-01T00:00:00Z', photos: [] };
  for (const [rid, rname, roomType, rent, beds, baths, furnished, amenities] of rs) db.rooms[rid] = { id: rid, propertyId: pid, name: rname, roomType, rent, beds, baths, furnished, amenities, status: 'AVAILABLE', ownerId: owner };
}
const PROD = process.env.NODE_ENV === 'production';
const today = () => new Date().toISOString().slice(0, 10);
const km = (a, b) => { const R = 6371, d = (x) => (x * Math.PI) / 180, h = Math.sin(d(b.lat - a.lat) / 2) ** 2 + Math.cos(d(a.lat)) * Math.cos(d(b.lat)) * Math.sin(d(b.lng - a.lng) / 2) ** 2; return +(2 * R * Math.asin(Math.sqrt(h))).toFixed(1); };
const marketable = (r) => ['AVAILABLE', 'VACANT'].includes(r.status) && db.properties[r.propertyId]?.agentTask === 'VERIFIED' && !!db.properties[r.propertyId]?.ownerConsentAt;   // never market a room before its owner consents
const card = (r, from) => { const p = db.properties[r.propertyId]; return { roomId: r.id, propertyId: p.id, title: p.name, room: r.name, locality: p.locality, type: p.type ?? 'Room', roomType: r.roomType ?? 'Room', rent: r.rent, beds: r.beds ?? 1, baths: r.baths ?? 1,
  furnished: r.furnished ?? 'UNFURNISHED', amenities: r.amenities ?? [], photos: p.photos ?? [], verified: true, available: true, distanceKm: from && p.geo ? km(from, p.geo) : null }; };
const myTokens = (sub) => Object.values(db.tokens).filter((t) => t.tenantId === sub);
const validBookings = (sub) => Object.values(db.bookings).filter((b) => b.tenantId === sub && !['CANCELLED', 'REJECTED'].includes(b.status));
const quoteFor = (sub, room, months) => core.quoteBooking({ monthlyRent: room.rent, months,
  bookingNumber: core.bookingNumberFor({ hasRegistered: myTokens(sub).length > 0, priorValidBookings: validBookings(sub).length }),
  token: myTokens(sub).find((t) => !t.reservedBy && ['ELIGIBLE', 'DORMANT'].includes(t.state)) ?? null });
const addHist = (b, status) => { b.status = status; b.history.push({ status, at: new Date().toISOString() }); };
const releaseBooking = (b) => { const room = db.rooms[b.roomId]; if (room.status === 'BOOKED') room.status = b.prevRoomStatus ?? 'AVAILABLE'; const t = myTokens(b.tenantId).find((x) => x.reservedBy === b.id); if (t) delete t.reservedBy; };
let nSeq = 0;
const notify = (userId, type, title, body) => {
  if (!userId) return;
  db.notifications.unshift({ id: 'n' + ++nSeq, userId, type, title, body, at: new Date().toISOString(), read: false });
  pushToUser(userId, type, title, body);
};
/** Fire-and-forget: a push problem must never break the action that caused it. PUSH_HIDE_DETAILS=1 keeps names/amounts off lock screens. */
function pushToUser(userId, type, title, body) {
  const devices = Object.values(db.devices).filter((d) => d.userId === userId); if (!devices.length) return;
  const hide = process.env.PUSH_HIDE_DETAILS === '1', t = hide ? 'RentalHub' : title, b = hide ? 'You have a new update.' : body;
  for (const d of devices) Promise.resolve().then(() => pusher.send({ token: d.token, title: t, body: b, data: { type } })).then((r) => { if (r?.invalid) delete db.devices[d.id]; }).catch((e) => console.error('[push] failed:', e.message));
}
const notifyRole = (r, type, title, body) => db.users.filter((u) => u.roles.includes(r)).forEach((u) => notify(u.id, type, title, body));
const KYC_IDS = ['Aadhaar', 'PAN', 'Driving licence', 'Voter ID'];
const kycOf = (uid) => (db.kyc[uid] ??= []);
const kycStatus = (uid) => kycOf(uid).at(-1)?.status ?? db.users.find((u) => u.id === uid)?.kyc ?? 'NOT_STARTED';
const setKyc = (uid, status) => { const u = db.users.find((x) => x.id === uid); if (u) u.kyc = status; };
const stageOf = (p) => p.agentTask === 'VERIFIED' ? 'COMPLETED' : p.agentTask === 'REJECTED' ? 'FAILED' : p.agentTask === 'REVISIT' ? 'REVISIT' : p.startedAt ? 'IN_PROGRESS' : p.visitAt ? 'SCHEDULED' : p.agent ? 'ASSIGNED' : 'PENDING';
const visitLabel = (iso) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const nextNum = (obj, prefix) => Math.max(0, ...Object.keys(obj).map((k) => +k.slice(prefix.length)).filter(Number.isFinite)) + 1;
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? (process.env.SQLITE_PATH ? path.join(path.dirname(path.resolve(process.env.SQLITE_PATH)), 'uploads') : path.join(os.tmpdir(), 'rentalhub-uploads'));   // dev only — production: S3/GCS with presigned uploads
const SIGS = { jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff, png: (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])), webp: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP', mp4: (b) => b.subarray(4, 8).toString() === 'ftyp' };
const MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4' }, EXT_MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4' };
const PRIVATE_DIR = process.env.PRIVATE_DIR ?? path.join(path.dirname(UPLOAD_DIR), 'private');   // ID photos: never served publicly
const KYC_RETENTION_DAYS = Number(process.env.KYC_DOC_RETENTION_DAYS ?? 90);
const PRIVATE_REF = /^\/private\/([0-9a-f-]{36})\.(jpg|png|webp)$/;
/** Who may look at someone's ID photo: the person, any admin, and the agent assigned to a property that person registered. */
const canViewKycDoc = (role, sub, ownerId) => sub === ownerId || role === 'admin' || (role === 'agent' && Object.values(db.properties).some((p) => p.registeredBy === ownerId && p.agent === sub));
function dropPrivateFile(id) { const f = db.privateFiles[id]; if (!f) return; try { fs.unlinkSync(path.join(PRIVATE_DIR, id + '.' + f.ext)); } catch {} delete db.privateFiles[id]; }
/** Data minimisation: ID photos are deleted some days after the KYC decision, and uploads that were never used are deleted after a week. */
export function purgeKycDocs(now = new Date()) {
  let removed = 0;
  for (const [uid, hist] of Object.entries(db.kyc)) for (const rec of hist) {
    const m = rec.docRef && PRIVATE_REF.exec(rec.docRef);
    if (m && rec.reviewedAt && +now - +new Date(rec.reviewedAt) > KYC_RETENTION_DAYS * 864e5) { dropPrivateFile(m[1]); rec.docRef = null; rec.docPurgedAt = now.toISOString(); removed++; }
  }
  const used = new Set(Object.values(db.kyc).flat().map((r) => r.docRef && PRIVATE_REF.exec(r.docRef)?.[1]).filter(Boolean));
  for (const f of Object.values(db.privateFiles)) if (!used.has(f.id) && +now - +new Date(f.at) > 7 * 864e5) { dropPrivateFile(f.id); removed++; }
  return removed;
}
const REF_OK = /^\/files\/[0-9a-f-]{36}\.(jpg|png|webp)$/, VIDEO_OK = /^\/files\/[0-9a-f-]{36}\.mp4$/;
const LOG = process.env.LOG_REQUESTS === '1' || PROD;
const rateLimit = createLimiter({ max: Number(process.env.RATE_LIMIT_PER_MIN ?? 300) });   // per IP per minute, on top of the stricter OTP limits
const provider = createProvider();
const pay = createPayments();
const pusher = createPush();
let ai;   // created below, after notify() exists
/** The one place a checkout step takes effect — the app and WhatsApp both come through here. */
function advance(room, k, { verify = true } = {}) {
  const id = room.id;
  if (verify) k = core.crossVerify(k);
  if (k.state === 'VERIFIED') {
    const out = core.applyVerifiedExit(k, { room, token: db.tokens[id] });
    const leaving = out.room.tenantId;
    db.rooms[id] = out.room; if (out.token) db.tokens[id] = out.token; db.windows[id] = out.window; room = db.rooms[id];
    const stay = db.tenancies.find((x) => x.roomId === id && x.tenantId === leaving && !x.endedAt); if (stay) stay.endedAt = k.verifiedAt;
    notify(room.tenantId, 'CASHBACK', 'Cashback ready to use', 'Your checkout is verified. Your cashback token is now ready for your next booking.');
    notify(room.ownerId, 'VACANCY', `${room.name} is now vacant`, 'The 7-day placement window has started. You pay nothing unless we place a new tenant.');
    notifyRole('admin', 'VACANCY', 'Vacancy verified', `${room.name} marked vacant after dual confirmation.`);
    room.tenantId = null; room.formerTenantId = leaving;     // notifications above used the tenant id; now the room is empty
  } else if (k.state === 'DISPUTED' || k.state === 'MANUAL_REVIEW') {
    room.status = 'VERIFICATION_PENDING';
    notifyRole('admin', 'ALERT', 'Checkout needs review', `${room.name}: ${k.state.replace('_', ' ').toLowerCase()}.`);
  } else if (k.state === 'REJECTED') {
    room.status = 'OCCUPIED'; notify(room.tenantId, 'CHECKOUT', 'Checkout not approved', 'After review the checkout was not approved. Contact us if you have questions.');
  }
  db.checkouts[id] = k; ai?.settle(room, k);
  return k;
}
/** Money has arrived for a booking: hold the room and the cashback token, and tell everyone. Used by every payment path. */
async function settlePayment(b, { paymentId, method }) {
  const room = db.rooms[b.roomId], tokenNeeded = b.quote.cashback > 0, tok = tokenNeeded ? myTokens(b.tenantId).find((t) => !t.reservedBy && t.state === 'ELIGIBLE') : null;
  if (!marketable(room) || (tokenNeeded && !tok)) {             // the room was taken (or the cashback is no longer available) while the person was paying
    b.payment = { id: paymentId, method, amount: b.quote.payable, at: new Date().toISOString(), status: 'SUCCESS' }; addHist(b, 'CANCELLED');
    await startRefund(b); notify(b.tenantId, 'BOOKING', 'Booking could not be completed', 'This room was just taken, so your payment is being refunded in full.'); return { conflict: true };
  }
  b.payment = { id: paymentId, method, amount: b.quote.payable, at: new Date().toISOString(), status: 'SUCCESS' };
  b.prevRoomStatus = room.status; room.status = 'BOOKED'; if (tok) tok.reservedBy = b.id;              // hold the token until move-in
  addHist(b, 'PENDING'); notify(b.tenantId, 'BOOKING', 'Booking received', `We received your payment for ${room.name}. We'll confirm your room shortly.`); notifyRole('admin', 'BOOKING', 'New booking', `${room.name} booked — awaiting confirmation.`);
  return { conflict: false };
}
/** Refund everything that was paid (no cancellation fee exists in the plan). A gateway failure is kept and retried, never lost. */
async function startRefund(b, now = new Date()) {
  if (!b.payment || !(b.payment.amount > 0) || b.refund?.status === 'REFUNDED' || b.refund?.status === 'INITIATED') return;
  const base = { amount: b.payment.amount, at: now.toISOString(), attempts: (b.refund?.attempts ?? 0) + 1 };
  try { const r = await pay.refund({ paymentId: b.payment.id, amount: b.payment.amount * 100 }); b.refund = { ...base, status: r.status === 'processed' ? 'REFUNDED' : 'INITIATED', providerRefundId: r.id }; }
  catch (e) { console.error('[payments] refund failed:', e.message); b.refund = { ...base, status: 'RETRY' }; if (base.attempts === 1) notifyRole('admin', 'ALERT', 'Refund needs attention', `Booking ${b.id}: refund of ₹${b.payment.amount} could not be started yet. We will retry.`); }
}
export async function retryRefunds() { let n = 0; for (const b of Object.values(db.bookings)) if (b.refund?.status === 'RETRY' && b.refund.attempts < 10) { await startRefund(b); n++; } return n; }
let persist = { flush: async () => {} };            // replaced below once storage is open
const reply = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
// State-changing requests are saved to the database BEFORE the client is told they worked (and the audit entry is saved with them).
const send = (res, code, body) => {
  if (!res.__mutating) return reply(res, code, body);
  if (code < 300 && res.__audit) db.audit.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), ...res.__audit });
  persist.flush().then(() => reply(res, code, body), (e) => { console.error('[storage] save failed', e); reply(res, 500, { error: 'We could not save that. Please try again.' }); });
};
const readBody = (req, limit = 1_000_000) => new Promise((ok, fail) => {
  let d = '', n = 0;
  req.on('data', (c) => { n += c.length; if (n > limit) { fail(Object.assign(new Error('That file is too large'), { code: 413 })); req.destroy(); } else d += c; });
  req.on('end', () => { req.rawBody = d; try { ok(d ? JSON.parse(d) : {}); } catch { fail(Object.assign(new Error('Invalid request'), { code: 400 })); } });
  req.on('error', () => fail(Object.assign(new Error('Request failed'), { code: 400 })));
});
const forbid = () => { throw Object.assign(new Error('You do not have access to this'), { code: 403 }); };
const need = (role, allowed) => { if (!allowed.includes(role)) throw Object.assign(new Error('forbidden for role ' + role), { code: 403 }); };

ai = createAi({ db, provider, notify, notifyRole, advance });
// Demo data (Rahul Verma, Shree Residency, ...) exists only for development and tests. A production server starts EMPTY.
const DEMO = process.env.SEED_DEMO ? process.env.SEED_DEMO === '1' : !PROD;
if (!DEMO) for (const [coll, kind] of Object.entries(COLLECTIONS)) { if (kind === 'map') for (const k of Object.keys(db[coll])) delete db[coll][k]; else db[coll].length = 0; }
persist = await createPersistence(db);
/** First-ever start: create the first admin from BOOTSTRAP_ADMIN_PHONE (they log in with an SMS code like everyone else). */
const hasAdmin = () => db.users.some((u) => u.roles.includes('admin') && !u.disabled);
if (!hasAdmin() && process.env.BOOTSTRAP_ADMIN_PHONE && validPhone(process.env.BOOTSTRAP_ADMIN_PHONE)) {
  db.users.push({ id: 'admin1', name: process.env.BOOTSTRAP_ADMIN_NAME ?? 'Platform Admin', role: 'admin', roles: ['admin'], phone: process.env.BOOTSTRAP_ADMIN_PHONE, kyc: 'VERIFIED', city: 'Indore' });
  await persist.flush();
}             // opens storage; loads saved data, or saves the seed data on first run
nSeq = Math.max(nSeq, ...db.notifications.map((n) => +String(n.id).slice(1) || 0));
export const server = http.createServer(async (req, res) => {
  try {
    const started = Date.now(); securityHeaders(res, PROD); applyCors(req, res);
    if (LOG) res.on('finish', () => console.log(logLine({ method: req.method, url: req.url, status: res.statusCode, ms: Date.now() - started, user: res.__audit?.user })));
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const pathOnly = req.url.split('?')[0];
    if (req.method === 'GET' && pathOnly === '/health') return reply(res, 200, { ok: true, storage: persist.durable ? 'durable' : 'memory', uptimeSec: Math.round(process.uptime()) });   // for load balancers / uptime monitors
    if (!pathOnly.startsWith('/webhooks/')) {                                            // webhooks are protected by their signature instead
      const lim = rateLimit(clientIp(req)); if (!lim.ok) { res.setHeader('retry-after', String(lim.retryAfter)); return reply(res, 429, { error: 'Too many requests. Please slow down.' }); }
    }
    const [, a, id, action, action2] = new URL(req.url, 'http://x').pathname.split('/');
    if (req.method === 'POST') res.__mutating = true;
    const body = req.method === 'POST' ? await readBody(req, a === 'uploads' ? 40_000_000 : 1_000_000) : {};

    // ---------- Auth (public) ----------
    if (req.method === 'POST' && a === 'auth') {
      if (id === 'otp') {
        const ip = clientIp(req);
        return send(res, ...(await requestOtp(body.phone, Date.now(), { ip }).then(({ status, ...r }) => [status, r])));
      }
      if (id === 'verify') {
        const chk = checkOtp(body.phone, body.code);
        if (!chk.ok) return send(res, chk.status, { error: chk.error });
        // new phone => new account (tenant or owner). agent/admin accounts are provisioned by the platform, never self-assigned.
        let u = db.users.find((x) => x.phone === body.phone);
        if (!u) { u = { id: 'u' + (db.users.length + 1), name: 'New user', role: 'tenant', roles: ['tenant', 'owner'], phone: body.phone, kyc: 'NOT_STARTED', city: 'Indore' }; db.users.push(u); }
        const pick = body.role && u.roles.includes(body.role) ? body.role : u.roles[0];
        return send(res, 200, { token: signToken({ sub: u.id, role: pick }), user: { id: u.id, name: u.name, phone: u.phone, role: pick, roles: u.roles } });
      }
    }
    if (a === 'webhooks' && id === 'razorpay' && req.method === 'POST') {            // the gateway tells us what really happened with the money
      if (!pay.verifyWebhook(req.rawBody ?? '', req.headers['x-razorpay-signature'])) return send(res, 401, { error: 'bad signature' });
      const ev = body.event, pe = body.payload?.payment?.entity, re = body.payload?.refund?.entity;
      if (ev === 'payment.captured' && pe) {
        const b = Object.values(db.bookings).find((x) => x.order?.id === pe.order_id);
        if (b && b.order.amount === pe.amount && !b.payment) {                      // paid, but the app never confirmed (crash, lost signal): finish it ourselves
          if (b.status === 'REQUESTED') { b.order.status = 'PAID'; await settlePayment(b, { paymentId: pe.id, method: pe.method ?? 'ONLINE' }); }
          else { b.payment = { id: pe.id, method: pe.method ?? 'ONLINE', amount: pe.amount / 100, at: new Date().toISOString(), status: 'SUCCESS' }; await startRefund(b); }   // booking already closed: give the money back
        }
      } else if (ev === 'payment.failed' && pe) { const b = Object.values(db.bookings).find((x) => x.order?.id === pe.order_id); if (b && b.order.status === 'CREATED') b.order.status = 'FAILED'; }
      else if (ev === 'refund.processed' && re) { const b = Object.values(db.bookings).find((x) => x.refund?.providerRefundId === re.id); if (b) b.refund.status = 'REFUNDED'; }
      return send(res, 200, { ok: true });
    }
    if (a === 'webhooks' && id === 'whatsapp') {              // WhatsApp Cloud API: verification handshake + inbound replies
      if (req.method === 'GET') { const q = new URL(req.url, 'http://x').searchParams; const ok = q.get('hub.mode') === 'subscribe' && process.env.WHATSAPP_VERIFY_TOKEN && q.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN;
        if (!ok) return send(res, 403, { error: 'forbidden' }); res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(String(q.get('hub.challenge'))); }
      if (req.method === 'POST') {
        const secret = process.env.WHATSAPP_APP_SECRET;
        if (!secret && PROD) return send(res, 503, { error: 'webhook not configured' });
        if (secret && !verifySignature(req.rawBody ?? '', req.headers['x-hub-signature-256'], secret)) return send(res, 401, { error: 'bad signature' });   // only Meta can post here
        const results = extractInbound(body).map((m) => ai.handleInbound(m)); return send(res, 200, { ok: true, handled: results.length });
      }
    }
    if (req.method === 'GET' && a === 'files') {            // unguessable ids; photos must be visible to tenants browsing listings
      if (!/^[0-9a-f-]{36}\.(jpg|png|webp|mp4)$/.test(id ?? '')) return send(res, 404, { error: 'not found' });
      const file = path.join(UPLOAD_DIR, id); if (!fs.existsSync(file)) return send(res, 404, { error: 'not found' });
      res.writeHead(200, { 'content-type': EXT_MIME[id.split('.')[1]], 'x-content-type-options': 'nosniff', 'cache-control': 'public, max-age=86400' }); return res.end(fs.readFileSync(file));
    }
    const auth = verifyToken(req.headers.authorization);
    if (!auth) return send(res, 401, { error: 'Please log in again' });
    const { role, sub } = auth;
    { const acct = db.users.find((u) => u.id === sub); if (!acct || acct.disabled || !acct.roles.includes(role)) return send(res, 401, { error: 'Please log in again' }); }   // deactivated or changed accounts lose access immediately
    if (req.method === 'POST' && a === 'auth' && id === 'switch') { // choose role after login — only among the account's own roles
      const u = db.users.find((x) => x.id === sub);
      if (!u?.roles.includes(body.role)) return send(res, 403, { error: 'That role is not available for your account' });
      return send(res, 200, { token: signToken({ sub, role: body.role }), user: { id: u.id, name: u.name, phone: u.phone, role: body.role, roles: u.roles } });
    }
    res.__audit = { role, user: sub, action: req.url };   // written by send() together with the change itself
    if (req.method === 'GET' && a === 'rooms' && id) {
      const room = db.rooms[id]; if (!room) return send(res, 404, { error: 'not found' });
      if (role === 'tenant' && room.tenantId !== sub) forbid();
      if (role === 'owner' && room.ownerId !== sub) forbid();
      if (role === 'agent' && db.properties[room.propertyId].agent !== sub) forbid();
      const t = db.tokens[id];
      return send(res, 200, { room, token: t && (role === 'admin' ? t : core.toTenantView(t)),
        vacancy: db.windows[id] && core.windowStatus(db.windows[id]) });
    }
    if (req.method === 'POST' && a === 'checkout' && id) {
      const room = db.rooms[id]; if (!room) return send(res, 404, { error: 'not found' });
      if (role === 'tenant' && room.tenantId !== sub) forbid();   // only the room's own tenant/owner can act on its checkout
      if (role === 'owner' && room.ownerId !== sub) forbid();
      let k = db.checkouts[id];
      if (action === 'start') { need(role, ['tenant']);
        if (room.status !== 'OCCUPIED') return send(res, 409, { error: 'Checkout is only available for a room you currently live in' });
        if (!db.qr[id]) return send(res, 409, { error: 'Your room tag is not ready yet. Our agent will add it when they verify the property.' }); k = core.initiateCheckout({ roomId: id, tenantId: room.tenantId, ownerId: room.ownerId }); room.status = 'CHECKOUT_REQUESTED'; }
      else if (action === 'scan') { need(role, ['tenant']); k = core.scanQr(k, { scannedRoomId: body.qr }); }
      else if (action === 'tenant-confirm') { need(role, ['tenant']); k = core.tenantConfirm(k, body); }
      else if (action === 'owner-respond') { need(role, ['owner']); k = core.ownerRespond(k, body); }
      else if (action === 'resolve') {                       // a person at RentalHub decides a disputed / unanswered checkout
        need(role, ['admin']); if (!k) return send(res, 404, { error: 'no checkout in progress' });
        if (typeof body.approve !== 'boolean') return send(res, 422, { error: 'Say whether to approve or reject' }); if (!body.approve && !String(body.note ?? '').trim()) return send(res, 422, { error: 'Please add a reason' });
        k = advance(room, core.adminResolve(k, { approve: body.approve, note: String(body.note ?? '').slice(0, 300) }), { verify: false });
        return send(res, 200, { checkout: k, roomStatus: db.rooms[id].status });
      }
      else return send(res, 404, { error: 'unknown action' });
      if (action === 'scan') ai.onScan(room);
      if (action === 'tenant-confirm') { notify(room.ownerId, 'CHECKOUT', 'Checkout request', `${room.name}: your tenant says they are moving out. Please confirm or tell us if it's wrong.`); db.checkouts[id] = k; ai.onTenantConfirmed(room, k); }
      if (action === 'owner-respond') ai.onOwnerAnsweredInApp(room);
      k = advance(room, k);
      return send(res, 200, { checkout: k, roomStatus: db.rooms[id].status });
    }
    if (req.method === 'POST' && a === 'placement' && id === 'place') { // /placement/place {roomId, placedAt}
      need(role, ['admin']);
      const room = db.rooms[body.roomId], win = db.windows[body.roomId];
      if (!win) return send(res, 409, { error: 'room has no verified vacancy' });
      const out = core.commissionOutcome({ monthlyRent: room.rent, window: win, placedAt: body.placedAt ?? new Date() });
      // waivedValue = what the platform chose NOT to charge (display only; never paid out to owner)
      db.commissions.push({ id: 'c' + (db.commissions.length + 1), roomId: room.id, room: room.name, ownerId: room.ownerId, days: +((Date.now() - +new Date(win.startedAt)) / 864e5).toFixed(1), status: out.status, amount: out.amount, waivedValue: out.status === 'WAIVED' ? Math.round(room.rent * core.COMMISSION_RATE) : 0, at: new Date().toISOString() });
      return send(res, 200, out);
    }
    if (req.method === 'GET' && a === 'checkout' && id) {
      const rm = db.rooms[id]; if (!rm) return send(res, 404, { error: 'not found' });
      if ((role === 'tenant' && rm.tenantId !== sub) || (role === 'owner' && rm.ownerId !== sub) || role === 'agent') forbid();
      if (!db.checkouts[id]) return send(res, 404, { error: 'no checkout in progress' });
      return send(res, 200, { checkout: db.checkouts[id] });
    }
    if (req.method === 'POST' && a === 'commission' && id === 'pay') { // owner pays a DUE commission
      need(role, ['owner']);
      const c = db.commissions.find((x) => x.id === body.id);
      if (!c || c.ownerId !== sub || c.status !== 'DUE') return send(res, 409, { error: 'nothing due' });
      c.status = 'PAID'; c.paidAt = new Date().toISOString(); // TODO: payment gateway
      notifyRole('admin', 'PAYMENT', 'Commission paid', `${c.room}: ₹${c.amount} received.`);
      return send(res, 200, c);
    }
    if (req.method === 'GET' && a === 'owner' && id === 'dashboard') {
      need(role, ['owner']);
      const OWNER = sub; // owners only ever see their own rooms
      const rooms = Object.values(db.rooms).filter((r) => r.ownerId === OWNER).map((r) => {
        const w = db.windows[r.id], k = db.checkouts[r.id];
        return { id: r.id, name: r.name, rent: r.rent, status: r.status, vacancy: w && core.windowStatus(w),
          awaitingOwner: !!(k && k.tenant && !k.owner), tenantCheckoutDate: k?.tenant?.checkoutDate ?? null };
      });
      const mine = db.commissions.filter((c) => c.ownerId === OWNER);
      const sum = (st, f) => mine.filter((c) => c.status === st).reduce((a, c) => a + c[f], 0);
      const potential = rooms.filter((r) => r.vacancy?.phase === 'ACTIVE').reduce((a, r) => a + Math.round(r.rent * core.COMMISSION_RATE), 0);
      return send(res, 200, {
        spine: { properties: 1, rooms: rooms.length, occupied: rooms.filter((r) => r.status === 'OCCUPIED').length,
          vacant: rooms.filter((r) => r.status === 'VACANT').length, inPlacement: rooms.filter((r) => r.vacancy?.phase === 'ACTIVE').length },
        commission: { potential, due: sum('DUE', 'amount'), paid: sum('PAID', 'amount'), waived: sum('WAIVED', 'waivedValue') },
        rooms, ledger: mine,
      });
    }
    // ---------- Uploads (dev-grade local storage) ----------
    if (req.method === 'POST' && a === 'uploads' && body.purpose === 'kyc') {          // ID photo: private, owner-only, images only
      const ext = MIME[body.contentType]; if (!ext || ext === 'mp4') return send(res, 415, { error: 'Please upload a JPG, PNG or WebP photo of your ID' });
      const buf = Buffer.from(String(body.data ?? ''), 'base64'); if (!buf.length) return send(res, 422, { error: 'Empty file' }); if (buf.length > 5e6) return send(res, 413, { error: 'Photo must be under 5 MB' });
      if (!SIGS[ext](buf)) return send(res, 415, { error: 'This file does not look like a real photo' });
      if (Object.values(db.privateFiles).filter((f) => f.ownerId === sub).length >= 6) return send(res, 429, { error: 'Too many ID photos. Submit your KYC or try again later.' });
      fs.mkdirSync(PRIVATE_DIR, { recursive: true }); const fid = crypto.randomUUID(); fs.writeFileSync(path.join(PRIVATE_DIR, fid + '.' + ext), buf, { mode: 0o600 });
      db.privateFiles[fid] = { id: fid, ownerId: sub, kind: 'kyc', ext, at: new Date().toISOString() };
      return send(res, 200, { ref: `/private/${fid}.${ext}`, bytes: buf.length });
    }
    if (req.method === 'GET' && a === 'private') {                                         // authenticated download; every request is access-checked
      const m = /^([0-9a-f-]{36})\.(jpg|png|webp)$/.exec(id ?? ''), meta = m && db.privateFiles[m[1]];
      if (!meta || meta.ext !== m[2]) return send(res, 404, { error: 'not found' }); if (!canViewKycDoc(role, sub, meta.ownerId)) forbid();
      const file = path.join(PRIVATE_DIR, id); if (!fs.existsSync(file)) return send(res, 404, { error: 'not found' });
      res.writeHead(200, { 'content-type': EXT_MIME[m[2]], 'x-content-type-options': 'nosniff', 'cache-control': 'private, no-store', 'content-disposition': 'inline' }); return res.end(fs.readFileSync(file));
    }
    if (req.method === 'POST' && a === 'uploads') {
      const ext = MIME[body.contentType]; if (!ext) return send(res, 415, { error: 'Only JPG, PNG, WebP photos and MP4 videos are allowed' });
      const buf = Buffer.from(String(body.data ?? ''), 'base64'); const max = ext === 'mp4' ? 25e6 : 5e6;
      if (!buf.length) return send(res, 422, { error: 'Empty file' }); if (buf.length > max) return send(res, 413, { error: ext === 'mp4' ? 'Video must be under 25 MB' : 'Photo must be under 5 MB' });
      if (!SIGS[ext](buf)) return send(res, 415, { error: 'This file does not look like a real ' + (ext === 'mp4' ? 'video' : 'photo') });   // content check, not just the label
      fs.mkdirSync(UPLOAD_DIR, { recursive: true }); const fid = crypto.randomUUID() + '.' + ext; fs.writeFileSync(path.join(UPLOAD_DIR, fid), buf);
      return send(res, 200, { ref: '/files/' + fid, bytes: buf.length });
    }
    // ---------- Tenant: register property ----------
    if (a === 'properties' && req.method === 'POST' && !id) {
      need(role, ['tenant']); const m = db.users.find((u) => u.id === sub);
      const str = (v, lo, hi) => { const x = String(v ?? '').trim(); return x.length >= lo && x.length <= hi ? x : null; };
      const name = str(body.name, 2, 80), address = str(body.address, 10, 200), locality = str(body.locality, 2, 60), roomName = str(body.roomName, 1, 40), ownerName = str(body.ownerName, 2, 60);
      const rent = +body.rent, total = +body.totalRooms, photos = body.photos ?? [];
      if (!name) return send(res, 422, { error: 'Enter the property name' }); if (!['PG', 'Flat', 'House', 'Room'].includes(body.type)) return send(res, 422, { error: 'Choose a property type' });
      if (!address) return send(res, 422, { error: 'Enter the full address (at least 10 characters)' }); if (!locality) return send(res, 422, { error: 'Enter the locality' });
      if (!roomName) return send(res, 422, { error: 'Enter your room name or number' }); if (!Number.isInteger(rent) || rent < 500 || rent > 500000) return send(res, 422, { error: 'Enter monthly rent between ₹500 and ₹5,00,000' });
      if (!Number.isInteger(total) || total < 1 || total > 50) return send(res, 422, { error: 'Total rooms must be between 1 and 50' });
      if (!ownerName) return send(res, 422, { error: 'Enter the owner’s name' }); if (!validPhone(body.ownerPhone)) return send(res, 422, { error: 'Enter the owner’s 10-digit mobile number' });
      if (body.ownerPhone === m.phone) return send(res, 422, { error: 'The owner’s number must be different from yours' });
      if (body.agentVisit !== true) return send(res, 422, { error: 'An agent visit is needed to verify your property' });
      if (!Array.isArray(photos) || photos.length < 3 || photos.length > 12 || !photos.every((x) => REF_OK.test(x) && fs.existsSync(path.join(UPLOAD_DIR, x.slice(7))))) return send(res, 422, { error: 'Add 3 to 12 photos' });
      if (body.video && !(VIDEO_OK.test(body.video) && fs.existsSync(path.join(UPLOAD_DIR, body.video.slice(7))))) return send(res, 422, { error: 'That video is not valid' });
      if (Object.values(db.properties).some((p) => p.registeredBy === sub && p.address.toLowerCase() === address.toLowerCase() && p.agentTask !== 'REJECTED')) return send(res, 409, { error: 'You have already registered this property' });
      // least-loaded agent gets the visit (admin can reassign later)
      const agents = db.users.filter((u) => u.roles.includes('agent')); const load = (aid) => Object.values(db.properties).filter((p) => p.agent === aid && ['PENDING', 'REVISIT'].includes(p.agentTask)).length;
      const agent = agents.sort((x, y) => load(x.id) - load(y.id))[0];
      const pid = 'p' + nextNum(db.properties, 'p'); let rn = nextNum(db.rooms, 'r'); const roomIds = [];
      db.rooms['r' + rn] = { id: 'r' + rn, propertyId: pid, name: roomName, rent, status: 'OCCUPIED', tenantId: sub, ownerId: null, amenities: body.amenities ?? [], roomType: body.roomType ?? 'Room' }; roomIds.push('r' + rn++);
      for (let i = 2; i <= total; i++) { db.rooms['r' + rn] = { id: 'r' + rn, propertyId: pid, name: `Room ${i}`, rent, status: 'VERIFICATION_PENDING', ownerId: null }; roomIds.push('r' + rn++); }   // agent confirms other rooms during the visit
      db.properties[pid] = { id: pid, name, type: body.type, address, locality, city: 'Indore', status: 'PENDING_VERIFICATION', agentTask: 'PENDING', agent: agent?.id ?? null, visit: 'To be scheduled', visitAt: null, startedAt: null,
        roomIds, tenantRoomId: roomIds[0], tenantName: m.name, registeredBy: sub, ownerName, ownerPhone: body.ownerPhone, ownerConsentAt: null, amenities: body.amenities ?? [], photos, video: body.video ?? null, notes: String(body.notes ?? '').slice(0, 500), createdAt: new Date().toISOString() };
      db.tenancies.push({ id: crypto.randomUUID(), roomId: roomIds[0], tenantId: sub, startedAt: body.movedInOn && !isNaN(+new Date(body.movedInOn)) ? new Date(body.movedInOn).toISOString() : new Date().toISOString() });
      notify(sub, 'VERIFICATION', 'Property submitted', 'Thanks! An agent will visit soon to verify it. Your 30% cashback token is added once verification is done.');
      notify(agent?.id, 'VERIFICATION', 'New verification task', `${name}, ${locality} — please schedule a visit.`); notifyRole('admin', 'VERIFICATION', 'New property registered', `${name}, ${locality} by ${m.name}.`);
      return send(res, 200, { property: { id: pid, stage: stageOf(db.properties[pid]) } });
    }
    if (a === 'properties' && req.method === 'GET' && id === 'mine') {
      need(role, ['tenant']);
      return send(res, 200, { rows: Object.values(db.properties).filter((p) => p.registeredBy === sub).map((p) => { const rid = p.tenantRoomId, tok = db.tokens[rid];
        return { id: p.id, name: p.name, locality: p.locality, status: p.status, stage: stageOf(p), visit: p.visit, visitAt: p.visitAt ?? null, agent: p.agent ? db.users.find((u) => u.id === p.agent)?.name.split(' ')[0] : null, rooms: p.roomIds.length,
          reason: p.note ?? null, kyc: kycStatus(sub), ownerConsent: !!p.ownerConsentAt, token: tok ? core.toTenantView(tok) : null, expectedToken: Math.round(db.rooms[rid].rent * 0.3), photos: p.photos ?? [] }; }) });
    }
    // ---------- Tenant home ----------
    if (req.method === 'GET' && a === 'home') {
      need(role, ['tenant']);
      const cur = Object.values(db.rooms).find((r) => r.tenantId === sub && ['OCCUPIED', 'CHECKOUT_REQUESTED', 'VERIFICATION_PENDING'].includes(r.status) && db.properties[r.propertyId]);
      const ts = myTokens(sub), bk = Object.values(db.bookings).filter((b) => b.tenantId === sub && ['REQUESTED', 'PENDING', 'CONFIRMED'].includes(b.status)).at(-1);
      return send(res, 200, { name: db.users.find((u) => u.id === sub)?.name ?? '',
        current: cur ? { roomId: cur.id, room: cur.name, property: db.properties[cur.propertyId].name, locality: db.properties[cur.propertyId].locality, rent: cur.rent, status: cur.status, tagReady: !!db.qr[cur.id], checkout: db.checkouts[cur.id]?.state ?? null } : null,
        registered: Object.values(db.properties).filter((p) => p.registeredBy === sub).map((p) => ({ id: p.id, name: p.name, stage: stageOf(p) })),
        booking: bk ? { id: bk.id, status: bk.status, room: db.rooms[bk.roomId].name } : null,
        wallet: { available: ts.filter((t) => t.state === 'ELIGIBLE' && !t.reservedBy).reduce((x, t) => x + t.amount, 0), saved: ts.filter((t) => t.state === 'DORMANT').reduce((x, t) => x + t.amount, 0) },
        unread: db.notifications.filter((n) => n.userId === sub && !n.read).length });
    }
    // ---------- Owner consent (owner is approached AFTER the tenant registers) ----------
    if (a === 'owner' && id === 'consents' && req.method === 'GET') {
      need(role, ['owner']); const m = db.users.find((u) => u.id === sub);
      return send(res, 200, { rows: Object.values(db.properties).filter((p) => p.ownerPhone === m.phone && !p.ownerConsentAt && !p.ownerDeclinedAt).map((p) => ({ id: p.id, name: p.name, locality: p.locality, address: p.address, rooms: p.roomIds.length, tenantFirstName: String(p.tenantName).split(' ')[0] })) });
    }
    if (a === 'owner' && id === 'consent' && req.method === 'POST') {
      need(role, ['owner']); const m = db.users.find((u) => u.id === sub), p = db.properties[action];
      if (!p || p.ownerPhone !== m.phone) forbid(); if (p.ownerConsentAt || p.ownerDeclinedAt) return send(res, 409, { error: 'You have already responded' });
      if (body.accept === true) {
        p.ownerConsentAt = new Date().toISOString(); p.ownerId = sub; for (const rid of p.roomIds) db.rooms[rid].ownerId = sub;         // rooms now appear on the owner's dashboard
        notify(db.rooms[p.tenantRoomId].tenantId, 'VERIFICATION', 'Your owner agreed', `${m.name.split(' ')[0]} agreed to list ${p.name}.`); notifyRole('admin', 'VERIFICATION', 'Owner consent received', `${p.name}: activated.`);
      } else { p.ownerDeclinedAt = new Date().toISOString(); notifyRole('admin', 'ALERT', 'Owner declined', `${p.name}: owner declined to list.`); }
      return send(res, 200, { ok: true, accepted: body.accept === true });
    }
    // ---------- Owner: properties, rooms, placements ----------
    if (a === 'owner' && req.method === 'GET' && ['properties', 'rooms', 'placements'].includes(id)) {
      need(role, ['owner']);
      const mine = Object.values(db.rooms).filter((r) => r.ownerId === sub), fn = (uid) => String(db.users.find((u) => u.id === uid)?.name ?? '').split(' ')[0];
      const roomView = (r) => {
        const w = db.windows[r.id], t = r.tenantId ? db.users.find((u) => u.id === r.tenantId) : null, since = r.tenantId ? db.tenancies.find((x) => x.roomId === r.id && x.tenantId === r.tenantId && !x.endedAt)?.startedAt ?? null : null;
        const incoming = Object.values(db.bookings).find((b) => b.roomId === r.id && ['PENDING', 'CONFIRMED'].includes(b.status));
        return { id: r.id, name: r.name, rent: r.rent, status: r.status, vacancy: w ? core.windowStatus(w) : null,
          tenant: t ? { name: t.name, phone: t.phone, since, kyc: kycStatus(t.id) } : null,                        // the owner's own current tenant: name + phone
          incoming: incoming ? { status: incoming.status, tenantFirstName: fn(incoming.tenantId), moveInDate: incoming.moveInDate } : null,   // a prospective tenant: first name only
          tag: db.qr[r.id] ? { code: db.qr[r.id].code, status: db.qr[r.id].status } : null };
      };
      if (id === 'properties' && !action) {
        const ids = [...new Set(mine.map((r) => r.propertyId))];
        return send(res, 200, { rows: ids.map((pid) => { const p = db.properties[pid], rs = mine.filter((r) => r.propertyId === pid);
          return { id: p.id, name: p.name, locality: p.locality, type: p.type ?? null, status: p.status, verified: p.agentTask === 'VERIFIED', rooms: rs.length, occupied: rs.filter((r) => r.status === 'OCCUPIED').length, vacant: rs.filter((r) => ['VACANT', 'PLACEMENT_IN_PROGRESS'].includes(r.status) || db.windows[r.id]).length }; }) });
      }
      if (id === 'properties' && action) {
        const p = db.properties[action]; if (!p || !mine.some((r) => r.propertyId === p.id)) forbid();
        return send(res, 200, { property: { id: p.id, name: p.name, address: p.address, locality: p.locality, status: p.status, verified: p.agentTask === 'VERIFIED', verifiedAt: p.verifiedAt ?? null, geoTagged: !!p.geo, agreedAt: p.ownerConsentAt ?? null }, rooms: mine.filter((r) => r.propertyId === p.id).map(roomView) });
      }
      if (id === 'rooms') {
        const r = db.rooms[action]; if (!r || r.ownerId !== sub) forbid();
        const stays = db.tenancies.filter((x) => x.roomId === r.id).map((x) => ({ tenantFirstName: fn(x.tenantId), startedAt: x.startedAt, endedAt: x.endedAt ?? null })).reverse();
        const placements = db.commissions.filter((c) => c.roomId === r.id).map((c) => ({ id: c.id, status: c.status, amount: c.amount, waivedValue: c.waivedValue, days: c.days ?? null, at: c.at })).reverse();
        return send(res, 200, { room: roomView(r), stays, placements, checkout: db.checkouts[r.id] ? { state: db.checkouts[r.id].state } : null });
      }
      if (id === 'placements') {
        const inProgress = mine.filter((r) => db.windows[r.id]).map(roomView).map((v) => ({ roomId: v.id, room: v.name, property: db.properties[db.rooms[v.id].propertyId].name, rent: v.rent, vacancy: v.vacancy, potentialCommission: Math.round(v.rent * core.COMMISSION_RATE), incoming: v.incoming }));
        const history = db.commissions.filter((c) => c.ownerId === sub).map((c) => ({ id: c.id, room: c.room, property: db.properties[db.rooms[c.roomId].propertyId].name, newTenantFirstName: c.newTenantId ? fn(c.newTenantId) : null, days: c.days ?? null, status: c.status, amount: c.amount, waivedValue: c.waivedValue, at: c.at })).reverse();
        return send(res, 200, { inProgress, history });
      }
    }
    // ---------- Phones that receive push notifications ----------
    if (a === 'devices' && req.method === 'POST') {
      const token = String(body.token ?? ''); if (token.length < 20 || token.length > 4096) return send(res, 422, { error: 'Invalid device token' });
      const id2 = crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
      if (id === 'remove') { if (db.devices[id2]?.userId === sub) delete db.devices[id2]; return send(res, 200, { ok: true }); }
      if (!['android', 'ios'].includes(body.platform)) return send(res, 422, { error: 'Invalid platform' });
      db.devices[id2] = { id: id2, userId: sub, token, platform: body.platform, at: new Date().toISOString() };      // a phone belongs to whoever logged in last (shared phones)
      const mine = Object.values(db.devices).filter((d) => d.userId === sub).sort((x, y) => y.at.localeCompare(x.at)); for (const old of mine.slice(5)) delete db.devices[old.id];   // at most 5 phones per person
      return send(res, 200, { ok: true });
    }
    // ---------- Staff (admin / agent accounts are provisioned here, never self-registered) ----------
    if (a === 'staff') {
      need(role, ['admin']);
      const staffRow = (u) => ({ id: u.id, name: u.name, phone: u.phone, roles: u.roles.filter((r) => ['admin', 'agent'].includes(r)).join(', '), status: u.disabled ? 'DISABLED' : 'ACTIVE',
        openTasks: Object.values(db.properties).filter((p) => p.agent === u.id && ['PENDING', 'REVISIT'].includes(p.agentTask)).length });
      if (req.method === 'GET' && !id) return send(res, 200, { rows: db.users.filter((u) => u.roles.some((r) => ['admin', 'agent'].includes(r))).map(staffRow) });
      if (req.method === 'POST' && !id) {
        const name = String(body.name ?? '').trim(); if (name.length < 2 || name.length > 60) return send(res, 422, { error: 'Enter the person’s name' });
        if (!validPhone(body.phone)) return send(res, 422, { error: 'Enter a valid 10-digit mobile number' }); if (!['agent', 'admin'].includes(body.role)) return send(res, 422, { error: 'Choose agent or admin' });
        let u = db.users.find((x) => x.phone === body.phone);
        if (u) { if (u.roles.includes(body.role)) return send(res, 409, { error: 'This person already has that role' }); u.roles.push(body.role); u.disabled = false; }    // an existing user (e.g. a tenant) gains the staff role and can switch to it after login
        else { u = { id: 'u' + nextNum(Object.fromEntries(db.users.map((x) => [x.id, 1])), 'u'), name, role: body.role, roles: [body.role], phone: body.phone, kyc: 'NOT_STARTED', city: 'Indore' }; db.users.push(u); }
        return send(res, 200, { staff: staffRow(u) });
      }
      const u = db.users.find((x) => x.id === id); if (!u) return send(res, 404, { error: 'not found' });
      if (req.method === 'POST' && action === 'deactivate') {
        if (u.id === sub) return send(res, 409, { error: 'You cannot deactivate your own account' });
        if (u.roles.includes('admin') && db.users.filter((x) => x.roles.includes('admin') && !x.disabled && x.id !== u.id).length === 0) return send(res, 409, { error: 'There must always be at least one active admin' });
        const open = staffRow(u).openTasks; if (open) return send(res, 409, { error: `Reassign their ${open} open ${open === 1 ? 'property' : 'properties'} first` });
        u.disabled = true; return send(res, 200, { staff: staffRow(u) });
      }
      if (req.method === 'POST' && action === 'reactivate') { u.disabled = false; return send(res, 200, { staff: staffRow(u) }); }
    }
    // ---------- Profile, KYC, history, saved, notifications ----------
    const me = db.users.find((u) => u.id === sub);
    if (a === 'profile') {
      if (req.method === 'GET') return send(res, 200, { user: { id: me.id, name: me.name, phone: me.phone, role, roles: me.roles, city: me.city, email: me.email ?? '' }, kyc: kycStatus(sub), unread: db.notifications.filter((n) => n.userId === sub && !n.read).length });
      if (req.method === 'POST') {
        const name = String(body.name ?? '').trim(); if (name.length < 2 || name.length > 60) return send(res, 422, { error: 'Enter your name (2–60 letters)' });
        if (body.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) return send(res, 422, { error: 'Enter a valid email' });
        me.name = name; me.email = body.email ?? me.email ?? ''; return send(res, 200, { user: { id: me.id, name: me.name, phone: me.phone, email: me.email } });
      }
    }
    if (a === 'kyc') {
      if (req.method === 'GET' && !id) return send(res, 200, { state: kycStatus(sub), history: kycOf(sub).map(({ id: _i, ...h }) => h) });
      if (req.method === 'POST' && id === 'submit') {
        const st = kycStatus(sub), waiting = kycOf(sub).at(-1)?.status === 'PENDING';   // seed 'PENDING' with no record must not block a first submission
        if (st === 'VERIFIED' || waiting) return send(res, 409, { error: st === 'VERIFIED' ? 'Your KYC is already verified' : 'Your KYC is already being checked' });
        if (!KYC_IDS.includes(body.idType)) return send(res, 422, { error: 'Choose an ID type' });
        const fullName = String(body.fullName ?? '').trim(); if (fullName.length < 2) return send(res, 422, { error: 'Enter your full name as on the ID' });
        const dob = String(body.dob ?? ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || isNaN(+new Date(dob))) return send(res, 422, { error: 'Enter date of birth as YYYY-MM-DD' });
        if ((Date.now() - +new Date(dob)) / (365.25 * 864e5) < 18) return send(res, 422, { error: 'You must be 18 or older' });
        const dm = PRIVATE_REF.exec(String(body.docRef ?? '')); if (!dm) return send(res, 422, { error: 'Upload a clear photo of your ID' });
        const meta = db.privateFiles[dm[1]]; if (!meta || meta.ownerId !== sub || meta.kind !== 'kyc' || !fs.existsSync(path.join(PRIVATE_DIR, `${dm[1]}.${dm[2]}`))) return send(res, 422, { error: 'Upload a clear photo of your ID' });
        if (Object.values(db.kyc).flat().some((r) => r.docRef === body.docRef)) return send(res, 409, { error: 'This photo was already used. Please upload it again.' });
        // Only the ID TYPE and a private photo reference are stored — never the ID number.
        kycOf(sub).push({ idType: body.idType, fullName, dob, docRef: body.docRef ?? null, status: 'PENDING', at: new Date().toISOString() }); setKyc(sub, 'PENDING');
        notifyRole('admin', 'KYC', 'New KYC to review', `${me.name} submitted ${body.idType}.`); return send(res, 200, { state: 'PENDING' });
      }
      if (req.method === 'POST' && id && (action === 'verify' || action === 'reject')) {
        need(role, ['admin', 'agent']); const rec = kycOf(id).at(-1); if (!rec || rec.status !== 'PENDING') return send(res, 409, { error: 'No KYC waiting for review' });
        if (action === 'reject' && !body.reason?.trim()) return send(res, 422, { error: 'Please add a reason' });
        rec.status = action === 'verify' ? 'VERIFIED' : 'REJECTED'; rec.reviewedBy = sub; rec.reviewedAt = new Date().toISOString(); if (action === 'reject') rec.reason = body.reason; setKyc(id, rec.status);
        notify(id, 'KYC', action === 'verify' ? 'KYC verified' : 'KYC needs another look', action === 'verify' ? 'Your identity is verified.' : `Please upload your ID again: ${body.reason}`);
        return send(res, 200, { state: rec.status });
      }
    }
    if (req.method === 'GET' && a === 'history') {
      need(role, ['tenant']);
      const stays = db.tenancies.filter((x) => x.tenantId === sub).map((x) => { const r = db.rooms[x.roomId], p = db.properties[r.propertyId]; return { property: p.name, room: r.name, locality: p.locality, city: 'Indore', startedAt: x.startedAt, endedAt: x.endedAt ?? null, current: !x.endedAt && r.tenantId === sub }; });
      const disputes = Object.values(db.checkouts).filter((k) => k.tenantId === sub && ['DISPUTED', 'MANUAL_REVIEW'].includes(k.state)).length;
      const pays = Object.values(db.bookings).filter((b) => b.tenantId === sub && b.payment).map((b) => ({ id: b.payment.id, room: db.rooms[b.roomId].name, amount: b.payment.amount, at: b.payment.at, method: b.payment.method, refunded: b.refund?.amount ?? 0 }));
      return send(res, 200, { stays, payments: pays, trust: { kyc: kycStatus(sub), completedStays: stays.filter((x) => !x.current).length, totalStays: stays.length, disputes, noDispute: disputes === 0, memberSince: stays.map((x) => x.startedAt).sort()[0] ?? null, cities: [...new Set(stays.map((x) => x.city))] } });
    }
    if (a === 'saved') {
      need(role, ['tenant']); const list = (db.saved[sub] ??= []);
      if (req.method === 'POST' && id) { if (!db.rooms[id]) return send(res, 404, { error: 'not found' }); const i = list.indexOf(id); if (i >= 0) list.splice(i, 1); else list.push(id); return send(res, 200, { saved: i < 0 }); }
      if (req.method === 'GET') return send(res, 200, { ids: list, rows: list.map((rid) => db.rooms[rid]).filter(Boolean).map((r) => ({ ...card(r, null), available: marketable(r) })) });
    }
    if (a === 'notifications') {
      if (req.method === 'GET') { const mine = db.notifications.filter((n) => n.userId === sub); return send(res, 200, { rows: mine.slice(0, 100), unread: mine.filter((n) => !n.read).length }); }
      if (req.method === 'POST' && id === 'read') { for (const n of db.notifications) if (n.userId === sub && (body.all || n.id === body.id)) n.read = true; return send(res, 200, { ok: true }); }   // only ever touches the caller's own
    }
    // ---------- Tenant: wallet, search, booking ----------
    if (req.method === 'GET' && a === 'wallet') {
      need(role, ['tenant']);
      const ts = myTokens(sub), sum = (f) => ts.filter(f).reduce((x, t) => x + t.amount, 0);
      return send(res, 200, { available: sum((t) => t.state === 'ELIGIBLE' && !t.reservedBy), pending: sum((t) => t.reservedBy && t.state !== 'REDEEMED'), locked: sum((t) => t.state === 'DORMANT'),
        redeemed: sum((t) => t.state === 'REDEEMED'), total: sum(() => true), tokens: ts.map((t) => ({ ...core.toTenantView(t), reserved: !!t.reservedBy, from: `${db.properties[t.propertyId].name}, ${db.rooms[t.roomId].name}` })) });
    }
    if (a === 'listings') {
      need(role, ['tenant']);
      const q = new URL(req.url, 'http://x').searchParams;
      if (req.method === 'GET' && !id) {
        const city = q.get('city') ?? 'Indore';
        if (city !== 'Indore') return send(res, 200, { rows: [], comingSoon: true, city });      // other cities: not launched yet
        const from = q.get('lat') && q.get('lng') ? { lat: +q.get('lat'), lng: +q.get('lng') } : null;
        const num = (k) => (q.get(k) !== null && q.get(k) !== '' ? +q.get(k) : null);
        const text = (q.get('q') ?? '').trim().toLowerCase(), amen = (q.get('amenities') ?? '').split(',').filter(Boolean);
        let rows = Object.values(db.rooms).filter(marketable).map((r) => card(r, from)).filter((c) =>
          (!text || `${c.title} ${c.locality} ${c.roomType}`.toLowerCase().includes(text)) && (!q.get('type') || c.type === q.get('type')) &&
          (num('minRent') === null || c.rent >= num('minRent')) && (num('maxRent') === null || c.rent <= num('maxRent')) &&
          (num('beds') === null || c.beds >= num('beds')) && (num('baths') === null || c.baths >= num('baths')) &&
          (!q.get('furnished') || c.furnished === q.get('furnished')) && amen.every((x) => c.amenities.includes(x)) &&
          (num('maxKm') === null || c.distanceKm === null || c.distanceKm <= num('maxKm')));
        const sort = q.get('sort') ?? 'relevance';
        if (sort === 'rent_asc') rows.sort((x, y) => x.rent - y.rent); else if (sort === 'rent_desc') rows.sort((x, y) => y.rent - x.rent);
        else if (sort === 'distance' && from) rows.sort((x, y) => (x.distanceKm ?? 1e9) - (y.distanceKm ?? 1e9));
        return send(res, 200, { rows, total: rows.length, city });
      }
      if (req.method === 'GET' && id) {
        const r = db.rooms[id]; if (!r || !marketable(r)) return send(res, 404, { error: 'This room is no longer available' });
        const p = db.properties[r.propertyId], from = q.get('lat') && q.get('lng') ? { lat: +q.get('lat'), lng: +q.get('lng') } : null;
        return send(res, 200, { ...card(r, from), address: p.address, geo: p.geo ? { lat: p.geo.lat, lng: p.geo.lng } : null,
          owner: { firstName: p.ownerName.split(' ')[0], verified: true },          // no phone/last name before booking
          siblings: p.roomIds.length, description: `${r.roomType} in ${p.name}, ${p.locality}. Verified in person by our agent.`,
          quote: quoteFor(sub, r, 11) });
      }
    }
    if (a === 'bookings') {
      const view = (b) => { const r = db.rooms[b.roomId], p = db.properties[r.propertyId]; return { ...b, room: r.name, property: p.name, locality: p.locality, rent: r.rent }; };
      if (req.method === 'GET' && !id) { need(role, ['tenant']); return send(res, 200, { rows: Object.values(db.bookings).filter((b) => b.tenantId === sub).map(view).reverse() }); }
      if (req.method === 'POST' && !id) {                            // create booking request (unpaid)
        need(role, ['tenant']);
        const r = db.rooms[body.roomId]; if (!r || !marketable(r)) return send(res, 409, { error: 'This room is no longer available' });
        if (r.tenantId === sub) return send(res, 409, { error: 'You already live in this room' });
        if (validBookings(sub).some((b) => ['REQUESTED', 'PENDING', 'CONFIRMED'].includes(b.status))) return send(res, 409, { error: 'You already have a booking in progress' });
        const months = +body.months; if (!Number.isInteger(months) || months < 1 || months > 24) return send(res, 422, { error: 'Choose a stay of 1 to 24 months' });
        const d = String(body.moveInDate ?? ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < today() || d > new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10)) return send(res, 422, { error: 'Pick a move-in date within the next 90 days' });
        const b = { id: 'b' + (Object.keys(db.bookings).length + 1), tenantId: sub, roomId: r.id, moveInDate: d, months, quote: quoteFor(sub, r, months), status: 'REQUESTED', history: [{ status: 'REQUESTED', at: new Date().toISOString() }], payment: null, refund: null };
        db.bookings[b.id] = b; return send(res, 200, { booking: view(b) });
      }
      const b = db.bookings[id]; if (!b) return send(res, 404, { error: 'Booking not found' });
      if (role === 'tenant' && b.tenantId !== sub) forbid();
      if (req.method === 'GET') return send(res, 200, { booking: view(b) });
      if (action === 'pay' && action2 === 'start') {            // step 1: create the order for the exact amount
        need(role, ['tenant']); if (b.status !== 'REQUESTED') return send(res, 409, { error: 'This booking is already paid or closed' });
        const room = db.rooms[b.roomId]; if (!marketable(room)) { addHist(b, 'CANCELLED'); return send(res, 409, { error: 'Sorry, this room was just taken' }); }
        b.quote = quoteFor(sub, room, b.months);                                     // price is fixed here; the order below is for exactly this amount
        if (b.quote.payable <= 0) { await settlePayment(b, { paymentId: 'free_' + b.id, method: 'CASHBACK' }); return send(res, 200, { free: true, booking: view(b) }); }
        const amount = b.quote.payable * 100;
        if (!b.order || b.order.amount !== amount || b.order.status !== 'CREATED') {
          try { const o = await pay.createOrder({ amount, receipt: b.id, notes: { booking: b.id } }); b.order = { id: o.id, amount: o.amount, status: 'CREATED' }; }
          catch (e) { console.error('[payments] createOrder failed:', e.message); return send(res, 502, { error: 'We could not start the payment. You have not been charged. Please try again.' }); }
        }
        return send(res, 200, { provider: pay.name, keyId: pay.keyId, orderId: b.order.id, amount: b.order.amount, currency: 'INR', prefill: { contact: db.users.find((u) => u.id === sub)?.phone }, bookingId: b.id });
      }
      if (action === 'pay' && action2 === 'confirm') {          // step 2: the phone says it paid — believe it only if the signature checks out
        need(role, ['tenant']);
        if (b.payment && b.payment.id === body.paymentId) return send(res, 200, { booking: view(b) });          // the app retried: same answer
        if (b.status !== 'REQUESTED') return send(res, 409, { error: 'This booking is already paid or closed' });
        if (!b.order || b.order.id !== body.orderId || !pay.verifyPayment({ orderId: body.orderId, paymentId: body.paymentId, signature: body.signature })) return send(res, 400, { error: 'We could not verify this payment. If money was deducted it will be refunded automatically.' });
        b.order.status = 'PAID'; const r = await settlePayment(b, { paymentId: body.paymentId, method: body.method ?? 'ONLINE' });
        return send(res, r.conflict ? 409 : 200, r.conflict ? { error: 'Sorry, this room was just taken. Your payment will be refunded in full.' } : { booking: view(b) });
      }
      if (action === 'pay' && !action2) {                       // one-step SIMULATED payment — development and tests only; with a real gateway it must not exist
        need(role, ['tenant']); if (!pay.simulate) return send(res, 403, { error: 'Please use the secure payment flow' });
        if (b.status !== 'REQUESTED') return send(res, 409, { error: 'This booking is already paid or closed' });
        const room = db.rooms[b.roomId]; if (!marketable(room)) { addHist(b, 'CANCELLED'); return send(res, 409, { error: 'Sorry, this room was just taken' }); }
        if (!PROD && body.simulate === 'fail') return send(res, 402, { error: 'Payment failed. You have not been charged.' });
        b.quote = quoteFor(sub, room, b.months);
        await settlePayment(b, { paymentId: 'pay_' + b.id, method: body.method ?? 'UPI' });
        return send(res, 200, { booking: view(b) });
      }
      if (action === 'cancel') {
        need(role, ['tenant']); if (!['REQUESTED', 'PENDING', 'CONFIRMED'].includes(b.status)) return send(res, 409, { error: 'This booking can no longer be cancelled' });
        await startRefund(b);
        releaseBooking(b); addHist(b, 'CANCELLED'); return send(res, 200, { booking: view(b) });
      }
      if (action === 'confirm') { need(role, ['admin', 'agent']); if (b.status !== 'PENDING') return send(res, 409, { error: 'Only paid bookings can be confirmed' }); addHist(b, 'CONFIRMED'); notify(b.tenantId, 'BOOKING', 'Booking confirmed', 'Your room is confirmed. Owner details are now available.'); return send(res, 200, { booking: view(b) }); }
      if (action === 'reject') {
        need(role, ['admin']); if (!['PENDING', 'CONFIRMED'].includes(b.status)) return send(res, 409, { error: 'Nothing to reject' });
        if (!body.reason?.trim()) return send(res, 422, { error: 'Please add a reason' });
        await startRefund(b);
        b.reason = body.reason; releaseBooking(b); addHist(b, 'REJECTED'); notify(b.tenantId, 'BOOKING', 'Booking could not be confirmed', 'We could not confirm your booking. You have been refunded in full.'); return send(res, 200, { booking: view(b) });
      }
      if (action === 'movein') {                                     // placement: new tenancy + commission outcome + token redeemed
        need(role, ['admin', 'agent']); if (b.status !== 'CONFIRMED') return send(res, 409, { error: 'Confirm the booking first' });
        const room = db.rooms[b.roomId], win = db.windows[room.id], ownerId = room.ownerId;
        if (win) {
          const out = core.commissionOutcome({ monthlyRent: room.rent, window: win, placedAt: new Date() });
          db.commissions.push({ id: 'c' + (db.commissions.length + 1), bookingId: b.id, newTenantId: b.tenantId, roomId: room.id, room: room.name, ownerId, days: +((Date.now() - +new Date(win.startedAt)) / 864e5).toFixed(1), status: out.status, amount: out.amount, waivedValue: out.status === 'WAIVED' ? Math.round(room.rent * core.COMMISSION_RATE) : 0, at: new Date().toISOString() });
          delete db.windows[room.id]; b.placement = out;              // window closes: room is placed
        }
        const t = myTokens(b.tenantId).find((x) => x.reservedBy === b.id);
        if (t) { const key = Object.keys(db.tokens).find((k) => db.tokens[k] === t); const r2 = core.redeem(t, { monthlyRent: room.rent, bookingNumber: b.quote.bookingNumber }); db.tokens[key] = { ...r2.token }; }
        room.status = 'OCCUPIED'; room.tenantId = b.tenantId; db.tenancies.push({ id: crypto.randomUUID(), roomId: room.id, tenantId: b.tenantId, startedAt: new Date().toISOString() });
        addHist(b, 'MOVED_IN'); notify(b.tenantId, 'BOOKING', 'Welcome home!', 'Your tenancy has started.');
        if (b.placement) notify(ownerId, 'PLACEMENT', b.placement.status === 'DUE' ? 'New tenant placed' : 'New tenant placed — commission waived', b.placement.status === 'DUE' ? `${room.name} is filled. Commission due: ₹${b.placement.amount} (20% of one month's rent).` : `${room.name} is filled. Commission waived — you pay nothing.`);
        return send(res, 200, { booking: view(b) });
      }
    }
    // ---------- Agent ----------
    if (req.method === 'GET' && a === 'agent' && id === 'dashboard') {
      need(role, ['agent', 'admin']);
      const tasks = Object.values(db.properties).filter((p) => role === 'admin' || p.agent === sub).map((p) => ({ id: p.id, name: p.name, locality: p.locality, visit: p.visit, task: p.agentTask, rooms: p.roomIds.length, note: p.note ?? null }));
      const n = (k) => tasks.filter((x) => x.task === k).length;
      return send(res, 200, { counts: { assigned: tasks.length, pending: n('PENDING'), verified: n('VERIFIED'), rejected: n('REJECTED'), revisit: n('REVISIT'), completed: n('VERIFIED') + n('REJECTED') }, tasks });
    }
    if (req.method === 'GET' && a === 'agent' && id === 'qr') {
      need(role, ['agent', 'admin']);
      return send(res, 200, { tags: Object.entries(db.qr).filter(([rid]) => role === 'admin' || db.properties[db.rooms[rid].propertyId].agent === sub).map(([roomId, q]) => ({ roomId, room: db.rooms[roomId].name, property: db.properties[db.rooms[roomId].propertyId].name, ...q })) });
    }
    if (a === 'properties' && id && db.properties[id]) {
      const p = db.properties[id];
      if (role === 'agent' && p.agent !== sub) forbid();
      if (!['agent', 'admin'].includes(role)) forbid();
      if (req.method === 'GET' && !action) { need(role, ['agent', 'admin']); return send(res, 200, { property: p, rooms: p.roomIds.map((r) => ({ ...db.rooms[r], qr: db.qr[r] ?? null })) }); }
      if (req.method === 'POST' && action === 'schedule') {
        const when = new Date(body.visitAt); if (isNaN(+when) || +when < Date.now() - 36e5 || +when > Date.now() + 30 * 864e5) return send(res, 422, { error: 'Pick a visit time within the next 30 days' });
        p.visitAt = when.toISOString(); p.visit = visitLabel(p.visitAt); notify(db.rooms[p.tenantRoomId]?.tenantId, 'VERIFICATION', 'Agent visit scheduled', `Your agent will visit ${p.name} on ${p.visit}.`); return send(res, 200, { visit: p.visit });
      }
      if (req.method === 'POST' && action === 'start') {
        need(role, ['agent']); if (!['PENDING', 'REVISIT'].includes(p.agentTask)) return send(res, 409, { error: 'This visit is already finished' });
        p.agentTask = 'PENDING'; p.startedAt = new Date().toISOString(); notify(db.rooms[p.tenantRoomId]?.tenantId, 'VERIFICATION', 'Verification started', 'Your agent has started verifying your property.'); return send(res, 200, { stage: stageOf(p) });
      }
      if (req.method === 'POST' && action === 'qr') { // generate + assign a QR tag to EVERY room
        need(role, ['agent', 'admin']);
        for (const r of p.roomIds) db.qr[r] ??= { code: core.qrPayload(r), status: 'ACTIVE', assignedAt: new Date().toISOString() };
        return send(res, 200, { tags: p.roomIds.map((r) => ({ roomId: r, room: db.rooms[r].name, ...db.qr[r] })) });
      }
      if (req.method === 'POST' && action === 'verify') {
        need(role, ['agent']);
        const missing = core.validateSubmission({ checklist: body.checklist, geo: body.geo, propertyRoomIds: p.roomIds, qrRoomIds: Object.keys(db.qr) });
        if (missing.length) return send(res, 422, { error: 'Still to do: ' + missing.join(', '), missing });
        p.status = 'OCCUPIED'; p.agentTask = 'VERIFIED'; p.geo = { ...body.geo, scope: 'PROPERTY' }; p.verifiedAt = new Date().toISOString(); p.notes = body.notes ?? '';
        notify(db.rooms[p.tenantRoomId]?.tenantId, 'VERIFICATION', 'Verification completed', 'Your property is verified. Your 30% cashback token has been added and is saved for later.'); notifyRole('admin', 'VERIFICATION', 'Property verified', `${p.name} verified by agent.`);
        const room = db.rooms[p.tenantRoomId];
        db.tokens[room.id] ??= core.mintRegistrationToken({ propertyId: p.id, roomId: room.id, tenantId: room.tenantId, monthlyRent: room.rent }); // 30% deferred token
        return send(res, 200, { property: p, token: core.toTenantView(db.tokens[room.id]) });
      }
      if (req.method === 'POST' && action === 'assign') {            // admin (re)assigns the agent who will visit
        need(role, ['admin']); const ag = db.users.find((u) => u.id === body.agentId && u.roles.includes('agent'));
        if (!ag) return send(res, 422, { error: 'Choose an agent' }); if (!['PENDING', 'REVISIT'].includes(p.agentTask)) return send(res, 409, { error: 'This property is already verified or closed' });
        const old = p.agent; p.agent = ag.id; p.startedAt = null;
        notify(ag.id, 'VERIFICATION', 'New verification task', `${p.name}, ${p.locality} was assigned to you.`); if (old && old !== ag.id) notify(old, 'VERIFICATION', 'Task reassigned', `${p.name} was moved to another agent.`);
        notify(db.rooms[p.tenantRoomId]?.tenantId, 'VERIFICATION', 'Agent assigned', `${ag.name.split(' ')[0]} will verify your property.`);
        return send(res, 200, { agent: ag.name });
      }
      if (req.method === 'POST' && (action === 'reject' || action === 'revisit')) {
        need(role, ['agent', 'admin']);
        if (!body.reason?.trim()) return send(res, 422, { error: 'Please add a reason' });
        p.agentTask = action === 'reject' ? 'REJECTED' : 'REVISIT'; p.status = action === 'reject' ? 'REJECTED' : 'PENDING_VERIFICATION'; p.note = body.reason;
        notify(db.rooms[p.tenantRoomId]?.tenantId, 'VERIFICATION', action === 'reject' ? 'Property not verified' : 'Agent will visit again', action === 'reject' ? `We could not verify ${p.name}: ${body.reason}` : `We need to revisit ${p.name}: ${body.reason}`); notifyRole('admin', 'ALERT', action === 'reject' ? 'Verification rejected' : 'Revisit required', `${p.name}: ${body.reason}`);
        return send(res, 200, { property: p });
      }
    }
    // ---------- Admin ----------
    if (req.method === 'GET' && (a === 'admin' || a === 'me')) {
      const scoped = a === 'me';            // /me/* = same tables, limited to the signed-in agent/owner's own data
      if (scoped) need(role, ['agent', 'owner']); else need(role, ['admin']);
      const ME = sub;
      const ALLOWED = { agent: ['properties', 'qr'], owner: ['rooms', 'vacancy', 'commissions'] };
      if (scoped && !ALLOWED[role].includes(id)) return send(res, 403, { error: 'not available for role ' + role });
      const props = Object.values(db.properties), rooms = Object.values(db.rooms), tokens = Object.entries(db.tokens);
      const uname = (uid) => db.users.find((u) => u.id === uid)?.name ?? '—';
      const wins = Object.entries(db.windows).map(([rid, w]) => ({ rid, st: core.windowStatus(w) }));
      if (id === 'overview') {
        const comm = db.commissions;
        const NOW = Date.now(), W = 7 * 864e5, edges = [0, 1, 2, 3, 4, 5].map((i) => NOW - (6 - i) * W);       // six weekly buckets ending now
        const bucket = (iso) => { const t = +new Date(iso); if (!iso || t > NOW) return -1; const i = Math.floor((t - (NOW - 6 * W)) / W); return i >= 0 && i < 6 ? i : -1; };
        const weekly = (items, at, val = () => 1) => { const out = [0, 0, 0, 0, 0, 0]; for (const x of items) { const i = bucket(at(x)); if (i >= 0) out[i] += val(x); } return out; };
        const cum = (items, at) => { const base = items.filter((x) => !at(x)).length; return edges.map((_, i) => base + items.filter((x) => at(x) && +new Date(at(x)) < NOW - (5 - i) * W).length); };
        const bookings = Object.values(db.bookings);
        const series = {
          labels: edges.map((e) => new Date(e).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })),
          propertyGrowth: cum(props, (p) => p.createdAt), verificationTrend: weekly(props.filter((p) => p.verifiedAt), (p) => p.verifiedAt),
          vacancy: weekly(Object.values(db.checkouts).filter((k) => k.verifiedAt), (k) => k.verifiedAt), bookingTrend: weekly(bookings, (b) => b.history[0]?.at),
          placementSuccess: [0, 1, 2, 3, 4, 5].map((i) => { const w = comm.filter((c) => bucket(c.at) === i); return w.length ? Math.round((100 * w.filter((c) => c.status !== 'WAIVED').length) / w.length) : 0; }),
          cashbackUsage: weekly(Object.values(db.tokens).filter((t) => t.redeemedAt), (t) => t.redeemedAt, (t) => t.amount), commissionRevenue: weekly(comm.filter((c) => c.paidAt), (c) => c.paidAt, (c) => c.amount),
          ownerConsents: weekly(props.filter((p) => p.ownerConsentAt), (p) => p.ownerConsentAt), repeatBookings: weekly(bookings.filter((b) => b.quote.bookingNumber >= 3), (b) => b.history[0]?.at),
          agentPerformance: db.users.filter((u) => u.roles.includes('agent')).map((u) => ({ name: u.name.split(' ')[0] + ' ' + (u.name.split(' ')[1]?.[0] ?? '') + '.', verified: props.filter((p) => p.agent === u.id && p.agentTask === 'VERIFIED').length })),
        };
        return send(res, 200, {
          kpis: {
            totalProperties: props.length, verifiedProperties: props.filter((p) => p.agentTask === 'VERIFIED').length,
            pendingVerification: props.filter((p) => p.agentTask === 'PENDING' || p.agentTask === 'REVISIT').length,
            occupiedRooms: rooms.filter((r) => r.status === 'OCCUPIED').length, vacantRooms: rooms.filter((r) => r.status === 'VACANT').length,
            activeTenancies: rooms.filter((r) => r.tenantId && r.status === 'OCCUPIED').length, activeBookings: bookings.filter((b) => ['PENDING', 'CONFIRMED'].includes(b.status)).length,
            successfulPlacements: comm.filter((c) => c.status !== 'WAIVED').length, pendingPlacements: wins.filter((w) => w.st.phase === 'ACTIVE').length,
            cashbackLiability: tokens.filter(([, t]) => ['DORMANT', 'ELIGIBLE', 'LOCKED'].includes(t.state)).reduce((a, [, t]) => a + t.amount, 0),
            cashbackRedeemed: tokens.filter(([, t]) => t.state === 'REDEEMED').reduce((a, [, t]) => a + t.amount, 0),
            commissionEarned: comm.filter((c) => c.status === 'PAID').reduce((a, c) => a + c.amount, 0), commissionWaived: comm.filter((c) => c.status === 'WAIVED').reduce((a, c) => a + c.waivedValue, 0),
          },
          occupancy: { occupied: rooms.filter((r) => r.status === 'OCCUPIED').length, vacant: rooms.filter((r) => r.status === 'VACANT').length, other: rooms.filter((r) => !['OCCUPIED', 'VACANT'].includes(r.status)).length },
          series,
        });
      }
      if (id === 'agents' && !scoped) {                          // for the "assign agent" picker
        const load = (aid) => props.filter((p) => p.agent === aid && ['PENDING', 'REVISIT'].includes(p.agentTask)).length;
        return send(res, 200, { rows: db.users.filter((u) => u.roles.includes('agent')).map((u) => ({ id: u.id, name: `${u.name} (${load(u.id)} open)` })) });
      }
      if (id === 'settings' && !scoped) return send(res, 200, {
        rules: { commissionRate: core.COMMISSION_RATE, placementWindowDays: core.PLACEMENT_WINDOW_DAYS, registrationTokenRate: core.REGISTRATION_TOKEN_RATE, cashbackLadder: core.CASHBACK_LADDER },
        system: { storage: persist.durable ? 'durable' : 'memory only', whatsapp: provider.name, sms: sms.name, payments: pay.name, push: pusher.name, environment: process.env.NODE_ENV ?? 'development', ownerFoundRoomsCoveredByPlacement: false, repairCoordinationIncluded: false },
      });
      if (id === 'reports' && !scoped) {
        const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0), avg = (xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : null);
        const reg = props.filter((p) => p.registeredBy);
        const funnel = [['Registered by tenants', reg.length], ['Agent assigned', reg.filter((p) => p.agent).length], ['Visit scheduled or done', reg.filter((p) => p.visitAt || p.agentTask !== 'PENDING' || p.startedAt).length],
          ['Verified', reg.filter((p) => p.agentTask === 'VERIFIED').length], ['Owner agreed', reg.filter((p) => p.ownerConsentAt).length]].map(([stage, count], i, arr) => ({ stage, count, ofPrevious: i ? pct(count, arr[i - 1][1]) + '%' : '—' }));
        const agents = db.users.filter((u) => u.roles.includes('agent')).map((u) => { const mine = props.filter((p) => p.agent === u.id), v = mine.filter((p) => p.verifiedAt && p.createdAt);
          return { agent: u.name, assigned: mine.length, verified: mine.filter((p) => p.agentTask === 'VERIFIED').length, rejected: mine.filter((p) => p.agentTask === 'REJECTED').length, revisit: mine.filter((p) => p.agentTask === 'REVISIT').length,
            avgHoursToVerify: avg(v.map((p) => (+new Date(p.verifiedAt) - +new Date(p.createdAt)) / 36e5)) ?? '—' }; });
        const comm = db.commissions, by = (st) => comm.filter((c) => c.status === st);
        const commission = ['DUE', 'PAID', 'WAIVED'].map((st) => ({ status: st, count: by(st).length, amount: by(st).reduce((a, c) => a + (st === 'WAIVED' ? c.waivedValue : c.amount), 0), note: st === 'WAIVED' ? 'value NOT charged — never paid to owners' : '' }));
        const cashback = ['DORMANT', 'ELIGIBLE', 'REDEEMED', 'CANCELLED', 'UNDER_REVIEW'].map((st) => ({ state: st, tokens: tokens.filter(([, t]) => t.state === st).length, amount: tokens.filter(([, t]) => t.state === st).reduce((a, [, t]) => a + t.amount, 0) }));
        const bookings = ['REQUESTED', 'PENDING', 'CONFIRMED', 'MOVED_IN', 'REJECTED', 'CANCELLED'].map((st) => ({ status: st, count: Object.values(db.bookings).filter((b) => b.status === st).length }));
        const cos = Object.values(db.checkouts), ver = cos.filter((k) => k.verifiedAt);
        const checkouts = { total: cos.length, verified: ver.length, manualReview: cos.filter((k) => k.state === 'MANUAL_REVIEW').length, disputed: cos.filter((k) => k.state === 'DISPUTED').length,
          avgHoursToVerify: avg(ver.map((k) => (+new Date(k.verifiedAt) - +new Date(k.log[0].at)) / 36e5)) };
        const placements = { placed: comm.length, within7Days: comm.filter((c) => c.status !== 'WAIVED').length, avgDaysVacantBeforePlacement: avg(comm.filter((c) => c.days != null).map((c) => c.days)), successRate: pct(comm.filter((c) => c.status !== 'WAIVED').length, comm.length) + '%' };
        return send(res, 200, { generatedAt: new Date().toISOString(), funnel, agents, commission, cashback, bookings, checkouts, placements,
          ownerConversion: { registered: reg.length, agreed: reg.filter((p) => p.ownerConsentAt).length, rate: pct(reg.filter((p) => p.ownerConsentAt).length, reg.length) + '%' } });
      }
      const tables = {
        properties: () => props.map((p) => ({ id: p.id, name: p.name, locality: p.locality, status: p.status, rooms: p.roomIds.length, tenant: p.tenantName, owner: p.ownerName, geoTag: p.geo ? 'Whole property ✓' : '—', visit: p.visit ?? '—', photos: (p.photos ?? []).length, ownerConsent: p.ownerConsentAt ? 'Yes' : 'Waiting', agent: uname(p.agent) })),
        rooms: () => rooms.map((r) => ({ id: r.id, room: r.name, property: db.properties[r.propertyId].name, rent: r.rent, status: r.status, tenant: uname(r.tenantId), qr: db.qr[r.id] ? 'Assigned' : 'Not assigned' })),
        users: () => db.users,
        vacancy: () => wins.map(({ rid, st }) => ({ id: rid, room: db.rooms[rid].name, property: db.properties[db.rooms[rid].propertyId].name, phase: st.phase, window: st.label, continuePlacement: st.continuePlacement ? 'Yes (free)' : '—' })),
        commissions: () => db.commissions.map((c) => ({ id: c.id, roomId: c.roomId, room: c.room, status: c.status, amount: c.amount, waivedValue: c.waivedValue, at: c.at })),
        // inactivity tracking is ADMIN-ONLY and never shown to tenants
        cashback: () => tokens.map(([rid, t]) => ({ id: rid, room: db.rooms[rid].name, tenant: uname(t.tenantId), amount: t.amount, state: t.state, inactiveSince: t.internal?.inactivityTrackedFrom?.slice(0, 10) })),
        qr: () => Object.entries(db.qr).map(([rid, q]) => ({ id: rid, room: db.rooms[rid].name, property: db.properties[db.rooms[rid].propertyId].name, code: q.code, status: q.status, assignedAt: q.assignedAt?.slice(0, 10) })),
        'ai-logs': () => Object.entries(db.checkouts).flatMap(([rid, k]) => k.log.map((l, i) => ({ id: `${rid}-${i}`, room: db.rooms[rid].name, at: l.at, event: l.ev, detail: l.reason ?? '', channel: l.ev.startsWith('OWNER') ? 'WhatsApp → owner' : l.ev.startsWith('TENANT') || l.ev === 'QR_SCANNED' ? 'App → tenant' : 'System' }))),
        bookings: () => Object.values(db.bookings).map((b) => ({ id: b.id, tenant: uname(b.tenantId), room: db.rooms[b.roomId].name, property: db.properties[db.rooms[b.roomId].propertyId].name, moveIn: b.moveInDate, payable: b.quote.payable, cashback: b.quote.cashback, status: b.status })),
        kyc: () => Object.entries(db.kyc).flatMap(([uid, hs]) => hs.slice(-1).map((h) => ({ id: uid, name: uname(uid), idType: h.idType, status: h.status, submittedAt: h.at.slice(0, 10), docRef: h.docRef ?? '', reason: h.reason ?? '' }))),
        notifications: () => db.notifications.filter((n) => n.userId === sub).map((n) => ({ id: n.id, type: n.type, title: n.title, detail: n.body, at: n.at, read: n.read ? 'Yes' : 'No' })),
        conversations: () => Object.values(db.conversations).map((c) => ({ id: c.id, room: db.rooms[c.roomId].name, party: c.party, phone: '••••••' + c.phone.slice(-4), status: c.status, outcome: c.outcome ?? '', attempts: c.attempts, requestedAt: c.requestedAt,
          transcript: c.messages.map((m) => (m.dir === 'out' ? 'AI: ' : 'Reply: ') + m.text).join('  |  ') })).reverse(),
        checkouts: () => Object.entries(db.checkouts).map(([rid, k]) => ({ id: rid, room: db.rooms[rid].name, status: k.state, tenantDate: k.tenant?.checkoutDate ?? '—', ownerDate: k.owner?.checkoutDate ?? '—', reason: k.log.at(-1)?.reason ?? '' })),
        staff: () => db.users.filter((u) => u.roles.some((r) => ['admin', 'agent'].includes(r))).map((u) => ({ id: u.id, name: u.name, phone: u.phone, roles: u.roles.filter((r) => ['admin', 'agent'].includes(r)).join(', '), status: u.disabled ? 'DISABLED' : 'ACTIVE', openTasks: Object.values(db.properties).filter((p) => p.agent === u.id && ['PENDING', 'REVISIT'].includes(p.agentTask)).length })),
        audit: () => db.audit,
      };
      if (tables[id]) {
        let rows = tables[id]();
        if (scoped) {
          const okProps = new Set(props.filter((p) => (role === 'agent' ? p.agent === ME : rooms.some((r) => r.propertyId === p.id && r.ownerId === ME))).map((p) => p.id));
          const okRooms = new Set(rooms.filter((r) => (role === 'agent' ? okProps.has(r.propertyId) : r.ownerId === ME)).map((r) => r.id));
          rows = rows.filter((r) => (id === 'properties' ? okProps.has(r.id) : id === 'commissions' ? okRooms.has(r.roomId) : okRooms.has(r.id)));
        }
        return send(res, 200, { rows });
      }
      return send(res, 404, { error: 'unknown admin resource' });
    }
    send(res, 404, { error: 'not found' });
  } catch (e) { if (!res.headersSent) send(res, typeof e.code === 'number' ? e.code : 400, { error: e.message }); }
});
export const _ai = () => ai;
export const _hasAdmin = hasAdmin;
export const _provider = provider;
export const _pay = pay;
export const _push = pusher;
if (process.argv[1].endsWith('server.js')) {
  const { errors, warnings } = validateEnv(); for (const w of warnings) console.warn('[config]', w);
  if (!hasAdmin()) { console.error('[config] cannot start: there is no active admin. Set BOOTSTRAP_ADMIN_PHONE (10-digit mobile) for the first start.'); process.exit(1); }
  if (errors.length) { console.error('[config] cannot start:\n - ' + errors.join('\n - ')); process.exit(1); }
  setInterval(() => { try { retryRefunds().catch((e) => console.error('[refunds]', e)); purgeKycDocs(); ai.sweep(); persist.flush().catch((e) => console.error('[storage]', e)); } catch (e) { console.error('[ai sweep]', e); } }, 5 * 60e3).unref();
  server.listen(Number(process.env.PORT ?? 4000), () => console.log(`RentalHub API on :${server.address().port} (${persist.durable ? 'durable storage' : 'memory only'})`));
  // Deploys and restarts send SIGTERM: stop taking requests, finish saving, close the database, then exit.
  let closing = false;
  const shutdown = async (sig) => {
    if (closing) return; closing = true; console.log(`[shutdown] ${sig}: finishing up`);
    setTimeout(() => process.exit(1), 10_000).unref();
    server.close(); try { await persist.flush(); await persist.close?.(); } catch (e) { console.error('[shutdown] save failed', e); process.exit(1); }
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM')); process.on('SIGINT', () => shutdown('SIGINT'));
}
