/**
 * Cases — "Which cases need a nudge today?" A masthead with the count and
 * the state most of them are in, four tiles, and rows that say who, why (in
 * words), what happens next (a clock) and how many chances the customer has
 * had (dots). The drawer opens the same decision card as the Inbox.
 */
import { useEffect, useState } from 'react';
import { Panel, StatTile } from '@cognirise/atelier/layout';
import { ClockBar } from '@cognirise/atelier/viz';
import { Briefcase } from 'lucide-react';
import { useApi } from '../lib/api';
import { date, num, rel, title } from '../lib/format';
import { useApp, useFlash } from '../app/state';
import { Btn, Chip, ClassWord, Empty, Masthead, ReasonChip, Screen, SegChip, Select, StatusChip, Table, CLASS_LABEL, PERSONA_SHORT } from '../app/ui';
import { Notices } from '../app/viz';

export function CasesScreen() {
  const { route, openCase, session } = useApp();
  const [q, setQ] = useState(''); const [state, setState] = useState(''); const [cls, setCls] = useState(''); const [segment, setSegment] = useState(''); const [open, setOpen] = useState('1'); const [page, setPage] = useState(0);
  useEffect(() => { if (route.param && /^DEMO-CASE/i.test(route.param)) openCase(route.param.toUpperCase()); }, [route.param, openCase]);
  const qs = new URLSearchParams({ q, state, cls, segment, open, page: String(page), size: '40' }).toString();
  const { data, error } = useApi<any>(`/cases?${qs}`, { poll: 12000 });
  const counts = (data?.counts ?? []) as { state: string; cls: string; n: number }[];
  const openN = counts.filter((c) => c.state !== 'CLOSED').reduce((s, c) => s + c.n, 0);
  const byState = Object.entries(counts.filter((c) => c.state !== 'CLOSED').reduce((m: Record<string, number>, c) => { m[c.state] = (m[c.state] ?? 0) + c.n; return m; }, {})).sort((a, b) => b[1] - a[1]);
  const now: string | undefined = data?.now ?? session?.clock.now;
  const due: number = data?.due ?? 0, onPerson: number = data?.onPerson ?? 0;
  if (error) return <Empty>{error}</Empty>;
  return (
    <Screen hero={<Masthead eyebrow="Cases · in your scope" title={openN ? `${num(openN)} open cases in your scope; ${due ? `${num(due)} ${due === 1 ? 'is' : 'are'} due a step now` : 'none is due a step right now'}` : 'No open cases in your scope'} meta={openN ? `${num(onPerson)} wait on a person's decision · the rest wait on the customer, a re-check date or the nightly scan · open a case for the decision and the proof behind it` : 'The nightly scan opens a case for every customer who falls out of the offer and can be helped back in.'} />}>
      <div className="rounded-xl glass-l2 p-3"><div className="grid gap-3 sm:grid-cols-4">{byState.slice(0, 4).map(([s, n]) => <StatTile key={s} label={title(s)} value={num(n)} />)}</div></div>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input" placeholder="Name or case" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <Select value={open} onChange={(v) => { setOpen(v); setPage(0); }}><option value="1">Open</option><option value="0">Closed</option><option value="">All</option></Select>
        <Select value={state} onChange={(v) => { setState(v); setPage(0); }}><option value="">Every state</option>{byState.map(([s]) => <option key={s} value={s}>{title(s)}</option>)}{open !== '1' ? <option value="CLOSED">Closed</option> : null}</Select>
        <Select value={cls} onChange={(v) => { setCls(v); setPage(0); }}><option value="">Whatever stands in the way</option>{Object.entries(CLASS_LABEL).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Select>
        <Select value={segment} onChange={(v) => { setSegment(v); setPage(0); }}><option value="">Every segment</option><option value="VVIP">VVIP</option><option value="HNWI">HNWI</option><option value="HIGH_VALUE">High Value</option><option value="MASS">Mass</option></Select>
      </div>
      <Panel icon={<Briefcase size={16} />} title={`${num(data?.total ?? 0)} match`} action={<span className="text-[12px] text-muted-foreground">page {page + 1}</span>}>
        <Table><thead><tr><th>Customer</th><th>What stands in the way</th><th>What to do</th><th>State</th><th>Notices</th><th>Next step</th><th>Waiting on</th></tr></thead>
          <tbody>{(data?.rows ?? []).map((k: any) => <CaseRow key={k.id} k={k} now={now} onOpen={() => openCase(k.ref)} />)}</tbody></Table>
        {!data?.rows?.length ? <Empty>No cases match.</Empty> : null}
        <div className="mt-3 flex items-center gap-2"><Btn small onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Previous</Btn><Btn small onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * 40 >= (data?.total ?? 0)}>Next</Btn></div>
      </Panel>
    </Screen>
  );
}
function CaseRow({ k, now, onOpen }: { k: any; now?: string; onOpen: () => void }) {
  const flash = useFlash('cases', k.ref, true);
  return (
    <tr className={`clickable ${flash}`} onClick={onOpen} title={`${k.ref}${k.edge_key ? ` · ${k.edge_key}` : ''}`}>
      <td><span className="block text-sm">{k.name_en}</span><span className="flex items-center gap-1 text-[11px] text-muted-foreground"><SegChip s={k.segment} /></span></td>
      <td><span className="flex flex-wrap gap-1">{k.reasons.map((r: string) => <ReasonChip key={r} code={r} />)}</span></td>
      <td className="text-[12px]"><ClassWord cls={k.cls} /></td>
      <td><StatusChip status={k.state} />{k.close_code ? <span className="block"><StatusChip status={k.close_code} /></span> : null}{k.paused && k.state !== 'PAUSED' ? <Chip tone="danger" className="ms-1">paused</Chip> : null}</td>
      <td>{k.max_attempts && (k.cls === 'A' || k.attempts > 0) ? <span className="block" title={`${k.attempts} of ${k.max_attempts} notices sent`}><Notices sent={k.attempts} max={k.max_attempts} size={8} /></span> : <span className="text-[12px] text-muted-foreground">—</span>}</td>
      <td className="min-w-[9rem] text-[12px]">{k.next_action_at && !['CLOSED', 'HANDED_OVER', 'REQUALIFIED'].includes(k.state) ? <><ClockBar start={k.updated_at ?? k.opened_at} due={k.next_action_at} now={now} compact /><span className="mt-1 block text-muted-foreground">{now && new Date(k.next_action_at) < new Date(now) ? 'due ' : ''}{rel(k.next_action_at, now)}</span></> : k.recheck_on ? `re-check ${date(k.recheck_on)}` : <span className="text-muted-foreground">—</span>}</td>
      <td className="text-[12px]">{k.waiting_on ? <Chip tone="warn">{PERSONA_SHORT[k.waiting_on]}</Chip> : k.waiting_event ? <span className="text-muted-foreground">{k.waiting_event === 'REPLY' ? 'the customer' : k.waiting_event.toLowerCase()}</span> : <span className="text-muted-foreground">—</span>}</td>
    </tr>
  );
}
