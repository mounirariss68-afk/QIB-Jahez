/**
 * Munabbih — Early-Arrears Reminder. Schedules the POL-05 cadence (day 1
 * push, day 4 e-mail/SMS, day 7 call task, day 10 letter) relative to the
 * first day past due, one action a day through Hami, and stops at the
 * Collections boundary.
 */
import type { PoolClient } from 'pg';
import { type Policy, fmtDate, type MessageType, type Channel } from '@jahiz/domain';
import { now, today } from '../clock.js';
import type { FullFacts } from '../core/connector.js';
import { addActivity, addTrail, type CaseRow } from '../engine/core.js';
import { scheduleMessage, usableChannels } from '../channels/outreach.js';

export async function scheduleCadence(c: PoolClient, kase: CaseRow, f: FullFacts, policy: Policy, opts: { runId: number; scenario?: string | null }) {
  const fac = [...f.facilities.filter((x) => x.dpd > 0).map((x) => ({ product: x.product === 'AUTO_IJARA' ? 'vehicle finance' : x.product === 'HOME' ? 'home finance' : 'personal finance', due: x.instalment, dpd: x.dpd })), ...f.cards.filter((x) => x.dpd > 0).map((x) => ({ product: 'credit card', due: Math.round((x.outstanding * policy.num('cardMinPaymentPct')) / 100), dpd: x.dpd }))];
  const worst = fac.sort((a, b) => b.dpd - a.dpd)[0];
  if (!worst) return { scheduled: [] as number[], note: 'No DPD' };
  const dpdStart = new Date(now().getTime() - worst.dpd * 86_400_000);
  const cadence = policy.nums('arrearsCadenceDays');
  const usable = usableChannels(f, policy);
  const scheduled: number[] = []; const tasks: number[] = [];
  const vars = { due: worst.due.toLocaleString('en-US'), product: worst.product, dpd: worst.dpd, dueDate: fmtDate(dpdStart.toISOString()) };
  const steps: [number, MessageType, Channel | 'CALL' | 'LETTER'][] = [
    [cadence[0] ?? 1, 'ARREARS_1', usable.includes('PUSH') ? 'PUSH' : 'EMAIL'],
    [cadence[1] ?? 4, 'ARREARS_4', usable.includes('EMAIL') ? 'EMAIL' : usable.includes('SMS') ? 'SMS' : 'INAPP'],
    [cadence[2] ?? 7, 'ARREARS_7', 'CALL'],
    [cadence[3] ?? 10, 'ARREARS_10', 'LETTER'],
  ];
  const limit = policy.num('earlyArrearsMaxDpd');
  for (const [day, type, ch] of steps) {
    if (day > limit) continue;
    const at = new Date(dpdStart.getTime() + day * 86_400_000 + 6 * 3600_000);
    if (ch === 'CALL') {
      if (worst.dpd >= day) { const id = (await c.query(`INSERT INTO layer.tasks (kind, case_id, run_id, customer_id, assignee_persona, title, title_ar, brief, due, state, created_at) VALUES ('CALL',$1,$2,$3,'ops',$4,$5,$6,$7,'OPEN',$8) RETURNING id`, [kase.id, opts.runId, f.id, `Call ${f.nameEn}: ${worst.product} ${worst.dpd} days past due`, `اتصال بالعميل ${f.nameAr}`, `Neutral tone; offer the app payment path; record any hardship. Instalment QAR ${vars.due}.`, at, now()])).rows[0].id; tasks.push(id); }
      continue;
    }
    const row = await scheduleMessage(c, { kase, f, policy, channel: ch as Channel, type, reason: 'R15', attempt: 0, notBefore: at, createdBy: 'munabbih', runId: opts.runId, vars, meta: { arrears: true, day } });
    scheduled.push(row.id);
  }
  await c.query(`UPDATE layer.cases SET state='REMINDING', next_action_at=$2, updated_at=$3 WHERE id=$1`, [kase.id, new Date(dpdStart.getTime() + (policy.num('collectionsHandoffDpd')) * 86_400_000), now()]);
  await addTrail(c, { actor_type: 'AGENT', actor_id: 'munabbih', actor_name: 'Munabbih', autonomy: f.segment === 'MASS' || f.segment === 'HIGH_VALUE' ? 'A3' : 'A2', act: 'PLAN', policy_version: policy.version, clause: 'POL-05 §2.1', case_id: kase.id, case_ref: kase.ref, customer_id: f.id, run_id: opts.runId, scenario_key: opts.scenario,
    summary: `Arrears cadence for ${worst.product} at DPD ${worst.dpd}: day ${steps.map(([d, , ch]) => `${d} ${ch}`).join(', ')} — one action a day; hand-off at DPD ${policy.num('collectionsHandoffDpd')}`, summary_ar: `تسلسل تذكير المتأخرات` });
  await addActivity(c, { trigger: 'WF-12 cadence', agent: 'munabbih', action: `Scheduled the early-arrears cadence for ${kase.ref}`, result: `${scheduled.length} message(s), ${tasks.length} call task(s)`, autonomy: 'A3', clause: 'POL-05 §2.1', case_ref: kase.ref, customer_id: f.id, scenario_key: opts.scenario, changes: { messages: scheduled, tasks } });
  return { scheduled, tasks, note: `DPD ${worst.dpd}` };
}
export { today };
