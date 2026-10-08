/** Cases — the workspace: every remediation case in scope, by state and class; the drawer opens the reader. */
import { useEffect, useState } from 'react';
import { Panel, StatRow, StatTile } from '@cognirise/atelier/layout';
import { Briefcase } from 'lucide-react';
import { useApi } from '../lib/api';
import { date, num, rel, title } from '../lib/format';
import { useApp, useFlash } from '../app/state';
import { Btn, Chip, ClassChip, Empty, Hero, ReasonChip, Ref, Screen, SegChip, Select, StatusChip, Table, PERSONA_SHORT } from '../app/ui';

export function CasesScreen() {
  const { route, openCase, session } = useApp();
  const [q, setQ] = useState(''); const [state, setState] = useState(''); const [cls, setCls] = useState(''); const [segment, setSegment] = useState(''); const [open, setOpen] = useState('1'); const [page, setPage] = useState(0);
  useEffect(() => { if (route.param && /^DEMO-CASE/i.test(route.param)) openCase(route.param.toUpperCase()); }, [route.param, openCase]);
  const qs = new URLSearchParams({ q, state, cls, segment, open, page: String(page), size: '40' }).toString();
  const { data, error } = useApi<any>(`/cases?${qs}`, { poll: 12000 });
  const counts = (data?.counts ?? []) as { state: string; cls: string; n: number }[];
  const openN = counts.filter((c) => c.state !== 'CLOSED').reduce((s, c) => s + c.n, 0);
  const byState = Object.entries(counts.filter((c) => c.state !== 'CLOSED').reduce((m: Record<string, number>, c) => { m[c.state] = (m[c.state] ?? 0) + c.n; return m; }, {})).sort((a, b) => b[1] - a[1]);
  if (error) return <Empty>{error}</Empty>;
  return (
    <Screen hero={<Hero eyebrow="Cases · the workspace" title={<>{num(openN)} open cases in your scope</>} lede="One case per customer, classed A/B/C/D, with its workflow, attempts, next action and re-check date. States come from the domain's state machine; the drawer shows the runs, the steps, the documents, the messages and the trail." />}>
      <StatRow>{byState.slice(0, 4).map(([s, n]) => <StatTile key={s} label={title(s)} value={num(n)} />)}</StatRow>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input" placeholder="Case ref, customer, DEMO id" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <Select value={open} onChange={(v) => { setOpen(v); setPage(0); }}><option value="1">Open</option><option value="0">Closed</option><option value="">All</option></Select>
        <Select value={state} onChange={(v) => { setState(v); setPage(0); }}><option value="">All states</option>{byState.map(([s]) => <option key={s} value={s}>{title(s)}</option>)}{open !== '1' ? <option value="CLOSED">Closed</option> : null}</Select>
        <Select value={cls} onChange={(v) => { setCls(v); setPage(0); }}><option value="">All classes</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></Select>
        <Select value={segment} onChange={(v) => { setSegment(v); setPage(0); }}><option value="">All segments</option><option value="VVIP">VVIP</option><option value="HNWI">HNWI</option><option value="HIGH_VALUE">High Value</option><option value="MASS">Mass</option></Select>
      </div>
      <Panel icon={<Briefcase size={16} />} title={`${num(data?.total ?? 0)} cases`} action={<span className="text-[12px] text-muted-foreground">page {page + 1}</span>}>
        <Table><thead><tr><th>Case</th><th>Customer</th><th>Class</th><th>State</th><th>Reasons</th><th>Attempts</th><th>Waiting on</th><th>Next</th><th>Updated</th></tr></thead>
          <tbody>{(data?.rows ?? []).map((k: any) => <CaseRow key={k.id} k={k} now={session?.clock.now} onOpen={() => openCase(k.ref)} />)}</tbody></Table>
        {!data?.rows?.length ? <Empty>No cases match.</Empty> : null}
        <div className="mt-3 flex items-center gap-2"><Btn small onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Previous</Btn><Btn small onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * 40 >= (data?.total ?? 0)}>Next</Btn></div>
      </Panel>
    </Screen>
  );
}
function CaseRow({ k, now, onOpen }: { k: any; now?: string; onOpen: () => void }) {
  const flash = useFlash('cases', k.ref, true);
  return (
    <tr className={`clickable ${flash}`} onClick={onOpen}>
      <td><Ref>{k.ref}</Ref>{k.edge_key ? <Chip className="ms-1">{k.edge_key}</Chip> : null}</td>
      <td><span className="block text-sm">{k.name_en}</span><span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">{k.customer_id} <SegChip s={k.segment} /></span></td>
      <td><ClassChip cls={k.cls} /></td><td><StatusChip status={k.state} />{k.close_code ? <span className="block"><StatusChip status={k.close_code} /></span> : null}{k.paused ? <Chip tone="danger" className="ms-1">paused</Chip> : null}</td>
      <td><span className="flex flex-wrap gap-1">{k.reasons.map((r: string) => <ReasonChip key={r} code={r} />)}</span></td>
      <td className="font-mono text-[12px]">{k.max_attempts ? `${k.attempts}/${k.max_attempts}` : '—'}</td>
      <td className="text-[12px]">{k.waiting_on ? <Chip tone="warn">{PERSONA_SHORT[k.waiting_on]}</Chip> : k.waiting_event ? <Chip>{k.waiting_event === 'REPLY' ? 'the customer' : k.waiting_event.toLowerCase()}</Chip> : '—'}</td>
      <td className="text-[12px]">{k.next_action_at ? rel(k.next_action_at, now) : k.recheck_on ? `re-check ${date(k.recheck_on)}` : '—'}</td>
      <td className="text-[12px] text-muted-foreground">{rel(k.updated_at, now)}</td>
    </tr>
  );
}
