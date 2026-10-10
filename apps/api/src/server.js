// RentalHub Production API — PostgreSQL + Prisma ORM
// Complete database-backed architecture with zero demo data.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import * as core from '../../../packages/core/src/index.js';
import { signToken, verifyToken, validPhone, sms } from './auth.js';
import { createProvider, verifySignature, extractInbound } from './messaging.js';
import { createAi } from './ai.js';
import { createPayments } from './payments.js';
import { securityHeaders, applyCors, createLimiter, clientIp, logLine, validateEnv } from './hardening.js';
import { sendPushNotification, isFcmConfigured } from './fcm.js';
import { hashPassword, verifyPassword } from './passwords.js';
import * as db from './db.js';

const PROD = process.env.NODE_ENV === 'production';
const today = () => new Date().toISOString().slice(0, 10);
const km = (a, b) => {
  const R = 6371, d = (x) => (x * Math.PI) / 180;
  const h = Math.sin(d(b.lat - a.lat) / 2) ** 2 + Math.cos(d(a.lat)) * Math.cos(d(b.lat)) * Math.sin(d(b.lng - a.lng) / 2) ** 2;
  return +(2 * R * Math.asin(Math.sqrt(h))).toFixed(1);
};

const marketable = (r) => ['AVAILABLE', 'VACANT'].includes(r.status) && r.property?.agentTask === 'VERIFIED' && !!r.property?.ownerConsentAt;
const card = (r, from) => {
  const p = r.property;
  return {
    roomId: r.id,
    propertyId: p.id,
    title: p.name,
    room: r.name,
    locality: p.locality,
    type: p.type ?? 'Room',
    roomType: r.roomType ?? 'Room',
    rent: r.rent,
    beds: r.beds ?? 1,
    baths: r.baths ?? 1,
    furnished: r.furnished ?? 'UNFURNISHED',
    amenities: r.amenities ?? [],
    photos: p.photos ?? [],
    verified: p.agentTask === 'VERIFIED',
    available: marketable(r),
    distanceKm: from && p.geoLat && p.geoLng ? km(from, { lat: p.geoLat, lng: p.geoLng }) : null,
  };
};

const stageOf = (p) =>
  p.agentTask === 'VERIFIED' ? 'COMPLETED' :
  p.agentTask === 'REJECTED' ? 'FAILED' :
  p.agentTask === 'REVISIT' ? 'REVISIT' :
  p.startedAt ? 'IN_PROGRESS' :
  p.visitAt ? 'SCHEDULED' :
  p.agentId ? 'ASSIGNED' : 'PENDING';

const visitLabel = (iso) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? (PROD ? '/data/uploads' : path.join(os.tmpdir(), 'rentalhub-uploads'));
const PRIVATE_DIR = process.env.PRIVATE_DIR ?? (PROD ? '/data/private' : path.join(os.tmpdir(), 'rentalhub-private'));
const KYC_RETENTION_DAYS = Number(process.env.KYC_DOC_RETENTION_DAYS ?? 90);
const PRIVATE_REF = /^\/private\/([0-9a-f-]{36})\.(jpg|png|webp)$/;
const REF_OK = /^\/files\/[0-9a-f-]{36}\.(jpg|png|webp)$/, VIDEO_OK = /^\/files\/[0-9a-f-]{36}\.mp4$/;
const SIGS = {
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  webp: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
  mp4: (b) => b.subarray(4, 8).toString() === 'ftyp'
};
const MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4' };
const EXT_MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4' };

const canViewKycDoc = async (role, sub, ownerId) => {
  if (sub === ownerId || role === 'admin') return true;
  if (role === 'agent') {
    const props = await db.getAllProperties({ registeredById: ownerId, agentId: sub });
    return props.length > 0;
  }
  return false;
};

export async function purgeKycDocs(now = new Date()) {
  let removed = 0;
  try {
    const users = await db.getAllUsers();
    for (const u of users) {
      const records = await db.getKycHistory(u.id);
      for (const rec of records) {
        const m = rec.docRef && PRIVATE_REF.exec(rec.docRef);
        if (m && rec.reviewedAt && +now - +new Date(rec.reviewedAt) > KYC_RETENTION_DAYS * 864e5) {
          try { fs.unlinkSync(path.join(PRIVATE_DIR, `${m[1]}.${m[2]}`)); } catch {}
          await db.deletePrivateFile(m[1]);
          removed++;
        }
      }
    }
  } catch (e) {
    console.error('[kyc purge] error:', e.message);
  }
  return removed;
}

const LOG = process.env.LOG_REQUESTS === '1' || PROD;
const rateLimit = createLimiter({ max: Number(process.env.RATE_LIMIT_PER_MIN ?? 300) });
const provider = createProvider();
const pay = createPayments();

const notify = async (userId, type, title, body) => {
  if (!userId) return;
  try {
    await db.createNotification({ userId, type, title, body });
    const userTokens = await db.getDeviceTokens(userId);
    if (userTokens?.length) {
      sendPushNotification(userTokens, { title, body, data: { type, userId } }).catch((e) => console.warn('[fcm] push error:', e.message));
    }
  } catch (e) {
    console.warn('[notify] error:', e.message);
  }
};

const notifyRole = async (r, type, title, body) => {
  try {
    const staff = await db.getStaffUsers();
    const targets = staff.filter((u) => u.roles.includes(r.toUpperCase()));
    for (const u of targets) {
      await notify(u.id, type, title, body);
    }
  } catch (e) {
    console.warn('[notifyRole] error:', e.message);
  }
};

const reply = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const send = (res, code, body) => {
  if (code < 300 && res.__audit) {
    db.createAuditLog(res.__audit).catch(() => {});
  }
  reply(res, code, body);
};

const readBody = (req, limit = 1_000_000) => new Promise((ok, fail) => {
  let d = '', n = 0;
  req.on('data', (c) => { n += c.length; if (n > limit) { fail(Object.assign(new Error('Payload too large'), { code: 413 })); req.destroy(); } else d += c; });
  req.on('end', () => { req.rawBody = d; try { ok(d ? JSON.parse(d) : {}); } catch { fail(Object.assign(new Error('Invalid JSON payload'), { code: 400 })); } });
  req.on('error', () => fail(Object.assign(new Error('Request failed'), { code: 400 })));
});

const forbid = () => { throw Object.assign(new Error('Forbidden: you do not have permission to access this resource'), { code: 403 }); };
const need = (role, allowed) => { if (!allowed.includes(role.toLowerCase())) throw Object.assign(new Error(`Forbidden for role ${role}`), { code: 403 }); };

// Helper to compute booking quote using core rules
async function quoteFor(sub, room, months) {
  const tokens = await db.getTokensByTenant(sub);
  const bookings = await db.getBookingsByTenantId(sub);
  const validBookings = bookings.filter((b) => !['CANCELLED', 'REJECTED'].includes(b.status));
  const activeToken = tokens.find((t) => !t.reservedBy && ['ELIGIBLE', 'DORMANT'].includes(t.state)) ?? null;

  return core.quoteBooking({
    monthlyRent: room.rent,
    months,
    bookingNumber: core.bookingNumberFor({ hasRegistered: tokens.length > 0, priorValidBookings: validBookings.length }),
    token: activeToken ? core.toTenantView(activeToken) : null,
  });
}

// Payment & refund helpers
async function startRefund(b, now = new Date()) {
  if (!b.payment || !(b.payment.amount > 0) || b.refund?.status === 'REFUNDED' || b.refund?.status === 'INITIATED') return;
  const base = { amount: b.payment.amount, at: now.toISOString(), attempts: (b.refund?.attempts ?? 0) + 1 };
  try {
    const r = await pay.refund({ paymentId: b.payment.id, amount: b.payment.amount * 100 });
    const refundData = { ...base, status: r.status === 'processed' ? 'REFUNDED' : 'INITIATED', providerRefundId: r.id };
    await db.updateBooking(b.id, { refund: refundData });
  } catch (e) {
    console.error('[payments] refund failed:', e.message);
    const refundData = { ...base, status: 'RETRY' };
    await db.updateBooking(b.id, { refund: refundData });
    if (base.attempts === 1) notifyRole('admin', 'ALERT', 'Refund needs attention', `Booking ${b.id}: refund of ₹${b.payment.amount} could not be started yet.`);
  }
}

async function settlePayment(b, { paymentId, method }) {
  const room = await db.getRoomById(b.roomId);
  const tokenNeeded = b.quote?.cashback > 0;
  const tokens = await db.getTokensByTenant(b.tenantId);
  const tok = tokenNeeded ? tokens.find((t) => !t.reservedBy && t.state === 'ELIGIBLE') : null;

  if (!room || !marketable(room) || (tokenNeeded && !tok)) {
    const payment = { id: paymentId, method, amount: b.quote?.payable ?? 0, at: new Date().toISOString(), status: 'SUCCESS' };
    const history = Array.isArray(b.history) ? [...b.history, { status: 'CANCELLED', at: new Date().toISOString() }] : [{ status: 'CANCELLED', at: new Date().toISOString() }];
    await db.updateBooking(b.id, { payment, status: 'CANCELLED', history });
    await startRefund({ ...b, payment });
    notify(b.tenantId, 'BOOKING', 'Booking conflict', 'This room was just taken, so your payment is being refunded in full.');
    return { conflict: true };
  }

  const payment = { id: paymentId, method, amount: b.quote.payable, at: new Date().toISOString(), status: 'SUCCESS' };
  const history = Array.isArray(b.history) ? [...b.history, { status: 'PENDING', at: new Date().toISOString() }] : [{ status: 'PENDING', at: new Date().toISOString() }];
  await db.updateRoom(room.id, { status: 'BOOKED' });
  if (tok) await db.updateCashbackToken(tok.id, { reservedBy: b.id });
  await db.updateBooking(b.id, { payment, status: 'PENDING', history });

  notify(b.tenantId, 'BOOKING', 'Booking received', `Payment received for ${room.name}. Awaiting confirmation.`);
  notifyRole('admin', 'BOOKING', 'New booking', `${room.name} booked — awaiting confirmation.`);
  return { conflict: false };
}

export async function retryRefunds() {
  const bookings = await db.getAllBookings();
  let n = 0;
  for (const b of bookings) {
    if (b.refund?.status === 'RETRY' && b.refund.attempts < 10) {
      await startRefund(b);
      n++;
    }
  }
  return n;
}

// Checkout advancement logic
async function advance(room, k, { verify = true } = {}) {
  const id = room.id;
  if (verify) k = core.crossVerify(k);
  if (k.state === 'VERIFIED') {
    const existingToken = await db.getTokenByRoomId(id);
    const out = core.applyVerifiedExit(k, { room, token: existingToken });
    const leaving = room.tenantId;

    await db.updateRoom(id, { status: out.room.status, tenantId: null, formerTenantId: leaving });
    if (out.token) {
      if (existingToken) await db.updateCashbackToken(existingToken.id, { state: out.token.state, eligibleAt: out.token.eligibleAt ? new Date(out.token.eligibleAt) : null });
      else await db.createCashbackToken({ tenantId: leaving, propertyId: room.propertyId, roomId: id, amount: out.token.amount, state: out.token.state });
    }
    await db.createVacancyWindow({ roomId: id, startedAt: new Date(out.window.startedAt), endsAt: new Date(out.window.endsAt) });
    await db.endActiveTenancy(id, leaving, k.verifiedAt ? new Date(k.verifiedAt) : new Date());

    notify(leaving, 'CASHBACK', 'Cashback ready', 'Your checkout is verified. Your cashback token is ready for your next booking.');
    notify(room.ownerId, 'VACANCY', `${room.name} is now vacant`, 'The 7-day placement window has started.');
    notifyRole('admin', 'VACANCY', 'Vacancy verified', `${room.name} marked vacant after dual confirmation.`);
  } else if (k.state === 'DISPUTED' || k.state === 'MANUAL_REVIEW') {
    await db.updateRoom(id, { status: 'VERIFICATION_PENDING' });
    notifyRole('admin', 'ALERT', 'Checkout review needed', `${room.name}: ${k.state.replace('_', ' ').toLowerCase()}.`);
  } else if (k.state === 'REJECTED') {
    await db.updateRoom(id, { status: 'OCCUPIED' });
    notify(room.tenantId, 'CHECKOUT', 'Checkout not approved', 'After review the checkout was not approved.');
  }

  const existingCo = await db.getCheckoutByRoomId(id);
  if (existingCo) await db.updateCheckout(existingCo.id, { state: k.state, tenantDate: k.tenantDate ? new Date(k.tenantDate) : null, ownerDate: k.ownerDate ? new Date(k.ownerDate) : null, ownerConfirmed: k.ownerConfirmed, verifiedAt: k.verifiedAt ? new Date(k.verifiedAt) : null, log: k.log });
  else await db.createCheckout({ roomId: id, tenantId: room.tenantId || room.formerTenantId, ownerId: room.ownerId, state: k.state, log: k.log });
  return k;
}

// Create HTTP Server
export const server = http.createServer(async (req, res) => {
  try {
    const started = Date.now();
    securityHeaders(res, PROD);
    applyCors(req, res);

    if (LOG) res.on('finish', () => console.log(logLine({ method: req.method, url: req.url, status: res.statusCode, ms: Date.now() - started, user: res.__audit?.user })));
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const pathOnly = req.url.split('?')[0];
    if (req.method === 'GET' && pathOnly === '/health') {
      return reply(res, 200, { ok: true, storage: 'postgresql_prisma', uptimeSec: Math.round(process.uptime()) });
    }

    if (!pathOnly.startsWith('/webhooks/')) {
      const lim = rateLimit(clientIp(req));
      if (!lim.ok) { res.setHeader('retry-after', String(lim.retryAfter)); return reply(res, 429, { error: 'Too many requests. Please slow down.' }); }
    }

    const [, a, id, action, action2] = new URL(req.url, 'http://x').pathname.split('/');
    if (req.method === 'POST') res.__mutating = true;
    const body = req.method === 'POST' ? await readBody(req, a === 'uploads' ? 40_000_000 : 1_000_000) : {};

    // ==========================================================================
    // 1. PUBLIC AUTHENTICATION (REGISTER & LOGIN)
    // ==========================================================================
    if (req.method === 'POST' && a === 'auth') {
      // User Registration (Tenant or Property Owner)
      if (id === 'register' || id === 'signup') {
        const { name, phone, email, password, role } = body;
        const cleanName = String(name ?? '').trim();
        const cleanPhone = String(phone ?? '').trim();
        const cleanEmail = email ? String(email).trim().toLowerCase() : null;
        const cleanPassword = String(password ?? '');

        if (cleanName.length < 2) return send(res, 422, { error: 'Please enter your full name (at least 2 letters)' });
        if (!validPhone(cleanPhone)) return send(res, 422, { error: 'Please enter a valid 10-digit Indian mobile number' });
        if (cleanEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) return send(res, 422, { error: 'Please enter a valid email address' });
        if (cleanPassword.length < 6) return send(res, 422, { error: 'Password must be at least 6 characters long' });

        const selectedRole = String(role ?? 'tenant').toLowerCase();
        if (!['tenant', 'owner'].includes(selectedRole)) {
          return send(res, 422, { error: 'Invalid registration role. Choose Tenant or Property Owner.' });
        }

        try {
          const user = await db.createUser({
            name: cleanName,
            phone: cleanPhone,
            email: cleanEmail,
            password: cleanPassword,
            role: selectedRole,
            city: body.city || 'Indore',
          });

          const tokenRole = user.role.toLowerCase();
          const token = signToken({ sub: user.id, role: tokenRole });
          return send(res, 201, {
            token,
            user: {
              id: user.id,
              name: user.name,
              phone: user.phone,
              email: user.email,
              role: tokenRole,
              roles: user.roles.map((r) => r.toLowerCase()),
            }
          });
        } catch (err) {
          return send(res, 409, { error: err.message });
        }
      }

      // User Login (ID/Phone/Email + Password)
      if (id === 'login') {
        const identifier = String(body.loginId ?? body.id ?? body.phone ?? body.username ?? body.email ?? '').trim();
        const password = String(body.password ?? '');

        if (!identifier) return send(res, 400, { error: 'Please enter your mobile number, email, or login ID' });
        if (!password) return send(res, 400, { error: 'Please enter your password' });

        const user = await db.getUserByIdentifier(identifier);
        if (!user || user.disabled) {
          return send(res, 401, { error: 'Invalid credentials. Please check your login ID and password.' });
        }

        const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
        if (!isValid) {
          return send(res, 401, { error: 'Invalid credentials. Please check your password.' });
        }

        const userRoles = user.roles.map((r) => r.toLowerCase());
        const requestedRole = body.role ? String(body.role).toLowerCase() : null;
        const activeRole = requestedRole && userRoles.includes(requestedRole) ? requestedRole : (user.role.toLowerCase() || userRoles[0]);

        const token = signToken({ sub: user.id, role: activeRole });
        return send(res, 200, {
          token,
          user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            email: user.email,
            role: activeRole,
            roles: userRoles,
          }
        });
      }
    }

    // Razorpay Webhooks
    if (a === 'webhooks' && id === 'razorpay' && req.method === 'POST') {
      if (!pay.verifyWebhook(req.rawBody ?? '', req.headers['x-razorpay-signature'])) return send(res, 401, { error: 'bad signature' });
      const ev = body.event, pe = body.payload?.payment?.entity, re = body.payload?.refund?.entity;
      if (ev === 'payment.captured' && pe) {
        const bookings = await db.getAllBookings();
        const b = bookings.find((x) => x.order?.id === pe.order_id);
        if (b && b.order?.amount === pe.amount && !b.payment) {
          if (b.status === 'REQUESTED') {
            await db.updateBooking(b.id, { order: { ...b.order, status: 'PAID' } });
            await settlePayment(b, { paymentId: pe.id, method: pe.method ?? 'ONLINE' });
          } else {
            const pmt = { id: pe.id, method: pe.method ?? 'ONLINE', amount: pe.amount / 100, at: new Date().toISOString(), status: 'SUCCESS' };
            await db.updateBooking(b.id, { payment: pmt });
            await startRefund({ ...b, payment: pmt });
          }
        }
      } else if (ev === 'payment.failed' && pe) {
        const bookings = await db.getAllBookings();
        const b = bookings.find((x) => x.order?.id === pe.order_id);
        if (b && b.order?.status === 'CREATED') await db.updateBooking(b.id, { order: { ...b.order, status: 'FAILED' } });
      } else if (ev === 'refund.processed' && re) {
        const bookings = await db.getAllBookings();
        const b = bookings.find((x) => x.refund?.providerRefundId === re.id);
        if (b) await db.updateBooking(b.id, { refund: { ...b.refund, status: 'REFUNDED' } });
      }
      return send(res, 200, { ok: true });
    }

    // Static Uploaded Files
    if (req.method === 'GET' && a === 'files') {
      if (!/^[0-9a-f-]{36}\.(jpg|png|webp|mp4)$/.test(id ?? '')) return send(res, 404, { error: 'not found' });
      const file = path.join(UPLOAD_DIR, id);
      if (!fs.existsSync(file)) return send(res, 404, { error: 'not found' });
      res.writeHead(200, { 'content-type': EXT_MIME[id.split('.')[1]], 'x-content-type-options': 'nosniff', 'cache-control': 'public, max-age=86400' });
      return res.end(fs.readFileSync(file));
    }

    // ==========================================================================
    // 2. AUTHENTICATION GUARD
    // ==========================================================================
    const auth = verifyToken(req.headers.authorization);
    if (!auth) return send(res, 401, { error: 'Please log in to continue' });
    const { role, sub } = auth;

    const me = await db.getUserById(sub);
    if (!me || me.disabled) return send(res, 401, { error: 'Account not found or deactivated' });
    const userRoles = me.roles.map((r) => r.toLowerCase());
    if (!userRoles.includes(role.toLowerCase())) return send(res, 401, { error: 'Role unauthorized. Please log in again.' });

    // Role Switch
    if (req.method === 'POST' && a === 'auth' && id === 'switch') {
      const targetRole = String(body.role ?? '').toLowerCase();
      if (!userRoles.includes(targetRole)) return send(res, 403, { error: 'Role not assigned to your account' });
      return send(res, 200, {
        token: signToken({ sub, role: targetRole }),
        user: { id: me.id, name: me.name, phone: me.phone, email: me.email, role: targetRole, roles: userRoles }
      });
    }

    res.__audit = { role: me.role, userId: sub, action: `${req.method} ${req.url}` };

    // ==========================================================================
    // 3. USER PROFILE & SETTINGS
    // ==========================================================================
    if (a === 'profile') {
      if (req.method === 'GET') {
        const unreadCount = (await db.getNotifications(sub)).filter((n) => !n.read).length;
        return send(res, 200, {
          user: { id: me.id, name: me.name, phone: me.phone, email: me.email ?? '', role, roles: userRoles, city: me.city?.name ?? 'Indore' },
          kyc: me.kycStatus,
          unread: unreadCount,
        });
      }
      if (req.method === 'POST') {
        const name = String(body.name ?? '').trim();
        if (name.length < 2 || name.length > 60) return send(res, 422, { error: 'Enter your name (2–60 letters)' });
        if (body.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) return send(res, 422, { error: 'Enter a valid email' });
        const updated = await db.updateUser(sub, { name, email: body.email ? String(body.email).toLowerCase() : me.email });
        return send(res, 200, { user: { id: updated.id, name: updated.name, phone: updated.phone, email: updated.email } });
      }
    }

    // ==========================================================================
    // 4. PROPERTIES & ROOMS
    // ==========================================================================
    // Tenant: Register Property
    if (a === 'properties' && req.method === 'POST' && !id) {
      need(role, ['tenant']);
      const str = (v, lo, hi) => { const x = String(v ?? '').trim(); return x.length >= lo && x.length <= hi ? x : null; };
      const name = str(body.name, 2, 80), address = str(body.address, 10, 200), locality = str(body.locality, 2, 60), roomName = str(body.roomName, 1, 40), ownerName = str(body.ownerName, 2, 60);
      const rent = +body.rent, total = +body.totalRooms, photos = body.photos ?? [];

      if (!name) return send(res, 422, { error: 'Enter the property name' });
      if (!['PG', 'Flat', 'House', 'Room'].includes(body.type)) return send(res, 422, { error: 'Choose a valid property type' });
      if (!address) return send(res, 422, { error: 'Enter the full address (at least 10 characters)' });
      if (!locality) return send(res, 422, { error: 'Enter the locality' });
      if (!roomName) return send(res, 422, { error: 'Enter your room name or number' });
      if (!Number.isInteger(rent) || rent < 500 || rent > 500000) return send(res, 422, { error: 'Enter monthly rent between ₹500 and ₹5,00,000' });
      if (!Number.isInteger(total) || total < 1 || total > 50) return send(res, 422, { error: 'Total rooms must be between 1 and 50' });
      if (!ownerName) return send(res, 422, { error: 'Enter the owner’s name' });
      if (!validPhone(body.ownerPhone)) return send(res, 422, { error: 'Enter the owner’s 10-digit mobile number' });
      if (body.ownerPhone === me.phone) return send(res, 422, { error: 'The owner’s number must be different from yours' });
      if (body.agentVisit !== true) return send(res, 422, { error: 'An agent visit is needed to verify your property' });
      if (!Array.isArray(photos) || photos.length < 3 || photos.length > 12) return send(res, 422, { error: 'Upload 3 to 12 property photos' });

      // Assign least-loaded agent
      const staff = await db.getStaffUsers();
      const agents = staff.filter((u) => u.roles.includes('AGENT'));
      const agent = agents[0] ?? null;

      const prop = await db.createProperty({
        name,
        address,
        locality,
        type: body.type,
        registeredById: sub,
        ownerName,
        ownerPhone: body.ownerPhone,
        agentId: agent?.id ?? null,
        photos,
        video: body.video ?? null,
        notes: String(body.notes ?? '').slice(0, 500),
      });

      // Create initial tenant room
      const tenantRoom = await db.createRoom({
        propertyId: prop.id,
        name: roomName,
        rent,
        status: 'OCCUPIED',
        tenantId: sub,
        amenities: body.amenities ?? [],
        roomType: body.roomType ?? 'Room',
      });

      // Create remaining rooms
      for (let i = 2; i <= total; i++) {
        await db.createRoom({
          propertyId: prop.id,
          name: `Room ${i}`,
          rent,
          status: 'VERIFICATION_PENDING',
        });
      }

      await db.createTenancy({
        roomId: tenantRoom.id,
        tenantId: sub,
        startedAt: body.movedInOn && !isNaN(+new Date(body.movedInOn)) ? new Date(body.movedInOn) : new Date(),
      });

      notify(sub, 'VERIFICATION', 'Property registered', 'An agent will visit soon to verify it. Your 30% cashback token will unlock after verification.');
      if (agent) notify(agent.id, 'VERIFICATION', 'New verification task', `${name}, ${locality} — please schedule a visit.`);
      notifyRole('admin', 'VERIFICATION', 'New property registered', `${name}, ${locality} by ${me.name}.`);

      return send(res, 201, { property: { id: prop.id, stage: stageOf(prop) } });
    }

    // Tenant: My Registered Properties
    if (a === 'properties' && req.method === 'GET' && id === 'mine') {
      need(role, ['tenant']);
      const props = await db.getPropertiesByRegisteredBy(sub);
      const rows = await Promise.all(props.map(async (p) => {
        const tenantRoom = p.rooms.find((r) => r.tenantId === sub) ?? p.rooms[0];
        const tok = tenantRoom ? await db.getTokenByRoomId(tenantRoom.id) : null;
        return {
          id: p.id,
          name: p.name,
          locality: p.locality,
          status: p.status,
          stage: stageOf(p),
          visit: p.visit,
          visitAt: p.visitAt,
          agent: p.agent?.name?.split(' ')[0] ?? null,
          rooms: p.rooms.length,
          reason: p.notes,
          kyc: me.kycStatus,
          ownerConsent: !!p.ownerConsentAt,
          token: tok ? core.toTenantView(tok) : null,
          expectedToken: tenantRoom ? Math.round(tenantRoom.rent * 0.3) : 0,
          photos: p.photos ?? [],
        };
      }));
      return send(res, 200, { rows });
    }

    // Tenant Home
    if (req.method === 'GET' && a === 'home') {
      need(role, ['tenant']);
      const curRoom = await db.getOccupiedRoomForTenant(sub);
      const myRegistered = await db.getPropertiesByRegisteredBy(sub);
      const myBookings = await db.getBookingsByTenantId(sub);
      const activeBooking = myBookings.find((b) => ['REQUESTED', 'PENDING', 'CONFIRMED'].includes(b.status));
      const tokens = await db.getTokensByTenant(sub);
      const unreadCount = (await db.getNotifications(sub)).filter((n) => !n.read).length;

      return send(res, 200, {
        name: me.name,
        current: curRoom ? {
          roomId: curRoom.id,
          room: curRoom.name,
          property: curRoom.property.name,
          locality: curRoom.property.locality,
          rent: curRoom.rent,
          status: curRoom.status,
          tagReady: !!curRoom.qr,
          checkout: curRoom.checkouts[0]?.state ?? null,
        } : null,
        registered: myRegistered.map((p) => ({ id: p.id, name: p.name, stage: stageOf(p) })),
        booking: activeBooking ? { id: activeBooking.id, status: activeBooking.status, room: activeBooking.room?.name ?? '' } : null,
        wallet: {
          available: tokens.filter((t) => t.state === 'ELIGIBLE' && !t.reservedBy).reduce((s, t) => s + t.amount, 0),
          saved: tokens.filter((t) => t.state === 'DORMANT').reduce((s, t) => s + t.amount, 0),
        },
        unread: unreadCount,
      });
    }

    // Tenant: Public Listings Search
    if (a === 'listings') {
      need(role, ['tenant']);
      const q = new URL(req.url, 'http://x').searchParams;
      if (req.method === 'GET' && !id) {
        const city = q.get('city') ?? 'Indore';
        const from = q.get('lat') && q.get('lng') ? { lat: +q.get('lat'), lng: +q.get('lng') } : null;
        const text = (q.get('q') ?? '').trim().toLowerCase();
        const rooms = await db.getMarketableRooms();

        let rows = rooms.map((r) => card(r, from)).filter((c) =>
          (!text || `${c.title} ${c.locality} ${c.roomType}`.toLowerCase().includes(text)) &&
          (!q.get('type') || c.type === q.get('type')) &&
          (!q.get('minRent') || c.rent >= +q.get('minRent')) &&
          (!q.get('maxRent') || c.rent <= +q.get('maxRent')) &&
          (!q.get('furnished') || c.furnished === q.get('furnished'))
        );

        const sort = q.get('sort') ?? 'relevance';
        if (sort === 'rent_asc') rows.sort((x, y) => x.rent - y.rent);
        else if (sort === 'rent_desc') rows.sort((x, y) => y.rent - x.rent);

        return send(res, 200, { rows, total: rows.length, city });
      }

      if (req.method === 'GET' && id) {
        const r = await db.getRoomById(id);
        if (!r || !marketable(r)) return send(res, 404, { error: 'Room not found or no longer available' });
        const quote = await quoteFor(sub, r, 11);
        return send(res, 200, {
          ...card(r, null),
          address: r.property.address,
          geo: r.property.geoLat ? { lat: r.property.geoLat, lng: r.property.geoLng } : null,
          owner: { firstName: r.property.ownerName.split(' ')[0], verified: true },
          description: `${r.roomType} in ${r.property.name}, ${r.property.locality}. Verified in person by RentalHub.`,
          quote,
        });
      }
    }

    // Tenant: Bookings
    if (a === 'bookings') {
      if (req.method === 'GET' && !id) {
        need(role, ['tenant']);
        const rows = await db.getBookingsByTenantId(sub);
        return send(res, 200, { rows });
      }

      if (req.method === 'POST' && !id) {
        need(role, ['tenant']);
        const r = await db.getRoomById(body.roomId);
        if (!r || !marketable(r)) return send(res, 409, { error: 'This room is no longer available' });
        if (r.tenantId === sub) return send(res, 409, { error: 'You already live in this room' });

        const myBookings = await db.getBookingsByTenantId(sub);
        if (myBookings.some((b) => ['REQUESTED', 'PENDING', 'CONFIRMED'].includes(b.status))) {
          return send(res, 409, { error: 'You already have an active booking in progress' });
        }

        const months = +body.months;
        if (!Number.isInteger(months) || months < 1 || months > 24) return send(res, 422, { error: 'Choose a stay between 1 and 24 months' });
        const d = String(body.moveInDate ?? '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < today()) return send(res, 422, { error: 'Pick a valid move-in date within the next 90 days' });

        const quote = await quoteFor(sub, r, months);
        const booking = await db.createBooking({
          tenantId: sub,
          roomId: r.id,
          moveInDate: new Date(d),
          months,
          quote,
          bookingNumber: quote.bookingNumber,
          status: 'REQUESTED',
          history: [{ status: 'REQUESTED', at: new Date().toISOString() }],
        });

        return send(res, 201, { booking });
      }

      if (id) {
        const b = await db.getBookingById(id);
        if (!b) return send(res, 404, { error: 'Booking not found' });
        if (role === 'tenant' && b.tenantId !== sub) forbid();

        if (req.method === 'GET') return send(res, 200, { booking: b });

        // Payment step 1: create order
        if (action === 'pay' && action2 === 'start') {
          need(role, ['tenant']);
          if (b.status !== 'REQUESTED') return send(res, 409, { error: 'Booking is already paid or closed' });
          const room = await db.getRoomById(b.roomId);
          if (!room || !marketable(room)) return send(res, 409, { error: 'Room is no longer available' });

          const amount = (b.quote?.payable ?? room.rent) * 100;
          try {
            const o = await pay.createOrder({ amount, receipt: b.id, notes: { booking: b.id } });
            await db.updateBooking(b.id, { order: { id: o.id, amount: o.amount, status: 'CREATED' } });
            return send(res, 200, { provider: pay.name, keyId: pay.keyId, orderId: o.id, amount: o.amount, currency: 'INR', bookingId: b.id });
          } catch (e) {
            return send(res, 502, { error: 'Payment gateway error: ' + e.message });
          }
        }

        // Payment step 2: confirm order
        if (action === 'pay' && action2 === 'confirm') {
          need(role, ['tenant']);
          if (!pay.verifyPayment({ orderId: body.orderId, paymentId: body.paymentId, signature: body.signature })) {
            return send(res, 400, { error: 'Payment signature verification failed' });
          }
          await db.updateBooking(b.id, { order: { ...b.order, status: 'PAID' } });
          const r = await settlePayment(b, { paymentId: body.paymentId, method: body.method ?? 'ONLINE' });
          return send(res, r.conflict ? 409 : 200, { booking: await db.getBookingById(b.id) });
        }

        // Booking confirmation by admin/agent
        if (action === 'confirm') {
          need(role, ['admin', 'agent']);
          if (b.status !== 'PENDING') return send(res, 409, { error: 'Only paid bookings can be confirmed' });
          const history = Array.isArray(b.history) ? [...b.history, { status: 'CONFIRMED', at: new Date().toISOString() }] : [];
          const updated = await db.updateBooking(b.id, { status: 'CONFIRMED', history });
          notify(b.tenantId, 'BOOKING', 'Booking confirmed', 'Your room is confirmed!');
          return send(res, 200, { booking: updated });
        }

        // Booking cancellation
        if (action === 'cancel') {
          need(role, ['tenant']);
          if (!['REQUESTED', 'PENDING', 'CONFIRMED'].includes(b.status)) return send(res, 409, { error: 'Booking cannot be cancelled' });
          await startRefund(b);
          const history = Array.isArray(b.history) ? [...b.history, { status: 'CANCELLED', at: new Date().toISOString() }] : [];
          const updated = await db.updateBooking(b.id, { status: 'CANCELLED', history });
          return send(res, 200, { booking: updated });
        }
      }
    }

    // Tenant: Wallet
    if (req.method === 'GET' && a === 'wallet') {
      need(role, ['tenant']);
      const tokens = await db.getTokensByTenant(sub);
      const sum = (fn) => tokens.filter(fn).reduce((s, t) => s + t.amount, 0);
      return send(res, 200, {
        available: sum((t) => t.state === 'ELIGIBLE' && !t.reservedBy),
        pending: sum((t) => t.reservedBy && t.state !== 'REDEEMED'),
        locked: sum((t) => t.state === 'DORMANT'),
        redeemed: sum((t) => t.state === 'REDEEMED'),
        total: sum(() => true),
        tokens: tokens.map((t) => ({ ...core.toTenantView(t), reserved: !!t.reservedBy, from: `${t.property?.name ?? ''}, ${t.room?.name ?? ''}` })),
      });
    }

    // Tenant: Saved Rooms
    if (a === 'saved') {
      need(role, ['tenant']);
      if (req.method === 'POST' && id) {
        const saved = await db.toggleSavedRoom(sub, id);
        return send(res, 200, { saved });
      }
      if (req.method === 'GET') {
        const savedRecords = await db.getSavedRooms(sub);
        return send(res, 200, {
          ids: savedRecords.map((r) => r.roomId),
          rows: savedRecords.map((r) => card(r.room, null)),
        });
      }
    }

    // Owner: Dashboard & Property Management
    if (a === 'owner') {
      need(role, ['owner']);
      if (id === 'dashboard') {
        const myProps = await db.getPropertiesByOwnerId(sub);
        const myComms = await db.getCommissionsByOwner(sub);
        const allRooms = myProps.flatMap((p) => p.rooms);
        const occupied = allRooms.filter((r) => r.status === 'OCCUPIED').length;
        const vacant = allRooms.filter((r) => ['AVAILABLE', 'VACANT'].includes(r.status)).length;
        const due = myComms.filter((c) => c.status === 'DUE').reduce((s, c) => s + c.amount, 0);
        const paid = myComms.filter((c) => c.status === 'PAID').reduce((s, c) => s + c.amount, 0);

        return send(res, 200, {
          spine: { properties: myProps.length, rooms: allRooms.length, occupied, vacant, inPlacement: vacant },
          commission: { potential: 0, due, paid, waived: 0 },
          rooms: allRooms,
          ledger: myComms,
        });
      }

      if (id === 'properties') {
        const props = await db.getPropertiesByOwnerId(sub);
        return send(res, 200, { rows: props });
      }
    }

    // Notifications
    if (a === 'notifications') {
      if (req.method === 'GET') {
        const rows = await db.getNotifications(sub);
        return send(res, 200, { rows, unread: rows.filter((r) => !r.read).length });
      }
      if (req.method === 'POST' && id === 'read') {
        await db.markNotificationsRead(sub, body.id ?? null);
        return send(res, 200, { ok: true });
      }
      if (req.method === 'POST' && (id === 'token' || id === 'device')) {
        const token = String(body.token ?? body.fcmToken ?? '').trim();
        if (token) await db.registerDeviceToken(sub, token);
        return send(res, 200, { ok: true });
      }
    }

    // Uploads
    if (req.method === 'POST' && a === 'uploads') {
      const ext = MIME[body.contentType];
      if (!ext) return send(res, 415, { error: 'Only JPG, PNG, WebP photos and MP4 videos are allowed' });
      const buf = Buffer.from(String(body.data ?? ''), 'base64');
      const max = ext === 'mp4' ? 25e6 : 5e6;
      if (!buf.length) return send(res, 422, { error: 'Empty file' });
      if (buf.length > max) return send(res, 413, { error: 'File size exceeds allowed limit' });
      if (!SIGS[ext](buf)) return send(res, 415, { error: 'File content verification failed' });

      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      const fid = crypto.randomUUID() + '.' + ext;
      fs.writeFileSync(path.join(UPLOAD_DIR, fid), buf);
      return send(res, 200, { ref: '/files/' + fid, bytes: buf.length });
    }

    // Admin & Staff Management
    if (a === 'admin') {
      need(role, ['admin']);
      if (id === 'overview') {
        const users = await db.getAllUsers();
        const props = await db.getAllProperties();
        const bookings = await db.getAllBookings();
        return send(res, 200, {
          counts: {
            users: users.length,
            properties: props.length,
            bookings: bookings.length,
          }
        });
      }
      if (id === 'users') {
        const rows = await db.getAllUsers();
        return send(res, 200, { rows });
      }
      if (id === 'properties') {
        const rows = await db.getAllProperties();
        return send(res, 200, { rows });
      }
      if (id === 'bookings') {
        const rows = await db.getAllBookings();
        return send(res, 200, { rows });
      }
    }

    send(res, 404, { error: 'Resource not found' });
  } catch (e) {
    if (!res.headersSent) send(res, typeof e.code === 'number' ? e.code : 500, { error: e.message });
  }
});

// Server Initialization
if (process.argv[1]?.endsWith('server.js')) {
  console.log('[startup] Connecting to PostgreSQL database via Prisma...');
  try {
    await db.verifyDbConnection();
    console.log('[startup] PostgreSQL connected successfully.');
  } catch (err) {
    console.error('[startup] FATAL: Could not connect to PostgreSQL database:', err.message);
    process.exit(1);
  }

  // Bootstrap initial platform admin if configured
  if (process.env.BOOTSTRAP_ADMIN_PHONE) {
    try {
      const admin = await db.bootstrapAdminIfNeeded({
        phone: process.env.BOOTSTRAP_ADMIN_PHONE,
        name: process.env.BOOTSTRAP_ADMIN_NAME,
      });
      console.log(`[startup] Bootstrap admin ready: ${admin.phone}`);
    } catch (e) {
      console.warn('[startup] Bootstrap admin notice:', e.message);
    }
  }

  const port = Number(process.env.PORT ?? 4000);
  server.listen(port, () => console.log(`RentalHub API running on port ${port} (PostgreSQL + Prisma)`));

  // Background cleanup
  setInterval(() => {
    retryRefunds().catch((e) => console.error('[refunds]', e));
    purgeKycDocs().catch((e) => console.error('[kyc purge]', e));
  }, 5 * 60e3).unref();

  const shutdown = async (sig) => {
    console.log(`[shutdown] ${sig}: closing server and database...`);
    server.close();
    try { await db.getPrisma().$disconnect(); } catch {}
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
