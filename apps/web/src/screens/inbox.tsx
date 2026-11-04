/**
 * Inbox — "Decide the item in front of you." CogniPulse's InboxLayout: the
 * tabs (the first is what waits on this person), one row of filters, the list
 * on the left and the item read and decided on the right, each scrolling on
 * its own. Nothing above the list (SCREEN-DISCIPLINE, the standard screens).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { InboxItem, InboxLayout, InboxList, InboxReader, InboxTabs, ReaderSection } from '@cognirise/cognipulse/archetypes';
import { Slope, TimeBar } from '@cognirise/cognipulse/viz';
import { Loader2 } from 'lucide-react';
import { bump, post, useApi } from '../lib/api';
import { dateTime, rel, title } from '../lib/format';
import { useApp, useFlash } from '../app/state';
import { usePresent } from '../app/present';
import { askOf, CaseFacts, CaseReader, Decide, Recommendation } from '../app/case';
import { Btn, Chip, Empty, SEG, StatusChip, PERSONA_SHORT } from '../app/ui';

/** The turnaround in one word: late, due today, due tomorrow, due in n days. */
function dueWord(due: string | null | undefined, now: string): { word: string; tone: 'danger' | 'warn' | undefined } {
  if (!due) return { word: 'no deadline', tone: undefined };
  const days = Math.ceil((new Date(due).getTime() - new Date(now).getTime()) / 86400000);
  if (days < 0) return { word: `${-days} day${days === -1 ? '' : 's'} late`, tone: 'danger' };
  if (days === 0) return { word: 'due today', tone: 'warn' };
  if (days === 1) return { word: 'due tomorrow', tone: 'warn' };
  return { word: `due in ${days} days`, tone: undefined };
}

type Tab = 'decisions' | 'tasks' | 'unmatched';

export function InboxScreen() {
  const { persona, session, director } = useApp();
  const { present } = usePresent();
  const { data, error, reload } = useApi<any>('/inbox', { poll: 10000 });
  const [tab, setTab] = useState<Tab>('decisions');
  const [sel, setSel] = useState<string | null>(null);
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const now: string = data?.now ?? session?.clock.now ?? new Date().toISOString();
  const all: any[] = data?.approvals ?? [];
  const tasks: any[] = data?.tasks ?? [];
  const mail: any[] = data?.unmatched ?? [];
  const kinds = useMemo(() => { const m = new Map<string, string>(); for (const a of all) if (!m.has(a.action_type)) m.set(a.action_type, askOf({ action_type: a.action_type, payload: a.action_type === 'DECIDE' ? { route: a.payload?.route } : undefined })); return [...m.entries()]; }, [all]);
  const match = (name: string | null | undefined) => !q || String(name ?? '').toLowerCase().includes(q.toLowerCase());
  const approvals = useMemo(() => all.filter((a) => (!kind || a.action_type === kind) && match(a.name_en ?? a.title)), [all, kind, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const taskRows = useMemo(() => tasks.filter((t) => match(t.name_en ?? t.title)), [tasks, q]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <Empty>{error}</Empty>;

  const tabs = [
    { id: 'decisions', label: 'Waiting on you', count: all.length, tone: 'attention' as const },
    { id: 'tasks', label: 'Tasks', count: tasks.length },
    ...(mail.length ? [{ id: 'unmatched', label: 'Mail no customer matched', count: mail.length }] : []),
  ];
  // One row of filters, on the tabs' row so nothing stands between the tabs and the list.
  const filters = (tab === 'decisions' && all.length > 1) || (tab === 'tasks' && tasks.length > 1) ? (
    <div className="ms-auto flex flex-wrap items-center gap-2">
      {tab === 'decisions' && kinds.length > 1 ? <select className="input h-8 text-[13px]" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Every kind of decision</option>{kinds.map(([k, label]) => <option key={k} value={k}>{label.replace(/\?$/, '')}</option>)}</select> : null}
      <input className="input h-8 w-52 text-[13px]" placeholder="Find a customer" value={q} onChange={(e) => setQ(e.target.value)} />
    </div>
  ) : null;

  let list: ReactNode; let reader: ReactNode;
  if (tab === 'decisions') {
    const selected = approvals.find((a) => String(a.run_id) === sel) ?? approvals[0];
    list = (
      <InboxList label="Decisions" count={approvals.length} emptyState={<Empty>{persona?.scope?.metricsOnly ? 'The Data Steward decides nothing; the Overview and Data health carry the work.' : 'Nothing waits on you.'}</Empty>}>
        {approvals.map((a) => <ApprovalItem key={a.run_id} a={a} now={now} active={selected?.run_id === a.run_id} onSelect={() => setSel(String(a.run_id))} />)}
      </InboxList>
    );
    reader = selected ? (selected.case_ref ? <CaseReader key={selected.case_ref} refCode={selected.case_ref} inReader /> : <RunReader key={selected.run_id} run={selected} onDone={reload} />) : <InboxReader empty="When something needs your decision it arrives here." />;
  } else if (tab === 'tasks') {
    const selected = taskRows.find((t) => String(t.id) === sel) ?? taskRows[0];
    list = (
      <InboxList label="Tasks" count={taskRows.length} emptyState={<Empty>No open tasks.</Empty>}>
        {taskRows.map((t) => { const due = dueWord(t.due, now); return <InboxItem key={t.id} selected={selected?.id === t.id} onSelect={() => setSel(String(t.id))} title={t.name_en ?? title(t.kind)} preview={t.name_en ? String(t.title).replace(`${t.name_en}: `, '').replace(` ${t.name_en}`, '') : t.title} state={<Chip tone={due.tone}>{due.word}</Chip>} />; })}
      </InboxList>
    );
    reader = selected ? <TaskReader key={selected.id} t={selected} onDone={reload} /> : <InboxReader empty="Calls to make and briefs to act on arrive here." />;
  } else {
    const selected = mail.find((m) => String(m.id) === sel) ?? mail[0];
    list = (
      <InboxList label="Mail no customer matched" count={mail.length}>
        {mail.map((m) => <InboxItem key={m.id} selected={selected?.id === m.id} onSelect={() => setSel(String(m.id))} title={m.subject} preview={m.from_addr} state={<span className="text-[11px] text-muted-foreground">{rel(m.received_at, now)}</span>} />)}
      </InboxList>
    );
    reader = selected ? (
      <InboxReader header={<><p className="text-[12px] text-muted-foreground">From {selected.from_addr} · {dateTime(selected.received_at)}</p><h2 className="mt-1.5 text-lg font-semibold leading-snug">{selected.subject}</h2></>}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{selected.body}</p>
      </InboxReader>
    ) : <InboxReader empty="Nothing unmatched." />;
  }

  // The list and the reader each scroll on their own inside the window; while a scenario runs, the Director bar takes the foot of the screen.
  const height = director || present ? 'lg:h-[calc(100dvh-21rem)]' : 'lg:h-[calc(100dvh-7.75rem)]';
  return (
    <InboxLayout className={height}
      tabs={<div className="flex flex-wrap items-center gap-x-5 gap-y-2"><h1 className="text-lg font-semibold">Inbox</h1><InboxTabs items={tabs} value={tab} onChange={(id) => { setTab(id as Tab); setSel(null); }} />{filters}</div>}
      list={list}
      reader={reader} />
  );
}

/** A row: the person, what is asked, how late it is, and the turnaround as a time bar. The case id travels in the hover. */
function ApprovalItem({ a, now, active, onSelect }: { a: any; now: string; active: boolean; onSelect: () => void }) {
  const flash = useFlash('cases', a.case_ref);
  const due = dueWord(a.sla_due, now);
  return (
    <div className={flash} title={a.case_ref ?? undefined}>
      <InboxItem selected={active} onSelect={onSelect} title={a.name_en ?? a.title} preview={askOf(a)}
        reference={<span className="text-[11px] text-muted-foreground">{SEG[a.segment] ?? ''}</span>}
        state={<Chip tone={due.tone}>{due.word}</Chip>}
        meta={a.sla_due ? <TimeBar start={a.waiting_since} end={a.sla_due} today={now} compact className="w-full" /> : undefined} />
    </div>
  );
}

/** A run without a case (a policy change, an employer review with no case): the same reader, decision pinned at the foot. */
function RunReader({ run, onDone }: { run: any; onDone: () => void }) {
  const { data } = useApi<any>(`/runs/${run.run_id}`);
  const { go } = useApp();
  if (!data) return <InboxReader><p className="text-sm text-muted-foreground">Loading…</p></InboxReader>;
  const pv = data.result?.preview;
  const numeric = pv && Number.isFinite(Number(pv.from)) && Number.isFinite(Number(pv.to));
  const due = run.sla_due ? dueWord(run.sla_due, data.now ?? new Date().toISOString()) : null;
  return (
    <InboxReader className="h-full"
      header={<>
        <p className="text-[12px] text-muted-foreground">{askOf({ action_type: data.result?.actionType ?? data.payload?.actionType, payload: data.payload, result: data.result }).replace(/\?$/, '')} · proposed by the {PERSONA_SHORT[data.payload?.proposer] ?? 'agents'}{due ? <> · <span className={due.tone === 'danger' ? 'text-danger' : 'text-warn'}>waiting on you, {due.word}</span></> : null}</p>
        <h2 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight">{data.title}</h2>
      </>}
      actions={<Decide run={data} onDone={onDone} />}>
      {pv ? (
        <div className="rounded-xl glass-l3 px-4 py-3">
          <p className="text-[12px] text-muted-foreground">{pv.label}{pv.segment ? `, ${SEG[pv.segment] ?? pv.segment}` : ''}</p>
          {numeric ? <Slope before={Number(pv.from)} now={Number(pv.to)} target={null} direction="down" className="mt-2" /> : <p className="mt-1 text-xl font-semibold">{String(pv.from)} → {String(pv.to)}</p>}
          {pv.note ? <p className="mt-2 text-[13px]">{pv.note}</p> : null}
        </div>
      ) : null}
      {data.payload?.rationale ? <p className="text-sm"><span className="text-muted-foreground">Why: </span>{data.payload.rationale}</p> : null}
      <Recommendation run={data} />
      <div className="flex flex-wrap gap-3 text-[12px]">
        {pv ? <button type="button" className="text-primary" onClick={() => go('policies', data.payload?.domain)}>Open the policy</button> : null}
        {data.payload?.employerId ? <button type="button" className="text-primary" onClick={() => go('employers', data.payload.employerId)}>Open the employer pack</button> : null}
      </div>
      {pv?.messages?.length ? (
        <details className="group rounded-lg border border-border/50">
          <summary className="cursor-pointer list-none px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground">What moves ▸</summary>
          <ReaderSection label="The first messages that move" className="border-t border-border/50 px-3 py-2"><ul className="space-y-1 text-[12px]">{pv.messages.slice(0, 12).map((m: any, i: number) => <li key={i}>{m.case_ref}: {dateTime(m.from)} → {dateTime(m.to)}</li>)}</ul></ReaderSection>
        </details>
      ) : null}
    </InboxReader>
  );
}

/** A task: what to do, the brief, and the outcome to record. */
function TaskReader({ t, onDone }: { t: any; onDone: () => void }) {
  const [outcome, setOutcome] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const { open, go, session } = useApp();
  let brief: any = t.brief; try { if (t.kind === 'RM_APPROVE_MESSAGE' && typeof t.brief === 'string') brief = JSON.parse(t.brief); } catch { /* */ }
  const quick = t.kind === 'RM_APPROVE_MESSAGE' ? ['Approved'] : t.kind === 'CALL' ? ['Reached: will upload in the app', 'Not reached', 'Reached: wrong number'] : t.kind === 'RM_BRIEF' ? ['Reached the client: document collected', 'Meeting arranged'] : t.kind === 'RM_SEND' ? ['Sent to the client'] : t.kind === 'COMPLIANCE_REVIEW' ? ['Note raised', 'No action'] : ['Done'];
  const due = dueWord(t.due, session?.clock.now ?? new Date().toISOString());
  return (
    <InboxReader className="h-full"
      header={<>
        <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground"><span>{title(t.kind)}</span>{t.name_en ? <><span>·</span><button type="button" className="font-medium text-foreground hover:text-primary" onClick={() => open(`customer:${t.customer_id}`)}>{t.name_en}</button></> : null}{t.segment ? <><span>·</span><span>{SEG[t.segment] ?? t.segment}</span></> : null}<span>·</span><span className={due.tone === 'danger' ? 'text-danger' : due.tone === 'warn' ? 'text-warn' : undefined}>{due.word}</span></p>
        <h2 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight">{t.title}</h2>
      </>}
      actions={
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {quick.map((x) => <Btn key={x} small onClick={() => setOutcome(x)} className={outcome === x ? 'border-primary text-primary' : ''}>{x}</Btn>)}
          </div>
          <div className="flex items-center gap-2">
            <input className="input h-8 flex-1 text-[13px]" placeholder="…or write the outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
            <Btn small kind="primary" disabled={busy || !outcome} onClick={async () => { setBusy(true); try { const r = await post(`/tasks/${t.id}/done`, { outcome }); setResult(r.result); bump(); onDone(); } catch (e: any) { setResult(e.message); } finally { setBusy(false); } }}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Record the outcome</Btn>
          </div>
          {result ? <p className="text-[12px] text-muted-foreground">{result}</p> : null}
        </div>
      }>
      {t.kind === 'RM_APPROVE_MESSAGE' && brief?.subject ? (
        <div className="rounded-xl glass-l3 p-3 text-[13px]"><p className="font-semibold">{brief.subject}</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{String(brief.body)}</p><p className="mt-2 text-[12px] text-muted-foreground">Goes out {dateTime(brief.scheduledFor)}</p></div>
      ) : t.brief ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{String(t.brief)}{t.brief_mode ? <> <StatusChip status={t.brief_mode} /></> : null}</p> : null}
      {t.case_ref ? <CaseFacts refCode={t.case_ref} /> : null}
      <div className="flex flex-wrap gap-3 text-[12px]">
        {t.case_ref ? <button type="button" className="text-primary" onClick={() => open(`case:${t.case_ref}`)}>Open the case</button> : null}
        {t.kind === 'RM_BRIEF' && t.customer_id ? <button type="button" className="text-primary" onClick={() => go('customer-app', t.customer_id)}>Upload the collected scan from the customer's phone</button> : null}
      </div>
    </InboxReader>
  );
}
