/** Audit trail — "How do I know what it did?" Append-only; every entry with the actor, the autonomy rung, the policy version and the clause. */
import { useEffect, useState } from 'react';
import { Panel, StatRow, StatTile, PageColumns } from '@cognirise/atelier/layout';
import { ScrollText, Server } from 'lucide-react';
import { useApi } from '../lib/api';
import { dateTime, num, title } from '../lib/format';
import { useApp } from '../app/state';
import { TrailList } from '../app/case';
import { Btn, Chip, Empty, Hero, Screen, Select, Tabs, Table } from '../app/ui';

const parse = (p: string | null) => { const o: Record<string, string> = {}; if (!p) return o; for (const kv of p.split('&')) { const [k, v] = kv.split('='); o[k] = decodeURIComponent(v ?? ''); } return o; };

export function AuditScreen() {
  const { route } = useApp();
  const init = parse(route.param);
  const [tab, setTab] = useState('trail');
  const [q, setQ] = useState(''); const [customer, setCustomer] = useState(init.customer ?? ''); const [act, setAct] = useState(init.act ?? ''); const [actorType, setActorType] = useState(''); const [override, setOverride] = useState(false); const [page, setPage] = useState(0);
  useEffect(() => { const p = parse(route.param); setCustomer(p.customer ?? ''); setAct(p.act ?? ''); setPage(0); }, [route.param]);
  const qs = new URLSearchParams({ q, customer, act, actor_type: actorType, override: override ? '1' : '', page: String(page), limit: '80' }).toString();
  const { data, error } = useApi<any>(`/audit?${qs}`, { poll: 15000 });
  const { data: log } = useApi<any>(tab === 'integration' ? '/integration-log' : null, { poll: 15000 });
  if (error) return <Empty>{error}</Empty>;
  return (
    <Screen hero={<Hero eyebrow="Audit trail · append-only" title={<>{num(data?.total)} entries</>} lede="Every transition writes an entry: who (agent, person or system), at what autonomy, under which policy version and clause, with before and after for record writes, and the override reason when a person decided against an agent's recommendation. The integration log shows what Jahiz asked of the core bank, the channels and One Click, as those systems would see it." />} banner={false}>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'trail', label: 'Trail' }, { id: 'integration', label: 'Integration log' }]} />
      {tab === 'trail' ? (
        <>
          <StatRow>{(data?.byActor ?? []).slice(0, 4).map((a: any) => <StatTile key={`${a.actor_type}-${a.actor_name}`} label={a.actor_name} value={num(a.n)} state={<Chip>{a.actor_type.toLowerCase()}</Chip>} />)}</StatRow>
          <div className="flex flex-wrap items-center gap-2">
            <input className="input" placeholder="Search summaries, case refs, clauses" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /><input className="input" placeholder="Customer DEMO id" value={customer} onChange={(e) => { setCustomer(e.target.value.toUpperCase()); setPage(0); }} />
            <Select value={act} onChange={(v) => { setAct(v); setPage(0); }}><option value="">All acts</option>{(data?.byAct ?? []).map((a: any) => <option key={a.act} value={a.act}>{title(a.act)} ({a.n})</option>)}</Select>
            <Select value={actorType} onChange={(v) => { setActorType(v); setPage(0); }}><option value="">Agents, people, systems</option><option value="AGENT">Agents</option><option value="HUMAN">People</option><option value="SYSTEM">Systems</option></Select>
            <label className="flex items-center gap-1 text-[12px]"><input type="checkbox" checked={override} onChange={(e) => { setOverride(e.target.checked); setPage(0); }} />overrides only</label>
          </div>
          <Panel icon={<ScrollText size={16} />} title={`${num(data?.total ?? 0)} entries`} action={<span className="text-[12px] text-muted-foreground">page {page + 1}</span>}>
            <TrailList rows={data?.rows ?? []} />
            <div className="mt-3 flex items-center gap-2"><Btn small onClick={() => setPage((x) => Math.max(0, x - 1))} disabled={page === 0}>Previous</Btn><Btn small onClick={() => setPage((x) => x + 1)} disabled={(page + 1) * 80 >= (data?.total ?? 0)}>Next</Btn></div>
          </Panel>
        </>
      ) : (
        <PageColumns aside={<Panel icon={<Server size={16} />} title="Calls by system"><Table><thead><tr><th>System</th><th>Verb</th><th>Calls</th></tr></thead><tbody>{(log?.counts ?? []).map((c: any) => <tr key={`${c.system}${c.verb}`}><td><Chip>{c.system}</Chip></td><td className="font-mono text-[12px]">{c.verb}</td><td className="font-mono text-[12px]">{num(c.n)}</td></tr>)}</tbody></Table></Panel>}>
          <Panel icon={<Server size={16} />} title="Integration log — what Jahiz asked of the other systems">
            <Table><thead><tr><th>When</th><th>System</th><th>Call</th><th>Status</th><th>Note</th><th>ms</th><th>Actor</th></tr></thead><tbody>{(log?.rows ?? []).map((r: any) => <tr key={r.id}><td className="whitespace-nowrap font-mono text-[11px]">{dateTime(r.at)}</td><td><Chip tone={r.system === 'ANTHROPIC' ? 'primary' : r.system === 'ONECLICK' ? 'success' : undefined}>{r.system}</Chip></td><td className="font-mono text-[12px]">{r.direction === 'IN' ? '←' : '→'} {r.verb} {r.resource}</td><td className="font-mono text-[12px]">{r.status}</td><td className="text-[12px] text-muted-foreground">{r.note}</td><td className="font-mono text-[11px]">{r.ms ?? ''}</td><td className="text-[12px]">{r.actor}</td></tr>)}</tbody></Table>
          </Panel>
        </PageColumns>
      )}
    </Screen>
  );
}
