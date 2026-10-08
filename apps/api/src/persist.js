// Durable storage for the API's working data. The domain code keeps working on plain in-memory objects (`db`);
// this module loads them at startup and saves every change BEFORE the API answers a state-changing request.
//
//   DATABASE_URL=postgres://...  -> PostgreSQL (needs `npm i pg`)        — recommended for production
//   SQLITE_PATH=./data/app.db    -> SQLite file (Node 22 built-in)       — fine for a single-server pilot
//   neither                      -> memory only (data lost on restart)   — dev/tests; refused in production
//
// IMPORTANT: this is a single-writer design — run ONE API instance. Scaling out / reporting on the data needs the
// relational Prisma schema (prisma/schema.prisma) and a repository layer; see README "Persistence".

// collection name -> how it is held in `db`
export const COLLECTIONS = {
  properties: 'map', rooms: 'map', tokens: 'map', qr: 'map', windows: 'map', checkouts: 'map', bookings: 'map', kyc: 'map', saved: 'map', conversations: 'map', privateFiles: 'map', devices: 'map',
  users: 'list', commissions: 'list', tenancies: 'list',
  notifications: 'list-desc', audit: 'list-desc',   // newest first in memory
};

const entries = (db, coll) => {
  const kind = COLLECTIONS[coll], v = db[coll];
  if (kind === 'map') return Object.entries(v);
  return v.map((item) => { if (!item || item.id == null) throw new Error(`persist: every item in "${coll}" needs an id`); return [String(item.id), item]; });
};

export function createStore(adapter, db) {
  const last = new Map();            // "coll\u0000key" -> { json, seq }
  let seq = 0, chain = Promise.resolve();

  async function load() {
    const rows = await adapter.loadAll();
    if (!rows.length) return false;
    const by = {}; for (const r of rows) { (by[r.coll] ??= []).push(r); seq = Math.max(seq, r.seq); last.set(r.coll + '\u0000' + r.key, { json: JSON.stringify(r.data), seq: r.seq }); }
    for (const coll of Object.keys(COLLECTIONS)) {
      const rs = (by[coll] ?? []).sort((a, b) => a.seq - b.seq), kind = COLLECTIONS[coll];
      if (kind === 'map') { for (const k of Object.keys(db[coll])) delete db[coll][k]; for (const r of rs) db[coll][r.key] = r.data; }
      else { db[coll].length = 0; for (const r of kind === 'list-desc' ? rs.reverse() : rs) db[coll].push(r.data); }
    }
    return true;
  }

  async function doFlush() {
    const upserts = [], seen = new Set();
    for (const coll of Object.keys(COLLECTIONS)) for (const [key, data] of entries(db, coll)) {
      const id = coll + '\u0000' + key, json = JSON.stringify(data); seen.add(id);
      const prev = last.get(id);
      if (!prev || prev.json !== json) upserts.push({ coll, key, seq: prev?.seq ?? ++seq, data, json, id });
    }
    const deletes = [...last.keys()].filter((id) => !seen.has(id)).map((id) => { const [coll, key] = id.split('\u0000'); return { coll, key, id }; });
    if (!upserts.length && !deletes.length) return { upserts: 0, deletes: 0 };
    await adapter.apply({ upserts: upserts.map(({ coll, key, seq, data }) => ({ coll, key, seq, data })), deletes: deletes.map(({ coll, key }) => ({ coll, key })) });
    for (const u of upserts) last.set(u.id, { json: u.json, seq: u.seq });       // only after the database accepted the transaction
    for (const d of deletes) last.delete(d.id);
    return { upserts: upserts.length, deletes: deletes.length };
  }
  // Saves are serialised; a failed save rejects only that caller and the next flush retries everything that is still dirty.
  const flush = () => { const run = chain.then(doFlush); chain = run.catch(() => {}); return run; };
  return { load, flush, close: () => adapter.close?.() };
}

// ---------- adapters ----------
export async function sqliteAdapter(file) {
  const { DatabaseSync } = await import('node:sqlite');
  const fs = await import('node:fs'), path = await import('node:path');
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const d = new DatabaseSync(file);
  d.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS docs (coll TEXT NOT NULL, key TEXT NOT NULL, seq INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (coll, key))');
  const up = d.prepare('INSERT INTO docs (coll, key, seq, data) VALUES (?, ?, ?, ?) ON CONFLICT (coll, key) DO UPDATE SET data = excluded.data'), del = d.prepare('DELETE FROM docs WHERE coll = ? AND key = ?');
  return {
    async loadAll() { return d.prepare('SELECT coll, key, seq, data FROM docs').all().map((r) => ({ ...r, seq: Number(r.seq), data: JSON.parse(r.data) })); },
    async apply({ upserts, deletes }) {
      d.exec('BEGIN');
      try { for (const u of upserts) up.run(u.coll, u.key, u.seq, JSON.stringify(u.data)); for (const x of deletes) del.run(x.coll, x.key); d.exec('COMMIT'); }
      catch (e) { d.exec('ROLLBACK'); throw e; }
    },
    close() { d.close(); },
  };
}

export async function postgresAdapter(url) {
  let pg; try { pg = await import('pg'); } catch { throw new Error('DATABASE_URL is set but the "pg" package is not installed. Run: npm i pg'); }
  const pool = new (pg.default?.Pool ?? pg.Pool)({ connectionString: url });
  await pool.query('CREATE TABLE IF NOT EXISTS docs (coll text NOT NULL, key text NOT NULL, seq bigint NOT NULL, data jsonb NOT NULL, PRIMARY KEY (coll, key))');
  return {
    async loadAll() { return (await pool.query('SELECT coll, key, seq, data FROM docs')).rows.map((r) => ({ ...r, seq: Number(r.seq) })); },
    async apply({ upserts, deletes }) {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        for (const u of upserts) await c.query('INSERT INTO docs (coll, key, seq, data) VALUES ($1, $2, $3, $4) ON CONFLICT (coll, key) DO UPDATE SET data = EXCLUDED.data', [u.coll, u.key, u.seq, JSON.stringify(u.data)]);
        for (const x of deletes) await c.query('DELETE FROM docs WHERE coll = $1 AND key = $2', [x.coll, x.key]);
        await c.query('COMMIT');
      } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
    },
    close() { return pool.end(); },
  };
}

/** Pick storage from the environment, load existing data (or save the seed data on first run). */
export async function createPersistence(db, env = process.env) {
  let adapter = null;
  if (env.DATABASE_URL) adapter = await postgresAdapter(env.DATABASE_URL);
  else if (env.SQLITE_PATH) adapter = await sqliteAdapter(env.SQLITE_PATH);
  if (!adapter) {
    if (env.NODE_ENV === 'production') throw new Error('Set DATABASE_URL (or SQLITE_PATH) — refusing to run in production without durable storage');
    console.warn('[storage] memory only: data is lost when the server stops. Set SQLITE_PATH or DATABASE_URL to keep it.');
    return { flush: async () => ({ upserts: 0, deletes: 0 }), durable: false };
  }
  const store = createStore(adapter, db);
  const existed = await store.load();
  if (!existed) await store.flush();               // first run: persist the seed/demo data
  return { ...store, durable: true, existed };
}
