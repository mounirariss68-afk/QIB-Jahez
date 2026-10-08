/** Policies — policy management: domains, parameters per segment, clauses, versions; propose a change (WF-18) and approve it. */
import { useEffect, useMemo, useState } from 'react';
import { Panel, PageColumns } from '@cognirise/atelier/layout';
import { BookOpen, History, Loader2, ShieldCheck, Sliders } from 'lucide-react';
import { bump, post, useApi } from '../lib/api';
import { dateTime, title } from '../lib/format';
import { useApp } from '../app/state';
import { Btn, Chip, Empty, Hero, Note, Screen, Select, StatusChip, Table, Tabs, PERSONA_SHORT, SEG } from '../app/ui';

const SEGS = ['VVIP', 'HNWI', 'HIGH_VALUE', 'MASS'];

export function PoliciesScreen() {
  const { route, go, persona } = useApp();
  const { data, error, reload } = useApi<any>('/policies');
  const [domain, setDomain] = useState(route.param?.split(' ')[0] ?? 'POL-01');
  const [tab, setTab] = useState('params');
  const [q, setQ] = useState('');
  useEffect(() => { if (route.param) { setDomain(route.param.split(' ')[0]); if (route.param.includes('§')) setTab('clauses'); } }, [route.param]);
  const [edit, setEdit] = useState<{ key: string; segment?: string; value: string; rationale: string } | null>(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const { data: inbox } = useApi<any>('/inbox');
  const pendingRun = (inbox?.approvals ?? []).find((a: any) => a.workflow_id === 'WF-18');
  const params = useMemo(() => (data?.params ?? []).filter((p: any) => p.domain === domain), [data, domain]);
  const clauses = useMemo(() => (data?.clauses ?? []).filter((c: any) => (c.domain === domain || tab === 'search') && (!q || `${c.id} ${c.heading} ${c.text} ${c.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase()))), [data, domain, q, tab]);
  if (error) return <Empty>{error}</Empty>;
  if (!data) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const dom = data.domains.find((d: any) => d.id === domain);
  const fmt = (v: any) => Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v);
  const propose = async () => {
    if (!edit) return; setBusy(true); setMsg('');
    try { const r = await post('/policies/propose', { key: edit.key, segment: edit.segment, value: edit.value, rationale: edit.rationale }); setMsg(`Proposed (WF-18 run ${r.runId}); waiting on ${PERSONA_SHORT[r.waitingOn] ?? r.waitingOn}. Hami computed the effect preview.`); setEdit(null); bump(); reload(); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  return (
    <Screen hero={<Hero eyebrow={`Policies · version ${data.version} active`} title="Everything an agent may do is a setting here" lede="Ten policy domains plus segments, channels, reference lists and the data generator. Parameters that differ by segment are stored per segment; the rest are global. A change is proposed, previewed for its effect, approved by the domain's approver, versioned, and stamped on every action after it. Nothing about QIB's rules is in the code." actions={<Btn onClick={() => go('audit', 'act=VERSION')}>Version history in the trail</Btn>} />} banner={false}>
      {pendingRun ? <Note tone="warn">A policy change waits on you: <strong>{pendingRun.title}</strong>. <button type="button" className="text-primary underline" onClick={() => go('inbox')}>Decide it in the Inbox</button>.</Note> : null}
      {msg ? <Note>{msg}</Note> : null}
      <div className="flex flex-wrap gap-1">{data.domains.map((d: any) => <button key={d.id} type="button" onClick={() => { setDomain(d.id); setTab('params'); }} className={`mono-chip ${domain === d.id ? 'is-primary' : ''}`} title={d.description}>{d.id} · {d.name}</button>)}</div>
      <PageColumns aside={<>
        <Panel icon={<ShieldCheck size={16} />} title="Who may change this domain"><p className="text-[13px]">{dom?.description}</p><p className="mt-2 text-[12px]">Approver: <Chip tone="primary">{PERSONA_SHORT[({ HEAD: 'head', CREDIT: 'credit', SUPERVISOR: 'supervisor', COMPLIANCE: 'compliance' } as any)[dom?.approver] ?? 'head']}</Chip></p><p className="mt-1 text-[12px] text-muted-foreground">{dom?.canPropose ? `${persona?.role} may propose changes here.` : `${persona?.role} may not propose changes here (authority matrix).`}</p></Panel>
        <Panel icon={<History size={16} />} title="Versions"><ul className="space-y-1.5 text-[12px]">{data.versions.map((v: any) => <li key={v.id} className="rounded-lg border border-border/60 bg-card/50 p-2"><p className="flex items-center gap-2"><span className="font-mono font-semibold">v{v.version}</span><StatusChip status={v.status} /><span className="ms-auto text-muted-foreground">{dateTime(v.approved_at ?? v.proposed_at)}</span></p>{(v.diff ?? []).map((d: any, i: number) => <p key={i} className="mt-0.5">{d.key}{d.segment ? ` (${SEG[d.segment]})` : ''}: <span className="font-mono">{fmt(d.from)}</span> → <span className="font-mono font-semibold">{fmt(d.to)}</span></p>)}{v.rationale ? <p className="mt-0.5 text-muted-foreground">{v.rationale}</p> : null}<p className="text-muted-foreground">{v.proposed_by ? `proposed by ${PERSONA_SHORT[v.proposed_by] ?? v.proposed_by}` : ''}{v.approved_by ? ` · approved by ${PERSONA_SHORT[v.approved_by] ?? v.approved_by}` : ''}</p></li>)}</ul></Panel>
      </>}>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'params', label: 'Parameters', n: params.length }, { id: 'clauses', label: 'Clauses', n: (data.clauses ?? []).filter((c: any) => c.domain === domain).length }, { id: 'search', label: 'Search all clauses' }]} />
        {tab === 'params' ? (
          <Panel icon={<Sliders size={16} />} title={`${domain} · ${dom?.name}`}>
            <Table><thead><tr><th>Parameter</th>{SEGS.map((s) => <th key={s}>{SEG[s]}</th>)}<th>Basis</th><th></th></tr></thead>
              <tbody>{params.map((p: any) => (
                <tr key={p.key}>
                  <td><span className="block text-sm">{p.label}</span><span className="font-mono text-[11px] text-muted-foreground">{p.key}{p.unit ? ` · ${p.unit}` : ''}{p.clause ? ` · ${p.clause}` : ''}</span></td>
                  {p.segmented ? SEGS.map((s) => <td key={s} className="font-mono text-[12px]">{fmt(p.value[s])}</td>) : <td colSpan={4} className="font-mono text-[12px]">{fmt(p.value)}</td>}
                  <td className="text-[11px] text-muted-foreground">{p.basis}</td>
                  <td>{p.canPropose ? <Btn small onClick={() => setEdit({ key: p.key, segment: p.segmented ? 'MASS' : undefined, value: fmt(p.segmented ? p.value.MASS : p.value), rationale: '' })}>Propose</Btn> : null}</td>
                </tr>))}</tbody></Table>
            <p className="mt-2 text-[11px] text-muted-foreground">[R] regulation or published rule · [D] design default · [A] assumption about QIB · [Q] QIB's own wording. QIB's answers replace the defaults here, not in the code.</p>
            {edit ? (
              <div className="mt-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
                <p className="text-sm font-semibold">Propose a change to <span className="font-mono">{edit.key}</span></p>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  {edit.segment !== undefined ? <label className="field"><span>Segment</span><Select value={edit.segment} onChange={(v) => setEdit({ ...edit, segment: v, value: fmt(params.find((p: any) => p.key === edit.key)?.value[v]) })}>{SEGS.map((s) => <option key={s} value={s}>{SEG[s]}</option>)}</Select></label> : null}
                  <label className="field"><span>New value</span><input className="input" value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} /></label>
                  <label className="field flex-1"><span>Rationale (shown to the approver)</span><input className="input w-full" value={edit.rationale} onChange={(e) => setEdit({ ...edit, rationale: e.target.value })} /></label>
                  <Btn kind="primary" onClick={propose} disabled={busy || !edit.rationale}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Propose (WF-18)</Btn><Btn onClick={() => setEdit(null)}>Cancel</Btn>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Hami computes the effect preview (which scheduled messages move, which cases are affected); the domain approver decides; the new version takes effect at once and is stamped on every later action.</p>
              </div>
            ) : null}
          </Panel>
        ) : (
          <Panel icon={<BookOpen size={16} />} title={tab === 'search' ? 'All clauses' : `${domain} clauses — what Dalil and the agents cite`} action={tab === 'search' ? <input className="input h-8" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /> : undefined}>
            <ul className="space-y-2">{clauses.map((c: any) => <li key={c.id} id={c.id} className={`rounded-xl border p-3 ${route.param === c.id ? 'border-accent/60 bg-accent/5' : 'border-border/60 bg-card/50'}`}><p className="flex flex-wrap items-center gap-2"><Chip tone="primary">{c.id}</Chip><span className="font-semibold">{c.heading}</span><span className="ar ms-auto text-[12px] text-muted-foreground">{c.heading_ar}</span></p><p className="mt-1 text-[13px] leading-relaxed">{c.text}</p><p className="ar mt-1 text-end text-[12px] leading-relaxed text-muted-foreground" dir="rtl">{c.text_ar}</p><p className="mt-1 text-[11px] text-muted-foreground">Basis: {c.basis} · {c.tags.map((t: string) => title(t)).join(', ')}</p></li>)}{!clauses.length ? <Empty>No clause matches.</Empty> : null}</ul>
          </Panel>
        )}
      </PageColumns>
    </Screen>
  );
}
