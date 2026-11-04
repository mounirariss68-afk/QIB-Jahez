/**
 * How it works: Agents, Workflows, Triggers and Scenarios. Agents carries the
 * governance exhibit once (rule 5): the ladder A0–A4 with each agent placed on
 * it. A profile shows the agent's week as columns. Workflows show each
 * workflow's steps by actor. The rig screens (Triggers, Scenarios) keep their
 * controls; codes travel in the hover.
 */
import { useEffect, useState } from 'react';
import { AgentAvatar, AgentCard, AgentDirectory, AgentProfile, ScenarioCard, ScenarioRunner, WorkflowCard, WorkflowCatalog, WorkflowStep, WorkflowWalkthrough, autonomyDetail } from '@cognirise/cognipulse/archetypes';
import { Panel, PageColumns } from '@cognirise/cognipulse/layout';
import { Columns, Segments, Sparkline, TimeBar } from '@cognirise/cognipulse/viz';
import { Bot, CalendarClock, GitBranch, Loader2, Play, RotateCcw, Zap } from 'lucide-react';
import { bump, post, useApi } from '../lib/api';
import { dateTime, num, rel, title } from '../lib/format';
import { useApp } from '../app/state';
import { TrailList, Steps } from '../app/case';
import { AUTONOMY, Btn, Chip, Empty, Hero, Note, Screen, StatusChip, Table, PERSONA_SHORT, AgentTag, SEG, REASON_LABEL } from '../app/ui';

const RUNGS = ['A0', 'A1', 'A2', 'A3', 'A4'] as const;
const RUNG_WORD: Record<string, string> = { A0: 'Observes', A1: 'Recommends', A2: 'Acts on approval', A3: 'Acts and reports', A4: 'Autonomous' };
const weekday = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });

/** The ladder: five rungs, each explained once, each agent placed on the rung it runs at. */
function Ladder({ agents, onOpen }: { agents: any[]; onOpen: (id: string) => void }) {
  return (
    <div className="grid gap-2 md:grid-cols-5">
      {RUNGS.map((r) => {
        const on = agents.filter((a) => a.autonomy === r);
        return (
          <div key={r} className={`flex flex-col rounded-xl px-3 py-2.5 ${on.length ? 'glass-l3' : 'border border-dashed border-border/70'}`}>
            <p className="text-[12px] text-muted-foreground" title={r}>{RUNG_WORD[r]}</p>
            <p className="mt-0.5 text-[12px] leading-snug">{autonomyDetail(AUTONOMY[r])}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {on.length ? on.map((a) => (
                <button key={a.id} type="button" onClick={() => onOpen(a.id)} className="inline-flex items-center gap-1.5 rounded-full border border-border/70 py-0.5 pe-2 ps-0.5 text-[12px] hover:border-primary hover:text-primary" title={a.autonomyBySegment ? Object.entries(a.autonomyBySegment).map(([s, x]) => `${SEG[s] ?? s}: ${RUNG_WORD[x as string]}`).join(' · ') : a.title}>
                  <AgentAvatar agent={{ id: a.id, name: a.name, role: '', initials: a.name.slice(0, 2) }} size={20} showActivity={false} />{a.name}
                </button>
              )) : <span className="text-[12px] text-muted-foreground">{r === 'A4' ? 'No agent; none runs without a person behind it' : 'No agent'}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AgentsScreen() {
  const { route, go } = useApp();
  const { data, error } = useApi<any[]>('/agents', { poll: 15000 });
  const sel = route.param ? (data ?? []).find((a) => a.id === route.param) : null;
  const { data: trail } = useApi<any[]>(sel ? `/agents/${sel.id}/trail` : null);
  if (error) return <Empty>{error}</Empty>;
  const agents = data ?? [];
  const at = (r: string) => agents.filter((a) => a.autonomy === r).length;
  const weekTotal = (a: any) => (a.week ?? []).reduce((s: number, d: any) => s + d.n, 0);
  if (sel) {
    const week: any[] = sel.week ?? [];
    const most = [...sel.stats].sort((a: any, b: any) => b.total - a.total).slice(0, 6);
    return (
      <Screen hero={<Hero eyebrow="How it works · Agents" title={`${sel.name} ${RUNG_WORD[sel.autonomy]?.toLowerCase()}; the ${PERSONA_SHORT[sel.owner] ?? sel.owner} answers for it`} actions={<Btn small onClick={() => go('agents')}>All agents</Btn>} />}>
        <PageColumns aside={<>
          <Panel icon={<Bot size={16} />} title={`${num(weekTotal(sel))} actions in the last seven days`}>
            <Columns points={week.map((d) => ({ label: weekday(d.day), value: d.n }))} height={110} format={(v) => `${num(v)} actions`} />
            <ul className="mt-3 space-y-1 text-[13px]">{most.map((s: any) => <li key={s.act} className="flex items-center justify-between gap-2"><span>{title(s.act)}</span><span className="tabular-nums text-muted-foreground">{num(s.total)}</span></li>)}{!most.length ? <li className="text-muted-foreground">No activity yet.</li> : null}</ul>
          </Panel>
          <Panel title="Its remit">
            <dl className="space-y-2 text-[13px]">
              <div><dt className="text-[12px] text-muted-foreground">Who decides</dt><dd>{sel.decides}</dd></div>
              <div><dt className="text-[12px] text-muted-foreground">Uses Claude</dt><dd>{sel.claude === 'yes' ? 'Yes, with an Offline fallback' : sel.claude === 'drafts' ? 'Only to draft text a person reviews' : 'No'}</dd></div>
              {sel.autonomyBySegment ? <div><dt className="text-[12px] text-muted-foreground">By segment</dt><dd>{Object.entries(sel.autonomyBySegment).map(([s, a]) => `${SEG[s] ?? s}: ${RUNG_WORD[a as string]?.toLowerCase()}`).join(' · ')}</dd></div> : null}
              <div title={`Reads: ${sel.reads.join(', ')}\nWrites: ${sel.writes.join(', ') || 'nothing'}`}><dt className="text-[12px] text-muted-foreground">Writes to the record</dt><dd>{sel.writes.length ? (sel.writes.some((w: string) => w.startsWith('core.')) ? 'Yes, only on an approved proposal' : 'Only its own working tables') : 'Nothing'}</dd></div>
            </dl>
          </Panel>
        </>}>
          <Panel title="Profile">
            <AgentProfile agent={{ id: sel.id, name: `${sel.name} ${sel.name_ar}`, role: sel.title, purpose: sel.purpose, initials: sel.name.slice(0, 2), autonomy: AUTONOMY[sel.autonomy] }} functions={sel.functions} superpower={sel.superpower} impact={sel.impact} />
          </Panel>
          <Panel title="What it did last"><TrailList rows={(trail ?? []).slice(0, 15)} compact /></Panel>
        </PageColumns>
      </Screen>
    );
  }
  return (
    <Screen hero={<Hero eyebrow="How it works · Agents" title={agents.length ? `${num(agents.length)} agents: ${num(at('A2') + at('A1') + at('A0'))} wait for a person, ${num(at('A3'))} act and report, none is autonomous` : 'The agents'} lede="Everything that decides is deterministic; Claude only reads, classifies, drafts and answers. Each rung below is the rung the workflow actually runs at." />}>
      <Panel title="Who may do what, on its own">
        <Ladder agents={agents} onOpen={(id) => go('agents', id)} />
      </Panel>
      <Panel icon={<Bot size={16} />} title="The team">
        <AgentDirectory>{agents.map((a) => (
          <AgentCard key={a.id} agent={{ id: a.id, name: `${a.name} ${a.name_ar}`, role: a.title, purpose: a.purpose, initials: a.name.slice(0, 2), autonomy: AUTONOMY[a.autonomy], activity: a.todayTotal ? 'working' : 'idle' }} onOpen={() => go('agents', a.id)}
            footer={<span className="flex items-center gap-2 text-[12px] text-muted-foreground"><span>{num(weekTotal(a))} actions this week</span><Sparkline points={(a.week ?? []).map((d: any) => d.n)} className="ms-auto h-5 w-20" />{a.last ? <span>{rel(a.last.at)}</span> : null}</span>} />
        ))}</AgentDirectory>
      </Panel>
    </Screen>
  );
}

/** A workflow's trigger or outcome in the person's words: reason codes named, rung codes said. */
const plainFlow = (s: string) => String(s ?? '')
  .replace(/\bR\d{2}\b/g, (m) => REASON_LABEL[m] ?? m)
  .replace(/\s*\((A[0-4])\)/g, (_m, r) => ` (${RUNG_WORD[r]?.toLowerCase()})`)
  .replace(/^None \(acts and reports\)$/, 'Nobody: the agent acts and reports')
  .replace(/\bT-(\d+)\b/g, '$1 days before expiry')
  .replace(/\bHV\b/g, 'High Value');

/** A workflow's steps as segments by actor: an agent, a person, the record. */
function ActorStrip({ steps }: { steps: any[] }) {
  const tone = (s: any) => s.actor_type === 'HUMAN' ? 'bg-warn' : s.actor_type === 'SYSTEM' ? 'bg-foreground/40' : 'bg-primary';
  const who = (s: any) => s.actor_type === 'HUMAN' ? (PERSONA_SHORT[s.actor] ?? 'a person') : s.actor_type === 'SYSTEM' ? 'the record' : (s.actor ? s.actor[0].toUpperCase() + s.actor.slice(1) : 'an agent');
  return <div className="flex gap-0.5">{steps.map((s, i) => <div key={i} title={`${i + 1}. ${s.label} · ${who(s)}`} className={`h-1.5 flex-1 rounded-sm ${tone(s)}`} />)}</div>;
}
const ActorKey = () => <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" />an agent</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-warn" />a person decides</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-foreground/40" />written to the bank's record</span></p>;

export function WorkflowsScreen() {
  const { route, go, openCase } = useApp();
  const { data, error } = useApi<any[]>('/workflows');
  const sel = route.param ? (data ?? []).find((w) => w.id === route.param) : null;
  const { data: runs } = useApi<any[]>(sel ? `/workflows/${sel.id}/runs` : null);
  if (error) return <Empty>{error}</Empty>;
  const all = data ?? [];
  const people = (w: any) => w.steps.filter((s: any) => s.actor_type === 'HUMAN').length;
  if (sel) {
    const done = sel.runs.filter((r: any) => r.status === 'COMPLETED').reduce((s: number, r: any) => s + r.n, 0);
    return (
      <Screen hero={<Hero eyebrow={<span title={sel.id}>How it works · Workflows</span>} title={`${sel.name}: ${sel.steps.length} steps, ${people(sel) ? `${people(sel)} decided by a person` : 'no person needed'}`} lede={`Starts on ${plainFlow(sel.trigger).replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())} · decided by ${plainFlow(sel.decision_by).replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())}`} actions={<Btn small onClick={() => go('workflows')}>All workflows</Btn>} />}>
        <PageColumns aside={<Panel title={`${num(sel.total)} runs, ${num(done)} completed`}><ul className="space-y-1.5 text-[13px]">{sel.runs.map((r: any) => <li key={r.status} className="flex items-center justify-between"><StatusChip status={r.status} /><span className="tabular-nums">{num(r.n)}</span></li>)}</ul><p className="mt-3 flex flex-wrap gap-2">{sel.agents.map((a: string) => <AgentTag key={a} id={a} showChip={false} size={18} />)}</p></Panel>}>
          <Panel icon={<GitBranch size={16} />} title="Step by step">
            <div className="mb-3 space-y-1.5"><ActorStrip steps={sel.steps} /><ActorKey /></div>
            <WorkflowWalkthrough>{sel.steps.map((s: any, i: number) => <WorkflowStep key={s.key} index={i + 1} title={s.label} actor={s.actor_type === 'HUMAN' ? <Chip tone="warn">{PERSONA_SHORT[s.actor] ?? s.actor.replace('approver:', 'approver per policy: ').replace('rm_or_ops', 'RM or Operations')}</Chip> : <AgentTag id={s.actor} showChip={false} size={16} />} detail={s.actor_type === 'SYSTEM' ? 'Writes to the bank\'s record through the connector.' : s.waits ? `Waits for: ${s.waits.toLowerCase()}.` : undefined} inputs={[s.inputs]} outputs={[s.outputs]} decision={s.decision} />)}</WorkflowWalkthrough>
          </Panel>
          <Panel title="Recent runs"><div className="space-y-2">{(runs ?? []).slice(0, 8).map((r: any) => <div key={r.id} className="rounded-xl border border-border/60 bg-card/40 p-3"><p className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium">{r.name_en ?? r.title}</span><StatusChip status={r.status} />{r.case_ref ? <button type="button" className="text-[12px] text-primary" title={r.case_ref} onClick={() => openCase(r.case_ref)}>Open the case</button> : null}<span className="ms-auto text-[11px] text-muted-foreground">{dateTime(r.created_at)}</span></p><div className="mt-2"><Steps steps={r.steps} /></div></div>)}{!runs?.length ? <Empty>No runs yet.</Empty> : null}</div></Panel>
        </PageColumns>
      </Screen>
    );
  }
  const runsAll = all.reduce((s, w) => s + w.total, 0);
  return (
    <Screen hero={<Hero eyebrow="How it works · Workflows" title={all.length ? `${num(all.length)} workflows have run ${num(runsAll)} times; a person decides in ${num(all.filter((w) => people(w)).length)} of them` : 'The workflows'} lede="An agent step runs at once; a person's step parks the case in one inbox; the bank's record is written only after every person before it has approved." />}>
      <Panel icon={<GitBranch size={16} />} title="Each workflow, step by step" action={<ActorKey />}>
        <WorkflowCatalog>{all.map((w) => <WorkflowCard key={w.id} name={<span title={w.id}>{w.name}</span>} purpose={<span className="block space-y-2"><span className="block" title={w.trigger}>{plainFlow(w.trigger)}</span><ActorStrip steps={w.steps} /></span>} outcome={plainFlow(w.decision_by)} coverage={w.coverage} stepCount={w.steps.length} agents={<span className="flex -space-x-1">{w.agents.map((a: string) => <AgentAvatar key={a} agent={{ id: a, name: a, role: '', initials: a.slice(0, 2) }} size={22} showActivity={false} />)}</span>} autonomy={<span className="text-[12px] text-muted-foreground">{num(w.total)} runs</span>} onOpen={() => go('workflows', w.id)} />)}</WorkflowCatalog>
      </Panel>
    </Screen>
  );
}

export function TriggersScreen() {
  const { data, error, reload } = useApi<any>('/triggers', { poll: 8000 });
  const { reloadSession } = useApp();
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const fire = async (key: string, body: any = {}) => { setBusy(key); setMsg(''); try { const r = await post(`/triggers/${key}/fire`, body); setMsg(`${title(key)}: done · the clock reads ${r.today}`); bump(); reload(); reloadSession(); } catch (e: any) { setMsg(e.message); } finally { setBusy(''); } };
  if (error) return <Empty>{error}</Empty>;
  const p = data?.pending;
  const now: string = data?.clock.now ?? new Date().toISOString();
  return (
    <Screen hero={<Hero eyebrow="Demo · Triggers and clock" title={p ? `${num(p.due)} message${p.due === 1 ? '' : 's'} due, ${num(p.deadlines)} deadline${p.deadlines === 1 ? '' : 's'} passed, ${num(p.rechecks)} re-check${p.rechecks === 1 ? '' : 's'} due on the virtual clock` : 'Triggers and clock'} lede="Scheduled triggers run on the virtual clock; event triggers fire when a customer, a person or a policy change acts. Move the clock to see reminders, deadlines and cooling periods fall out." />}>
      {msg ? <Note>{msg}</Note> : null}
      <Panel icon={<CalendarClock size={16} />} title={`The clock reads ${data?.clock.today ?? '—'}, Doha`} action={<span className="text-[12px] text-muted-foreground">next message {p?.nextScheduled ? rel(p.nextScheduled, now) : '—'}</span>}>
        {p?.nextScheduled && new Date(p.nextScheduled).getTime() - new Date(now).getTime() > 3600_000 ? <TimeBar start={now} end={p.nextScheduled} today={now} className="mb-3" /> : null}
        <div className="flex flex-wrap items-center gap-2">{[1, 7, 30].map((d) => <Btn key={d} kind={d === 1 ? 'primary' : 'ghost'} disabled={!!busy} onClick={() => fire('clock', { days: d })}>{busy === 'clock' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}+{d} day{d > 1 ? 's' : ''}</Btn>)}<span className="text-[12px] text-muted-foreground">Each day: the scan at 02:00, deadlines, due messages and re-checks at 09:15, due messages again at 14:05.</span></div>
      </Panel>
      <Panel icon={<Zap size={16} />} title="What starts the agents">
        <Table><thead><tr><th>Trigger</th><th>When</th><th>Last fired</th><th>Last result</th><th></th></tr></thead>
          <tbody>{(data?.triggers ?? []).map((t: any) => <tr key={t.key} title={t.key}><td><span className="block text-sm font-medium">{String(t.label).replace(/\bT\+N\b/g, 'day-count')}</span><span className="text-[12px] text-muted-foreground">{t.kind === 'SCHEDULE' ? 'on the clock' : t.kind === 'EVENT' ? 'on an event' : t.kind.toLowerCase()} · fired {num(t.fired_count)}×</span></td><td className="text-[12px]">{String(t.schedule ?? '').replace(/\s*\((?:GET|POST|PUT|PATCH|DELETE) [^)]*\)/g, '').replace(/\bT\+N\b/g, 'day-count')}</td><td className="text-[12px]">{t.last_fired_at ? dateTime(t.last_fired_at) : '—'}</td><td className="max-w-[28rem] text-[12px] text-muted-foreground">{t.last_result ?? '—'}</td><td>{['scan', 'due', 'timeout', 'recheck'].includes(t.key) ? <Btn small disabled={!!busy} onClick={() => fire(t.key)}>{busy === t.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3 w-3" />} Fire now</Btn> : null}</td></tr>)}</tbody></Table>
      </Panel>
    </Screen>
  );
}

export function ScenariosScreen() {
  const { data, error, reload } = useApi<any>('/scenarios');
  const { startScenario, director, go } = useApp();
  const [resetting, setResetting] = useState(false); const [msg, setMsg] = useState('');
  useEffect(() => { reload(); }, [director?.status, reload]);
  if (error) return <Empty>{error}</Empty>;
  const list: any[] = data?.scenarios ?? [];
  return (
    <Screen hero={<Hero eyebrow="Demo · Scenarios" title={`${num(list.length)} stories run through the real engine; nothing is pre-recorded`} lede="Each step fires its trigger, switches the screen and the persona, opens the record and marks what changed." actions={<Btn kind="primary" onClick={() => go('present')} title="Present mode: the demo without slides">Present</Btn>} />}>
      {msg ? <Note>{msg}</Note> : null}
      <Panel icon={<Play size={16} />} title="Run a story">
        <ScenarioRunner onReset={async () => { if (!confirm('Rebuild the synthetic world from scratch? This replays sixty days of history and takes about two minutes.')) return; setResetting(true); setMsg('Rebuilding the world…'); try { await post('/control/reset'); setMsg('The world was rebuilt and the clock set to today 09:00 Doha.'); bump(); } catch (e: any) { setMsg(e.message); } finally { setResetting(false); } }}>
          {list.map((s) => {
            const running = director && director.key === s.key;
            const at = running ? (director.status === 'done' ? s.steps.length : (director.index ?? 0)) : 0;
            return <ScenarioCard key={s.key} name={<span title={`${s.key} · ${s.cases.join(', ')}`}>{s.name}</span>} premise={s.summary} demonstrates={<span className="block space-y-1.5"><Segments items={s.steps.map((st: any, i: number) => ({ label: st.title ?? st.label ?? `Step ${i + 1}`, on: i < at }))} /><span className="block text-[12px] text-muted-foreground">{s.steps.length} steps · {String(s.shape).toLowerCase()}</span></span>} state={running ? (director.status === 'done' ? 'complete' : 'running') : 'idle'} onRun={() => startScenario(s.key)} />;
          })}
        </ScenarioRunner>
        {resetting ? <p className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Rebuilding…</p> : null}
      </Panel>
      {data?.runs?.length ? (
        <Panel icon={<RotateCcw size={16} />} title="Earlier runs"><Table><thead><tr><th>Story</th><th>Status</th><th>Reached</th><th>Started</th></tr></thead><tbody>{data.runs.slice(0, 8).map((r: any) => <tr key={r.id} title={(r.log ?? []).slice(-2).map((l: any) => `${l.step}: ${l.result ?? l.error}`).join('\n')}><td className="text-[13px]">{list.find((s) => s.key === r.key)?.name ?? r.key}</td><td><StatusChip status={r.status} /></td><td className="text-[12px]">step {r.step_index + 1}</td><td className="text-[12px]">{dateTime(r.started_at)}</td></tr>)}</tbody></Table></Panel>
      ) : null}
    </Screen>
  );
}
