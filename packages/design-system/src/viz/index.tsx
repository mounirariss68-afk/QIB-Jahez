/**
 * Atelier viz — the pictures a decision turns on, built once and drawn the
 * same way wherever the quantity appears: a list row, a decision card, a
 * record, the Stage's third pane.
 *
 * The form follows the question, not the data type (FT Visual Vocabulary);
 * position on a common scale before length, angle, area or colour (Cleveland
 * & McGill); a measure against a target is a bullet (Few); one hue for a
 * quantity, status colours for a state; a ring only for one ratio against one
 * limit, alone on its tile. Marks enter once, under a second, and never loop;
 * every figure a picture shows is also in a label or a title, so colour
 * never carries meaning alone. Off under prefers-reduced-motion.
 *
 *   ClockBar    a span with today on it: opened → due, amber past 75%, red when overdue
 *   Segments    parts of a whole, with a legend (a balance, a base by class, severities)
 *   CapBar      an amount against a limit, the limit marked, the excess red
 *   Bullet      a measure against a target on one scale
 *   RangeBar    a value inside a range, markers on the track
 *   Dots        a few units, the ones that count filled (rules failing, customers waiting)
 *   Columns     a short series, the last or a missing one marked
 *   Progress    done out of total
 *   Ring        one ratio against one limit
 *   Slope       before → after, the change as a line
 *   Waterfall   a total made of signed parts
 *   Funnel      stages, each narrower than the last
 *   HeatCells   a grid of cells toned by value (field × segment, month × client)
 *   CoverStrip  people as rows, days as columns
 *   YearHeatmap a year of days, weeks as columns
 *
 * First written for Tasama HR and Δ Force (21 Oct 2026); lifted here when
 * QIB Jahiz became the third prototype to need it.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '../lib/utils';

/** One hue for a quantity (primary and its shades), status colours for a state, the chart series for named categories. */
export type Tone = 'primary' | 'primary70' | 'primary40' | 'primary20' | 'accent' | 'success' | 'warn' | 'danger' | 'danger40' | 'muted' | 'muted50' | 'fg' | 'fg70' | 'fg45' | 'fg20' | 'chart1' | 'chart2' | 'chart3' | 'chart4' | 'chart5';
export const BG: Record<Tone, string> = {
  primary: 'bg-primary', primary70: 'bg-primary/70', primary40: 'bg-primary/40', primary20: 'bg-primary/20', accent: 'bg-accent', success: 'bg-success', warn: 'bg-warn', danger: 'bg-danger', danger40: 'bg-danger/40',
  muted: 'bg-muted-foreground/25', muted50: 'bg-muted-foreground/50', fg: 'bg-foreground', fg70: 'bg-foreground/70', fg45: 'bg-foreground/45', fg20: 'bg-foreground/20',
  chart1: 'bg-chart-1', chart2: 'bg-chart-2', chart3: 'bg-chart-3', chart4: 'bg-chart-4', chart5: 'bg-chart-5',
};
const pct = (v: number, max: number) => `${Math.max(0, Math.min(100, (v / (max || 1)) * 100))}%`;

/** Marks grow in once, on first paint. Respects reduced motion. */
export function useGrow() {
  const [on, setOn] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);
  return on;
}
const GROW = 'transition-[width,height] duration-700 ease-out motion-reduce:transition-none';

/**
 * A span with today on it. `now` is the clock the app runs on (a demo's
 * virtual clock); `compact` is the 4px version for list rows. `marks` are
 * named points on the span (a T+90 line, a review date).
 */
export function ClockBar({ start, due, now, compact, label, marks }: { start: string | Date; due: string | Date | null | undefined; now?: string | Date; compact?: boolean; label?: ReactNode; marks?: { at: string | Date; label: string }[] }) {
  const on = useGrow();
  if (!due) return null;
  const s = new Date(start).getTime(), d = new Date(due).getTime(), n = now ? new Date(now).getTime() : Date.now();
  const span = Math.max(1, d - s);
  const used = (n - s) / span;
  const over = n > d;
  const tone = over ? 'bg-danger' : used > 0.75 ? 'bg-warn' : 'bg-primary';
  return (
    <div className="w-full" title={typeof label === 'string' ? label : undefined}>
      <div className={cn('relative w-full rounded-full bg-muted', compact ? 'h-1' : 'h-2')}>
        <div className={cn('h-full rounded-full', tone, GROW)} style={{ width: on ? (over ? '100%' : pct(n - s, span)) : '0%' }} />
        {marks?.map((m) => <div key={m.label} title={m.label} className="absolute -inset-y-1 w-0.5 rounded bg-foreground/60" style={{ insetInlineStart: pct(new Date(m.at).getTime() - s, span) }} />)}
      </div>
      {label && !compact ? <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">{label}</div> : null}
    </div>
  );
}

export type Segment = { label: string; value: number; tone: Tone; hatch?: boolean; hollow?: boolean };

/** Parts of a whole, with a 2px gap between parts and a legend under it. */
export function Segments({ segments, total, legend = true, format = (v: number) => String(v), height = 10, className }: { segments: Segment[]; total?: number; legend?: boolean; format?: (v: number) => string; height?: number; className?: string }) {
  const sum = total ?? segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  const on = useGrow();
  return (
    <div className={cn('w-full', className)}>
      <div className="flex w-full gap-[2px] overflow-hidden rounded-full bg-foreground/10" style={{ height }}>
        {segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.label} title={`${s.label}: ${format(s.value)}`} className={cn('h-full first:rounded-s-full last:rounded-e-full', s.hollow ? 'border border-current bg-transparent' : BG[s.tone], s.hatch && 'bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgba(255,255,255,.55)_3px_6px)]', GROW)} style={{ width: on ? pct(s.value, sum) : '0%' }} />
        ))}
      </div>
      {legend ? (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {segments.map((s) => <span key={s.label} className="inline-flex items-center gap-1"><span className={cn('h-2 w-2 rounded-sm', s.hollow ? 'border border-current' : BG[s.tone])} />{s.label} <span className="font-medium text-foreground">{format(s.value)}</span></span>)}
        </div>
      ) : null}
    </div>
  );
}
/** Kept for apps written against the first name. */
export const SegmentBar = Segments;

/** An amount against a limit. The limit is a line; the part beyond it is red. */
export function CapBar({ value, cap, max, capLabel, tone = 'primary', format = (v: number) => String(v), compact }: { value: number; cap: number; max?: number; capLabel?: string; tone?: Tone; format?: (v: number) => string; compact?: boolean }) {
  const top = Math.max(max ?? 0, cap * 1.15, value * 1.05, 1);
  const within = Math.min(value, cap), beyond = Math.max(0, value - cap);
  const on = useGrow();
  return (
    <div className="w-full">
      <div className={cn('relative w-full rounded-full bg-muted', compact ? 'h-1.5' : 'h-2.5')}>
        <div className={cn('absolute inset-y-0 start-0 rounded-s-full', BG[tone], !beyond && 'rounded-e-full', GROW)} style={{ width: on ? pct(within, top) : '0%' }} title={format(value)} />
        {beyond ? <div className="absolute inset-y-0 rounded-e-full bg-danger" style={{ insetInlineStart: pct(cap, top), width: pct(beyond, top) }} /> : null}
        <div className="absolute -inset-y-1 w-0.5 rounded bg-foreground/70" style={{ insetInlineStart: pct(cap, top) }} title={capLabel} />
      </div>
      {capLabel && !compact ? <div className="relative mt-1 h-4 text-[11px] text-muted-foreground"><span className="absolute -translate-x-1/2 whitespace-nowrap rtl:translate-x-1/2" style={{ insetInlineStart: pct(cap, top) }}>{capLabel}</span></div> : null}
    </div>
  );
}

/**
 * A bullet: the measure as a bar, the target as a tick, on one scale from
 * `min` to `max`. `higherIsBetter` decides the tone. Values are in the
 * quantity's own unit (a percentage, a confidence, days); `format` labels them.
 */
export function Bullet({ value, target, min = 0, max = 100, higherIsBetter = true, label, format = (v: number) => String(v), compact }: { value: number | null; target: number; min?: number; max?: number; higherIsBetter?: boolean; label?: string; format?: (v: number) => string; compact?: boolean }) {
  const on = useGrow();
  if (value === null || value === undefined) return <span className="text-[11px] text-muted-foreground">—</span>;
  const good = higherIsBetter ? value >= target : value <= target;
  const near = Math.abs(value - target) <= (max - min) * 0.05;
  const tone = good ? 'bg-success' : near ? 'bg-warn' : 'bg-danger';
  const at = (v: number) => pct(v - min, max - min);
  return (
    <div className={cn('relative w-full rounded-sm bg-muted', compact ? 'h-2' : 'h-3')} title={`${label ?? ''} ${format(value)} (target ${format(target)})`.trim()}>
      <div className={cn('absolute inset-y-[3px] start-0 rounded-sm', tone, GROW)} style={{ width: on ? at(value) : '0%' }} />
      <div className="absolute -inset-y-0.5 w-0.5 bg-foreground/80" style={{ insetInlineStart: at(target) }} />
    </div>
  );
}

export type Marker = { value: number; label: string; tone: Tone };

/** A value inside a range: the track is min–max, markers sit on it. */
export function RangeBar({ min, max, markers, format = (v: number) => String(v) }: { min: number; max: number; markers: Marker[]; format?: (v: number) => string }) {
  const lo = Math.min(min, ...markers.map((m) => m.value)), hi = Math.max(max, ...markers.map((m) => m.value));
  const pad = (hi - lo) * 0.06 || 1;
  const a = lo - pad, b = hi + pad;
  const at = (v: number) => pct(v - a, b - a);
  return (
    <div className="w-full pt-1">
      <div className="relative h-2.5 w-full rounded-full bg-muted">
        <div className="absolute inset-y-0 rounded-full bg-primary/20" style={{ insetInlineStart: at(min), width: pct(max - min, b - a) }} />
        {markers.map((m) => <div key={m.label} title={`${m.label}: ${format(m.value)}`} className={cn('absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card rtl:translate-x-1/2', BG[m.tone])} style={{ insetInlineStart: at(m.value) }} />)}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground"><span>{format(min)}</span><span>{format(max)}</span></div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {markers.map((m) => <span key={m.label} className="inline-flex items-center gap-1"><span className={cn('h-2 w-2 rounded-full', BG[m.tone])} />{m.label} <span className="font-medium text-foreground">{format(m.value)}</span></span>)}
      </div>
    </div>
  );
}

export type Dot = { label: string; tone?: Tone; on?: boolean };

/**
 * A few units as dots: the ones that count filled, popping in one after
 * another. `dots` carries a label per unit for the hover; a plain count is
 * `{ total, on }`.
 */
export function Dots({ dots, total, on: filled, tone = 'primary', offTone = 'muted', size = 10, className }: { dots?: Dot[]; total?: number; on?: number; tone?: Tone; offTone?: Tone; size?: number; className?: string }) {
  const grow = useGrow();
  const list: Dot[] = dots ?? Array.from({ length: total ?? 0 }, (_, i) => ({ label: `${i + 1} of ${total}`, on: i < (filled ?? 0) }));
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {list.map((d, i) => <span key={i} title={d.label} className={cn('inline-block rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none', d.on === false ? BG[offTone] : BG[d.tone ?? tone])} style={{ width: size, height: size, transform: grow ? 'scale(1)' : 'scale(0.4)', transitionDelay: `${Math.min(i * 25, 600)}ms` }} />)}
    </div>
  );
}

/** A short series as columns; the last one can be marked, a missing one drawn hollow. */
export function Columns({ values, labels, height = 64, tone = 'primary', format = (v: number) => String(v), markLast, hollow, reference }: { values: number[]; labels?: string[]; height?: number; tone?: Tone; format?: (v: number) => string; markLast?: boolean; hollow?: (i: number) => boolean; reference?: number }) {
  const max = Math.max(1, reference ?? 0, ...values);
  const on = useGrow();
  return (
    <div className="w-full">
      <div className="relative flex items-end gap-1.5" style={{ height }}>
        {reference ? <div className="absolute inset-x-0 border-t border-dashed border-foreground/40" style={{ bottom: pct(reference, max) }} title={format(reference)} /> : null}
        {values.map((v, i) => hollow?.(i)
          ? <div key={i} title={`${labels?.[i] ?? ''} none`.trim()} className="flex-1 rounded-t-[4px] border border-dashed border-danger/70" style={{ height: on ? '100%' : '0%', transitionDelay: `${i * 30}ms` }} />
          : <div key={i} title={`${labels?.[i] ?? ''} ${format(v)}`.trim()} className={cn('flex-1 rounded-t-[4px]', markLast && i === values.length - 1 ? 'bg-accent' : BG[tone], GROW)} style={{ height: on ? `${Math.max(3, (v / max) * 100)}%` : '0%', transitionDelay: `${i * 30}ms` }} />)}
      </div>
      {labels ? <div className="mt-1 flex gap-1.5 text-[10px] text-muted-foreground">{labels.map((l, i) => <span key={i} className="flex-1 truncate text-center">{l}</span>)}</div> : null}
    </div>
  );
}

export function Progress({ done, total, tone = 'success', compact }: { done: number; total: number; tone?: Tone; compact?: boolean }) {
  const on = useGrow();
  return <div className={cn('w-full overflow-hidden rounded-full bg-muted', compact ? 'h-1.5' : 'h-2')} title={`${done} / ${total}`}><div className={cn('h-full rounded-full', BG[tone], GROW)} style={{ width: on ? pct(done, total) : '0%' }} /></div>;
}

/** One ratio against one limit, alone on its tile: a single arc that fills on load, the figure inside. */
export function Ring({ value, max = 100, label, tone = 'primary', size = 72, stroke = 8, text }: { value: number; max?: number; label?: string; tone?: 'primary' | 'accent' | 'success' | 'warn' | 'danger'; size?: number; stroke?: number; text?: string }) {
  const on = useGrow();
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, value / (max || 1)));
  const col = { primary: 'hsl(var(--primary))', accent: 'hsl(var(--accent))', success: 'var(--success)', warn: 'var(--warn)', danger: 'var(--danger)' }[tone];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`${label ?? ''} ${text ?? value}`.trim()}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c}`} strokeDashoffset={on ? c * (1 - frac) : c} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 900ms ease-out' }} />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" fontSize={size * 0.26} fontWeight="700" fill="hsl(var(--foreground))">{text ?? Math.round(frac * 100) + '%'}</text>
    </svg>
  );
}

/** A slope: before → after, the change as a line; `target` draws a dashed line at the level to reach. */
export function Slope({ from, to, fromLabel, toLabel, format = (v: number) => String(v), higherIsBetter = true, target }: { from: number; to: number; fromLabel: string; toLabel: string; format?: (v: number) => string; higherIsBetter?: boolean; target?: number }) {
  const better = higherIsBetter ? to >= from : to <= from;
  const vals = [from, to, ...(target !== undefined ? [target] : [])];
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const y = (v: number) => 34 - ((v - lo) / span) * 26;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 120 40" className="h-10 w-28" aria-hidden="true">
        {target !== undefined ? <line x1="6" y1={y(target)} x2="114" y2={y(target)} stroke="hsl(var(--foreground))" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3 3" /> : null}
        <line x1="10" y1={y(from)} x2="110" y2={y(to)} stroke={better ? 'var(--success)' : 'var(--danger)'} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="10" cy={y(from)} r="4" fill="hsl(var(--muted-foreground))" /><circle cx="110" cy={y(to)} r="4.5" fill="hsl(var(--primary))" />
      </svg>
      <span className="text-[11px] leading-tight text-muted-foreground"><span className="block">{fromLabel} {format(from)}</span><span className="block font-medium text-foreground">{toLabel} {format(to)}</span>{target !== undefined ? <span className="block">target {format(target)}</span> : null}</span>
    </div>
  );
}

export type Step = { label: string; value: number; tone?: Tone };

/** A waterfall: each line adds to the running total; the last bar is the total. */
export function Waterfall({ steps, totalLabel, format = (v: number) => String(v), height = 120 }: { steps: Step[]; totalLabel: string; format?: (v: number) => string; height?: number }) {
  const on = useGrow();
  const total = steps.reduce((a, s) => a + s.value, 0);
  let run = 0;
  const bars = steps.map((s) => { const b = { ...s, from: run, to: run + s.value }; run += s.value; return b; });
  const H = (v: number) => (v / Math.max(1, total)) * 100;
  return (
    <div className="w-full">
      <div className="flex items-end gap-2" style={{ height }}>
        {bars.map((b, i) => (
          <div key={b.label} className="relative h-full flex-1" title={`${b.label}: ${format(b.value)}`}>
            <div className={cn('absolute inset-x-0 rounded-[4px]', BG[b.tone ?? 'chart1'], 'transition-[bottom,height] duration-700 ease-out motion-reduce:transition-none')} style={{ bottom: `${H(Math.min(b.from, b.to))}%`, height: on ? `${Math.max(2, H(Math.abs(b.value)))}%` : '0%', transitionDelay: `${i * 120}ms` }} />
          </div>
        ))}
        <div className="relative h-full flex-1" title={`${totalLabel}: ${format(total)}`}>
          <div className={cn('absolute inset-x-0 bottom-0 rounded-[4px] bg-primary', GROW)} style={{ height: on ? '100%' : '0%', transitionDelay: `${bars.length * 120}ms` }} />
        </div>
      </div>
      <div className="mt-1.5 flex gap-2 text-[10.5px] leading-tight text-muted-foreground">
        {bars.map((b) => <span key={b.label} className="flex-1 text-center"><span className="block">{b.label}</span><span className="font-medium text-foreground">{format(b.value)}</span></span>)}
        <span className="flex-1 text-center"><span className="block">{totalLabel}</span><span className="font-semibold text-foreground">{format(total)}</span></span>
      </div>
    </div>
  );
}

/** A funnel: each stage narrower than the last, centred; a stage at zero draws no bar. */
export function Funnel({ stages, format = (v: number) => String(v) }: { stages: { label: string; value: number }[]; format?: (v: number) => string }) {
  const on = useGrow();
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div className="space-y-1.5">
      {stages.map((s, i) => (
        <div key={s.label} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-xs">
          <span className="text-muted-foreground">{s.label}</span>
          <div className="flex justify-center"><div className={cn('h-6 rounded-md', GROW)} style={{ width: on && s.value ? `${Math.max(3, (s.value / max) * 100)}%` : '0%', background: `hsl(var(--primary) / ${0.95 - i * 0.1})`, transitionDelay: `${i * 80}ms` }} /></div>
          <span className="text-end font-semibold tabular-nums">{format(s.value)}</span>
        </div>
      ))}
    </div>
  );
}

export type Cell = { value: number | null; label?: string };

/**
 * A grid of cells toned by value: rows × columns, one hue from light to dark
 * (a share, a rate), or `tone(value)` for a status reading (ok / watch / fail).
 */
export function HeatCells({ rows, cols, cells, format = (v: number) => String(v), tone, size = 22 }: { rows: string[]; cols: string[]; cells: Cell[][]; format?: (v: number) => string; tone?: (v: number) => Tone; size?: number }) {
  const vals = cells.flat().map((c) => c.value).filter((v): v is number => v !== null);
  const lo = Math.min(...vals, 0), hi = Math.max(...vals, 1);
  const grow = useGrow();
  return (
    <div className="w-full overflow-x-auto scroll-thin">
      <div className="grid items-center gap-1 text-[11px]" style={{ gridTemplateColumns: `minmax(7rem,auto) repeat(${cols.length}, minmax(${size}px, 1fr))` }}>
        <span />
        {cols.map((c) => <span key={c} className="truncate text-center text-muted-foreground" title={c}>{c}</span>)}
        {rows.map((r, ri) => (
          <RowCells key={r} label={r} cells={cells[ri] ?? []} lo={lo} hi={hi} format={format} tone={tone} size={size} grow={grow} delay={ri * 40} />
        ))}
      </div>
    </div>
  );
}
function RowCells({ label, cells, lo, hi, format, tone, size, grow, delay }: { label: string; cells: Cell[]; lo: number; hi: number; format: (v: number) => string; tone?: (v: number) => Tone; size: number; grow: boolean; delay: number }) {
  return (
    <>
      <span className="truncate pe-2 text-muted-foreground" title={label}>{label}</span>
      {cells.map((c, i) => {
        const t = c.value === null ? null : tone ? tone(c.value) : null;
        const alpha = c.value === null ? 0 : 0.15 + 0.85 * ((c.value - lo) / (hi - lo || 1));
        return <span key={i} title={c.label ?? (c.value === null ? '—' : format(c.value))} className={cn('rounded-[4px] transition-opacity duration-500 motion-reduce:transition-none', t ? BG[t] : c.value === null ? 'bg-muted' : 'bg-primary')} style={{ height: size, opacity: grow ? (t ? 1 : alpha) : 0, transitionDelay: `${delay + i * 20}ms` }} />;
      })}
    </>
  );
}

export type CoverRow = { name: string; ranges: { start: string; end: string; pending?: boolean; self?: boolean }[] };

/** People as rows, days as columns; leave as bars, the request highlighted, weekends shaded. */
export function CoverStrip({ from, days, rows, today, size = 'sm' }: { from: string; days: number; rows: CoverRow[]; today?: string; size?: 'sm' | 'lg' }) {
  const d0 = new Date(`${from}T00:00:00Z`).getTime();
  const iso = (i: number) => new Date(d0 + i * 86400000).toISOString().slice(0, 10);
  const cols = Array.from({ length: days }, (_, i) => iso(i));
  return (
    <div className={cn('w-full', size === 'lg' ? 'text-[13px]' : 'text-[11px]')}>
      <div className={cn('grid items-center', size === 'lg' ? 'gap-y-1.5' : 'gap-y-1')} style={{ gridTemplateColumns: `minmax(${size === 'lg' ? '7rem' : '5.5rem'},auto) repeat(${days}, minmax(0,1fr))` }}>
        <span />
        {cols.map((c) => { const w = new Date(`${c}T00:00:00Z`).getUTCDay(); return <span key={c} className={cn('text-center tabular-nums text-muted-foreground', size === 'lg' ? 'text-[11px]' : 'text-[10px]', (w === 5 || w === 6) && 'opacity-50', c === today && 'font-bold text-primary')}>{Number(c.slice(8))}</span>; })}
        {rows.map((r) => <CoverLine key={r.name} r={r} cols={cols} size={size} />)}
      </div>
    </div>
  );
}
function CoverLine({ r, cols, size }: { r: CoverRow; cols: string[]; size: 'sm' | 'lg' }) {
  return (
    <>
      <span className={cn('truncate pe-2', r.ranges.some((x) => x.self) ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{r.name}</span>
      {cols.map((c) => {
        const w = new Date(`${c}T00:00:00Z`).getUTCDay();
        const hit = r.ranges.find((x) => x.start <= c && x.end >= c);
        return <span key={c} className={cn('mx-[1px] rounded-[3px]', size === 'lg' ? 'h-6' : 'h-3.5', hit ? (hit.self ? 'bg-primary' : hit.pending ? 'bg-primary/35 ring-1 ring-inset ring-primary' : 'bg-warn') : (w === 5 || w === 6) ? 'bg-muted/60' : 'bg-muted')} title={hit ? `${r.name}: ${hit.start} – ${hit.end}` : undefined} />;
      })}
    </>
  );
}

/** A year as a calendar heatmap: one cell per day, weeks as columns. */
export function YearHeatmap({ year, ranges, today }: { year: number; ranges: { start: string; end: string; tone: 'taken' | 'booked' }[]; today?: string }) {
  const start = new Date(Date.UTC(year, 0, 1));
  const offset = (start.getUTCDay() + 1) % 7; // weeks start on Saturday so Fri/Sat sit together
  const days = (Date.UTC(year + 1, 0, 1) - start.getTime()) / 86400000;
  const iso = (i: number) => new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
  const cells = Array.from({ length: offset + days }, (_, i) => (i < offset ? null : iso(i - offset)));
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const kind = (d: string) => ranges.find((r) => r.start <= d && r.end >= d)?.tone;
  const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  return (
    <div className="w-full overflow-x-auto scroll-thin">
      <div className="flex gap-[3px]">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            <span className="h-3 text-[9px] leading-3 text-muted-foreground">{w.find((d) => d && d.slice(8) === '01') ? months[Number(w.find((d) => d && d.slice(8) === '01')!.slice(5, 7)) - 1] : ''}</span>
            {w.map((d, di) => {
              if (!d) return <span key={di} className="h-3 w-3" />;
              const k = kind(d); const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
              return <span key={d} title={d} className={cn('h-3 w-3 rounded-[3px]', k === 'taken' ? 'bg-primary' : k === 'booked' ? 'bg-chart-2' : (wd === 5 || wd === 6) ? 'bg-muted/50' : 'bg-muted', d === today && 'ring-2 ring-foreground/70')} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A figure that counts up once, for a stat tile. */
export function CountUp({ value, format = (v: number) => String(Math.round(v)), duration = 700 }: { value: number; format?: (v: number) => string; duration?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setV(value); return; }
    const t0 = performance.now(); let raf = 0;
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / duration); setV(value * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(v)}</>;
}
