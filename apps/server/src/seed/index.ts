/**
 * Reset the world: drop and recreate both schemas, write policy v1 and the
 * clauses, generate the synthetic base from the DATA parameters, plant the
 * named edge cases, replay sixty days of history through the engine, and
 * leave the clock at today 09:00 Doha.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Policy, defaultParams, type PolicyParams } from '@jahiz/domain';
import { pool, tx, insertMany } from '../db.js';
import { setClock, persistClock, loadClock } from '../clock.js';
import { invalidatePolicy } from '../policy.js';
import { generateDrafts, materialise } from './base.js';
import { EDGES, E047_EXTRA_IDS, applyE047 } from './edge.js';
import { seedLayer } from './layer.js';
import { replay } from './history.js';
import { takeSnapshot } from './snapshot.js';
import { WORLD_VERSION } from '../version.js';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = resolve(here, '../../../../db/schema.sql');
const log = (m: string) => console.log(`[seed] ${m}`);

/** 'yes' when the database holds the current world; 'stale' when it was built under an older seed (rebuild); 'no' when empty. */
export async function seedState(): Promise<'yes' | 'stale' | 'no'> {
  try {
    const r = await pool.query(`SELECT value FROM layer.meta WHERE key='seed'`);
    if (!(r.rowCount ?? 0)) return 'no';
    return Number(r.rows[0].value?.world ?? 1) === WORLD_VERSION ? 'yes' : 'stale';
  } catch { return 'no'; }
}
export async function isSeeded(): Promise<boolean> { return (await seedState()) === 'yes'; }

/** Rebuild everything. `params` lets the Settings → Data screen reseed with a different distribution. */
export async function reseed(params?: PolicyParams) {
  const t0 = Date.now();
  const policy = new Policy(params ?? defaultParams(), 1);
  const realToday = new Date().toISOString().slice(0, 10);
  await pool.query(readFileSync(SCHEMA, 'utf8'));
  invalidatePolicy();
  setClock(null);
  log('generating the synthetic base');
  const { drafts, employers, rms } = generateDrafts(policy, realToday);
  const byId = new Map(drafts.map((d) => [d.id, d]));
  const edge: Record<string, string> = {};
  for (const e of EDGES) { const d = byId.get(e.id); if (d) { e.apply(d, realToday, policy); edge[e.key] = e.id; } }
  for (const id of E047_EXTRA_IDS) { const d = byId.get(id); if (d) applyE047(d, realToday); }
  const g = materialise(drafts, employers, rms, realToday);
  await tx(async (c) => {
    await insertMany(c, 'core.employers', g.employers);
    await insertMany(c, 'core.rms', g.rms);
    await insertMany(c, 'core.customers', g.customers);
    await insertMany(c, 'core.identity_documents', g.documents);
    await insertMany(c, 'core.contacts', g.contacts);
    await insertMany(c, 'core.consents', g.consents);
    await insertMany(c, 'core.employment', g.employment);
    await insertMany(c, 'core.salary_credits', g.credits);
    await insertMany(c, 'core.accounts', g.accounts);
    await insertMany(c, 'core.finance_facilities', g.facilities);
    await insertMany(c, 'core.cards', g.cards);
    await insertMany(c, 'core.standing_orders', g.sos);
    await insertMany(c, 'core.cheques_returned', g.cheques);
    await insertMany(c, 'core.cautionary_notes', g.notes);
    await seedLayer(c, edge, policy.num('dataSeed'));
    if (params) await c.query(`UPDATE layer.policy_versions SET params=$1 WHERE version=1`, [JSON.stringify(params)]);
  });
  log(`base written: ${g.customers.length} customers, ${g.employers.length} employers (${Math.round((Date.now() - t0) / 1000)}s)`);
  // Edge keys on the cases they produce (set after the replay opens them), for the Director.
  await replay(realToday, new Set(Object.values(edge)), policy.num('dataSeed'));
  await tx(async (c) => {
    for (const [key, id] of Object.entries(edge)) await c.query(`UPDATE layer.cases SET edge_key=$2 WHERE customer_id=$1`, [id, key]);
  });
  // Snapshot the named edge cases (and the employer under review) so scenarios can be run again from this state.
  await tx(async (c) => {
    const customers = [...new Set([...Object.values(edge), ...E047_EXTRA_IDS])];
    const employers = (await c.query(`SELECT DISTINCT employer_id FROM core.employment WHERE customer_id = ANY($1) AND employer_id IS NOT NULL`, [customers])).rows.map((r: any) => r.employer_id as string);
    await takeSnapshot(c, customers, employers);
    log(`snapshot taken for ${customers.length} customers and ${employers.length} employers`);
  });
  await persistClock();
  await loadClock();
  invalidatePolicy();
  log(`done in ${Math.round((Date.now() - t0) / 1000)}s`);
}
