/**
 * The Stage — how a scenario is shown in Present mode.
 *
 * Three panes on one screen, so the room never follows a navigation:
 *   01 the customer   the phone of the customer this scenario is about
 *   02 the agents     the step's narration, what changed, and the live log
 *   03 the bank       the core-banking record (a representative screen,
 *                     fields flash when an agent wrote them) and the thing
 *                     the step points at: the case, the inbox decision, the
 *                     document, the employer pack, the policy, the messages
 * Above them, the journey: every step of the scenario, the current one lit.
 * The Director drives it; the panes re-read the data after every step.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@cognirise/atelier/lib/utils';
import { Bot, Check, ExternalLink, Hand, Landmark, Smartphone, Zap } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { date, dateShort, dateTime, maskQid, month, num, qar, title } from '../lib/format';
import { HAND_EVENT, useApp } from './state';
import { plainActivity } from './plain';
import { usePresent } from './present';
import { Decide, Messages, Recommendation, TrailList } from './case';
import { AgentTag, Chip, Clause, Empty, Kv, PERSONA_SHORT, Ref, SegChip, StatusChip } from './ui';
import { Phone } from '../screens/customerapp';

const parseRef = (ref: string | undefined | null) => { if (!ref) return { kind: '', param: null as string | null }; const i = ref.indexOf(':'); return i < 0 ? { kind: ref, param: null } : { kind: ref.slice(0, i), param: ref.slice(i + 1) }; };

export function Stage() {
  const { present, item } = usePresent();
  const { director, session } = useApp();
  const { data: sc } = useApi<any>('/scenarios');
  const chapter = item && item.type !== 'card' ? item.chapter : null;
  const scenario = chapter ? (sc?.scenarios ?? []).find((s: any) => s.key === chapter.scenario) : null;
  const step = director?.steps[Math.max(0, director.index)];
  const target = parseRef(step?.screenResolved ?? step?.screen);
  // The customer on the phone: the one the step points at, else the one the scenario is about; never blank between steps.
  const edge: Record<string, string> = session?.edge ?? {};
  const defaultCustomer = (scenario?.cases ?? []).map((ec: string) => edge[ec]).find(Boolean) ?? null;
  const { data: caseData } = useApi<any>(target.kind === 'case' && target.param ? `/cases/${encodeURIComponent(target.param)}` : null);
  const stepCustomer = ['customer', 'customer-app', 'mailbox'].includes(target.kind) ? target.param : target.kind === 'comms' && target.param?.startsWith('customer=') ? target.param.slice(9) : target.kind === 'case' ? caseData?.case?.customer_id ?? null : null;
  const [customerId, setCustomerId] = useState<string | null>(null);
  useEffect(() => { const next = stepCustomer ?? customerId ?? defaultCustomer; if (next && next !== customerId) setCustomerId(next); }, [stepCustomer, defaultCustomer, customerId]);
  // The phone turns to what the step is about: the upload screen when the customer must upload, the conversation when a message went out, the offer when it landed.
  const kind = step?.action.kind ?? '';
  const pending = !!director?.pending;
  const offerLanded = !!director?.changes?.messages.some((m) => m.message_type === 'OFFER' || m.message_type === 'CURRENT_ACCOUNT_OFFER');
  const phoneView: 'home' | 'messages' | 'upload' | 'finance' | undefined =
    kind === 'customer_upload' ? (pending ? 'upload' : 'messages')
    : kind === 'customer_reply' ? 'messages'
    : kind === 'customer_accept_offer' ? (pending ? 'finance' : 'home')
    : offerLanded ? 'finance'
    : kind === 'send_due' || kind === 'email_in' || target.kind === 'comms' || target.kind === 'mailbox' ? 'messages'
    : target.kind === 'customer-app' ? 'home'
    : undefined;
  // A hand action in the room (an upload on the phone, a decision in the bank pane) completes the pending step and the scenario moves on.
  const { completeStep } = useApp();
  useEffect(() => {
    const on = (e: Event) => { const k = (e as CustomEvent).detail?.kind as string; const st = director?.steps[director.index]; if (director?.pending && st && (HAND_EVENT[k] ?? []).includes(st.action.kind)) completeStep(); };
    window.addEventListener('jahiz:action', on); return () => window.removeEventListener('jahiz:action', on);
  }, [director, completeStep]);
  // ...and, independently of any browser event, the server is asked every two seconds whether the hand step happened (the real phone, another tab, a slow request).
  const pendingKey = director?.pending && !director.busy ? `${director.key}:${director.index}` : null;
  useEffect(() => {
    if (!pendingKey) return;
    const [key, idx] = pendingKey.split(':');
    let stop = false;
    const tick = async () => { try { const r = await api<{ done: boolean }>(`/scenarios/${key}/pending?index=${idx}`); if (!stop && r.done) completeStep(); } catch { /* next tick */ } };
    const t = window.setInterval(tick, 2000);
    return () => { stop = true; window.clearInterval(t); };
  }, [pendingKey, completeStep]);
  if (!present || !chapter) return null;
  return (
    <div className="space-y-3">
      <Journey />
      <div className="grid gap-3 xl:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.15fr)]">
        <Pane n="01" title="The customer" sub={customerId ? <Ref>{customerId}</Ref> : 'the phone'} icon={<Smartphone size={14} />}>
          {customerId ? <div className="stage-phone"><Phone id={customerId} key={customerId} bare view={phoneView} viewKey={`${director?.index ?? 0}:${pending ? 'w' : 'r'}`} /></div> : <Empty>No customer in this step.</Empty>}
        </Pane>
        <Pane n="02" title="The agents" sub="what is happening, live" icon={<Bot size={14} />}>
          <Narration />
          <LiveLog since={present.activityFloor} />
        </Pane>
        <Pane n="03" title="The bank" sub="the record, and the person deciding" icon={<Landmark size={14} />}>
          {customerId ? <CoreRecord id={customerId} /> : null}
          <Focus kind={target.kind} param={target.param} customerId={customerId} />
        </Pane>
      </div>
    </div>
  );
}

function Pane({ n, title: t, sub, icon, children }: { n: string; title: string; sub?: ReactNode; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="glass-l2 flex min-h-0 flex-col rounded-2xl">
      <header className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5"><span className="font-mono text-[11px] text-primary">{n}</span><span className="text-sm font-semibold">{t}</span><span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon}{sub}</span></header>
      <div className="stage-pane-body space-y-3 overflow-y-auto p-3 scroll-thin">{children}</div>
    </section>
  );
}

/** The scenario's steps as a journey across the top; the current one lit, the past ones ticked. */
function Journey() {
  const { director } = useApp();
  if (!director) return <div className="glass-l2 rounded-2xl px-4 py-3 text-sm text-muted-foreground">Starting the scenario…</div>;
  return (
    <ol className="glass-l2 flex items-stretch gap-1 overflow-x-auto rounded-2xl px-3 py-2 scroll-thin">
      {director.steps.map((s, i) => {
        const state = i < director.index ? 'done' : i === director.index ? 'now' : 'next';
        return (
          <li key={s.id} title={`${s.title} — ${s.trigger}`} className={cn('flex min-w-[120px] flex-1 items-start gap-2 rounded-xl px-2.5 py-1.5', state === 'now' && 'bg-primary/10 ring-1 ring-primary/40')}>
            <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px]', state === 'done' ? 'border-success/60 bg-success/15 text-success' : state === 'now' ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground')}>{state === 'done' ? <Check className="h-3 w-3" /> : i + 1}</span>
            <span className="min-w-0"><span className={cn('block truncate text-[12px] leading-tight', state === 'now' ? 'font-semibold' : state === 'done' ? 'text-foreground/80' : 'text-muted-foreground')}>{s.title}</span>{s.persona ? <span className="block truncate text-[10px] text-muted-foreground">{PERSONA_SHORT[s.persona] ?? s.persona}</span> : null}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** The current step: what the Director is doing and what changed. */
function Narration() {
  const { director, open, go } = useApp();
  const { setView } = usePresent();
  if (!director) return null;
  const st = director.steps[Math.max(0, director.index)];
  const ch = director.changes;
  const changed = ch ? [
    ...ch.cases.map((c) => `${c.ref} → ${title(c.state)}${c.close_code ? ` (${title(c.close_code)})` : ''}`),
    ...ch.messages.map((m) => `${m.channel} ${title(m.message_type)} · ${title(m.status)}${m.block_reason ? `: ${m.block_reason}` : ''}`),
    ...ch.documents.map((d) => `document ${d.id} · ${d.type} · ${title(d.state)}`),
    ...ch.tasks.map((t) => `task for ${PERSONA_SHORT[t.assignee_persona] ?? t.assignee_persona}: ${t.title}`),
    ...(ch.policyVersion ? [`policy version ${ch.policyVersion} active`] : []),
    ...(ch.proposals ? [`${ch.proposals} proposal(s) changed`] : []),
  ] : [];
  return (
    <div className="rounded-xl border border-accent/40 bg-background/70 p-3">
      <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span className="font-mono uppercase tracking-wider text-accent">step {director.index + 1} of {director.steps.length}</span>{st?.persona ? <Chip tone="primary">as {PERSONA_SHORT[st.persona] ?? st.persona}</Chip> : null}{director.restored?.length && director.index === 0 ? <Chip tone="warn" title={director.restored.join(', ')}>seeded state restored</Chip> : null}{director.status === 'done' ? <Chip tone="success">Scenario complete</Chip> : null}</p>
      <p className="mt-1 text-base font-semibold leading-tight">{st?.title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-foreground/90">{st?.narration}</p>
      {director.pending && st ? <YourMove kind={st.action.kind} persona={st.persona} /> : null}
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]"><Zap className="h-3 w-3 text-accent" /><span className="text-muted-foreground">Trigger</span> <span className="font-medium">{st?.trigger}</span>{director.result ? <><span className="text-muted-foreground">· Result</span> <span className="font-mono">{director.result}</span></> : null}{director.error ? <span className="text-danger">Error: {director.error}</span> : null}</p>
      {changed.length ? <ul className="mt-2 space-y-0.5 text-[12px]">{changed.slice(0, 8).map((c, i) => <li key={i} className="flash rounded px-1">• {c}</li>)}{changed.length > 8 ? <li className="text-muted-foreground">… and {changed.length - 8} more</li> : null}</ul> : <p className="mt-2 text-[12px] text-muted-foreground">{director.busy ? 'Running the step through the engine…' : st?.action.kind === 'show' ? 'Nothing executed: this step shows what is already there.' : 'Nothing changed.'}</p>}
      <p className="mt-2"><button type="button" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline" onClick={() => { setView('app'); if (st?.screenResolved) open(st.screenResolved); else go('overview'); }}><ExternalLink className="h-3 w-3" />Open this step in the app</button></p>
    </div>
  );
}

/** A pending hand step: the room acts, or → lets the Director act. */
function YourMove({ kind, persona }: { kind: string; persona?: string }) {
  const { completeStep, director } = useApp();
  const who = persona ? PERSONA_SHORT[persona] ?? persona : 'the decider';
  const text = kind === 'customer_upload' ? 'Upload the document on the phone (Documents tab), or press → and the Director uploads it.'
    : kind === 'customer_reply' ? 'Reply on the phone (Messages), or press → and the Director replies.'
    : kind === 'customer_accept_offer' ? 'Accept the offer on the phone, or press → and the Director accepts it.'
    : `Decide as ${who} in the bank pane, or press → and the Director decides as the script says.`;
  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-[13px]">
      <Hand className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1"><span className="font-semibold text-primary">Your move. </span>{text}</span>
      <button type="button" disabled={director?.busy} onClick={() => completeStep()} title="If you did it and the scenario has not moved on, this moves it on" className="shrink-0 rounded-full border border-primary/50 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50">Done, continue</button>
    </div>
  );
}

/** The live log in plain language: who did what, oldest first, newest at the bottom, only what this scenario did. */
function LiveLog({ since }: { since: number }) {
  const { data } = useApi<any[]>(`/activity?since=${since}`, { poll: 3000 });
  const { go } = useApp();
  // The engine stamps activity with the virtual clock, which stands still during a scenario; the room wants to see time pass, so each line keeps the wall-clock moment it arrived.
  const seen = useRef(new Map<number, string>());
  const rows = useMemo(() => {
    const out: { id: number; at: string; who: string; text: string; kind: string; clause: string | null; raw: string }[] = [];
    for (const a of [...(data ?? [])].reverse()) {
      if (!seen.current.has(a.id)) seen.current.set(a.id, new Date().toLocaleTimeString('en-GB', { hour12: false }));
      const p = plainActivity(a);
      if (p.kind === 'skip') continue;
      const prev = out[out.length - 1];
      if (prev && prev.who === p.who && prev.text === p.text) continue; // the engine and the Director sometimes both log one event
      out.push({ id: a.id, at: seen.current.get(a.id)!, who: p.who, text: p.text, kind: p.kind, clause: p.clause ?? null, raw: `${a.agent ?? a.trigger}: ${a.action} → ${a.result}` });
    }
    return out;
  }, [data]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [rows.length]);
  const tone: Record<string, string> = { agent: 'text-[hsl(var(--hero-primary))]', person: 'text-sky-300', customer: 'text-emerald-300', system: 'text-white/70', reset: 'text-white/50' };
  return (
    <div className="rounded-xl border border-border/60 bg-[hsl(var(--hero-background))] text-[hsl(var(--hero-foreground))]">
      <p className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[11px]"><span className="font-semibold">What the agents did</span><span className="font-mono text-[10px] uppercase tracking-wider opacity-60">{rows.length} entries</span></p>
      <ol className="max-h-[44vh] min-h-[160px] space-y-1.5 overflow-y-auto px-3 py-2 text-[13px] leading-snug scroll-thin">
        {rows.map((r) => (
          <li key={r.id} title={r.raw} className={cn('grid grid-cols-[48px_minmax(0,1fr)] gap-x-2', r.kind === 'reset' && 'opacity-60')}>
            <span className="pt-0.5 font-mono text-[10px] opacity-50">{r.at.slice(0, 5)}</span>
            <span className="min-w-0"><span className={cn('font-semibold', tone[r.kind] ?? '')}>{r.who}:</span> {r.text}{r.clause ? <button type="button" className="ms-1.5 rounded border border-white/20 px-1 font-mono text-[10px] opacity-70 hover:opacity-100" onClick={() => go('policies', String(r.clause).split(' ')[0])}>{r.clause}</button> : null}</span>
          </li>
        ))}
        {!rows.length ? <li className="opacity-60">Waiting for the first step…</li> : null}
        <div ref={end} />
      </ol>
    </div>
  );
}

/** The customer's record as the core bank holds it: a representative screen. Fields an agent changed in the last step flash. */
function CoreRecord({ id }: { id: string }) {
  const { data: d } = useApi<any>(`/customers/${id}`);
  const { director } = useApp();
  const stepIndex = director?.index ?? -1;
  const prev = useRef<{ id: string; fields: Record<string, string>; at: number } | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const fields = useMemo(() => {
    if (!d) return null;
    const c = d.customer; const idn = d.identity ?? {}; const emp = d.employment ?? {}; const q = d.qualification; const last = (d.credits ?? []).slice(-1)[0]; const cur = (d.accounts ?? []).find((a: any) => a.type === 'CURRENT');
    return {
      'Customer': `${c.rim_no} · ${c.nameEn}`,
      'Status': title(c.status),
      'Segment': `${c.segment}${c.segment_tag ? ` · ${c.segment_tag}` : ''}`,
      'QID number': maskQid(idn.qidNumber),
      'QID expiry': idn.qidExpiry ? date(idn.qidExpiry) : '—',
      'Passport expiry': idn.passportExpiry ? date(idn.passportExpiry) : '—',
      'Employer': emp.employerName ? `${emp.employerName} · ${title(emp.employerStatus)}` : '—',
      'Last salary credit': last ? `${month(last.month)} · ${qar(last.amount)}` : '—',
      'Current account': cur ? `${cur.iban?.slice(-8) ?? cur.id} · ${title(cur.status)}` : '—',
      'Pre-approval': q ? (q.eligible ? `Eligible · ${qar(q.amount)} over ${q.tenor ?? '—'} months` : `Not eligible · ${(q.reasons ?? q.reasonCodes ?? []).join(', ') || '—'}`) : '—',
    } as Record<string, string>;
  }, [d]);
  useEffect(() => {
    if (!fields) return;
    // The first step restores the seeded state; that is not an agent writing, so differences are flagged only from the second step on.
    if (prev.current && prev.current.id === id && prev.current.at >= 1) {
      const diff = new Set(Object.keys(fields).filter((k) => prev.current!.fields[k] !== fields[k]));
      if (diff.size) { setChanged(diff); const t = window.setTimeout(() => setChanged(new Set()), 7000); prev.current = { id, fields, at: stepIndex }; return () => window.clearTimeout(t); }
    }
    prev.current = { id, fields, at: stepIndex };
  }, [fields, id, stepIndex]);
  if (!fields) return <div className="rounded-xl border border-border/60 p-3 text-[12px] text-muted-foreground">Reading the core record…</div>;
  return (
    <div className="rounded-xl border border-border/60 bg-card/60">
      <p className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-1.5 text-[11px]"><Landmark className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-semibold">Core banking · customer record</span><Chip title="A representative screen: the fields the real system holds, read through the connector. Not QIB's actual core banking UI.">representative screen</Chip><span className="ms-auto font-mono text-[10px] text-muted-foreground">read-only · writes go through Muhaddith after approval</span></p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 py-2 md:grid-cols-3">
        {Object.entries(fields).map(([k, v]) => (
          <div key={k} className={cn('min-w-0 rounded-md px-1.5 py-0.5', changed.has(k) && 'flash bg-accent/10')}>
            <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">{k}{changed.has(k) ? <span className="rounded bg-accent px-1 font-mono text-[9px] text-white">agent wrote</span> : null}</dt>
            <dd className="truncate font-mono text-[12px]" title={v}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ------------------------------------------------------------------ what the step points at
// One idea per view: the decision if there is one, else the one fact the step is about. Detail stays in the app ("Open this step in the app").
function Focus({ kind, param, customerId }: { kind: string; param: string | null; customerId: string | null }) {
  switch (kind) {
    case 'case': return param ? <FocusBox label="The case"><CaseFocus refCode={param} /></FocusBox> : null;
    case 'inbox': return <FocusBox label="Waiting on the person in the room"><InboxFocus /></FocusBox>;
    case 'document': return param ? <FocusBox label="The document Fahis read"><DocumentFocus id={Number(param)} /></FocusBox> : null;
    case 'employer': return param ? <FocusBox label="The employer"><EmployerFocus id={param} /></FocusBox> : null;
    case 'policies': return <FocusBox label="The policy"><PolicyFocus param={param} /></FocusBox>;
    case 'comms': return <FocusBox label="Messages"><CommsFocus param={param} /></FocusBox>;
    case 'audit': return <FocusBox label="The trail"><AuditFocus param={param} /></FocusBox>;
    case 'agents': return <FocusBox label="The agent"><AgentFocus id={param} /></FocusBox>;
    case 'triggers': return <FocusBox label="The clock"><ClockFocus /></FocusBox>;
    case 'customer': case 'customer-app': case 'mailbox': return customerId ? <FocusBox label="The eligibility check"><QualificationFocus id={customerId} /></FocusBox> : null;
    default: return <FocusBox label={kind || 'This step'}><p className="text-[12px] text-muted-foreground">This step shows the {kind || 'overview'} screen; use "Open this step in the app" to show it in full.</p></FocusBox>;
  }
}
function FocusBox({ label, children }: { label: string; children: ReactNode }) {
  return <div className="rounded-xl border border-border/60 bg-card/40 p-3"><p className="eyebrow mb-2">{label}</p>{children}</div>;
}
/** The decision a run waits for from the person in the room: the recommendation in one line and the two buttons. */
function DecisionFor({ runId, onDone }: { runId: number; onDone: () => void }) {
  const { data: run } = useApi<any>(`/runs/${runId}`);
  if (!run) return null;
  return <div className="space-y-2"><Recommendation run={run} /><Decide run={run} onDone={onDone} /></div>;
}

/** The case in four facts and, when it waits on the person in the room, the decision. */
function CaseFocus({ refCode }: { refCode: string }) {
  const { data: d, reload } = useApi<any>(`/cases/${encodeURIComponent(refCode)}`);
  const { data: rs } = useApi<any>('/reasons');
  const { persona } = useApp();
  if (!d) return <p className="text-[12px] text-muted-foreground">Loading…</p>;
  const k = d.case;
  const waiting = (d.runs ?? []).find((r: any) => (r.status === 'WAITING' || r.status === 'ESCALATED') && r.waiting_on_persona === persona?.key);
  const other = !waiting ? (d.runs ?? []).find((r: any) => r.status === 'WAITING' || r.status === 'ESCALATED') : null;
  const reason = (rs?.reasons ?? []).find((r: any) => r.code === k.primary_reason)?.label ?? k.primary_reason;
  const lastMsg = (d.messages ?? [])[0];
  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-2 text-[12px]"><Ref>{k.ref}</Ref><StatusChip status={k.state} />{k.close_code ? <StatusChip status={k.close_code} /> : null}<span className="text-muted-foreground">class {k.cls}</span></p>
      <p className="text-base font-semibold leading-tight">{k.name_en} <span className="text-[13px] font-normal text-muted-foreground"><SegChip s={k.segment} /></span></p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kv k="Why it fell out" v={reason ?? '—'} /><Kv k="Attempts" v={`${k.attempts} of ${k.max_attempts}`} /><Kv k="Next action" v={k.next_action_at ? date(k.next_action_at) : '—'} /><Kv k="Last message" v={lastMsg ? `${dateShort(lastMsg.scheduled_for ?? lastMsg.sent_at)} · ${title(lastMsg.message_type)}` : '—'} />
      </dl>
      {waiting ? <DecisionFor runId={waiting.id} onDone={reload} /> : other ? <p className="text-[12px] text-muted-foreground">Waiting on {PERSONA_SHORT[other.waiting_on_persona] ?? other.waiting_on_persona}.</p> : null}
    </div>
  );
}

function InboxFocus() {
  const { data, reload } = useApi<any>('/inbox', { poll: 5000 });
  const { persona } = useApp();
  if (!data) return <p className="text-[12px] text-muted-foreground">Loading…</p>;
  const approvals: any[] = data.approvals ?? []; const tasks: any[] = data.tasks ?? [];
  if (!approvals.length && !tasks.length) return <Empty>Nothing waits on {persona?.role ?? 'this person'} right now.</Empty>;
  return (
    <div className="space-y-3">
      {approvals.slice(0, 2).map((a) => <ApprovalFocus key={a.run_id} a={a} onDone={reload} />)}
      {tasks.slice(0, 2).map((t) => <div key={t.id} className="rounded-lg border border-border/60 bg-card/50 p-2.5 text-[12px]"><p className="flex flex-wrap items-center gap-2"><Chip tone="primary">{t.kind.replace(/_/g, ' ').toLowerCase()}</Chip>{t.name_en ? <span>{t.name_en}</span> : null}</p><p className="mt-1 text-sm font-medium">{t.title}</p></div>)}
    </div>
  );
}
function ApprovalFocus({ a, onDone }: { a: any; onDone: () => void }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 p-2.5">
      <p className="flex flex-wrap items-center gap-2 text-[12px]">{a.name_en ? <span className="font-medium">{a.name_en}</span> : null}<SegChip s={a.segment} /><Chip>{title(a.action_type)}</Chip></p>
      <p className="mt-1 text-sm">{a.title}</p>
      <div className="mt-2"><DecisionFor runId={a.run_id} onDone={onDone} /></div>
    </div>
  );
}

/** The document: the picture, what Fahis found in one line, and the decision if it waits on the room. */
function DocumentFocus({ id }: { id: number }) {
  const { data: d, reload } = useApi<any>(`/documents/${id}`);
  const { persona } = useApp();
  if (!d) return <p className="text-[12px] text-muted-foreground">Loading…</p>;
  const mine = d.run && (d.run.status === 'WAITING' || d.run.status === 'ESCALATED') && d.run.waiting_on_persona === persona?.key;
  const conf = d.overall_confidence != null ? `${Math.round(Number(d.overall_confidence) * 100)}%` : null;
  const props: any[] = d.proposals ?? [];
  const field = (p: any) => `${String(p.target ?? '').replace(/_/g, ' ')} ${String(p.field ?? '').replace(/_/g, ' ')}: ${p.old_value ?? '—'} → ${String(p.new_value ?? '').replace(/_/g, ' ').toLowerCase()}`;
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <img src={`/api/documents/${id}/image.svg`} alt={`${d.type} specimen`} className="w-[150px] shrink-0 rounded-lg border border-border/60 bg-white" />
        <div className="min-w-0 space-y-1.5">
          <p className="flex flex-wrap items-center gap-2 text-[12px]"><Chip>{title(d.type)}</Chip><StatusChip status={d.state} />{conf ? <Chip tone="primary">read at {conf}</Chip> : null}</p>
          <p className="text-sm font-medium">{d.name_en}</p>
          {props.slice(0, 2).map((p: any) => <p key={p.id} className="font-mono text-[12px]">{field(p)}</p>)}
          {d.flags?.length ? <p className="text-[12px] text-warn">{(d.flags as string[]).join(' · ')}</p> : null}
        </div>
      </div>
      {mine && d.run ? <DecisionFor runId={d.run.id} onDone={reload} /> : d.run?.status === 'WAITING' ? <p className="text-[12px] text-muted-foreground">Waiting on {PERSONA_SHORT[d.run.waiting_on_persona] ?? d.run.waiting_on_persona}.</p> : null}
    </div>
  );
}

/** The employer: the leverage number, the recommendation, the decision. The criteria table is one click away in the app. */
function EmployerFocus({ id }: { id: string }) {
  const { data: d, reload } = useApi<any>(`/employers/${id}`);
  const { persona } = useApp();
  const { data: run } = useApi<any>(d?.run?.id ? `/runs/${d.run.id}` : null);
  if (!d) return <p className="text-[12px] text-muted-foreground">Loading…</p>;
  const e = d.employer; const pack = d.reviews?.[0]?.pack;
  const blocked = (d.staff ?? []).filter((s: any) => s.eligible === false && (s.reason_codes ?? []).includes('R02')).length;
  const met = pack ? pack.criteria.filter((c: any) => c.ok).length : null;
  const mine = run && (run.status === 'WAITING' || run.status === 'ESCALATED') && run.waiting_on_persona === persona?.key;
  return (
    <div className="space-y-3">
      <p className="text-base font-semibold leading-tight">{e.name_en} <StatusChip status={e.approval_status === 'UNDER_REVIEW' ? 'UNDER_REVIEW_E' : e.approval_status} /></p>
      <dl className="grid grid-cols-3 gap-3"><Kv k="QIB-salaried customers" v={num(d.staff?.length ?? 0)} /><Kv k="Waiting only on this approval" v={<span className="text-xl font-bold text-primary">{num(blocked)}</span>} /><Kv k="Criteria met" v={pack ? `${met} of ${pack.criteria.length}` : '—'} /></dl>
      {mine ? <div className="space-y-2"><Recommendation run={run} /><Decide run={run} onDone={() => reload()} /></div> : d.run?.status === 'WAITING' ? <p className="text-[12px] text-muted-foreground">Waiting on {PERSONA_SHORT[d.run.waiting_on_persona] ?? d.run.waiting_on_persona}.</p> : null}
    </div>
  );
}

function PolicyFocus({ param }: { param: string | null }) {
  const { data: p } = useApi<any>('/policies');
  const { data: inbox, reload } = useApi<any>('/inbox', { poll: 5000 });
  if (!p) return <p className="text-[12px] text-muted-foreground">Loading…</p>;
  const pending = (inbox?.approvals ?? []).filter((a: any) => a.action_type === 'APPROVE_POLICY_CHANGE');
  const versions: any[] = (p.versions ?? []).slice(0, 1);
  const domain = param ? (p.domains ?? []).find((d: any) => d.id === param.split(' ')[0]) : null;
  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-2 text-[12px]"><Chip tone="primary">policy v{p.version} active</Chip>{domain ? <span>{domain.id} · {domain.label ?? domain.title ?? ''}{domain.approver ? ` · approver: ${PERSONA_SHORT[domain.approver] ?? domain.approver}` : ''}</span> : null}</p>
      {pending.map((a: any) => <ApprovalFocus key={a.run_id} a={a} onDone={reload} />)}
      <ul className="space-y-1.5">{versions.map((v) => (
        <li key={v.id} className="rounded-lg border border-border/60 bg-card/50 p-2 text-[12px]">
          <p className="flex flex-wrap items-center gap-2"><Chip>v{v.version}</Chip><StatusChip status={v.status} />{v.proposed_by ? <span>proposed by {PERSONA_SHORT[v.proposed_by] ?? v.proposed_by}</span> : null}{v.approved_by ? <span>· approved by {PERSONA_SHORT[v.approved_by] ?? v.approved_by}</span> : null}{v.effective_from ? <span className="font-mono text-muted-foreground">· from {date(v.effective_from)}</span> : null}</p>
          {v.diff && typeof v.diff === 'object' ? <ul className="mt-1 space-y-0.5 font-mono text-[11px]">{Object.entries(v.diff as Record<string, any>).slice(0, 4).map(([k, ch]: [string, any]) => <li key={k}>{k}{ch?.segment ? ` (${ch.segment})` : ''}: {String(ch?.from ?? ch?.before ?? '')} → <span className="text-primary">{String(ch?.to ?? ch?.after ?? JSON.stringify(ch))}</span></li>)}</ul> : null}
          {v.rationale ? <p className="mt-1 text-muted-foreground">{v.rationale}</p> : null}
          {v.preview ? <p className="mt-1 text-muted-foreground">{typeof v.preview === 'string' ? v.preview : v.preview.label ?? JSON.stringify(v.preview).slice(0, 160)}</p> : null}
        </li>))}</ul>
    </div>
  );
}

function CommsFocus({ param }: { param: string | null }) {
  const q = param ? (param.includes('=') ? param : `customer=${param}`) : '';
  const { data } = useApi<any>(`/comms?${q}&limit=5`);
  if (!data) return <p className="text-[12px] text-muted-foreground">Loading…</p>;
  const rows = data.rows ?? data;
  if (!rows?.length) return <Empty>No messages{q.startsWith('status=') ? ` with status ${q.slice(7).toLowerCase()}` : ''}.</Empty>;
  return <Messages rows={rows.slice(0, 5)} compact />;
}

function AuditFocus({ param }: { param: string | null }) {
  const q = param ? (param.includes('=') ? param : `customer=${param}`) : '';
  const { data } = useApi<any>(`/audit?${q}&limit=8`);
  if (!data) return <p className="text-[12px] text-muted-foreground">Loading…</p>;
  return <TrailList rows={(data.rows ?? []).slice(0, 8)} compact />;
}

function AgentFocus({ id }: { id: string | null }) {
  const { data } = useApi<any[]>('/agents');
  const a = (data ?? []).find((x: any) => x.id === id);
  if (!a) return <p className="text-[12px] text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-3"><AgentTag id={a.id} autonomy={a.autonomy ?? a.rung} size={28} /><span className="text-[12px] text-muted-foreground">{a.role ?? a.title ?? ''}</span></p>
      {a.description ?? a.summary ? <p className="text-[13px] leading-relaxed">{a.description ?? a.summary}</p> : null}
      {a.cites?.length ? <p className="flex flex-wrap gap-1">{a.cites.slice(0, 8).map((c: string) => <Clause key={c} id={c} />)}</p> : null}
      {a.functions?.length ? <ul className="list-disc space-y-0.5 ps-5 text-[12px]">{a.functions.slice(0, 6).map((f: any, i: number) => <li key={i}>{typeof f === 'string' ? f : f.label ?? f.name}</li>)}</ul> : null}
    </div>
  );
}

function ClockFocus() {
  const { session, director } = useApp();
  return <div className="space-y-1 text-sm"><p className="font-mono text-2xl font-bold">{director?.clock?.today ?? session?.clock.today}</p><p className="text-[12px] text-muted-foreground">Virtual clock{session?.clock.virtual ? ' (advanced)' : ''}. Each day: 02:00 scan → 09:15 deadlines, due messages, re-checks → 14:05 due messages. The reminders, deadlines and cooling periods in the log fell out of the days that just passed.</p></div>;
}

function QualificationFocus({ id }: { id: string }) {
  const { data: d } = useApi<any>(`/customers/${id}`);
  if (!d) return <p className="text-[12px] text-muted-foreground">Loading…</p>;
  const q = d.qualification; const checks: any[] = q?.checks ?? [];
  const failing = checks.filter((c) => !c.pass);
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-2 text-sm">{q?.eligible ? <Chip tone="success">Eligible for One Click</Chip> : <Chip tone="danger">Not eligible</Chip>}{q?.eligible ? <span className="font-mono">{qar(q.amount)}{q.tenor ? ` over ${q.tenor} months` : ''}</span> : null}<span className="text-[12px] text-muted-foreground">{checks.length} rules checked · {failing.length} failing</span></p>
      {failing.length ? <ul className="space-y-1 text-[12px]">{failing.slice(0, 6).map((c) => <li key={c.code} className="flex gap-2"><Chip tone="danger">{c.code}</Chip><span>{c.detail}</span></li>)}</ul> : <p className="text-[12px] text-muted-foreground">Every rule passes under the active policy{d.messages?.length ? `; last message ${dateTime(d.messages[0].scheduled_for ?? d.messages[0].sent_at)}` : ''}.</p>}
      {d.cases?.[0] ? <p className="text-[12px] text-muted-foreground">Case <Ref>{d.cases[0].ref}</Ref> · <StatusChip status={d.cases[0].state} /></p> : null}
    </div>
  );
}

