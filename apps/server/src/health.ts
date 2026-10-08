/** Data health from the latest results and the facts, cached per scan. */
import { dataHealth, type DataHealth, type HealthRow, type ReasonCode, type CaseClass } from '@jahiz/domain';
import { pool } from './db.js';
import { today } from './clock.js';
import { loadFacts } from './core/connector.js';

let cache: { key: string; value: DataHealth; rows: HealthRow[] } | null = null;

export async function latestResults(): Promise<Map<string, { eligible: boolean; reason_codes: string[]; cls: string | null; amount: number | null; run_id: number }>> {
  const rows = (await pool.query(`SELECT DISTINCT ON (customer_id) customer_id, eligible, reason_codes, cls, amount, run_id FROM core.preapproval_results ORDER BY customer_id, run_id DESC`)).rows;
  return new Map(rows.map((r: any) => [r.customer_id, r]));
}

export async function health(): Promise<{ health: DataHealth; rows: HealthRow[] }> {
  const last = (await pool.query(`SELECT MAX(id) AS id, (SELECT COUNT(*) FROM core.preapproval_results) AS n FROM core.preapproval_runs`)).rows[0];
  const key = `${last.id}:${last.n}:${today()}`;
  if (cache?.key === key) return { health: cache.value, rows: cache.rows };
  const facts = await loadFacts({ c: pool, actor: 'raqib' });
  const res = await latestResults();
  const rows: HealthRow[] = [];
  for (const f of facts.values()) {
    const r = res.get(f.id);
    rows.push({ customer: f, eligible: r?.eligible ?? false, reasons: (r?.reason_codes ?? []) as ReasonCode[], cls: (r?.cls ?? null) as CaseClass | null, amount: r?.amount ?? 0, marketingConsent: f.consent.marketing_consent, appRegistered: !!f.contact?.app_registered, dnc: f.consent.dnc });
  }
  const emp = Object.fromEntries((await pool.query(`SELECT id, approval_status FROM core.employers`)).rows.map((e: any) => [e.id, e.approval_status]));
  const value = dataHealth(rows, today(), emp);
  // Enrich the employers panel with names.
  const names = Object.fromEntries((await pool.query(`SELECT id, name_en FROM core.employers`)).rows.map((e: any) => [e.id, e.name_en]));
  (value as any).employers = value.employers.map((e) => ({ ...e, name: names[e.id] ?? e.id }));
  cache = { key, value, rows };
  return { health: value, rows };
}
export const invalidateHealth = () => { cache = null; };
