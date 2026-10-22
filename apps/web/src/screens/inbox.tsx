/**
 * Inbox — "Decide the item in front of you." A masthead with the count and
 * what is due, rows that say who and what is asked with the SLA as a clock,
 * and the decision card on the right (SCREEN-DISCIPLINE rules 1, 3, 6).
 */
import { useMemo, useState } from 'react';
import { InboxItem, InboxLayout, InboxList, InboxReader, InboxTabs } from '@cognirise/atelier/archetypes';
import { ClockBar } from '@cognirise/atelier/viz';
import { Panel } from '@cognirise/atelier/layout';
import { Loader2 } from 'lucide-react';
import { bump, post, useApi } from '../lib/api';
import { date, dateTime, num, rel } from '../lib/format';
import { useApp, useFlash } from '../app/state';
import { askOf, CaseReader, Decide, Recommendation } from '../app/case';
import { Btn, Chip, Empty, Masthead, Screen, SegChip, StatusChip, Note, PERSONA_SHORT } from '../app/ui';

function TaskCard({ t, onDone }: { t: any; onDone: () => void }) {
  const [outcome, setOutcome] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const { open, go } = useApp();
  const flash = useFlash('tasks', t.id);
  let brief: any = t.brief; try { if (t.kind === 'RM_APPROVE_MESSAGE' && typeof t.brief === 'string') brief = JSON.parse(t.brief); } catch { /* */ }
  const quick = t.kind === 'RM_APPROVE_MESSAGE' ? ['Approved'] : t.kind === 'CALL' ? ['Reached: will upload in the app', 'Not reached', 'Reached: wrong number'] : t.kind === 'RM_BRIEF' ? ['Reached the client: document collected', 'Meeting arranged'] : t.kind === 'RM_SEND' ? ['Sent to the client'] : t.kind === 'COMPLIANCE_REVIEW' ? ['Note raised', 'No action'] : ['Done'];
  return (
    <div className={`rounded-xl border border-border/60 bg-card/50 p-3 ${flash}`}>
      <p className="flex flex-wrap items-center gap-2 text-[12px]"><Chip tone="primary">{t.kind.replace(/_/g, ' ').toLowerCase()}</Chip>{t.name_en ? <button type="button" className="font-medium hover:text-primary" title={t.customer_id} onClick={() => open(`customer:${t.customer_id}`)}>{t.name_en}</button> : null}<SegChip s={t.segment} />{t.case_ref ? <button type="button" className="text-primary" title={t.case_ref} onClick={() => open(`case:${t.case_ref}`)}>the case</button> : null}<span className="ms-auto text-muted-foreground">due {rel(t.due)}</span></p>
      <p className="mt-1 text-sm font-medium">{t.title}</p>
      {t.kind === 'RM_APPROVE_MESSAGE' && brief?.subject ? <div className="mt-2 rounded-lg border border-border/60 bg-background/60 p-2 text-[12px]"><p className="font-semibold">{brief.subject}</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{String(brief.body).slice(0, 600)}</p><p className="mt-1 text-[11px] text-muted-foreground">Scheduled {dateTime(brief.scheduledFor)} · Hami checks the window and caps at send time</p></div>
        : t.brief ? <p className="mt-1 whitespace-pre-wrap text-[12px] text-muted-foreground">{String(t.brief).slice(0, 700)}{t.brief_mode ? <> <StatusChip status={t.brief_mode} /></> : null}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {quick.map((q) => <Btn key={q} small onClick={() => setOutcome(q)} className={outcome === q ? 'border-primary text-primary' : ''}>{q}</Btn>)}
        <input className="input h-8 flex-1 text-[12px]" placeholder="…or write the outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
        <Btn small kind="primary" disabled={busy || !outcome} onClick={async () => { setBusy(true); try { const r = await post(`/tasks/${t.id}/done`, { outcome }); setResult(r.result); bump(); onDone(); } catch (e: any) { setResult(e.message); } finally { setBusy(false); } }}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Record</Btn>
      </div>
      {result ? <p className="mt-1 text-[12px] text-muted-foreground">{result}</p> : null}
      {t.kind === 'RM_BRIEF' && t.customer_id ? <p className="mt-1 text-[11px] text-muted-foreground">Collected the scan? Upload it from the <button type="button" className="text-primary" onClick={() => go('customer-app', t.customer_id)}>customer's phone</button> as an RM-collected document.</p> : null}
    </div>
  );
}

/** How long it has waited, never negative (a scenario can leave the clock behind an item). */
function waitedWord(since: string, now: string): string {
  const h = Math.max(0, (new Date(now).getTime() - new Date(since).getTime()) / 3600000);
  return h < 1 ? 'arrived just now' : h < 24 ? `waiting ${Math.round(h)}h` : `waiting ${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? '' : 's'}`;
}
/** The SLA in one word: overdue, due today, due tomorrow, due in n days. */
function dueWord(due: string | null | undefined, now: string): { word: string; tone: 'danger' | 'warn' | undefined } {
  if (!due) return { word: 'no deadline', tone: undefined };
  const days = Math.ceil((new Date(due).getTime() - new Date(now).getTime()) / 86400000);
  if (days < 0) return { word: 'overdue', tone: 'danger' };
  if (days === 0) return { word: 'due today', tone: 'warn' };
  if (days === 1) return { word: 'due tomorrow', tone: 'warn' };
  return { word: `due in ${days} days`, tone: undefined };
}

export function InboxScreen() {
  const { persona, session } = useApp();
  const { data, error, reload } = useApi<any>('/inbox', { poll: 10000 });
  const [tab, setTab] = useState<'decisions' | 'tasks' | 'unmatched'>('decisions');
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const now: string = data?.now ?? session?.clock.now ?? new Date().toISOString();
  const all: any[] = data?.approvals ?? [];
  const approvals = useMemo(() => all.filter((a: any) => !filter || a.action_type === filter), [all, filter]);
  const selected = approvals.find((a: any) => String(a.run_id) === sel) ?? approvals[0];
  const asks = useMemo(() => { const m = new Map<string, string>(); for (const a of all) if (!m.has(a.action_type)) m.set(a.action_type, askOf({ action_type: a.action_type, payload: a.action_type === 'DECIDE' ? { route: a.payload?.route } : undefined })); return [...m.entries()]; }, [all]);
  if (error) return <Empty>{error}</Empty>;
  const tasks: any[] = data?.tasks ?? [];
  const tabs = [{ id: 'decisions', label: 'Decisions', count: all.length }, { id: 'tasks', label: 'Tasks', count: tasks.length }, ...(data?.unmatched?.length ? [{ id: 'unmatched', label: 'Unmatched mail', count: data.unmatched.length }] : [])];
  const overdue = all.filter((a) => a.sla_due && new Date(a.sla_due) < new Date(now)).length;
  const dueToday = all.filter((a) => a.sla_due && dueWord(a.sla_due, now).word === 'due today').length;
  const oldest = all.reduce<string | null>((m, a) => (!m || a.waiting_since < m ? a.waiting_since : m), null);
  const headline = all.length ? `${num(all.length)} decision${all.length === 1 ? '' : 's'} wait${all.length === 1 ? 's' : ''} on you${overdue ? `; ${num(overdue)} ${overdue === 1 ? 'is' : 'are'} overdue` : dueToday ? `; ${num(dueToday)} ${dueToday === 1 ? 'is' : 'are'} due today` : ''}` : tasks.length ? `${num(tasks.length)} task${tasks.length === 1 ? '' : 's'} wait${tasks.length === 1 ? 's' : ''} on you` : 'Nothing waits on you';
  const meta = persona?.scope?.metricsOnly ? 'The Data Steward decides nothing; the Head approves definition changes' : all.length ? `The oldest has waited since ${date(oldest)} · every item names the decision; the agents prepared it` : tasks.length ? 'Each task names what to do and records the outcome on the trail' : 'The agents handle what they may; what needs a person arrives here';
  return (
    <Screen hero={<Masthead eyebrow={`Inbox · ${persona?.role}`} title={headline} meta={meta} />}>
      {persona?.scope?.metricsOnly ? <Note>The Data Steward sees the base, never a record: the Overview and Data health carry the work.</Note> : null}
      <InboxTabs items={tabs as any} value={tab} onChange={(id) => setTab(id as any)} />
      {tab === 'decisions' ? (
        <InboxLayout list={
          <div className="space-y-2">
            {asks.length > 1 ? <div className="flex flex-wrap gap-1 px-1">{[['', 'everything'], ...asks].map(([t, label]) => <button key={t} type="button" onClick={() => setFilter(t)} className={`word-chip ${filter === t ? 'is-primary' : ''}`}>{label.replace(/\?$/, '')}</button>)}</div> : null}
            <InboxList label="Decisions" count={approvals.length} emptyState={<Empty>Nothing waits on you.</Empty>}>
              {approvals.map((a: any) => <ApprovalItem key={a.run_id} a={a} now={now} active={selected?.run_id === a.run_id} onSelect={() => setSel(String(a.run_id))} />)}
            </InboxList>
          </div>}
          reader={<div className="lg:sticky lg:top-3 lg:self-start"><InboxReader>{selected ? (selected.case_ref ? <CaseReader key={selected.case_ref} refCode={selected.case_ref} /> : <RunReader key={selected.run_id} run={selected} onDone={reload} />) : <Empty>Select an item.</Empty>}</InboxReader></div>} />
      ) : tab === 'tasks' ? (
        <div className="grid gap-3 lg:grid-cols-2">{tasks.map((t: any) => <TaskCard key={t.id} t={t} onDone={reload} />)}{!tasks.length ? <Empty>No open tasks.</Empty> : null}</div>
      ) : (
        <Panel title="Mail no customer matched"><ul className="space-y-2 text-[12px]">{(data?.unmatched ?? []).map((m: any) => <li key={m.id} className="rounded-lg border border-border/60 p-2"><p className="text-muted-foreground">{dateTime(m.received_at)} · from {m.from_addr}</p><p className="font-medium">{m.subject}</p><p>{m.body}</p></li>)}</ul></Panel>
      )}
    </Screen>
  );
}

/** A row: the person, what is asked, the SLA as a clock, the status word. The case id travels in the hover. */
function ApprovalItem({ a, now, active, onSelect }: { a: any; now: string; active: boolean; onSelect: () => void }) {
  const flash = useFlash('cases', a.case_ref);
  const due = dueWord(a.sla_due, now);
  return (
    <div className={flash} title={a.case_ref ?? a.workflow_id}>
      <InboxItem selected={active} onSelect={onSelect} reference={<span className="text-[12px] text-muted-foreground"><SegChip s={a.segment} />{a.documents ? <span className="ms-1.5">{a.documents} document{a.documents === 1 ? '' : 's'} to read</span> : null}</span>} state={<Chip tone={due.tone}>{due.word}</Chip>} title={a.name_en ?? a.title}
        preview={askOf(a)}
        meta={<div className="w-full"><ClockBar start={a.waiting_since} due={a.sla_due} now={now} compact label={`Waiting on you since ${dateTime(a.waiting_since)}`} /><p className="mt-1 text-[11px] text-muted-foreground">{waitedWord(a.waiting_since, now)}</p></div>} />
    </div>
  );
}

/** A run without a case (a policy change, an employer review with no case): the same card shape. */
function RunReader({ run, onDone }: { run: any; onDone: () => void }) {
  const { data } = useApi<any>(`/runs/${run.run_id}`);
  const { go } = useApp();
  if (!data) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  const pv = data.result?.preview;
  return (
    <div className="space-y-4">
      <header>
        <p className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground"><span>{askOf({ action_type: data.result?.actionType ?? data.payload?.actionType, payload: data.payload, result: data.result })}</span><StatusChip status={data.status} /><span className="ms-auto" title={data.workflow_id}>waits on the {PERSONA_SHORT[data.waiting_on_persona]}</span></p>
        <h2 className="mt-1.5 text-[19px] font-semibold leading-snug tracking-tight">{data.title}</h2>
      </header>
      {pv ? <div className="rounded-xl border border-border/60 bg-card/50 p-3 text-sm"><p className="text-[11px] text-muted-foreground">What changes</p><p className="mt-1">{pv.label}{pv.segment ? ` (${pv.segment})` : ''}: <span className="font-mono">{String(pv.from)}</span> → <span className="font-mono font-semibold">{String(pv.to)}</span></p><p className="mt-1 text-muted-foreground">{pv.note}</p>{pv.messages?.length ? <p className="mt-1 text-[12px] text-muted-foreground">First moves: {pv.messages.slice(0, 3).map((m: any) => `${m.case_ref} ${dateTime(m.from)} → ${dateTime(m.to)}`).join(' · ')}</p> : null}<p className="mt-1 text-[12px]">Why: {data.payload?.rationale ?? '—'} · proposed by the {PERSONA_SHORT[data.payload?.proposer] ?? data.payload?.proposer}</p><button type="button" className="mt-1 text-[12px] text-primary" onClick={() => go('policies', data.payload?.domain)}>Open the policy</button></div> : null}
      {data.payload?.employerId ? <button type="button" className="text-[12px] text-primary" onClick={() => go('employers', data.payload.employerId)}>Open the employer pack</button> : null}
      <Recommendation run={data} />
      <Decide run={data} onDone={onDone} />
    </div>
  );
}
