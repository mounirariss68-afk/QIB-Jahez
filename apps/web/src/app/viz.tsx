/**
 * Jahiz's pictures, on Atelier's viz library: the same picture wherever the
 * quantity appears (a list row, a decision card, the record, the Stage).
 *
 *   ReadinessBar   the base by what stands between a customer and the offer (the signature visual)
 *   RuleDots       the twenty rules for one customer, the failing ones marked
 *   SalaryColumns  twelve months of salary credits, a missing month drawn hollow
 *   CaseClock      a case's silence: first notice → the restriction date, today on it
 *   Notices        notices sent out of the cadence (n of max)
 *   Confidence     a document's read confidence against the one-click threshold
 *   Headroom       an amount against its cap (DBR capacity, the exposure cap)
 */
import { Bullet, CapBar, ClockBar, Columns, Dots, Segments, type Segment } from '@cognirise/atelier/viz';
import { num, qar } from '../lib/format';
import { REASON_LABEL } from './ui';

/** The 2,400 as parts: eligible tonight · curable by asking · curable by one decision inside the bank · out by policy · at the collections boundary. One hue for the degrees of readiness; grey and red for the states. */
export function ReadinessBar({ h, legend = true, height = 14, onHero }: { h: { customers: number; eligible: number; byClass: { cls: string; cases: number }[] }; legend?: boolean; height?: number; onHero?: boolean }) {
  const cls = (c: string) => h.byClass.find((x) => x.cls === c)?.cases ?? 0;
  // On the island hero the foreground is white, so the degrees of readiness are shades of white; on a card they are shades of the brand blue.
  const t = onHero ? (['fg', 'fg70', 'fg45', 'fg20'] as const) : (['primary', 'primary70', 'primary40', 'muted50'] as const);
  const segments: Segment[] = [
    { label: 'Pre-approvable tonight', value: h.eligible, tone: t[0] },
    { label: 'One document away', value: cls('A'), tone: t[1] },
    { label: 'One decision away', value: cls('B'), tone: t[2] },
    { label: 'Out by policy', value: cls('C'), tone: t[3] },
    { label: 'Collections boundary', value: cls('D'), tone: 'danger40' },
  ];
  return <Segments segments={segments} total={h.customers} legend={legend} format={(v) => num(v)} height={height} />;
}

/** The twenty rules as twenty dots, the failing ones in the status colour; hover names the rule. */
export function RuleDots({ checks, size = 12 }: { checks: { code: string; pass: boolean; detail?: string }[]; size?: number }) {
  const sorted = [...checks].sort((a, b) => a.code.localeCompare(b.code));
  return <Dots size={size} dots={sorted.map((c) => ({ label: `${REASON_LABEL[c.code] ?? c.code}: ${c.pass ? 'passes' : 'fails'}${c.detail ? ` · ${c.detail}` : ''}`, tone: c.pass ? 'primary' : 'danger', on: true }))} />;
}

/**
 * Twelve months of salary credits ending at `end` (the last full month, by
 * default the month before `now`); a month with no credit is a hollow column,
 * so the gap is the picture even when the core holds no row for it.
 */
export function SalaryColumns({ credits, now, end, height = 56, months = 12 }: { credits: { month: string; amount: number }[]; now?: string; end?: string; height?: number; months?: number }) {
  const map = new Map(credits.map((c) => [String(c.month).slice(0, 7), Number(c.amount)]));
  const anchor = end ?? (now ? prevMonth(String(now).slice(0, 7)) : [...map.keys()].sort().at(-1) ?? new Date().toISOString().slice(0, 7));
  const list: string[] = []; const d = new Date(`${anchor}-01T00:00:00Z`);
  for (let i = months - 1; i >= 0; i--) { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() - i); list.push(x.toISOString().slice(0, 7)); }
  const values = list.map((m) => map.get(m) ?? 0);
  const labels = list.map((m) => ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][Number(m.slice(5, 7)) - 1] ?? '');
  return <Columns values={values} labels={labels} height={height} format={(v) => qar(v)} hollow={(i) => !values[i]} />;
}
const prevMonth = (ym: string) => { const d = new Date(`${ym}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); };

/** A case's clock: from the first notice to the day the restriction may be proposed (T+90), today on it. */
export function CaseClock({ opened, now, hardAt, compact, label }: { opened: string; now: string; hardAt?: string | null; compact?: boolean; label?: string }) {
  const start = new Date(opened); const due = hardAt ? new Date(hardAt) : new Date(start.getTime() + 90 * 86400000);
  const days = Math.max(0, Math.round((new Date(now).getTime() - start.getTime()) / 86400000));
  return <ClockBar start={start} due={due} now={now} compact={compact} label={label ?? `${days} days since the first notice · restriction may be proposed at day 90`} />;
}

/** Notices sent out of the cadence allowed for the segment. */
export function Notices({ sent, max, size = 10 }: { sent: number; max: number; size?: number }) {
  return <Dots total={Math.max(max, sent)} on={sent} size={size} tone={sent >= max ? 'warn' : 'primary'} />;
}

/** A document's read confidence against the one-click threshold. */
export function Confidence({ value, threshold, compact }: { value: number | null; threshold: number; compact?: boolean }) {
  return <Bullet value={value === null ? null : Math.round(value * 100)} target={Math.round(threshold * 100)} min={50} max={100} label="Read confidence" format={(v) => `${Math.round(v)}%`} compact={compact} />;
}

/** An amount against its cap: obligations against the DBR capacity, exposure against the policy cap. */
export function Headroom({ value, cap, capLabel, compact }: { value: number; cap: number; capLabel?: string; compact?: boolean }) {
  return <CapBar value={value} cap={cap} capLabel={capLabel ?? `cap ${qar(cap)}`} format={(v) => qar(v)} compact={compact} />;
}
