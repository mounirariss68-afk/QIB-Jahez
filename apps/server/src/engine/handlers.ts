/**
 * Step handlers: what each agent and each connector step actually does.
 * Keyed `WF-xx:stepKey`; `WF-xx:stepKey:rejected` runs when a person declines
 * that human step. Human steps are resolved to a persona by WHO (null = skip).
 */
import type { PoolClient } from 'pg';
import { REASON, PERSONA, daysBetween, addDays, addMonths, fmtDate, nextAllowed, guard, type PersonaKey, type Policy, type Channel, type Segment, SEGMENT_LABEL, PARAM, DOMAINS, personaForApprover } from '@jahiz/domain';
import type { HCtx, Run, CaseRow, StepOutcome } from './core.js';
import { startRun, resume, closeCase, setCaseState, addTrail, addActivity } from './core.js';
import { applyUpdate, external, factsOf, type FullFacts } from '../core/connector.js';
import { now, today } from '../clock.js';
import { invalidatePolicy } from '../policy.js';
import { planSequence, draftRmBrief } from '../agents/munadi.js';
import { examine, type DocRow } from '../agents/fahis.js';
import { requalify, requalifyEmployer } from '../agents/muahil.js';
import { buildPack } from '../agents/muwathiq.js';
import { scheduleCadence } from '../agents/munabbih.js';
import { classify, matchEmail } from '../agents/mustaqbil.js';
import { scheduleMessage, dispatch, cancelScheduled, usableChannels } from '../channels/outreach.js';
import { buildSpecimen, specimenDef, type SpecimenKind } from '../agents/specimens.js';

type H = (h: HCtx) => Promise<StepOutcome>;
type Who = (x: { c: PoolClient; run: Run; kase: CaseRow | null; policy: Policy; facts: () => Promise<FullFacts> }) => Promise<PersonaKey | null>;

const ASK_TAIL = ['examine', 'check', 'apply', 'requalify', 'offer'];

// ------------------------------------------------------------------ who decides

export const WHO: Record<string, Who> = {
  'WF-06:review': async ({ run }) => (run.payload.matched === false ? 'ops' : null),
  'WF-11:review': async ({ run }) => (run.payload.consolidation ? 'credit' : null),
  'WF-15:approve': async ({ facts, run }) => { const f = await facts().catch(() => null); const seg = f?.segment ?? run.payload.segment; return seg === 'HNWI' || seg === 'VVIP' ? 'rm' : null; },
  'WF-09:compliance': async ({ run }) => (run.payload.route === 'COMPLIANCE' ? 'compliance' : null),
  'WF-09:check': async ({ run }) => (run.payload.route === 'DORMANT' ? 'supervisor' : null),
  'WF-05:check': async ({ run }) => (run.payload.variant === 'MISSING' ? 'supervisor' : null),
  'WF-05:decide': async ({ run }) => (run.payload.variant === 'UNAPPROVED' ? 'credit' : null),
  'WF-16:human': async ({ run }) => (run.payload.kind === 'DNC_REQUEST' ? 'compliance' : ['HARDSHIP', 'COMPLAINT', 'DISPUTE'].includes(run.payload.kind) ? 'ops' : null),
  'WF-17:decide': async ({ run, policy, facts }) => (run.payload.restrictionProposed ? personaForApprover(policy.str('restrictionApprover', (await facts()).segment)) : null),
  'WF-12:ack': async ({ run }) => (run.payload.handedOver ? 'collections' : null),
};

// ------------------------------------------------------------------ the ASK spine (WF-02/03/04/05-missing/07/09-dormant)

const plan: H = async (h) => {
  const f = await h.facts();
  const kase = h.kase!;
  const p = await planSequence(h.c, kase, f, h.policy, { runId: h.run.id, scenario: h.run.scenario_key, reRequest: !!h.run.payload.reRequest });
  if (p.rmOnly) {
    const amount = h.run.payload.amountIfCured ?? null;
    const brief = await draftRmBrief(h.c, kase, f, h.policy, amount, h.run.id);
    await h.task({ kind: 'RM_BRIEF', assignee: 'rm', title: `${kase.payload?.preExpiry ? 'Pre-expiry' : REASON[(kase.primary_reason ?? 'R07') as keyof typeof REASON].label}: ${f.nameEn} (${SEGMENT_LABEL[f.segment]})`, title_ar: `ملخص: ${f.nameAr}`, brief: brief.text, brief_mode: brief.mode, dueDays: h.policy.num('slaRmDays') });
    await h.caseState('QUEUED', 'RM-only segment: brief prepared, no automated contact');
    await h.trail({ act: 'BRIEF', clause: 'POL-01 §6.1', summary: `${SEGMENT_LABEL[f.segment]}: no automated contact. Drafted the RM brief (${brief.mode === 'claude' ? 'Claude, for review' : 'template'}) and opened the RM task.`, summary_ar: 'لا تواصل آلي: أُعدّ ملخص مدير العلاقة' });
    return { decision: p.note, outputs: { rmOnly: true, briefMode: brief.mode }, skip: ['send'] };
  }
  if (p.rmApprovalRequired) {
    for (const id of p.messages) {
      const m = (await h.c.query(`SELECT * FROM layer.outreach_messages WHERE id=$1`, [id])).rows[0];
      await h.c.query(`INSERT INTO layer.tasks (kind, case_id, run_id, customer_id, assignee_persona, title, title_ar, brief, due, state, created_at) VALUES ('RM_APPROVE_MESSAGE',$1,$2,$3,'rm',$4,$5,$6,$7,'OPEN',$8)`,
        [kase.id, h.run.id, f.id, `Approve the ${m.message_type.toLowerCase().replace('_', ' ')} to ${f.nameEn} by ${m.channel}`, `اعتماد الرسالة إلى ${f.nameAr}`, JSON.stringify({ messageId: id, subject: m.subject, body: m.body, scheduledFor: m.scheduled_for }), m.scheduled_for, now()]);
    }
    await h.trail({ act: 'PLAN', clause: 'POL-01 §6.1', summary: `${SEGMENT_LABEL[f.segment]}: ${p.messages.length} message(s) prepared; each waits for the RM's approval before Hami lets it leave`, summary_ar: 'الرسائل بانتظار اعتماد مدير العلاقة' });
  }
  return { decision: `${p.attempts} attempt(s): ${p.channels.join(' → ')}`, outputs: { attempts: p.attempts, channels: p.channels, messages: p.messages, rmApprovalRequired: p.rmApprovalRequired } };
};

const send: H = async (h) => {
  const f = await h.facts();
  const first = (await h.c.query(`SELECT * FROM layer.outreach_messages WHERE case_id=$1 AND run_id=$2 AND status='SCHEDULED' ORDER BY scheduled_for LIMIT 1`, [h.kase!.id, h.run.id])).rows[0];
  if (!first) return { decision: 'Nothing to send', skip: [] };
  if (new Date(first.scheduled_for) <= h.at && !first.meta?.rmApproval) {
    const r = await dispatch(h.c, first.id, f, h.policy, h.run.scenario_key);
    return { decision: r.status === 'SENT' ? `Sent by ${r.channel}` : `Blocked: ${r.reason} [${r.clause}]`, outputs: { messageId: first.id, ...r } };
  }
  await h.caseState('QUEUED', `First notice scheduled for ${fmtDate(new Date(first.scheduled_for).toISOString())}`);
  return { decision: `Scheduled for ${new Date(first.scheduled_for).toISOString().slice(0, 16).replace('T', ' ')} UTC (window ${first.window_used})`, outputs: { messageId: first.id, scheduledFor: first.scheduled_for } };
};

/** Wait for the reply; the inbound router resumes this step with the classification. */
const awaitReply: H = async (h) => {
  const kase = h.kase!;
  if (!h.event) { if (kase.state === 'CLASSIFIED' || kase.state === 'QUEUED') await h.caseState('AWAITING_REPLY'); return { wait: 'REPLY', outputs: { since: h.at } }; }
  const ev = h.event;
  if (ev.kind === 'TIMEOUT' && kase.payload?.preExpiry && !kase.payload?.expiredNow) return { wait: 'REPLY', outputs: { event: ev, note: 'Pre-expiry watch: no reply expected; the expiry event decides' } };
  if (ev.kind === 'TIMEOUT') {
    await h.caseState('ESCALATED', 'Attempts exhausted');
    await h.trail({ act: 'TIMEOUT', clause: 'POL-01 §5.1', summary: `No reply after ${kase.attempts} notice(s); a person steps in [POL-01 §5.1]`, summary_ar: 'لا رد بعد استنفاد الإشعارات: يتدخل شخص' });
    return { decision: 'Attempts exhausted → escalation', outputs: { event: ev }, skip: ASK_TAIL };
  }
  const cls = ev.payload.cls as string;
  if (cls === 'DOCUMENT' || cls === 'ACCEPT') {
    const n = await cancelScheduled(h.c, kase.id, cls === 'DOCUMENT' ? 'Reply received' : 'Accepted');
    await h.caseState('REPLY_RECEIVED', `${cls === 'DOCUMENT' ? 'Document' : 'Acceptance'} received by ${ev.payload.channel}`);
    await h.patch({ documentIds: ev.payload.documentIds ?? [], inboundId: ev.payload.inboundId, accepted: cls === 'ACCEPT' });
    await h.trail({ act: 'RECEIVE', channel: ev.payload.channel, summary: `${cls === 'DOCUMENT' ? `Received ${(ev.payload.documentIds ?? []).length} document(s)` : 'Customer accepted'} by ${ev.payload.channel} (${ev.payload.mode === 'claude' ? 'Claude' : 'Offline'} classification, ${Number(ev.payload.confidence ?? 0).toFixed(2)}); ${n} scheduled notice(s) cancelled`, summary_ar: 'استُلم الرد وأُلغيت الإشعارات المجدولة' });
    return { decision: cls === 'DOCUMENT' ? 'Document received → examiner' : 'Accepted → checker', outputs: { event: ev }, skip: cls === 'ACCEPT' ? ['examine', 'escalate'] : ['escalate'] };
  }
  if (cls === 'OUT_OF_OFFICE') {
    await h.c.query(`UPDATE layer.outreach_messages SET scheduled_for = scheduled_for + interval '7 days' WHERE case_id=$1 AND status='SCHEDULED'`, [kase.id]);
    await h.trail({ act: 'RESCHEDULE', summary: 'Out-of-office reply: remaining notices moved a week later', summary_ar: 'رد خارج المكتب: تأجيل الإشعارات أسبوعاً' });
    return { wait: 'REPLY', outputs: { event: ev } };
  }
  if (cls === 'QUESTION') {
    await h.task({ kind: 'REPLY_DRAFT', assignee: 'ops', title: `Reply to ${kase.ref}: the customer asked a question`, title_ar: `الرد على سؤال العميل ${kase.ref}`, brief: String(ev.payload.text ?? '').slice(0, 500), dueDays: 1 });
    await h.trail({ act: 'ROUTE', summary: 'Customer asked a question: a reply is drafted for a person to review; the case keeps waiting', summary_ar: 'سؤال من العميل: صيغ رد للمراجعة' });
    return { wait: 'REPLY', outputs: { event: ev } };
  }
  // opt-out, hardship, complaint, dispute, DNC: WF-16 handles it; this run keeps waiting (paused if hardship/complaint).
  return { wait: 'REPLY', outputs: { event: ev } };
};

const examineStep: H = async (h) => {
  const f = await h.facts();
  const ids: number[] = h.run.payload.documentIds ?? (h.run.payload.documentId ? [h.run.payload.documentId] : []);
  if (!ids.length) return { decision: 'No document to examine', skip: ['check', 'apply'] };
  const outs = [];
  for (const id of ids) {
    const doc = (await h.c.query(`SELECT * FROM layer.documents WHERE id=$1`, [id])).rows[0] as DocRow;
    if (!doc) continue;
    await h.c.query(`UPDATE layer.documents SET case_id=COALESCE(case_id,$2) WHERE id=$1`, [id, h.kase!.id]);
    outs.push(await examine(h.c, doc, f, h.policy, { runId: h.run.id, scenario: h.run.scenario_key }));
  }
  const worst = outs.find((o) => o.recommendation === 'REJECT') ?? outs.find((o) => o.recommendation === 'REVIEW') ?? outs[0];
  await h.caseState('UNDER_REVIEW', worst.summary);
  const salaryElsewhere = outs.some((o) => o.extracted?.paid_to_bank && String(o.extracted.paid_to_bank).toUpperCase() !== 'QIB');
  if (salaryElsewhere) await h.patch({ salaryElsewhere: true, salaryBank: outs.find((o) => o.extracted?.paid_to_bank)?.extracted.paid_to_bank });
  const actionType = h.wf.id === 'WF-04' ? 'ACCEPT_EXPLAINED_GAP' : 'APPROVE_UPDATE';
  if (outs.every((o) => o.proposals.length === 0) && worst.recommendation === 'APPROVE') return { decision: 'Verified; no record change needed', outputs: { exams: outs.map((o) => o.summary) }, skip: ['check', 'apply'] };
  return { decision: worst.summary, outputs: { exams: outs.map((o) => ({ summary: o.summary, flags: o.flags, overall: o.overall, mode: o.mode, oneClick: o.oneClick, proposals: o.proposals.map((p) => p.label) })) },
    recommend: { verdict: worst.recommendation === 'APPROVE' ? 'APPROVE' : worst.recommendation === 'REJECT' ? 'DECLINE' : 'REVIEW', summary: worst.summary, summary_ar: worst.summary_ar }, actionType };
};

/** The checker declined: reject the document and the proposals, re-request, and note Compliance for a different person's document. */
const checkRejected: H = async (h) => {
  const f = await h.facts();
  const kase = h.kase!;
  const ids: number[] = h.run.payload.documentIds ?? [];
  await h.c.query(`UPDATE layer.documents SET state='REJECTED' WHERE id = ANY($1)`, [ids]);
  await h.c.query(`UPDATE layer.proposed_updates SET state='REJECTED', decided_by=$2, decided_at=$3, reason=$4 WHERE document_id = ANY($1) AND state='PROPOSED'`, [ids, h.run.payload.lastDecidedBy, now(), h.run.payload.lastDecisionReason]);
  const docs = (await h.c.query(`SELECT * FROM layer.documents WHERE id = ANY($1)`, [ids])).rows;
  const other = docs.some((d: any) => (d.flags ?? []).includes('OTHER_PERSON'));
  if (other) {
    await h.task({ kind: 'COMPLIANCE_REVIEW', assignee: 'compliance', title: `Different person's document on ${kase.ref}`, title_ar: `وثيقة شخص آخر في الحالة ${kase.ref}`, brief: `A ${docs[0].type} that belongs to a different person was received by ${docs[0].assurance === 'EMAIL' ? 'e-mail' : 'app'} for ${f.id} ${f.nameEn}. Rejected by the checker. POL-06 §3.1: raise a Compliance note.`, dueDays: h.policy.num('slaComplianceDays') });
    await h.trail({ actor_id: 'fahis', actor_name: 'Fahis', autonomy: 'A1', act: 'FLAG', clause: 'POL-06 §3.1', summary: `A different person's document: Compliance task opened`, summary_ar: 'وثيقة شخص آخر: مهمة للامتثال' });
  }
  const why = h.run.payload.lastDecisionReason ?? (docs[0]?.flags?.[0] ? String(docs[0].flags[0]).toLowerCase().replace(/_/g, ' ') : 'it could not be verified');
  await setCaseState(h.c, kase, 'UPDATE_REJECTED', PERSONA[h.run.payload.lastDecidedBy as PersonaKey]?.name ?? 'Checker', why);
  const docType = docs[0]?.type === 'QID' ? 'Qatar ID' : docs[0]?.type === 'PASSPORT' ? 'passport' : String(docs[0]?.type ?? 'document').toLowerCase().replace('_', ' ');
  await startRun(h.c, { caseId: kase.id, workflowId: h.wf.id, title: `${h.run.title} (re-request)`, title_ar: `${h.run.title_ar} (إعادة طلب)`, channel: 'EVENT', scenario: h.run.scenario_key, payload: { ...h.run.payload, reRequest: true, documentIds: [], docType, rejectWhy: why, docAsk: `a clear, current ${docType}` } });
  return { decision: 'Rejected → re-request' };
};

const apply: H = async (h) => {
  const f = await h.facts();
  const kase = h.kase!;
  const props = (await h.c.query(`SELECT * FROM layer.proposed_updates WHERE customer_id=$1 AND state='PROPOSED' AND (run_id=$2 OR document_id = ANY($3)) ORDER BY id`, [f.id, h.run.id, h.run.payload.documentIds ?? []])).rows;
  const applied: string[] = [];
  for (const p of props) {
    const before = await applyUpdate(h.conn, f.id, p.target, p.field, p.new_value, `Proposal #${p.id} approved by ${h.run.payload.lastDecidedBy ?? 'checker'}`);
    await h.c.query(`UPDATE layer.proposed_updates SET state='APPLIED', decided_by=$2, decided_at=$3, applied_at=$3, old_value=COALESCE(old_value,$4) WHERE id=$1`, [p.id, h.run.payload.lastDecidedBy ?? 'supervisor', now(), before]);
    await h.trail({ act: 'WRITE', before: { [p.field]: before }, after: { [p.field]: p.new_value }, clause: 'POL-06 §1.2', evidence_ref: p.document_id ? `document:${p.document_id}` : undefined, summary: `Wrote ${p.target}.${p.field} for ${f.id}: ${p.old_value ?? before ?? '—'} → ${p.field === 'renew' ? JSON.parse(p.new_value).expires_on : p.new_value} (approved by ${PERSONA[h.run.payload.lastDecidedBy as PersonaKey]?.name ?? 'the checker'})`, summary_ar: `كتب ${p.target}.${p.field}` });
    applied.push(`${p.target}.${p.field}`);
  }
  await h.c.query(`UPDATE layer.documents SET state='APPLIED' WHERE id = ANY($1) AND state IN ('PROPOSED','REVIEW')`, [h.run.payload.documentIds ?? []]);
  await h.caseState('RECORD_UPDATED', applied.join(', '));
  await h.activity({ trigger: 'Approved update', action: `Applied ${applied.length} field update(s) to ${f.id} through the core connector`, result: applied.join(', ') || 'nothing to apply', clause: 'POL-06 §1.2' });
  if (!applied.length) return { decision: 'Nothing to apply' };
  // A salary-elsewhere certificate confirms the record but does not cure R01; mark the case so re-qualification can park it.
  if (h.run.payload.salaryElsewhere) await h.c.query(`UPDATE layer.cases SET payload = payload || '{"salaryElsewhere":true}'::jsonb WHERE id=$1`, [kase.id]);
  return { decision: `Applied ${applied.length} update(s)`, outputs: { applied } };
};

const requalifyStep: H = async (h) => {
  const kase = h.kase!;
  const r = await requalify(h.c, kase.customer_id, { trigger: `${h.wf.id} record updated`, scenario: h.run.scenario_key, runId: h.run.id });
  if (h.wf.id === 'WF-04' && h.run.payload.salaryElsewhere) return { decision: r.eligible ? 'Eligible' : `Not yet: ${r.reasons.join(', ')} — salary paid elsewhere, offer path`, outputs: r as any };
  return { decision: r.eligible ? `Eligible for QAR ${r.amount.toLocaleString('en-US')} → WF-15` : `Not yet: ${r.reasons.join(', ')}`, outputs: { eligible: r.eligible, amount: r.amount, reasons: r.reasons, handoffRunId: r.handoffRunId }, skip: ['offer'].filter(() => !h.run.payload.salaryElsewhere) };
};

const escalate: H = async (h) => {
  const kase = h.kase!;
  const r = await startRun(h.c, { caseId: kase.id, workflowId: 'WF-17', title: `Escalation — ${kase.ref}`, title_ar: `تصعيد — ${kase.ref}`, channel: 'EVENT', scenario: h.run.scenario_key, payload: { from: h.wf.id, primary: kase.primary_reason } });
  return { decision: `WF-17 opened (run ${r.id})`, outputs: { escalationRunId: r.id } };
};

const ASK: Record<string, H> = { plan, send, await: awaitReply, examine: examineStep, apply, requalify: requalifyStep, escalate };
const spine = (wfId: string, extra: Record<string, H> = {}): Record<string, H> => {
  const out: Record<string, H> = {};
  for (const [k, fn] of Object.entries({ ...ASK, ...extra })) out[`${wfId}:${k}`] = fn;
  out[`${wfId}:check:rejected`] = checkRejected;
  return out;
};

// ------------------------------------------------------------------ WF-04 salary-elsewhere offer

const salaryOffer: H = async (h) => {
  const f = await h.facts();
  const kase = h.kase!;
  if (!h.run.payload.salaryElsewhere) return { decision: 'Salary paid to QIB: no offer needed', status: 'SKIPPED' };
  if (!h.policy.bool('salaryTransferOffer')) return { decision: 'Salary-transfer offer is off (POL-03 §3.1)' };
  if (f.consent.marketing_consent) {
    const ch = (h.policy.list('channelOrder', f.segment) as Channel[]).find((x) => usableChannels(f, h.policy).includes(x)) ?? 'EMAIL';
    const row = await scheduleMessage(h.c, { kase, f, policy: h.policy, channel: ch, type: 'SALARY_TRANSFER_OFFER', reason: 'R01', attempt: 0, createdBy: 'munadi', runId: h.run.id, marketing: true, meta: { separate: true } });
    await h.trail({ act: 'OFFER', clause: 'POL-07 §2.1', summary: `Salary paid at ${h.run.payload.salaryBank}: marketing consent on file, so a separate salary-transfer offer is scheduled by ${ch} [POL-03 §3.1]`, summary_ar: 'عرض تحويل الراتب كرسالة منفصلة' });
    await closeCase(h.c, kase, 'CURED_AWAITING_HISTORY', 'Hami', 'Salary evidence verified; transfer offer sent; history accumulates');
    await h.c.query(`UPDATE layer.cases SET recheck_on=$2, recheck_reason='Salary history after transfer' WHERE id=$1`, [kase.id, addMonths(today(), h.policy.num('salaryWindowMonths'))]);
    return { decision: `Offer scheduled by ${ch}; case parked cured-awaiting-history`, outputs: { messageId: row.id } };
  }
  await h.task({ kind: f.segment === 'MASS' ? 'BRANCH' : 'RM_BRIEF', assignee: f.segment === 'MASS' ? 'ops' : 'rm', title: `Salary-transfer conversation with ${f.nameEn} (no marketing consent)`, title_ar: `حديث تحويل الراتب مع ${f.nameAr}`, brief: `Salary is paid at ${h.run.payload.salaryBank}. No marketing consent on file, so no offer message may be sent [POL-07 §2.1]; raise it in the branch or by the RM.`, dueDays: 3 });
  await h.trail({ act: 'BLOCK', clause: 'POL-07 §2.1', summary: `No marketing consent: the salary-transfer offer becomes a ${f.segment === 'MASS' ? 'branch' : 'RM'} task instead of a message`, summary_ar: 'لا موافقة تسويقية: مهمة بدلاً من رسالة' });
  await closeCase(h.c, kase, 'AWAITING_CONSENT', 'Hami', 'Salary paid elsewhere; no consent for the offer');
  return { decision: 'No consent → task, case parked awaiting-consent' };
};

// ------------------------------------------------------------------ WF-05 employer

const wf05: Record<string, H> = {
  'WF-05:route': async (h) => {
    const f = await h.facts();
    if (!f.employerId) { await h.patch({ variant: 'MISSING', docType: 'salary certificate', docAsk: 'a recent salary certificate naming your employer' }); return { decision: 'Employer missing → ask the customer', skip: ['pack', 'decide', 'apply_employer', 'requalify_all', 'inform'] }; }
    const open = (await h.c.query(`SELECT id FROM layer.employer_reviews WHERE employer_id=$1 AND state='OPEN'`, [f.employerId])).rows[0];
    await h.patch({ variant: 'UNAPPROVED', employerId: f.employerId });
    await h.caseState('REVIEW_OPEN', `Employer ${f.employerId} ${f.employerStatus}`);
    if (open) { await h.trail({ act: 'ROUTE', summary: `Employer ${f.employerId} is already under review (#${open.id}); this case follows that decision`, summary_ar: 'جهة العمل قيد المراجعة بالفعل' }); return { decision: `Follows employer review #${open.id}`, stop: 'COMPLETED' }; }
    return { decision: `Employer ${f.employerId} ${f.employerStatus} → review`, skip: ['plan', 'send', 'await', 'examine', 'check', 'apply', 'requalify', 'escalate'] };
  },
  'WF-05:pack': async (h) => {
    const pack = await buildPack(h.c, h.run.payload.employerId, h.policy, { runId: h.run.id, scenario: h.run.scenario_key });
    return { decision: `${pack.recommendation}: ${pack.criteria.filter((x) => x.ok).length}/${pack.criteria.length} criteria; ${pack.affected.blockedOnlyByEmployer} customers unblocked on approval`, outputs: { criteria: pack.criteria, affected: pack.affected, narrative: pack.narrative, mode: pack.mode },
      recommend: { verdict: pack.recommendation === 'APPROVE' ? 'APPROVE' : pack.recommendation === 'DECLINE' ? 'DECLINE' : 'REVIEW', summary: pack.narrative }, actionType: 'DECIDE_EMPLOYER' };
  },
  'WF-05:decide:rejected': async (h) => {
    await h.c.query(`UPDATE layer.employer_reviews SET state='DECLINED', decided_by=$2, decided_at=$3, reason=$4 WHERE employer_id=$1 AND state='OPEN'`, [h.run.payload.employerId, h.run.payload.lastDecidedBy, now(), h.run.payload.lastDecisionReason]);
    await applyUpdate(h.conn, h.kase!.customer_id, 'employers', h.run.payload.employerId, 'UNAPPROVED', 'Declined by Credit Policy');
    await h.c.query(`UPDATE layer.cases SET cls='B', state='DECIDED', recheck_on=$2, recheck_reason='Employer declined; re-review in 6 months', updated_at=$3 WHERE customer_id IN (SELECT customer_id FROM core.employment WHERE employer_id=$1) AND state<>'CLOSED' AND 'R02' = ANY(reasons)`, [h.run.payload.employerId, addMonths(today(), 6), now()]);
    return { decision: 'Employer declined' };
  },
  'WF-05:apply_employer': async (h) => {
    const before = await applyUpdate(h.conn, h.kase!.customer_id, 'employers', h.run.payload.employerId, 'APPROVED', `Approved by ${h.run.payload.lastDecidedBy}`);
    await h.c.query(`UPDATE layer.employer_reviews SET state='APPROVED', decided_by=$2, decided_at=$3, reason=$4 WHERE employer_id=$1 AND state='OPEN'`, [h.run.payload.employerId, h.run.payload.lastDecidedBy, now(), h.run.payload.lastDecisionReason]);
    await h.trail({ act: 'WRITE', before: { approval_status: before }, after: { approval_status: 'APPROVED' }, clause: 'POL-03 §5.1', summary: `Wrote employers.${h.run.payload.employerId}.approval_status: ${before} → APPROVED`, summary_ar: 'اعتماد جهة العمل في السجل' });
    return { decision: 'Employer approved on the register', outputs: { before } };
  },
  'WF-05:requalify_all': async (h) => {
    const r = await requalifyEmployer(h.c, h.run.payload.employerId, { trigger: `Employer ${h.run.payload.employerId} approved`, scenario: h.run.scenario_key, runId: h.run.id });
    await h.patch({ requalified: r });
    await h.activity({ trigger: 'Employer approved', action: `Re-qualified ${r.length} customer(s) of ${h.run.payload.employerId}`, result: `${r.filter((x) => x.eligible).length} now eligible`, clause: 'POL-04 §4.2' });
    return { decision: `${r.length} re-qualified, ${r.filter((x) => x.eligible).length} eligible`, outputs: { requalified: r } };
  },
  'WF-05:inform': async (h) => {
    const list: { id: string; eligible: boolean }[] = h.run.payload.requalified ?? [];
    const emp = (await h.c.query(`SELECT name_en, name_ar FROM core.employers WHERE id=$1`, [h.run.payload.employerId])).rows[0];
    let n = 0;
    for (const x of list) {
      const f = await factsOf(h.conn, x.id);
      const ch = usableChannels(f, h.policy)[0]; if (!ch) continue;
      await scheduleMessage(h.c, { kase: null, f, policy: h.policy, channel: ch, type: 'EMPLOYER_INFO', reason: 'R02', attempt: 0, createdBy: 'munadi', runId: h.run.id, vars: { employer: f.lang === 'ar' ? emp?.name_ar : emp?.name_en } }); n++;
    }
    await h.trail({ actor_id: 'munadi', actor_name: 'Munadi', autonomy: 'A3', act: 'PLAN', clause: 'POL-07 §1.1', summary: `Service message to ${n} customer(s) of ${emp?.name_en}: employer now approved`, summary_ar: `رسالة خدمة إلى ${n} عميلاً` });
    return { decision: `${n} service message(s) scheduled`, outputs: { informed: n } };
  },
};

// ------------------------------------------------------------------ WF-06 inbound

const wf06: Record<string, H> = {
  'WF-06:match': async (h) => {
    const p = h.run.payload;
    const inb = (await h.c.query(`SELECT * FROM layer.inbound_messages WHERE id=$1`, [p.inboundId])).rows[0];
    let customerId = inb.customer_id as string | null, caseId = inb.case_id as number | null, by = 'app identity';
    if (inb.channel === 'EMAIL' && !customerId) { const m = await matchEmail(h.c, inb.from_addr ?? '', inb.subject ?? '', inb.body); customerId = m.customerId; caseId = m.caseId; by = m.by; }
    else if (customerId && !caseId) { caseId = (await h.c.query(`SELECT id FROM layer.cases WHERE customer_id=$1 AND state<>'CLOSED' ORDER BY id DESC LIMIT 1`, [customerId])).rows[0]?.id ?? null; }
    await h.c.query(`UPDATE layer.inbound_messages SET customer_id=$2, case_id=$3, matched_by=$4 WHERE id=$1`, [inb.id, customerId, caseId, by]);
    await h.patch({ matched: !!customerId, customerId, caseId });
    if (caseId) await h.c.query(`UPDATE layer.runs SET case_id=$2 WHERE id=$1`, [h.run.id, caseId]);
    if (!customerId) { await h.trail({ act: 'ROUTE', summary: `Inbound ${inb.channel} from ${inb.from_addr ?? 'unknown'} could not be matched: parked in the unmatched inbox`, summary_ar: 'بريد غير مطابق' }); return { decision: 'Unmatched → a person', skip: ['classify', 'route'] }; }
    return { decision: `Matched ${customerId}${caseId ? ` / case #${caseId}` : ' (no open case)'} by ${by}`, outputs: { customerId, caseId, by } };
  },
  'WF-06:classify': async (h) => {
    const inb = (await h.c.query(`SELECT * FROM layer.inbound_messages WHERE id=$1`, [h.run.payload.inboundId])).rows[0];
    const cls = await classify(h.c, inb.body, (inb.attachments ?? []).length, inb.customer_id ? (await factsOf(h.conn, inb.customer_id)).lang : 'en', h.run.id);
    await h.c.query(`UPDATE layer.inbound_messages SET classification=$2, confidence=$3, mode=$4 WHERE id=$1`, [inb.id, cls.cls, Math.round(cls.confidence * 1000) / 1000, cls.mode]);
    await h.patch({ cls: cls.cls, confidence: cls.confidence, mode: cls.mode });
    await h.trail({ act: 'CLASSIFY', channel: inb.channel, summary: `Classified the ${inb.channel} reply as ${cls.cls} (${cls.confidence.toFixed(2)}, ${cls.mode === 'claude' ? 'Claude' : 'Offline'}: ${cls.note})`, summary_ar: `صنّف الرد: ${cls.cls}`, case_id: h.run.payload.caseId, customer_id: inb.customer_id });
    await h.activity({ trigger: `Inbound ${inb.channel}`, action: `Classified reply from ${inb.customer_id}`, result: `${cls.cls} (${cls.confidence.toFixed(2)}, ${cls.mode})` });
    return { decision: `${cls.cls} ${cls.confidence.toFixed(2)} [${cls.mode}]`, outputs: cls as any };
  },
  'WF-06:route': async (h) => {
    const p = h.run.payload;
    const inb = (await h.c.query(`SELECT * FROM layer.inbound_messages WHERE id=$1`, [p.inboundId])).rows[0];
    const f = await factsOf(h.conn, p.customerId);
    const kase = p.caseId ? (await h.c.query(`SELECT * FROM layer.cases WHERE id=$1`, [p.caseId])).rows[0] as CaseRow : null;
    const cls = p.cls as string;
    const waiting = kase ? (await h.c.query(`SELECT id, workflow_id FROM layer.runs WHERE case_id=$1 AND status='WAITING_EVENT' AND waiting_event='REPLY' ORDER BY id DESC LIMIT 1`, [kase.id])).rows[0] : null;
    let routed = '';
    if (['OPT_OUT', 'DNC_REQUEST', 'HARDSHIP', 'COMPLAINT', 'DISPUTE'].includes(cls)) {
      const r = await startRun(h.c, { caseId: kase?.id ?? null, workflowId: 'WF-16', title: `${cls.replace('_', ' ')} — ${f.nameEn}`, title_ar: `${cls} — ${f.nameAr}`, channel: 'INBOUND', scenario: h.run.scenario_key, payload: { kind: cls, inboundId: inb.id, channel: inb.channel, customerId: f.id, text: inb.body } });
      routed = `WF-16 run ${r.id}`;
      if (waiting) await resume(h.c, waiting.id, { kind: 'REPLY', payload: { cls, inboundId: inb.id, channel: inb.channel, text: inb.body, confidence: p.confidence, mode: p.mode } });
    } else if (cls === 'DOCUMENT' || cls === 'ACCEPT' || cls === 'QUESTION' || cls === 'OUT_OF_OFFICE' || cls === 'DECLINE') {
      const documentIds = (await h.c.query(`SELECT id FROM layer.documents WHERE inbound_id=$1`, [inb.id])).rows.map((r: any) => r.id);
      if (cls === 'DECLINE' && kase) { await closeCase(h.c, kase, 'WITHDRAWN', 'Mustaqbil', 'Customer declined'); routed = 'case closed withdrawn'; }
      else if (waiting) { await resume(h.c, waiting.id, { kind: 'REPLY', payload: { cls, inboundId: inb.id, channel: inb.channel, text: inb.body, documentIds, confidence: p.confidence, mode: p.mode } }); routed = `resumed ${waiting.workflow_id} run ${waiting.id}`; }
      else if (cls === 'DOCUMENT' && kase && kase.workflow_id && documentIds.length) {
        const r = await startRun(h.c, { caseId: kase.id, workflowId: kase.workflow_id, title: `Unsolicited document — ${kase.ref}`, title_ar: `وثيقة غير مطلوبة — ${kase.ref}`, channel: 'INBOUND', scenario: h.run.scenario_key, payload: { documentIds, inboundId: inb.id, primary: kase.primary_reason, variant: 'MISSING' }, doneAtStart: ['route', 'plan', 'send', 'await', 'triage'] });
        routed = `examiner (run ${r.id})`;
      } else if (cls === 'DOCUMENT' && documentIds.length) {
        await h.task({ kind: 'DOCUMENT_REVIEW', assignee: 'ops', title: `Unsolicited document from ${f.nameEn}`, title_ar: `وثيقة غير مطلوبة من ${f.nameAr}`, brief: `${documentIds.length} document(s) received with no open case.`, dueDays: 1 }); routed = 'documents queue (no open case)';
      } else if (cls === 'QUESTION') { await h.task({ kind: 'REPLY_DRAFT', assignee: 'ops', title: `Question from ${f.nameEn}`, title_ar: `سؤال من ${f.nameAr}`, brief: inb.body.slice(0, 500), dueDays: 1 }); routed = 'reply draft task'; }
      else routed = 'noted';
    } else { routed = 'archived (unrelated)'; }
    await h.c.query(`UPDATE layer.inbound_messages SET routed_to=$2, state='ROUTED' WHERE id=$1`, [inb.id, routed]);
    await h.trail({ act: 'ROUTE', summary: `Routed the ${cls} reply: ${routed}`, summary_ar: `وُجّه الرد: ${routed}`, case_id: kase?.id, case_ref: kase?.ref, customer_id: f.id });
    return { decision: routed, outputs: { routed }, skip: ['review'] };
  },
};

// ------------------------------------------------------------------ WF-08 current account

const wf08: Record<string, H> = {
  'WF-08:consent': async (h) => {
    const f = await h.facts(); const kase = h.kase!;
    if (f.consent.marketing_consent) { await h.trail({ act: 'ALLOW', clause: 'POL-07 §2.1', summary: 'Marketing consent on file: the current-account offer may be sent in-app', summary_ar: 'موافقة تسويقية: يمكن إرسال العرض' }); await h.patch({ actionType: 'APPROVE_UPDATE' }); return { decision: 'Consent on file → offer' }; }
    if (f.segment === 'MASS') { await h.trail({ act: 'BLOCK', clause: 'POL-07 §2.1', summary: 'No marketing consent: the offer cannot be sent; Mass case parked awaiting-consent', summary_ar: 'لا موافقة: الحالة متوقفة بانتظار الموافقة' }); await closeCase(h.c, kase, 'AWAITING_CONSENT', 'Hami', 'No marketing consent'); return { decision: 'No consent → parked', stop: 'COMPLETED' }; }
    await h.task({ kind: 'RM_BRIEF', assignee: 'rm', title: `Open a current account with ${f.nameEn} (no marketing consent)`, title_ar: `فتح حساب جارٍ مع ${f.nameAr}`, brief: 'No marketing consent on file, so no offer message [POL-07 §2.1]. Raise it at the next contact.', dueDays: 3 });
    await h.caseState('REVIEW_OPEN', 'RM/branch task, no consent'); return { decision: 'No consent → RM task', stop: 'COMPLETED' };
  },
  'WF-08:offer': async (h) => {
    const f = await h.facts(); const kase = h.kase!;
    const ch = (usableChannels(f, h.policy).find((x) => x === 'INAPP' || x === 'PUSH') ?? usableChannels(f, h.policy)[0] ?? 'EMAIL') as Channel;
    const row = await scheduleMessage(h.c, { kase, f, policy: h.policy, channel: ch, type: 'REQUEST', reason: 'R08', attempt: 1, createdBy: 'munadi', runId: h.run.id, marketing: true });
    await h.c.query(`UPDATE layer.cases SET max_attempts=1, updated_at=$2 WHERE id=$1`, [kase.id, now()]);
    if (new Date(row.scheduled_for) <= h.at) { const r = await dispatch(h.c, row.id, f, h.policy, h.run.scenario_key); return { decision: r.status === 'SENT' ? `Offer sent by ${r.channel}` : `Blocked: ${r.reason}`, outputs: r as any }; }
    return { decision: `Offer scheduled by ${ch}`, outputs: { messageId: row.id } };
  },
  'WF-08:await': awaitReply,
  'WF-08:apply': async (h) => {
    const f = await h.facts();
    const before = await applyUpdate(h.conn, f.id, 'accounts', 'current', 'ACTIVE', `Opening approved by ${h.run.payload.lastDecidedBy}`);
    await h.trail({ act: 'WRITE', before: { current_account: before ?? 'none' }, after: { current_account: 'ACTIVE' }, clause: 'POL-06 §1.2', summary: `Current account ${before ? 'reactivated' : 'opened'} (simulated) for ${f.id}`, summary_ar: 'فُتح الحساب الجاري (محاكاة)' });
    await h.caseState('RECORD_UPDATED', 'Current account flag set');
    return { decision: before ? 'Reactivated' : 'Opened (simulated)' };
  },
  'WF-08:requalify': requalifyStep,
};

// ------------------------------------------------------------------ WF-09 status

const wf09: Record<string, H> = {
  'WF-09:triage': async (h) => {
    const f = await h.facts(); const kase = h.kase!;
    const s = f.status;
    if (s === 'DORMANT') { await h.patch({ route: 'DORMANT', docType: 'Qatar ID', docAsk: 'your current Qatar ID' }); return { decision: 'Dormant → reactivation request', skip: ['compliance'] }; }
    const to = s === 'BLOCKED_KYC' ? (f.isQatari || (f.qidExpiry && f.qidExpiry < today()) ? 'WF-02' : 'WF-03') : s === 'BLOCKED_SALARY' ? 'WF-04' : s === 'BLOCKED_DELINQ' ? 'WF-12' : null;
    if (to) {
      await h.patch({ route: to });
      await h.c.query(`UPDATE layer.cases SET workflow_id=$2, cls=$3, updated_at=$4 WHERE id=$1`, [kase.id, to, to === 'WF-12' ? 'D' : 'A', now()]);
      await h.trail({ act: 'ROUTE', summary: `Status ${s} → ${to} handles it`, summary_ar: `الحالة ${s} ← ${to}` });
      await startRun(h.c, { caseId: kase.id, workflowId: to, title: `${s} — ${f.nameEn}`, title_ar: `${s} — ${f.nameAr}`, channel: 'EVENT', scenario: h.run.scenario_key, payload: { primary: kase.primary_reason, fromStatus: s } });
      return { decision: `→ ${to}`, stop: 'COMPLETED' };
    }
    await h.patch({ route: 'COMPLIANCE' });
    await h.task({ kind: 'COMPLIANCE_REVIEW', assignee: 'compliance', title: `Status ${s}: ${f.nameEn}`, title_ar: `الحالة ${s}: ${f.nameAr}`, brief: 'No contact permitted. Review the status and the note behind it.', dueDays: h.policy.num('slaComplianceDays') });
    await h.caseState('SUPPRESSED', `Status ${s}: Compliance queue, no contact`);
    return { decision: `${s} → Compliance, no contact`, skip: ['plan', 'send', 'await', 'examine', 'check', 'apply', 'requalify', 'escalate'] };
  },
  'WF-09:apply': async (h) => {
    const f = await h.facts();
    const before = await applyUpdate(h.conn, f.id, 'customers', 'status', 'NORMAL', `Reactivation approved by ${h.run.payload.lastDecidedBy}`);
    await h.trail({ act: 'WRITE', before: { status: before }, after: { status: 'NORMAL' }, clause: 'POL-06 §1.2', summary: `Status ${before} → NORMAL for ${f.id}`, summary_ar: 'إعادة تفعيل الحالة' });
    await h.caseState('RECORD_UPDATED', 'Reactivated');
    return { decision: `${before} → NORMAL` };
  },
};

// ------------------------------------------------------------------ WF-10 / 11 / 13 / 14 (class B and C)

const scheduleRecheck = async (h: HCtx, on: string, why: string) => {
  await h.c.query(`UPDATE layer.cases SET recheck_on=$2, recheck_reason=$3, updated_at=$4 WHERE id=$1`, [h.kase!.id, on, why, now()]);
  await h.caseState('RECHECK_SCHEDULED', `${why} → ${on}`);
  await h.trail({ act: 'SCHEDULE', summary: `Re-check scheduled for ${fmtDate(on)}: ${why}`, summary_ar: `جُدولت إعادة الفحص: ${on}` });
  return { decision: `Re-check ${on}: ${why}` };
};

const wfBC: Record<string, H> = {
  'WF-10:queue': async (h) => {
    const f = await h.facts(); const kase = h.kase!;
    const note = (await h.c.query(`SELECT * FROM core.cautionary_notes WHERE customer_id=$1 AND lifted_on IS NULL ORDER BY id DESC LIMIT 1`, [f.id])).rows[0];
    await h.patch({ noteType: note?.type, noteId: note?.id, actionType: 'CLEAR_CAUTIONARY_NOTE' });
    await h.caseState('REVIEW_OPEN', `Cautionary note ${note?.type}`);
    await h.trail({ act: 'QUEUE', clause: 'POL-05 §1.1', summary: `Cautionary note ${note?.type} (set ${note?.set_on} by ${note?.set_by}; lifts when: ${note?.lifting_condition}) → Compliance queue; no contact`, summary_ar: 'ملاحظة تحذيرية → قائمة الامتثال' });
    const remediable = h.policy.list('noteTypesRemediable').includes(note?.type);
    return { decision: `${note?.type} → Compliance${remediable ? ' (may be reclassified to a workflow)' : ''}`, outputs: { note }, recommend: { verdict: 'REVIEW', summary: remediable ? `${note?.type} is on the remediable list: Compliance may reclassify it to ${note?.type === 'KYC_EXPIRED' ? 'WF-02/03' : 'WF-04'} instead of keeping it.` : `${note?.type}: clear when "${note?.lifting_condition}" is met, otherwise keep.` } };
  },
  'WF-10:decide:rejected': async (h) => { await h.caseState('DECIDED', 'Note kept'); return scheduleRecheck(h, addMonths(today(), 3), 'Cautionary note kept; review again'); },
  'WF-10:apply': async (h) => {
    const f = await h.facts();
    const reclass = h.run.payload.reclassify as string | undefined;
    if (reclass) {
      const to = h.run.payload.noteType === 'KYC_EXPIRED' ? (f.qidExpiry && f.qidExpiry < today() ? 'WF-02' : 'WF-03') : 'WF-04';
      await applyUpdate(h.conn, f.id, 'cautionary_notes', h.run.payload.noteType, h.run.payload.lastDecidedBy, 'Reclassified by Compliance');
      await h.c.query(`UPDATE layer.cases SET workflow_id=$2, cls='A', updated_at=$3 WHERE id=$1`, [h.kase!.id, to, now()]);
      await h.trail({ act: 'WRITE', after: { note: 'lifted', reclassified_to: to }, summary: `Note ${h.run.payload.noteType} lifted and reclassified to ${to}`, summary_ar: `أُعيد تصنيف الملاحظة إلى ${to}` });
      await startRun(h.c, { caseId: h.kase!.id, workflowId: to, title: `Reclassified from ${h.run.payload.noteType} — ${f.nameEn}`, title_ar: `أُعيد تصنيفها — ${f.nameAr}`, channel: 'EVENT', scenario: h.run.scenario_key, payload: { primary: to === 'WF-04' ? 'R01' : to === 'WF-02' ? 'R07' : 'R06' } });
      return { decision: `Reclassified → ${to}`, skip: ['requalify'] };
    }
    const before = await applyUpdate(h.conn, f.id, 'cautionary_notes', h.run.payload.noteType, h.run.payload.lastDecidedBy, `Cleared by Compliance: ${h.run.payload.lastDecisionReason ?? ''}`);
    await h.trail({ act: 'WRITE', before: { note: before }, after: { note: 'lifted' }, summary: `Cautionary note ${h.run.payload.noteType} lifted (${h.run.payload.lastDecisionReason ?? 'cleared'})`, summary_ar: 'رُفعت الملاحظة التحذيرية' });
    await h.caseState('RECORD_UPDATED', 'Note lifted');
    return { decision: 'Note lifted' };
  },
  'WF-10:requalify': requalifyStep,
  'WF-11:timeline': async (h) => {
    const f = await h.facts();
    const cap = h.policy.num(f.isQatari ? 'capQatari' : 'capResident');
    const mats = (await h.c.query(`SELECT product, maturity, repayable, instalment FROM core.finance_facilities WHERE customer_id=$1 ORDER BY maturity`, [f.id])).rows;
    let exposure = f.facilities.reduce((s, x) => s + x.repayable, 0);
    const timeline = mats.map((m: any) => { exposure -= m.repayable; return { product: m.product, maturity: m.maturity, exposureAfter: Math.max(0, Math.round(exposure)), headroom: Math.round(cap - Math.max(0, exposure)) }; });
    const first = timeline.find((t: any) => t.headroom > h.policy.num('minEligible') * 5);
    await h.patch({ timeline, firstHeadroom: first?.maturity ?? null });
    await h.caseState('SUPPRESSED', 'Exposure at the cap; no outreach');
    await h.trail({ act: 'ANALYSE', clause: 'POL-04 §1.1', after: { timeline }, summary: `Exposure QAR ${Math.round(f.facilities.reduce((s, x) => s + x.repayable, 0)).toLocaleString('en-US')} against the cap QAR ${cap.toLocaleString('en-US')}; headroom appears ${first ? `at ${fmtDate(first.maturity)} (${first.product})` : 'at no scheduled maturity'}. No outreach [POL-04 §7.1].`, summary_ar: 'التعرض عند الحد؛ لا تواصل' });
    return { decision: first ? `Headroom at ${first.maturity}` : 'No headroom on the schedule', outputs: { timeline } };
  },
  'WF-11:schedule': async (h) => scheduleRecheck(h, h.run.payload.firstHeadroom ?? addMonths(today(), 1), h.run.payload.firstHeadroom ? 'Facility matures' : 'Monthly review'),
  'WF-13:suppress': async (h) => {
    const f = await h.facts(); const kase = h.kase!;
    const listed = f.returnedCheques.map((ch) => (ch.settledOn ? addMonths(ch.settledOn, h.policy.num('returnedChequeLookbackMonths')) : null)).filter(Boolean).sort()[0] as string | undefined;
    await h.patch({ until: listed ?? addMonths(today(), 6) });
    await h.caseState('SUPPRESSED', kase.reasons.includes('R17') ? `Returned cheque listed until ${listed ?? 'settlement + ageing'}` : 'Irregular payments: six regular months needed');
    await h.trail({ act: 'SUPPRESS', clause: kase.reasons.includes('R17') ? 'POL-05 §1.2' : 'POL-05 §1.3', summary: kase.reasons.includes('R17') ? `Returned cheque: offers suppressed until the bureau ageing ends ${listed ? fmtDate(listed) : '(unsettled)'} [POL-05 §1.2]` : `Irregular payments: suppressed until six regular instalments [POL-05 §1.3]`, summary_ar: 'حجب العروض وفق سياسة السلوك' });
    return { decision: 'Suppressed; no contact' };
  },
  'WF-13:schedule': async (h) => scheduleRecheck(h, h.run.payload.until, h.kase!.reasons.includes('R17') ? 'Bureau ageing ends' : 'Six regular months'),
  'WF-14:record': async (h) => {
    const f = await h.facts(); const kase = h.kase!;
    const r = kase.primary_reason ?? 'R09';
    const when = r === 'R10' ? addMonths(today(), 12) : r === 'R11' || r === 'R18' ? addMonths(today(), 3) : addMonths(today(), 1);
    const why = r === 'R10' ? 'Age: re-check at the next birthday' : r === 'R11' ? 'Restricted list: re-check on list change (quarterly)' : r === 'R18' ? 'Segment tag: re-check on segment change (quarterly)' : r === 'R12' ? 'Amount below minimum: monthly re-check' : 'Monthly re-score';
    await h.patch({ when, why });
    await h.caseState('SUPPRESSED', `${REASON[r as keyof typeof REASON].label}: ${why}`);
    const visibleTo = r === 'R11' || r === 'R18' ? 'Compliance, Credit and the Head' : 'Credit and the Head';
    await h.trail({ act: 'RECORD', clause: 'POL-04 §6.1', summary: `${r} ${REASON[r as keyof typeof REASON].label}: not eligible by policy; no contact; detail visible to ${visibleTo}. ${why}.`, summary_ar: `${r}: غير مؤهل بحسب السياسة؛ لا تواصل` });
    return { decision: why };
  },
  'WF-14:schedule': async (h) => scheduleRecheck(h, h.run.payload.when, h.run.payload.why),
};

// ------------------------------------------------------------------ WF-12 arrears

const wf12: Record<string, H> = {
  'WF-12:cadence': async (h) => {
    const f = await h.facts();
    const r = await scheduleCadence(h.c, h.kase!, f, h.policy, { runId: h.run.id, scenario: h.run.scenario_key });
    return { decision: r.note, outputs: r as any };
  },
  'WF-12:await': async (h) => {
    const kase = h.kase!;
    if (!h.event) return { wait: 'PAYMENT' };
    if (h.event.kind === 'PAYMENT') {
      const n = await cancelScheduled(h.c, kase.id, 'Paid');
      await h.c.query(`UPDATE layer.tasks SET state='CANCELLED', done_at=$2 WHERE case_id=$1 AND state='OPEN' AND kind='CALL'`, [kase.id, now()]);
      await h.trail({ act: 'RECEIVE', clause: 'POL-05 §3.1', summary: `Payment received: DPD 0; ${n} scheduled reminder(s) cancelled; cooling period starts`, summary_ar: 'استُلم السداد؛ تبدأ فترة الانتظار' });
      return { decision: 'Paid → cooling', skip: ['handoff', 'ack'] };
    }
    const n = await cancelScheduled(h.c, kase.id, 'Collections hand-off');
    await h.patch({ handedOver: true, dpd: h.event.payload.dpd, actionType: 'COLLECTIONS_CADENCE_EXCEPTION' });
    await h.trail({ act: 'HANDOFF', clause: 'POL-05 §2.2', summary: `DPD ${h.event.payload.dpd} ≥ ${h.policy.num('collectionsHandoffDpd')}: ${n} reminder(s) stopped; Collections takes over`, summary_ar: 'تجاوز حد التسليم: يتولى التحصيل' });
    return { decision: `DPD ${h.event.payload.dpd} → hand-off`, skip: ['cooling'] };
  },
  'WF-12:handoff': async (h) => {
    const f = await h.facts(); const kase = h.kase!;
    await h.task({ kind: 'COLLECTIONS_HANDOFF', assignee: 'collections', title: `Hand-off: ${f.nameEn}, DPD ${h.run.payload.dpd}`, title_ar: `تسليم: ${f.nameAr}`, brief: `Early-arrears reminders sent under POL-05 are in the case; offers suppressed. Collections owns the customer from here.`, dueDays: 1 });
    await h.caseState('HANDED_OVER', `DPD ${h.run.payload.dpd}`);
    await external(h.conn, 'CORE', 'POST', `/collections/handoffs`, `${f.id} DPD ${h.run.payload.dpd}`);
    return { decision: 'Task to Collections' };
  },
  'WF-12:cooling': async (h) => {
    const on = addMonths(today(), h.policy.num('coolingMonthsAfterCure'));
    await h.c.query(`UPDATE layer.cases SET recheck_on=$2, recheck_reason='Cooling period ends', updated_at=$3 WHERE id=$1`, [h.kase!.id, on, now()]);
    await h.caseState('COOLING', `Until ${on}`);
    await h.trail({ act: 'SCHEDULE', clause: 'POL-05 §3.1', summary: `Cooling period of ${h.policy.num('coolingMonthsAfterCure')} months: re-check on ${fmtDate(on)}; offers stay suppressed`, summary_ar: `فترة انتظار حتى ${on}` });
    return { decision: `Cooling until ${on}` };
  },
};

// ------------------------------------------------------------------ WF-15 hand-off

const wf15: Record<string, H> = {
  'WF-15:qualify': async (h) => {
    const f = await factsOf(h.conn, h.run.payload.customerId);
    await h.patch({ segment: f.segment, name: f.nameEn, actionType: 'APPROVE_HANDOFF' });
    return { decision: `Eligible: QAR ${Number(h.run.payload.amount).toLocaleString('en-US')} over ${h.run.payload.tenor} months`, outputs: { amount: h.run.payload.amount, tenor: h.run.payload.tenor },
      recommend: { verdict: 'APPROVE', summary: `${f.nameEn} is eligible for QAR ${Number(h.run.payload.amount).toLocaleString('en-US')} over ${h.run.payload.tenor} months under POL-04; the One Click offer can go.` } };
  },
  'WF-15:guard': async (h) => {
    const f = await factsOf(h.conn, h.run.payload.customerId);
    const ch = h.policy.str('offerChannel', f.segment) as Channel;
    const listed = f.returnedCheques.some((x) => !x.settledOn || addMonths(x.settledOn, h.policy.num('returnedChequeLookbackMonths')) > today());
    const v = guard({ channel: ch === 'RM' ? 'RM' : ch, marketing: true, segment: f.segment, at: nextAllowed(h.at, f.segment, ch, h.policy), consents: { marketing: f.consent.marketing_consent, channelOptouts: f.consent.channel_optouts, dnc: f.consent.dnc }, status: f.status, paused: false, anyDpd: f.facilities.some((x) => x.dpd > 0) || f.cards.some((x) => x.dpd > 0), activeNote: f.notes.some((n) => !n.lifted), returnedChequeListed: listed, rmApproved: true, sentAt: [] }, h.policy);
    if (!v.allow) {
      await h.trail({ act: 'BLOCK', clause: v.clause, summary: `One Click offer withheld: ${v.reason} [${v.clause}]${/consent/.test(v.reason) ? '; the customer is eligible and the offer waits for consent (RM/branch task)' : ''}`, summary_ar: `حُجب العرض: ${v.reason}` });
      if (/consent/.test(v.reason)) {
        await h.c.query(`UPDATE layer.cases SET close_code='AWAITING_CONSENT' WHERE id=$1 AND state='CLOSED'`, [h.kase?.id ?? 0]);
        await h.task({ kind: f.segment === 'MASS' ? 'BRANCH' : 'RM_BRIEF', assignee: f.segment === 'MASS' ? 'ops' : 'rm', title: `Eligible but no marketing consent: ${f.nameEn}`, title_ar: `مؤهل دون موافقة تسويقية: ${f.nameAr}`, brief: `Eligible for QAR ${Number(h.run.payload.amount).toLocaleString('en-US')}. No offer message may be sent [POL-07 §2.1]; raise it at the next service contact.`, dueDays: 5 });
      }
      await h.activity({ trigger: 'Hand-off', agent: 'hami', action: `Checked the One Click offer for ${f.id}`, result: `Withheld: ${v.reason}`, clause: v.clause });
      return { decision: `Withheld: ${v.reason} [${v.clause}]`, stop: 'COMPLETED' };
    }
    await h.trail({ act: 'ALLOW', clause: 'POL-07 §2.1', summary: `Consent and suppression check passed for the One Click offer by ${ch}`, summary_ar: 'اجتاز العرض فحص الموافقة والحجب' });
    return { decision: `Allowed by ${ch}` };
  },
  'WF-15:push': async (h) => {
    const f = await factsOf(h.conn, h.run.payload.customerId);
    const ch = h.policy.str('offerChannel', f.segment) as Channel;
    const amount = Number(h.run.payload.amount), tenor = Number(h.run.payload.tenor);
    await external(h.conn, 'ONECLICK', 'POST', '/preapprovals', `${f.id}: QAR ${amount.toLocaleString('en-US')} / ${tenor}m (simulated push to One Click Finance)`);
    if (ch === 'RM') {
      await h.task({ kind: 'RM_SEND', assignee: 'rm', title: `Send the One Click offer to ${f.nameEn}: QAR ${amount.toLocaleString('en-US')}`, title_ar: `إرسال عرض التمويل إلى ${f.nameAr}`, brief: `VVIP: the RM sends. Eligible amount QAR ${amount.toLocaleString('en-US')} over ${tenor} months [POL-04].`, dueDays: h.policy.num('slaRmDays') });
      await h.trail({ act: 'HANDOFF', clause: 'POL-01 §6.1', summary: `VVIP: offer prepared for the RM to send (QAR ${amount.toLocaleString('en-US')})`, summary_ar: 'العرض جاهز لإرسال مدير العلاقة' });
      return { decision: 'RM sends (VVIP)' };
    }
    const row = await scheduleMessage(h.c, { kase: h.kase, f, policy: h.policy, channel: ch, type: 'OFFER', reason: null, attempt: 0, createdBy: 'munadi', runId: h.run.id, marketing: true, approvedBy: f.segment === 'HNWI' ? 'rm' : null, vars: { amount: amount.toLocaleString('en-US'), tenor }, meta: { offer: true, vars: { amount: amount.toLocaleString('en-US'), tenor } } });
    const r = new Date(row.scheduled_for) <= h.at ? await dispatch(h.c, row.id, f, h.policy, h.run.scenario_key) : null;
    await h.activity({ trigger: 'Hand-off', agent: 'muahil', action: `Handed ${f.id} to One Click Finance (simulated)`, result: r ? (r.status === 'SENT' ? `Offer on the phone by ${ch}` : `Blocked: ${r.reason}`) : `Offer scheduled by ${ch} at ${fmtDate(new Date(row.scheduled_for).toISOString())}`, clause: 'POL-04 §4.2' });
    return { decision: r ? (r.status === 'SENT' ? `Offer sent by ${ch}` : `Blocked: ${r.reason}`) : `Offer scheduled by ${ch}`, outputs: { messageId: row.id, amount, tenor } };
  },
};

// ------------------------------------------------------------------ WF-16 opt-out, DNC, hardship, complaint

const wf16: Record<string, H> = {
  'WF-16:apply': async (h) => {
    const f = await factsOf(h.conn, h.run.payload.customerId);
    const kind = h.run.payload.kind as string; const kase = h.kase;
    const effect = (await import('@jahiz/domain')).addBusinessDays(today(), h.policy.num('optOutEffectDays'), h.policy);
    if (kind === 'OPT_OUT') {
      const channelOnly = h.run.payload.channel && h.run.payload.channel !== 'INAPP' && /this channel|sms|email|بريد|رسائل نصية/i.test(h.run.payload.text ?? '') && !/^\s*(stop|إيقاف)\s*$/i.test(h.run.payload.text ?? '');
      if (channelOnly) {
        const before = await applyUpdate(h.conn, f.id, 'consents', 'channel_optouts', [...new Set([...f.consent.channel_optouts, h.run.payload.channel])].join(','), 'Channel opt-out');
        await h.c.query(`UPDATE layer.outreach_messages SET status='CANCELLED', block_reason='Channel opt-out' WHERE customer_id=$1 AND status='SCHEDULED' AND channel=$2`, [f.id, h.run.payload.channel]);
        await h.trail({ act: 'WRITE', before: { channel_optouts: before }, after: { channel_optouts: [...f.consent.channel_optouts, h.run.payload.channel] }, clause: 'POL-07 §3.1', summary: `Channel opt-out: ${h.run.payload.channel} blocked; the next permitted channel is used`, summary_ar: 'إلغاء اشتراك قناة' });
        await h.patch({ what: `messages by ${h.run.payload.channel}` });
        return { decision: `Channel opt-out ${h.run.payload.channel}` };
      }
      const before = await applyUpdate(h.conn, f.id, 'consents', 'marketing_consent', 'false', `Opt-out received ${today()}, effective ${effect}`);
      const n = (await h.c.query(`UPDATE layer.outreach_messages SET status='BLOCKED', block_reason='Marketing opt-out', block_clause='POL-07 §2.1' WHERE customer_id=$1 AND status='SCHEDULED' AND marketing RETURNING id`, [f.id])).rowCount ?? 0;
      await h.trail({ act: 'WRITE', before: { marketing_consent: before }, after: { marketing_consent: false, effective: effect }, clause: 'POL-07 §3.1', summary: `Marketing opt-out: offers suppressed (effective within ${h.policy.num('optOutEffectDays')} business days, by ${effect}); ${n} queued offer(s) blocked; service messages continue on one channel [POL-07 §1.1]`, summary_ar: 'إلغاء الاشتراك التسويقي: حُجبت العروض وتستمر رسائل الخدمة' });
      await h.activity({ trigger: 'Inbound opt-out', agent: 'hami', action: `Applied the marketing opt-out for ${f.id}`, result: `${n} queued offer(s) blocked; service channel kept`, clause: 'POL-07 §3.1' });
      await h.patch({ what: f.lang === 'ar' ? 'العروض والرسائل التسويقية' : 'offers and marketing messages' });
      // Service messages continue, but not on the channel the customer replied STOP on when that channel is PUSH/SMS: move them to e-mail.
      if (h.run.payload.channel === 'SMS' || h.run.payload.channel === 'PUSH') {
        const moved = (await h.c.query(`UPDATE layer.outreach_messages SET channel='EMAIL', meta = meta || '{"movedFrom":"' || channel || '"}' WHERE customer_id=$1 AND status='SCHEDULED' AND NOT marketing AND channel=$2 RETURNING id`, [f.id, h.run.payload.channel])).rowCount ?? 0;
        if (moved) await h.trail({ act: 'RESCHEDULE', clause: 'POL-07 §1.1', summary: `${moved} service message(s) moved from ${h.run.payload.channel} to e-mail`, summary_ar: 'نُقلت رسائل الخدمة إلى البريد' });
      }
      return { decision: `Marketing opt-out; effective ${effect}` };
    }
    if (kind === 'DNC_REQUEST') { await h.patch({ actionType: 'ADD_DNC', what: f.lang === 'ar' ? 'أي رسائل' : 'any messages' }); if (kase) await setCaseState(h.c, kase, 'PAUSED', 'Hami', 'DNC request: Compliance decides', { paused: true, pause_reason: 'DNC request' }); await h.trail({ act: 'PAUSE', clause: 'POL-07 §3.2', summary: 'Do-not-contact request: all outreach paused pending the Compliance entry', summary_ar: 'طلب عدم التواصل: إيقاف كل التواصل بانتظار الامتثال' }); return { decision: 'DNC → Compliance', recommend: { verdict: 'APPROVE', summary: 'Customer asked never to be contacted; add the DNC entry [POL-07 §3.2].' } }; }
    // hardship / complaint / dispute
    if (kase) { await setCaseState(h.c, kase, 'PAUSED', 'Hami', `${kind}: all automated outreach paused`, { paused: true, pause_reason: kind }); await cancelScheduled(h.c, kase.id, `${kind}: paused`); }
    await h.patch({ actionType: 'RESUME_CASE' });
    await h.trail({ act: 'PAUSE', clause: 'POL-05 §4.1', summary: `${kind}: all automated outreach paused; a person within ${h.policy.num('hardshipHumanWithinDays')} working day(s); acknowledgement only`, summary_ar: `${kind}: إيقاف التواصل الآلي وإحالة إلى شخص` });
    await h.activity({ trigger: `Inbound ${kind}`, agent: 'hami', action: `Paused all automated outreach for ${f.id}`, result: `${kind} → ${kind === 'COMPLAINT' ? 'complaints' : 'operations'} task`, clause: 'POL-05 §4.1' });
    return { decision: `${kind}: paused → person`, recommend: { verdict: 'REVIEW', summary: `Customer wrote: "${String(h.run.payload.text ?? '').slice(0, 140)}". Contact them; approve to resume automated outreach afterwards, decline to keep the case paused.` } };
  },
  'WF-16:human:rejected': async (h) => { await h.trail({ actor_type: 'HUMAN', actor_id: h.run.payload.lastDecidedBy, actor_name: PERSONA[h.run.payload.lastDecidedBy as PersonaKey]?.name ?? 'Person', autonomy: null, act: 'KEEP_PAUSED', summary: `Case stays paused: ${h.run.payload.lastDecisionReason ?? ''}`, summary_ar: 'تبقى الحالة متوقفة' }); return { decision: 'Stays paused' }; },
  'WF-16:ack': async (h) => {
    const f = await factsOf(h.conn, h.run.payload.customerId);
    const kind = h.run.payload.kind as string; const kase = h.kase;
    if (kind === 'DNC_REQUEST') {
      await applyUpdate(h.conn, f.id, 'consents', 'dnc', 'true', h.run.payload.lastDecisionReason ?? 'Customer request');
      const n = (await h.c.query(`UPDATE layer.outreach_messages SET status='BLOCKED', block_reason='Do-not-contact', block_clause='POL-07 §3.2' WHERE customer_id=$1 AND status='SCHEDULED' RETURNING id`, [f.id])).rowCount ?? 0;
      await h.trail({ act: 'WRITE', after: { dnc: true }, clause: 'POL-07 §3.2', summary: `DNC entry added by Compliance; ${n} queued message(s) blocked; only the regulatory letter before a restriction may go`, summary_ar: 'أُضيف إلى قائمة عدم التواصل' });
      if (kase) await closeCase(h.c, kase, 'OPTED_OUT', 'Hami', 'DNC');
      return { decision: 'DNC applied; no acknowledgement sent' };
    }
    if (['HARDSHIP', 'COMPLAINT', 'DISPUTE'].includes(kind)) {
      if (h.run.payload.lastDecision === 'APPROVED' && kase) { await setCaseState(h.c, kase, 'AWAITING_REPLY', PERSONA[h.run.payload.lastDecidedBy as PersonaKey]?.name ?? 'Person', 'Resumed after the human contact', { paused: false, pause_reason: null }); }
    }
    const type = kind === 'OPT_OUT' ? 'OPTOUT_CONFIRM' : kind === 'COMPLAINT' ? 'ACK_COMPLAINT' : 'ACK_HARDSHIP';
    const usable = usableChannels(f, h.policy).filter((c) => c !== h.run.payload.channel || h.run.payload.channel === 'INAPP');
    const ch = (usable.find((x) => x === 'EMAIL') ?? usable[0] ?? 'EMAIL') as Channel;
    const row = await scheduleMessage(h.c, { kase, f, policy: h.policy, channel: ch, type: type as any, reason: null, attempt: 0, createdBy: 'munadi', runId: h.run.id, vars: { what: h.run.payload.what ?? '' } });
    const r = new Date(row.scheduled_for) <= h.at ? await dispatch(h.c, row.id, f, h.policy, h.run.scenario_key) : null;
    return { decision: `${type} by ${ch}${r ? ` (${r.status.toLowerCase()})` : ' (scheduled)'}`, outputs: { messageId: row.id } };
  },
};

// ------------------------------------------------------------------ WF-17 escalation

const wf17: Record<string, H> = {
  'WF-17:brief': async (h) => {
    const f = await h.facts(); const kase = h.kase!;
    if (h.policy.bool('rmFirst', f.segment)) {
      const brief = await draftRmBrief(h.c, kase, f, h.policy, h.run.payload.amountIfCured ?? null, h.run.id);
      await h.task({ kind: 'RM_BRIEF', assignee: 'rm', title: `${REASON[(kase.primary_reason ?? 'R07') as keyof typeof REASON].label}: ${f.nameEn} (${SEGMENT_LABEL[f.segment]})`, title_ar: `ملخص: ${f.nameAr}`, brief: brief.text, brief_mode: brief.mode, dueDays: h.policy.num('slaRmDays') });
      await h.trail({ act: 'BRIEF', clause: 'POL-08 §1.1', summary: `RM brief drafted (${brief.mode === 'claude' ? 'Claude, for review' : 'template'}) and the RM task opened`, summary_ar: 'أُعدّ ملخص مدير العلاقة' });
      await h.patch({ actionType: 'ESCALATE_TO_RM' });
      return { decision: 'RM brief', outputs: { mode: brief.mode } };
    }
    await h.task({ kind: 'CALL', assignee: 'ops', title: `Call ${f.nameEn}: ${kase.attempts} notice(s) unanswered (${REASON[(kase.primary_reason ?? 'R07') as keyof typeof REASON].label})`, title_ar: `اتصال بالعميل ${f.nameAr}`, brief: `Inside the call window ${h.policy.str('callWindowStart', f.segment)}–${h.policy.str('callWindowEnd', f.segment)} [POL-01 §2.2]. Ask for the document; offer the app path; record the outcome.`, dueDays: h.policy.num('slaOpsOfficerDays') });
    await h.trail({ act: 'TASK', clause: 'POL-01 §5.1', summary: `Contact-centre call task opened after ${kase.attempts} unanswered notice(s)`, summary_ar: 'مهمة اتصال بعد إشعارات دون رد' });
    await h.patch({ actionType: 'ESCALATE_TO_RM' });
    return { decision: 'Call task' };
  },
  'WF-17:propose': async (h) => {
    const f = await h.facts(); const kase = h.kase!;
    const docReason = kase.primary_reason === 'R07' || kase.primary_reason === 'R06' || kase.payload?.expiredNow;
    if (!docReason) { await closeCase(h.c, kase, 'UNRESPONSIVE', 'Hami', 'Attempts exhausted; no restriction applies'); return { decision: 'No restriction for this reason; closed unresponsive', skip: ['decide', 'apply'] }; }
    const expiry = kase.primary_reason === 'R06' ? f.passportExpiry : f.qidExpiry;
    const days = expiry ? daysBetween(expiry, today()) : 0;
    const day = h.policy.num('restrictionProposalDay');
    if (days < day) {
      if (!h.event) { await h.c.query(`UPDATE layer.cases SET next_action_at=$2, updated_at=$3 WHERE id=$1`, [kase.id, new Date(Date.parse(addDays(expiry!, day) + 'T06:00:00Z')), now()]); await h.trail({ act: 'SCHEDULE', clause: 'POL-02 §4.3', summary: `Restriction may be proposed at T+${day} (${fmtDate(addDays(expiry!, day))}); waiting`, summary_ar: `يمكن اقتراح التقييد في اليوم ${day}` }); return { wait: 'TIMEOUT' }; }
    }
    await h.patch({ restrictionProposed: true, actionType: 'DECIDE_RESTRICTION' });
    await setCaseState(h.c, kase, 'RESTRICTION_PROPOSED', 'Hami', `T+${days}`);
    const approver = personaForApprover(h.policy.str('restrictionApprover', f.segment));
    await h.trail({ act: 'PROPOSE', clause: 'POL-02 §4.3', summary: `T+${days} after expiry, ${kase.attempts} notice(s) and a call attempt: temporary card restriction proposed to the ${PERSONA[approver].role} — proposed, never automatic [POL-02 §4.3]`, summary_ar: 'اقتراح تقييد مؤقت للبطاقات إلى المعتمد' });
    await h.activity({ trigger: 'T+90', agent: 'hami', action: `Proposed a temporary restriction for ${kase.ref}`, result: `Waiting on ${PERSONA[approver].role}`, clause: 'POL-02 §4.3' });
    return { decision: `Restriction proposed to ${PERSONA[approver].role}`, recommend: { verdict: 'REVIEW', summary: `${kase.attempts} automated notices and a call over ${days} days without a reply. POL-02 §4.3 allows a temporary card restriction (branch services continue, no fee) with the regulatory letter by post. Approve to restrict, decline to keep trying.` } };
  },
  'WF-17:decide:rejected': async (h) => { const kase = h.kase!; await setCaseState(h.c, kase, 'ESCALATED', 'Supervisor', 'Restriction declined; keep trying'); await h.c.query(`UPDATE layer.cases SET recheck_on=$2, recheck_reason='Restriction declined; review again', updated_at=$3 WHERE id=$1`, [kase.id, addDays(today(), 30), now()]); return { decision: 'Restriction declined' }; },
  'WF-17:apply': async (h) => {
    const f = await h.facts(); const kase = h.kase!;
    const before = await applyUpdate(h.conn, f.id, 'customers', 'card_restricted', 'true', `Restriction approved by ${h.run.payload.lastDecidedBy}: ${h.run.payload.lastDecisionReason ?? ''}`);
    await h.trail({ act: 'WRITE', before: { card_restricted: before }, after: { card_restricted: true }, clause: 'POL-02 §4.3', summary: `Temporary card restriction applied for ${f.id} (approved by ${PERSONA[h.run.payload.lastDecidedBy as PersonaKey]?.name}); branch services continue; regulatory letter by post`, summary_ar: 'طُبّق التقييد المؤقت للبطاقات' });
    const row = await scheduleMessage(h.c, { kase, f, policy: h.policy, channel: 'LETTER', type: 'FINAL_NOTICE', reason: kase.primary_reason, attempt: 0, createdBy: 'munadi', runId: h.run.id, meta: { regulatory: true }, vars: { deadline: fmtDate(addDays(today(), h.policy.num('hardRestrictionAfterDays'))) } });
    await dispatch(h.c, row.id, f, h.policy, h.run.scenario_key);
    await closeCase(h.c, kase, 'UNRESPONSIVE', 'Hami', 'Restriction applied; letter sent');
    await h.c.query(`UPDATE layer.cases SET recheck_on=$2, recheck_reason='Hard restriction review' WHERE id=$1`, [kase.id, addDays(today(), h.policy.num('hardRestrictionAfterDays'))]);
    return { decision: 'Restricted; letter sent; case closed unresponsive', outputs: { letterId: row.id } };
  },
};

// ------------------------------------------------------------------ WF-18 policy change

async function previewChange(c: PoolClient, policy: Policy, key: string, segment: string | undefined, value: any) {
  const def = PARAM[key];
  const current = policy.get(key, segment as Segment | undefined);
  const out: { messages: { id: number; case_ref: string; from: string; to: string }[]; cases: number; note: string } = { messages: [], cases: 0, note: '' };
  if (key === 'reminderIntervalDays' && segment) {
    const rows = (await c.query(`SELECT m.id, m.attempt, m.scheduled_for, m.created_at, k.ref FROM layer.outreach_messages m JOIN layer.cases k ON k.id=m.case_id JOIN core.customers cu ON cu.id=m.customer_id WHERE m.status='SCHEDULED' AND m.attempt>1 AND cu.segment=$1 AND NOT m.marketing`, [segment])).rows;
    for (const r of rows) { const delta = (Number(value) - Number(current)) * (r.attempt - 1) * 86_400_000; const to = new Date(new Date(r.scheduled_for).getTime() + delta); out.messages.push({ id: r.id, case_ref: r.ref, from: r.scheduled_for, to: to.toISOString() }); }
    out.cases = new Set(rows.map((r: any) => r.ref)).size;
    out.note = `${rows.length} scheduled reminder(s) on ${out.cases} ${SEGMENT_LABEL[segment as Segment]} case(s) move by ${Number(value) - Number(current)} day(s) per interval`;
  } else if (def?.domain === 'POL-01' && segment) {
    const n = (await c.query(`SELECT COUNT(*)::int n FROM layer.cases k JOIN core.customers cu ON cu.id=k.customer_id WHERE k.state<>'CLOSED' AND cu.segment=$1`, [segment])).rows[0].n;
    out.cases = n; out.note = `${n} open ${SEGMENT_LABEL[segment as Segment]} case(s) run under the new value from the next action`;
  } else if (def?.domain === 'POL-04' || def?.domain === 'POL-03' || def?.domain === 'REF' || def?.domain === 'SEG') {
    out.note = 'Eligibility inputs change: the next scan re-qualifies every customer under the new value';
  } else out.note = 'Takes effect on the next action that reads this parameter';
  return { key, label: def?.label ?? key, segment: segment ?? null, from: current, to: value, ...out };
}

const wf18: Record<string, H> = {
  'WF-18:diff': async (h) => {
    const p = h.run.payload;
    const preview = await previewChange(h.c, h.policy, p.key, p.segment, p.value);
    await h.setResult({ preview });
    await h.patch({ actionType: 'APPROVE_POLICY_CHANGE' });
    const ver = (await h.c.query(`SELECT COALESCE(MAX(version),0)+1 AS v FROM layer.policy_versions`)).rows[0].v;
    await h.c.query(`INSERT INTO layer.policy_versions (version, status, proposed_by, proposed_at, params, diff, rationale, preview) VALUES ($1,'PROPOSED',$2,$3,$4,$5,$6,$7)`,
      [ver, p.proposer, now(), JSON.stringify(h.policy.raw()), JSON.stringify([{ key: p.key, segment: p.segment ?? null, from: preview.from, to: p.value }]), p.rationale ?? null, JSON.stringify(preview)]);
    await h.patch({ proposedVersion: ver });
    await h.trail({ act: 'PREVIEW', clause: PARAM[p.key]?.clause, summary: `Policy change proposed by ${PERSONA[p.proposer as PersonaKey]?.name}: ${preview.label}${p.segment ? ` (${SEGMENT_LABEL[p.segment as Segment]})` : ''} ${preview.from} → ${p.value}. Effect: ${preview.note}`, summary_ar: `اقتراح تغيير السياسة: ${preview.label}` });
    await h.activity({ trigger: 'Policy change proposed', agent: 'hami', action: `Effect preview for ${p.key}${p.segment ? `/${p.segment}` : ''} ${preview.from} → ${p.value}`, result: preview.note, clause: PARAM[p.key]?.clause });
    return { decision: preview.note, outputs: preview as any, recommend: { verdict: 'REVIEW', summary: `${preview.label}${p.segment ? ` for ${SEGMENT_LABEL[p.segment as Segment]}` : ''}: ${preview.from} → ${p.value}. ${preview.note}. Rationale: ${p.rationale ?? '—'}` } };
  },
  'WF-18:approve:rejected': async (h) => { await h.c.query(`UPDATE layer.policy_versions SET status='DECLINED', approved_by=$2, approved_at=$3 WHERE version=$1`, [h.run.payload.proposedVersion, h.run.payload.lastDecidedBy, now()]); return { decision: 'Declined' }; },
  'WF-18:version': async (h) => {
    const p = h.run.payload;
    const params = { ...h.policy.raw() } as any;
    const def = PARAM[p.key];
    if (def?.segmented && p.segment) params[p.key] = { ...(typeof params[p.key] === 'object' && !Array.isArray(params[p.key]) ? params[p.key] : (def.default as any)), [p.segment]: p.value };
    else params[p.key] = p.value;
    await h.c.query(`UPDATE layer.policy_versions SET status='SUPERSEDED' WHERE status='ACTIVE'`);
    await h.c.query(`UPDATE layer.policy_versions SET status='ACTIVE', approved_by=$2, approved_at=$3, effective_from=$3, params=$4 WHERE version=$1`, [p.proposedVersion, p.lastDecidedBy, now(), JSON.stringify(params)]);
    invalidatePolicy();
    await addTrail(h.c, { actor_type: 'SYSTEM', actor_id: 'policy', actor_name: 'Policy store', autonomy: null, act: 'VERSION', policy_version: p.proposedVersion, clause: def?.clause, run_id: h.run.id, scenario_key: h.run.scenario_key, before: { [p.key]: h.policy.get(p.key, p.segment) }, after: { [p.key]: p.value },
      summary: `Policy version ${p.proposedVersion} active: ${def?.label ?? p.key}${p.segment ? ` (${SEGMENT_LABEL[p.segment as Segment]})` : ''} = ${p.value}, approved by ${PERSONA[p.lastDecidedBy as PersonaKey]?.name}`, summary_ar: `الإصدار ${p.proposedVersion} من السياسة نافذ` });
    return { decision: `Version ${p.proposedVersion} active`, outputs: { version: p.proposedVersion } };
  },
  'WF-18:replan': async (h) => {
    const preview = h.run.result?.preview;
    let moved = 0;
    for (const m of preview?.messages ?? []) { const r = await h.c.query(`UPDATE layer.outreach_messages SET scheduled_for=$2, policy_version=$3, meta = meta || '{"replanned":true}' WHERE id=$1 AND status='SCHEDULED'`, [m.id, new Date(m.to), h.run.payload.proposedVersion]); moved += r.rowCount ?? 0; }
    await h.trail({ act: 'REPLAN', policy_version: h.run.payload.proposedVersion, summary: `Re-planned ${moved} scheduled message(s) under policy version ${h.run.payload.proposedVersion}`, summary_ar: `أُعيدت جدولة ${moved} رسالة` });
    await h.activity({ trigger: 'Policy version active', agent: 'hami', action: `Re-planned scheduled messages under v${h.run.payload.proposedVersion}`, result: `${moved} moved` });
    return { decision: `${moved} message(s) re-planned`, outputs: { moved } };
  },
};

export const HANDLERS: Record<string, H> = {
  ...spine('WF-02'), ...spine('WF-03'), ...spine('WF-04', { offer: salaryOffer }), ...spine('WF-05'), ...spine('WF-07'), ...spine('WF-09'),
  ...wf05, ...wf06, ...wf08, ...wf09, ...wfBC, ...wf12, ...wf15, ...wf16, ...wf17, ...wf18,
  'WF-01:load': async () => ({ decision: 'Done by the scan' }),
};
export { buildSpecimen, specimenDef, addActivity };
export type { SpecimenKind };
