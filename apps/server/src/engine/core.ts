/**
 * The workflow engine (the Tasama HR engine with Jahiz vocabulary).
 *
 * A run (layer.runs) executes one workflow's steps in order for one case.
 * AGENT and SYSTEM steps execute immediately through their handler; a HUMAN
 * step parks the run in one persona's inbox with an approval row; a step that
 * `waits` parks the run until an event (a customer reply, a payment, a
 * timeout) resumes it. Nothing writes to the core schema except SYSTEM steps
 * (Muhaddith through the connector), and those only run after every human
 * step before them has approved. The only way past a HUMAN step is decide().
 */
import type { PoolClient } from 'pg';
import { AGENT, PERSONA, personaForApprover, approverForDomain, wf, type StepDef, type WorkflowDef, type Policy, type PersonaKey, type Segment, type CaseState } from '@jahiz/domain';
import { now } from '../clock.js';
import type { Ctx } from '../core/connector.js';
import { factsOf, type FullFacts } from '../core/connector.js';
import { activePolicy } from '../policy.js';
import { HANDLERS, WHO } from './handlers.js';

export type Run = {
  id: number; case_id: number | null; workflow_id: string; title: string; title_ar: string; status: string; current_step: string | null;
  waiting_on_persona: string | null; waiting_event: string | null; payload: Record<string, any>; result: Record<string, any>; channel: string; scenario_key: string | null; created_at: string;
};
export type CaseRow = {
  id: number; ref: string; customer_id: string; cls: string; state: CaseState; reasons: string[]; primary_reason: string | null; workflow_id: string | null; opened_at: string; closed_at: string | null;
  close_code: string | null; owner_persona: string | null; rm_id: string | null; attempts: number; max_attempts: number; next_action_at: string | null; recheck_on: string | null; recheck_reason: string | null;
  paused: boolean; pause_reason: string | null; edge_key: string | null; scenario_key: string | null; payload: Record<string, any>;
};
export type StepRow = { id: number; run_id: number; seq: number; step_key: string; actor_type: string; actor_id: string; label: string; status: string; outputs: any; decision: string | null };

export type StepOutcome = {
  status?: 'DONE' | 'SKIPPED' | 'REFUSED' | 'FAILED';
  decision?: string;
  outputs?: Record<string, any>;
  /** End the run here. */
  stop?: 'COMPLETED' | 'REJECTED' | 'ESCALATED';
  /** Steps to skip later in this run. */
  skip?: string[];
  /** Park the run until this event resumes the same step. */
  wait?: 'REPLY' | 'PAYMENT' | 'TIMEOUT' | 'EVENT';
  /** For the next human step: what the agent recommends, shown in the reader and used to detect overrides. */
  recommend?: { verdict: 'APPROVE' | 'DECLINE' | 'REVIEW'; summary: string; summary_ar?: string };
  /** The action type the next human step decides (for the authority matrix). */
  actionType?: string;
};

export type TrailIn = {
  act: string; summary: string; summary_ar?: string; actor_id?: string; actor_type?: 'AGENT' | 'HUMAN' | 'SYSTEM'; actor_name?: string; autonomy?: string | null;
  clause?: string; policy_version?: number; channel?: string; before?: any; after?: any; override?: boolean; reason?: string; evidence_ref?: string; case_id?: number | null; case_ref?: string | null; customer_id?: string | null;
};
export type HCtx = {
  c: PoolClient; run: Run; kase: CaseRow | null; step: StepRow; def: StepDef; wf: WorkflowDef; at: Date; policy: Policy; conn: Ctx;
  facts: () => Promise<FullFacts>;
  trail: (t: TrailIn) => Promise<void>;
  patch: (p: Record<string, any>) => Promise<void>;
  setResult: (p: Record<string, any>) => Promise<void>;
  caseState: (state: CaseState, note?: string, extra?: Record<string, any>) => Promise<void>;
  closeCase: (code: string, note?: string) => Promise<void>;
  task: (t: { kind: string; assignee: PersonaKey; title: string; title_ar: string; brief?: string; brief_mode?: string; dueDays?: number }) => Promise<number>;
  activity: (a: { trigger: string; action: string; result: string; clause?: string; agent?: string }) => Promise<void>;
  /** The event that resumed this step, if any. */
  event: { kind: string; payload: Record<string, any> } | null;
};

const agentName = (id: string) => AGENT[id]?.name ?? (id === 'connector' || id === 'policy' ? 'Connector' : id);
const agentAutonomy = (id: string, segment?: Segment) => { const a = AGENT[id]; return (segment && a?.autonomyBySegment?.[segment]) ?? a?.autonomy ?? null; };

export async function addTrail(c: { query: PoolClient['query'] }, t: TrailIn & { actor_id: string; actor_type: 'AGENT' | 'HUMAN' | 'SYSTEM'; actor_name: string; run_id?: number | null; scenario_key?: string | null }) {
  await c.query(
    `INSERT INTO layer.trail (at, actor_type, actor_id, actor_name, autonomy, act, case_id, case_ref, customer_id, run_id, policy_version, clause, channel, before, after, override, reason, evidence_ref, summary, summary_ar, scenario_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
    [now(), t.actor_type, t.actor_id, t.actor_name, t.autonomy ?? null, t.act, t.case_id ?? null, t.case_ref ?? null, t.customer_id ?? null, t.run_id ?? null, t.policy_version ?? null, t.clause ?? null, t.channel ?? null,
      t.before === undefined ? null : JSON.stringify(t.before), t.after === undefined ? null : JSON.stringify(t.after), t.override ?? false, t.reason ?? null, t.evidence_ref ?? null, t.summary, t.summary_ar ?? t.summary, t.scenario_key ?? null],
  );
}
export async function addActivity(c: { query: PoolClient['query'] }, a: { trigger: string; agent?: string | null; action: string; result: string; autonomy?: string | null; clause?: string | null; case_ref?: string | null; customer_id?: string | null; scenario_key?: string | null; changes?: any }) {
  await c.query(`INSERT INTO layer.activity (at, trigger, agent, action, result, autonomy, clause, case_ref, customer_id, scenario_key, changes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [now(), a.trigger, a.agent ?? null, a.action, a.result, a.autonomy ?? null, a.clause ?? null, a.case_ref ?? null, a.customer_id ?? null, a.scenario_key ?? null, JSON.stringify(a.changes ?? {})]);
}

export async function loadRun(c: PoolClient, id: number, lock = true): Promise<Run> {
  const r = await c.query(`SELECT * FROM layer.runs WHERE id = $1 ${lock ? 'FOR UPDATE' : ''}`, [id]);
  if (!r.rows[0]) throw new Error(`run ${id} not found`);
  return r.rows[0];
}
export async function loadCase(c: { query: PoolClient['query'] }, id: number): Promise<CaseRow | null> {
  return (await c.query(`SELECT * FROM layer.cases WHERE id=$1`, [id])).rows[0] ?? null;
}

export type StartIn = {
  caseId: number | null; workflowId: string; title: string; title_ar: string; channel: 'SCAN' | 'EVENT' | 'SCHEDULE' | 'SCENARIO' | 'CHAT' | 'FORM' | 'INBOUND';
  payload?: Record<string, any>; scenario?: string | null; doneAtStart?: string[];
};

export async function startRun(c: PoolClient, s: StartIn): Promise<Run> {
  const def = wf(s.workflowId);
  const at = now();
  const run = (await c.query(
    `INSERT INTO layer.runs (case_id, workflow_id, title, title_ar, status, payload, result, channel, scenario_key, created_at, updated_at) VALUES ($1,$2,$3,$4,'RUNNING',$5,'{}',$6,$7,$8,$8) RETURNING *`,
    [s.caseId, def.id, s.title, s.title_ar, JSON.stringify(s.payload ?? {}), s.channel, s.scenario ?? null, at],
  )).rows[0] as Run;
  for (const [i, st] of def.steps.entries()) {
    const done = s.doneAtStart?.includes(st.key);
    await c.query(`INSERT INTO layer.run_steps (run_id, seq, step_key, actor_type, actor_id, label, label_ar, status, started_at, ended_at, decision) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10)`,
      [run.id, i + 1, st.key, st.actor_type, st.actor, st.label, st.label_ar, done ? 'DONE' : 'PENDING', done ? at : null, done ? 'Done at start' : null]);
  }
  if (s.caseId) await c.query(`UPDATE layer.cases SET workflow_id=COALESCE(workflow_id,$2), updated_at=$3 WHERE id=$1`, [s.caseId, def.id, at]);
  await advance(c, run.id);
  return loadRun(c, run.id, false);
}

const SLA_DAYS: Record<string, string> = { ops: 'slaOpsOfficerDays', supervisor: 'slaSupervisorDays', rm: 'slaRmDays', credit: 'slaCreditDays', compliance: 'slaComplianceDays', head: 'slaSupervisorDays', collections: 'slaOpsOfficerDays', steward: 'slaSupervisorDays' };

/** Resolve a HUMAN step's persona. Returns null to skip the step. */
async function resolveWho(c: PoolClient, run: Run, kase: CaseRow | null, sdef: StepDef, policy: Policy, facts: () => Promise<FullFacts>): Promise<PersonaKey | null> {
  const special = WHO[`${run.workflow_id}:${sdef.key}`];
  if (special) return special({ c, run, kase, policy, facts });
  const a = sdef.actor;
  if (a.startsWith('approver:')) {
    const key = a.slice(9);
    if (key === 'domain') return approverForDomain(String(run.payload.domain ?? 'POL-01'));
    const seg = (kase ? (await facts()).segment : 'MASS') as Segment;
    return personaForApprover(policy.str(key, seg));
  }
  if (a === 'rm_or_ops') { const seg = (await facts()).segment; return policy.bool('rmFirst', seg) ? 'rm' : 'ops'; }
  if (a === 'rm') return 'rm';
  if (PERSONA[a as PersonaKey]) return a as PersonaKey;
  return null;
}

/** Run steps until the run needs a person, an event, ends, or runs out of steps. */
export async function advance(c: PoolClient, runId: number, event: HCtx['event'] = null) {
  const policy = await activePolicy(c);
  for (let guardN = 0; guardN < 40; guardN++) {
    const run = await loadRun(c, runId);
    if (run.status !== 'RUNNING') return;
    const def = wf(run.workflow_id);
    const kase = run.case_id ? await loadCase(c, run.case_id) : null;
    const step = (await c.query(`SELECT * FROM layer.run_steps WHERE run_id=$1 AND status IN ('PENDING','WAITING_EVENT') ORDER BY seq LIMIT 1`, [runId])).rows[0] as StepRow | undefined;
    if (!step) {
      await c.query(`UPDATE layer.runs SET status='COMPLETED', current_step=NULL, waiting_on_persona=NULL, waiting_event=NULL, closed_at=$2, updated_at=$2 WHERE id=$1`, [runId, now()]);
      return;
    }
    const sdef = def.steps.find((x) => x.key === step.step_key)!;
    const at = now();
    await c.query(`UPDATE layer.run_steps SET status='RUNNING', started_at=COALESCE(started_at,$2) WHERE id=$1`, [step.id, at]);
    await c.query(`UPDATE layer.runs SET current_step=$2, updated_at=$3 WHERE id=$1`, [runId, step.step_key, at]);
    let cachedFacts: FullFacts | null = null;
    const conn: Ctx = { c, actor: sdef.actor, runId };
    const facts = async () => { if (!kase) throw new Error('No case on this run'); return (cachedFacts ??= await factsOf(conn, kase.customer_id)); };

    if (sdef.actor_type === 'HUMAN') {
      const who = await resolveWho(c, run, kase, sdef, policy, facts);
      if (!who) {
        await c.query(`UPDATE layer.run_steps SET status='SKIPPED', ended_at=$2, decision='Not required' WHERE id=$1`, [step.id, at]);
        continue;
      }
      const actionType = run.result?.actionType ?? run.payload?.actionType ?? 'DECIDE';
      await c.query(`INSERT INTO layer.approvals (run_id, step_key, approver_persona, action_type, decision, created_at) VALUES ($1,$2,$3,$4,'PENDING',$5)`, [runId, sdef.key, who, actionType, at]);
      await c.query(`UPDATE layer.run_steps SET status='WAITING' WHERE id=$1`, [step.id]);
      const slaDays = policy.num(SLA_DAYS[who] ?? 'slaSupervisorDays');
      await c.query(`UPDATE layer.runs SET status='WAITING', waiting_on_persona=$2, waiting_event=NULL, sla_due=$3, updated_at=$4 WHERE id=$1`, [runId, who, new Date(at.getTime() + slaDays * 86_400_000), at]);
      if (kase) await c.query(`UPDATE layer.cases SET owner_persona=$2, updated_at=$3 WHERE id=$1`, [kase.id, who, at]);
      await addActivity(c, { trigger: `${def.id} ${sdef.key}`, agent: null, action: `Waiting on ${PERSONA[who].role}`, result: sdef.label, case_ref: kase?.ref, customer_id: kase?.customer_id, scenario_key: run.scenario_key });
      return;
    }

    const handler = HANDLERS[`${def.id}:${sdef.key}`];
    const seg = kase ? ((await c.query(`SELECT segment FROM core.customers WHERE id=$1`, [kase.customer_id])).rows[0]?.segment as Segment) : undefined;
    const h: HCtx = {
      c, run, kase, step, def: sdef, wf: def, at, policy, conn, facts, event,
      trail: (t) => addTrail(c, { actor_type: t.actor_type ?? (sdef.actor_type as any), actor_id: t.actor_id ?? sdef.actor, actor_name: t.actor_name ?? agentName(sdef.actor), autonomy: t.autonomy === undefined ? agentAutonomy(sdef.actor, seg) : t.autonomy, policy_version: t.policy_version ?? policy.version, case_id: kase?.id ?? null, case_ref: kase?.ref ?? null, customer_id: kase?.customer_id ?? null, run_id: runId, scenario_key: run.scenario_key, ...t }),
      patch: async (p) => { await c.query(`UPDATE layer.runs SET payload = payload || $2::jsonb WHERE id=$1`, [runId, JSON.stringify(p)]); Object.assign(run.payload, p); },
      setResult: async (p) => { await c.query(`UPDATE layer.runs SET result = result || $2::jsonb WHERE id=$1`, [runId, JSON.stringify(p)]); Object.assign(run.result, p); },
      caseState: async (state, note, extra) => { if (!kase) return; await setCaseState(c, kase, state, agentName(sdef.actor), note, extra); },
      closeCase: async (code, note) => { if (!kase) return; await closeCase(c, kase, code, agentName(sdef.actor), note); },
      task: async (t) => {
        const r = await c.query(`INSERT INTO layer.tasks (kind, case_id, run_id, customer_id, assignee_persona, title, title_ar, brief, brief_mode, due, state, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'OPEN',$11) RETURNING id`,
          [t.kind, kase?.id ?? null, runId, kase?.customer_id ?? null, t.assignee, t.title, t.title_ar, t.brief ?? null, t.brief_mode ?? null, new Date(at.getTime() + (t.dueDays ?? 1) * 86_400_000), at]);
        return r.rows[0].id;
      },
      activity: (a) => addActivity(c, { trigger: a.trigger, agent: a.agent ?? sdef.actor, action: a.action, result: a.result, autonomy: agentAutonomy(sdef.actor, seg), clause: a.clause, case_ref: kase?.ref, customer_id: kase?.customer_id, scenario_key: run.scenario_key }),
    };
    let out: StepOutcome;
    await c.query('SAVEPOINT step_sp');
    try {
      out = handler ? await handler(h) : { status: 'DONE', decision: 'No handler: recorded as done (designed step)' };
      await c.query('RELEASE SAVEPOINT step_sp');
    } catch (e: any) {
      await c.query('ROLLBACK TO SAVEPOINT step_sp');
      console.error(`[engine] run ${run.id} ${def.id}:${sdef.key} failed:`, e.message);
      out = { status: 'FAILED', decision: `Error: ${e.message}` };
      await h.trail({ act: 'ESCALATE', summary: `Step failed and was escalated to the Operations Supervisor: ${e.message}` });
      await c.query(`UPDATE layer.runs SET status='ESCALATED', waiting_on_persona='supervisor', updated_at=$2 WHERE id=$1`, [runId, now()]);
      await c.query(`INSERT INTO layer.approvals (run_id, step_key, approver_persona, action_type, decision, created_at) VALUES ($1,$2,'supervisor','RESOLVE_FAILURE','PENDING',$3)`, [runId, sdef.key, now()]);
    }
    event = null; // an event is consumed by the step it resumed
    if (out.wait) {
      await c.query(`UPDATE layer.run_steps SET status='WAITING_EVENT', outputs=$2 WHERE id=$1`, [step.id, JSON.stringify(out.outputs ?? {})]);
      await c.query(`UPDATE layer.runs SET status='WAITING_EVENT', waiting_event=$2, waiting_on_persona=NULL, updated_at=$3 WHERE id=$1`, [runId, out.wait, now()]);
      return;
    }
    await c.query(`UPDATE layer.run_steps SET status=$2, decision=$3, outputs=$4, ended_at=$5 WHERE id=$1`, [step.id, out.status ?? 'DONE', out.decision ?? null, JSON.stringify(out.outputs ?? {}), now()]);
    if (out.recommend) await h.setResult({ recommendation: out.recommend });
    if (out.actionType) await h.setResult({ actionType: out.actionType });
    if (out.skip?.length) await c.query(`UPDATE layer.run_steps SET status='SKIPPED', decision='Not required', ended_at=$3 WHERE run_id=$1 AND step_key = ANY($2) AND status='PENDING'`, [runId, out.skip, now()]);
    if (out.status === 'FAILED') return;
    if (out.stop) {
      await c.query(`UPDATE layer.run_steps SET status='SKIPPED', decision=$3, ended_at=$4 WHERE run_id=$1 AND status='PENDING' AND seq > $2`, [runId, step.seq, out.stop === 'ESCALATED' ? 'Stopped: escalated to a person' : 'Stopped', now()]);
      if (out.stop === 'ESCALATED') await c.query(`UPDATE layer.runs SET status='ESCALATED', updated_at=$2 WHERE id=$1`, [runId, now()]);
      else await c.query(`UPDATE layer.runs SET status=$2, current_step=NULL, waiting_on_persona=NULL, waiting_event=NULL, closed_at=$3, updated_at=$3 WHERE id=$1`, [runId, out.stop, now()]);
      return;
    }
  }
}

/** Resume a run parked on an event with that event. */
export async function resume(c: PoolClient, runId: number, event: { kind: string; payload: Record<string, any> }) {
  const run = await loadRun(c, runId);
  if (run.status !== 'WAITING_EVENT') throw new Error(`run ${runId} is not waiting for an event (${run.status})`);
  await c.query(`UPDATE layer.runs SET status='RUNNING', waiting_event=NULL, updated_at=$2 WHERE id=$1`, [runId, now()]);
  await advance(c, runId, event);
}

export type DecideIn = { runId: number; persona: PersonaKey; personaName?: string; decision: 'APPROVED' | 'REJECTED' | 'RETURNED'; reason?: string; edits?: Record<string, any>; scenario?: boolean };

export async function decide(c: PoolClient, d: DecideIn) {
  const run = await loadRun(c, d.runId);
  if (!['WAITING', 'ESCALATED'].includes(run.status)) throw new Error(`Run ${run.id} is not waiting for a decision (${run.status})`);
  const appr = (await c.query(`SELECT * FROM layer.approvals WHERE run_id=$1 AND decision='PENDING' ORDER BY id DESC LIMIT 1`, [run.id])).rows[0];
  if (!appr) throw new Error('No pending approval');
  const p = PERSONA[d.persona];
  const person = d.personaName ?? p.name;
  const at = now();
  const kase = run.case_id ? await loadCase(c, run.case_id) : null;
  const rec = run.result?.recommendation as StepOutcome['recommend'] | undefined;
  const overrides = !!rec && ((rec.verdict === 'DECLINE' && d.decision === 'APPROVED') || (rec.verdict === 'APPROVE' && d.decision === 'REJECTED'));
  if (overrides && !d.reason) throw new Error('A reason is required when the decision differs from the agent\'s recommendation.');
  if (d.edits) await c.query(`UPDATE layer.runs SET payload = payload || $2::jsonb WHERE id=$1`, [run.id, JSON.stringify(d.edits)]);
  await c.query(`UPDATE layer.approvals SET decision=$2, reason=$3, decided_at=$4, decided_by=$5 WHERE id=$1`, [appr.id, d.decision, d.reason ?? null, at, d.persona]);
  const stepLabel = wf(run.workflow_id).steps.find((s) => s.key === appr.step_key)!;
  const verb = d.decision === 'APPROVED' ? 'Approved' : d.decision === 'RETURNED' ? 'Returned' : 'Declined';
  const verbAr = d.decision === 'APPROVED' ? 'اعتمد' : d.decision === 'RETURNED' ? 'أعاد' : 'رفض';
  await addTrail(c, {
    actor_type: 'HUMAN', actor_id: d.persona, actor_name: `${person}${d.scenario ? ' (decided by the scenario)' : ''}`, autonomy: null,
    act: overrides ? 'OVERRIDE' : d.decision === 'APPROVED' ? 'APPROVE' : d.decision === 'RETURNED' ? 'RETURN' : 'REJECT',
    summary: `${verb}: ${stepLabel.label}${d.reason ? ` — ${d.reason}` : ''}`, summary_ar: `${verbAr}: ${stepLabel.label_ar}${d.reason ? ` — ${d.reason}` : ''}`,
    override: overrides, reason: d.reason, case_id: kase?.id, case_ref: kase?.ref, customer_id: kase?.customer_id, run_id: run.id, scenario_key: run.scenario_key,
  });
  await addActivity(c, { trigger: `${PERSONA[d.persona].role} decided`, agent: null, action: `${verb}: ${stepLabel.label}`, result: d.reason ?? '', case_ref: kase?.ref, customer_id: kase?.customer_id, scenario_key: run.scenario_key });
  await c.query(`UPDATE layer.run_steps SET status='DONE', decision=$3, ended_at=$4 WHERE run_id=$1 AND step_key=$2`, [run.id, appr.step_key, `${verb} by ${person}`, at]);
  await c.query(`UPDATE layer.runs SET payload = payload || $2::jsonb WHERE id=$1`, [run.id, JSON.stringify({ lastDecision: d.decision, lastDecisionReason: d.reason ?? null, lastDecidedBy: d.persona })]);
  if (run.status === 'ESCALATED') {
    if (d.decision === 'APPROVED') {
      await c.query(`UPDATE layer.runs SET status='RUNNING', waiting_on_persona=NULL, updated_at=$2 WHERE id=$1`, [run.id, at]);
      await c.query(`UPDATE layer.run_steps SET status='PENDING', decision=NULL WHERE run_id=$1 AND status IN ('FAILED','SKIPPED') AND decision LIKE 'Stopped%'`, [run.id]);
      await advance(c, run.id);
    } else await c.query(`UPDATE layer.runs SET status='REJECTED', closed_at=$2, updated_at=$2, waiting_on_persona=NULL WHERE id=$1`, [run.id, at]);
    return;
  }
  if (d.decision === 'APPROVED') {
    await c.query(`UPDATE layer.runs SET status='RUNNING', waiting_on_persona=NULL, sla_due=NULL, updated_at=$2 WHERE id=$1`, [run.id, at]);
    await advance(c, run.id);
  } else {
    // A rejection runs the workflow's rejection hook if one exists (e.g. re-request a document), otherwise closes the run.
    const hook = HANDLERS[`${run.workflow_id}:${appr.step_key}:rejected`];
    await c.query(`UPDATE layer.run_steps SET status='SKIPPED', decision='Declined upstream', ended_at=$2 WHERE run_id=$1 AND status='PENDING'`, [run.id, at]);
    await c.query(`UPDATE layer.runs SET status='REJECTED', waiting_on_persona=NULL, sla_due=NULL, closed_at=$2, updated_at=$2 WHERE id=$1`, [run.id, at]);
    if (hook) {
      const conn: Ctx = { c, actor: d.persona, runId: run.id };
      let cachedFacts: FullFacts | null = null;
      const h: HCtx = {
        c, run, kase, step: { id: 0, run_id: run.id, seq: 0, step_key: appr.step_key, actor_type: 'HUMAN', actor_id: d.persona, label: stepLabel.label, status: 'DONE', outputs: {}, decision: d.decision }, def: stepLabel, wf: wf(run.workflow_id), at, policy: await activePolicy(c), conn, event: null,
        facts: async () => (cachedFacts ??= await factsOf(conn, kase!.customer_id)),
        trail: (t) => addTrail(c, { actor_type: t.actor_type ?? 'AGENT', actor_id: t.actor_id ?? 'munadi', actor_name: t.actor_name ?? agentName(t.actor_id ?? 'munadi'), autonomy: t.autonomy ?? 'A3', case_id: kase?.id, case_ref: kase?.ref, customer_id: kase?.customer_id, run_id: run.id, scenario_key: run.scenario_key, ...t }),
        patch: async (p) => { await c.query(`UPDATE layer.runs SET payload = payload || $2::jsonb WHERE id=$1`, [run.id, JSON.stringify(p)]); },
        setResult: async (p) => { await c.query(`UPDATE layer.runs SET result = result || $2::jsonb WHERE id=$1`, [run.id, JSON.stringify(p)]); },
        caseState: async (state, note, extra) => { if (kase) await setCaseState(c, kase, state, person, note, extra); },
        closeCase: async (code, note) => { if (kase) await closeCase(c, kase, code, person, note); },
        task: async (t) => (await c.query(`INSERT INTO layer.tasks (kind, case_id, run_id, customer_id, assignee_persona, title, title_ar, brief, brief_mode, due, state, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'OPEN',$11) RETURNING id`, [t.kind, kase?.id ?? null, run.id, kase?.customer_id ?? null, t.assignee, t.title, t.title_ar, t.brief ?? null, t.brief_mode ?? null, new Date(at.getTime() + (t.dueDays ?? 1) * 86_400_000), at])).rows[0].id,
        activity: (a) => addActivity(c, { trigger: a.trigger, agent: a.agent ?? null, action: a.action, result: a.result, clause: a.clause, case_ref: kase?.ref, customer_id: kase?.customer_id, scenario_key: run.scenario_key }),
      };
      await hook(h);
    } else if (kase) await setCaseState(c, kase, 'UPDATE_REJECTED', person, d.reason);
  }
}

// ------------------------------------------------------------------ case state

export async function setCaseState(c: { query: PoolClient['query'] }, kase: CaseRow, state: CaseState, actor: string, note?: string, extra: Record<string, any> = {}) {
  const at = now();
  const sets = Object.keys(extra).map((k, i) => `${k}=$${i + 4}`);
  await c.query(`UPDATE layer.cases SET state=$2, updated_at=$3${sets.length ? ', ' + sets.join(', ') : ''} WHERE id=$1`, [kase.id, state, at, ...Object.values(extra)]);
  if (kase.state !== state) await c.query(`INSERT INTO layer.case_events (case_id, at, from_state, to_state, actor, note) VALUES ($1,$2,$3,$4,$5,$6)`, [kase.id, at, kase.state, state, actor, note ?? null]);
  kase.state = state;
}
export async function closeCase(c: { query: PoolClient['query'] }, kase: CaseRow, code: string, actor: string, note?: string) {
  const at = now();
  await c.query(`UPDATE layer.cases SET state='CLOSED', close_code=$2, closed_at=$3, updated_at=$3, next_action_at=NULL WHERE id=$1`, [kase.id, code, at]);
  await c.query(`INSERT INTO layer.case_events (case_id, at, from_state, to_state, actor, note) VALUES ($1,$2,$3,'CLOSED',$4,$5)`, [kase.id, at, kase.state, actor, `${code}${note ? ` — ${note}` : ''}`]);
  await c.query(`UPDATE layer.outreach_messages SET status='CANCELLED', block_reason='Case closed' WHERE case_id=$1 AND status='SCHEDULED'`, [kase.id]);
  // Runs parked on a customer reply end with the case; a run that is executing keeps its remaining steps (it is the one closing the case).
  await c.query(`UPDATE layer.run_steps s SET status='SKIPPED', decision='Case closed', ended_at=$2 FROM layer.runs r WHERE s.run_id=r.id AND r.case_id=$1 AND r.status='WAITING_EVENT' AND s.status IN ('PENDING','WAITING_EVENT')`, [kase.id, at]);
  await c.query(`UPDATE layer.runs SET status='COMPLETED', waiting_event=NULL, waiting_on_persona=NULL, closed_at=$2, updated_at=$2 WHERE case_id=$1 AND status='WAITING_EVENT'`, [kase.id, at]);
  kase.state = 'CLOSED';
}
