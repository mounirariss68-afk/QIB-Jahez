/**
 * History replay (the Rafeeq method): sixty days are replayed through the
 * real engine on the virtual clock — an initial scan, weekly scans, daily
 * due messages and deadlines, the named edge cases' events on their exact
 * days, and a trickle of ordinary cures — so every past message, block,
 * approval and re-qualification is a genuine engine output.
 */
import { addDays, daysBetween } from '@jahiz/domain';
import { dohaAt, setClock, today, now } from '../clock.js';
import { tx } from '../db.js';
import { scan } from '../agents/raqib.js';
import { tickAll, sendDue } from '../scheduler.js';
import { receive } from '../inbound.js';
import { decide, addTrail, addActivity } from '../engine/core.js';
import { recordPayment, payrollRun, ageDpd as ageDpdCore, type Ctx, factsOf } from '../core/connector.js';
import { activePolicy } from '../policy.js';
import { templateFor, render, nextAllowed } from '@jahiz/domain';
import { EDGES, type ReplayAction } from './edge.js';
import type { PersonaKey } from '@jahiz/domain';
import { Rng } from './rng.js';

const log = (m: string) => console.log(`[seed] ${m}`);

async function decideFor(customerId: string, persona: PersonaKey, decision: 'APPROVED' | 'REJECTED', reason?: string, edits?: Record<string, any>) {
  await tx(async (c) => {
    const run = (await c.query(`SELECT r.id FROM layer.runs r JOIN layer.cases k ON k.id=r.case_id WHERE k.customer_id=$1 AND r.status='WAITING' AND r.waiting_on_persona=$2 ORDER BY r.id DESC LIMIT 1`, [customerId, persona])).rows[0];
    if (!run) { log(`no run waiting on ${persona} for ${customerId}`); return; }
    await decide(c, { runId: run.id, persona, decision, reason, edits, scenario: true });
  });
}

async function runAction(customerId: string, a: ReplayAction, day: string) {
  switch (a.kind) {
    case 'scan': await tx((c) => scan(c, { trigger: 'Scan (replay)', ids: [customerId], quiet: true })); return;
    case 'upload': await tx((c) => receive(c, { channel: 'INAPP', customerId, body: 'Uploaded from QIB Mobile (demo)', attachments: [{ specimen: a.specimen as any }], assurance: a.assurance ?? 'APP_UPLOAD' })); return;
    case 'reply': await tx((c) => receive(c, { channel: 'INAPP', customerId, body: a.text })); return;
    case 'email': await tx(async (c) => { const f = await factsOf({ c, actor: 'seed' }, customerId); await receive(c, { channel: 'EMAIL', from: f.contact?.email ?? '', subject: a.subject, body: a.body, attachments: a.specimen ? [{ specimen: a.specimen as any }] : [] }); }); return;
    case 'decide': await decideFor(customerId, a.persona, a.decision, a.reason, a.edits); return;
    case 'dpd_start': await tx(async (c) => { const ctx: Ctx = { c, actor: 'core' }; if (a.what === 'FACILITY') await c.query(`UPDATE core.finance_facilities SET dpd=1, dpd_since=$2 WHERE customer_id=$1`, [customerId, day]); else await c.query(`UPDATE core.cards SET dpd=1, dpd_since=$2 WHERE customer_id=$1`, [customerId, day]); await c.query(`INSERT INTO layer.integration_log (at, system, direction, verb, resource, status, note, actor) VALUES ($1,'CORE','IN','EVENT',$2,200,'Instalment missed: DPD 1','core')`, [now(), `/customers/${customerId}/${a.what === 'FACILITY' ? 'finance-facilities' : 'cards'}`]); void ctx; }); return;
    case 'upgrade_segment': await tx(async (c) => {
      const before = (await c.query(`SELECT segment FROM core.customers WHERE id=$1`, [customerId])).rows[0]?.segment;
      await c.query(`UPDATE core.customers SET segment=$2, rm_id=$3, deposits=GREATEST(deposits, 400000) WHERE id=$1`, [customerId, a.to, a.rm]);
      await c.query(`UPDATE core.employment SET salary_total=$2, salary_basic=$3, salary_allowances=$4 WHERE customer_id=$1`, [customerId, a.salary, Math.round(a.salary * 0.6), a.salary - Math.round(a.salary * 0.6)]);
      await c.query(`UPDATE core.salary_credits SET amount=$2 WHERE customer_id=$1 AND amount>0 AND month >= $3`, [customerId, a.salary, day.slice(0, 7)]);
      await c.query(`UPDATE layer.cases SET rm_id=$2 WHERE customer_id=$1 AND state<>'CLOSED'`, [customerId, a.rm]);
      await addTrail(c, { actor_type: 'SYSTEM', actor_id: 'core', actor_name: 'Core banking', autonomy: null, act: 'CORE_EVENT', customer_id: customerId, before: { segment: before }, after: { segment: a.to, rm_id: a.rm }, summary: `Core event: segment ${before} → ${a.to} (Tamayuz upgrade), RM ${a.rm} assigned. Scheduled messages still carry the ${before} plan.`, summary_ar: `حدث من النظام الأساسي: ترقية الشريحة إلى ${a.to}` });
      await c.query(`INSERT INTO layer.integration_log (at, system, direction, verb, resource, status, note, actor) VALUES ($1,'CORE','IN','EVENT',$2,200,$3,'core')`, [now(), `/customers/${customerId}`, `segment ${before} → ${a.to}`]);
    }); return;
    case 'plant_offer': await tx(async (c) => {
      const policy = await activePolicy(c);
      const f = await factsOf({ c, actor: 'muahil' }, customerId);
      const kase = (await c.query(`SELECT * FROM layer.cases WHERE customer_id=$1 AND state<>'CLOSED' ORDER BY id DESC LIMIT 1`, [customerId])).rows[0];
      const type = a.type === 'OFFER' ? 'OFFER' : 'REQUEST';
      const t = templateFor(a.type === 'OFFER' ? null : 'R08', type, f.lang);
      const vars = { name: f.lang === 'ar' ? f.nameAr : f.nameEn, ref: kase?.ref ?? '—', sender: policy.str('senderIdentity'), amount: (a.amount ?? 0).toLocaleString('en-US'), tenor: 48 };
      const r = render(t, vars, a.channel);
      const at = nextAllowed(dohaAt(addDays(today(), 1), '09:20'), f.segment, a.channel, policy);
      await c.query(`INSERT INTO layer.outreach_messages (case_id, customer_id, channel, template_key, message_type, marketing, lang, attempt, scheduled_for, window_used, status, policy_version, subject, body, created_by, created_at, meta) VALUES ($1,$2,$3,$4,$5,TRUE,$6,0,$7,'09:00–20:00','SCHEDULED',$8,$9,$10,$11,$12,$13)`,
        [kase?.id ?? null, customerId, a.channel, t.key, a.type === 'OFFER' ? 'OFFER' : 'CURRENT_ACCOUNT_OFFER', f.lang, at, policy.version, r.subject, r.body, a.type === 'OFFER' ? 'muahil' : 'munadi', now(), JSON.stringify({ offer: true, planted: 'Scheduled before the condition that now blocks it', vars: { amount: vars.amount, tenor: 48 } })]);
      await addTrail(c, { actor_type: 'AGENT', actor_id: a.type === 'OFFER' ? 'muahil' : 'munadi', actor_name: a.type === 'OFFER' ? 'Muahil' : 'Munadi', autonomy: 'A3', act: 'PLAN', customer_id: customerId, case_id: kase?.id, case_ref: kase?.ref, policy_version: policy.version, summary: `${a.type === 'OFFER' ? 'One Click offer' : 'Current-account offer'} scheduled by ${a.channel} for ${f.id}`, summary_ar: 'عرض مجدول' });
    }); return;
    case 'fire_tasks': return;
  }
}

/** The bank's own daily events: DPD counters age; on the 25th the payroll run credits salaries. */
async function ageDpd(day: string) { await tx(async (c) => { await ageDpdCore(c, day); await payrollRun(c, day); }); }

export async function replay(realToday: string, edgeIds: Set<string>, seed: number) {
  const rng = new Rng(seed + 7);
  const D0 = addDays(realToday, -60);
  const byDay = new Map<number, { id: string; action: ReplayAction }[]>();
  for (const e of EDGES) for (const r of e.replay) { const arr = byDay.get(r.day) ?? []; arr.push({ id: e.id, action: r.action }); byDay.set(r.day, arr); }
  // Day −60: the initial scan over the whole base
  setClock(dohaAt(D0, '02:00'));
  const first = await tx((c) => scan(c, { trigger: 'Initial scan (replay)' }));
  log(`day -60 initial scan: ${first.checked} checked, ${first.eligible} eligible, ${first.opened.length} cases opened, ${first.preExpiry.length} pre-expiry`);
  setClock(dohaAt(D0, '09:15'));
  await tx((c) => tickAll(c));
  for (let d = -59; d <= 0; d++) {
    const day = addDays(realToday, d);
    await ageDpd(day);
    setClock(dohaAt(day, '02:00'));
    if (d === 0 || (60 + d) % 7 === 0) { const s = await tx((c) => scan(c, { trigger: d === 0 ? 'Nightly scan' : 'Nightly scan (replay)' })); log(`day ${d} scan: eligible ${s.eligible}, opened ${s.opened.length}, closed ${s.closed.length}, updated ${s.updated.length}`); }
    const targeted = (byDay.get(d) ?? []).filter((x) => x.action.kind === 'scan' || x.action.kind === 'dpd_start');
    for (const x of targeted) await runAction(x.id, x.action, day);
    if (d === 0) break; // today: the clock stops at 09:00 with the day's messages still due
    setClock(dohaAt(day, '09:15'));
    for (const x of (byDay.get(d) ?? []).filter((x) => x.action.kind !== 'scan' && x.action.kind !== 'dpd_start')) await runAction(x.id, x.action, day);
    // Ordinary life: a few customers reply with the right document, and the checker approves the next morning.
    if (((d % 3) + 3) % 3 === 0 && d < -1) {
      const picks = await tx(async (c) => (await c.query(`SELECT k.customer_id, k.primary_reason FROM layer.cases k JOIN core.contacts ct ON ct.customer_id=k.customer_id WHERE k.state='AWAITING_REPLY' AND k.cls='A' AND k.edge_key IS NULL AND ct.app_registered AND k.primary_reason IN ('R07','R06','R01') AND NOT (k.customer_id = ANY($1)) ORDER BY random() LIMIT 2`, [[...edgeIds]])).rows);
      for (const p of picks) { const specimen = p.primary_reason === 'R07' ? 'qid-new' : p.primary_reason === 'R06' ? 'passport-new' : 'hr-letter'; await runAction(p.customer_id, { kind: 'upload', specimen }, day); }
    }
    if (((d % 3) + 3) % 3 === 1 && d < -1) {
      const waiting = await tx(async (c) => (await c.query(`SELECT r.id, r.waiting_on_persona, k.customer_id FROM layer.runs r JOIN layer.cases k ON k.id=r.case_id WHERE r.status='WAITING' AND k.edge_key IS NULL AND NOT (k.customer_id = ANY($1)) AND r.workflow_id IN ('WF-02','WF-03','WF-04') AND (r.result->'recommendation'->>'verdict')='APPROVE' ORDER BY r.id LIMIT 3`, [[...edgeIds]])).rows);
      for (const w of waiting) await tx((c) => decide(c, { runId: w.id, persona: w.waiting_on_persona, decision: 'APPROVED', reason: undefined, scenario: true }));
    }
    await tx((c) => tickAll(c));
    setClock(dohaAt(day, '14:05'));
    await tx((c) => sendDue(c));
    if (rng.chance(0.0)) void 0;
  }
  // Today, 09:00 Doha: deadlines and re-checks that fall on today run; due messages stay queued for the presenter.
  setClock(dohaAt(realToday, '09:00'));
  await tx(async (c) => { await addActivity(c, { trigger: 'Seed', agent: null, action: `Replayed ${daysBetween(D0, realToday)} days of history through the engine`, result: `Clock set to ${realToday} 09:00 Doha; today's messages are due`, changes: {} }); });
}
