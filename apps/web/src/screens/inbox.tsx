/** Inbox — "What is still waiting on me?" Decisions (runs waiting on this persona), tasks, unmatched mail. */
import { useMemo, useState } from 'react';
import { InboxItem, InboxLayout, InboxList, InboxReader, InboxTabs } from '@cognirise/atelier/archetypes';
import { Panel } from '@cognirise/atelier/layout';
import { Loader2 } from 'lucide-react';
import { bump, post, useApi } from '../lib/api';
import { rel, title, dateTime } from '../lib/format';
import { useApp, useFlash } from '../app/state';
import { CaseReader, Decide, Recommendation } from '../app/case';
import { Btn, Chip, ClassChip, Empty, Hero, Screen, SegChip, StatusChip, Ref, PERSONA_SHORT, Note } from '../app/ui';

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
      <p className="flex flex-wrap items-center gap-2 text-[12px]"><Chip tone="primary">{t.kind.replace(/_/g, ' ').toLowerCase()}</Chip>{t.case_ref ? <button type="button" className="font-mono text-primary" onClick={() => open(`case:${t.case_ref}`)}>{t.case_ref}</button> : null}{t.customer_id ? <button type="button" className="font-mono text-primary" onClick={() => open(`customer:${t.customer_id}`)}>{t.customer_id}</button> : null}<SegChip s={t.segment} /><span className="ms-auto text-muted-foreground">due {rel(t.due)}</span></p>
      <p className="mt-1 text-sm font-medium">{t.title}</p>
      {t.kind === 'RM_APPROVE_MESSAGE' && brief?.subject ? <div className="mt-2 rounded-lg border border-border/60 bg-background/60 p-2 text-[12px]"><p className="font-semibold">{brief.subject}</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{String(brief.body).slice(0, 600)}</p><p className="mt-1 text-[11px] text-muted-foreground">Scheduled {dateTime(brief.scheduledFor)} · Hami checks the window and caps at send time</p></div>
        : t.brief ? <p className="mt-1 whitespace-pre-wrap text-[12px] text-muted-foreground">{String(t.brief).slice(0, 700)}{t.brief_mode ? <> <StatusChip status={t.brief_mode} /></> : null}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {quick.map((q) => <Btn key={q} small onClick={() => setOutcome(q)} className={outcome === q ? 'border-primary text-primary' : ''}>{q}</Btn>)}
        <input className="input h-8 flex-1 text-[12px]" placeholder="…or write the outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
        <Btn small kind="primary" disabled={busy || !outcome} onClick={async () => { setBusy(true); try { const r = await post(`/tasks/${t.id}/done`, { outcome }); setResult(r.result); bump(); onDone(); } catch (e: any) { setResult(e.message); } finally { setBusy(false); } }}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Record</Btn>
      </div>
      {result ? <p className="mt-1 text-[12px] text-muted-foreground">{result}</p> : null}
      {t.kind === 'RM_BRIEF' && t.customer_id ? <p className="mt-1 text-[11px] text-muted-foreground">Collected the scan? Upload it from the <button type="button" className="text-primary" onClick={() => go('customer-app', t.customer_id)}>customer app</button> as an RM-collected document.</p> : null}
    </div>
  );
}

export function InboxScreen() {
  const { persona, route, go, openCase } = useApp();
  const { data, error, reload } = useApi<any>('/inbox', { poll: 10000 });
  const [tab, setTab] = useState<'decisions' | 'tasks' | 'unmatched'>('decisions');
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const approvals = useMemo(() => (data?.approvals ?? []).filter((a: any) => !filter || a.action_type === filter), [data, filter]);
  const selected = approvals.find((a: any) => String(a.run_id) === sel) ?? approvals[0];
  const types = useMemo<string[]>(() => [...new Set<string>((data?.approvals ?? []).map((a: any) => String(a.action_type)))], [data]);
  if (error) return <Empty>{error}</Empty>;
  const tabs = [{ id: 'decisions', label: 'Decisions', count: data?.approvals?.length ?? 0 }, { id: 'tasks', label: 'Tasks', count: data?.tasks?.length ?? 0 }, ...(data?.unmatched?.length ? [{ id: 'unmatched', label: 'Unmatched mail', count: data.unmatched.length }] : [])];
  void route;
  return (
    <Screen hero={<Hero eyebrow={`Inbox · ${persona?.role}`} title={<>{(data?.approvals?.length ?? 0) + (data?.tasks?.length ?? 0)} things wait on you</>} lede="Every item names the actual decision. The agents prepared it; the reversible options sit left of the irreversible one; a decision that differs from the recommendation needs a reason." />} banner={false}>
      {persona?.scope?.metricsOnly ? <Note>The Data Steward decides nothing; the Head approves definition changes.</Note> : null}
      <InboxTabs items={tabs as any} value={tab} onChange={(id) => setTab(id as any)} />
      {tab === 'decisions' ? (
        <InboxLayout list={
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1 px-1">{['', ...types].map((t) => <button key={t} type="button" onClick={() => setFilter(t)} className={`mono-chip ${filter === t ? 'is-primary' : ''}`}>{t ? title(t) : 'all'}</button>)}</div>
            <InboxList label="Decisions" count={approvals.length} emptyState={<Empty>Nothing waits on you.</Empty>}>
              {approvals.map((a: any) => <ApprovalItem key={a.run_id} a={a} active={selected?.run_id === a.run_id} onSelect={() => setSel(String(a.run_id))} />)}
            </InboxList>
          </div>}
          reader={<InboxReader>{selected ? (selected.case_ref ? <CaseReader key={selected.case_ref} refCode={selected.case_ref} /> : <RunReader run={selected} onDone={reload} />) : <Empty>Select an item.</Empty>}</InboxReader>} />
      ) : tab === 'tasks' ? (
        <div className="grid gap-3 lg:grid-cols-2">{(data?.tasks ?? []).map((t: any) => <TaskCard key={t.id} t={t} onDone={reload} />)}{!data?.tasks?.length ? <Empty>No open tasks.</Empty> : null}</div>
      ) : (
        <Panel title="Unmatched inbound mail"><ul className="space-y-2 text-[12px]">{(data?.unmatched ?? []).map((m: any) => <li key={m.id} className="rounded-lg border border-border/60 p-2"><p className="font-mono text-muted-foreground">{dateTime(m.received_at)} · from {m.from_addr}</p><p className="font-medium">{m.subject}</p><p>{m.body}</p></li>)}</ul></Panel>
      )}
      <p className="text-[11px] text-muted-foreground">Switch persona from the badge at the top right to see another inbox. <button type="button" className="text-primary" onClick={() => openCase(null)}>Cases</button> lists every case in your scope; <button type="button" className="text-primary" onClick={() => go('cases')}>open it</button>.</p>
    </Screen>
  );
}

function ApprovalItem({ a, active, onSelect }: { a: any; active: boolean; onSelect: () => void }) {
  const flash = useFlash('cases', a.case_ref);
  return (
    <div className={flash}>
      <InboxItem selected={active} onSelect={onSelect} reference={a.case_ref ? <Ref>{a.case_ref}</Ref> : <Chip>{a.workflow_id}</Chip>} state={<Chip tone="warn">{title(a.action_type)}</Chip>} title={a.name_en ?? a.title}
        meta={<span className="flex flex-wrap items-center gap-1.5"><ClassChip cls={a.cls} /><SegChip s={a.segment} />{a.documents ? <Chip>{a.documents} doc</Chip> : null}<span className="text-muted-foreground">waiting {rel(a.waiting_since)}</span></span>}
        preview={a.result?.recommendation?.summary ?? a.title} />
    </div>
  );
}

/** A run without a case (policy change, employer review with no case): the reader for it. */
function RunReader({ run, onDone }: { run: any; onDone: () => void }) {
  const { data } = useApi<any>(`/runs/${run.run_id}`);
  const { go } = useApp();
  if (!data) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  const pv = data.result?.preview;
  return (
    <div className="space-y-4">
      <header><p className="flex flex-wrap items-center gap-2 text-[12px]"><Chip tone="primary">{data.workflow_id}</Chip><StatusChip status={data.status} /><Chip tone="warn">waits on {PERSONA_SHORT[data.waiting_on_persona]}</Chip></p><h2 className="mt-1 text-lg font-semibold">{data.title}</h2></header>
      {pv ? <div className="rounded-xl border border-border/60 bg-card/50 p-3 text-sm"><p className="eyebrow">Effect preview</p><p className="mt-1">{pv.label}{pv.segment ? ` (${pv.segment})` : ''}: <span className="font-mono">{String(pv.from)}</span> → <span className="font-mono font-semibold">{String(pv.to)}</span></p><p className="mt-1 text-muted-foreground">{pv.note}</p>{pv.messages?.length ? <p className="mt-1 text-[12px] text-muted-foreground">First moves: {pv.messages.slice(0, 3).map((m: any) => `${m.case_ref} ${dateTime(m.from)} → ${dateTime(m.to)}`).join(' · ')}</p> : null}<p className="mt-1 text-[12px]">Rationale: {data.payload?.rationale ?? '—'} · proposed by {PERSONA_SHORT[data.payload?.proposer] ?? data.payload?.proposer}</p><button type="button" className="mt-1 text-[12px] text-primary" onClick={() => go('policies', data.payload?.domain)}>Open the policy</button></div> : null}
      {data.payload?.employerId ? <button type="button" className="text-[12px] text-primary" onClick={() => go('employers', data.payload.employerId)}>Open the employer pack {data.payload.employerId}</button> : null}
      <Recommendation run={data} />
      <Decide run={data} onDone={onDone} />
    </div>
  );
}
