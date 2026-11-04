/**
 * Audit trail — "Who did what, under which rule, and where did a person
 * overrule an agent?" Append-only. The heading says how many entries and how
 * many overrides; the one picture is the entries per day with the overrides
 * marked; overrides are a filter of their own. The integration log is a tab.
 */
import { useEffect, useState } from 'react';
import { Panel, PageColumns } from '@cognirise/cognipulse/layout';
import { ScrollText, Server } from 'lucide-react';
import { useApi } from '../lib/api';
import { dateTime, num, title } from '../lib/format';
import { useApp } from '../app/state';
import { TrailList } from '../app/case';
import { Btn, Chip, Empty, Hero, Screen, Select, Tabs, Table } from '../app/ui';

const parse = (p: string | null) => { const o: Record<string, string> = {}; if (!p) return o; for (const kv of p.split('&')) { const [k, v] = kv.split('='); o[k] = decodeURIComponent(v ?? ''); } return o; };
const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Entries per day as columns; the part a person overrode an agent in red, so the overrides are the first thing seen. */
function DayColumns({ days, height = 96 }: { days: { d: string; n: number; overrides: number }[]; height?: number }) {
  const max = Math.max(1, ...days.map((x) => x.n));
  const bar = height - 18;
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {days.map((x, i) => (
        <div key={x.d} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${dayLabel(x.d)}: ${num(x.n)} entries${x.overrides ? `, ${x.overrides} overridden by a person` : ''}`}>
          <div className="viz-grow-y flex w-full flex-col justify-end overflow-hidden rounded-t-sm bg-primary/55" style={{ height: `${Math.max(2, (x.n / max) * bar)}px` }}>
            {x.overrides ? <div className="w-full bg-danger" style={{ height: `${Math.max(3, (x.overrides / max) * bar)}px` }} /> : null}
          </div>
          <span className="h-3 truncate text-[9px] text-muted-foreground">{i % 5 === 0 || i === days.length - 1 ? dayLabel(x.d) : ''}</span>
        </div>
      ))}
    </div>
  );
}

export function AuditScreen() {
  const { route } = useApp();
  const init = parse(route.param);
  const [tab, setTab] = useState('trail');
  const [q, setQ] = useState(''); const [customer, setCustomer] = useState(init.customer ?? ''); const [act, setAct] = useState(init.act ?? ''); const [actorType, setActorType] = useState(''); const [override, setOverride] = useState(false); const [page, setPage] = useState(0);
  useEffect(() => { const p = parse(route.param); setCustomer(p.customer ?? ''); setAct(p.act ?? ''); setPage(0); }, [route.param]);
  const qs = new URLSearchParams({ q, customer, act, actor_type: actorType, override: override ? '1' : '', page: String(page), limit: '60' }).toString();
  const { data, error } = useApi<any>(`/audit?${qs}`, { poll: 15000 });
  const { data: log } = useApi<any>(tab === 'integration' ? '/integration-log' : null, { poll: 15000 });
  if (error) return <Empty>{error}</Empty>;
  const days: any[] = data?.byDay ?? [];
  const month = days.reduce((s, x) => s + x.n, 0);
  const filtered = !!(q || customer || act || actorType || override);
  return (
    <Screen hero={<Hero eyebrow="How it works · Audit trail" title={data ? `${num(data.byActor?.reduce((s: number, a: any) => s + a.n, 0) ?? data.total)} entries on the trail; ${data.overrides ? `a person overrode an agent ${num(data.overrides)} time${data.overrides === 1 ? '' : 's'}` : 'no person has overridden an agent yet'}` : 'The audit trail'} lede="Append-only. Every entry names who acted, at what rung, under which policy version and clause, with before and after for every write to the record." />}>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'trail', label: 'The trail' }, { id: 'integration', label: 'Calls to other systems' }]} />
      {tab === 'trail' ? (
        <>
          {days.length ? (
            <Panel icon={<ScrollText size={16} />} title={`${num(month)} entries in the last thirty days`} action={<span className="flex items-center gap-3 text-[12px] text-muted-foreground"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary/55" />entries</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-danger" />a person overrode an agent</span></span>}>
              <DayColumns days={days} />
            </Panel>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <input className="input h-9 w-72" placeholder="Search what happened, a customer or a clause" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
            <Select className="h-9" value={actorType} onChange={(v) => { setActorType(v); setPage(0); }}><option value="">Agents, people and systems</option><option value="AGENT">Agents</option><option value="HUMAN">People</option><option value="SYSTEM">Systems</option></Select>
            <Select className="h-9" value={act} onChange={(v) => { setAct(v); setPage(0); }}><option value="">Every kind of act</option>{(data?.byAct ?? []).map((a: any) => <option key={a.act} value={a.act}>{title(a.act)} ({num(a.n)})</option>)}</Select>
            <button type="button" onClick={() => { setOverride((o) => !o); setPage(0); }} className={`rounded-full border px-3.5 py-1.5 text-sm ${override ? 'border-danger bg-danger/10 text-danger' : 'border-border text-muted-foreground hover:text-foreground'}`}>Overrides only</button>
            {customer ? <button type="button" className="text-[12px] text-primary" onClick={() => setCustomer('')} title={customer}>Every customer</button> : null}
          </div>
          <Panel title={filtered ? `${num(data?.total ?? 0)} entries match` : 'The latest first'} action={<span className="text-[12px] text-muted-foreground">page {page + 1}</span>}>
            <TrailList rows={data?.rows ?? []} />
            <div className="mt-3 flex items-center gap-2"><Btn small onClick={() => setPage((x) => Math.max(0, x - 1))} disabled={page === 0}>Previous</Btn><Btn small onClick={() => setPage((x) => x + 1)} disabled={(page + 1) * 60 >= (data?.total ?? 0)}>Next</Btn></div>
          </Panel>
        </>
      ) : (
        <PageColumns aside={<Panel icon={<Server size={16} />} title="Calls by system"><Table><thead><tr><th>System</th><th>Call</th><th>Calls</th></tr></thead><tbody>{(log?.counts ?? []).map((c: any) => <tr key={`${c.system}${c.verb}`}><td><Chip>{c.system}</Chip></td><td className="font-mono text-[12px]">{c.verb}</td><td className="text-[12px] tabular-nums">{num(c.n)}</td></tr>)}</tbody></Table></Panel>}>
          <Panel icon={<Server size={16} />} title="What Jahiz asked of the other systems">
            <Table><thead><tr><th>When</th><th>System</th><th>Call</th><th>Status</th><th>Note</th></tr></thead><tbody>{(log?.rows ?? []).map((r: any) => <tr key={r.id} title={`${r.ms ?? '—'} ms · ${r.actor ?? ''}`}><td className="whitespace-nowrap text-[12px]">{dateTime(r.at)}</td><td><Chip tone={r.system === 'ANTHROPIC' ? 'primary' : r.system === 'ONECLICK' ? 'success' : undefined}>{r.system}</Chip></td><td className="font-mono text-[12px]">{r.direction === 'IN' ? '←' : '→'} {r.verb} {r.resource}</td><td className="font-mono text-[12px]">{r.status}</td><td className="text-[12px] text-muted-foreground">{r.note}</td></tr>)}</tbody></Table>
          </Panel>
        </PageColumns>
      )}
    </Screen>
  );
}
