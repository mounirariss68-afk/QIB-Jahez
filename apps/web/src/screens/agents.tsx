/** Agents (Team), Workflows, Triggers and Scenarios — the "how it works" screens. */
import { useEffect, useState } from 'react';
import { AgentAutonomyChip, AgentAvatar, AgentCard, AgentDirectory, AgentProfile, ScenarioCard, ScenarioRunner, WorkflowCard, WorkflowCatalog, WorkflowStep, WorkflowWalkthrough } from '@cognirise/atelier/archetypes';
import { Panel, PageColumns, StatRow, StatTile } from '@cognirise/atelier/layout';
import { Bot, CalendarClock, GitBranch, Loader2, Play, RotateCcw, Zap } from 'lucide-react';
import { bump, post, useApi } from '../lib/api';
import { dateTime, num, rel, title } from '../lib/format';
import { useApp } from '../app/state';
import { TrailList, Steps } from '../app/case';
import { AUTONOMY, Btn, Chip, Empty, Hero, Note, Screen, StatusChip, Table, PERSONA_SHORT, AgentTag } from '../app/ui';

export function AgentsScreen() {
  const { route, go } = useApp();
  const { data, error } = useApi<any[]>('/agents', { poll: 15000 });
  const sel = route.param ? (data ?? []).find((a) => a.id === route.param) : null;
  const { data: trail } = useApi<any[]>(sel ? `/agents/${sel.id}/trail` : null);
  if (error) return <Empty>{error}</Empty>;
  const agents = data ?? [];
  return (
    <Screen hero={<Hero eyebrow="Agents · the team" title="Ten named colleagues, each with a remit, an autonomy rung and an accountable owner" lede="A0 observe · A1 recommend · A2 acts on approval · A3 acts and reports · A4 autonomous. None runs at A4. Everything that decides — eligibility, classes, caps, windows, suppression, state — is deterministic; Claude is used for reading documents, classifying free text, drafting for a person to review, and Dalil's conversation." />} banner={false}>
      {sel ? (
        <PageColumns aside={<Panel icon={<Bot size={16} />} title="Live stats (from the trail)"><ul className="space-y-1 text-[13px]">{sel.stats.sort((a: any, b: any) => b.total - a.total).map((s: any) => <li key={s.act} className="flex items-center justify-between"><span>{title(s.act)}</span><span className="font-mono text-[12px]">{num(s.today)} today · {num(s.total)} all</span></li>)}{!sel.stats.length ? <li className="text-muted-foreground">No activity yet.</li> : null}</ul><dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]"><div><dt className="text-muted-foreground">Reads</dt><dd>{sel.reads.join(', ')}</dd></div><div><dt className="text-muted-foreground">Writes</dt><dd>{sel.writes.length ? sel.writes.join(', ') : 'nothing'}</dd></div><div><dt className="text-muted-foreground">Who decides</dt><dd>{sel.decides}</dd></div><div><dt className="text-muted-foreground">Owner</dt><dd>{PERSONA_SHORT[sel.owner]}</dd></div><div><dt className="text-muted-foreground">Uses Claude</dt><dd>{sel.claude === 'yes' ? 'yes (with an Offline fallback)' : sel.claude === 'drafts' ? 'only to draft text a person reviews' : 'no'}</dd></div>{sel.autonomyBySegment ? <div><dt className="text-muted-foreground">By segment</dt><dd>{Object.entries(sel.autonomyBySegment).map(([s, a]) => `${s} ${a}`).join(' · ')}</dd></div> : null}</dl></Panel>}>
          <Panel title="Profile" action={<Btn small onClick={() => go('agents')}>All agents</Btn>}>
            <AgentProfile agent={{ id: sel.id, name: `${sel.name} ${sel.name_ar}`, role: sel.title, purpose: sel.purpose, initials: sel.name.slice(0, 2), autonomy: AUTONOMY[sel.autonomy] }} functions={sel.functions} superpower={sel.superpower} impact={sel.impact} stats={[{ label: 'Actions today', value: num(sel.todayTotal) }, { label: 'Actions in all', value: num(sel.total) }, { label: 'Tools', value: sel.tools.join(', ') }]} />
          </Panel>
          <Panel title="Recent trail"><TrailList rows={trail ?? []} compact /></Panel>
        </PageColumns>
      ) : (
        <Panel icon={<Bot size={16} />} title="The team">
          <AgentDirectory>{agents.map((a) => <AgentCard key={a.id} agent={{ id: a.id, name: `${a.name} ${a.name_ar}`, role: a.title, purpose: a.purpose, initials: a.name.slice(0, 2), autonomy: AUTONOMY[a.autonomy], activity: a.todayTotal ? 'working' : 'idle' }} onOpen={() => go('agents', a.id)} footer={<span className="flex items-center gap-2 text-[11px] text-muted-foreground"><span>{num(a.todayTotal)} today · {num(a.total)} all</span>{a.last ? <span className="ms-auto">{rel(a.last.at)}</span> : null}</span>} />)}</AgentDirectory>
        </Panel>
      )}
    </Screen>
  );
}

export function WorkflowsScreen() {
  const { route, go } = useApp();
  const { data, error } = useApi<any[]>('/workflows');
  const sel = route.param ? (data ?? []).find((w) => w.id === route.param) : null;
  const { data: runs } = useApi<any[]>(sel ? `/workflows/${sel.id}/runs` : null);
  const { openCase } = useApp();
  if (error) return <Empty>{error}</Empty>;
  return (
    <Screen hero={<Hero eyebrow="Workflows · what is automated, and exactly how" title="Eighteen workflows, each step with its actor, inputs, outputs and decision" lede="AGENT steps execute at once; a HUMAN step parks the case in one persona's inbox; SYSTEM steps are the only writes to the bank's record, and they run only after every human step before them has approved. A step that waits parks the run until the customer's reply, a payment or a deadline." />} banner={false}>
      {sel ? (
        <PageColumns aside={<Panel title="Runs" action={<Btn small onClick={() => go('workflows')}>Catalogue</Btn>}><ul className="space-y-1 text-[12px]">{sel.runs.map((r: any) => <li key={r.status} className="flex items-center justify-between"><StatusChip status={r.status} /><span className="font-mono">{num(r.n)}</span></li>)}</ul><p className="mt-2 text-[12px] text-muted-foreground">Trigger: {sel.trigger}</p><p className="text-[12px] text-muted-foreground">Decision by: {sel.decision_by}</p><p className="mt-1 flex flex-wrap gap-1">{sel.agents.map((a: string) => <AgentTag key={a} id={a} showChip={false} size={16} />)}</p></Panel>}>
          <Panel icon={<GitBranch size={16} />} title={`${sel.id} · ${sel.name}`} action={<Chip>{sel.coverage}</Chip>}>
            <WorkflowWalkthrough>{sel.steps.map((s: any, i: number) => <WorkflowStep key={s.key} index={i + 1} title={s.label} actor={s.actor_type === 'HUMAN' ? <Chip tone="warn">{PERSONA_SHORT[s.actor] ?? s.actor.replace('approver:', 'approver per policy: ').replace('rm_or_ops', 'RM or Operations')}</Chip> : <AgentTag id={s.actor} showChip={false} size={16} />} detail={s.actor_type === 'SYSTEM' ? 'Writes to the bank\'s record through the connector.' : s.waits ? `Waits for: ${s.waits.toLowerCase()}.` : undefined} inputs={[s.inputs]} outputs={[s.outputs]} decision={s.decision} />)}</WorkflowWalkthrough>
          </Panel>
          <Panel title="Recent runs"><div className="space-y-2">{(runs ?? []).slice(0, 12).map((r: any) => <div key={r.id} className="rounded-xl border border-border/60 bg-card/40 p-3"><p className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium">{r.title}</span><StatusChip status={r.status} />{r.case_ref ? <button type="button" className="font-mono text-[12px] text-primary" onClick={() => openCase(r.case_ref)}>{r.case_ref}</button> : null}<span className="ms-auto text-[11px] text-muted-foreground">{r.channel} · {dateTime(r.created_at)}</span></p><div className="mt-2"><Steps steps={r.steps} /></div></div>)}{!runs?.length ? <Empty>No runs yet.</Empty> : null}</div></Panel>
        </PageColumns>
      ) : (
        <Panel icon={<GitBranch size={16} />} title="Catalogue">
          <WorkflowCatalog>{(data ?? []).map((w) => <WorkflowCard key={w.id} name={`${w.id} · ${w.name}`} purpose={w.trigger} trigger={w.reasons.length ? `Reasons ${w.reasons.join(', ')}` : w.trigger} outcome={w.decision_by} coverage={w.coverage} stepCount={w.steps.length} agents={<span className="flex -space-x-1">{w.agents.map((a: string) => <AgentAvatar key={a} agent={{ id: a, name: a, role: '', initials: a.slice(0, 2) }} size={22} showActivity={false} />)}</span>} autonomy={<Chip>{num(w.total)} runs</Chip>} onOpen={() => go('workflows', w.id)} />)}</WorkflowCatalog>
        </Panel>
      )}
    </Screen>
  );
}

export function TriggersScreen() {
  const { data, error, reload } = useApi<any>('/triggers', { poll: 8000 });
  const { reloadSession } = useApp();
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const fire = async (key: string, body: any = {}) => { setBusy(key); setMsg(''); try { const r = await post(`/triggers/${key}/fire`, body); setMsg(`${key}: ${JSON.stringify(r.result).slice(0, 220)} · now ${r.today}`); bump(); reload(); reloadSession(); } catch (e: any) { setMsg(e.message); } finally { setBusy(''); } };
  if (error) return <Empty>{error}</Empty>;
  return (
    <Screen hero={<Hero eyebrow="Triggers · what starts the agents" title="Every trigger, its last firing, and a fire-now button" lede="Scheduled triggers run on the virtual clock; event triggers fire when a customer, a person or a policy change acts. Advance the clock by a day, a week or thirty days to see the reminders, the deadlines, the T+90 restriction proposals and the cooling periods fall out — a month in a minute." />} banner={false}>
      {msg ? <Note>{msg}</Note> : null}
      <StatRow><StatTile label="Virtual clock" value={data?.clock.today ?? '—'} state={<Chip>Doha</Chip>} /><StatTile label="Messages due now" value={num(data?.pending.due)} /><StatTile label="Deadlines passed" value={num(data?.pending.deadlines)} /><StatTile label="Re-checks due" value={num(data?.pending.rechecks)} /></StatRow>
      <Panel icon={<CalendarClock size={16} />} title="Advance the clock" action={<span className="text-[12px] text-muted-foreground">next scheduled message {data?.pending.nextScheduled ? dateTime(data.pending.nextScheduled) : '—'}</span>}>
        <div className="flex flex-wrap gap-2">{[1, 7, 30].map((d) => <Btn key={d} kind={d === 1 ? 'primary' : 'ghost'} disabled={!!busy} onClick={() => fire('clock', { days: d })}>{busy === 'clock' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}+{d} day{d > 1 ? 's' : ''}</Btn>)}<span className="text-[12px] text-muted-foreground self-center">Each day: 02:00 scan → 09:15 deadlines, due messages, re-checks → 14:05 due messages.</span></div>
      </Panel>
      <Panel icon={<Zap size={16} />} title="Triggers">
        <Table><thead><tr><th>Trigger</th><th>Kind</th><th>Schedule</th><th>Last fired</th><th>Fired</th><th>Last result</th><th></th></tr></thead>
          <tbody>{(data?.triggers ?? []).map((t: any) => <tr key={t.key}><td><span className="block text-sm font-medium">{t.label}</span><span className="font-mono text-[11px] text-muted-foreground">{t.key}</span></td><td><Chip tone={t.kind === 'SCHEDULE' ? 'primary' : t.kind === 'EVENT' ? 'warn' : undefined}>{t.kind.toLowerCase()}</Chip></td><td className="text-[12px]">{t.schedule}</td><td className="text-[12px]">{t.last_fired_at ? dateTime(t.last_fired_at) : '—'}</td><td className="font-mono text-[12px]">{num(t.fired_count)}</td><td className="text-[12px] text-muted-foreground">{t.last_result ?? '—'}</td><td>{['scan', 'due', 'timeout', 'recheck'].includes(t.key) ? <Btn small disabled={!!busy} onClick={() => fire(t.key)}>{busy === t.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3 w-3" />} Fire now</Btn> : <span className="text-[11px] text-muted-foreground">fires on its event</span>}</td></tr>)}</tbody></Table>
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
  return (
    <Screen hero={<Hero eyebrow="Scenarios · the demo's remote control" title="Six scripted productions through the real engine" lede="Each step names its trigger, runs the engine, switches the screen (and the persona), opens the record and highlights what changed. Nothing is faked: a step that 'decides' calls the same decide() a click calls, stamped '(decided by the scenario)' in the trail. Play, pause, step, go back; or reset the whole world." />} banner={false}>
      {msg ? <Note>{msg}</Note> : null}
      <Panel icon={<Play size={16} />} title="Scenarios">
        <ScenarioRunner onReset={async () => { if (!confirm('Rebuild the synthetic world from scratch? This replays sixty days of history and takes about two minutes.')) return; setResetting(true); setMsg('Rebuilding the world…'); try { await post('/control/reset'); setMsg('The world was rebuilt and the clock set to today 09:00 Doha.'); bump(); } catch (e: any) { setMsg(e.message); } finally { setResetting(false); } }}>
          {(data?.scenarios ?? []).map((s: any) => <ScenarioCard key={s.key} name={`${s.key} · ${s.name}`} premise={s.summary} demonstrates={<span className="flex flex-wrap items-center gap-1 text-[12px]"><Chip>{s.shape}</Chip>{s.cases.map((c: string) => <Chip key={c}>{c}</Chip>)}<span className="text-muted-foreground">· {s.steps.length} steps</span></span>} state={director && director.key === s.key ? (director.status === 'done' ? 'complete' : 'running') : 'idle'} onRun={() => startScenario(s.key)} />)}
        </ScenarioRunner>
        {resetting ? <p className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Rebuilding…</p> : null}
      </Panel>
      <Panel icon={<RotateCcw size={16} />} title="Previous runs"><Table><thead><tr><th>Scenario</th><th>Status</th><th>Step</th><th>Started</th><th>Log</th></tr></thead><tbody>{(data?.runs ?? []).map((r: any) => <tr key={r.id}><td className="font-mono text-[12px]">{r.key}</td><td><StatusChip status={r.status} /></td><td className="font-mono text-[12px]">{r.step_index + 1}</td><td className="text-[12px]">{dateTime(r.started_at)}</td><td className="text-[12px] text-muted-foreground">{(r.log ?? []).slice(-2).map((l: any) => `${l.step}: ${l.result ?? l.error}`).join(' · ')}</td></tr>)}</tbody></Table>{!data?.runs?.length ? <Empty>No runs yet.</Empty> : null}</Panel>
      <p className="text-[11px] text-muted-foreground">The named edge cases behind the scenarios live on customers {Object.entries(data?.edge ?? {}).slice(0, 6).map(([k, v]) => `${k} = ${v}`).join(', ')} … — open any of them from <button type="button" className="text-primary" onClick={() => go('cases')}>Cases</button>.</p>
    </Screen>
  );
}
void AgentAutonomyChip;
