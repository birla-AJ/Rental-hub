// Secure password hashing using Node.js native crypto scrypt (NIST / RFC 7914 standard)
import crypto from 'node:crypto';

/**
 * Hash a password using scrypt with a unique random salt
 * @param {string} password 
 * @returns {{ hash: string, salt: string }}
 */
export function hashPassword(password) {
  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

/**
 * Verify a password against stored scrypt hash and salt
 * @param {string} password 
 * @param {string} hash 
 * @param {string} salt 
 * @returns {boolean}
 */
export function verifyPassword(password, hash, salt) {
  if (!password || !hash || !salt) return false;
  try {
    const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(testHash, 'hex');
    const b = Buffer.from(hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

