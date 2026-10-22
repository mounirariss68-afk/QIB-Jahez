/**
 * Read routes: overview, data health, customers, employers, cases, comms,
 * documents, policies, agents, workflows, triggers, audit trail, activity.
 * Every list applies the persona's scope on the server.
 */
import { Router } from 'express';
import { AGENTS, WORKFLOWS, REASONS, REASON, PARAMS, DOMAINS, CLAUSES, SEGMENTS, SEGMENT_LABEL, qualify, whatIf, DEFAULT_POLICY, Policy, type PolicyParams, SCENARIOS, TEMPLATES, CLASS_LABEL } from '@jahiz/domain';
import { pool } from '../db.js';
import { now, today, isVirtual } from '../clock.js';
import { aiStatus } from '../ai.js';
import { activePolicy } from '../policy.js';
import { health, latestResults } from '../health.js';
import { factsOf, loadFacts } from '../core/connector.js';
import { personaOf, scopeSql, rebase, allowed, personas, personaRmId } from './session.js';
import { renderSpecimenSvg } from '../agents/specimens.js';
import { graphStatus } from '../channels/graph.js';

export const data = Router();
const n = (v: unknown, d = 0) => (v === undefined || v === null || v === '' ? d : Number(v));

data.get('/me', async (req, res) => {
  const p = personaOf(req);
  const policy = await activePolicy();
  const sc = scopeSql(p);
  const inbox = p.scope.metricsOnly ? 0 : (await pool.query(`SELECT COUNT(*)::int n FROM layer.runs r LEFT JOIN layer.cases k ON k.id=r.case_id LEFT JOIN core.customers cu ON cu.id=k.customer_id WHERE r.status IN ('WAITING','ESCALATED') AND r.waiting_on_persona=$1 AND (k.id IS NULL OR ${rebase(sc.sql, 1)})`, [p.key, ...sc.params])).rows[0].n
    + (await pool.query(`SELECT COUNT(*)::int n FROM layer.tasks WHERE state='OPEN' AND assignee_persona=$1`, [p.key])).rows[0].n;
  const scenario = (await pool.query(`SELECT * FROM layer.scenario_runs WHERE status='RUNNING' ORDER BY id DESC LIMIT 1`)).rows[0] ?? null;
  res.json({ persona: { ...p, rmId: personaRmId(p) }, personas: personas(), clock: { now: now().toISOString(), today: today(), virtual: isVirtual() }, ai: aiStatus(), policyVersion: policy.version, inbox, scenario: scenario ? { key: scenario.key, step: scenario.step_index } : null, edge: (await pool.query(`SELECT value FROM layer.meta WHERE key='edge_cases'`)).rows[0]?.value ?? {} });
});

data.get('/overview', async (req, res) => {
  const p = personaOf(req);
  const { health: h } = await health();
  const last = (await pool.query(`SELECT * FROM core.preapproval_runs WHERE customers_checked > 10 ORDER BY id DESC LIMIT 1`)).rows[0];
  const prev = (await pool.query(`SELECT * FROM core.preapproval_runs WHERE customers_checked > 10 AND id < $1 ORDER BY id DESC LIMIT 1`, [last?.id ?? 0])).rows[0];
  const trend = (await pool.query(`SELECT as_of, eligible_count, customers_checked FROM core.preapproval_runs WHERE customers_checked > 10 ORDER BY id`)).rows;
  const funnel = (await pool.query(`SELECT cls, state, close_code, COUNT(*)::int n FROM layer.cases GROUP BY 1,2,3`)).rows;
  const today0 = new Date(Date.parse(today() + 'T00:00:00Z') - 3 * 3600_000);
  const todayStats = (await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM layer.outreach_messages WHERE status='SENT' AND sent_at >= $1) AS sent,
      (SELECT COUNT(*)::int FROM layer.outreach_messages WHERE status='BLOCKED' AND created_at >= $1 OR (status='BLOCKED' AND block_clause IS NOT NULL AND id IN (SELECT id FROM layer.outreach_messages WHERE scheduled_for >= $1))) AS blocked,
      (SELECT COUNT(*)::int FROM layer.outreach_messages WHERE status='SCHEDULED' AND scheduled_for < $2) AS due,
      (SELECT COUNT(*)::int FROM layer.inbound_messages WHERE received_at >= $1) AS inbound,
      (SELECT COUNT(*)::int FROM layer.documents WHERE state IN ('PROPOSED','REVIEW','REJECT_RECOMMENDED')) AS docsWaiting,
      (SELECT COUNT(*)::int FROM layer.proposed_updates WHERE state='APPLIED' AND applied_at >= $1) AS updates,
      (SELECT COUNT(*)::int FROM layer.cases WHERE close_code='CURED' AND closed_at >= $1) AS cured,
      (SELECT COUNT(*)::int FROM layer.cases WHERE close_code='CURED') AS curedAll,
      (SELECT COALESCE(SUM((payload->>'amount')::numeric),0)::bigint FROM layer.runs WHERE workflow_id='WF-15' AND status='COMPLETED') AS offered`, [today0, new Date(now().getTime() + 24 * 3600_000)])).rows[0];
  const waiting = (await pool.query(`SELECT waiting_on_persona AS persona, COUNT(*)::int n FROM layer.runs WHERE status IN ('WAITING','ESCALATED') GROUP BY 1`)).rows;
  const activity = (await pool.query(`SELECT * FROM layer.activity ORDER BY id DESC LIMIT 12`)).rows;
  res.json({ health: h, lastRun: last, prevRun: prev, trend, funnel, today: todayStats, waiting, activity, persona: p.key });
});

data.get('/health', async (_req, res) => { const { health: h } = await health(); res.json(h); });

// ------------------------------------------------------------------ customers
data.get('/customers', async (req, res) => {
  const p = personaOf(req);
  if (p.scope.metricsOnly) return res.json({ rows: [], total: 0, note: 'Data Steward sees metrics only' });
  const q = String(req.query.q ?? '').trim(); const segment = String(req.query.segment ?? ''); const reason = String(req.query.reason ?? ''); const cls = String(req.query.cls ?? ''); const eligible = String(req.query.eligible ?? '');
  const sc = scopeSql(p, 'k', 'cu');
  const params: unknown[] = [...sc.params]; const where: string[] = [sc.sql.replace(/k\.cls/g, 'r.cls')];
  if (q) { params.push(`%${q}%`); where.push(`(cu.id ILIKE $${params.length} OR cu.name_en ILIKE $${params.length} OR cu.name_ar ILIKE $${params.length} OR cu.rim_no ILIKE $${params.length} OR e.name_en ILIKE $${params.length})`); }
  if (segment) { params.push(segment); where.push(`cu.segment=$${params.length}`); }
  if (reason) { params.push(reason); where.push(`$${params.length} = ANY(r.reason_codes)`); }
  if (cls) { params.push(cls); where.push(`r.cls=$${params.length}`); }
  if (eligible === 'yes') where.push('r.eligible'); if (eligible === 'no') where.push('NOT r.eligible');
  const page = n(req.query.page, 0), size = Math.min(n(req.query.size, 50), 200);
  const sql = `FROM core.customers cu LEFT JOIN LATERAL (SELECT eligible, reason_codes, cls, amount FROM core.preapproval_results pr WHERE pr.customer_id=cu.id ORDER BY run_id DESC LIMIT 1) r ON TRUE
      LEFT JOIN core.employment em ON em.customer_id=cu.id LEFT JOIN core.employers e ON e.id=em.employer_id
      LEFT JOIN LATERAL (SELECT ref, state, cls, primary_reason, attempts, max_attempts FROM layer.cases k WHERE k.customer_id=cu.id AND k.state<>'CLOSED' ORDER BY id DESC LIMIT 1) k ON TRUE WHERE ${where.join(' AND ')}`;
  const total = (await pool.query(`SELECT COUNT(*)::int n ${sql}`, params)).rows[0].n;
  const rows = (await pool.query(`SELECT cu.id, cu.name_en, cu.name_ar, cu.segment, cu.is_qatari, cu.nationality, cu.status, cu.rm_id, em.salary_total, e.name_en AS employer, e.approval_status AS employer_status, r.eligible, r.reason_codes, r.cls, r.amount, k.ref AS case_ref, k.state AS case_state, k.primary_reason, k.attempts, k.max_attempts ${sql} ORDER BY cu.id LIMIT ${size} OFFSET ${page * size}`, params)).rows;
  res.json({ rows, total, page, size });
});

data.get('/customers/:id', async (req, res) => {
  const p = personaOf(req);
  if (p.scope.metricsOnly) return res.status(403).json({ error: 'Data Steward sees metrics only (drill-downs show DEMO ids, never a record)' });
  const id = req.params.id;
  const f = await factsOf({ c: pool, actor: p.key }, id).catch(() => null);
  if (!f) return res.status(404).json({ error: 'Not found' });
  if (p.scope.segments && !p.scope.segments.includes(f.segment)) return res.status(403).json({ error: `${p.role} sees ${p.sees}` });
  if (p.scope.ownBook && f.rmId !== personaRmId(p)) return res.status(403).json({ error: 'Not in your book' });
  const policy = await activePolicy();
  const q = qualify(f, policy, today());
  const [cases, messages, inbound, documents, proposals, trail, employer, accounts, facilities, cards, sos, cheques, notes, credits, rm, results] = await Promise.all([
    pool.query(`SELECT * FROM layer.cases WHERE customer_id=$1 ORDER BY id DESC`, [id]),
    pool.query(`SELECT * FROM layer.outreach_messages WHERE customer_id=$1 ORDER BY scheduled_for DESC LIMIT 40`, [id]),
    pool.query(`SELECT * FROM layer.inbound_messages WHERE customer_id=$1 ORDER BY received_at DESC LIMIT 20`, [id]),
    pool.query(`SELECT id, type, image_ref, specimen_key, received_at, assurance, state, recommendation, overall_confidence, flags, mode, case_id FROM layer.documents WHERE customer_id=$1 ORDER BY id DESC`, [id]),
    pool.query(`SELECT * FROM layer.proposed_updates WHERE customer_id=$1 ORDER BY id DESC LIMIT 30`, [id]),
    pool.query(`SELECT * FROM layer.trail WHERE customer_id=$1 ORDER BY id DESC LIMIT 60`, [id]),
    pool.query(`SELECT e.* FROM core.employers e JOIN core.employment em ON em.employer_id=e.id WHERE em.customer_id=$1`, [id]),
    pool.query(`SELECT * FROM core.accounts WHERE customer_id=$1 ORDER BY type`, [id]),
    pool.query(`SELECT * FROM core.finance_facilities WHERE customer_id=$1`, [id]),
    pool.query(`SELECT * FROM core.cards WHERE customer_id=$1`, [id]),
    pool.query(`SELECT * FROM core.standing_orders WHERE customer_id=$1 ORDER BY id`, [id]),
    pool.query(`SELECT * FROM core.cheques_returned WHERE customer_id=$1`, [id]),
    pool.query(`SELECT * FROM core.cautionary_notes WHERE customer_id=$1 ORDER BY id DESC`, [id]),
    pool.query(`SELECT month, amount, explained_reason FROM core.salary_credits WHERE customer_id=$1 ORDER BY month`, [id]),
    pool.query(`SELECT * FROM core.rms WHERE id=$1`, [f.rmId]),
    pool.query(`SELECT r.run_id, pr.run_at, pr.trigger, r.eligible, r.reason_codes, r.amount FROM core.preapproval_results r JOIN core.preapproval_runs pr ON pr.id=r.run_id WHERE r.customer_id=$1 ORDER BY r.run_id DESC LIMIT 10`, [id]),
  ]);
  res.json({
    customer: { ...f.row, nameEn: f.nameEn, nameAr: f.nameAr, lang: f.lang, deposits: f.deposits }, contact: f.contact, consent: f.consent, employment: { employerId: f.employerId, employerName: f.employerName, employerStatus: f.employerStatus, basic: f.basic, allowances: f.allowances, social: f.socialAllowance, total: f.salaryTotal, salaryBank: f.salaryBank },
    identity: { qidNumber: f.qidNumber, qidExpiry: f.qidExpiry, passportNumber: f.passportNumber, passportExpiry: f.passportExpiry }, employer: employer.rows[0] ?? null, rm: rm.rows[0] ?? null,
    accounts: accounts.rows, facilities: facilities.rows, cards: cards.rows, standingOrders: sos.rows, cheques: cheques.rows, notes: notes.rows, credits: credits.rows,
    qualification: q, cases: cases.rows, messages: messages.rows, inbound: inbound.rows, documents: documents.rows, proposals: proposals.rows, trail: trail.rows, results: results.rows,
    can: { send: allowed(p, 'SEND_REMINDER', { segment: f.segment, rmId: f.rmId }), rerun: allowed(p, 'RERUN_QUALIFICATION', { segment: f.segment, rmId: f.rmId, cls: q.cls }), pause: allowed(p, 'PAUSE_CASE', { segment: f.segment, rmId: f.rmId, cls: q.cls }) },
  });
});

data.get('/customers/:id/whatif', async (req, res) => {
  const f = await factsOf({ c: pool, actor: 'dalil' }, req.params.id);
  const policy = await activePolicy();
  const w = { salaryTotal: req.query.salary ? n(req.query.salary) : undefined, dropStandingOrders: req.query.dropSo === '1', clearDpd: req.query.clearDpd === '1', employerApproved: req.query.employer === '1', qidRenewed: req.query.qid === '1' };
  res.json({ now: qualify(f, policy, today()), whatIf: whatIf(f, policy, today(), w) });
});

// ------------------------------------------------------------------ employers
data.get('/employers', async (req, res) => {
  const q = String(req.query.q ?? '').trim(); const status = String(req.query.status ?? '');
  const params: unknown[] = []; const where: string[] = ['TRUE'];
  if (q) { params.push(`%${q}%`); where.push(`(e.id ILIKE $${params.length} OR e.name_en ILIKE $${params.length})`); }
  if (status) { params.push(status); where.push(`e.approval_status=$${params.length}`); }
  const rows = (await pool.query(`SELECT e.*, (SELECT COUNT(*)::int FROM core.employment em WHERE em.employer_id=e.id) AS staff,
      (SELECT COUNT(*)::int FROM layer.cases k WHERE k.state<>'CLOSED' AND 'R02' = ANY(k.reasons) AND k.customer_id IN (SELECT customer_id FROM core.employment em WHERE em.employer_id=e.id)) AS blocked,
      (SELECT state FROM layer.employer_reviews r WHERE r.employer_id=e.id ORDER BY id DESC LIMIT 1) AS review_state
      FROM core.employers e WHERE ${where.join(' AND ')} ORDER BY blocked DESC, staff DESC, e.id LIMIT 200`, params)).rows;
  res.json(rows);
});
data.get('/employers/:id', async (req, res) => {
  const e = (await pool.query(`SELECT * FROM core.employers WHERE id=$1`, [req.params.id])).rows[0];
  if (!e) return res.status(404).json({ error: 'Not found' });
  const staff = (await pool.query(`SELECT cu.id, cu.name_en, cu.segment, em.salary_total, r.eligible, r.reason_codes, k.ref AS case_ref, k.state AS case_state FROM core.employment em JOIN core.customers cu ON cu.id=em.customer_id LEFT JOIN LATERAL (SELECT eligible, reason_codes FROM core.preapproval_results pr WHERE pr.customer_id=cu.id ORDER BY run_id DESC LIMIT 1) r ON TRUE LEFT JOIN LATERAL (SELECT ref, state FROM layer.cases k WHERE k.customer_id=cu.id AND k.state<>'CLOSED' ORDER BY id DESC LIMIT 1) k ON TRUE WHERE em.employer_id=$1 ORDER BY cu.id`, [req.params.id])).rows;
  // The stored results can predate a record change (an explained gap, a scenario reset): qualify the staff live so "waiting only on this approval" is true now.
  if (staff.length <= 200) {
    const policy = await activePolicy();
    const facts = await loadFacts({ c: pool, actor: 'api' }, staff.map((s: any) => s.id));
    for (const s of staff) { const f = facts.get(s.id); if (!f) continue; const q = qualify(f, policy, today()); s.live_eligible = q.eligible; s.live_reasons = (q.reasons as string[]).filter((x) => x !== 'R20'); }
  }
  const reviews = (await pool.query(`SELECT * FROM layer.employer_reviews WHERE employer_id=$1 ORDER BY id DESC`, [req.params.id])).rows;
  const run = reviews[0]?.run_id ? (await pool.query(`SELECT r.id, r.status, r.waiting_on_persona, k.ref AS case_ref FROM layer.runs r LEFT JOIN layer.cases k ON k.id=r.case_id WHERE r.id=$1`, [reviews[0].run_id])).rows[0] : null;
  const trail = (await pool.query(`SELECT * FROM layer.trail WHERE summary ILIKE $1 ORDER BY id DESC LIMIT 20`, [`%${req.params.id}%`])).rows;
  res.json({ employer: e, staff, reviews, run, trail, can: { decide: allowed(personaOf(req), 'DECIDE_EMPLOYER'), open: allowed(personaOf(req), 'OPEN_EMPLOYER_REVIEW') } });
});

// ------------------------------------------------------------------ inbox
data.get('/inbox', async (req, res) => {
  const p = personaOf(req);
  if (p.scope.metricsOnly) return res.json({ approvals: [], tasks: [], unmatched: [] });
  const sc = scopeSql(p);
  const approvals = (await pool.query(`SELECT r.id AS run_id, r.workflow_id, r.title, r.title_ar, r.status, r.current_step, r.sla_due, r.result, r.payload, r.created_at, r.updated_at, a.action_type, a.step_key, a.created_at AS waiting_since,
      k.ref AS case_ref, k.cls, k.state AS case_state, k.reasons, k.primary_reason, k.customer_id, k.opened_at, k.attempts, k.max_attempts, k.next_action_at, k.paused, cu.name_en, cu.name_ar, cu.segment,
      (SELECT COUNT(*)::int FROM layer.documents d WHERE d.case_id=k.id AND d.state IN ('PROPOSED','REVIEW','REJECT_RECOMMENDED')) AS documents
      FROM layer.runs r JOIN layer.approvals a ON a.run_id=r.id AND a.decision='PENDING' LEFT JOIN layer.cases k ON k.id=r.case_id LEFT JOIN core.customers cu ON cu.id=k.customer_id
      WHERE r.status IN ('WAITING','ESCALATED') AND r.waiting_on_persona=$1 AND (k.id IS NULL OR ${rebase(sc.sql, 1)}) ORDER BY a.created_at ASC LIMIT 300`, [p.key, ...sc.params])).rows;
  const tasks = (await pool.query(`SELECT t.*, k.ref AS case_ref, cu.name_en, cu.segment FROM layer.tasks t LEFT JOIN layer.cases k ON k.id=t.case_id LEFT JOIN core.customers cu ON cu.id=t.customer_id WHERE t.state='OPEN' AND t.assignee_persona=$1 ORDER BY t.due ASC LIMIT 300`, [p.key])).rows;
  const unmatched = p.key === 'ops' || p.key === 'supervisor' ? (await pool.query(`SELECT * FROM layer.inbound_messages WHERE customer_id IS NULL AND state<>'ARCHIVED' ORDER BY received_at DESC LIMIT 50`)).rows : [];
  res.json({ approvals, tasks, unmatched, now: now().toISOString() });
});

// ------------------------------------------------------------------ cases
data.get('/cases', async (req, res) => {
  const p = personaOf(req);
  if (p.scope.metricsOnly) return res.json({ rows: [], total: 0 });
  const sc = scopeSql(p);
  const params: unknown[] = [...sc.params]; const where: string[] = [sc.sql];
  const state = String(req.query.state ?? ''), cls = String(req.query.cls ?? ''), segment = String(req.query.segment ?? ''), q = String(req.query.q ?? '').trim(), reason = String(req.query.reason ?? ''), open = String(req.query.open ?? '');
  if (state) { params.push(state); where.push(`k.state=$${params.length}`); }
  if (open === '1') where.push(`k.state<>'CLOSED'`); if (open === '0') where.push(`k.state='CLOSED'`);
  if (cls) { params.push(cls); where.push(`k.cls=$${params.length}`); }
  if (segment) { params.push(segment); where.push(`cu.segment=$${params.length}`); }
  if (reason) { params.push(reason); where.push(`$${params.length} = ANY(k.reasons)`); }
  if (q) { params.push(`%${q}%`); where.push(`(k.ref ILIKE $${params.length} OR cu.name_en ILIKE $${params.length} OR cu.id ILIKE $${params.length})`); }
  const page = n(req.query.page, 0), size = Math.min(n(req.query.size, 50), 200);
  const sql = `FROM layer.cases k JOIN core.customers cu ON cu.id=k.customer_id WHERE ${where.join(' AND ')}`;
  const total = (await pool.query(`SELECT COUNT(*)::int n ${sql}`, params)).rows[0].n;
  // Open cases come in the order they need a hand: the next step soonest first; closed ones by recency.
  // A case handed to Collections or re-qualified has no step of ours pending, whatever date it still carries.
  const stepAt = `CASE WHEN k.state IN ('HANDED_OVER','REQUALIFIED','CLOSED') THEN NULL ELSE k.next_action_at END`;
  const order = open === '1' ? `${stepAt} ASC NULLS LAST, k.updated_at DESC` : 'k.updated_at DESC';
  const rows = (await pool.query(`SELECT k.*, cu.name_en, cu.name_ar, cu.segment, cu.is_qatari, (SELECT r.waiting_on_persona FROM layer.runs r WHERE r.case_id=k.id AND r.status IN ('WAITING','ESCALATED') ORDER BY r.id DESC LIMIT 1) AS waiting_on,
      (SELECT r.waiting_event FROM layer.runs r WHERE r.case_id=k.id AND r.status='WAITING_EVENT' ORDER BY r.id DESC LIMIT 1) AS waiting_event ${sql} ORDER BY ${order} LIMIT ${size} OFFSET ${page * size}`, params)).rows;
  const counts = (await pool.query(`SELECT k.state, k.cls, COUNT(*)::int n FROM layer.cases k JOIN core.customers cu ON cu.id=k.customer_id WHERE ${sc.sql} GROUP BY 1,2`, sc.params)).rows;
  const due = (await pool.query(`SELECT COUNT(*)::int n FROM layer.cases k JOIN core.customers cu ON cu.id=k.customer_id WHERE ${sc.sql} AND ${stepAt} IS NOT NULL AND ${stepAt} <= $${sc.params.length + 1}`, [...sc.params, now()])).rows[0].n;
  const onPerson = (await pool.query(`SELECT COUNT(DISTINCT k.id)::int n FROM layer.cases k JOIN core.customers cu ON cu.id=k.customer_id JOIN layer.runs r ON r.case_id=k.id AND r.status IN ('WAITING','ESCALATED') WHERE ${sc.sql} AND k.state<>'CLOSED'`, sc.params)).rows[0].n;
  res.json({ rows, total, page, size, counts, due, onPerson, now: now().toISOString() });
});

export async function caseDetail(ref: string) {
  const k = (await pool.query(`SELECT k.*, cu.name_en, cu.name_ar, cu.segment, cu.is_qatari, cu.language_pref FROM layer.cases k JOIN core.customers cu ON cu.id=k.customer_id WHERE k.ref=$1`, [ref])).rows[0];
  if (!k) return null;
  const runs = (await pool.query(`SELECT * FROM layer.runs WHERE case_id=$1 ORDER BY id`, [k.id])).rows;
  for (const r of runs) { r.steps = (await pool.query(`SELECT * FROM layer.run_steps WHERE run_id=$1 ORDER BY seq`, [r.id])).rows; r.approvals = (await pool.query(`SELECT * FROM layer.approvals WHERE run_id=$1 ORDER BY id`, [r.id])).rows; }
  const [events, messages, inbound, documents, proposals, tasks, trail, reasons] = await Promise.all([
    pool.query(`SELECT * FROM layer.case_events WHERE case_id=$1 ORDER BY id`, [k.id]),
    pool.query(`SELECT * FROM layer.outreach_messages WHERE case_id=$1 ORDER BY scheduled_for`, [k.id]),
    pool.query(`SELECT * FROM layer.inbound_messages WHERE case_id=$1 ORDER BY received_at`, [k.id]),
    pool.query(`SELECT id, type, image_ref, specimen_key, received_at, assurance, state, recommendation, overall_confidence, flags, mode, verification, extracted FROM layer.documents WHERE case_id=$1 ORDER BY id`, [k.id]),
    pool.query(`SELECT * FROM layer.proposed_updates WHERE case_id=$1 ORDER BY id`, [k.id]),
    pool.query(`SELECT * FROM layer.tasks WHERE case_id=$1 ORDER BY id`, [k.id]),
    pool.query(`SELECT * FROM layer.trail WHERE case_id=$1 ORDER BY id`, [k.id]),
    pool.query(`SELECT * FROM layer.case_reasons WHERE case_id=$1 ORDER BY id`, [k.id]),
  ]);
  // When the leading reason was cured and the next one took over (SUPERSEDED), the customer's story continues in the newer case.
  const successor = k.state === 'CLOSED' && k.close_code === 'SUPERSEDED' ? (await pool.query(`SELECT ref FROM layer.cases WHERE customer_id=$1 AND id > $2 ORDER BY id LIMIT 1`, [k.customer_id, k.id])).rows[0]?.ref ?? null : null;
  return { case: k, runs, events: events.rows, messages: messages.rows, inbound: inbound.rows, documents: documents.rows, proposals: proposals.rows, tasks: tasks.rows, trail: trail.rows, reasons: reasons.rows, successor };
}
data.get('/cases/:ref', async (req, res) => {
  const p = personaOf(req);
  const d = await caseDetail(req.params.ref);
  if (!d) return res.status(404).json({ error: 'Not found' });
  const k = d.case;
  if (p.scope.metricsOnly || (p.scope.segments && !p.scope.segments.includes(k.segment)) || (p.scope.classes && !p.scope.classes.includes(k.cls)) || (p.scope.ownBook && k.rm_id !== personaRmId(p))) return res.status(403).json({ error: `${p.role} sees ${p.sees}` });
  const subject = { segment: k.segment, cls: k.cls, rmId: k.rm_id };
  const waiting = d.runs.find((r: any) => r.status === 'WAITING' || r.status === 'ESCALATED');
  // The facts the decision card draws: the expiry the restriction clock runs from, the salary months, the days past due, the twenty rules — read live, never copied into the case.
  const policy = await activePolicy();
  const f = await factsOf({ c: pool, actor: p.key }, k.customer_id).catch(() => null);
  const q = f ? qualify(f, policy, today()) : null;
  const facts = f && q ? {
    qidExpiry: f.qidExpiry, passportExpiry: f.passportExpiry, employerId: f.employerId, employerName: f.employerName, employerStatus: f.employerStatus, salaryTotal: f.salaryTotal, salaryCredits: f.salaryCredits,
    dpd: Math.max(0, ...f.facilities.map((x) => x.dpd), ...f.cards.map((x) => x.dpd)), notes: f.notes, eligible: q.eligible, amount: q.amount, checks: q.checks, inputs: q.inputs,
  } : null;
  const rules = { restrictionProposalDay: policy.num('restrictionProposalDay'), collectionsHandoffDpd: policy.num('collectionsHandoffDpd'), oneClickReviewConfidence: policy.num('oneClickReviewConfidence'), earlyArrearsMaxDpd: policy.num('earlyArrearsMaxDpd') };
  res.json({ ...d, facts, rules, now: now().toISOString(), can: {
    decide: !!waiting && waiting.waiting_on_persona === p.key, send: allowed(p, 'SEND_REMINDER', subject), reschedule: allowed(p, 'RESCHEDULE', subject), pause: allowed(p, 'PAUSE_CASE', subject), resume: allowed(p, 'RESUME_CASE', subject),
    escalate: allowed(p, 'ESCALATE_TO_RM', subject), rerun: allowed(p, 'RERUN_QUALIFICATION', subject), close: allowed(p, 'CLOSE_UNRESPONSIVE', subject), restrict: allowed(p, 'PROPOSE_RESTRICTION', subject),
  } });
});

// ------------------------------------------------------------------ communications
data.get('/comms', async (req, res) => {
  const p = personaOf(req);
  if (p.scope.metricsOnly) return res.json({ rows: [], total: 0 });
  const sc = scopeSql(p);
  const params: unknown[] = [...sc.params]; const where: string[] = [sc.sql.replace(/k\.cls/g, "COALESCE(k.cls,'A')")];
  const status = String(req.query.status ?? ''), channel = String(req.query.channel ?? ''), customer = String(req.query.customer ?? ''), type = String(req.query.type ?? '');
  if (status) { params.push(status); where.push(`m.status=$${params.length}`); }
  if (channel) { params.push(channel); where.push(`m.channel=$${params.length}`); }
  if (customer) { params.push(customer); where.push(`m.customer_id=$${params.length}`); }
  if (type === 'marketing') where.push('m.marketing'); if (type === 'service') where.push('NOT m.marketing');
  const page = n(req.query.page, 0), size = Math.min(n(req.query.size, 60), 200);
  const sql = `FROM layer.outreach_messages m JOIN core.customers cu ON cu.id=m.customer_id LEFT JOIN layer.cases k ON k.id=m.case_id WHERE ${where.join(' AND ')}`;
  const total = (await pool.query(`SELECT COUNT(*)::int n ${sql}`, params)).rows[0].n;
  const rows = (await pool.query(`SELECT m.*, cu.name_en, cu.name_ar, cu.segment, k.ref AS case_ref ${sql} ORDER BY COALESCE(m.sent_at, m.scheduled_for) DESC, m.id DESC LIMIT ${size} OFFSET ${page * size}`, params)).rows;
  const stats = (await pool.query(`SELECT m.status, COUNT(*)::int n ${sql} GROUP BY m.status`, params)).rows;
  const byChannel = (await pool.query(`SELECT m.channel, m.status, COUNT(*)::int n ${sql} GROUP BY 1,2`, params)).rows;
  res.json({ rows, total, page, size, stats, byChannel, now: now().toISOString() });
});
data.get('/comms/inbound', async (req, res) => {
  const rows = (await pool.query(`SELECT i.*, cu.name_en, cu.segment, k.ref AS case_ref FROM layer.inbound_messages i LEFT JOIN core.customers cu ON cu.id=i.customer_id LEFT JOIN layer.cases k ON k.id=i.case_id ORDER BY i.received_at DESC LIMIT 200`)).rows;
  res.json(rows);
});
data.get('/comms/templates', async (_req, res) => res.json(TEMPLATES));

// ------------------------------------------------------------------ documents
data.get('/documents', async (req, res) => {
  const p = personaOf(req);
  if (p.scope.metricsOnly) return res.json([]);
  const state = String(req.query.state ?? '');
  const params: unknown[] = []; const where: string[] = ['TRUE'];
  if (state === 'queue') where.push(`d.state IN ('RECEIVED','PROPOSED','REVIEW','REJECT_RECOMMENDED')`); else if (state) { params.push(state); where.push(`d.state=$${params.length}`); }
  const rows = (await pool.query(`SELECT d.id, d.type, d.image_ref, d.specimen_key, d.received_at, d.assurance, d.state, d.recommendation, d.overall_confidence, d.flags, d.mode, d.examined_at, d.customer_id, cu.name_en, cu.segment, k.ref AS case_ref,
      (SELECT r.waiting_on_persona FROM layer.runs r WHERE r.case_id=d.case_id AND r.status='WAITING' ORDER BY r.id DESC LIMIT 1) AS waiting_on
      FROM layer.documents d JOIN core.customers cu ON cu.id=d.customer_id LEFT JOIN layer.cases k ON k.id=d.case_id WHERE ${where.join(' AND ')} ORDER BY d.id DESC LIMIT 200`, params)).rows;
  res.json(rows);
});
data.get('/documents/:id', async (req, res) => {
  const d = (await pool.query(`SELECT d.*, cu.name_en, cu.name_ar, cu.segment, k.ref AS case_ref FROM layer.documents d JOIN core.customers cu ON cu.id=d.customer_id LEFT JOIN layer.cases k ON k.id=d.case_id WHERE d.id=$1`, [n(req.params.id)])).rows[0];
  if (!d) return res.status(404).json({ error: 'Not found' });
  const { source, ...rest } = d;
  const proposals = (await pool.query(`SELECT * FROM layer.proposed_updates WHERE document_id=$1 ORDER BY id`, [d.id])).rows;
  const run = (await pool.query(`SELECT r.id, r.status, r.waiting_on_persona, r.workflow_id, r.result FROM layer.runs r WHERE r.case_id=$1 AND r.status IN ('WAITING','ESCALATED') ORDER BY r.id DESC LIMIT 1`, [d.case_id])).rows[0] ?? null;
  const f = await factsOf({ c: pool, actor: 'fahis' }, d.customer_id);
  res.json({ ...rest, specimen: source?.specimen ? { kind: source.specimen.kind, flaw: source.specimen.flaw, title: source.specimen.title, text: source.specimen.text } : null, hasImage: !!source?.image, proposals, run, record: { nameEn: f.nameEn, nameAr: f.nameAr, dob: f.dob, nationality: f.nationality, qidNumber: f.qidNumber, qidExpiry: f.qidExpiry, passportNumber: f.passportNumber, passportExpiry: f.passportExpiry, employerName: f.employerName, salaryTotal: f.salaryTotal }, can: { decide: !!run && run.waiting_on_persona === personaOf(req).key } });
});
data.get('/documents/:id/image.svg', async (req, res) => {
  const d = (await pool.query(`SELECT source FROM layer.documents WHERE id=$1`, [n(req.params.id)])).rows[0];
  if (!d?.source?.specimen) return res.status(404).type('text').send('No specimen');
  res.type('image/svg+xml').setHeader('Cache-Control', 'public, max-age=3600').send(renderSpecimenSvg(d.source.specimen));
});
data.get('/documents/:id/image', async (req, res) => {
  const d = (await pool.query(`SELECT source FROM layer.documents WHERE id=$1`, [n(req.params.id)])).rows[0];
  if (!d?.source?.image) return res.status(404).type('text').send('No image');
  res.type(d.source.image.mime).send(Buffer.from(d.source.image.data, 'base64'));
});

// ------------------------------------------------------------------ policies
data.get('/policies', async (req, res) => {
  const p = personaOf(req);
  const policy = await activePolicy();
  const versions = (await pool.query(`SELECT id, version, status, proposed_by, approved_by, proposed_at, approved_at, effective_from, diff, rationale, preview FROM layer.policy_versions ORDER BY version DESC`)).rows;
  const raw = policy.raw();
  const params = PARAMS.map((d) => ({ ...d, value: d.segmented ? Object.fromEntries(SEGMENTS.map((s) => [s, policy.get(d.key, s)])) : policy.get(d.key), stored: raw[d.key], canPropose: allowed(p, 'PROPOSE_POLICY_CHANGE', { domain: d.domain }) }));
  res.json({ version: policy.version, domains: DOMAINS.map((d) => ({ ...d, canPropose: allowed(p, 'PROPOSE_POLICY_CHANGE', { domain: d.id }), canApprove: allowed(p, 'APPROVE_POLICY_CHANGE', { domain: d.id }) })), params, clauses: CLAUSES, versions, segments: SEGMENTS.map((s) => ({ key: s, label: SEGMENT_LABEL[s] })) });
});
data.get('/policies/clauses', async (req, res) => {
  const q = String(req.query.q ?? '').toLowerCase();
  res.json(CLAUSES.filter((c) => !q || c.id.toLowerCase().includes(q) || c.heading.toLowerCase().includes(q) || c.text.toLowerCase().includes(q) || c.tags.some((t) => t.includes(q))));
});

// ------------------------------------------------------------------ agents, workflows, triggers, scenarios
data.get('/agents', async (_req, res) => {
  const today0 = new Date(Date.parse(today() + 'T00:00:00Z') - 3 * 3600_000);
  const stats = (await pool.query(`SELECT actor_id, act, COUNT(*)::int n, COUNT(*) FILTER (WHERE at >= $1)::int today FROM layer.trail WHERE actor_type='AGENT' GROUP BY 1,2`, [today0])).rows;
  const sys = (await pool.query(`SELECT actor_id, act, COUNT(*)::int n, COUNT(*) FILTER (WHERE at >= $1)::int today FROM layer.trail WHERE actor_type='SYSTEM' GROUP BY 1,2`, [today0])).rows;
  const all = [...stats, ...sys];
  const recent = (await pool.query(`SELECT DISTINCT ON (actor_id) actor_id, at, summary FROM layer.trail WHERE actor_type IN ('AGENT','SYSTEM') ORDER BY actor_id, id DESC`)).rows;
  res.json(AGENTS.map((a) => ({ ...a, stats: all.filter((s) => s.actor_id === a.id).map((s) => ({ act: s.act, total: s.n, today: s.today })), total: all.filter((s) => s.actor_id === a.id).reduce((x, s) => x + s.n, 0), todayTotal: all.filter((s) => s.actor_id === a.id).reduce((x, s) => x + s.today, 0), last: recent.find((r) => r.actor_id === a.id) ?? null, owner: a.owner })));
});
data.get('/agents/:id/trail', async (req, res) => { res.json((await pool.query(`SELECT * FROM layer.trail WHERE actor_id=$1 ORDER BY id DESC LIMIT 100`, [req.params.id])).rows); });
data.get('/workflows', async (_req, res) => {
  const counts = (await pool.query(`SELECT workflow_id, status, COUNT(*)::int n FROM layer.runs GROUP BY 1,2`)).rows;
  res.json(WORKFLOWS.map((w) => ({ ...w, runs: counts.filter((c) => c.workflow_id === w.id).map((c) => ({ status: c.status, n: c.n })), total: counts.filter((c) => c.workflow_id === w.id).reduce((s, c) => s + c.n, 0) })));
});
data.get('/workflows/:id/runs', async (req, res) => {
  const rows = (await pool.query(`SELECT r.*, k.ref AS case_ref, cu.name_en, cu.segment FROM layer.runs r LEFT JOIN layer.cases k ON k.id=r.case_id LEFT JOIN core.customers cu ON cu.id=k.customer_id WHERE r.workflow_id=$1 ORDER BY r.id DESC LIMIT 60`, [req.params.id])).rows;
  for (const r of rows) r.steps = (await pool.query(`SELECT seq, step_key, actor_type, actor_id, label, status, decision, started_at, ended_at FROM layer.run_steps WHERE run_id=$1 ORDER BY seq`, [r.id])).rows;
  res.json(rows);
});
data.get('/runs/:id', async (req, res) => {
  const r = (await pool.query(`SELECT r.*, k.ref AS case_ref, cu.name_en, cu.segment FROM layer.runs r LEFT JOIN layer.cases k ON k.id=r.case_id LEFT JOIN core.customers cu ON cu.id=k.customer_id WHERE r.id=$1`, [n(req.params.id)])).rows[0];
  if (!r) return res.status(404).json({ error: 'Not found' });
  r.steps = (await pool.query(`SELECT * FROM layer.run_steps WHERE run_id=$1 ORDER BY seq`, [r.id])).rows;
  r.approvals = (await pool.query(`SELECT * FROM layer.approvals WHERE run_id=$1 ORDER BY id`, [r.id])).rows;
  r.trail = (await pool.query(`SELECT * FROM layer.trail WHERE run_id=$1 ORDER BY id`, [r.id])).rows;
  res.json(r);
});
data.get('/triggers', async (_req, res) => {
  const rows = (await pool.query(`SELECT * FROM layer.triggers ORDER BY CASE kind WHEN 'SCHEDULE' THEN 0 WHEN 'EVENT' THEN 1 ELSE 2 END, key`)).rows;
  const due = (await pool.query(`SELECT COUNT(*)::int n FROM layer.outreach_messages WHERE status='SCHEDULED' AND scheduled_for <= $1`, [now()])).rows[0].n;
  const deadlines = (await pool.query(`SELECT COUNT(*)::int n FROM layer.cases k JOIN layer.runs r ON r.case_id=k.id AND r.status='WAITING_EVENT' WHERE k.next_action_at <= $1 AND k.state<>'CLOSED'`, [now()])).rows[0].n;
  const rechecks = (await pool.query(`SELECT COUNT(*)::int n FROM layer.cases WHERE recheck_on <= $1 AND recheck_on IS NOT NULL`, [today()])).rows[0].n;
  const nextScheduled = (await pool.query(`SELECT scheduled_for FROM layer.outreach_messages WHERE status='SCHEDULED' ORDER BY scheduled_for LIMIT 1`)).rows[0]?.scheduled_for ?? null;
  res.json({ triggers: rows, pending: { due, deadlines, rechecks, nextScheduled }, clock: { now: now().toISOString(), today: today() } });
});
data.get('/scenarios', async (_req, res) => {
  const runs = (await pool.query(`SELECT * FROM layer.scenario_runs ORDER BY id DESC LIMIT 20`)).rows;
  const edge = (await pool.query(`SELECT value FROM layer.meta WHERE key='edge_cases'`)).rows[0]?.value ?? {};
  res.json({ scenarios: SCENARIOS, runs, edge });
});
data.get('/reasons', async (_req, res) => res.json({ reasons: REASONS, classes: CLASS_LABEL }));

// ------------------------------------------------------------------ audit, activity, integration log
data.get('/audit', async (req, res) => {
  const params: unknown[] = []; const where: string[] = ['TRUE'];
  const f = (k: string, sql: string) => { const v = String(req.query[k] ?? '').trim(); if (v) { params.push(v); where.push(sql.replace('?', `$${params.length}`)); } };
  f('customer', 't.customer_id = ?'); f('case', 't.case_ref = ?'); f('actor', 't.actor_id = ?'); f('act', 't.act = ?'); f('actor_type', 't.actor_type = ?'); f('scenario', 't.scenario_key = ?');
  const q = String(req.query.q ?? '').trim(); if (q) { params.push(`%${q}%`); where.push(`(t.summary ILIKE $${params.length} OR t.case_ref ILIKE $${params.length} OR t.customer_id ILIKE $${params.length} OR t.clause ILIKE $${params.length})`); }
  const from = String(req.query.from ?? ''); if (from) { params.push(from); where.push(`t.at >= $${params.length}`); }
  if (req.query.override === '1') where.push('t.override');
  const limit = Math.min(n(req.query.limit, 100), 500); const page = n(req.query.page, 0);
  const rows = (await pool.query(`SELECT t.* FROM layer.trail t WHERE ${where.join(' AND ')} ORDER BY t.id DESC LIMIT ${limit} OFFSET ${page * limit}`, params)).rows;
  const total = (await pool.query(`SELECT COUNT(*)::int n FROM layer.trail t WHERE ${where.join(' AND ')}`, params)).rows[0].n;
  const byAct = (await pool.query(`SELECT act, COUNT(*)::int n FROM layer.trail GROUP BY 1 ORDER BY 2 DESC`)).rows;
  const byActor = (await pool.query(`SELECT actor_type, actor_name, COUNT(*)::int n FROM layer.trail GROUP BY 1,2 ORDER BY 3 DESC LIMIT 30`)).rows;
  res.json({ rows, total, byAct, byActor });
});
data.get('/activity', async (req, res) => {
  const since = n(req.query.since, 0);
  const rows = (await pool.query(since ? `SELECT * FROM layer.activity WHERE id > $1 ORDER BY id DESC LIMIT 100` : `SELECT * FROM layer.activity ORDER BY id DESC LIMIT 100`, since ? [since] : [])).rows;
  res.json(rows);
});
data.get('/integration-log', async (req, res) => {
  const system = String(req.query.system ?? '');
  const rows = (await pool.query(`SELECT * FROM layer.integration_log ${system ? 'WHERE system=$1' : ''} ORDER BY id DESC LIMIT 200`, system ? [system] : [])).rows;
  const counts = (await pool.query(`SELECT system, verb, COUNT(*)::int n FROM layer.integration_log GROUP BY 1,2 ORDER BY 1,2`)).rows;
  res.json({ rows, counts });
});
data.get('/settings', async (req, res) => {
  const policy = await activePolicy();
  const dataParams = PARAMS.filter((p) => p.domain === 'DATA').map((p) => ({ ...p, value: policy.get(p.key) }));
  const seed = (await pool.query(`SELECT value FROM layer.meta WHERE key='seed'`)).rows[0]?.value;
  res.json({ personas: personas(), data: dataParams, seed, ai: aiStatus(), graph: graphStatus(), connectors: [
    { id: 'CORE', name: 'Core banking (simulated)', status: 'simulated', note: 'core schema through connector.ts; every call in the integration log' },
    { id: 'CHANNEL', name: 'Channels: push, in-app, SMS, e-mail, letter', status: 'simulated', note: 'Adapters deliver into the customer\'s phone and mailbox in the demo' },
    { id: 'GRAPH', name: 'Microsoft Graph (e-mail)', status: graphStatus().configured ? 'configured, not wired' : 'stubbed', note: 'Set GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_MAILBOX; one adapter swap' },
    { id: 'ONECLICK', name: 'One Click Finance hand-off', status: 'simulated', note: 'POST /preapprovals logged; the offer is rendered on the phone' },
    { id: 'BUREAU', name: 'Qatar Credit Bureau', status: 'synthetic snapshot', note: 'No live inquiry; consent event recorded' },
    { id: 'ANTHROPIC', name: 'Claude via Replit AI Integrations', status: aiStatus().mode, note: aiStatus().mode === 'claude' ? `Model ${aiStatus().model}` : 'Not connected: Dalil, Mustaqbil, Fahis and the drafting steps run Offline' },
  ] });
});
export { latestResults, loadFacts, DEFAULT_POLICY, Policy };
export type { PolicyParams };
