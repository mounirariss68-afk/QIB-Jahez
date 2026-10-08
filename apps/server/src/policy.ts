/**
 * The active policy, loaded from layer.policy_versions into one Policy
 * object the engine reads on every action. Nothing about QIB's rules is
 * hard-coded: the catalogue (keys, defaults, clauses) lives in the domain
 * package and the VALUES live in the database, versioned and approved.
 */
import { Policy, defaultParams, type PolicyParams } from '@jahiz/domain';
import type { Q } from './db.js';
import { pool } from './db.js';

let cached: Policy | null = null;

export async function activePolicy(c: Q = pool): Promise<Policy> {
  if (cached) return cached;
  const row = (await c.query(`SELECT version, params FROM layer.policy_versions WHERE status='ACTIVE' ORDER BY version DESC LIMIT 1`)).rows[0];
  cached = row ? new Policy(row.params as PolicyParams, row.version) : new Policy(defaultParams(), 1);
  return cached;
}
export const invalidatePolicy = () => { cached = null; };
/** Synchronous access after the first load (the engine always loads first). */
export const policyNow = (): Policy => cached ?? new Policy(defaultParams(), 1);
