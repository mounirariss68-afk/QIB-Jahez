/**
 * PostgreSQL access, the one file that knows where the database is. On Replit
 * the database comes from the Replit prompt and its URL arrives as
 * DATABASE_URL. Without it (the owner's Mac) the server uses a built-in
 * PostgreSQL (PGlite) kept in `.data/` at the repo root.
 * Two schemas: `core` (the simulated bank) and `layer` (Jahiz). One bank, so
 * no schema routing (unlike Tasama HR's multi-client layout).
 */
import pg from 'pg';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Dates come back as 'YYYY-MM-DD' strings, numerics as JS numbers, with either driver.
const PARSERS = { 1082: (v: string) => v, 1700: (v: string) => (v === null ? null : Number(v)), 20: (v: string) => (v === null ? null : Number(v)) };

/** The built-in database: one connection, so transactions are taken one at a time. */
async function builtIn(): Promise<pg.Pool> {
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.data/pglite');
  mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir, { parsers: PARSERS as any });
  const run = async (sql: string, params?: unknown[]) => {
    try { const r = await db.query(sql, params as any[]); return { rows: r.rows as any[], rowCount: r.affectedRows ?? r.rows.length }; }
    catch (e: any) {
      // A script of several statements (the schema) runs as one exec.
      if (!params?.length && /multiple commands/i.test(String(e?.message))) { await db.exec(sql); return { rows: [], rowCount: 0 }; }
      throw e;
    }
  };
  let lock: Promise<void> = Promise.resolve();
  return {
    query: run,
    connect: async () => {
      let free!: () => void;
      const prev = lock;
      lock = new Promise<void>((r) => { free = r; });
      await prev;
      return { query: run, release: () => free() };
    },
    end: () => db.close(),
  } as unknown as pg.Pool;
}

const url = process.env.DATABASE_URL;
if (url) {
  pg.types.setTypeParser(1082, PARSERS[1082]);
  pg.types.setTypeParser(1700, PARSERS[1700] as any);
  pg.types.setTypeParser(20, PARSERS[20] as any);
} else {
  console.log('DATABASE_URL is not set: using the built-in database in .data/ (on Replit the database comes from the Replit prompt).');
}
const needsSsl = /neon\.tech|replit|sslmode=require/.test(url ?? '');
export const pool: pg.Pool = url ? new pg.Pool({ connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : undefined, max: 10 }) : await builtIn();

export type Q = { query: <T = any>(sql: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount: number | null }> };

export async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> { return (await pool.query(sql, params)).rows as T[]; }
export async function one<T = any>(sql: string, params: unknown[] = []): Promise<T | undefined> { return (await pool.query(sql, params)).rows[0] as T | undefined; }

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const out = await fn(c); await c.query('COMMIT'); return out; }
  catch (e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
}

/** Bulk insert helper: rows of objects with identical keys. */
export async function insertMany(c: Q, table: string, rows: Record<string, unknown>[], returning = '') {
  if (!rows.length) return [] as any[];
  const cols = Object.keys(rows[0]);
  const out: any[] = [];
  const chunk = Math.max(1, Math.floor(30000 / cols.length));
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const params: unknown[] = [];
    const values = part.map((r) => `(${cols.map((k) => { const v = r[k]; const isJson = v !== null && typeof v === 'object' && !(v instanceof Date) && (!Array.isArray(v) || (v.length > 0 && typeof v[0] === 'object')); params.push(isJson ? JSON.stringify(v) : v); return `$${params.length}`; }).join(',')})`).join(',');
    const r = await c.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${values} ${returning ? `RETURNING ${returning}` : ''}`, params);
    out.push(...r.rows);
  }
  return out;
}

export async function meta<T = any>(c: Q, key: string): Promise<T | undefined> { return (await c.query(`SELECT value FROM layer.meta WHERE key=$1`, [key])).rows[0]?.value as T | undefined; }
export async function setMeta(c: Q, key: string, value: unknown) { await c.query(`INSERT INTO layer.meta (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [key, JSON.stringify(value)]); }
