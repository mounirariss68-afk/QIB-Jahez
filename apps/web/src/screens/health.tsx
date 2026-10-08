/** Data health — the monitoring dashboard: field-level completeness, expiries ahead, reasons, classes, contactability. */
import { Panel, PanelAction, StatRow, StatTile, PageColumns } from '@cognirise/atelier/layout';
import { BarChart3, CalendarClock, HeartPulse, Layers, Smartphone, Building2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '../lib/api';
import { num, pct } from '../lib/format';
import { useApp } from '../app/state';
import { Bar as Meter, Chip, ClassChip, Empty, Hero, Screen, SEG, Table, CLASS_LABEL } from '../app/ui';

export function HealthScreen() {
  const { data: h, error } = useApi<any>('/health', { poll: 20000 });
  const { data: reasons } = useApi<any>('/reasons');
  const { go, persona } = useApp();
  if (error) return <Empty>{error}</Empty>;
  if (!h) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const defs = Object.fromEntries((reasons?.reasons ?? []).map((r: any) => [r.code, r]));
  const can = !persona?.scope?.metricsOnly;
  return (
    <Screen hero={<Hero eyebrow="Data health · Raqib's view" title={<>{pct(h.eligibleRate)} pre-approvable · {num(h.fallouts)} fall-outs across {num(h.byReason.filter((r: any) => r.incidences > 0).length)} reasons</>} lede={<>Field-level health of the data One Click depends on, as of {h.asOf}. Every figure is derived by the same module the scan uses; no screen computes anything itself.</>} actions={<button type="button" className="pill-btn pill-btn-ghost" onClick={() => go('triggers')}>Run the scan now</button>} />}>
      <StatRow>
        <StatTile label="QID expiring ≤ 90 days" value={num(h.expiriesAhead.qid90)} state={<Chip>{num(h.expiriesAhead.qid30)} ≤ 30</Chip>} trend={{ direction: 'flat', label: 'pre-expiry watch opens WF-02', sentiment: 'neutral' }} />
        <StatTile label="Passport expiring ≤ 90 days" value={num(h.expiriesAhead.passport90)} state={<Chip>{num(h.expiriesAhead.passport30)} ≤ 30</Chip>} trend={{ direction: 'flat', label: 'residents · WF-03', sentiment: 'neutral' }} />
        <StatTile label="Marketing consent" value={pct((100 * h.contactability.marketingConsent) / Math.max(1, h.customers), 0)} trend={{ direction: 'flat', label: `${num(h.contactability.dnc)} on the do-not-contact list`, sentiment: 'neutral' }} />
        <StatTile label="App registered" value={pct((100 * h.contactability.appRegistered) / Math.max(1, h.customers), 0)} trend={{ direction: 'flat', label: `${num(h.contactability.contactable)} contactable by status`, sentiment: 'good' }} />
      </StatRow>
      <PageColumns aside={<>
        <Panel icon={<Layers size={16} />} title="Classes"><ul className="space-y-2">{h.byClass.map((c: any) => <li key={c.cls}><div className="flex items-center gap-2 text-sm"><ClassChip cls={c.cls} /><span className="flex-1">{CLASS_LABEL[c.cls]}</span><span className="font-mono text-[12px]">{num(c.cases)} · {pct(c.share, 0)}</span></div><Meter value={c.share} className="mt-1" tone={c.cls === 'A' ? 'primary' : c.cls === 'B' ? 'warn' : c.cls === 'D' ? 'danger' : 'accent'} /></li>)}</ul><p className="mt-2 text-[11px] text-muted-foreground">One reason or several: {num(h.multiReason.one)} carry one, {num(h.multiReason.two)} two, {num(h.multiReason.threePlus)} three or more.</p></Panel>
        <Panel icon={<Smartphone size={16} />} title="By segment"><Table><thead><tr><th>Segment</th><th>Customers</th><th>Eligible</th><th>Rate</th></tr></thead><tbody>{h.bySegment.map((s: any) => <tr key={s.segment} className={can ? 'clickable' : ''} onClick={() => can && go('customers', `segment=${s.segment}`)}><td>{SEG[s.segment]}</td><td className="font-mono">{num(s.customers)}</td><td className="font-mono">{num(s.eligible)}</td><td className="font-mono">{pct(s.rate)}</td></tr>)}</tbody></Table></Panel>
        <Panel icon={<Building2 size={16} />} title="Employers blocking customers" action={<PanelAction onClick={() => go('employers')}>Register</PanelAction>}><ul className="space-y-1 text-[13px]">{h.employers.slice(0, 8).map((e: any) => <li key={e.id} className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate">{e.name ?? e.id}</span><Chip tone={e.status === 'APPROVED' ? 'success' : 'warn'}>{e.status.toLowerCase().replace('_', ' ')}</Chip><span className="font-mono text-[12px]">{e.customers}</span></li>)}</ul></Panel>
      </>}>
        <Panel icon={<HeartPulse size={16} />} title="Field-level health">
          <Table><thead><tr><th>Field</th><th>Healthy</th><th style={{ width: 220 }}>Share</th><th>Note</th></tr></thead><tbody>{h.fields.map((f: any) => <tr key={f.field}><td className="text-sm">{f.label}</td><td className="font-mono text-[12px]">{num(f.healthy)} / {num(f.total)}</td><td><div className="flex items-center gap-2"><Meter value={f.pct} tone={f.pct >= 95 ? 'success' : f.pct >= 85 ? 'primary' : f.pct >= 70 ? 'warn' : 'danger'} className="flex-1" /><span className="w-12 text-end font-mono text-[12px]">{pct(f.pct, 0)}</span></div></td><td className="text-[12px] text-muted-foreground">{f.note}</td></tr>)}</tbody></Table>
        </Panel>
        <Panel icon={<BarChart3 size={16} />} title="The twenty reasons, in QIB's rank order">
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={h.byReason} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.15} /><XAxis dataKey="code" tick={{ fontSize: 10, fontFamily: 'ui-monospace, monospace' }} interval={0} /><YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} formatter={(v: any, _n: any, p: any) => [`${v} (${p.payload.share}%)`, `${p.payload.code} ${p.payload.label} · class ${p.payload.cls}`]} />
                <Bar dataKey="incidences" radius={[6, 6, 0, 0]} cursor={can ? 'pointer' : undefined} onClick={(d: any) => can && go('customers', `reason=${d.code}`)}>{h.byReason.map((r: any) => <Cell key={r.code} fill={r.cls === 'A' ? 'var(--color-primary)' : r.cls === 'B' ? 'var(--color-accent)' : r.cls === 'D' ? 'var(--color-danger)' : 'var(--color-muted-foreground)'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Table className="mt-2"><thead><tr><th>#</th><th>Reason</th><th>Class</th><th>Customers</th><th>Share</th><th>What cures it</th><th>Re-check</th></tr></thead><tbody>{h.byReason.map((r: any) => <tr key={r.code} className={can ? 'clickable' : ''} onClick={() => can && go('customers', `reason=${r.code}`)}><td className="font-mono text-[12px]">{r.rank}</td><td className="text-sm"><span className="font-mono text-[11px] text-muted-foreground">{r.code}</span> {r.label}</td><td><ClassChip cls={r.cls} /></td><td className="font-mono">{num(r.incidences)}</td><td className="font-mono text-[12px]">{pct(r.share)}</td><td className="text-[12px] text-muted-foreground">{defs[r.code]?.evidence}</td><td className="text-[12px] text-muted-foreground">{defs[r.code]?.recheck}</td></tr>)}</tbody></Table>
        </Panel>
        <Panel icon={<CalendarClock size={16} />} title="What the scan does with each class"><div className="grid gap-3 sm:grid-cols-2 text-[13px]"><p><ClassChip cls="A" /> Munadi asks the customer for one thing (document, declaration, acceptance) inside the segment's contact policy; Fahis reads the reply; a checker approves; Muhaddith writes; Muahil re-qualifies.</p><p><ClassChip cls="B" /> A person inside the bank decides: Compliance on a cautionary note, Credit Policy on an employer or on consolidation. No customer contact until then.</p><p><ClassChip cls="C" /> Not eligible by policy (model, age, nationality, segment, rating, minimum amount): suppressed, re-checked on the event or date that could change it, visible to Credit, Compliance and the Head.</p><p><ClassChip cls="D" /> Arrears and conduct: early reminders inside POL-05, hand-off to Collections at the DPD limit, cooling period after the cure; no offers meanwhile.</p></div></Panel>
      </PageColumns>
    </Screen>
  );
}
