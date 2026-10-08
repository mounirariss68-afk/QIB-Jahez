/**
 * Raqib — Data Health Monitor. Runs the twenty-reason check over the base
 * (WF-01), diffs with the previous run, opens or updates one case per
 * customer, starts the workflow that handles each new case, runs the
 * pre-expiry watch, and writes the run summary. A3: opens cases, never
 * contacts anyone.
 */
import type { PoolClient } from 'pg';
import { qualify, classOf, REASON, workflowForReason, addDays, daysBetween, type ReasonCode, type CaseClass, type Policy } from '@jahiz/domain';
import { now, today } from '../clock.js';
import { insertMany } from '../db.js';
import { loadFacts, type FullFacts, type Ctx } from '../core/connector.js';
import { activePolicy } from '../policy.js';
import { addActivity, addTrail, closeCase, resume, startRun, setCaseState, type CaseRow } from '../engine/core.js';
import { requalify } from './muahil.js';

import { ENGINE_VERSION } from '../version.js';
export { ENGINE_VERSION };

export type ScanResult = { runId: number; checked: number; eligible: number; newFallouts: number; cured: number; opened: string[]; closed: string[]; updated: string[]; preExpiry: string[] };

const WF_FOR_CLASS: Record<CaseClass, (primary: ReasonCode, f: FullFacts, policy: Policy) => string> = {
  A: (p) => workflowForReason(p),
  B: (p) => (p === 'R05' ? 'WF-10' : 'WF-11'),
  C: () => 'WF-14',
  D: (p, f, policy) => (['R15', 'R16'].includes(p) && Math.max(...f.facilities.map((x) => x.dpd), ...f.cards.map((x) => x.dpd)) <= policy.num('earlyArrearsMaxDpd') ? 'WF-12' : 'WF-13'),
};
/** The reason that leads the case. Class A follows a fix-the-record-first order (status, identity, salary, employer, standing orders, account); other classes follow QIB rank. */
const ROUTE_ORDER_A: ReasonCode[] = ['R13', 'R07', 'R06', 'R01', 'R02', 'R04', 'R08'];
const primaryOf = (reasons: ReasonCode[], cls: CaseClass): ReasonCode => {
  const inClass = reasons.filter((r) => REASON[r].cls === cls);
  if (cls === 'A') { const first = ROUTE_ORDER_A.find((r) => inClass.includes(r)); if (first) return first; }
  return inClass.sort((a, b) => REASON[a].rank - REASON[b].rank)[0] ?? reasons[0];
};

export async function newCaseRef(c: { query: PoolClient['query'] }) {
  const seq = (await c.query(`SELECT nextval('layer.case_seq') AS n`)).rows[0].n as number;
  return `DEMO-CASE-${String(seq).padStart(5, '0')}`;
}

export async function openCase(c: PoolClient, f: FullFacts, reasons: ReasonCode[], clsIn: CaseClass, policy: Policy, opts: { edgeKey?: string | null; scenario?: string | null; payload?: Record<string, any>; primary?: ReasonCode; workflow?: string; channel?: 'SCAN' | 'EVENT' | 'SCENARIO' } = {}) {
  let cls = clsIn;
  // An active cautionary note gates every contact: the note is handled first (WF-10), whatever else the case carries.
  if (!opts.workflow && reasons.includes('R05') && cls === 'A') cls = 'B';
  const primary = opts.primary ?? (cls === 'B' && reasons.includes('R05') ? 'R05' : primaryOf(reasons, cls));
  const workflow = opts.workflow ?? WF_FOR_CLASS[cls](primary, f, policy);
  const at = now();
  const ref = await newCaseRef(c);
  const maxAttempts = opts.payload?.preExpiry ? policy.num('noticesPreExpiry', f.segment) : policy.num('noticesPostExpiry', f.segment);
  const kase = (await c.query(
    `INSERT INTO layer.cases (ref, customer_id, cls, state, reasons, primary_reason, workflow_id, opened_at, rm_id, attempts, max_attempts, edge_key, scenario_key, payload, updated_at)
     VALUES ($1,$2,$3,'CLASSIFIED',$4,$5,$6,$7,$8,0,$9,$10,$11,$12,$7) RETURNING *`,
    [ref, f.id, cls, reasons, primary, workflow, at, f.rmId, maxAttempts, opts.edgeKey ?? null, opts.scenario ?? null, JSON.stringify(opts.payload ?? {})],
  )).rows[0] as CaseRow;
  await c.query(`INSERT INTO layer.case_events (case_id, at, from_state, to_state, actor, note) VALUES ($1,$2,NULL,'DETECTED','Raqib',$3), ($1,$2,'DETECTED','CLASSIFIED','Raqib',$4)`, [kase.id, at, `Reasons ${reasons.join(', ')}`, `Class ${cls} → ${workflow}`]);
  if (reasons.length) await insertMany(c, 'layer.case_reasons', reasons.map((r) => ({ case_id: kase.id, reason_code: r, detected_on: today() })));
  await addTrail(c, { actor_type: 'AGENT', actor_id: 'raqib', actor_name: 'Raqib', autonomy: 'A3', act: 'OPEN_CASE', policy_version: policy.version, clause: 'POL-04 §1.1', case_id: kase.id, case_ref: ref, customer_id: f.id, scenario_key: opts.scenario,
    summary: opts.payload?.preExpiry ? `Opened ${ref}: pre-expiry watch (${primary === 'R06' ? 'passport' : 'QID'} expires ${primary === 'R06' ? f.passportExpiry : f.qidExpiry}) → ${workflow}` : `Opened ${ref}: ${reasons.map((r) => `${r} ${REASON[r].label}`).join('; ')} → class ${cls}, ${workflow}`,
    summary_ar: `فتح الحالة ${ref}: ${reasons.join('، ')} → الفئة ${cls}` });
  const wfTitle = opts.payload?.preExpiry ? `Pre-expiry: ${REASON[primary].label}` : `${REASON[primary].label} — ${f.nameEn}`;
  await startRun(c, { caseId: kase.id, workflowId: workflow, title: wfTitle, title_ar: REASON[primary].label_ar, channel: opts.channel ?? 'SCAN', payload: { ...(opts.payload ?? {}), primary }, scenario: opts.scenario ?? null });
  return (await c.query(`SELECT * FROM layer.cases WHERE id=$1`, [kase.id])).rows[0] as CaseRow;
}

/** The scan. `ids` limits it to some customers (event-driven or targeted replay); otherwise the whole base. */
export async function scan(c: PoolClient, opts: { trigger: string; scenario?: string | null; ids?: string[]; quiet?: boolean } = { trigger: 'Nightly scan' }): Promise<ScanResult> {
  const policy = await activePolicy(c);
  const ctx: Ctx = { c, actor: 'raqib' };
  const facts = await loadFacts(ctx, opts.ids);
  const asOf = today();
  const at = now();
  const prevRun = (await c.query(`SELECT id FROM core.preapproval_runs ORDER BY id DESC LIMIT 1`)).rows[0];
  const prev = new Map<string, { eligible: boolean; reason_codes: string[] }>();
  if (prevRun) for (const r of (await c.query(`SELECT DISTINCT ON (customer_id) customer_id, eligible, reason_codes FROM core.preapproval_results WHERE customer_id = ANY($1) ORDER BY customer_id, run_id DESC`, [[...facts.keys()]])).rows) prev.set(r.customer_id, r);
  const run = (await c.query(`INSERT INTO core.preapproval_runs (run_at, as_of, engine_version, policy_version, customers_checked, eligible_count, trigger) VALUES ($1,$2,$3,$4,0,0,$5) RETURNING id`, [at, asOf, ENGINE_VERSION, policy.version, opts.trigger])).rows[0];
  // Parked: a case closed awaiting consent / history / unresponsive / opted out is not reopened while the reasons are unchanged (a re-check date or a changed reason reopens it).
  const parkedRows = (await c.query(`SELECT DISTINCT ON (customer_id) customer_id, reasons, close_code, recheck_on FROM layer.cases WHERE state='CLOSED' AND close_code IN ('CURED_AWAITING_HISTORY','AWAITING_CONSENT','UNRESPONSIVE','OPTED_OUT','INELIGIBLE_BY_POLICY') ORDER BY customer_id, id DESC`)).rows;
  const parkedMap = new Map<string, { reasons: string[]; recheck_on: string | null }>(parkedRows.map((r: any) => [r.customer_id, { reasons: r.reasons, recheck_on: r.recheck_on }]));
  const parked = { has: (id: string, reasons: string[]) => { const pk = parkedMap.get(id); if (!pk) return false; if (pk.recheck_on && pk.recheck_on <= asOf) return false; return pk.reasons.length === reasons.length && pk.reasons.every((r) => reasons.includes(r)); } };
  const openCases = new Map<string, CaseRow>();
  for (const k of (await c.query(`SELECT * FROM layer.cases WHERE state <> 'CLOSED' AND customer_id = ANY($1)`, [[...facts.keys()]])).rows) openCases.set(k.customer_id, k);
  const results: Record<string, unknown>[] = [];
  const out: ScanResult = { runId: run.id, checked: facts.size, eligible: 0, newFallouts: 0, cured: 0, opened: [], closed: [], updated: [], preExpiry: [] };
  const watch = policy.num('preExpiryWatchDays');
  const handoffDpd = policy.num('collectionsHandoffDpd');

  for (const f of facts.values()) {
    const q = qualify(f, policy, asOf);
    results.push({ run_id: run.id, customer_id: f.id, eligible: q.eligible, eligible_vehicle: q.eligibleVehicle, amount: q.eligible ? q.amount : null, reason_codes: q.reasons, cls: q.cls, inputs: q.inputs, checks: q.checks });
    const p = prev.get(f.id);
    const open = openCases.get(f.id);
    if (q.eligible) {
      out.eligible++;
      if (open && !open.payload?.preExpiry) {
        // Cured by something the scan sees (a maturity, a payment's cooling end, a list change): close and hand off.
        if (open.state === 'COOLING' || open.state === 'HANDED_OVER') { /* collections boundary: the cooling period decides, not the scan */ }
        else { await closeCase(c, open, 'CURED', 'Raqib', 'Eligible at the scan'); out.closed.push(open.ref); out.cured++; await requalify(c, f.id, { trigger: opts.trigger, scenario: opts.scenario, reason: 'Eligible at the scan' }); }
      } else if (p && !p.eligible) out.cured++;
      // Pre-expiry watch: a document expiring inside the watch window opens a WF-02/03 case even though the customer is still eligible.
      if (!open) {
        const qidDays = f.qidExpiry ? daysBetween(asOf, f.qidExpiry) : 999;
        const ppDays = !f.isQatari && f.passportExpiry ? daysBetween(asOf, f.passportExpiry) : 999;
        if (qidDays >= 0 && qidDays <= watch && policy.num('noticesPreExpiry', f.segment) > 0) { const k = await openCase(c, f, [], 'A', policy, { primary: 'R07', workflow: 'WF-02', payload: { preExpiry: true, expiry: f.qidExpiry }, scenario: opts.scenario }); out.preExpiry.push(k.ref); }
        else if (ppDays >= 0 && ppDays <= watch && policy.num('noticesPreExpiry', f.segment) > 0) { const k = await openCase(c, f, [], 'A', policy, { primary: 'R06', workflow: 'WF-03', payload: { preExpiry: true, expiry: f.passportExpiry }, scenario: opts.scenario }); out.preExpiry.push(k.ref); }
        else if ((qidDays >= 0 && qidDays <= watch) || (ppDays >= 0 && ppDays <= watch)) {
          // RM-only segments: no automated notice; a brief for the RM instead.
          const k = await openCase(c, f, [], 'A', policy, { primary: qidDays <= watch ? 'R07' : 'R06', workflow: qidDays <= watch ? 'WF-02' : 'WF-03', payload: { preExpiry: true, expiry: qidDays <= watch ? f.qidExpiry : f.passportExpiry, rmOnly: true }, scenario: opts.scenario }); out.preExpiry.push(k.ref);
        }
      }
      continue;
    }
    const reasons = q.reasons.filter((r) => r !== 'R20') as ReasonCode[];
    const cls = (q.cls ?? classOf(reasons)) as CaseClass;
    if (!open) {
      if (parked.has(f.id, reasons)) continue; // parked for the same reasons: no new case
      const k = await openCase(c, f, reasons, cls, policy, { scenario: opts.scenario });
      out.opened.push(k.ref);
      if (!p || p.eligible) out.newFallouts++;
      continue;
    }
    if (open.payload?.preExpiry && !open.payload?.expiredNow) {
      // The watched document has now expired: the case becomes a fall-out case, the post-expiry sequence starts fresh.
      const primary = primaryOf(reasons, cls);
      await c.query(`UPDATE layer.cases SET reasons=$2, cls=$3, primary_reason=$4, attempts=0, max_attempts=$5, next_action_at=NULL, state='CLASSIFIED', payload = payload || '{"expiredNow":true,"preExpiry":false}'::jsonb, updated_at=$6 WHERE id=$1`, [open.id, reasons, cls, primary, policy.num('noticesPostExpiry', f.segment), at]);
      await insertMany(c, 'layer.case_reasons', reasons.map((r) => ({ case_id: open.id, reason_code: r, detected_on: asOf })));
      await c.query(`UPDATE layer.outreach_messages SET status='CANCELLED', block_reason='Document expired: post-expiry sequence replaces the watch' WHERE case_id=$1 AND status='SCHEDULED'`, [open.id]);
      await c.query(`UPDATE layer.runs SET status='COMPLETED', waiting_event=NULL, closed_at=$2, updated_at=$2 WHERE case_id=$1 AND status='WAITING_EVENT'`, [open.id, at]);
      await c.query(`UPDATE layer.run_steps s SET status='SKIPPED', decision='Document expired' , ended_at=$2 FROM layer.runs r WHERE s.run_id=r.id AND r.case_id=$1 AND s.status IN ('PENDING','WAITING_EVENT')`, [open.id, at]);
      await addTrail(c, { actor_type: 'AGENT', actor_id: 'raqib', actor_name: 'Raqib', autonomy: 'A3', act: 'UPDATE_CASE', policy_version: policy.version, case_id: open.id, case_ref: open.ref, customer_id: f.id, scenario_key: opts.scenario, summary: `${open.ref}: the watched document has expired (${reasons.join(', ')}); the post-expiry notice sequence starts`, summary_ar: `${open.ref}: انتهت صلاحية الوثيقة؛ يبدأ تسلسل ما بعد الانتهاء` });
      const wfid = workflowForReason(primary);
      await startRun(c, { caseId: open.id, workflowId: wfid, title: `${REASON[primary].label} — ${f.nameEn}`, title_ar: REASON[primary].label_ar, channel: 'SCAN', payload: { primary, expiredNow: true }, scenario: opts.scenario ?? null });
      out.updated.push(open.ref); out.newFallouts++;
      continue;
    }
    const before = new Set(open.reasons); const after = new Set(reasons);
    const added = reasons.filter((r) => !before.has(r)); const cleared = open.reasons.filter((r) => !after.has(r as ReasonCode));
    if (added.length || cleared.length) {
      await c.query(`UPDATE layer.cases SET reasons=$2, updated_at=$3 WHERE id=$1`, [open.id, reasons, at]);
      if (added.length) await insertMany(c, 'layer.case_reasons', added.map((r) => ({ case_id: open.id, reason_code: r, detected_on: asOf })));
      if (cleared.length) await c.query(`UPDATE layer.case_reasons SET cleared_on=$3 WHERE case_id=$1 AND reason_code = ANY($2) AND cleared_on IS NULL`, [open.id, cleared, asOf]);
      await addTrail(c, { actor_type: 'AGENT', actor_id: 'raqib', actor_name: 'Raqib', autonomy: 'A3', act: 'UPDATE_CASE', policy_version: policy.version, case_id: open.id, case_ref: open.ref, customer_id: f.id, scenario_key: opts.scenario,
        summary: `${open.ref}: ${added.length ? `added ${added.join(', ')}` : ''}${added.length && cleared.length ? '; ' : ''}${cleared.length ? `cleared ${cleared.join(', ')}` : ''}`, summary_ar: `${open.ref}: تحديث الأسباب` });
      out.updated.push(open.ref);
      // Class D takes precedence: an arrears case suppresses the class A work until cured.
      if (cls === 'D' && open.cls !== 'D') {
        await c.query(`UPDATE layer.cases SET cls='D', primary_reason=$2, updated_at=$3 WHERE id=$1`, [open.id, primaryOf(reasons, 'D'), at]);
        await c.query(`UPDATE layer.outreach_messages SET status='CANCELLED', block_reason='Arrears: class D suppresses outreach' WHERE case_id=$1 AND status='SCHEDULED'`, [open.id]);
        await startRun(c, { caseId: open.id, workflowId: WF_FOR_CLASS.D(primaryOf(reasons, 'D'), f, policy), title: `Arrears — ${f.nameEn}`, title_ar: 'متأخرات', channel: 'SCAN', scenario: opts.scenario ?? null });
      }
    }
    // Arrears boundary: a WF-12 run waiting for payment is handed over when DPD reaches the limit.
    const maxDpd = Math.max(0, ...f.facilities.map((x) => x.dpd), ...f.cards.map((x) => x.dpd));
    if (maxDpd >= handoffDpd) {
      const waiting = (await c.query(`SELECT id FROM layer.runs WHERE case_id=$1 AND workflow_id='WF-12' AND status='WAITING_EVENT'`, [open.id])).rows[0];
      if (waiting) await resume(c, waiting.id, { kind: 'HANDOFF', payload: { dpd: maxDpd } });
    }
  }
  await insertMany(c, 'core.preapproval_results', results);
  await c.query(`UPDATE core.preapproval_runs SET customers_checked=$2, eligible_count=$3, new_fallouts=$4, cured=$5 WHERE id=$1`, [run.id, out.checked, out.eligible, out.newFallouts, out.cured]);
  if (!opts.quiet) {
    await addTrail(c, { actor_type: 'AGENT', actor_id: 'raqib', actor_name: 'Raqib', autonomy: 'A3', act: 'SCAN', policy_version: policy.version, scenario_key: opts.scenario,
      summary: `${opts.trigger}: checked ${out.checked}, eligible ${out.eligible} (${out.checked ? Math.round((1000 * out.eligible) / out.checked) / 10 : 0}%), ${out.opened.length} case(s) opened, ${out.closed.length} closed, ${out.updated.length} updated, ${out.preExpiry.length} pre-expiry`, summary_ar: `${opts.trigger}: فحص ${out.checked} عميلاً` });
    await addActivity(c, { trigger: opts.trigger, agent: 'raqib', action: `Ran the twenty-reason check on ${out.checked} customer(s) (policy v${policy.version})`, result: `${out.eligible} eligible · ${out.opened.length} opened · ${out.closed.length} closed · ${out.updated.length} updated · ${out.preExpiry.length} pre-expiry`, autonomy: 'A3', scenario_key: opts.scenario, changes: { cases: [...out.opened, ...out.closed, ...out.updated, ...out.preExpiry] } });
  }
  if (!opts.ids) await c.query(`UPDATE layer.triggers SET last_fired_at=$1, fired_count=fired_count+1, last_result=$2, next_fire_at=$3 WHERE key='scan'`, [at, `${out.checked} checked, ${out.eligible} eligible`, new Date(Date.parse(addDays(asOf, 1) + 'T02:00:00Z') - 3 * 3600_000)]);
  return out;
}
