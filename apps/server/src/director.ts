/**
 * The Demo Director (DESIGN §21). A scenario is a list of steps; each step
 * names the trigger, runs a REAL engine action, and tells the app which
 * screen to show and which persona to act as. The server returns the records
 * the step touched so the app can highlight them. Nothing is faked: a step
 * that "decides" calls the same decide() a person's click calls, stamped
 * "(decided by the scenario)" in the trail.
 */
import { SCENARIO, type DirectorAction, type DirectorStep, type PersonaKey } from '@jahiz/domain';
import { pool, tx } from './db.js';
import { now, today } from './clock.js';
import { activePolicy } from './policy.js';
import { factsOf, recordPayment } from './core/connector.js';
import { decide, startRun, resume, addActivity } from './engine/core.js';
import { scan } from './agents/raqib.js';
import { buildPack } from './agents/muwathiq.js';
import { receive } from './inbound.js';
import { sendDue, advanceClock } from './scheduler.js';
import { invalidateHealth } from './health.js';
import { dirtyOwners, restoreOwners } from './seed/snapshot.js';
import { PARAM, SEGMENT_LABEL, type Segment } from '@jahiz/domain';

export type Changes = { cases: { ref: string; state: string; close_code: string | null; customer_id: string }[]; messages: { id: number; channel: string; status: string; message_type: string; customer_id: string; block_reason: string | null }[]; documents: { id: number; type: string; state: string; recommendation: string | null }[]; proposals: number; tasks: { id: number; kind: string; assignee_persona: string; title: string }[]; trail: number; activity: { id: number; agent: string | null; action: string; result: string; clause: string | null }[]; policyVersion: number | null };

async function edgeMap(): Promise<Record<string, string>> { return (await pool.query(`SELECT value FROM layer.meta WHERE key='edge_cases'`)).rows[0]?.value ?? {}; }
const resolveId = (edge: Record<string, string>, ref: string) => (ref.startsWith('EC') ? edge[ref] ?? ref : ref);

async function snapshot() {
  const r = (await pool.query(`SELECT (SELECT COALESCE(MAX(id),0) FROM layer.trail) t, (SELECT COALESCE(MAX(id),0) FROM layer.activity) a, (SELECT COALESCE(MAX(id),0) FROM layer.outreach_messages) m, (SELECT COALESCE(MAX(id),0) FROM layer.documents) d, (SELECT COALESCE(MAX(id),0) FROM layer.proposed_updates) p, (SELECT COALESCE(MAX(id),0) FROM layer.tasks) k`)).rows[0];
  const map = async (sql: string) => new Map<any, string>((await pool.query(sql)).rows.map((x: any) => [x.k, x.s]));
  return {
    ...r, at: now(), version: (await activePolicy()).version,
    msgStates: await map(`SELECT id k, status || ':' || extract(epoch from scheduled_for)::text s FROM layer.outreach_messages WHERE status IN ('SCHEDULED','SENT','BLOCKED')`),
    caseStates: await map(`SELECT ref k, state || ':' || COALESCE(close_code,'') || ':' || attempts || ':' || array_to_string(reasons, ',') s FROM layer.cases`),
    docStates: await map(`SELECT id k, state s FROM layer.documents`),
    propStates: await map(`SELECT id k, state s FROM layer.proposed_updates`),
    taskStates: await map(`SELECT id k, state s FROM layer.tasks`),
  };
}
async function diff(s: Awaited<ReturnType<typeof snapshot>>): Promise<Changes> {
  const cases = (await pool.query(`SELECT ref, state, close_code, customer_id, attempts, reasons FROM layer.cases ORDER BY updated_at DESC LIMIT 400`)).rows.filter((k: any) => s.caseStates.get(k.ref) !== `${k.state}:${k.close_code ?? ''}:${k.attempts}:${k.reasons.join(',')}`).slice(0, 40);
  const msgs = (await pool.query(`SELECT id, channel, status, message_type, customer_id, block_reason, extract(epoch from scheduled_for)::text AS sf FROM layer.outreach_messages WHERE id > $1 OR status IN ('SCHEDULED','SENT','BLOCKED') ORDER BY id DESC LIMIT 2500`, [s.m])).rows.filter((m: any) => m.id > s.m || (s.msgStates.has(m.id) && s.msgStates.get(m.id) !== `${m.status}:${m.sf}`)).slice(0, 60).map(({ sf, ...m }: any) => m);
  const documents = (await pool.query(`SELECT id, type, state, recommendation FROM layer.documents ORDER BY id DESC LIMIT 300`)).rows.filter((d: any) => d.id > s.d || s.docStates.get(d.id) !== d.state).slice(0, 20);
  const proposals = (await pool.query(`SELECT id, state FROM layer.proposed_updates ORDER BY id DESC LIMIT 500`)).rows.filter((x: any) => x.id > s.p || s.propStates.get(x.id) !== x.state).length;
  const tasks = (await pool.query(`SELECT id, kind, assignee_persona, title, state FROM layer.tasks ORDER BY id DESC LIMIT 500`)).rows.filter((t: any) => t.id > s.k || s.taskStates.get(t.id) !== t.state).slice(0, 20).map(({ state, ...t }: any) => t);
  const trail = (await pool.query(`SELECT COUNT(*)::int n FROM layer.trail WHERE id > $1`, [s.t])).rows[0].n;
  const activity = (await pool.query(`SELECT id, agent, action, result, clause FROM layer.activity WHERE id > $1 ORDER BY id`, [s.a])).rows;
  const v = (await activePolicy()).version;
  return { cases, messages: msgs, documents, proposals, tasks, trail, activity, policyVersion: v !== s.version ? v : null };
}

async function runWaitingFor(customerId: string, persona: PersonaKey) {
  return (await pool.query(`SELECT r.id FROM layer.runs r JOIN layer.cases k ON k.id=r.case_id WHERE k.customer_id=$1 AND r.status IN ('WAITING','ESCALATED') AND r.waiting_on_persona=$2 ORDER BY r.id DESC LIMIT 1`, [customerId, persona])).rows[0]?.id as number | undefined;
}

/** An offer "scheduled before the condition that now blocks it": planted if the seeded one was already consumed, so the scenario works in any order. */
async function plantOffer(customerId: string, type: 'OFFER' | 'CURRENT_ACCOUNT_OFFER', amount: number | undefined) {
  const exists = (await pool.query(`SELECT id FROM layer.outreach_messages WHERE customer_id=$1 AND status='SCHEDULED' AND marketing LIMIT 1`, [customerId])).rows[0];
  if (exists) return;
  const { templateFor, render } = await import('@jahiz/domain');
  const policy = await activePolicy();
  const f = await factsOf({ c: pool, actor: 'muahil' }, customerId);
  const kase = (await pool.query(`SELECT * FROM layer.cases WHERE customer_id=$1 AND state<>'CLOSED' ORDER BY id DESC LIMIT 1`, [customerId])).rows[0];
  const t = templateFor(type === 'OFFER' ? null : 'R08', type === 'OFFER' ? 'OFFER' : 'REQUEST', f.lang);
  const r = render(t, { name: f.lang === 'ar' ? f.nameAr : f.nameEn, ref: kase?.ref ?? '—', sender: policy.str('senderIdentity'), amount: (amount ?? 0).toLocaleString('en-US'), tenor: 48 }, 'PUSH');
  await pool.query(`INSERT INTO layer.outreach_messages (case_id, customer_id, channel, template_key, message_type, marketing, lang, attempt, scheduled_for, window_used, status, policy_version, subject, body, created_by, created_at, meta) VALUES ($1,$2,'PUSH',$3,$4,TRUE,$5,0,$6,'09:00–20:00','SCHEDULED',$7,$8,$9,$10,$11,$12)`,
    [kase?.id ?? null, customerId, t.key, type, f.lang, new Date(now().getTime() - 3600_000), policy.version, r.subject, r.body, type === 'OFFER' ? 'muahil' : 'munadi', new Date(now().getTime() - 86_400_000), JSON.stringify({ offer: true, planted: 'Scheduled before the condition that now blocks it', vars: { amount: (amount ?? 0).toLocaleString('en-US'), tenor: 48 } })]);
}

export async function execute(action: DirectorAction, scenario: string, edge: Record<string, string>): Promise<string> {
  if ('plantOffer' in action && action.plantOffer && 'customer' in action && action.customer) await plantOffer(resolveId(edge, action.customer), action.plantOffer.type, action.plantOffer.amount);
  switch (action.kind) {
    case 'show': return 'Showing';
    case 'scan': { const ids = action.customer ? [resolveId(edge, action.customer)] : undefined; const r = await tx((c) => scan(c, { trigger: `Scan (scenario ${scenario})`, scenario, ids })); return `Checked ${r.checked}: ${r.eligible} eligible, ${r.opened.length} opened, ${r.closed.length} closed, ${r.updated.length} updated`; }
    case 'send_due': {
      if (action.customer) {
        const id = resolveId(edge, action.customer);
        if (action.all) await pool.query(`UPDATE layer.outreach_messages SET scheduled_for=$2 WHERE customer_id=$1 AND status='SCHEDULED' AND scheduled_for > $2`, [id, now()]);
        else await pool.query(`UPDATE layer.outreach_messages SET scheduled_for=$2 WHERE id = (SELECT id FROM layer.outreach_messages WHERE customer_id=$1 AND status='SCHEDULED' ORDER BY scheduled_for, id LIMIT 1)`, [id, now()]);
        const r = await tx((c) => sendDue(c, { customerId: id, scenario })); return `${r.sent} sent, ${r.blocked} blocked or deferred`;
      }
      const r = await tx((c) => sendDue(c, { scenario })); return `${r.sent} sent, ${r.blocked} blocked`;
    }
    case 'advance_clock': { const r = await advanceClock(action.days, { scenario }); return `Now ${today()}: ${r.scans} scan(s), ${r.sent} sent, ${r.blocked} blocked, ${r.timeouts} deadline(s), ${r.rechecks} re-check(s)`; }
    case 'customer_upload': { const id = resolveId(edge, action.customer); const r = await tx((c) => receive(c, { channel: 'INAPP', customerId: id, body: 'Uploaded from QIB Mobile (demo)', attachments: [{ specimen: action.specimen as any }], assurance: 'APP_UPLOAD', scenario })); return `Upload received: ${r.documentIds.length} document(s), WF-06 run ${r.runId}`; }
    case 'customer_reply': { const id = resolveId(edge, action.customer); const r = await tx((c) => receive(c, { channel: 'INAPP', customerId: id, body: action.text, scenario })); return `Reply received (WF-06 run ${r.runId})`; }
    case 'customer_accept_offer': { const id = resolveId(edge, action.customer); await tx(async (c) => { const f = await factsOf({ c, actor: 'customer-app' }, id); await c.query(`INSERT INTO core.device_inbox (customer_id, channel, kind, at, subject, body, lang, meta) VALUES ($1,'INAPP','OUTGOING',$2,'One Click Finance','Offer accepted in the app',$3,'{"accepted":true}')`, [f.id, now(), f.lang]); await addActivity(c, { trigger: 'Customer app', action: `${id} accepted the offer`, result: 'Simulated disbursement', customer_id: id, scenario_key: scenario }); }); return 'Offer accepted'; }
    case 'email_in': { const id = resolveId(edge, action.customer); const f = await factsOf({ c: pool, actor: 'customer-app' }, id); const r = await tx((c) => receive(c, { channel: 'EMAIL', customerId: action.fromOther ? null : id, from: f.contact?.email ?? '', subject: action.subject, body: action.body, attachments: action.specimen ? [{ specimen: action.specimen as any }] : [], assurance: 'EMAIL', scenario })); return `E-mail received: ${r.documentIds.length} attachment(s), WF-06 run ${r.runId}`; }
    case 'decide': { const id = resolveId(edge, action.customer); const runId = await runWaitingFor(id, action.persona); if (!runId) return `Nothing is waiting on ${action.persona} for ${id}`; await tx((c) => decide(c, { runId, persona: action.persona, decision: action.decision, reason: action.reason, scenario: true })); return `${action.decision} by ${action.persona} (run ${runId})`; }
    case 'employer_review': { await tx(async (c) => { const policy = await activePolicy(c); await buildPack(c, action.employer, policy, { scenario }); const anyCase = (await c.query(`SELECT k.id FROM layer.cases k JOIN core.employment em ON em.customer_id=k.customer_id WHERE em.employer_id=$1 AND k.state<>'CLOSED' ORDER BY k.id LIMIT 1`, [action.employer])).rows[0]; const open = (await c.query(`SELECT id FROM layer.runs WHERE workflow_id='WF-05' AND status='WAITING' AND payload->>'employerId'=$1`, [action.employer])).rows[0]; if (!open) await startRun(c, { caseId: anyCase?.id ?? null, workflowId: 'WF-05', title: `Employer review ${action.employer}`, title_ar: `مراجعة جهة العمل`, channel: 'SCENARIO', scenario, payload: { variant: 'UNAPPROVED', employerId: action.employer }, doneAtStart: ['route', 'plan', 'send', 'await', 'examine', 'check', 'apply', 'requalify', 'escalate'] }); }); return 'Pack built; waiting on Credit Policy'; }
    case 'decide_employer': { const run = (await pool.query(`SELECT id FROM layer.runs WHERE workflow_id='WF-05' AND status='WAITING' AND waiting_on_persona='credit' AND payload->>'employerId'=$1 ORDER BY id DESC LIMIT 1`, [action.employer])).rows[0]; if (!run) return 'No employer review is waiting'; await tx((c) => decide(c, { runId: run.id, persona: 'credit', decision: action.decision, reason: action.reason, scenario: true })); return `Employer ${action.decision.toLowerCase()} (run ${run.id})`; }
    case 'propose_policy': { const def = PARAM[action.key]; const r = await tx((c) => startRun(c, { caseId: null, workflowId: 'WF-18', title: `Policy change: ${def?.label ?? action.key}${action.segment ? ` (${SEGMENT_LABEL[action.segment as Segment]})` : ''}`, title_ar: 'تغيير السياسة', channel: 'SCENARIO', scenario, payload: { domain: action.domain, key: action.key, segment: action.segment, value: action.value, rationale: action.rationale, proposer: action.persona } })); return `Proposed (run ${r.id}); waiting on ${r.waiting_on_persona}`; }
    case 'approve_policy': { const run = (await pool.query(`SELECT id FROM layer.runs WHERE workflow_id='WF-18' AND status='WAITING' ORDER BY id DESC LIMIT 1`)).rows[0]; if (!run) return 'No policy change is waiting'; await tx((c) => decide(c, { runId: run.id, persona: action.persona, decision: 'APPROVED', scenario: true })); return `Approved by ${action.persona}`; }
    case 'payment': { const id = resolveId(edge, action.customer); await tx(async (c) => { await recordPayment({ c, actor: 'core' }, id); const run = (await c.query(`SELECT r.id FROM layer.runs r JOIN layer.cases k ON k.id=r.case_id WHERE k.customer_id=$1 AND r.workflow_id='WF-12' AND r.status='WAITING_EVENT' ORDER BY r.id DESC LIMIT 1`, [id])).rows[0]; await addActivity(c, { trigger: 'Core event: payment', action: `Instalment paid by ${id}`, result: run ? 'WF-12 resumes' : 'No arrears run waiting', customer_id: id, scenario_key: scenario }); if (run) await resume(c, run.id, { kind: 'PAYMENT', payload: {} }); }); return 'Payment recorded'; }
    case 'escalate_now': { const id = resolveId(edge, action.customer); const run = (await pool.query(`SELECT r.id FROM layer.runs r JOIN layer.cases k ON k.id=r.case_id WHERE k.customer_id=$1 AND r.status='WAITING_EVENT' AND r.waiting_event='REPLY' ORDER BY r.id DESC LIMIT 1`, [id])).rows[0]; if (!run) return 'No run waiting for a reply'; await tx(async (c) => { await c.query(`UPDATE layer.cases SET attempts=max_attempts, next_action_at=NULL WHERE customer_id=$1 AND state<>'CLOSED'`, [id]); await resume(c, run.id, { kind: 'TIMEOUT', payload: { forced: true } }); }); return 'Escalated (WF-17)'; }
  }
}

/** Resolve a step's screen reference to concrete ids. */
export async function resolveScreen(screen: string, edge: Record<string, string>): Promise<string> {
  const [kind, ref] = screen.split(':');
  if (!ref) return screen;
  const id = resolveId(edge, ref);
  if (kind === 'case') { const k = (await pool.query(`SELECT ref FROM layer.cases WHERE customer_id=$1 ORDER BY (state<>'CLOSED') DESC, id DESC LIMIT 1`, [id])).rows[0]; return k ? `case:${k.ref}` : `customer:${id}`; }
  if (kind === 'document') { const d = (await pool.query(`SELECT id FROM layer.documents WHERE customer_id=$1 ORDER BY id DESC LIMIT 1`, [id])).rows[0]; return d ? `document:${d.id}` : `customer:${id}`; }
  if (kind === 'audit') return ref === 'policy' ? 'audit:act=VERSION' : `audit:customer=${id}`;
  if (kind === 'comms') return ref === 'blocked' ? 'comms:status=BLOCKED' : ref === 'scheduled' ? 'comms:status=SCHEDULED' : `comms:customer=${id}`;
  if (kind === 'customer-app' || kind === 'mailbox' || kind === 'customer') return `${kind}:${id}`;
  return screen;
}

/** The customers and employers a scenario acts on (resolved edge ids; an employer brings its snapshotted staff). */
async function owners(key: string, edge: Record<string, string>) {
  const s = SCENARIO[key];
  const customers = new Set<string>(); const employers = new Set<string>();
  for (const st of s.steps) {
    const a: any = st.action;
    if (a.customer) customers.add(resolveId(edge, a.customer));
    if (a.employer) employers.add(a.employer);
  }
  for (const ref of s.cases) if (edge[ref]) customers.add(edge[ref]);
  if (employers.size) for (const r of (await pool.query(`SELECT em.customer_id FROM core.employment em JOIN layer.snapshot_rows s ON s.owner=em.customer_id AND s.tbl='core.customers' WHERE em.employer_id = ANY($1)`, [[...employers]])).rows) customers.add(r.customer_id);
  return { customers: [...customers], employers: [...employers] };
}

/**
 * Start a scenario. If its customers have moved on since the seed (an earlier
 * run of this or another scenario, or someone clicking around), their records
 * are restored to the seeded state first, so the scenario plays as designed.
 */
export async function startScenario(key: string) {
  const s = SCENARIO[key]; if (!s) throw new Error(`Unknown scenario ${key}`);
  await pool.query(`UPDATE layer.scenario_runs SET status='ABANDONED', finished_at=$1 WHERE status='RUNNING'`, [now()]);
  const edge = await edgeMap();
  const o = await owners(key, edge);
  let restored: string[] = [];
  await tx(async (c) => {
    const dirty = await dirtyOwners(c, o.customers, o.employers);
    if (!dirty.length) return;
    // An employer under review is restored with all its snapshotted staff, so the review re-qualifies the same people.
    const employers = o.employers.filter((x) => dirty.includes(x));
    const customers = employers.length ? o.customers : o.customers.filter((x) => dirty.includes(x));
    restored = await restoreOwners(c, customers, employers, { scenario: key, reason: `${dirty.length} record(s) had moved on since the seed` });
  });
  if (restored.length) invalidateHealth();
  const r = (await pool.query(`INSERT INTO layer.scenario_runs (key, status, step_index, started_at) VALUES ($1,'RUNNING',0,$2) RETURNING *`, [key, now()])).rows[0];
  const steps = await Promise.all(s.steps.map(async (st) => ({ ...st, screenResolved: await resolveScreen(st.screen, edge) })));
  return { run: r, scenario: { ...s, steps }, edge, restored };
}

export async function runStep(key: string, index: number) {
  const s = SCENARIO[key]; if (!s) throw new Error(`Unknown scenario ${key}`);
  const st: DirectorStep | undefined = s.steps[index]; if (!st) throw new Error(`No step ${index}`);
  const edge = await edgeMap();
  const snap = await snapshot();
  const t0 = Date.now();
  let result = ''; let error: string | null = null;
  try { result = await execute(st.action, key, edge); } catch (e: any) { error = e.message; console.error('[director]', key, st.id, e); }
  invalidateHealth();
  const changes = await diff(snap);
  const screen = await resolveScreen(st.screen, edge);
  const run = (await pool.query(`SELECT * FROM layer.scenario_runs WHERE key=$1 AND status='RUNNING' ORDER BY id DESC LIMIT 1`, [key])).rows[0];
  if (run) await pool.query(`UPDATE layer.scenario_runs SET step_index=$2, log = log || $3::jsonb ${index >= s.steps.length - 1 ? ", status='DONE', finished_at=$4" : ''} WHERE id=$1`, index >= s.steps.length - 1 ? [run.id, index, JSON.stringify([{ step: st.id, result, error, ms: Date.now() - t0, at: now() }]), now()] : [run.id, index, JSON.stringify([{ step: st.id, result, error, ms: Date.now() - t0, at: now() }])]);
  if (st.action.kind !== 'show') await pool.query(`INSERT INTO layer.activity (at, trigger, agent, action, result, scenario_key, step_id, changes) VALUES ($1,$2,NULL,$3,$4,$5,$6,$7)`, [now(), `Director ${key} · ${st.title}`, st.trigger, error ? `Error: ${error}` : result, key, st.id, JSON.stringify({ cases: changes.cases.map((c) => c.ref), messages: changes.messages.map((m) => m.id) })]);
  return { step: { ...st, screenResolved: screen }, index, total: s.steps.length, result, error, changes, clock: { now: now().toISOString(), today: today() }, persona: st.persona ?? null, ms: Date.now() - t0 };
}
