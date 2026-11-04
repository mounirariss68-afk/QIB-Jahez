/**
 * Data health — "Which fields drag the eligible rate, and how much renewal work
 * is coming?" The Data Steward's screen: the fields by segment as a heatmap of
 * what is missing (the worst cell named in the heading), each field's share
 * healthy across the base, and the documents expiring month by month with the
 * 90-day watch marked. The reasons and the segments are behind their tabs; the
 * classes are on the Overview (each fact once).
 */
import { useState } from 'react';
import { Panel, PageColumns } from '@cognirise/cognipulse/layout';
import { Columns, Heatmap } from '@cognirise/cognipulse/viz';
import { CalendarClock, HeartPulse, Grid3x3 } from 'lucide-react';
import { useApi } from '../lib/api';
import { num, pct } from '../lib/format';
import { useApp } from '../app/state';
import { Bar as Meter, Empty, Hero, Screen, SEG, Table, Tabs, CLASS_LABEL } from '../app/ui';

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SEGS = ['VVIP', 'HNWI', 'HIGH_VALUE', 'MASS'];

export function HealthScreen() {
  const { data: h, error } = useApi<any>('/health', { poll: 20000 });
  const { data: reasons } = useApi<any>('/reasons');
  const { go, persona } = useApp();
  const [tab, setTab] = useState('fields');
  if (error) return <Empty>{error}</Empty>;
  if (!h) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const defs = Object.fromEntries((reasons?.reasons ?? []).map((r: any) => [r.code, r]));
  const can = !persona?.scope?.metricsOnly;
  const fields: any[] = h.fields;
  const label = Object.fromEntries(fields.map((f) => [f.field, f.label]));
  const bySeg: any[] = h.fieldsBySegment ?? [];
  // The heatmap draws what is missing, so the darkest cell — outlined — is the worst.
  const values = bySeg.map((f) => SEGS.map((s) => (f.bySegment[s] == null ? null : Math.round(10 * (100 - f.bySegment[s])) / 10)));
  let worst: { field: string; seg: string; v: number } | null = null;
  bySeg.forEach((f, i) => SEGS.forEach((s, j) => { const v = values[i][j]; if (v != null && (!worst || v > worst.v)) worst = { field: f.field, seg: s, v }; }));
  const w = worst as { field: string; seg: string; v: number } | null;
  const weakest = fields.slice().sort((a, b) => a.pct - b.pct)[0];
  const months: any[] = h.expiriesByMonth ?? [];
  const watch = h.expiriesAhead.qid90 + h.expiriesAhead.passport90;
  return (
    <Screen hero={<Hero eyebrow="Data health"
      title={<>{weakest ? <>{weakest.label} is the weakest field, {pct(weakest.pct, 0)} healthy; </> : null}{watch ? `${num(watch)} document${watch === 1 ? '' : 's'} expire${watch === 1 ? 's' : ''} in the next 90 days` : 'no document expires in the next 90 days'}</>}
      lede={<>{pct(h.eligibleRate)} of {num(h.customers)} customers pre-approvable as of {h.asOf}; {num(h.fallouts)} fall out. Computed by the same module the nightly scan runs.</>}
      actions={<button type="button" className="pill-btn pill-btn-ghost" onClick={() => go('triggers')}>Run the scan now</button>} />}>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'fields', label: 'Fields' }, { id: 'reasons', label: 'The twenty reasons' }, { id: 'segments', label: 'Segments' }]} />
      {tab === 'fields' ? (
        <PageColumns aside={
          <Panel icon={<CalendarClock size={16} />} title={(() => { const q = h.expiriesAhead.qid90, p = h.expiriesAhead.passport90; const part = (n: number, one: string, many: string) => `${num(n)} ${n === 1 ? one : many}`; return q + p ? `${[q ? part(q, 'QID', 'QIDs') : null, p ? part(p, 'passport', 'passports') : null].filter(Boolean).join(' and ')} expire${q + p === 1 ? 's' : ''} inside the 90-day watch` : 'No QID or passport expires inside the 90-day watch'; })()}>
            <Columns points={months.map((m) => ({ label: MONTH[Number(m.month.slice(5, 7)) - 1] ?? m.month, value: m.qid + m.passport }))} height={120} format={(v) => `${num(v)} documents`} />
            <div className="mt-1 flex text-[11px]"><span className="w-1/2 border-t-2 border-warn pt-1 text-center text-warn">the 90-day watch: the agents ask before expiry</span></div>
            <p className="mt-2 text-[11px] text-muted-foreground">QIDs and residents' passports, by the month they expire. {num(h.expiriesAhead.qid30 + h.expiriesAhead.passport30)} expire within 30 days.</p>
          </Panel>}>
          <Panel icon={<Grid3x3 size={16} />} title={w ? `${label[w.field] ?? w.field} is the gap: ${pct(100 - w.v, 0)} healthy among ${SEG[w.seg] ?? w.seg} customers` : 'What is missing, by field and segment'}>
            <Heatmap rows={bySeg.map((f) => label[f.field] ?? f.field)} cols={SEGS.map((s) => SEG[s] ?? s)} values={values} format={(v) => `${Math.round(v)}% missing`} />
            <p className="mt-1 text-[11px] text-muted-foreground">The darker the cell, the more customers in that segment lack the field; the worst is outlined.</p>
          </Panel>
          <Panel icon={<HeartPulse size={16} />} title="Each field across the base">
            <Table><thead><tr><th>Field</th><th>Healthy</th><th style={{ width: 240 }}>Share</th><th>Note</th></tr></thead><tbody>{fields.map((f) => <tr key={f.field}><td className="text-sm">{f.label}</td><td className="font-mono text-[12px]">{num(f.healthy)} / {num(f.total)}</td><td><div className="flex items-center gap-2"><Meter value={f.pct} tone={f.pct >= 95 ? 'success' : f.pct >= 85 ? 'primary' : f.pct >= 70 ? 'warn' : 'danger'} className="flex-1" /><span className="w-12 text-end font-mono text-[12px]">{pct(f.pct, 0)}</span></div></td><td className="text-[12px] text-muted-foreground">{f.note.replace(/\s*\((?:POL|SEG|CH|REF|DATA)-[^)]*\)/g, '')}</td></tr>)}</tbody></Table>
          </Panel>
        </PageColumns>
      ) : tab === 'reasons' ? (
        <Panel icon={<HeartPulse size={16} />} title={`${num(h.fallouts)} customers fall out, for ${num(h.byReason.filter((r: any) => r.incidences > 0).length)} of the twenty reasons`}>
          <Table><thead><tr><th>#</th><th>Reason</th><th>What it takes</th><th>Customers</th><th>Share</th><th>What cures it</th><th>Re-check</th></tr></thead><tbody>{h.byReason.map((r: any) => <tr key={r.code} className={can ? 'clickable' : ''} onClick={() => can && go('customers', `reason=${r.code}`)} title={r.code}><td className="font-mono text-[12px]">{r.rank}</td><td className="text-sm">{r.label}</td><td className="text-[12px] text-muted-foreground">{CLASS_LABEL[r.cls]?.toLowerCase()}</td><td className="font-mono">{num(r.incidences)}</td><td className="font-mono text-[12px]">{pct(r.share)}</td><td className="text-[12px] text-muted-foreground">{defs[r.code]?.evidence}</td><td className="text-[12px] text-muted-foreground">{defs[r.code]?.recheck}</td></tr>)}</tbody></Table>
        </Panel>
      ) : (
        <Panel icon={<HeartPulse size={16} />} title="Readiness by segment">
          <Table><thead><tr><th>Segment</th><th>Customers</th><th>Eligible</th><th style={{ width: 240 }}>Rate</th></tr></thead><tbody>{h.bySegment.map((s: any) => <tr key={s.segment} className={can ? 'clickable' : ''} onClick={() => can && go('customers', `segment=${s.segment}`)}><td>{SEG[s.segment]}</td><td className="font-mono">{num(s.customers)}</td><td className="font-mono">{num(s.eligible)}</td><td><div className="flex items-center gap-2"><Meter value={s.rate} className="flex-1" /><span className="w-12 text-end font-mono text-[12px]">{pct(s.rate)}</span></div></td></tr>)}</tbody></Table>
          <p className="mt-2 text-[11px] text-muted-foreground">Contactability: {num(h.contactability.contactable)} contactable by status, {num(h.contactability.dnc)} on the do-not-contact list.</p>
        </Panel>
      )}
    </Screen>
  );
}
