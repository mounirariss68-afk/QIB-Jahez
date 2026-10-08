/**
 * Write routes: decisions on runs, case actions, tasks, policy changes,
 * employer reviews, the customer app and mailbox, and the demo controls.
 * Every write runs through the engine; the authority matrix is checked here
 * and nothing is sent or changed on an agent's say-so.
 */
import { Router } from 'express';
import { PERSONA, PARAM, SEGMENT_LABEL, addDays, type ActionType, type PersonaKey, type Segment } from '@jahiz/domain';
import { pool, tx } from '../db.js';
import { now, today, setClock, persistClock } from '../clock.js';
import { activePolicy, invalidatePolicy } from '../policy.js';
import { factsOf, recordPayment } from '../core/connector.js';
import { decide, startRun, resume, setCaseState, closeCase, addTrail, addActivity, type CaseRow } from '../engine/core.js';
import { dispatch, scheduleMessage, cancelScheduled } from '../channels/outreach.js';
import { deliver } from '../channels/adapters.js';
import { scan } from '../agents/raqib.js';
import { requalify } from '../agents/muahil.js';
import { buildPack } from '../agents/muwathiq.js';
import { receive } from '../inbound.js';
import { sendDue, tickAll, advanceClock } from '../scheduler.js';
import { reseed } from '../seed/index.js';
import { invalidateHealth } from '../health.js';
import { personaOf, assertAllowed, allowed, personaRmId } from './session.js';
import { SPECIMEN_KINDS } from '../agents/specimens.js';

export const actions = Router();
const bad = (res: any, e: any) => res.status(e.status ?? 400).json({ error: e.message ?? String(e) });

async function caseByRef(ref: string): Promise<CaseRow & { segment: Segment; name_en: string }> {
  const k = (await pool.query(`SELECT k.*, cu.segment, cu.name_en FROM layer.cases k JOIN core.customers cu ON cu.id=k.customer_id WHERE k.ref=$1`, [ref])).rows[0];
  if (!k) { const e: any = new Error(`Case ${ref} not found`); e.status = 404; throw e; }
  return k;
}

// ------------------------------------------------------------------ decisions
actions.post('/runs/:id/decide', async (req, res) => {
  const p = personaOf(req);
  try {
    const run = (await pool.query(`SELECT r.*, k.ref, cu.segment, k.cls, k.rm_id FROM layer.runs r LEFT JOIN layer.cases k ON k.id=r.case_id LEFT JOIN core.customers cu ON cu.id=k.customer_id WHERE r.id=$1`, [Number(req.params.id)])).rows[0];
    if (!run) return res.status(404).json({ error: 'Run not found' });
    if (run.waiting_on_persona !== p.key) return res.status(403).json({ error: `This decision waits on ${PERSONA[run.waiting_on_persona as PersonaKey]?.role ?? 'someone else'}, not ${p.role}` });
    const decision = req.body.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    await tx((c) => decide(c, { runId: run.id, persona: p.key, decision, reason: req.body.reason, edits: req.body.edits, scenario: !!req.body.scenario }));
    invalidateHealth();
    res.json({ ok: true, caseRef: run.ref ?? null });
  } catch (e) { bad(res, e); }
});

// ------------------------------------------------------------------ case actions
actions.post('/cases/:ref/action', async (req, res) => {
  const p = personaOf(req);
  try {
    const k = await caseByRef(req.params.ref);
    const subject = { segment: k.segment, cls: k.cls as any, rmId: k.rm_id };
    const type = String(req.body.type) as ActionType;
    const policy = await activePolicy();
    const out = await tx(async (c) => {
      const f = await factsOf({ c, actor: p.key }, k.customer_id);
      const who = `${p.name} (${p.role})`;
      switch (type) {
        case 'SEND_REMINDER': case 'SEND_REQUEST': {
          assertAllowed(p, type, subject);
          const m = (await c.query(`SELECT id FROM layer.outreach_messages WHERE case_id=$1 AND status='SCHEDULED' ORDER BY scheduled_for LIMIT 1`, [k.id])).rows[0];
          if (!m) throw new Error('Nothing is scheduled on this case');
          await c.query(`UPDATE layer.outreach_messages SET scheduled_for=$2, approved_by=COALESCE(approved_by, $3) WHERE id=$1`, [m.id, now(), p.key === 'rm' ? 'rm' : null]);
          await addTrail(c, { actor_type: 'HUMAN', actor_id: p.key, actor_name: who, autonomy: null, act: 'SEND_NOW', case_id: k.id, case_ref: k.ref, customer_id: k.customer_id, summary: `${p.name} sent the next scheduled message now`, summary_ar: `${p.name_ar} أرسل الرسالة التالية الآن` });
          const r = await dispatch(c, m.id, f, policy);
          return { result: r.status === 'SENT' ? `Sent by ${r.channel}` : `Hami blocked it: ${r.reason} [${r.clause}]`, messageId: m.id };
        }
        case 'RESCHEDULE': {
          assertAllowed(p, type, subject);
          const days = Number(req.body.days ?? 7);
          const r = await c.query(`UPDATE layer.outreach_messages SET scheduled_for = scheduled_for + ($2 || ' days')::interval WHERE case_id=$1 AND status='SCHEDULED' RETURNING id`, [k.id, String(days)]);
          await addTrail(c, { actor_type: 'HUMAN', actor_id: p.key, actor_name: who, autonomy: null, act: 'RESCHEDULE', case_id: k.id, case_ref: k.ref, customer_id: k.customer_id, reason: req.body.reason, summary: `${p.name} moved ${r.rowCount} scheduled message(s) by ${days} day(s)${req.body.reason ? `: ${req.body.reason}` : ''}`, summary_ar: 'أعاد جدولة الرسائل' });
          return { result: `${r.rowCount} message(s) moved by ${days} day(s)` };
        }
        case 'PAUSE_CASE': {
          assertAllowed(p, type, subject);
          await setCaseState(c, k, 'PAUSED', who, req.body.reason ?? 'Paused by a person', { paused: true, pause_reason: req.body.reason ?? 'Paused' });
          await addTrail(c, { actor_type: 'HUMAN', actor_id: p.key, actor_name: who, autonomy: null, act: 'PAUSE', case_id: k.id, case_ref: k.ref, customer_id: k.customer_id, reason: req.body.reason, summary: `${p.name} paused the case${req.body.reason ? `: ${req.body.reason}` : ''}`, summary_ar: 'أوقف الحالة مؤقتاً' });
          return { result: 'Paused: Hami blocks every outbound message while paused' };
        }
        case 'RESUME_CASE': {
          assertAllowed(p, type, subject);
          await setCaseState(c, k, 'AWAITING_REPLY', who, 'Resumed', { paused: false, pause_reason: null });
          await addTrail(c, { actor_type: 'HUMAN', actor_id: p.key, actor_name: who, autonomy: null, act: 'RESUME', case_id: k.id, case_ref: k.ref, customer_id: k.customer_id, summary: `${p.name} resumed the case`, summary_ar: 'استأنف الحالة' });
          return { result: 'Resumed' };
        }
        case 'ESCALATE_TO_RM': {
          assertAllowed(p, type, subject);
          const r = await startRun(c, { caseId: k.id, workflowId: 'WF-17', title: `Escalation — ${k.ref}`, title_ar: `تصعيد — ${k.ref}`, channel: 'FORM', payload: { from: 'person', by: p.key } });
          await addTrail(c, { actor_type: 'HUMAN', actor_id: p.key, actor_name: who, autonomy: null, act: 'ESCALATE', case_id: k.id, case_ref: k.ref, customer_id: k.customer_id, summary: `${p.name} escalated the case to a person (WF-17 run ${r.id})`, summary_ar: 'صعّد الحالة' });
          return { result: `WF-17 opened (run ${r.id})` };
        }
        case 'RERUN_QUALIFICATION': {
          assertAllowed(p, type, subject);
          const r = await requalify(c, k.customer_id, { trigger: `Re-run by ${p.name}`, actor: p.key });
          return { result: r.eligible ? `Eligible: QAR ${r.amount.toLocaleString('en-US')} — hand-off started` : `Still not eligible: ${r.reasons.join(', ')}`, requalify: r };
        }
        case 'CLOSE_UNRESPONSIVE': {
          assertAllowed(p, type, subject);
          await closeCase(c, k, 'UNRESPONSIVE', who, req.body.reason);
          await addTrail(c, { actor_type: 'HUMAN', actor_id: p.key, actor_name: who, autonomy: null, act: 'CLOSE', case_id: k.id, case_ref: k.ref, customer_id: k.customer_id, reason: req.body.reason, summary: `${p.name} closed the case as unresponsive${req.body.reason ? `: ${req.body.reason}` : ''}`, summary_ar: 'أغلق الحالة: لا استجابة' });
          return { result: 'Closed as unresponsive' };
        }
        case 'PROPOSE_RESTRICTION': {
          assertAllowed(p, type, subject);
          const r = await startRun(c, { caseId: k.id, workflowId: 'WF-17', title: `Restriction proposal — ${k.ref}`, title_ar: `اقتراح تقييد — ${k.ref}`, channel: 'FORM', payload: { from: 'person', by: p.key, skipBrief: true }, doneAtStart: ['brief'] });
          return { result: `Restriction proposed (run ${r.id})` };
        }
        default: throw new Error(`Unknown action ${type}`);
      }
    });
    invalidateHealth();
    res.json({ ok: true, ...out });
  } catch (e) { bad(res, e); }
});

actions.post('/customers/:id/requalify', async (req, res) => {
  const p = personaOf(req);
  try {
    const f = await factsOf({ c: pool, actor: p.key }, req.params.id);
    assertAllowed(p, 'RERUN_QUALIFICATION', { segment: f.segment, rmId: f.rmId });
    const r = await tx((c) => requalify(c, f.id, { trigger: `Re-run by ${p.name}`, actor: p.key }));
    invalidateHealth();
    res.json({ ok: true, ...r });
  } catch (e) { bad(res, e); }
});

// ------------------------------------------------------------------ tasks
actions.post('/tasks/:id/done', async (req, res) => {
  const p = personaOf(req);
  try {
    const t = (await pool.query(`SELECT * FROM layer.tasks WHERE id=$1`, [Number(req.params.id)])).rows[0];
    if (!t) return res.status(404).json({ error: 'Task not found' });
    if (t.assignee_persona !== p.key && p.key !== 'head') return res.status(403).json({ error: `This task belongs to ${PERSONA[t.assignee_persona as PersonaKey]?.role}` });
    const outcome = String(req.body.outcome ?? 'Done');
    const out = await tx(async (c) => {
      const policy = await activePolicy(c);
      await c.query(`UPDATE layer.tasks SET state='DONE', done_at=$2, outcome=$3 WHERE id=$1`, [t.id, now(), outcome]);
      const kase = t.case_id ? (await c.query(`SELECT * FROM layer.cases WHERE id=$1`, [t.case_id])).rows[0] : null;
      await addTrail(c, { actor_type: 'HUMAN', actor_id: p.key, actor_name: `${p.name} (${p.role})`, autonomy: null, act: 'TASK_DONE', case_id: t.case_id, case_ref: kase?.ref, customer_id: t.customer_id, summary: `${p.name} completed "${t.title}": ${outcome}`, summary_ar: `${p.name_ar} أنجز المهمة: ${outcome}` });
      let note = 'Done';
      if (t.kind === 'RM_APPROVE_MESSAGE' && t.customer_id) {
        const brief = typeof t.brief === 'string' ? JSON.parse(t.brief) : t.brief;
        const f = await factsOf({ c, actor: p.key }, t.customer_id);
        await c.query(`UPDATE layer.outreach_messages SET approved_by='rm', scheduled_for=LEAST(scheduled_for, $2) WHERE id=$1 AND status='SCHEDULED'`, [brief.messageId, now()]);
        const r = await dispatch(c, brief.messageId, f, policy);
        note = r.status === 'SENT' ? `Approved and sent by ${r.channel}` : `Approved; Hami: ${r.reason}`;
      }
      if (t.kind === 'RM_SEND' && t.customer_id && kase) {
        const f = await factsOf({ c, actor: p.key }, t.customer_id);
        const run = (await c.query(`SELECT payload FROM layer.runs WHERE id=$1`, [t.run_id])).rows[0];
        const row = await scheduleMessage(c, { kase, f, policy, channel: 'RM', type: 'OFFER', reason: null, attempt: 0, createdBy: 'munadi', runId: t.run_id, marketing: true, approvedBy: 'rm', vars: { amount: Number(run?.payload?.amount ?? 0).toLocaleString('en-US'), tenor: run?.payload?.tenor ?? 72 } });
        await c.query(`UPDATE layer.outreach_messages SET status='SENT', sent_at=$2 WHERE id=$1`, [row.id, now()]);
        await deliver(c, { customerId: f.id, channel: 'INAPP', subject: row.subject, body: row.body, lang: f.lang, ref: kase.ref, messageId: row.id, meta: { type: 'OFFER', marketing: true, amount: Number(run?.payload?.amount ?? 0).toLocaleString('en-US'), byRm: true } });
        note = 'Offer sent by the RM (recorded on the phone as an in-app message)';
      }
      if ((t.kind === 'CALL' || t.kind === 'RM_BRIEF') && kase && /reached|collected|will upload|agreed/i.test(outcome)) {
        await c.query(`UPDATE layer.cases SET next_action_at=$2, updated_at=$3 WHERE id=$1`, [kase.id, new Date(now().getTime() + 7 * 86_400_000), now()]);
        note = 'Outcome recorded; the case waits a week for the document';
      }
      const waiting = t.run_id ? (await c.query(`SELECT id, waiting_on_persona FROM layer.runs WHERE id=$1 AND status='WAITING' AND waiting_on_persona=$2`, [t.run_id, p.key])).rows[0] : null;
      if (waiting && t.kind !== 'RM_APPROVE_MESSAGE') await decide(c, { runId: waiting.id, persona: p.key, decision: 'APPROVED', reason: outcome });
      return note;
    });
    res.json({ ok: true, result: out });
  } catch (e) { bad(res, e); }
});

// ------------------------------------------------------------------ employer reviews
actions.post('/employers/:id/review', async (req, res) => {
  const p = personaOf(req);
  try {
    assertAllowed(p, 'OPEN_EMPLOYER_REVIEW');
    const out = await tx(async (c) => {
      const policy = await activePolicy(c);
      const existing = (await c.query(`SELECT r.id FROM layer.runs r WHERE r.workflow_id='WF-05' AND r.status='WAITING' AND r.payload->>'employerId'=$1`, [req.params.id])).rows[0];
      if (existing) return { runId: existing.id, note: 'Review already open' };
      const anyCase = (await c.query(`SELECT k.id FROM layer.cases k JOIN core.employment em ON em.customer_id=k.customer_id WHERE em.employer_id=$1 AND k.state<>'CLOSED' ORDER BY k.id LIMIT 1`, [req.params.id])).rows[0];
      await buildPack(c, req.params.id, policy, {});
      const r = await startRun(c, { caseId: anyCase?.id ?? null, workflowId: 'WF-05', title: `Employer review ${req.params.id}`, title_ar: `مراجعة جهة العمل ${req.params.id}`, channel: 'FORM', payload: { variant: 'UNAPPROVED', employerId: req.params.id, by: p.key }, doneAtStart: ['route', 'plan', 'send', 'await', 'examine', 'check', 'apply', 'requalify', 'escalate'] });
      return { runId: r.id, note: 'Pack built; Credit Policy decides' };
    });
    res.json({ ok: true, ...out });
  } catch (e) { bad(res, e); }
});
actions.post('/employers/:id/decide', async (req, res) => {
  const p = personaOf(req);
  try {
    assertAllowed(p, 'DECIDE_EMPLOYER');
    const run = (await pool.query(`SELECT r.id FROM layer.runs r WHERE r.workflow_id='WF-05' AND r.status='WAITING' AND r.waiting_on_persona='credit' AND r.payload->>'employerId'=$1 ORDER BY r.id DESC LIMIT 1`, [req.params.id])).rows[0];
    if (!run) return res.status(404).json({ error: 'No employer review is waiting for a decision' });
    await tx((c) => decide(c, { runId: run.id, persona: p.key, decision: req.body.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED', reason: req.body.reason, scenario: !!req.body.scenario }));
    invalidateHealth();
    res.json({ ok: true });
  } catch (e) { bad(res, e); }
});

// ------------------------------------------------------------------ policies
actions.post('/policies/propose', async (req, res) => {
  const p = personaOf(req);
  try {
    const { key, segment, value, rationale } = req.body;
    const def = PARAM[key]; if (!def) throw new Error(`Unknown parameter ${key}`);
    assertAllowed(p, 'PROPOSE_POLICY_CHANGE', { domain: def.domain });
    const coerced = def.type === 'number' ? Number(value) : def.type === 'boolean' ? value === true || value === 'true' : def.type === 'list' ? (Array.isArray(value) ? value : String(value).split(',').map((s: string) => s.trim()).filter(Boolean)) : String(value);
    const r = await tx((c) => startRun(c, { caseId: null, workflowId: 'WF-18', title: `Policy change: ${def.label}${segment ? ` (${SEGMENT_LABEL[segment as Segment]})` : ''}`, title_ar: `تغيير السياسة: ${def.label}`, channel: 'FORM', payload: { domain: def.domain, key, segment: def.segmented ? segment : undefined, value: coerced, rationale, proposer: p.key }, scenario: req.body.scenario ?? null }));
    res.json({ ok: true, runId: r.id, status: r.status, waitingOn: r.waiting_on_persona });
  } catch (e) { bad(res, e); }
});
actions.post('/policies/decide', async (req, res) => {
  const p = personaOf(req);
  try {
    const run = (await pool.query(`SELECT * FROM layer.runs WHERE workflow_id='WF-18' AND status='WAITING' AND waiting_on_persona=$1 ORDER BY id DESC LIMIT 1`, [p.key])).rows[0];
    if (!run) return res.status(404).json({ error: 'No policy change is waiting on you' });
    assertAllowed(p, 'APPROVE_POLICY_CHANGE', { domain: run.payload.domain });
    await tx((c) => decide(c, { runId: run.id, persona: p.key, decision: req.body.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED', reason: req.body.reason, scenario: !!req.body.scenario }));
    invalidatePolicy(); invalidateHealth();
    res.json({ ok: true });
  } catch (e) { bad(res, e); }
});

// ------------------------------------------------------------------ the customer's phone and mailbox
actions.get('/customer/:id/phone', async (req, res) => {
  try {
    const f = await factsOf({ c: pool, actor: 'customer-app' }, req.params.id);
    const inbox = (await pool.query(`SELECT * FROM core.device_inbox WHERE customer_id=$1 ORDER BY at DESC, id DESC LIMIT 60`, [f.id])).rows;
    const kase = (await pool.query(`SELECT * FROM layer.cases WHERE customer_id=$1 AND state<>'CLOSED' ORDER BY id DESC LIMIT 1`, [f.id])).rows[0] ?? null;
    const offer = inbox.find((m: any) => m.meta?.type === 'OFFER') ?? null;
    const latest = (await pool.query(`SELECT eligible, amount, reason_codes FROM core.preapproval_results WHERE customer_id=$1 ORDER BY run_id DESC LIMIT 1`, [f.id])).rows[0] ?? null;
    const sos = (await pool.query(`SELECT * FROM core.standing_orders WHERE customer_id=$1 ORDER BY id`, [f.id])).rows;
    res.json({ customer: { id: f.id, nameEn: f.nameEn, nameAr: f.nameAr, lang: f.lang, segment: f.segment, app: f.contact?.app_registered, push: f.contact?.push_enabled, email: f.contact?.email, mobile: f.contact?.mobile, marketing: f.consent.marketing_consent, optouts: f.consent.channel_optouts, dnc: f.consent.dnc, hasCurrentAccount: f.hasCurrentAccount, qidExpiry: f.qidExpiry, passportExpiry: f.passportExpiry, isQatari: f.isQatari },
      inbox, case: kase, offer, eligibility: latest, standingOrders: sos, specimens: SPECIMEN_KINDS.filter((k) => f.isQatari ? !k.kind.startsWith('passport') : true), now: now().toISOString() });
  } catch (e) { bad(res, e); }
});
actions.post('/customer/:id/upload', async (req, res) => {
  try {
    const specimen = req.body.specimen as string | undefined; const image = req.body.image as { data: string; mime: string; name?: string; type?: string } | undefined;
    if (!specimen && !image) throw new Error('Pick a specimen or attach an image');
    const r = await tx((c) => receive(c, { channel: 'INAPP', customerId: req.params.id, body: req.body.text ?? 'Uploaded from QIB Mobile (demo)', attachments: [specimen ? { specimen: specimen as any } : { image: image! }], assurance: req.body.assurance ?? 'APP_UPLOAD', scenario: req.body.scenario ?? null }));
    await pool.query(`UPDATE layer.triggers SET last_fired_at=$1, fired_count=fired_count+1, last_result=$2 WHERE key='inbound_app'`, [now(), `Upload from ${req.params.id}`]);
    invalidateHealth();
    res.json({ ok: true, ...r });
  } catch (e) { bad(res, e); }
});
actions.post('/customer/:id/reply', async (req, res) => {
  try {
    const r = await tx((c) => receive(c, { channel: 'INAPP', customerId: req.params.id, body: String(req.body.text ?? ''), scenario: req.body.scenario ?? null }));
    await pool.query(`UPDATE layer.triggers SET last_fired_at=$1, fired_count=fired_count+1, last_result=$2 WHERE key='inbound_app'`, [now(), `Reply from ${req.params.id}`]);
    res.json({ ok: true, ...r });
  } catch (e) { bad(res, e); }
});
actions.post('/customer/:id/accept-offer', async (req, res) => {
  try {
    await tx(async (c) => {
      const f = await factsOf({ c, actor: 'customer-app' }, req.params.id);
      await c.query(`INSERT INTO core.device_inbox (customer_id, channel, kind, at, subject, body, lang, meta) VALUES ($1,'INAPP','OUTGOING',$2,'One Click Finance','Offer accepted in the app',$3,'{"accepted":true}')`, [f.id, now(), f.lang]);
      await c.query(`INSERT INTO layer.integration_log (at, system, direction, verb, resource, status, note, actor) VALUES ($1,'ONECLICK','IN','POST','/acceptances',200,$2,'customer-app')`, [now(), `${f.id} accepted the pre-approved offer (simulated disbursement)`]);
      await addTrail(c, { actor_type: 'SYSTEM', actor_id: 'oneclick', actor_name: 'One Click Finance', autonomy: null, act: 'ACCEPT', customer_id: f.id, summary: `${f.id} accepted the One Click offer in the app (simulated)`, summary_ar: 'قبل العميل العرض في التطبيق' });
      await addActivity(c, { trigger: 'Customer app', agent: null, action: `${f.id} accepted the One Click offer`, result: 'Simulated disbursement logged', customer_id: f.id });
    });
    res.json({ ok: true });
  } catch (e) { bad(res, e); }
});
actions.get('/customer/:id/mailbox', async (req, res) => {
  try {
    const f = await factsOf({ c: pool, actor: 'customer-app' }, req.params.id);
    const mails = (await pool.query(`SELECT * FROM core.device_inbox WHERE customer_id=$1 AND channel='EMAIL' ORDER BY at DESC LIMIT 40`, [f.id])).rows;
    const kase = (await pool.query(`SELECT ref FROM layer.cases WHERE customer_id=$1 AND state<>'CLOSED' ORDER BY id DESC LIMIT 1`, [f.id])).rows[0] ?? null;
    res.json({ customer: { id: f.id, nameEn: f.nameEn, email: f.contact?.email, lang: f.lang, isQatari: f.isQatari }, mails, caseRef: kase?.ref ?? null, specimens: SPECIMEN_KINDS.filter((k) => f.isQatari ? !k.kind.startsWith('passport') : true) });
  } catch (e) { bad(res, e); }
});
actions.post('/customer/:id/email', async (req, res) => {
  try {
    const f = await factsOf({ c: pool, actor: 'customer-app' }, req.params.id);
    const r = await tx((c) => receive(c, { channel: 'EMAIL', customerId: req.body.anonymous ? null : f.id, from: req.body.from ?? f.contact?.email ?? '', subject: String(req.body.subject ?? ''), body: String(req.body.body ?? ''), attachments: req.body.specimen ? [{ specimen: req.body.specimen, otherCustomerId: req.body.otherCustomerId }] : req.body.image ? [{ image: req.body.image }] : [], assurance: 'EMAIL', scenario: req.body.scenario ?? null }));
    await pool.query(`UPDATE layer.triggers SET last_fired_at=$1, fired_count=fired_count+1, last_result=$2 WHERE key='inbound_mail'`, [now(), `E-mail from ${req.body.from ?? f.contact?.email}`]);
    res.json({ ok: true, ...r });
  } catch (e) { bad(res, e); }
});
actions.post('/customer/:id/payment', async (req, res) => {
  try {
    await tx(async (c) => {
      await recordPayment({ c, actor: 'core' }, req.params.id);
      const run = (await c.query(`SELECT r.id FROM layer.runs r JOIN layer.cases k ON k.id=r.case_id WHERE k.customer_id=$1 AND r.workflow_id='WF-12' AND r.status='WAITING_EVENT' ORDER BY r.id DESC LIMIT 1`, [req.params.id])).rows[0];
      await addActivity(c, { trigger: 'Core event: payment', agent: null, action: `Instalment paid by ${req.params.id}`, result: run ? 'WF-12 resumes: cooling period' : 'No arrears case waiting', customer_id: req.params.id, scenario_key: req.body.scenario ?? null });
      if (run) await resume(c, run.id, { kind: 'PAYMENT', payload: { at: now().toISOString() } });
    });
    invalidateHealth();
    res.json({ ok: true });
  } catch (e) { bad(res, e); }
});

// ------------------------------------------------------------------ demo controls
actions.post('/control/scan', async (req, res) => {
  try { const r = await tx((c) => scan(c, { trigger: `Scan on demand (${personaOf(req).name})`, ids: req.body.customerId ? [req.body.customerId] : undefined })); invalidateHealth(); res.json({ ok: true, ...r }); } catch (e) { bad(res, e); }
});
actions.post('/control/tick', async (req, res) => {
  try { const r = await tx((c) => req.body.customerId ? sendDue(c, { customerId: req.body.customerId }) : tickAll(c)); invalidateHealth(); res.json({ ok: true, ...r }); } catch (e) { bad(res, e); }
});
actions.post('/control/clock', async (req, res) => {
  try { const days = Math.max(1, Math.min(90, Number(req.body.days ?? 1))); const r = await advanceClock(days); invalidateHealth(); res.json({ ok: true, ...r, today: today(), now: now().toISOString() }); } catch (e) { bad(res, e); }
});
actions.post('/control/reset', async (req, res) => {
  try {
    const params = req.body.params;
    await reseed(params);
    invalidateHealth(); invalidatePolicy();
    res.json({ ok: true, today: today() });
  } catch (e) { bad(res, e); }
});
actions.post('/triggers/:key/fire', async (req, res) => {
  const key = req.params.key;
  try {
    let result: any = {};
    if (key === 'scan') { result = await tx((c) => scan(c, { trigger: 'Scan (fired from Triggers)' })); }
    else if (key === 'due') { result = await tx((c) => sendDue(c)); }
    else if (key === 'timeout' || key === 'recheck') { result = await tx((c) => tickAll(c)); }
    else if (key === 'clock') { result = await advanceClock(Number(req.body.days ?? 1)); }
    else return res.status(400).json({ error: `${key} fires on its event, not on demand` });
    invalidateHealth();
    res.json({ ok: true, result, now: now().toISOString(), today: today() });
  } catch (e) { bad(res, e); }
});
export { addDays, cancelScheduled, setClock, persistClock, allowed, personaRmId };
