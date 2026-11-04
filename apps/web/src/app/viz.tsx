/**
 * Jahiz's pictures, on CogniPulse's viz library: the same picture wherever the
 * quantity appears (a list row, a decision card, the record, the Stage).
 *
 *   RuleDots       the twenty rules for one customer, a failing rule red and named under the strip
 *   SalaryColumns  twelve months of salary credits, a missing month an empty red column
 *   CaseClock      a span with today on it: since the document expired → the restriction day, or waiting → the turnaround
 *   Notices        notices sent out of the cadence (n of max)
 *   Confidence     a document's read confidence against the one-click threshold
 *   Headroom       an amount against its cap (DBR capacity, the exposure cap)
 */
import { Bullet, CapBar, Dots, TimeBar } from '@cognirise/cognipulse/viz';
import { qar } from '../lib/format';
import { REASON_LABEL } from './ui';

/**
 * The twenty rules as twenty segments, a failing rule in red and named under
 * the strip; the hover names each rule. CogniPulse's Segments has no failing
 * tone yet (a harvest for CogniPulse), so the strip is drawn here.
 */
export function RuleDots({ checks, names = true }: { checks: { code: string; pass: boolean; detail?: string }[]; names?: boolean }) {
  const sorted = [...checks].sort((a, b) => a.code.localeCompare(b.code));
  const fails = sorted.filter((c) => !c.pass);
  return (
    <div>
      <div className="flex gap-0.5">
        {sorted.map((c) => <div key={c.code} title={`${REASON_LABEL[c.code] ?? c.code}${c.pass ? '' : ' (fails)'}${c.detail ? ` · ${c.detail}` : ''}`} className={`h-1.5 flex-1 rounded-sm ${c.pass ? 'bg-primary' : 'bg-danger'}`} />)}
      </div>
      {names && fails.length ? <p className="mt-1.5 text-[12px] font-medium leading-snug text-danger">{fails.map((c) => REASON_LABEL[c.code] ?? c.code).join(' · ')}</p> : null}
    </div>
  );
}

/**
 * Twelve months of salary credits ending at `end` (the last full month, by
 * default the month before `now`). A month with no credit is drawn as an empty
 * red column at the usual height, so what is missing is the picture even when
 * the core holds no row for it. CogniPulse's Columns has no gap mark yet (a
 * harvest for CogniPulse), so this one is drawn here.
 */
export function SalaryColumns({ credits, now, end, height = 72, months = 12 }: { credits: { month: string; amount: number }[]; now?: string; end?: string; height?: number; months?: number }) {
  const map = new Map(credits.map((c) => [String(c.month).slice(0, 7), Number(c.amount)]));
  const anchor = end ?? (now ? prevMonth(String(now).slice(0, 7)) : [...map.keys()].sort().at(-1) ?? new Date().toISOString().slice(0, 7));
  const list: string[] = []; const d = new Date(`${anchor}-01T00:00:00Z`);
  for (let i = months - 1; i >= 0; i--) { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() - i); list.push(x.toISOString().slice(0, 7)); }
  const month = (m: string) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m.slice(5, 7)) - 1] ?? m;
  const paid = list.map((m) => map.get(m) ?? 0).filter((v) => v > 0).sort((a, b) => a - b);
  const max = Math.max(1, ...paid);
  const usual = paid.length ? paid[Math.floor(paid.length / 2)] : max;
  const bar = height - 18;
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {list.map((m) => {
        const v = map.get(m) ?? 0;
        return (
          <div key={m} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${month(m)} ${m.slice(0, 4)}: ${v ? qar(v) : 'no salary credit'}`}>
            {v
              ? <div className="viz-grow-y w-full rounded-t-sm bg-primary/70" style={{ height: `${(v / max) * bar}px` }} />
              : <div className="w-full rounded-t-sm border border-dashed border-danger bg-danger/10" style={{ height: `${(usual / max) * bar}px` }} />}
            <span className={`truncate text-[9px] ${v ? 'text-muted-foreground' : 'font-semibold text-danger'}`}>{month(m)}</span>
          </div>
        );
      })}
    </div>
  );
}
const prevMonth = (ym: string) => { const d = new Date(`${ym}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); };

/** A span with today on it: from `opened` to `hardAt` (by default the restriction day, 90 days on). */
export function CaseClock({ opened, now, hardAt, compact }: { opened: string; now: string; hardAt?: string | null; compact?: boolean }) {
  const due = hardAt ?? new Date(new Date(opened).getTime() + 90 * 86400000).toISOString();
  return <TimeBar start={opened} end={due} today={now} compact={compact} />;
}

/** Notices sent out of the cadence allowed for the segment. */
export function Notices({ sent, max }: { sent: number; max: number }) {
  return <Dots n={sent} of={Math.max(max, sent)} tone={sent >= max ? 'warn' : 'primary'} />;
}

/** A document's read confidence against the one-click threshold. */
export function Confidence({ value, threshold, compact }: { value: number | null; threshold: number; compact?: boolean }) {
  const v = value === null ? null : Math.round(value * 100);
  const target = Math.round(threshold * 100);
  return <Bullet value={v} target={target} min={50} max={100} alarm={v !== null && v < target} format={(x) => `${Math.round(x)}%`} compact={compact} />;
}

/** An amount against its cap: obligations against the DBR capacity, exposure against the policy cap. */
export function Headroom({ value, cap, compact }: { value: number; cap: number; compact?: boolean }) {
  return <CapBar used={value} cap={cap} format={(v) => qar(v)} compact={compact} />;
}
