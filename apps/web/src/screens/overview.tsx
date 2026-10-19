/** Overview — "Where do we stand on One Click readiness?" */
import { Panel, PanelAction, StatRow, StatTile, PageColumns } from '@cognirise/atelier/layout';
import { Activity, BarChart3, Building2, Clock, Layers, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '../lib/api';
import { num, pct, qarShort, rel, title, dateShort } from '../lib/format';
import { useApp } from '../app/state';
import { AgentTag, Chip, ClassChip, Clause, Empty, Hero, Screen, SEG, PERSONA_SHORT, CLASS_LABEL, Table, Ref, TABS_OVERVIEW } from '../app/ui';

const C = { primary: 'var(--color-primary)', accent: 'var(--color-accent)', muted: 'var(--color-muted-foreground)' };

export function Overview() {
  const { data, error } = useApi<any>('/overview', { poll: 15000 });
  const { go, open, session, persona } = useApp();
  if (error) return <Empty>{error}</Empty>;
  if (!data) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const h = data.health;
  const last = data.lastRun, prev = data.prevRun;
  const delta = last && prev ? last.eligible_count - prev.eligible_count : 0;
  const reasons = h.byReason.filter((r: any) => r.incidences > 0);
  const funnel = (data.funnel as any[]);
  const openCases = funnel.filter((f) => f.state !== 'CLOSED').reduce((s, f) => s + f.n, 0);
  const cured = funnel.filter((f) => f.close_code === 'CURED').reduce((s, f) => s + f.n, 0);
  const curable = h.curable.classA + h.curable.classB;
  return (
    <Screen hero={<Hero eyebrow="One Click Finance · pre-approval readiness" title={<>{pct(h.eligibleRate)} of {num(h.customers)} customers are pre-approvable today</>} lede={<>{num(h.fallouts)} fall out; {num(curable)} of them ({pct((100 * curable) / Math.max(1, h.fallouts), 0)}) are curable — {num(h.curable.classA)} by asking the customer, {num(h.curable.classB)} by a decision inside the bank.</>}
      actions={<div className="flex flex-wrap gap-2"><button type="button" className="pill-btn pill-btn-primary" onClick={() => go('scenarios')}>Run a scenario</button><button type="button" className="pill-btn pill-btn-ghost" onClick={() => go('inbox')}>What is waiting on me{session?.inbox ? ` (${session.inbox})` : ''}</button></div>}
      feature={<div className="rounded-2xl border border-border/60 bg-card/60 p-4 text-sm"><p className="eyebrow">Last scan</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{num(last?.eligible_count)} <span className="text-base font-medium text-muted-foreground">eligible</span></p><p className="text-[12px] text-muted-foreground">{last ? `${last.trigger} · ${dateShort(last.as_of)} · ${delta >= 0 ? '+' : ''}${delta} vs the previous scan` : '—'}</p></div>} />} tabs={TABS_OVERVIEW}>
      <StatRow>
        <StatTile label="Eligible rate" value={pct(h.eligibleRate)} state={<Chip>target 35%</Chip>} trend={{ direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat', label: `${delta >= 0 ? '+' : ''}${delta} since the previous scan`, sentiment: delta > 0 ? 'good' : delta < 0 ? 'bad' : 'neutral' }} />
        <StatTile label="Open cases" value={num(openCases)} trend={{ direction: 'flat', label: `${num(cured)} cured so far · ${num(data.today.cured)} today`, sentiment: 'good' }} />
        <StatTile label="Today's outreach" value={`${num(data.today.sent)} sent`} trend={{ direction: 'flat', label: `${num(data.today.due)} due · ${num(data.today.inbound)} inbound`, sentiment: 'neutral' }} />
        <StatTile label="Offers handed off" value={qarShort(data.today.offered)} trend={{ direction: 'up', label: `${num(data.today.updates)} record updates applied today`, sentiment: 'good' }} />
      </StatRow>
      <PageColumns aside={<>
        <Panel icon={<Clock size={16} />} title="Waiting on people" action={<PanelAction onClick={() => go('inbox')}>Inbox</PanelAction>}>
          <ul className="space-y-1.5 text-sm">{(data.waiting as any[]).sort((a, b) => b.n - a.n).map((w) => <li key={w.persona} className="flex items-center justify-between"><span>{PERSONA_SHORT[w.persona] ?? w.persona}</span><span className="font-mono text-[12px]">{w.n}</span></li>)}</ul>
          <p className="mt-2 text-[11px] text-muted-foreground">Every record write and every restriction is a person's decision (POL-06). The agents prepare.</p>
        </Panel>
        <Panel icon={<Building2 size={16} />} title="Employers blocking the most customers" action={<PanelAction onClick={() => go('employers')}>Employers</PanelAction>}>
          <ul className="space-y-1.5 text-sm">{h.employers.slice(0, 6).map((e: any) => <li key={e.id} className="flex items-center gap-2"><button type="button" className="min-w-0 flex-1 truncate text-start hover:text-primary" onClick={() => go('employers', e.id)}>{e.name ?? e.id}</button><Chip tone={e.status === 'APPROVED' ? 'success' : 'warn'}>{title(e.status)}</Chip><span className="font-mono text-[12px]">{e.customers}</span></li>)}{!h.employers.length ? <li className="text-muted-foreground">None.</li> : null}</ul>
        </Panel>
        <Panel icon={<Activity size={16} />} title="Activity" action={<PanelAction onClick={() => go('audit')}>Audit trail</PanelAction>}>
          <ul className="space-y-2 text-[12px]">{(data.activity as any[]).slice(0, 8).map((a) => <li key={a.id} className="border-s-2 border-border/70 ps-2"><p className="flex flex-wrap items-center gap-1.5 text-muted-foreground"><span className="font-mono">{rel(a.at, session?.clock.now)}</span>{a.agent ? <AgentTag id={a.agent} showChip={false} size={16} /> : null}{a.clause ? <Clause id={a.clause} onClick={(id) => go('policies', id.split(' ')[0])} /> : null}</p><p>{a.action}</p><p className="text-muted-foreground">→ {a.result}</p>{a.case_ref ? <button type="button" className="font-mono text-primary" onClick={() => open(`case:${a.case_ref}`)}>{a.case_ref}</button> : null}</li>)}</ul>
        </Panel>
      </>}>
        <Panel icon={<BarChart3 size={16} />} title="Why customers fall out — the twenty reasons in QIB's rank order" action={<PanelAction onClick={() => go('health')}>Data health</PanelAction>}>
          <div style={{ height: Math.max(260, reasons.length * 22) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reasons} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} strokeOpacity={0.15} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke={C.muted} />
                <YAxis type="category" dataKey="code" width={44} tick={{ fontSize: 11, fontFamily: 'ui-monospace, monospace' }} stroke={C.muted} />
                <Tooltip formatter={(v: any, _n: any, p: any) => [`${v} customers · ${p.payload.share}% of incidences`, `${p.payload.code} ${p.payload.label} · class ${p.payload.cls}`]} contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                <Bar dataKey="incidences" fill={C.primary} radius={[0, 6, 6, 0]} onClick={(d: any) => go('customers', `reason=${d.code}`)} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">A customer can carry several reasons: {num(h.multiReason.two)} carry two, {num(h.multiReason.threePlus)} three or more. Click a bar to list the customers.</p>
        </Panel>
        <div className="grid gap-4 md:grid-cols-2">
          <Panel icon={<Layers size={16} />} title="By class — what it takes to cure">
            <ul className="space-y-2">{h.byClass.map((c: any) => <li key={c.cls}><div className="flex items-center gap-2 text-sm"><ClassChip cls={c.cls} /><span className="flex-1">{CLASS_LABEL[c.cls]}</span><span className="font-mono text-[12px]">{num(c.cases)} · {pct(c.share, 0)}</span></div><div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${c.share}%` }} /></div></li>)}</ul>
            <Table className="mt-3"><thead><tr><th>Segment</th><th>Customers</th><th>Eligible</th><th>Rate</th></tr></thead><tbody>{h.bySegment.map((s: any) => <tr key={s.segment} className="clickable" onClick={() => go('customers', `segment=${s.segment}`)}><td>{SEG[s.segment]}</td><td className="font-mono">{num(s.customers)}</td><td className="font-mono">{num(s.eligible)}</td><td className="font-mono">{pct(s.rate)}</td></tr>)}</tbody></Table>
          </Panel>
          <Panel icon={<TrendingUp size={16} />} title="Eligible count by scan">
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={(data.trend as any[]).map((t) => ({ d: dateShort(t.as_of), eligible: t.eligible_count, rate: Math.round((1000 * t.eligible_count) / Math.max(1, t.customers_checked)) / 10 }))} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
                  <CartesianGrid strokeOpacity={0.15} vertical={false} /><XAxis dataKey="d" tick={{ fontSize: 11 }} stroke={C.muted} /><YAxis tick={{ fontSize: 11 }} stroke={C.muted} domain={['dataMin - 20', 'dataMax + 20']} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                  <Line type="monotone" dataKey="eligible" stroke={C.primary} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground">Every point is a real scan: the sixty days of history were replayed through the engine.</p>
          </Panel>
        </div>
        <Panel icon={<Activity size={16} />} title="The agents, in one line each" action={<PanelAction onClick={() => go('agents')}>Team</PanelAction>}>
          <div className="grid gap-2 sm:grid-cols-2 text-[12px]">
            {[['raqib', 'scans the base nightly and opens one case per customer, classed A/B/C/D'], ['munadi', 'plans and sends the notices inside the window, one channel per attempt'], ['hami', 'checks every outbound message against POL-01/05/07/09 and blocks with the clause'], ['mustaqbil', 'reads every reply and upload and routes it'], ['fahis', 'reads the document and proposes the update with its confidence'], ['muhaddith', 'writes the approved update to the record through the connector'], ['muwathiq', 'builds the employer approval pack for Credit Policy'], ['muahil', 're-qualifies after every change and hands eligible customers to One Click'], ['munabbih', 'sends early-arrears reminders inside POL-05 and stops at the boundary'], ['dalil', 'answers from the same database, cites the clause, prepares actions']].map(([id, what]) => <p key={id} className="flex items-start gap-2"><AgentTag id={id} showChip={false} size={18} /><span className="text-muted-foreground">{what}</span></p>)}
          </div>
          {persona?.key === 'steward' ? <p className="mt-2 text-[11px] text-muted-foreground">As Data Steward you see metrics and rules; drill-downs show <Ref>DEMO-</Ref> ids only, never a record.</p> : null}
        </Panel>
      </PageColumns>
    </Screen>
  );
}
