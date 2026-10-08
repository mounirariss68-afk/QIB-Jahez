/**
 * Dalil's tools (DESIGN §7). Each runs on the server under the persona's
 * scope and reads the same database the screens use. Exactly one tool can
 * lead to a write — propose_action — and it never writes: it returns a
 * `pending` action the person must confirm on screen (Atelier agent safety
 * model). Text inside tool results is data, never instructions.
 */
import { REASON, PARAMS, PARAM, SEGMENTS, qualify, whatIf, fmtDate, type Persona, type ActionType, type Segment } from '@jahiz/domain';
import { pool } from '../db.js';
import { today, now } from '../clock.js';
import { activePolicy } from '../policy.js';
import { factsOf } from '../core/connector.js';
import { health } from '../health.js';
import { scopeSql, rebase, allowed, personaRmId } from '../api/session.js';

export const SCREENS = ['overview', 'inbox', 'customers', 'employers', 'health', 'cases', 'comms', 'documents', 'policies', 'agents', 'workflows', 'triggers', 'scenarios', 'audit', 'customer-app', 'settings'];
export type Tool = { name: string; description: string; input_schema: any; roles?: (p: Persona) => boolean };
const notSteward = (p: Persona) => !p.scope.metricsOnly;

export const TOOLS: Tool[] = [
  { name: 'search_policy', description: 'Search Jahiz\'s policy clauses (POL-01 contact … POL-10 retention). ALWAYS use this before answering any question about rules, windows, caps, consent, suppression, documents, eligibility rules or escalation. Returns clauses with id (e.g. "POL-01 §3.2"), text and basis.', input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Keywords in English, e.g. "reminder interval Mass"' } }, required: ['query'] } },
  { name: 'policy_params', description: 'The active parameter values of a policy domain (POL-01 … POL-10, SEG, CH, REF, DATA), per segment where segmented, with the active version number.', input_schema: { type: 'object', properties: { domain: { type: 'string' }, key: { type: 'string', description: 'Optional: one parameter key, e.g. reminderIntervalDays' } } } },
  { name: 'data_health', description: 'One Click readiness and data health: eligible rate, fall-outs by reason (QIB rank order), by class (A ask the customer, B bank must act, C not eligible by policy, D collections boundary), by segment, field completeness, expiries ahead, contactability, employers blocking the most customers.', input_schema: { type: 'object', properties: { segment: { type: 'string', enum: SEGMENTS }, reason: { type: 'string', description: 'R01..R20' } } } },
  { name: 'find_customers', description: 'Find customers in scope by DEMO id, name, RIM, employer, segment, reason code or class. Returns up to 15 with eligibility and the open case.', input_schema: { type: 'object', properties: { query: { type: 'string' }, segment: { type: 'string', enum: SEGMENTS }, reason: { type: 'string' }, cls: { type: 'string', enum: ['A', 'B', 'C', 'D'] }, eligible: { type: 'boolean' } } }, roles: notSteward },
  { name: 'customer_360', description: 'One customer: record, documents and expiries, salary history, employer, accounts, facilities, cards, standing orders, consents, open case with reasons, the eligibility result with every rule\'s pass/fail and the computed amount.', input_schema: { type: 'object', properties: { customer_id: { type: 'string', description: 'DEMO-C-nnnnn' } }, required: ['customer_id'] }, roles: notSteward },
  { name: 'explain_eligibility', description: 'The twenty-rule eligibility check for one customer with the arithmetic (DBR base, obligations, capacity, cap, headroom, tenor, amount) and an optional what-if (salary, drop standing orders, clear DPD, employer approved, QID renewed).', input_schema: { type: 'object', properties: { customer_id: { type: 'string' }, salary: { type: 'number' }, drop_standing_orders: { type: 'boolean' }, clear_dpd: { type: 'boolean' }, employer_approved: { type: 'boolean' }, qid_renewed: { type: 'boolean' } }, required: ['customer_id'] }, roles: notSteward },
  { name: 'cases_waiting', description: 'What is waiting on the signed-in persona: decisions (approvals), tasks, with SLA.', input_schema: { type: 'object', properties: {} } },
  { name: 'case_summary', description: 'One case by reference (DEMO-CASE-nnnnn): state, reasons, attempts, messages, documents, proposals, runs and the trail.', input_schema: { type: 'object', properties: { case_ref: { type: 'string' } }, required: ['case_ref'] }, roles: notSteward },
  { name: 'outreach_history', description: 'Every message out and in for a customer: channel, type, status (sent, scheduled, blocked with the clause), policy version.', input_schema: { type: 'object', properties: { customer_id: { type: 'string' } }, required: ['customer_id'] }, roles: notSteward },
  { name: 'document_status', description: 'One examined document: extraction, verification flags, confidence, assurance, proposals and who it waits on.', input_schema: { type: 'object', properties: { document_id: { type: 'number' } }, required: ['document_id'] }, roles: (p) => ['ops', 'supervisor', 'compliance', 'head'].includes(p.key) },
  { name: 'employer_review', description: 'An employer: register entry, QIB-salaried staff, how many customers it blocks, the approval pack and recommendation if a review is open.', input_schema: { type: 'object', properties: { employer_id: { type: 'string', description: 'DEMO-E-nnn' } }, required: ['employer_id'] }, roles: (p) => ['credit', 'head', 'ops', 'supervisor', 'rm'].includes(p.key) },
  { name: 'blocked_today', description: 'What Hami blocked or deferred today (or in the last N days), with the clause, and what was sent.', input_schema: { type: 'object', properties: { days: { type: 'number' } } } },
  { name: 'propose_action', description: 'Prepare ONE action for the person to CONFIRM ON SCREEN; nothing is sent or changed until they press Confirm, and Hami re-checks at that moment. Types: SEND_REMINDER(case_ref) · RESCHEDULE(case_ref, days) · PAUSE_CASE(case_ref, reason) · RESUME_CASE(case_ref) · ESCALATE_TO_RM(case_ref) · RERUN_QUALIFICATION(case_ref or customer_id) · APPROVE_UPDATE / REJECT_UPDATE(case_ref, reason) · DECIDE_EMPLOYER(employer_id, decision APPROVED|REJECTED, reason) · PROPOSE_POLICY_CHANGE(key, segment?, value, rationale) · APPROVE_POLICY_CHANGE · ADD_DNC(customer_id, reason) · CLOSE_UNRESPONSIVE(case_ref, reason) · PROPOSE_RESTRICTION(case_ref) · RUN_SCAN · ADVANCE_CLOCK(days). Only types the authority matrix grants this persona.', input_schema: { type: 'object', properties: { type: { type: 'string' }, case_ref: { type: 'string' }, customer_id: { type: 'string' }, employer_id: { type: 'string' }, decision: { type: 'string' }, reason: { type: 'string' }, days: { type: 'number' }, key: { type: 'string' }, segment: { type: 'string' }, value: { type: 'string' }, rationale: { type: 'string' } }, required: ['type'] } },
  { name: 'open_screen', description: `Navigate the app. One of: ${SCREENS.join(', ')}; or "case:DEMO-CASE-00002", "customer:DEMO-C-00002", "customer-app:DEMO-C-00002", "document:12", "employer:DEMO-E-047", "policies:POL-01", "agents:hami", "audit:customer=DEMO-C-00002", "comms:status=BLOCKED".`, input_schema: { type: 'object', properties: { screen: { type: 'string' } }, required: ['screen'] } },
];

export type ToolOut = { result: any; citations?: { id: string; heading: string }[]; navigate?: string; pending?: any };

const inScope = (p: Persona, f: { segment: Segment; rmId: string | null }) => !(p.scope.segments && !p.scope.segments.includes(f.segment)) && !(p.scope.ownBook && f.rmId !== personaRmId(p));

export async function runTool(p: Persona, name: string, input: any, lang: 'en' | 'ar'): Promise<ToolOut> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { result: { error: `Unknown tool ${name}` } };
  if (tool.roles && !tool.roles(p)) return { result: { error: `Not permitted for ${p.role} (data scope, DESIGN §8).` } };
  const policy = await activePolicy();
  switch (name) {
    case 'search_policy': {
      const q = String(input.query ?? '').slice(0, 200);
      const STOP = new Set(['how', 'much', 'many', 'can', 'the', 'and', 'for', 'what', 'does', 'are', 'you', 'have', 'will', 'with', 'when', 'there', 'about', 'any', 'our', 'your', 'from', 'that', 'this', 'into', 'need', 'want', 'policy', 'rule', 'rules', 'allowed', 'customer', 'customers', 'why', 'which', 'who']);
      const words = [...new Set(q.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])].filter((w) => !STOP.has(w)).slice(0, 8);
      let rows: any[] = [];
      if (words.length) {
        rows = (await pool.query(`SELECT * FROM (SELECT c.*, (SELECT COUNT(*) FROM unnest($1::text[]) w WHERE c.heading ILIKE '%' || w || '%' OR c.id ILIKE '%' || w || '%' OR EXISTS (SELECT 1 FROM unnest(c.tags) t WHERE t ILIKE '%' || w || '%')) * 3 + ts_rank(c.search, to_tsquery('english', $2)) AS rank FROM layer.policy_clauses c) x WHERE rank > 0 ORDER BY rank DESC LIMIT 5`, [words, words.join(' | ')])).rows;
      }
      return { result: rows.map((r: any) => ({ id: r.id, domain: r.domain, version: policy.version, heading: lang === 'ar' ? r.heading_ar : r.heading, text: lang === 'ar' ? r.text_ar : r.text_en, basis: r.basis })), citations: rows.map((r: any) => ({ id: r.id, heading: lang === 'ar' ? r.heading_ar : r.heading })) };
    }
    case 'policy_params': {
      const domain = String(input.domain ?? '').toUpperCase(); const key = input.key ? String(input.key) : null;
      const defs = PARAMS.filter((d) => (key ? d.key === key : d.domain === domain));
      return { result: { version: policy.version, params: defs.map((d) => ({ key: d.key, label: d.label, unit: d.unit, clause: d.clause, value: d.segmented ? Object.fromEntries(SEGMENTS.map((s) => [s, policy.get(d.key, s)])) : policy.get(d.key), basis: d.basis })) }, citations: defs.filter((d) => d.clause).slice(0, 4).map((d) => ({ id: d.clause!, heading: d.label })) };
    }
    case 'data_health': {
      const { health: h } = await health();
      const seg = input.segment as Segment | undefined;
      const out: any = { asOf: h.asOf, customers: h.customers, eligible: h.eligible, eligibleRate: h.eligibleRate, fallouts: h.fallouts, byClass: h.byClass, byReason: h.byReason.filter((r) => r.incidences > 0).slice(0, 20), bySegment: seg ? h.bySegment.filter((s) => s.segment === seg) : h.bySegment, multiReason: h.multiReason, expiriesAhead: h.expiriesAhead, contactability: h.contactability, curable: h.curable, employers: h.employers.slice(0, 6), fields: h.fields };
      if (input.reason) { const r = h.byReason.find((x) => x.code === input.reason); out.reason = r ? { ...r, definition: REASON[r.code].definition, evidence: REASON[r.code].evidence, recheck: REASON[r.code].recheck, contact: REASON[r.code].contact, workflow: REASON[r.code].workflow } : null; }
      return { result: out };
    }
    case 'find_customers': {
      const sc = scopeSql(p, 'k', 'cu');
      const params: unknown[] = [...sc.params]; const where = [sc.sql.replace(/k\.cls/g, 'r.cls')];
      if (input.query) { params.push(`%${String(input.query)}%`); where.push(`(cu.id ILIKE $${params.length} OR cu.name_en ILIKE $${params.length} OR cu.name_ar ILIKE $${params.length} OR cu.rim_no ILIKE $${params.length} OR e.name_en ILIKE $${params.length} OR k.ref ILIKE $${params.length})`); }
      if (input.segment) { params.push(input.segment); where.push(`cu.segment=$${params.length}`); }
      if (input.reason) { params.push(input.reason); where.push(`$${params.length} = ANY(r.reason_codes)`); }
      if (input.cls) { params.push(input.cls); where.push(`r.cls=$${params.length}`); }
      if (input.eligible === true) where.push('r.eligible'); if (input.eligible === false) where.push('NOT r.eligible');
      const rows = (await pool.query(`SELECT cu.id, cu.name_en, cu.segment, cu.status, cu.rm_id, e.name_en AS employer, r.eligible, r.reason_codes, r.cls, r.amount, k.ref AS case_ref, k.state AS case_state FROM core.customers cu LEFT JOIN LATERAL (SELECT eligible, reason_codes, cls, amount FROM core.preapproval_results pr WHERE pr.customer_id=cu.id ORDER BY run_id DESC LIMIT 1) r ON TRUE LEFT JOIN core.employment em ON em.customer_id=cu.id LEFT JOIN core.employers e ON e.id=em.employer_id LEFT JOIN LATERAL (SELECT ref, state FROM layer.cases k WHERE k.customer_id=cu.id AND k.state<>'CLOSED' ORDER BY id DESC LIMIT 1) k ON TRUE WHERE ${where.join(' AND ')} ORDER BY cu.id LIMIT 15`, params)).rows;
      const total = (await pool.query(`SELECT COUNT(*)::int n FROM core.customers cu LEFT JOIN LATERAL (SELECT eligible, reason_codes, cls FROM core.preapproval_results pr WHERE pr.customer_id=cu.id ORDER BY run_id DESC LIMIT 1) r ON TRUE LEFT JOIN core.employment em ON em.customer_id=cu.id LEFT JOIN core.employers e ON e.id=em.employer_id LEFT JOIN LATERAL (SELECT ref, state FROM layer.cases k WHERE k.customer_id=cu.id AND k.state<>'CLOSED' ORDER BY id DESC LIMIT 1) k ON TRUE WHERE ${where.join(' AND ')}`, params)).rows[0].n;
      return { result: { total, customers: rows } };
    }
    case 'customer_360': case 'explain_eligibility': {
      const f = await factsOf({ c: pool, actor: 'dalil' }, String(input.customer_id)).catch(() => null);
      if (!f) return { result: { error: 'No such customer' } };
      if (!inScope(p, f)) return { result: { error: `${f.id} is outside ${p.role}'s scope (${p.sees})` } };
      const q = qualify(f, policy, today());
      if (name === 'explain_eligibility') {
        const w = input.salary || input.drop_standing_orders || input.clear_dpd || input.employer_approved || input.qid_renewed ? whatIf(f, policy, today(), { salaryTotal: input.salary, dropStandingOrders: !!input.drop_standing_orders, clearDpd: !!input.clear_dpd, employerApproved: !!input.employer_approved, qidRenewed: !!input.qid_renewed }) : null;
        return { result: { customer: f.id, name: f.nameEn, segment: f.segment, isQatari: f.isQatari, eligible: q.eligible, amount: q.amount, reasons: q.reasons.map((r) => `${r} ${REASON[r].label}`), cls: q.cls, inputs: q.inputs, failed: q.checks.filter((c) => !c.pass), passed: q.checks.filter((c) => c.pass).map((c) => `${c.code}: ${c.detail}`), whatIf: w ? { eligible: w.eligible, amount: w.amount, reasons: w.reasons, failed: w.checks.filter((c) => !c.pass) } : null }, citations: [{ id: 'POL-04 §4.2', heading: 'Eligible amount' }, { id: 'POL-04 §2.1', heading: 'DBR' }] };
      }
      const kase = (await pool.query(`SELECT ref, cls, state, close_code, reasons, primary_reason, attempts, max_attempts, next_action_at, recheck_on, paused, pause_reason, workflow_id FROM layer.cases WHERE customer_id=$1 ORDER BY id DESC LIMIT 3`, [f.id])).rows;
      const docs = (await pool.query(`SELECT id, type, state, recommendation, overall_confidence, flags, received_at FROM layer.documents WHERE customer_id=$1 ORDER BY id DESC LIMIT 5`, [f.id])).rows;
      return { result: { id: f.id, rim: f.rimNo, name: f.nameEn, name_ar: f.nameAr, segment: f.segment, rm: f.rmId, nationality: f.nationality, isQatari: f.isQatari, dob: f.dob, status: f.status, language: f.lang, qid: { number_last4: f.qidNumber?.slice(-4), expiry: f.qidExpiry }, passport: f.isQatari ? null : { number: f.passportNumber, expiry: f.passportExpiry }, employer: { id: f.employerId, name: f.employerName, status: f.employerStatus }, salary: { basic: f.basic, allowances: f.allowances, social: f.socialAllowance, total: f.salaryTotal, bank: f.salaryBank, credits: f.salaryCredits.slice(-6), explainedGaps: f.explainedGaps }, currentAccount: f.hasCurrentAccount, deposits: f.deposits, facilities: f.facilities, cards: f.cards, standingOrders: f.standingOrders, returnedCheques: f.returnedCheques, notes: f.notes, consents: f.consent, contact: { app: f.contact?.app_registered, push: f.contact?.push_enabled, email: f.contact?.email ? 'on file' : 'none' }, eligibility: { eligible: q.eligible, amount: q.amount, reasons: q.reasons.map((r) => `${r} ${REASON[r].label}`), cls: q.cls, failed: q.checks.filter((c) => !c.pass) }, cases: kase, documents: docs } };
    }
    case 'cases_waiting': {
      const sc = scopeSql(p);
      const approvals = p.scope.metricsOnly ? [] : (await pool.query(`SELECT r.id AS run_id, r.workflow_id, r.title, a.action_type, r.sla_due, k.ref AS case_ref, k.customer_id, cu.name_en, cu.segment, r.result->'recommendation'->>'summary' AS recommendation FROM layer.runs r JOIN layer.approvals a ON a.run_id=r.id AND a.decision='PENDING' LEFT JOIN layer.cases k ON k.id=r.case_id LEFT JOIN core.customers cu ON cu.id=k.customer_id WHERE r.status IN ('WAITING','ESCALATED') AND r.waiting_on_persona=$1 AND (k.id IS NULL OR ${rebase(sc.sql, 1)}) ORDER BY a.created_at LIMIT 25`, [p.key, ...sc.params])).rows;
      const tasks = (await pool.query(`SELECT id, kind, title, due, customer_id FROM layer.tasks WHERE state='OPEN' AND assignee_persona=$1 ORDER BY due LIMIT 25`, [p.key])).rows;
      return { result: { persona: p.role, decisions: approvals, tasks, counts: { decisions: approvals.length, tasks: tasks.length } } };
    }
    case 'case_summary': {
      const k = (await pool.query(`SELECT k.*, cu.name_en, cu.segment FROM layer.cases k JOIN core.customers cu ON cu.id=k.customer_id WHERE k.ref=$1`, [String(input.case_ref).toUpperCase()])).rows[0];
      if (!k) return { result: { error: 'No such case' } };
      if (!inScope(p, { segment: k.segment, rmId: k.rm_id })) return { result: { error: 'Outside your scope' } };
      const [messages, docs, props, runs, trail] = await Promise.all([
        pool.query(`SELECT id, channel, message_type, status, scheduled_for, sent_at, block_reason, block_clause, policy_version, attempt FROM layer.outreach_messages WHERE case_id=$1 ORDER BY scheduled_for`, [k.id]),
        pool.query(`SELECT id, type, state, recommendation, overall_confidence, flags FROM layer.documents WHERE case_id=$1 ORDER BY id`, [k.id]),
        pool.query(`SELECT id, target, field, old_value, new_value, state, decided_by FROM layer.proposed_updates WHERE case_id=$1 ORDER BY id`, [k.id]),
        pool.query(`SELECT id, workflow_id, status, current_step, waiting_on_persona, waiting_event FROM layer.runs WHERE case_id=$1 ORDER BY id`, [k.id]),
        pool.query(`SELECT at, actor_name, act, clause, summary FROM layer.trail WHERE case_id=$1 ORDER BY id DESC LIMIT 15`, [k.id]),
      ]);
      return { result: { case: { ref: k.ref, customer: k.customer_id, name: k.name_en, segment: k.segment, cls: k.cls, state: k.state, close_code: k.close_code, reasons: k.reasons.map((r: string) => `${r} ${REASON[r as keyof typeof REASON]?.label}`), primary: k.primary_reason, workflow: k.workflow_id, attempts: `${k.attempts}/${k.max_attempts}`, next_action_at: k.next_action_at, recheck_on: k.recheck_on, paused: k.paused, pause_reason: k.pause_reason, opened_at: k.opened_at }, messages: messages.rows, documents: docs.rows, proposals: props.rows, runs: runs.rows, trail: trail.rows } };
    }
    case 'outreach_history': {
      const f = await factsOf({ c: pool, actor: 'dalil' }, String(input.customer_id)).catch(() => null);
      if (!f || !inScope(p, f)) return { result: { error: 'No such customer in your scope' } };
      const out = (await pool.query(`SELECT id, channel, message_type, status, attempt, scheduled_for, sent_at, block_reason, block_clause, policy_version, marketing FROM layer.outreach_messages WHERE customer_id=$1 ORDER BY scheduled_for DESC LIMIT 30`, [f.id])).rows;
      const inb = (await pool.query(`SELECT id, channel, received_at, classification, confidence, mode, routed_to, left(body, 160) AS body FROM layer.inbound_messages WHERE customer_id=$1 ORDER BY received_at DESC LIMIT 15`, [f.id])).rows;
      return { result: { customer: f.id, name: f.nameEn, segment: f.segment, consents: f.consent, outbound: out, inbound: inb } };
    }
    case 'document_status': {
      const d = (await pool.query(`SELECT d.id, d.type, d.state, d.recommendation, d.overall_confidence, d.flags, d.verification, d.extracted, d.assurance, d.mode, d.customer_id, k.ref AS case_ref FROM layer.documents d LEFT JOIN layer.cases k ON k.id=d.case_id WHERE d.id=$1`, [Number(input.document_id)])).rows[0];
      if (!d) return { result: { error: 'No such document' } };
      const props = (await pool.query(`SELECT target, field, old_value, new_value, state, confidence FROM layer.proposed_updates WHERE document_id=$1`, [d.id])).rows;
      const run = (await pool.query(`SELECT r.waiting_on_persona FROM layer.runs r JOIN layer.cases k ON k.id=r.case_id WHERE k.ref=$1 AND r.status='WAITING' ORDER BY r.id DESC LIMIT 1`, [d.case_ref])).rows[0];
      return { result: { ...d, extracted: Object.fromEntries(Object.entries(d.extracted ?? {}).filter(([k]) => !['mrz1', 'mrz2'].includes(k))), proposals: props, waitingOn: run?.waiting_on_persona ?? null }, citations: [{ id: 'POL-06 §1.3', heading: 'One-click review threshold' }] };
    }
    case 'employer_review': {
      const e = (await pool.query(`SELECT * FROM core.employers WHERE id=$1`, [String(input.employer_id).toUpperCase()])).rows[0];
      if (!e) return { result: { error: 'No such employer' } };
      const staff = (await pool.query(`SELECT COUNT(*)::int n FROM core.employment WHERE employer_id=$1`, [e.id])).rows[0].n;
      const blocked = (await pool.query(`SELECT COUNT(*)::int n FROM layer.cases k WHERE k.state<>'CLOSED' AND 'R02' = ANY(k.reasons) AND k.customer_id IN (SELECT customer_id FROM core.employment WHERE employer_id=$1)`, [e.id])).rows[0].n;
      const review = (await pool.query(`SELECT state, recommendation, narrative, pack, opened_at, decided_by, decided_at FROM layer.employer_reviews WHERE employer_id=$1 ORDER BY id DESC LIMIT 1`, [e.id])).rows[0];
      return { result: { employer: e, qibSalariedStaff: staff, customersBlocked: blocked, review: review ? { ...review, criteria: review.pack?.criteria } : null }, citations: [{ id: 'POL-03 §5.1', heading: 'Employer approval criteria' }] };
    }
    case 'blocked_today': {
      const days = Number(input.days ?? 1);
      const since = new Date(Date.parse(today() + 'T00:00:00Z') - 3 * 3600_000 - (days - 1) * 86_400_000);
      const blocked = (await pool.query(`SELECT t.at, t.act, t.clause, t.channel, t.case_ref, t.customer_id, t.summary FROM layer.trail t WHERE t.actor_id='hami' AND t.act IN ('BLOCK','DEFER') AND t.at >= $1 ORDER BY t.id DESC LIMIT 30`, [since])).rows;
      const sent = (await pool.query(`SELECT COUNT(*)::int n FROM layer.outreach_messages WHERE status='SENT' AND sent_at >= $1`, [since])).rows[0].n;
      const byClause = (await pool.query(`SELECT clause, COUNT(*)::int n FROM layer.trail WHERE actor_id='hami' AND act IN ('BLOCK','DEFER') AND at >= $1 GROUP BY 1 ORDER BY 2 DESC`, [since])).rows;
      return { result: { since: since.toISOString(), sent, blocked: blocked.length, byClause, items: blocked }, citations: byClause.slice(0, 3).map((b: any) => ({ id: b.clause, heading: 'Hami block' })) };
    }
    case 'propose_action': {
      const type = String(input.type).toUpperCase() as ActionType;
      let subject: any = {}; let label = type.replace(/_/g, ' ').toLowerCase();
      if (input.case_ref) { const k = (await pool.query(`SELECT k.ref, k.cls, k.rm_id, k.customer_id, cu.segment, cu.name_en FROM layer.cases k JOIN core.customers cu ON cu.id=k.customer_id WHERE k.ref=$1`, [String(input.case_ref).toUpperCase()])).rows[0]; if (!k) return { result: { error: 'No such case' } }; subject = { segment: k.segment, cls: k.cls, rmId: k.rm_id }; label += ` on ${k.ref} (${k.name_en}, ${k.segment})`; }
      if (input.key) subject.domain = PARAM[input.key]?.domain;
      if (!allowed(p, type, subject)) return { result: { error: `${p.role} may not ${type.replace(/_/g, ' ').toLowerCase()}${subject.segment ? ` for ${subject.segment}` : ''} (authority matrix). Say who can, and offer to route it.` } };
      const pending = { type, body: { ...input, type }, label, persona: p.key, at: now().toISOString() };
      return { result: { prepared: true, label, note: 'Nothing is sent or changed until the person confirms on screen; Hami checks at confirm time.' }, pending };
    }
    case 'open_screen': return { result: { ok: true }, navigate: String(input.screen) };
  }
  return { result: { error: 'Unhandled tool' } };
}
export { fmtDate };
