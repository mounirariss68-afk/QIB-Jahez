/**
 * Overview — "How ready is the base tonight, and what would move it?"
 * The landing page of the Head of Retail Credit: the claim with one figure
 * beside it (offers handed to One Click), the base to the pre-approvable count
 * as a waterfall (a total and what takes customers out of it), the twenty
 * reasons as one sorted bar on one scale, and the eligible count scan by scan.
 * The Inbox, the employers and the segments are one click away (Inbox,
 * Employers, Data health), not repeated here (SCREEN-DISCIPLINE rules 1, 2, 5).
 */
import { Panel, PanelAction, PageColumns } from '@cognirise/cognipulse/layout';
import { Columns, Waterfall } from '@cognirise/cognipulse/viz';
import { BarChart3, Building2, TrendingUp } from 'lucide-react';
import { useApi } from '../lib/api';
import { num, pct, qarShort, dateShort } from '../lib/format';
import { useEffect, useState } from 'react';
import { useApp } from '../app/state';

/** The bars grow once, on mount. */
function useGrowOnce() { const [on, setOn] = useState(false); useEffect(() => { const t = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(t); }, []); return on; }
import { Empty, Hero, Screen } from '../app/ui';

/** The reasons in two words, for a title. */
const SHORT: Record<string, string> = { R01: 'Salary gaps', R02: 'unapproved employers', R03: 'exposure over the limit', R04: 'standing orders', R05: 'cautionary notes', R06: 'expired passports', R07: 'expired QIDs', R08: 'no current account' };

export function Overview() {
  const { data, error } = useApi<any>('/overview', { poll: 15000 });
  const { go } = useApp();
  const grow = useGrowOnce();
  if (error) return <Empty>{error}</Empty>;
  if (!data) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const h = data.health;
  const last = data.lastRun, prev = data.prevRun;
  const delta = last && prev ? last.eligible_count - prev.eligible_count : 0;
  const cls = (c: string) => (h.byClass as any[]).find((x) => x.cls === c)?.cases ?? 0;
  const curable = cls('A') + cls('B');
  const steps = [
    // Labels of sixteen characters at most: the waterfall cuts longer ones under a six-step bridge.
    { label: 'In arrears', value: -cls('D'), detail: 'at the collections boundary: no offer until cured and cooled' },
    { label: 'Out by policy', value: -cls('C'), detail: 'model, age, segment, rating or minimum amount' },
    { label: 'A decision away', value: -cls('B'), detail: 'a person inside the bank decides: an employer, a note' },
    { label: 'A document away', value: -cls('A'), detail: 'the customer sends one thing: a document, a declaration' },
  ];
  // A customer out with no class yet (the scan has not opened a case) is its own step, so the bridge ends on the pre-approvable count.
  const rest = h.customers + steps.reduce((s, x) => s + x.value, 0) - h.eligible;
  if (rest) steps.push({ label: 'Not yet classified', value: -rest, detail: 'out, no case opened yet' });
  const reasons = (h.byReason as any[]).filter((r) => r.incidences > 0).sort((a, b) => b.incidences - a.incidences);
  const maxInc = Math.max(1, ...reasons.map((r) => r.incidences));
  const topTwo = reasons.slice(0, 2);
  const topShare = Math.round(topTwo.reduce((s, r) => s + r.share, 0));
  const trend = (data.trend as any[]).slice(-12);
  const employer = (h.employers as any[]).find((e) => e.status !== 'APPROVED');
  return (
    <Screen hero={
      <Hero eyebrow="Readiness tonight"
        title={<>{num(h.eligible)} of {num(h.customers)} customers can be pre-approved tonight; {num(curable)} more are one document or one decision away</>}
        lede={<>{pct(h.eligibleRate)} against the 35% target{last ? <> · {delta >= 0 ? '+' : ''}{num(delta)} since the previous scan</> : null}</>}
        actions={
          <div className="rounded-xl glass-l3 px-4 py-2.5 text-end" title="Offers approved and handed to One Click Finance, in all">
            <p className="text-[12px] text-muted-foreground">Offers handed to One Click</p>
            <p className="text-xl font-semibold tabular-nums">{qarShort(data.today.offered)}</p>
          </div>
        } />}>
      <PageColumns aside={<>
        <Panel icon={<TrendingUp size={16} />} title={trend.length > 1 ? (() => { const d = trend[trend.length - 1].eligible_count - trend[0].eligible_count; return d ? `${num(Math.abs(d))} ${d > 0 ? 'more' : 'fewer'} eligible than on ${dateShort(trend[0].as_of).replace(/ \d{4}$/, '')}` : `As many eligible as on ${dateShort(trend[0].as_of).replace(/ \d{4}$/, '')}`; })() : 'Eligible count by scan'}>
          {/* The first and the last scan are named; the columns between keep a distinct, invisible label (Columns keys on it). */}
          <Columns points={trend.map((t, i) => ({ label: i === 0 || i === trend.length - 1 ? dateShort(t.as_of).replace(/ \d{4}$/, '') : '​'.repeat(i), value: t.eligible_count }))} height={120} format={(v) => `${num(v)} eligible`} />
          <p className="mt-1.5 text-[11px] text-muted-foreground">Every column is a scan of the whole base.</p>
        </Panel>
        {employer ? (
          <button type="button" onClick={() => go('employers', employer.id)} className="flex w-full items-center gap-3 rounded-xl glass-l2 px-4 py-3 text-start hover:border-primary/50">
            <Building2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 text-[13px] leading-snug">Approving <span className="font-medium">{employer.name ?? 'one employer'}</span> would free {num(employer.customers)} customers</span>
            <span className="text-[12px] text-primary">Employers</span>
          </button>
        ) : null}
      </>}>
        <Panel icon={<BarChart3 size={16} />} title={`From ${num(h.customers)} customers to ${num(h.eligible)} pre-approvable`} action={<PanelAction onClick={() => go('health')}>Data health</PanelAction>}>
          <Waterfall start={{ label: 'The base', value: h.customers }} steps={steps} end="Pre-approvable" good="up" format={(v) => num(v)} height={200} />
        </Panel>
        <Panel icon={<BarChart3 size={16} />} title={topTwo.length === 2 ? `${SHORT[topTwo[0].code] ?? topTwo[0].label} and ${SHORT[topTwo[1].code] ?? topTwo[1].label.toLowerCase()} cause ${topShare}% of the fall-outs` : 'Why customers fall out'}>
          <ul className="space-y-1.5">{reasons.map((r, i) => (
            <li key={r.code}>
              <button type="button" className="grid w-full grid-cols-[minmax(10rem,15rem)_1fr_4rem] items-center gap-3 text-start text-[13px] hover:text-primary" onClick={() => go('customers', `reason=${r.code}`)} title={`${r.code} · ${r.share}% of the reasons · list the customers`}>
                <span className="truncate">{r.label}</span>
                <span className="h-2.5 w-full overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: grow ? `${(r.incidences / maxInc) * 100}%` : '0%', transitionDelay: `${i * 25}ms` }} /></span>
                <span className="text-end font-mono text-[12px] tabular-nums">{num(r.incidences)}</span>
              </button>
            </li>))}</ul>
          <p className="mt-2 text-[11px] text-muted-foreground">A customer can carry several reasons: {num(h.multiReason.two)} carry two, {num(h.multiReason.threePlus)} three or more. Click a reason to list its customers.</p>
        </Panel>
      </PageColumns>
    </Screen>
  );
}
