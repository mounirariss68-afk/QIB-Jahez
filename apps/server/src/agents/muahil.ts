/**
 * Muahil — Re-qualification Officer. Re-runs the eligibility check for one
 * customer after a record change (or for every customer of an employer after
 * its approval), records the result, updates the case, and starts WF-15
 * (hand-off) when the customer is eligible.
 */
import type { PoolClient } from 'pg';
import { qualify, REASON, type ReasonCode, type CaseClass, classOf } from '@jahiz/domain';
import { now, today } from '../clock.js';
import { factsOf, type Ctx } from '../core/connector.js';
import { activePolicy } from '../policy.js';
import { addActivity, addTrail, closeCase, startRun, setCaseState, type CaseRow } from '../engine/core.js';
import { ENGINE_VERSION } from '../version.js';

export type RequalifyOut = { eligible: boolean; amount: number; reasons: ReasonCode[]; cls: CaseClass | null; caseRef: string | null; handoffRunId: number | null; inputs: any; checks: any };

export async function requalify(c: PoolClient, customerId: string, opts: { trigger: string; scenario?: string | null; reason?: string; actor?: string; runId?: number | null; skipHandoff?: boolean } ): Promise<RequalifyOut> {
  const policy = await activePolicy(c);
  const ctx: Ctx = { c, actor: 'muahil', runId: opts.runId ?? null };
  const f = await factsOf(ctx, customerId);
  const q = qualify(f, policy, today());
  const at = now();
  const run = (await c.query(`INSERT INTO core.preapproval_runs (run_at, as_of, engine_version, policy_version, customers_checked, eligible_count, trigger) VALUES ($1,$2,$3,$4,1,$5,$6) RETURNING id`, [at, today(), ENGINE_VERSION, policy.version, q.eligible ? 1 : 0, `Re-check: ${opts.trigger}`])).rows[0];
  await c.query(`INSERT INTO core.preapproval_results (run_id, customer_id, eligible, eligible_vehicle, amount, reason_codes, cls, inputs, checks) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [run.id, f.id, q.eligible, q.eligibleVehicle, q.eligible ? q.amount : null, q.reasons, q.cls, JSON.stringify(q.inputs), JSON.stringify(q.checks)]);
  const open = (await c.query(`SELECT * FROM layer.cases WHERE customer_id=$1 AND state <> 'CLOSED' ORDER BY id DESC LIMIT 1`, [f.id])).rows[0] as CaseRow | undefined;
  const reasons = q.reasons.filter((r) => r !== 'R20') as ReasonCode[];
  let handoffRunId: number | null = null;
  await addTrail(c, { actor_type: 'AGENT', actor_id: 'muahil', actor_name: 'Muahil', autonomy: f.segment === 'HNWI' ? 'A2' : f.segment === 'VVIP' ? 'A1' : 'A3', act: 'REQUALIFY', policy_version: policy.version, clause: 'POL-04 §4.2', case_id: open?.id, case_ref: open?.ref, customer_id: f.id, run_id: opts.runId ?? null, scenario_key: opts.scenario,
    after: { eligible: q.eligible, amount: q.amount, reasons, tenor: q.inputs.tenor },
    summary: q.eligible ? `Re-qualified ${f.id}: eligible for QAR ${q.amount.toLocaleString('en-US')} over ${q.inputs.tenor} months (${opts.trigger})` : `Re-qualified ${f.id}: still not eligible — ${reasons.map((r) => `${r} ${REASON[r].label}`).join('; ')} (${opts.trigger})`,
    summary_ar: q.eligible ? `أعاد تأهيل ${f.id}: مؤهل لمبلغ ${q.amount.toLocaleString('en-US')} ريال` : `أعاد تأهيل ${f.id}: غير مؤهل بعد` });
  await addActivity(c, { trigger: opts.trigger, agent: 'muahil', action: `Re-ran the eligibility check for ${f.id}`, result: q.eligible ? `Eligible: QAR ${q.amount.toLocaleString('en-US')} / ${q.inputs.tenor} months` : `Not eligible: ${reasons.join(', ')}`, autonomy: 'A3', clause: 'POL-04 §4.2', case_ref: open?.ref, customer_id: f.id, scenario_key: opts.scenario });
  if (q.eligible) {
    if (open) { await setCaseState(c, open, 'REQUALIFIED', 'Muahil', 'Eligible'); await closeCase(c, open, 'CURED', 'Muahil', opts.reason ?? opts.trigger); }
    if (!opts.skipHandoff) {
      const r = await startRun(c, { caseId: open?.id ?? null, workflowId: 'WF-15', title: `One Click hand-off — ${f.nameEn}`, title_ar: `إحالة التمويل بنقرة واحدة — ${f.nameAr}`, channel: 'EVENT', payload: { amount: q.amount, tenor: q.inputs.tenor, customerId: f.id, trigger: opts.trigger }, scenario: opts.scenario ?? null });
      handoffRunId = r.id;
    }
  } else if (open) {
    const cls = (q.cls ?? classOf(reasons)) as CaseClass;
    await c.query(`UPDATE layer.cases SET reasons=$2, cls=$3, updated_at=$4 WHERE id=$1`, [open.id, reasons, cls, at]);
    await c.query(`UPDATE layer.case_reasons SET cleared_on=$2 WHERE case_id=$1 AND cleared_on IS NULL AND NOT (reason_code = ANY($3))`, [open.id, today(), reasons]);
    for (const r of reasons) await c.query(`INSERT INTO layer.case_reasons (case_id, reason_code, detected_on) SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM layer.case_reasons WHERE case_id=$1 AND reason_code=$2 AND cleared_on IS NULL)`, [open.id, r, today()]);
    await setCaseState(c, open, 'REQUALIFIED', 'Muahil', `Still not eligible: ${reasons.join(', ')}`);
    if (open.payload?.salaryElsewhere) { /* WF-04's offer step parks the case (cured-awaiting-history) */ }
    else if (open.workflow_id && reasons.length && !reasons.includes(open.primary_reason as ReasonCode)) {
      // The leading reason is cured; the next one takes over with its own workflow.
      const { openCase } = await import('./raqib.js');
      await closeCase(c, open, 'SUPERSEDED', 'Muahil', `${open.primary_reason} cured; remaining ${reasons.join(', ')}`);
      const k = await openCase(c, f, reasons, cls, policy, { scenario: opts.scenario, channel: 'EVENT' });
      return { eligible: false, amount: 0, reasons, cls, caseRef: k.ref, handoffRunId: null, inputs: q.inputs, checks: q.checks };
    }
  }
  return { eligible: q.eligible, amount: q.amount, reasons, cls: q.cls, caseRef: open?.ref ?? null, handoffRunId, inputs: q.inputs, checks: q.checks };
}

/** Re-qualify every customer of an employer (after its approval). */
export async function requalifyEmployer(c: PoolClient, employerId: string, opts: { trigger: string; scenario?: string | null; runId?: number | null }) {
  const ids = (await c.query(`SELECT customer_id FROM core.employment WHERE employer_id=$1`, [employerId])).rows.map((r: any) => r.customer_id as string);
  const out: { id: string; eligible: boolean; amount: number }[] = [];
  for (const id of ids) { const r = await requalify(c, id, { ...opts, reason: `Employer ${employerId} approved` }); out.push({ id, eligible: r.eligible, amount: r.amount }); }
  return out;
}
