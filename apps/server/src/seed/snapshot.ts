/**
 * Seeded-state snapshot and restore for the named edge cases, so every
 * scenario can be run again from the state it was designed for without
 * rebuilding the world. The snapshot is taken once, at the end of the seed;
 * a restore deletes the owner's rows (core and layer) and re-inserts the
 * snapshot, then writes a SYSTEM trail entry saying so. Nothing else in the
 * world is touched: the clock, other customers, the policy and the
 * integration log stay as they are.
 */
import type { PoolClient } from 'pg';
import { now } from '../clock.js';
import { addTrail, addActivity } from '../engine/core.js';

/** Tables owned by a customer, in insert order (delete runs in reverse). */
const CORE_CUSTOMER_TABLES = ['core.identity_documents', 'core.contacts', 'core.consents', 'core.employment', 'core.salary_credits', 'core.accounts', 'core.finance_facilities', 'core.cards', 'core.standing_orders', 'core.cheques_returned', 'core.cautionary_notes', 'core.device_inbox'];
const LAYER_CUSTOMER_TABLES = ['layer.cases', 'layer.inbound_messages', 'layer.documents', 'layer.outreach_messages', 'layer.proposed_updates', 'layer.tasks', 'layer.trail', 'layer.activity'];
/** Children reached through the case or the run (no customer_id column). */
const CASE_CHILDREN: [string, string][] = [['layer.case_reasons', 'case_id'], ['layer.case_events', 'case_id']];
const INSERT_ORDER = [...CORE_CUSTOMER_TABLES, 'layer.cases', 'layer.case_reasons', 'layer.case_events', 'layer.runs', 'layer.run_steps', 'layer.approvals', 'layer.inbound_messages', 'layer.documents', 'layer.outreach_messages', 'layer.proposed_updates', 'layer.tasks', 'layer.trail', 'layer.activity', 'layer.employer_reviews'];

async function fingerprint(c: PoolClient, customers: string[], employers: string[]) {
  const r = (await c.query(
    `SELECT (SELECT count(*) FROM layer.trail WHERE customer_id = ANY($1)) t, (SELECT count(*) FROM core.device_inbox WHERE customer_id = ANY($1)) i,
            (SELECT count(*) FROM layer.outreach_messages WHERE customer_id = ANY($1)) m, (SELECT count(*) FROM layer.documents WHERE customer_id = ANY($1)) d,
            (SELECT count(*) FROM layer.cases WHERE customer_id = ANY($1)) k, (SELECT COALESCE(sum(extract(epoch from updated_at)),0)::bigint FROM layer.cases WHERE customer_id = ANY($1)) u,
            (SELECT count(*) FROM layer.employer_reviews WHERE employer_id = ANY($2)) e, (SELECT string_agg(approval_status, ',' ORDER BY id) FROM core.employers WHERE id = ANY($2)) s`, [customers, employers])).rows[0];
  return `${r.t}|${r.i}|${r.m}|${r.d}|${r.k}|${r.u}|${r.e}|${r.s ?? ''}`;
}

/** Take the snapshot (replaces any previous one for these owners). */
export async function takeSnapshot(c: PoolClient, customers: string[], employers: string[]) {
  await c.query(`DELETE FROM layer.snapshot_rows WHERE owner = ANY($1)`, [[...customers, ...employers]]);
  const ins = (tbl: string, sql: string, params: any[]) => c.query(`INSERT INTO layer.snapshot_rows (tbl, owner, row) ${sql}`, params).then(() => void 0);
  await ins('core.customers', `SELECT 'core.customers', x.id, to_jsonb(x) FROM core.customers x WHERE x.id = ANY($1)`, [customers]);
  for (const t of [...CORE_CUSTOMER_TABLES, ...LAYER_CUSTOMER_TABLES]) await ins(t, `SELECT '${t}', x.customer_id, to_jsonb(x) FROM ${t} x WHERE x.customer_id = ANY($1)`, [customers]);
  for (const [t] of CASE_CHILDREN) await ins(t, `SELECT '${t}', k.customer_id, to_jsonb(x) FROM ${t} x JOIN layer.cases k ON k.id = x.case_id WHERE k.customer_id = ANY($1)`, [customers]);
  await ins('layer.runs', `SELECT 'layer.runs', k.customer_id, to_jsonb(x) FROM layer.runs x JOIN layer.cases k ON k.id = x.case_id WHERE k.customer_id = ANY($1)`, [customers]);
  await ins('layer.runs', `SELECT 'layer.runs', x.payload->>'employerId', to_jsonb(x) FROM layer.runs x WHERE x.case_id IS NULL AND x.workflow_id='WF-05' AND x.payload->>'employerId' = ANY($1)`, [employers]);
  await ins('layer.run_steps', `SELECT 'layer.run_steps', s.owner, to_jsonb(x) FROM layer.run_steps x JOIN layer.snapshot_rows s ON s.tbl='layer.runs' AND (s.row->>'id')::int = x.run_id WHERE s.owner = ANY($1)`, [[...customers, ...employers]]);
  await ins('layer.approvals', `SELECT 'layer.approvals', s.owner, to_jsonb(x) FROM layer.approvals x JOIN layer.snapshot_rows s ON s.tbl='layer.runs' AND (s.row->>'id')::int = x.run_id WHERE s.owner = ANY($1)`, [[...customers, ...employers]]);
  await ins('core.employers', `SELECT 'core.employers', x.id, to_jsonb(x) FROM core.employers x WHERE x.id = ANY($1)`, [employers]);
  await ins('layer.employer_reviews', `SELECT 'layer.employer_reviews', x.employer_id, to_jsonb(x) FROM layer.employer_reviews x WHERE x.employer_id = ANY($1)`, [employers]);
  const fp = await fingerprint(c, customers, employers);
  await c.query(`INSERT INTO layer.meta (key, value) VALUES ('snapshot', $1) ON CONFLICT (key) DO UPDATE SET value = layer.meta.value || EXCLUDED.value`, [JSON.stringify({ at: now().toISOString(), owners: Object.fromEntries([...customers, ...employers].map((o) => [o, true])), fingerprints: {} })]);
  // One fingerprint per owner group would be ideal; a scenario restores its own owner set, so store per owner the fingerprint of that owner alone.
  const fps: Record<string, string> = {};
  for (const id of customers) fps[id] = await fingerprint(c, [id], []);
  for (const id of employers) fps[id] = await fingerprint(c, [], [id]);
  await c.query(`UPDATE layer.meta SET value = jsonb_set(value, '{fingerprints}', $1::jsonb) WHERE key='snapshot'`, [JSON.stringify(fps)]);
  void fp;
}

async function columns(c: PoolClient, tbl: string): Promise<string[]> {
  const [schema, name] = tbl.split('.');
  return (await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position`, [schema, name])).rows.map((r: any) => r.column_name as string);
}

/** Which of the owners differ from their snapshot now. */
export async function dirtyOwners(c: PoolClient, customers: string[], employers: string[]): Promise<string[]> {
  const meta = (await c.query(`SELECT value FROM layer.meta WHERE key='snapshot'`)).rows[0]?.value;
  if (!meta) return [];
  const out: string[] = [];
  for (const id of customers) if (meta.owners?.[id] && meta.fingerprints?.[id] !== (await fingerprint(c, [id], []))) out.push(id);
  for (const id of employers) if (meta.owners?.[id] && meta.fingerprints?.[id] !== (await fingerprint(c, [], [id]))) out.push(id);
  return out;
}

/**
 * Restore the given customers and employers to the seeded state. Returns the
 * owners actually restored (those with a snapshot).
 */
export async function restoreOwners(c: PoolClient, customers: string[], employers: string[], opts: { scenario?: string | null; reason?: string } = {}): Promise<string[]> {
  const have = new Set((await c.query(`SELECT DISTINCT owner FROM layer.snapshot_rows WHERE owner = ANY($1)`, [[...customers, ...employers]])).rows.map((r: any) => r.owner as string));
  const cs = customers.filter((x) => have.has(x)); const es = employers.filter((x) => have.has(x));
  if (!cs.length && !es.length) return [];
  // Delete, children first.
  for (const t of [...LAYER_CUSTOMER_TABLES].reverse()) await c.query(`DELETE FROM ${t} WHERE customer_id = ANY($1)`, [cs]);
  if (es.length) {
    await c.query(`DELETE FROM layer.runs WHERE case_id IS NULL AND workflow_id='WF-05' AND payload->>'employerId' = ANY($1)`, [es]);
    await c.query(`DELETE FROM layer.employer_reviews WHERE employer_id = ANY($1)`, [es]);
  }
  for (const t of [...CORE_CUSTOMER_TABLES].reverse()) await c.query(`DELETE FROM ${t} WHERE customer_id = ANY($1)`, [cs]);
  // The customer and employer rows themselves are updated in place (other tables point at them).
  for (const tbl of ['core.customers', 'core.employers'] as const) {
    const cols = (await columns(c, tbl)).filter((x) => x !== 'id');
    const rows = (await c.query(`SELECT row FROM layer.snapshot_rows WHERE tbl=$1 AND owner = ANY($2)`, [tbl, tbl === 'core.customers' ? cs : es])).rows;
    for (const r of rows) await c.query(`UPDATE ${tbl} SET (${cols.join(',')}) = (SELECT ${cols.join(',')} FROM jsonb_populate_record(NULL::${tbl}, $1::jsonb)) WHERE id=$2`, [JSON.stringify(r.row), r.row.id]);
  }
  // Re-insert, parents first.
  for (const tbl of INSERT_ORDER) {
    const rows = (await c.query(`SELECT row FROM layer.snapshot_rows WHERE tbl=$1 AND owner = ANY($2) ORDER BY (row->>'id')::bigint NULLS FIRST, id`, [tbl, [...cs, ...es]])).rows;
    for (const r of rows) await c.query(`INSERT INTO ${tbl} SELECT * FROM jsonb_populate_record(NULL::${tbl}, $1::jsonb)`, [JSON.stringify(r.row)]);
  }
  const what = [...cs, ...es].join(', ');
  for (const id of cs) await addTrail(c, { actor_type: 'SYSTEM', actor_id: 'director', actor_name: 'Demo Director', autonomy: null, act: 'SCENARIO_RESET', customer_id: id, summary: `Records of ${id} restored to the seeded state${opts.scenario ? ` before scenario ${opts.scenario}` : ''}. Earlier scenario runs are kept in the activity log.`, summary_ar: `استعادة سجلات ${id} إلى حالة البداية`, scenario_key: opts.scenario ?? null });
  await addActivity(c, { trigger: opts.scenario ? `Director ${opts.scenario}` : 'Director', agent: null, action: `Restored the seeded state of ${what}`, result: opts.reason ?? 'The scenario starts from the state it was designed for', scenario_key: opts.scenario ?? null });
  return [...cs, ...es];
}
