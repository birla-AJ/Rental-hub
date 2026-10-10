// RentalHub Prisma Database Repository Layer
// PostgreSQL is the single source of truth for all business data.

import { PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword } from './passwords.js';

let prismaInstance = null;

export function getPrisma() {
  if (!prismaInstance) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set. A PostgreSQL database is required for RentalHub.');
    }
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prismaInstance;
}

export const prisma = new Proxy({}, {
  get(target, prop) {
    return getPrisma()[prop];
  }
});

/** Verify database connection on startup */
export async function verifyDbConnection() {
  const client = getPrisma();
  await client.$connect();
  return true;
}

// ==============================================================================
// 1. Users & Authentication
// ==============================================================================

export async function getUserById(id) {
  if (!id) return null;
  return prisma.user.findUnique({
    where: { id },
    include: { city: true }
  });
}

export async function getUserByPhone(phone) {
  if (!phone) return null;
  return prisma.user.findUnique({
    where: { phone },
    include: { city: true }
  });
}

export async function getUserByEmail(email) {
  if (!email) return null;
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { city: true }
  });
}

export async function getUserByIdentifier(identifier) {
  if (!identifier) return null;
  const clean = String(identifier).trim();
  const byPhone = await getUserByPhone(clean);
  if (byPhone) return byPhone;
  const byEmail = await getUserByEmail(clean);
  if (byEmail) return byEmail;
  return getUserById(clean);
}

export async function createUser({ name, phone, email, password, role = 'TENANT', city = 'Indore' }) {
  if (!name || !phone || !password) {
    throw new Error('Name, phone, and password are required');
  }

  // Check unique constraints
  const existingPhone = await getUserByPhone(phone);
  if (existingPhone) {
    throw new Error('An account with this mobile number already exists');
  }
  if (email) {
    const existingEmail = await getUserByEmail(email);
    if (existingEmail) {
      throw new Error('An account with this email address already exists');
    }
  }

  const { hash, salt } = hashPassword(password);
  const primaryRole = role.toUpperCase();
  const rolesArray = [primaryRole];

  // Link or find city
  let cityRecord = await prisma.city.findUnique({ where: { name: city } });
  if (!cityRecord) {
    cityRecord = await prisma.city.create({ data: { name: city, active: true } });
  }

  return prisma.user.create({
    data: {
      name,
      phone,
      email: email ? email.toLowerCase() : null,
      passwordHash: hash,
      passwordSalt: salt,
      role: primaryRole,
      roles: rolesArray,
      kycStatus: 'NOT_STARTED',
      cityId: cityRecord.id,
    },
    include: { city: true }
  });
}

export async function updateUser(id, data) {
  return prisma.user.update({
    where: { id },
    data,
    include: { city: true }
  });
}

export async function getStaffUsers() {
  return prisma.user.findMany({
    where: {
      roles: { hasSome: ['ADMIN', 'AGENT'] }
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getAllUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: 'desc' }
  });
}

export async function bootstrapAdminIfNeeded({ phone, name = 'Platform Admin', password }) {
  if (!phone) return null;
  const existingAdmin = await prisma.user.findFirst({
    where: { roles: { has: 'ADMIN' }, disabled: false }
  });
  if (existingAdmin) return existingAdmin;

  const existingPhone = await getUserByPhone(phone);
  if (existingPhone) {
    const updatedRoles = [...new Set([...existingPhone.roles, 'ADMIN'])];
    return prisma.user.update({
      where: { id: existingPhone.id },
      data: { role: 'ADMIN', roles: updatedRoles, disabled: false }
    });
  }

  // Create new admin
  const pwd = password || 'admin@rentalhub2026';
  const { hash, salt } = hashPassword(pwd);
  return prisma.user.create({
    data: {
      name,
      phone,
      passwordHash: hash,
      passwordSalt: salt,
      role: 'ADMIN',
      roles: ['ADMIN'],
      kycStatus: 'VERIFIED'
    }
  });
}

// ==============================================================================
// 2. Properties & Rooms
// ==============================================================================

export async function getPropertyById(id) {
  if (!id) return null;
  return prisma.property.findUnique({
    where: { id },
    include: {
      rooms: { include: { qr: true } },
      registeredBy: true,
      owner: true,
      agent: true,
      city: true,
      tokens: true,
    }
  });
}

export async function getAllProperties(filters = {}) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.cityId) where.cityId = filters.cityId;
  if (filters.agentId) where.agentId = filters.agentId;
  if (filters.registeredById) where.registeredById = filters.registeredById;

  return prisma.property.findMany({
    where,
    include: {
      rooms: { include: { qr: true } },
      registeredBy: true,
      owner: true,
      agent: true,
      city: true,
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getPropertiesByRegisteredBy(userId) {
  return prisma.property.findMany({
    where: { registeredById: userId },
    include: { rooms: { include: { qr: true } }, agent: true, tokens: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getPropertiesByOwnerId(ownerId) {
  return prisma.property.findMany({
    where: { ownerId },
    include: { rooms: { include: { qr: true } } },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getPropertiesByOwnerPhone(phone) {
  return prisma.property.findMany({
    where: { ownerPhone: phone },
    include: { rooms: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function createProperty(data) {
  return prisma.property.create({
    data,
    include: { rooms: true }
  });
}

export async function updateProperty(id, data) {
  return prisma.property.update({
    where: { id },
    data,
    include: { rooms: true }
  });
}

// Rooms
export async function getRoomById(id) {
  if (!id) return null;
  return prisma.room.findUnique({
    where: { id },
    include: {
      property: true,
      qr: true,
      tenancies: { include: { tenant: true } },
      checkouts: true,
      windows: true,
      commissions: true,
      tokens: true,
      bookings: true,
    }
  });
}

export async function getMarketableRooms(filters = {}) {
  const where = {
    status: { in: ['AVAILABLE', 'VACANT'] },
    property: {
      agentTask: 'VERIFIED',
      ownerConsentAt: { not: null }
    }
  };

  return prisma.room.findMany({
    where,
    include: {
      property: true,
      qr: true,
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getOccupiedRoomForTenant(tenantId) {
  return prisma.room.findFirst({
    where: {
      tenantId,
      status: { in: ['OCCUPIED', 'CHECKOUT_REQUESTED', 'VERIFICATION_PENDING'] }
    },
    include: { property: true, qr: true, checkouts: true }
  });
}

export async function createRoom(data) {
  return prisma.room.create({
    data,
    include: { qr: true }
  });
}

export async function updateRoom(id, data) {
  return prisma.room.update({
    where: { id },
    data,
    include: { property: true, qr: true }
  });
}

// QR Tags
export async function assignQrTag(roomId, code) {
  return prisma.qrTag.upsert({
    where: { roomId },
    create: { roomId, code, status: 'ACTIVE' },
    update: { code, status: 'ACTIVE' }
  });
}

export async function getQrTag(roomId) {
  return prisma.qrTag.findUnique({ where: { roomId } });
}

// ==============================================================================
// 3. Tenancies, Bookings & Payments
// ==============================================================================

export async function createTenancy({ roomId, tenantId, startedAt = new Date() }) {
  return prisma.tenancy.create({
    data: { roomId, tenantId, startedAt }
  });
}

export async function endActiveTenancy(roomId, tenantId, endedAt = new Date()) {
  const active = await prisma.tenancy.findFirst({
    where: { roomId, tenantId, endedAt: null },
    orderBy: { startedAt: 'desc' }
  });
  if (active) {
    return prisma.tenancy.update({
      where: { id: active.id },
      data: { endedAt }
    });
  }
  return null;
}

export async function getTenanciesByTenant(tenantId) {
  return prisma.tenancy.findMany({
    where: { tenantId },
    include: { room: { include: { property: true } } },
    orderBy: { startedAt: 'desc' }
  });
}

export async function createBooking(data) {
  return prisma.booking.create({
    data,
    include: { room: { include: { property: true } } }
  });
}

export async function getBookingById(id) {
  return prisma.booking.findUnique({
    where: { id },
    include: { room: { include: { property: true } } }
  });
}

export async function getBookingsByTenantId(tenantId) {
  return prisma.booking.findMany({
    where: { tenantId },
    include: { room: { include: { property: true } } },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getAllBookings() {
  return prisma.booking.findMany({
    include: { room: { include: { property: true } }, tenant: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function updateBooking(id, data) {
  return prisma.booking.update({
    where: { id },
    data,
    include: { room: { include: { property: true } } }
  });
}

// ==============================================================================
// 4. Checkouts, Vacancy & Commissions
// ==============================================================================

export async function getCheckoutByRoomId(roomId) {
  return prisma.checkout.findFirst({
    where: { roomId },
    orderBy: { createdAt: 'desc' },
    include: { events: true }
  });
}

export async function createCheckout(data) {
  return prisma.checkout.create({
    data,
    include: { events: true }
  });
}

export async function updateCheckout(id, data) {
  return prisma.checkout.update({
    where: { id },
    data,
    include: { events: true }
  });
}

export async function addCheckoutEvent({ checkoutId, event, channel, detail }) {
  return prisma.checkoutEvent.create({
    data: { checkoutId, event, channel, detail }
  });
}

// Vacancy Windows
export async function getVacancyWindow(roomId) {
  return prisma.vacancyWindow.findFirst({
    where: { roomId, closedAt: null },
    orderBy: { startedAt: 'desc' }
  });
}

export async function createVacancyWindow({ roomId, startedAt, endsAt }) {
  return prisma.vacancyWindow.create({
    data: { roomId, startedAt, endsAt }
  });
}

export async function closeVacancyWindow(roomId, closedAt = new Date()) {
  const active = await getVacancyWindow(roomId);
  if (active) {
    return prisma.vacancyWindow.update({
      where: { id: active.id },
      data: { closedAt }
    });
  }
  return null;
}

// Commissions
export async function createCommission(data) {
  return prisma.commission.create({ data });
}

export async function getCommissionsByOwner(ownerId) {
  return prisma.commission.findMany({
    where: { ownerId },
    include: { room: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getAllCommissions() {
  return prisma.commission.findMany({
    include: { room: true, owner: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function updateCommission(id, data) {
  return prisma.commission.update({
    where: { id },
    data
  });
}

// ==============================================================================
// 5. Cashback Tokens
// ==============================================================================

export async function getTokensByTenant(tenantId) {
  return prisma.cashbackToken.findMany({
    where: { tenantId },
    include: { property: true, room: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getTokenByRoomId(roomId) {
  return prisma.cashbackToken.findFirst({
    where: { roomId },
    orderBy: { createdAt: 'desc' }
  });
}

export async function createCashbackToken(data) {
  return prisma.cashbackToken.create({ data });
}

export async function updateCashbackToken(id, data) {
  return prisma.cashbackToken.update({ where: { id }, data });
}

// ==============================================================================
// 6. Notifications, KYC, Saved & Devices
// ==============================================================================

export async function getNotifications(userId) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
}

export async function createNotification({ userId, type = 'SYSTEM', title, body }) {
  return prisma.notification.create({
    data: { userId, type, title, body }
  });
}

export async function markNotificationsRead(userId, notificationId = null) {
  const where = { userId };
  if (notificationId) where.id = notificationId;
  return prisma.notification.updateMany({
    where,
    data: { read: true, readAt: new Date() }
  });
}

export async function registerDeviceToken(userId, token) {
  return prisma.deviceToken.upsert({
    where: { token },
    create: { userId, token },
    update: { userId }
  });
}

export async function getDeviceTokens(userId) {
  const records = await prisma.deviceToken.findMany({
    where: { userId },
    select: { token: true }
  });
  return records.map((r) => r.token);
}

// Saved Rooms
export async function getSavedRooms(userId) {
  return prisma.savedRoom.findMany({
    where: { userId },
    include: { room: { include: { property: true, qr: true } } },
    orderBy: { createdAt: 'desc' }
  });
}

export async function toggleSavedRoom(userId, roomId) {
  const existing = await prisma.savedRoom.findUnique({
    where: { userId_roomId: { userId, roomId } }
  });
  if (existing) {
    await prisma.savedRoom.delete({ where: { id: existing.id } });
    return false; // un-saved
  } else {
    await prisma.savedRoom.create({ data: { userId, roomId } });
    return true; // saved
  }
}

// KYC
export async function getKycHistory(userId) {
  return prisma.kycRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' }
  });
}

export async function submitKyc({ userId, idType, fullName, dob, docRef }) {
  await prisma.kycRecord.create({
    data: { userId, idType, fullName, dob, docRef, status: 'PENDING' }
  });
  return prisma.user.update({
    where: { id: userId },
    data: { kycStatus: 'PENDING' }
  });
}

export async function reviewKyc({ userId, status, verifiedBy, reason }) {
  const latest = await prisma.kycRecord.findFirst({
    where: { userId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' }
  });
  if (latest) {
    await prisma.kycRecord.update({
      where: { id: latest.id },
      data: { status, verifiedBy, reason, reviewedAt: new Date() }
    });
  }
  return prisma.user.update({
    where: { id: userId },
    data: { kycStatus: status }
  });
}

// Private Files
export async function createPrivateFile({ id, ownerId, kind = 'kyc', ext }) {
  return prisma.privateFile.create({
    data: { id, ownerId, kind, ext }
  });
}

export async function getPrivateFile(id) {
  return prisma.privateFile.findUnique({ where: { id } });
}

export async function deletePrivateFile(id) {
  return prisma.privateFile.delete({ where: { id } }).catch(() => null);
}

// Audit Logs
export async function createAuditLog({ userId, role, action, entity, entityId }) {
  return prisma.auditLog.create({
    data: { userId, role, action, entity, entityId }
  }).catch((e) => console.warn('[audit] failed:', e.message));
}

export async function getAuditLogs(take = 100) {
  return prisma.auditLog.findMany({
    orderBy: { at: 'desc' },
    take
  });
}

