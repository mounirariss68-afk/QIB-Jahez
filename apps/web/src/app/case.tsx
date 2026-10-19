/**
 * The case reader, used by the Inbox and the case drawer. Top to bottom: what
 * the case is, what the agent recommends, the evidence (documents and the
 * before/after proposals), the messages, the workflow runs with their steps,
 * the trail — and, when the case waits on the signed-in person, a decision
 * bar naming the actual decision.
 */
import { useState, type ReactNode } from 'react';
import { DecisionBar, DecisionTrail, ReaderSection, TrailEntry, type TrailKind } from '@cognirise/atelier/archetypes';
import { Sheet, SheetContent, SheetTitle } from '@cognirise/atelier/components/ui/sheet';
import { CheckCircle2, CircleDashed, Clock, Loader2, XCircle, Hourglass } from 'lucide-react';
import { bump, post, useApi } from '../lib/api';
import { date, dateTime, rel, title } from '../lib/format';
import { useApp, useFlash } from './state';
import { usePresent } from './present';
import { AgentTag, Btn, Chip, ClassChip, Clause, Empty, Kv, Ref, SegChip, StatusChip, Table, PERSONA_SHORT, ReasonChip } from './ui';

export const KIND: Record<string, TrailKind> = {
  SCAN: 'observed', OPEN_CASE: 'acted', UPDATE_CASE: 'observed', PLAN: 'proposed', SEND: 'acted', SEND_NOW: 'acted', BLOCK: 'rejected', DEFER: 'observed', ALLOW: 'observed', RECEIVE: 'observed', CLASSIFY: 'observed', ROUTE: 'acted', EXAMINE: 'proposed', WRITE: 'acted', REQUALIFY: 'acted', HANDOFF: 'acted',
  APPROVE: 'approved', REJECT: 'rejected', RETURN: 'rejected', OVERRIDE: 'overridden', ESCALATE: 'escalated', TIMEOUT: 'escalated', BRIEF: 'proposed', TASK: 'proposed', PROPOSE: 'proposed', PREVIEW: 'proposed', VERSION: 'approved', REPLAN: 'acted', ANSWER: 'acted', CONFIRM: 'approved',
  PAUSE: 'escalated', RESUME: 'acted', SCHEDULE: 'observed', SUPPRESS: 'observed', RECORD: 'observed', QUEUE: 'proposed', ANALYSE: 'observed', EMPLOYER_PACK: 'proposed', FLAG: 'rejected', OFFER: 'proposed', TASK_DONE: 'approved', CORE_EVENT: 'observed', KEEP_PAUSED: 'rejected', CLOSE: 'acted', RESCHEDULE: 'acted', ACCEPT: 'approved',
};

export function TrailList({ rows, compact }: { rows: any[]; compact?: boolean }) {
  const { go, session } = useApp();
  if (!rows.length) return <Empty>No activity yet.</Empty>;
  return (
    <DecisionTrail>
      {rows.map((e) => (
        <TrailEntry key={e.id} kind={KIND[e.act] ?? 'observed'}
          actor={e.actor_type === 'AGENT' || (e.actor_type === 'SYSTEM' && e.actor_id === 'muhaddith') ? <AgentTag id={e.actor_id} showChip={false} /> : <span className="text-sm font-medium">{e.actor_name}</span>}
          autonomy={e.autonomy ? <Chip>{e.autonomy}</Chip> : e.policy_version ? <Chip>v{e.policy_version}</Chip> : null}
          at={compact ? rel(e.at, session?.clock.now) : dateTime(e.at)}
          summary={e.summary}
          detail={e.clause || e.evidence_ref || (e.before || e.after) ? <span className="flex flex-wrap items-center gap-2 font-mono text-[11px]">{e.clause ? <Clause id={e.clause} onClick={(id) => go('policies', id.split(' ')[0])} /> : null}{e.policy_version ? <span className="text-muted-foreground">policy v{e.policy_version}</span> : null}{e.before || e.after ? <span className="text-muted-foreground">{e.before ? `before ${JSON.stringify(e.before)}` : ''} {e.after ? `after ${JSON.stringify(e.after)}` : ''}</span> : null}</span> : undefined}
          override={e.override ? { from: 'Agent recommendation', to: 'Human decision', reason: e.reason } : undefined} />
      ))}
    </DecisionTrail>
  );
}

function StepIcon({ s }: { s: string }) {
  if (s === 'DONE') return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (s === 'WAITING') return <Clock className="h-4 w-4 text-warn" />;
  if (s === 'WAITING_EVENT') return <Hourglass className="h-4 w-4 text-primary" />;
  if (s === 'REFUSED' || s === 'FAILED') return <XCircle className="h-4 w-4 text-danger" />;
  if (s === 'RUNNING') return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  return <CircleDashed className="h-4 w-4 text-muted-foreground" />;
}
export function Steps({ steps }: { steps: any[] }) {
  return (
    <ol className="space-y-1">
      {steps.map((s) => (
        <li key={s.id} className="flex items-start gap-3 rounded-lg px-2 py-1">
          <span className="mt-0.5"><StepIcon s={s.status} /></span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm"><span className={s.status === 'SKIPPED' ? 'text-muted-foreground line-through' : ''}>{s.label}</span>{s.actor_type === 'HUMAN' ? <Chip>{PERSONA_SHORT[s.actor_id] ?? s.actor_id.replace('approver:', 'approver: ')}</Chip> : <AgentTag id={s.actor_id} showChip={false} size={16} />}{s.actor_type === 'SYSTEM' ? <Chip>writes the record</Chip> : null}</p>
            {s.decision ? <p className="text-[12px] text-muted-foreground">{s.decision}</p> : null}
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">{s.ended_at ? dateTime(s.ended_at) : s.started_at ? dateTime(s.started_at) : ''}</span>
        </li>
      ))}
    </ol>
  );
}

export function Messages({ rows, compact }: { rows: any[]; compact?: boolean }) {
  const { go, session } = useApp();
  if (!rows.length) return <Empty>No messages on this case.</Empty>;
  return (
    <Table>
      <thead><tr><th>When</th><th>Channel</th><th>Message</th><th>Status</th>{!compact ? <th>Policy</th> : null}</tr></thead>
      <tbody>{rows.map((m) => <MessageRow key={m.id} m={m} compact={compact} now={session?.clock.now} go={go} />)}</tbody>
    </Table>
  );
}
function MessageRow({ m, compact, now, go }: { m: any; compact?: boolean; now?: string; go: (s: string, p?: string | null) => void }) {
  const flash = useFlash('messages', m.id, true);
  const [openBody, setOpenBody] = useState(false);
  return (
    <>
      <tr className={`clickable ${flash}`} onClick={() => setOpenBody((o) => !o)}>
        <td className="whitespace-nowrap text-[12px]"><span className="block">{dateTime(m.sent_at ?? m.scheduled_for)}</span><span className="text-muted-foreground">{rel(m.sent_at ?? m.scheduled_for, now)}</span></td>
        <td><Chip>{m.channel}</Chip></td>
        <td><span className="block text-sm">{title(m.message_type)}{m.attempt ? <span className="text-muted-foreground"> · attempt {m.attempt}</span> : null}{m.marketing ? <Chip tone="warn" className="ms-1">offer</Chip> : null}</span><span className="block truncate text-[12px] text-muted-foreground" style={{ maxWidth: 420 }}>{m.subject}</span>{m.block_reason ? <span className="block text-[12px] text-danger">{m.block_reason} {m.block_clause ? <Clause id={m.block_clause} onClick={(id) => go('policies', id.split(' ')[0])} /> : null}</span> : null}{m.meta?.deferred ? <span className="block text-[12px] text-warn">Deferred {m.meta.deferred}× by the contact cap</span> : null}</td>
        <td><StatusChip status={m.status} /></td>
        {!compact ? <td className="text-[12px] text-muted-foreground">v{m.policy_version}{m.approved_by ? ` · approved by ${m.approved_by}` : ''}{m.window_used ? ` · ${m.window_used}` : ''}</td> : null}
      </tr>
      {openBody ? <tr><td colSpan={5} className="bg-muted/30"><div className={`whitespace-pre-wrap rounded-lg border border-border/60 bg-card/60 p-3 text-[13px] leading-relaxed ${m.lang === 'ar' ? 'ar text-end' : ''}`} dir={m.lang === 'ar' ? 'rtl' : 'ltr'}><p className="mb-1 font-semibold">{m.subject}</p>{m.body}</div></td></tr> : null}
    </>
  );
}

export function Proposals({ rows }: { rows: any[] }) {
  if (!rows.length) return null;
  return (
    <Table>
      <thead><tr><th>Field</th><th>Before</th><th>After</th><th>Confidence</th><th>State</th></tr></thead>
      <tbody>{rows.map((p) => { let after = p.new_value; try { if (p.field === 'renew') { const j = JSON.parse(p.new_value); after = `${j.number} · expires ${j.expires_on}`; } } catch { /* */ } return (
        <tr key={p.id}><td className="font-mono text-[12px]">{p.target}.{p.field}</td><td className="text-[12px]">{p.old_value ?? '—'}</td><td className="text-[12px] font-medium">{after}</td><td className="font-mono text-[12px]">{p.confidence ? Number(p.confidence).toFixed(2) : '—'}{p.one_click ? <Chip tone="success" className="ms-1">one-click</Chip> : null}</td><td><StatusChip status={p.state} />{p.decided_by ? <span className="block text-[11px] text-muted-foreground">{PERSONA_SHORT[p.decided_by] ?? p.decided_by}</span> : null}</td></tr>
      ); })}</tbody>
    </Table>
  );
}

export function Recommendation({ run }: { run: any }) {
  const r = run?.result?.recommendation;
  if (!r) return null;
  const tone = r.verdict === 'APPROVE' ? 'success' : r.verdict === 'DECLINE' ? 'danger' : 'warn';
  return (
    <div className={`rounded-xl border p-3 ${tone === 'success' ? 'border-success/40 bg-success/5' : tone === 'danger' ? 'border-danger/40 bg-danger/5' : 'border-warn/40 bg-warn/5'}`}>
      <p className="flex items-center gap-2 text-[12px]"><span className="eyebrow">Agent recommendation</span><Chip tone={tone}>{r.verdict === 'APPROVE' ? 'Approve' : r.verdict === 'DECLINE' ? 'Decline' : 'Review'}</Chip></p>
      <p className="mt-1 text-sm leading-relaxed">{r.summary}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">A decision that differs from the recommendation needs a reason; it is recorded as an override on the trail.</p>
    </div>
  );
}

/** The decision bar for a run waiting on the signed-in persona. */
export function Decide({ run, onDone, extra }: { run: any; onDone?: () => void; extra?: ReactNode }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [reclassify, setReclassify] = useState(false);
  const rec = run?.result?.recommendation;
  const action = run?.result?.actionType ?? run?.payload?.actionType ?? 'DECIDE';
  const labels: Record<string, [string, string]> = {
    APPROVE_UPDATE: ['Approve the update', 'Reject the document'], ACCEPT_EXPLAINED_GAP: ['Accept the explained gap', 'Reject the document'], DECIDE_EMPLOYER: ['Approve the employer', 'Decline the employer'], APPROVE_HANDOFF: ['Approve the hand-off', 'Hold the offer'],
    DECIDE_RESTRICTION: ['Approve the restriction', 'Decline the restriction'], CLEAR_CAUTIONARY_NOTE: [reclassify ? 'Lift and reclassify' : 'Clear the note', 'Keep the note'], APPROVE_POLICY_CHANGE: ['Approve the change', 'Decline the change'], COLLECTIONS_CADENCE_EXCEPTION: ['Acknowledge the hand-off', 'Send back'],
    RESUME_CASE: ['Resume automated outreach', 'Keep paused'], ADD_DNC: ['Add the DNC entry', 'Decline'], ESCALATE_TO_RM: ['Outcome recorded', 'Send back'], RESOLVE_FAILURE: ['Resume the run', 'Close the run'], DECIDE: ['Approve', 'Decline'],
  };
  const [ok, no] = labels[action] ?? labels.DECIDE;
  const decide = async (decision: 'APPROVED' | 'REJECTED') => {
    const overrides = rec && ((rec.verdict === 'DECLINE' && decision === 'APPROVED') || (rec.verdict === 'APPROVE' && decision === 'REJECTED'));
    if ((overrides || decision === 'REJECTED') && !reason.trim()) { setErr('A reason is required'); return; }
    setBusy(true); setErr('');
    try { await post(`/runs/${run.id}/decide`, { decision, reason: reason.trim() || undefined, edits: reclassify ? { reclassify: true } : undefined }); bump(); onDone?.(); window.dispatchEvent(new CustomEvent('jahiz:action', { detail: { kind: 'decide', runId: run.id, action, decision } })); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <DecisionBar prompt={<span>This waits on you: <strong>{title(action)}</strong>. {rec ? `Agent recommends: ${rec.verdict.toLowerCase()}.` : ''}</span>}>
        {action === 'CLEAR_CAUTIONARY_NOTE' ? <label className="flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={reclassify} onChange={(e) => setReclassify(e.target.checked)} /> reclassify to a workflow</label> : null}
        <Btn small onClick={() => decide('REJECTED')} disabled={busy}>{no}</Btn>
        <Btn small kind="primary" onClick={() => decide('APPROVED')} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{ok}</Btn>
      </DecisionBar>
      <input className="input w-full" placeholder="Reason (required to decline or to override the recommendation)" value={reason} onChange={(e) => setReason(e.target.value)} />
      {err ? <p className="text-[12px] text-danger">{err}</p> : null}
      {extra}
    </div>
  );
}

export function CaseReader({ refCode, onClose }: { refCode: string; onClose?: () => void }) {
  const { persona, go, open } = useApp();
  const { data: d, error, reload } = useApi<any>(`/cases/${encodeURIComponent(refCode)}`);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  if (error) return <Empty>{error}</Empty>;
  if (!d) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  const k = d.case;
  const waiting = d.runs.find((r: any) => (r.status === 'WAITING' || r.status === 'ESCALATED') && r.waiting_on_persona === persona?.key);
  const act = async (type: string, extra: any = {}) => { setBusy(type); setMsg(''); try { const r = await post(`/cases/${k.ref}/action`, { type, ...extra }); setMsg(r.result); bump(); reload(); } catch (e: any) { setMsg(e.message); } finally { setBusy(''); } };
  return (
    <div className="space-y-5">
      <header>
        <p className="flex flex-wrap items-center gap-2 text-[12px]"><Ref>{k.ref}</Ref><ClassChip cls={k.cls} long /><StatusChip status={k.state} />{k.close_code ? <StatusChip status={k.close_code} /> : null}{k.paused ? <Chip tone="danger">paused: {k.pause_reason}</Chip> : null}{k.edge_key ? <Chip>{k.edge_key}</Chip> : null}</p>
        <h2 className="mt-1 text-lg font-semibold"><button type="button" className="hover:text-primary" onClick={() => open(`customer:${k.customer_id}`)}>{k.name_en}</button> <span className="ar text-muted-foreground">{k.name_ar}</span></h2>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground"><Ref>{k.customer_id}</Ref><SegChip s={k.segment} /><span>{k.is_qatari ? 'Qatari' : 'Resident'}</span><span>· {k.workflow_id}</span><span>· opened {date(k.opened_at)}</span>{k.rm_id ? <span>· RM {k.rm_id}</span> : null}</p>
        <p className="mt-2 flex flex-wrap gap-1">{(k.reasons as string[]).map((r) => <ReasonChip key={r} code={r} />)}{k.primary_reason ? <Chip tone="primary">leads: {k.primary_reason}</Chip> : null}</p>
      </header>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kv k="Attempts" v={`${k.attempts} of ${k.max_attempts}`} /><Kv k="Next action" v={k.next_action_at ? date(k.next_action_at) : '—'} /><Kv k="Re-check" v={k.recheck_on ? `${date(k.recheck_on)} · ${k.recheck_reason ?? ''}` : '—'} /><Kv k="Owner" v={k.owner_persona ? PERSONA_SHORT[k.owner_persona] : '—'} />
      </dl>
      {waiting ? <><Recommendation run={waiting} /><Decide run={waiting} onDone={reload} /></> : d.runs.some((r: any) => r.status === 'WAITING') ? <p className="text-[12px] text-muted-foreground">Waiting on {PERSONA_SHORT[d.runs.find((r: any) => r.status === 'WAITING').waiting_on_persona]}.</p> : null}
      {(d.can.send || d.can.reschedule || d.can.pause || d.can.escalate || d.can.rerun || d.can.close) && k.state !== 'CLOSED' ? (
        <ReaderSection label="Actions (through the engine; Hami checks every send)">
          <div className="flex flex-wrap gap-2">
            {d.can.send && d.messages.some((m: any) => m.status === 'SCHEDULED') ? <Btn small onClick={() => act('SEND_REMINDER')} disabled={!!busy}>Send the next message now</Btn> : null}
            {d.can.reschedule ? <Btn small onClick={() => act('RESCHEDULE', { days: 7 })} disabled={!!busy}>Reschedule +7 days</Btn> : null}
            {d.can.pause && !k.paused ? <Btn small onClick={() => act('PAUSE_CASE', { reason: 'Paused by a person' })} disabled={!!busy}>Pause</Btn> : null}
            {d.can.resume && k.paused ? <Btn small onClick={() => act('RESUME_CASE')} disabled={!!busy}>Resume</Btn> : null}
            {d.can.escalate ? <Btn small onClick={() => act('ESCALATE_TO_RM')} disabled={!!busy}>Escalate to a person</Btn> : null}
            {d.can.rerun ? <Btn small onClick={() => act('RERUN_QUALIFICATION')} disabled={!!busy}>Re-run the eligibility check</Btn> : null}
            {d.can.restrict && k.cls === 'A' ? <Btn small onClick={() => act('PROPOSE_RESTRICTION')} disabled={!!busy}>Propose a restriction</Btn> : null}
            {d.can.close ? <Btn small kind="danger" onClick={() => act('CLOSE_UNRESPONSIVE', { reason: 'Closed by a person' })} disabled={!!busy}>Close as unresponsive</Btn> : null}
          </div>
          {msg ? <p className="mt-2 text-[12px] text-muted-foreground">{msg}</p> : null}
        </ReaderSection>
      ) : null}
      {d.documents.length ? (
        <ReaderSection label="Documents and proposed updates">
          <ul className="space-y-2">{d.documents.map((doc: any) => (
            <li key={doc.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/50 p-2 text-[12px]">
              <button type="button" onClick={() => go('documents', String(doc.id))} className="font-mono text-primary">document {doc.id}</button><Chip>{doc.type}</Chip><StatusChip status={doc.state} />{doc.recommendation ? <Chip tone={doc.recommendation === 'APPROVE' ? 'success' : doc.recommendation === 'REJECT' ? 'danger' : 'warn'}>{doc.recommendation.toLowerCase()}</Chip> : null}{doc.overall_confidence ? <span className="font-mono">{Number(doc.overall_confidence).toFixed(2)}</span> : null}<Chip>{doc.assurance}</Chip>{doc.mode ? <StatusChip status={doc.mode} /> : null}{(doc.flags ?? []).map((f: string) => <Chip key={f} tone="danger">{f.replace(/_/g, ' ').toLowerCase()}</Chip>)}<span className="ms-auto text-muted-foreground">{dateTime(doc.received_at)}</span>
            </li>))}</ul>
          <div className="mt-2"><Proposals rows={d.proposals} /></div>
        </ReaderSection>
      ) : null}
      <ReaderSection label="Messages" action={<button type="button" className="text-[12px] text-primary" onClick={() => go('comms', `customer=${k.customer_id}`)}>all for this customer</button>}><Messages rows={d.messages} compact /></ReaderSection>
      {d.inbound.length ? <ReaderSection label="Inbound"><ul className="space-y-1">{d.inbound.map((i: any) => <li key={i.id} className="rounded-lg border border-border/60 bg-card/50 p-2 text-[12px]"><span className="font-mono text-muted-foreground">{dateTime(i.received_at)} · {i.channel}</span> <StatusChip status={i.classification} /> {i.confidence ? <span className="font-mono">{Number(i.confidence).toFixed(2)}</span> : null} {i.mode ? <StatusChip status={i.mode} /> : null}<p className="mt-0.5">{i.body}</p>{i.routed_to ? <p className="text-muted-foreground">→ {i.routed_to}</p> : null}</li>)}</ul></ReaderSection> : null}
      {d.tasks.length ? <ReaderSection label="Tasks for people"><ul className="space-y-1 text-[12px]">{d.tasks.map((t: any) => <li key={t.id} className="flex flex-wrap items-center gap-2"><Chip>{t.kind.replace(/_/g, ' ').toLowerCase()}</Chip><span>{t.title}</span><span className="text-muted-foreground">→ {PERSONA_SHORT[t.assignee_persona]}</span><StatusChip status={t.state} />{t.outcome ? <span className="text-muted-foreground">· {t.outcome}</span> : null}</li>)}</ul></ReaderSection> : null}
      <ReaderSection label="Workflow runs">
        <div className="space-y-3">{d.runs.map((r: any) => (
          <div key={r.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
            <p className="flex flex-wrap items-center gap-2 text-sm"><Chip tone="primary">{r.workflow_id}</Chip><span className="font-medium">{r.title}</span><StatusChip status={r.status} />{r.waiting_on_persona ? <Chip tone="warn">waits on {PERSONA_SHORT[r.waiting_on_persona]}</Chip> : null}{r.waiting_event ? <Chip>waits for {r.waiting_event.toLowerCase()}</Chip> : null}<span className="ms-auto text-[11px] text-muted-foreground">{r.channel} · {dateTime(r.created_at)}{r.scenario_key ? ` · ${r.scenario_key}` : ''}</span></p>
            <div className="mt-2"><Steps steps={r.steps} /></div>
          </div>))}</div>
      </ReaderSection>
      <ReaderSection label="Trail"><TrailList rows={[...d.trail].reverse()} compact /></ReaderSection>
      {onClose ? <div className="pt-2"><Btn small onClick={onClose}>Close</Btn></div> : null}
    </div>
  );
}

export function CaseDrawer() {
  const { caseRef, openCase, director } = useApp();
  const flash = useFlash('cases', caseRef);
  // While the Director runs, the drawer is non-modal so the Director bar stays usable;
  // clicks on the bar must not dismiss the drawer.
  const directing = !!director;
  const { present } = usePresent(); // while presenting the drawer starts under the Present bar, so its controls stay visible
  return (
    <Sheet open={!!caseRef} onOpenChange={(o) => !o && openCase(null)} modal={!directing}>
      <SheetContent side="right" className={`w-full overflow-y-auto sm:max-w-2xl ${directing ? 'pb-48 shadow-2xl' : ''} ${present ? 'present-drawer' : ''} ${flash}`} onInteractOutside={(e) => { if (directing) e.preventDefault(); }}>
        <SheetTitle className="sr-only">Case {caseRef}</SheetTitle>
        {caseRef ? <CaseReader refCode={caseRef} onClose={() => openCase(null)} /> : null}
      </SheetContent>
    </Sheet>
  );
}
