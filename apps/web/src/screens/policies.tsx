/**
 * Rules (Policies) — "Set the rule, and see what it changes." CogniPulse's
 * SettingsLayout: the domains in words on the left (the code in the hover),
 * the settings of the one chosen on the right, each with its basis behind one
 * disclosure. Above them, what a change does: the pending change (or the last
 * one) as a slope, before → after, with the messages it moves counted beside it.
 */
import { useEffect, useMemo, useState } from 'react';
import { SettingsGroup, SettingsLayout, SettingsNavItem, SettingsRow } from '@cognirise/cognipulse/archetypes';
import { Slope } from '@cognirise/cognipulse/viz';
import { Loader2 } from 'lucide-react';
import { post, bump, useApi } from '../lib/api';
import { dateTime, num, title } from '../lib/format';
import { useApp } from '../app/state';
import { Btn, Chip, Empty, Hero, Note, Screen, Select, StatusChip, PERSONA_SHORT, SEG } from '../app/ui';

const SEGS = ['VVIP', 'HNWI', 'HIGH_VALUE', 'MASS'];
const APPROVER: Record<string, string> = { HEAD: 'head', CREDIT: 'credit', SUPERVISOR: 'supervisor', COMPLIANCE: 'compliance' };
const fmt = (v: any) => Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v ?? '—');

export function PoliciesScreen() {
  const { route, go, persona } = useApp();
  const { data, error, reload } = useApi<any>('/policies');
  const [domain, setDomain] = useState(route.param?.split(' ')[0] ?? 'POL-01');
  const [view, setView] = useState<'params' | 'clauses' | 'search'>(route.param?.includes('§') ? 'clauses' : 'params');
  const [q, setQ] = useState('');
  useEffect(() => { if (route.param) { setDomain(route.param.split(' ')[0]); setView(route.param.includes('§') ? 'clauses' : 'params'); } }, [route.param]);
  const [edit, setEdit] = useState<{ key: string; segment?: string; value: string; rationale: string } | null>(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const { data: inbox } = useApi<any>('/inbox');
  const pendingRun = (inbox?.approvals ?? []).find((a: any) => a.workflow_id === 'WF-18');
  const params = useMemo(() => (data?.params ?? []).filter((p: any) => p.domain === domain), [data, domain]);
  const label = useMemo(() => Object.fromEntries((data?.params ?? []).map((p: any) => [p.key, p.label])), [data]);
  const clauses = useMemo(() => (data?.clauses ?? []).filter((c: any) => (view === 'search' || c.domain === domain) && (!q || `${c.id} ${c.heading} ${c.text} ${c.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase()))), [data, domain, q, view]);
  if (error) return <Empty>{error}</Empty>;
  if (!data) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const dom = data.domains.find((d: any) => d.id === domain);
  const approver = PERSONA_SHORT[APPROVER[dom?.approver] ?? 'head'];
  const propose = async () => {
    if (!edit) return; setBusy(true); setMsg('');
    try { const r = await post('/policies/propose', { key: edit.key, segment: edit.segment, value: edit.value, rationale: edit.rationale }); setMsg(`Proposed; it waits on the ${PERSONA_SHORT[r.waitingOn] ?? r.waitingOn}. Hami worked out what it moves.`); setEdit(null); bump(); reload(); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const nClauses = (id: string) => (data.clauses ?? []).filter((c: any) => c.domain === id).length;
  return (
    <Screen hero={<Hero eyebrow="Rules" title={`${num(data.params.length)} settings decide what the agents may do; version ${data.version} is in force`} lede="A change is proposed, Hami works out what it moves, the domain's approver decides, and the new version is stamped on every action after it. Nothing about the rules is in the code." actions={<Btn onClick={() => go('audit', 'act=VERSION')}>Every version in the trail</Btn>} />}>
      {msg ? <Note>{msg}</Note> : null}
      <SettingsLayout nav={<>
        {data.domains.map((d: any) => <SettingsNavItem key={d.id} active={view !== 'search' && domain === d.id} onSelect={() => { setDomain(d.id); setView('params'); setEdit(null); }}><span title={d.id}>{d.name}</span></SettingsNavItem>)}
        <div className="my-1 border-t border-border/60" />
        <SettingsNavItem active={view === 'search'} onSelect={() => setView('search')}>Search every clause</SettingsNavItem>
      </>}>
        <ChangeEffect run={pendingRun} versions={data.versions} label={label} onInbox={() => go('inbox')} />
        {view === 'search' ? (
          <SettingsGroup title="Every clause the agents and Dalil cite" action={<input className="input h-8" placeholder="Search the clauses" value={q} onChange={(e) => setQ(e.target.value)} />}>
            <Clauses rows={clauses} focus={route.param} />
          </SettingsGroup>
        ) : (
          <SettingsGroup title={<span title={dom?.id}>{dom?.name}</span>}
            description={<>{dom?.description} Approved by the {approver}; {dom?.canPropose ? `as ${persona?.role ?? 'you'}, you may propose a change.` : `as ${persona?.role ?? 'you'}, you may not propose a change here.`}</>}
            action={<Select className="h-8 text-[13px]" value={view} onChange={(v) => setView(v as any)}><option value="params">{params.length} settings</option><option value="clauses">{nClauses(domain)} clauses</option></Select>}>
            {view === 'clauses' ? <Clauses rows={clauses} focus={route.param} /> : (
              <>
                {params.map((p: any) => (
                  <div key={p.key}>
                    <SettingsRow label={p.label}
                      hint={<>
                        {p.segmented ? <SegValues value={p.value} unit={p.unit} /> : null}
                        <details className="mt-1 text-[12px]"><summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">Why this value</summary><p className="mt-1">{p.basis}</p><p className="mt-0.5 text-muted-foreground">{p.clause ? `Clause ${p.clause} · ` : ''}setting {p.key}</p></details>
                      </>}
                      control={<span className="flex items-center gap-3">{p.segmented ? null : <span className="font-mono text-sm font-semibold">{fmt(p.value)}{p.unit ? <span className="ms-1 text-[11px] font-normal text-muted-foreground">{p.unit}</span> : null}</span>}{p.canPropose ? <Btn small onClick={() => setEdit({ key: p.key, segment: p.segmented ? 'MASS' : undefined, value: fmt(p.segmented ? p.value.MASS : p.value), rationale: '' })}>Propose a change</Btn> : null}</span>} />
                    {edit && edit.key === p.key ? (
                      <div className="mb-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
                        <div className="flex flex-wrap items-end gap-2">
                          {edit.segment !== undefined ? <label className="field"><span>Segment</span><Select value={edit.segment} onChange={(v) => setEdit({ ...edit, segment: v, value: fmt(p.value[v]) })}>{SEGS.map((s) => <option key={s} value={s}>{SEG[s]}</option>)}</Select></label> : null}
                          <label className="field"><span>New value</span><input className="input" value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} /></label>
                          <label className="field flex-1"><span>Why (the approver reads it)</span><input className="input w-full" value={edit.rationale} onChange={(e) => setEdit({ ...edit, rationale: e.target.value })} /></label>
                          <Btn onClick={() => setEdit(null)}>Cancel</Btn>
                          <Btn kind="primary" onClick={propose} disabled={busy || !edit.rationale}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Propose the change</Btn>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">Hami works out which scheduled messages move and which cases it touches; the {approver} decides.</p>
                      </div>
                    ) : null}
                  </div>
                ))}
                <p className="mt-3 text-[11px] text-muted-foreground">Each value's basis says where it comes from: a regulation or published rule, a design default, an assumption about QIB, or QIB's own words. QIB's answers replace the defaults here, not in the code.</p>
              </>
            )}
          </SettingsGroup>
        )}
        <SettingsGroup title="Versions">
          <ul className="space-y-2 text-[13px]">{data.versions.map((v: any) => (
            <li key={v.id} className="border-b border-border/60 pb-2 last:border-b-0">
              <p className="flex flex-wrap items-center gap-2"><span className="font-semibold">Version {v.version}</span><StatusChip status={v.status} /><span className="ms-auto text-[12px] text-muted-foreground">{dateTime(v.approved_at ?? v.proposed_at)}</span></p>
              {(v.diff ?? []).map((d: any, i: number) => <p key={i} className="mt-0.5">{label[d.key] ?? d.key}{d.segment ? ` (${SEG[d.segment]})` : ''}: {fmt(d.from)} → <span className="font-semibold">{fmt(d.to)}</span></p>)}
              {v.rationale ? <p className="mt-0.5 text-muted-foreground">{v.rationale}</p> : null}
              <p className="text-[12px] text-muted-foreground">{v.proposed_by ? `Proposed by the ${PERSONA_SHORT[v.proposed_by] ?? v.proposed_by}` : ''}{v.approved_by ? `, approved by the ${PERSONA_SHORT[v.approved_by] ?? v.approved_by}` : ''}</p>
            </li>))}</ul>
        </SettingsGroup>
      </SettingsLayout>
    </Screen>
  );
}

/** A segmented value: "3 in every segment", or the four values side by side. */
function SegValues({ value, unit }: { value: Record<string, any>; unit?: string }) {
  const vals = SEGS.map((s) => fmt(value[s]));
  if (vals.every((v) => v === vals[0])) return <span className="text-[13px] text-foreground">{vals[0]}{unit ? ` ${unit}` : ''} in every segment</span>;
  return <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-foreground">{SEGS.map((s, i) => <span key={s}><span className="text-muted-foreground">{SEG[s]}</span> <span className="font-mono font-semibold">{vals[i]}</span></span>)}{unit ? <span className="text-muted-foreground">{unit}</span> : null}</span>;
}

/** What a change does: the change waiting on someone, or else the last one approved, as a slope with the messages it moves beside it. */
function ChangeEffect({ run, versions, label, onInbox }: { run: any; versions: any[]; label: Record<string, string>; onInbox: () => void }) {
  const { data } = useApi<any>(run ? `/runs/${run.run_id}` : null);
  // Mine to decide (from the Inbox), else a change proposed and waiting on someone, else the last one approved.
  const proposed = versions.find((v) => v.status === 'PROPOSED' && v.diff?.length);
  const last = proposed ?? versions.find((v) => v.status === 'ACTIVE' && v.diff?.length) ?? versions.find((v) => v.status !== 'DECLINED' && v.diff?.length);
  const waits = !!run || !!proposed;
  const pv = run ? data?.result?.preview : last?.preview;
  const diff = run ? null : last?.diff?.[0];
  if (run && !data) return null;
  if (!run && !diff) return null;
  const from = pv?.from ?? diff?.from, to = pv?.to ?? diff?.to;
  const numeric = from !== '' && to !== '' && from != null && to != null && Number.isFinite(Number(from)) && Number.isFinite(Number(to));
  const what = pv?.label ?? (diff ? label[diff.key] ?? diff.key : '');
  const seg = pv?.segment ?? diff?.segment;
  // What it moves: the scheduled messages it reschedules, or else the open cases that run under it.
  const moved = pv?.messages?.length ? { n: pv.messages.length, word: `scheduled message${pv.messages.length === 1 ? '' : 's'} ${waits ? 'would move' : 'moved'}` } : pv?.cases ? { n: pv.cases, word: `open case${pv.cases === 1 ? '' : 's'} ${waits ? 'would run' : 'run'} under it` } : null;
  return (
    <section className="rounded-xl glass-l2 px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className={`text-[12px] ${waits ? 'text-warn' : 'text-muted-foreground'}`}>{run ? 'A change waits on you' : proposed ? `A change waits on its approver${proposed.proposed_by ? `, proposed by the ${PERSONA_SHORT[proposed.proposed_by] ?? proposed.proposed_by}` : ''}` : `The last change, version ${last.version}`}</p>
          <p className="mt-1 text-base font-semibold leading-snug">{what}{seg ? `, ${SEG[seg] ?? seg}` : ''}</p>
          {pv?.note ? <p className="mt-1 text-[13px] text-muted-foreground">{pv.note.replace(/\((s)\)/g, 's').replace(/move by -(\d+) days?/, (_m: string, n: string) => `move ${n} day${n === '1' ? '' : 's'} earlier`).replace(/move by (\d+) days?/, (_m: string, n: string) => n === '0' ? 'do not move' : `move ${n} day${n === '1' ? '' : 's'} later`)}</p> : null}
          {(run ? data?.payload?.rationale : last?.rationale) ? <p className="mt-1 text-[13px]"><span className="text-muted-foreground">Why: </span>{run ? data.payload.rationale : last.rationale}</p> : null}
          {run ? <button type="button" className="mt-2 text-[13px] text-primary" onClick={onInbox}>Decide it in the Inbox</button> : null}
        </div>
        <div className="w-56 shrink-0">
          {numeric ? <Slope before={Number(from)} now={Number(to)} target={null} direction={Number(to) < Number(from) ? 'down' : 'up'} /> : <p className="text-xl font-semibold">{fmt(from)} → {fmt(to)}</p>}
        </div>
        {moved ? (
          <div className="w-36 shrink-0 text-end">
            <p className="text-2xl font-semibold tabular-nums">{num(moved.n)}</p>
            <p className="text-[12px] leading-snug text-muted-foreground">{moved.word}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Clauses({ rows, focus }: { rows: any[]; focus: string | null }) {
  if (!rows.length) return <Empty>No clause matches.</Empty>;
  return (
    <ul className="space-y-2">{rows.map((c: any) => (
      <li key={c.id} id={c.id} className={`rounded-xl border p-3 ${focus === c.id ? 'border-accent/60 bg-accent/5' : 'border-border/60 bg-card/50'}`}>
        <p className="flex flex-wrap items-center gap-2"><Chip tone="primary">{c.id}</Chip><span className="font-semibold">{c.heading}</span><span className="ar ms-auto text-[12px] text-muted-foreground">{c.heading_ar}</span></p>
        <p className="mt-1 text-[13px] leading-relaxed">{c.text}</p>
        <p className="ar mt-1 text-end text-[12px] leading-relaxed text-muted-foreground" dir="rtl">{c.text_ar}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Basis: {c.basis} · {c.tags.map((t: string) => title(t)).join(', ')}</p>
      </li>))}</ul>
  );
}
