import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { H } from '../test-helpers.mjs';

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/server.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rh-restart-'));
const env = { ...process.env, SQLITE_PATH: path.join(dir, 'app.db'), PORT: '0', NODE_ENV: 'development' };

function start() {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['--no-warnings', SERVER], { env }); let out = '';
    p.stdout.on('data', (d) => { out += d; const m = /API on :(\d+) \((.+)\)/.exec(out); if (m) resolve({ p, base: `http://localhost:${m[1]}`, mode: m[2] }); });
    p.stderr.on('data', (d) => (out += d)); p.on('exit', () => reject(new Error('server exited early: ' + out)));
    setTimeout(() => { p.kill('SIGKILL'); reject(new Error('server did not start: ' + out)); }, 8000).unref();
  });
}
const stop = (s) => new Promise((r) => { s.p.removeAllListeners('exit'); s.p.on('exit', r); s.p.kill('SIGKILL'); });   // SIGKILL = a crash, not a polite shutdown
const call = async (s, m, p, who, body) => { const r = await fetch(s.base + p, { method: m, headers: { 'content-type': 'application/json', ...H(...who) }, body: body && JSON.stringify(body) }); return { status: r.status, ...(await r.json()) }; };
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('data survives a hard crash and restart; ids keep counting; seed data is not re-created', async () => {
  const soon = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  let s = await start(); assert.equal(s.mode, 'durable storage');
  await call(s, 'POST', '/profile', ['tenant', 't2'], { name: 'Neha Renamed' });
  await call(s, 'POST', '/saved/r6', ['tenant', 't1']);
  const b = (await call(s, 'POST', '/bookings', ['tenant', 't2'], { roomId: 'r9', moveInDate: soon, months: 6 })).booking;
  await call(s, 'POST', `/bookings/${b.id}/pay`, ['tenant', 't2'], {});
  const unread = (await call(s, 'GET', '/notifications', ['tenant', 't2'])).unread; assert.ok(unread >= 1);
  const auditBefore = (await call(s, 'GET', '/admin/audit', ['admin'])).rows.length; assert.ok(auditBefore >= 3);
  await stop(s);                                                                      // crash

  s = await start();
  assert.equal((await call(s, 'GET', '/profile', ['tenant', 't2'])).user.name, 'Neha Renamed');
  assert.deepEqual((await call(s, 'GET', '/saved', ['tenant', 't1'])).ids, ['r6']);
  const again = (await call(s, 'GET', `/bookings/${b.id}`, ['tenant', 't2'])).booking; assert.equal(again.status, 'PENDING'); assert.equal(again.payment.amount, 5500);
  assert.equal((await call(s, 'GET', '/listings/r9', ['tenant', 't1'])).status, 404);              // room is still held by the booking
  assert.equal((await call(s, 'GET', '/notifications', ['tenant', 't2'])).unread, unread);
  assert.equal((await call(s, 'GET', '/admin/audit', ['admin'])).rows.length, auditBefore);       // audit entries were saved with the changes
  // new records after restart don't collide with old ids
  await call(s, 'POST', `/bookings/${b.id}/cancel`, ['tenant', 't2']);
  const b2 = (await call(s, 'POST', '/bookings', ['tenant', 't3'], { roomId: 'r10', moveInDate: soon, months: 3 })).booking; assert.notEqual(b2.id, b.id);
  const ids = (await call(s, 'GET', '/notifications', ['admin'])).rows.map((n) => n.id); assert.equal(new Set(ids).size, ids.length);
  assert.equal((await call(s, 'GET', '/admin/users', ['admin'])).rows.length, 9);                  // 9 seed users, none duplicated by the restart
  await stop(s);
});
