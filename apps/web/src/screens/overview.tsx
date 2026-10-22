/**
 * Overview — "How ready is the base tonight, and what will move it?"
 * The landing page of those who run the base. One hero carrying the
 * readiness bar (the signature visual), three figures, the twenty reasons as
 * bars in the person's words, the eligible count scan by scan, and the
 * employers one approval would free. The inbox, the agents and the
 * governance line are not here: the Inbox, How it works and the closing card
 * carry them (SCREEN-DISCIPLINE rules 1, 2, 5).
 */
import { Panel, PanelAction, StatTile, PageColumns } from '@cognirise/atelier/layout';
import { Columns, Dots, useGrow } from '@cognirise/atelier/viz';
import { BarChart3, Building2, TrendingUp } from 'lucide-react';
import { useApi } from '../lib/api';
import { num, pct, qarShort, dateShort } from '../lib/format';
import { useApp } from '../app/state';
import { Chip, Empty, LandingHero, Screen, SEG, Table } from '../app/ui';
import { ReadinessBar } from '../app/viz';

/** The reasons in two words, for a title. */
const SHORT: Record<string, string> = { R01: 'Salary gaps', R02: 'unapproved employers', R03: 'exposure over the limit', R04: 'standing orders', R05: 'cautionary notes', R06: 'expired passports', R07: 'expired QIDs', R08: 'no current account' };

export function Overview() {
  const { data, error } = useApi<any>('/overview', { poll: 15000 });
  const { go, session } = useApp();
  const grow = useGrow();
  if (error) return <Empty>{error}</Empty>;
  if (!data) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const h = data.health;
  const last = data.lastRun, prev = data.prevRun;
  const delta = last && prev ? last.eligible_count - prev.eligible_count : 0;
  const reasons = (h.byReason as any[]).filter((r) => r.incidences > 0);
  const maxInc = Math.max(1, ...reasons.map((r) => r.incidences));
  const topTwo = reasons.slice().sort((a, b) => b.incidences - a.incidences).slice(0, 2);
  const topShare = Math.round(topTwo.reduce((s, r) => s + r.share, 0));
  const funnel = (data.funnel as any[]);
  const openCases = funnel.filter((f) => f.state !== 'CLOSED').reduce((s, f) => s + f.n, 0);
  const cured = funnel.filter((f) => f.close_code === 'CURED').reduce((s, f) => s + f.n, 0);
  const curable = h.curable.classA + h.curable.classB;
  const trend = (data.trend as any[]).slice(-12);
  const employers = (h.employers as any[]).slice(0, 6);
  return (
    <Screen hero={
      <LandingHero eyebrow="One Click Finance · readiness tonight"
        title={<>Tonight {num(h.eligible)} of {num(h.customers)} customers can be pre-approved, and {num(curable)} more are one document or one decision away</>}
        meta={<>{pct(h.eligibleRate)} against the 35% target · {num(h.curable.classA)} need one document from the customer, {num(h.curable.classB)} one decision inside the bank · {num(h.fallouts - curable)} are out by policy or at the collections boundary</>}
        actions={<><button type="button" className="pill-btn pill-btn-primary" onClick={() => go('inbox')}>What is waiting on me{session?.inbox ? ` (${session.inbox})` : ''}</button><button type="button" className="pill-btn pill-btn-ghost" onClick={() => go('health')}>Data health</button></>}>
        <ReadinessBar h={h} onHero />
      </LandingHero>}>
      <div className="rounded-xl glass-l2 p-3"><div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Open cases" value={num(openCases)} trend={{ direction: 'flat', label: `${num(cured)} cured so far · ${num(data.today.cured)} today`, sentiment: 'good' }} />
        <StatTile label="Outreach today" value={`${num(data.today.sent)} sent`} trend={{ direction: 'flat', label: `${num(data.today.due)} due · ${num(data.today.inbound)} inbound`, sentiment: 'neutral' }} />
        <StatTile label="Offers handed to One Click" value={qarShort(data.today.offered)} trend={{ direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat', label: last ? `${delta >= 0 ? '+' : ''}${delta} eligible since the previous scan` : '—', sentiment: delta > 0 ? 'good' : delta < 0 ? 'bad' : 'neutral' }} />
      </div></div>
      <PageColumns aside={<>
        <Panel icon={<Building2 size={16} />} title={employers.length ? `One approval would free ${num(employers[0].customers)} customers` : 'No employer is blocking customers'} action={<PanelAction onClick={() => go('employers')}>Employers</PanelAction>}>
          <ul className="space-y-2.5 text-sm">{employers.map((e: any) => (
            <li key={e.id}>
              <button type="button" className="flex w-full items-center gap-2 text-start hover:text-primary" onClick={() => go('employers', e.id)}><span className="min-w-0 flex-1 truncate">{e.name ?? e.id}</span><span className="text-[11px] text-muted-foreground">{e.status === 'APPROVED' ? 'approved' : e.status === 'UNDER_REVIEW' ? 'under review' : 'not approved'}</span><span className="font-mono text-[12px]">{e.customers}</span></button>
              <Dots total={e.customers} on={e.customers} size={7} tone={e.status === 'APPROVED' ? 'primary40' : 'primary'} className="mt-1" />
            </li>))}</ul>
        </Panel>
        <Panel icon={<TrendingUp size={16} />} title={trend.length > 1 ? `${num(trend[trend.length - 1].eligible_count - trend[0].eligible_count) } more eligible since ${dateShort(trend[0].as_of)}` : 'Eligible count by scan'}>
          <Columns values={trend.map((t) => t.eligible_count)} labels={trend.map((t) => dateShort(t.as_of).replace(/ \d{4}$/, ''))} height={96} format={(v) => `${num(v)} eligible`} markLast />
          <p className="mt-1.5 text-[11px] text-muted-foreground">Every column is a real scan of the whole base.</p>
        </Panel>
      </>}>
        <Panel icon={<BarChart3 size={16} />} title={topTwo.length === 2 ? `${SHORT[topTwo[0].code] ?? topTwo[0].label} and ${SHORT[topTwo[1].code] ?? topTwo[1].label.toLowerCase()} cause ${topShare}% of the fall-outs` : 'Why customers fall out'} action={<PanelAction onClick={() => go('health')}>Data health</PanelAction>}>
          <ul className="space-y-1.5">{reasons.map((r, i) => (
            <li key={r.code}>
              <button type="button" className="grid w-full grid-cols-[minmax(10rem,14rem)_1fr_4rem] items-center gap-3 text-start text-[13px] hover:text-primary" onClick={() => go('customers', `reason=${r.code}`)} title={`${r.code} · class ${r.cls} · ${r.share}% of incidences`}>
                <span className="truncate">{r.label}</span>
                <span className="h-2.5 w-full overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: grow ? `${(r.incidences / maxInc) * 100}%` : '0%', transitionDelay: `${i * 25}ms` }} /></span>
                <span className="text-end font-mono text-[12px] tabular-nums">{num(r.incidences)}</span>
              </button>
            </li>))}</ul>
          <p className="mt-2 text-[11px] text-muted-foreground">In QIB's rank order. A customer can carry several reasons: {num(h.multiReason.two)} carry two, {num(h.multiReason.threePlus)} three or more. Click a reason to list the customers.</p>
        </Panel>
        <Panel icon={<BarChart3 size={16} />} title={(() => { const best = (h.bySegment as any[]).slice().sort((a, b) => b.rate - a.rate)[0]; return best ? `${SEG[best.segment] ?? best.segment} customers are the readiest, at ${pct(best.rate)}` : 'Readiness by segment'; })()}>
          <Table><thead><tr><th>Segment</th><th>Customers</th><th>Eligible</th><th>Rate</th></tr></thead><tbody>{h.bySegment.map((s: any) => <tr key={s.segment} className="clickable" onClick={() => go('customers', `segment=${s.segment}`)}><td>{SEG[s.segment]}</td><td className="font-mono">{num(s.customers)}</td><td className="font-mono">{num(s.eligible)}</td><td><span className="flex items-center gap-2"><span className="h-2 w-24 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${s.rate}%` }} /></span><span className="font-mono text-[12px]">{pct(s.rate)}</span></span></td></tr>)}</tbody></Table>
          <p className="mt-2 text-[11px] text-muted-foreground"><Chip>synthetic base</Chip> 2,400 customers in QIB's segment mix; every figure is computed by the same module the nightly scan runs.</p>
        </Panel>
      </PageColumns>
    </Screen>
  );
}
