import { signToken } from './src/auth.js';
// Fixture identities that match the seed data in server.js
const IDS = { tenant: 't1', owner: 'o1', agent: 'a1', admin: 'admin1' };
export const tokenFor = (role, sub = IDS[role]) => signToken({ sub, role });
export const H = (role, sub) => ({ authorization: 'Bearer ' + tokenFor(role, sub) });
