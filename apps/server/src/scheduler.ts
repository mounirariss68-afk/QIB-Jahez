/**
 * Time-based triggers: due messages (through Hami), reply deadlines
 * (timeouts), scheduled re-checks, and the virtual clock. `advanceClock`
 * walks day by day so that every nightly scan, due reminder, T+90 proposal
 * and cooling-period end happens in order, through the real engine.
 */
import type { PoolClient } from 'pg';
import { now, setClock, today, persistClock, dohaAt } from './clock.js';
import { tx } from './db.js';
import { loadFacts, payrollRun, ageDpd, type Ctx } from './core/connector.js';
import { activePolicy } from './policy.js';
import { dispatch } from './channels/outreach.js';
import { resume, addActivity, type CaseRow } from './engine/core.js';
import { scan } from './agents/raqib.js';
import { requalify } from './agents/muahil.js';

export type TickResult = { sent: number; blocked: number; timeouts: number; rechecks: number; messageIds: number[] };

/** Send every message due at or before now (optionally for one customer). */
export async function sendDue(c: PoolClient, opts: { customerId?: string; scenario?: string | null; limit?: number } = {}): Promise<TickResult> {
  const policy = await activePolicy(c);
  const rows = (await c.query(`SELECT id, customer_id FROM layer.outreach_messages WHERE status='SCHEDULED' AND scheduled_for <= $1 ${opts.customerId ? 'AND customer_id=$2' : ''} ORDER BY scheduled_for, id LIMIT ${opts.limit ?? 500}`, opts.customerId ? [now(), opts.customerId] : [now()])).rows;
  const out: TickResult = { sent: 0, blocked: 0, timeouts: 0, rechecks: 0, messageIds: [] };
  if (!rows.length) return out;
  const ctx: Ctx = { c, actor: 'hami' };
  const facts = await loadFacts(ctx, [...new Set(rows.map((r: any) => r.customer_id as string))]);
  for (const r of rows) {
    const f = facts.get(r.customer_id); if (!f) continue;
    const d = await dispatch(c, r.id, f, policy, opts.scenario);
    out.messageIds.push(r.id);
    if (d.status === 'SENT') out.sent++; else out.blocked++;
  }
  await c.query(`UPDATE layer.triggers SET last_fired_at=$1, fired_count=fired_count+1, last_result=$2 WHERE key='due'`, [now(), `${out.sent} sent, ${out.blocked} blocked`]);
  return out;
}

/** Reply deadlines: a case whose attempts are all sent and whose deadline passed resumes its waiting step with TIMEOUT. Also T+N waits. */
export async function timeouts(c: PoolClient, opts: { customerId?: string; scenario?: string | null } = {}): Promise<number> {
  const rows = (await c.query(
    `SELECT r.id AS run_id, k.* FROM layer.runs r JOIN layer.cases k ON k.id=r.case_id
      WHERE r.status='WAITING_EVENT' AND r.waiting_event IN ('REPLY','TIMEOUT') AND k.state<>'CLOSED' AND NOT k.paused AND k.next_action_at IS NOT NULL AND k.next_action_at <= $1
        AND (r.waiting_event='TIMEOUT' OR (k.attempts >= k.max_attempts AND NOT EXISTS (SELECT 1 FROM layer.outreach_messages m WHERE m.case_id=k.id AND m.status='SCHEDULED' AND NOT m.marketing)))
        ${opts.customerId ? 'AND k.customer_id=$2' : ''} ORDER BY k.next_action_at LIMIT 200`, opts.customerId ? [now(), opts.customerId] : [now()])).rows;
  let n = 0;
  for (const r of rows) {
    await c.query(`UPDATE layer.cases SET next_action_at=NULL, updated_at=$2 WHERE id=$1`, [r.id, now()]);
    await resume(c, r.run_id, { kind: 'TIMEOUT', payload: { at: now().toISOString() } });
    n++;
  }
  if (n) await c.query(`UPDATE layer.triggers SET last_fired_at=$1, fired_count=fired_count+1, last_result=$2 WHERE key='timeout'`, [now(), `${n} deadline(s) passed`]);
  return n;
}

/** Scheduled re-checks (class B/C/D cases, cooling periods): re-qualify when the date arrives. */
export async function rechecks(c: PoolClient, opts: { scenario?: string | null } = {}): Promise<number> {
  const rows = (await c.query(`SELECT * FROM layer.cases WHERE recheck_on IS NOT NULL AND recheck_on <= $1 AND (state<>'CLOSED' OR close_code='CURED_AWAITING_HISTORY') ORDER BY recheck_on LIMIT 100`, [today()])).rows as CaseRow[];
  let n = 0;
  for (const k of rows) {
    await c.query(`UPDATE layer.cases SET recheck_on=NULL, updated_at=$2 WHERE id=$1`, [k.id, now()]);
    const r = await requalify(c, k.customer_id, { trigger: `Scheduled re-check: ${k.recheck_reason ?? 'due'}`, scenario: opts.scenario });
    if (!r.eligible && k.state !== 'CLOSED') await c.query(`UPDATE layer.cases SET recheck_on=$2, recheck_reason=$3 WHERE id=$1 AND state<>'CLOSED'`, [k.id, (await import('@jahiz/domain')).addMonths(today(), 1), 'Monthly re-check']);
    n++;
  }
  if (n) await c.query(`UPDATE layer.triggers SET last_fired_at=$1, fired_count=fired_count+1, last_result=$2 WHERE key='recheck'`, [now(), `${n} re-check(s)`]);
  return n;
}

/** One pass of everything time-based, at the current clock. */
export async function tickAll(c: PoolClient, opts: { scenario?: string | null; customerId?: string } = {}) {
  const t = await timeouts(c, opts);
  const d = await sendDue(c, opts);
  const r = await rechecks(c, opts);
  return { ...d, timeouts: t, rechecks: r };
}

/** Advance the virtual clock by N days: for each day, 02:00 scan, then 09:15 due messages and deadlines. */
export async function advanceClock(days: number, opts: { scenario?: string | null } = {}) {
  const summary = { days, scans: 0, sent: 0, blocked: 0, timeouts: 0, rechecks: 0, opened: 0, closed: 0 };
  for (let i = 0; i < days; i++) {
    const next = (await import('@jahiz/domain')).addDays(today(), 1);
    setClock(dohaAt(next, '01:30'));
    await tx(async (c) => { await ageDpd(c, next); await payrollRun(c, next); });
    setClock(dohaAt(next, '02:00'));
    await tx(async (c) => { const s = await scan(c, { trigger: 'Nightly scan', scenario: opts.scenario }); summary.scans++; summary.opened += s.opened.length; summary.closed += s.closed.length; });
    setClock(dohaAt(next, '09:15'));
    await tx(async (c) => { const r = await tickAll(c, opts); summary.sent += r.sent; summary.blocked += r.blocked; summary.timeouts += r.timeouts; summary.rechecks += r.rechecks; });
    setClock(dohaAt(next, '14:05'));
    await tx(async (c) => { const r = await tickAll(c, opts); summary.sent += r.sent; summary.blocked += r.blocked; summary.timeouts += r.timeouts; });
  }
  await persistClock();
  await tx((c) => addActivity(c, { trigger: 'Virtual clock', agent: null, action: `Advanced ${days} day(s) to ${today()}`, result: `${summary.scans} scan(s) · ${summary.sent} sent · ${summary.blocked} blocked · ${summary.timeouts} deadline(s) · ${summary.rechecks} re-check(s) · ${summary.opened} opened · ${summary.closed} closed`, scenario_key: opts.scenario }));
  await tx((c) => c.query(`UPDATE layer.triggers SET last_fired_at=$1, fired_count=fired_count+1, last_result=$2 WHERE key='clock'`, [now(), `+${days} day(s) → ${today()}`]));
  return summary;
}
