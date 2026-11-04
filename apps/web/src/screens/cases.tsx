/**
 * Cases — "Which cases need a nudge today, and who has each?" Lanes by where
 * a case waits (a date or the nightly check · the customer · a person · done),
 * each card the person, what stands in the way in words and its time bar;
 * the sixty days of the same lanes as a cumulative flow in the heading band,
 * where work piles up drawn in the warning tone. The case opens in the drawer
 * (the same decision card as the Inbox).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { WorkItemCard, WorkspaceLane, WorkspaceLanes, WorkspaceLayout } from '@cognirise/cognipulse/archetypes';
import { CumulativeFlow, TimeBar, flowBottleneck } from '@cognirise/cognipulse/viz';
import { CalendarClock, CheckCircle2, MessageSquare, UserRound } from 'lucide-react';
import { useApi } from '../lib/api';
import { date, num, rel, title } from '../lib/format';
import { useApp, useFlash } from '../app/state';
import { Chip, Empty, Hero, Screen, Select, CLASS_LABEL, PERSONA_SHORT, REASON_LABEL, SEG } from '../app/ui';
import { Notices } from '../app/viz';

type LaneId = 'date' | 'customer' | 'person' | 'done';
const LANES: { id: LaneId; label: string; caption: string; icon: ReactNode }[] = [
  { id: 'date', label: 'Waiting on a date', caption: 'A re-check, a cooling period or the nightly scan comes back to it.', icon: <CalendarClock size={15} /> },
  { id: 'customer', label: 'Waiting on the customer', caption: 'A notice is out; the next goes on its date unless they reply.', icon: <MessageSquare size={15} /> },
  { id: 'person', label: 'Waiting on a person', caption: 'A decision sits in someone\'s inbox; the soonest due first.', icon: <UserRound size={15} /> },
  { id: 'done', label: 'Done or handed on', caption: 'Cured, re-qualified, closed or with Collections; the latest first.', icon: <CheckCircle2 size={15} /> },
];

/** Late, due today, due in n days: the turnaround in words. */
const dueWord = (due: string | null | undefined, now: string): { word: string; tone?: 'danger' | 'warn' } => {
  if (!due) return { word: 'no date' };
  const days = Math.ceil((new Date(due).getTime() - new Date(now).getTime()) / 86400000);
  if (days < 0) return { word: `${-days} day${days === -1 ? '' : 's'} late`, tone: 'danger' };
  if (days === 0) return { word: 'due today', tone: 'warn' };
  return { word: `in ${days} day${days === 1 ? '' : 's'}` };
};

export function CasesScreen() {
  const { route, openCase, session } = useApp();
  const [q, setQ] = useState(''); const [cls, setCls] = useState(''); const [segment, setSegment] = useState(''); const [reason, setReason] = useState('');
  useEffect(() => { if (route.param && /^DEMO-CASE/i.test(route.param)) openCase(route.param.toUpperCase()); }, [route.param, openCase]);
  const qs = new URLSearchParams({ q, cls, segment, reason, size: '25' }).toString();
  const { data, error } = useApi<any>(`/cases/board?${qs}`, { poll: 12000 });
  const { data: reasons } = useApi<any>('/reasons');
  if (error) return <Empty>{error}</Empty>;
  const now: string = data?.now ?? session?.clock.now ?? new Date().toISOString();
  const lanes: Record<string, { n: number; rows: any[] }> = Object.fromEntries((data?.lanes ?? []).map((l: any) => [l.id, l]));
  const open = (['date', 'customer', 'person'] as LaneId[]).reduce((s, id) => s + (lanes[id]?.n ?? 0), 0);
  const states = LANES.map((l) => ({ id: l.id, label: l.label.replace('Waiting on ', 'on ').toLowerCase() }));
  const flow = data?.flow ?? [];
  const neck = flowBottleneck(states, flow, 14);
  const late = (lanes.person?.rows ?? []).filter((k) => k.sla_due && new Date(k.sla_due) < new Date(now)).length;
  const claim = !data ? 'Cases' : open
    ? `${num(lanes.person?.n ?? 0)} of ${num(open)} open cases wait on a person${late ? `; ${num(late)} of them are late` : ''}`
    : 'No open cases in your scope';
  const meta = !data ? undefined : open
    ? `${num(lanes.customer?.n ?? 0)} wait on the customer, ${num(lanes.date?.n ?? 0)} on a date or the nightly check${neck ? ` · in the last two weeks the cases ${neck.label} grew by ${num(neck.growth)}` : ''}`
    : 'The nightly scan opens a case for every customer who falls out of the offer and can be helped back in.';
  return (
    <Screen hero={<Hero eyebrow="Cases in your scope" title={claim} lede={meta} />}>
      <WorkspaceLayout
        header={flow.length > 1 ? (
          // The flow at its own size (its labels scale with its width), and beside it each lane today against two weeks ago.
          <div className="grid gap-x-6 gap-y-2 rounded-xl glass-l2 px-4 py-3 lg:grid-cols-[minmax(0,600px)_minmax(0,1fr)]">
            <div>
              <p className="text-[12px] text-muted-foreground">Open cases by where they waited, the last sixty days</p>
              <CumulativeFlow states={states} days={flow} height={130} format={(v) => num(v)} className="mt-1" />
            </div>
            <div className="self-center">
              <p className="text-[12px] text-muted-foreground">Today, against two weeks ago</p>
              <ul className="mt-2 space-y-1.5 text-[13px]">{states.map((st) => {
                const nowN = flow[flow.length - 1]?.counts[st.id] ?? 0; const then = flow[Math.max(0, flow.length - 15)]?.counts[st.id] ?? 0; const d = nowN - then;
                return <li key={st.id} className={`flex items-baseline gap-2 ${neck?.id === st.id ? 'text-warn' : ''}`}><span className="min-w-0 flex-1">{st.label.replace(/^./, (c: string) => c.toUpperCase())}</span><span className="tabular-nums font-medium">{num(nowN)}</span><span className="w-16 text-end tabular-nums text-[12px] text-muted-foreground">{d ? `${d > 0 ? '+' : '−'}${num(Math.abs(d))}` : 'same'}</span></li>;
              })}</ul>
              {neck ? <p className="mt-2 text-[12px] text-warn">Piling up: the cases {neck.label}</p> : null}
            </div>
          </div>
        ) : undefined}
        summary={
          <div className="flex flex-wrap items-center gap-2">
            <input className="input h-9 w-56" placeholder="Find a customer" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={cls} onChange={setCls} className="h-9"><option value="">Whatever stands in the way</option>{Object.entries(CLASS_LABEL).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Select>
            <Select value={reason} onChange={setReason} className="h-9"><option value="">Every reason</option>{(reasons?.reasons ?? []).map((r: any) => <option key={r.code} value={r.code}>{r.label}</option>)}</Select>
            <Select value={segment} onChange={setSegment} className="h-9"><option value="">Every segment</option><option value="VVIP">VVIP</option><option value="HNWI">HNWI</option><option value="HIGH_VALUE">High Value</option><option value="MASS">Mass</option></Select>
          </div>
        }>
        <WorkspaceLanes className="lg:grid-cols-4">
          {LANES.map((l) => {
            const lane = lanes[l.id]; const rows = lane?.rows ?? [];
            return (
              <WorkspaceLane key={l.id} icon={l.icon} title={l.label} count={lane?.n} caption={l.caption} tone={l.id === 'person' ? 'accent' : 'default'} emptyState={<p className="px-1 py-4 text-center text-[12px] text-muted-foreground">{data ? 'None.' : 'Loading…'}</p>}>
                {rows.length ? (
                  <div className="scroll-thin max-h-[calc(100dvh-25rem)] min-h-[12rem] space-y-2 overflow-y-auto pe-1">
                    {rows.map((k) => <CaseCard key={k.ref} k={k} lane={l.id} now={now} onOpen={() => openCase(k.ref)} />)}
                    {lane.n > rows.length ? <p className="px-1 pt-1 text-[11px] text-muted-foreground">and {num(lane.n - rows.length)} more; narrow the lane with the filters above</p> : null}
                  </div>
                ) : null}
              </WorkspaceLane>
            );
          })}
        </WorkspaceLanes>
      </WorkspaceLayout>
    </Screen>
  );
}

/** One case: the person, what stands in the way in words, whose move it is and its time bar. The case and the customer ids travel in the hover. */
function CaseCard({ k, lane, now, onOpen }: { k: any; lane: LaneId; now: string; onOpen: () => void }) {
  const flash = useFlash('cases', k.ref, true);
  const why = (k.reasons ?? []).map((r: string) => REASON_LABEL[r] ?? r);
  let state: ReactNode = null; let bar: ReactNode = null; let handler: ReactNode = null;
  if (lane === 'person') {
    const due = dueWord(k.sla_due, now);
    state = <Chip tone={due.tone}>{due.word}</Chip>;
    handler = <span className="text-[12px] text-muted-foreground">{PERSONA_SHORT[k.waiting_on] ?? 'A person'}</span>;
    if (k.sla_due) bar = <TimeBar start={k.waiting_since ?? k.updated_at} end={k.sla_due} today={now} compact className="w-full" />;
  } else if (lane === 'customer' || lane === 'date') {
    const at = k.next_action_at ?? k.recheck_on;
    const due = dueWord(at, now);
    state = at ? <Chip tone={due.tone}>{lane === 'customer' ? 'next notice ' : ''}{due.tone ? due.word : rel(at, now)}</Chip> : null;
    if (lane === 'customer' && k.max_attempts) handler = <span className="flex items-center gap-2 text-[12px] text-muted-foreground" title={`${k.attempts} of ${k.max_attempts} notices sent`}><Notices sent={k.attempts} max={k.max_attempts} />{k.attempts} of {k.max_attempts} notices</span>;
    if (lane === 'date') handler = <span className="text-[12px] text-muted-foreground">{k.paused ? 'paused by a person' : k.recheck_reason ? `re-check: ${String(k.recheck_reason).toLowerCase()}` : title(k.state).toLowerCase()}</span>;
    if (at && new Date(at) > new Date(k.updated_at ?? k.opened_at)) bar = <TimeBar start={k.updated_at ?? k.opened_at} end={at} today={now} compact className="w-full" />;
  } else {
    state = <span className="text-[11px] text-muted-foreground">{date(k.closed_at ?? k.updated_at)}</span>;
    handler = <span className="text-[12px] text-muted-foreground">{k.state === 'HANDED_OVER' ? 'with Collections' : k.state === 'REQUALIFIED' ? 're-qualified, the offer on its way' : (k.close_code ? title(k.close_code) : 'closed').toLowerCase()}</span>;
  }
  return (
    <div className={flash} title={`${k.ref} · ${k.customer_id}${k.edge_key ? ` · ${k.edge_key}` : ''}`}>
      <WorkItemCard onOpen={onOpen}
        reference={<span className="text-[11px] text-muted-foreground">{SEG[k.segment] ?? k.segment}</span>}
        state={state}
        title={<><span className="block">{k.name_en}</span><span className="mt-0.5 block text-[12px] font-normal text-muted-foreground">{why.slice(0, 2).join(' · ')}{why.length > 2 ? ` · ${why.length - 2} more` : ''}</span></>}
        handler={handler}
        meta={bar ? <div className="w-full">{bar}</div> : undefined} />
    </div>
  );
}
