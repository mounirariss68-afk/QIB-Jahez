/**
 * CogniPulse's pictures: small, exact charts drawn on the theme tokens, for the
 * decision a screen carries. Lifted from the Δ Force prototype (21 Oct 2026)
 * and made domain-neutral: every component takes plain values and a format
 * function, never a record shape from one prototype.
 *
 *   TimeBar      how much of a period has run, today marked
 *   CapBar       used and pending against a limit, with the request on top
 *   Bullet       a value against a target or threshold, the baseline marked
 *   Segments     n of m, as segments
 *   Dots         n of m, as dots (a few units)
 *   Ring         one ratio on a tile
 *   Sparkline    a series beside its number
 *   Columns      change over time, one hue, the latest emphasised
 *   CountUp      a figure that counts up once
 *   FigureTile   a figure with its picture under it (StatTile in layout is the big KPI)
 *   Swimlanes    every item's period on one time axis, today as a line
 *   StageRiver   every item's path through ordered stages over time
 *   DeadlineField  every open item by the days it has left, by lane, sized by weight
 *   Treemap      where a total is held, each item sized by its share
 *   Slope        before → now, the target as a line
 *   Journey      one item's path through its stages, dated, holds marked
 *   BeforeAfter  a daily series across the baseline and the pilot, each window's level drawn
 *
 * Flows and processes (flow.tsx): Waterfall, Sankey, Funnel, CumulativeFlow, Network.
 * Comparison, rank, pattern, spread (compare.tsx): Dumbbell, Bump, Heatmap,
 * ControlChart, DotStrip, SmallMultiples.
 *
 * Colour: one hue (primary) for quantity; status colours (warn, danger,
 * success) only where the state is the message. Motion runs once on mount and
 * is switched off under prefers-reduced-motion (see `.viz-*` in index.css).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { trs } from '../../lib/i18n';
import { BG, DAY, FILL, STROKE, TEXT, clamp, plainNumber, shortDate, t, useDrawn, type Format, type Tone } from './tones';

export { shortDate, sharedDomain, type Format, type Tone } from './tones';
export * from './flow';
export * from './compare';

function monthsBetween(t0: number, t1: number) {
  const out: number[] = [];
  const d = new Date(t0);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  while (+d < t1) {
    out.push(+d);
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}
const monthLabel = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });

/* ------------------------------------------------------------ the bars */

/** A period: the track runs from start to end (or the held-until date); today is a tick; held, paused, stopped and overdue change the fill. */
export function TimeBar({ start, end, today, heldUntil, state = 'running', compact = false, className }: { start: string | null; end: string | null; today: string; heldUntil?: string | null; state?: 'running' | 'paused' | 'stopped'; compact?: boolean; className?: string }) {
  const stop = heldUntil ?? end;
  if (!start || !stop) return <div className={cn('h-1.5 rounded-full bg-muted', className)} />;
  const f = t(start), e = t(stop), now = t(today);
  const done = clamp((now - f) / Math.max(1, e - f));
  const over = now > e && state !== 'stopped';
  const tone = state === 'stopped' ? 'bg-muted-foreground/40' : over ? 'bg-danger' : heldUntil ? 'bg-warn' : state === 'paused' ? 'bg-muted-foreground/50' : 'bg-primary';
  const left = Math.max(0, Math.round((e - now) / DAY));
  const title = state === 'stopped' ? 'stopped' : over ? `${Math.round((now - e) / DAY)} days over, due ${shortDate(stop)}` : `${left} days left, ${heldUntil ? 'review' : 'due'} ${shortDate(stop)}; started ${shortDate(start)}`;
  return (
    <div className={cn('min-w-0', className)} title={title}>
      <div className="relative h-1.5 rounded-full bg-muted">
        <div className={cn('absolute inset-y-0 start-0 rounded-full', tone)} style={{ width: `${Math.round(done * 100)}%` }} />
        {!over ? <div className="absolute -top-1 h-3.5 w-0.5 bg-foreground/80" style={{ insetInlineStart: `${Math.round(done * 100)}%` }} /> : null}
      </div>
      {!compact ? (
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{shortDate(start)}</span>
          <span className={over ? 'text-danger' : undefined}>{heldUntil ? 'review ' : ''}{shortDate(stop)}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Used and pending against a limit, stacked from the left; the request sits on top; the limit is the track. */
export function CapBar({ cap, used, pending = 0, request = 0, format = plainNumber, compact = false, className }: { cap: number | null; used: number; pending?: number; request?: number; format?: Format; compact?: boolean; className?: string }) {
  const c = cap && Number.isFinite(cap) && cap > 0 ? cap : null;
  const max = Math.max(c ?? 0, used + pending + request, 1);
  const w = (v: number) => `${Math.round(clamp(v / max) * 1000) / 10}%`;
  const over = c !== null && used + pending + request > c;
  const room = c !== null ? c - used - pending : null;
  const title = c !== null ? `limit ${format(c)}: ${format(used)} used, ${format(pending)} pending${request ? `, this request ${format(request)}` : ''}; ${format(room ?? 0)} room` : `${format(used)} used, no limit`;
  return (
    <div className={cn('min-w-0', className)} title={title}>
      <div className="relative flex h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: w(used) }} />
        <div className="h-full bg-primary/50" style={{ width: w(pending), marginInlineStart: pending ? 2 : 0 }} />
        {request ? <div className={cn('h-full', over ? 'bg-danger' : 'bg-accent')} style={{ width: w(request), marginInlineStart: 2 }} /> : null}
        {c !== null && c < max ? <div className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ insetInlineStart: w(c) }} /> : null}
      </div>
      {!compact ? (
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{format(used)} {trs('used')}{pending ? `, ${format(pending)} ${trs('pending')}` : ''}</span>
          <span className={over ? 'text-danger' : undefined}>{c !== null ? (over ? `${format(used + pending + request - c)} ${trs('over')}` : `${format(room ?? 0)} ${trs('room of')} ${format(c)}`) : trs('no limit')}</span>
        </div>
      ) : null}
    </div>
  );
}

/** A value against a target or threshold (a line), with the baseline as a hollow tick. `alarm` paints the value red. */
export function Bullet({ value, target, baseline, min, max, direction = 'up', alarm, format = plainNumber, compact = false, className }: { value: number | null | undefined; target: number | null | undefined; baseline?: number | null; min?: number; max?: number; direction?: 'up' | 'down'; alarm?: boolean | null; format?: Format; compact?: boolean; className?: string }) {
  const vals = [value, target, baseline].filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  if (!vals.length) return <div className={cn('h-1.5 rounded-full bg-muted', className)} />;
  const lo = min ?? Math.min(0, ...vals);
  const hi = max ?? (Math.max(...vals) * 1.15 || 1);
  const x = (v: number) => `${Math.round(clamp((v - lo) / (hi - lo || 1)) * 1000) / 10}%`;
  const met = typeof value === 'number' && typeof target === 'number' ? (direction === 'up' ? value >= target : value <= target) : null;
  const title = `${value != null ? format(value) : 'not measured'}${target != null ? `; target ${format(target)}` : ''}${baseline != null ? `; baseline ${format(baseline)}` : ''}`;
  return (
    <div className={cn('min-w-0', className)} title={title}>
      <div className="relative h-1.5 rounded-full bg-muted">
        {typeof value === 'number' ? <div className={cn('absolute inset-y-0 start-0 rounded-full', alarm ? 'bg-danger' : 'bg-primary')} style={{ width: x(value) }} /> : null}
        {typeof baseline === 'number' ? <div className="absolute -top-0.5 h-2.5 w-2.5 -translate-x-1/2 rtl:translate-x-1/2 rounded-full border-2 border-foreground/60 bg-background" style={{ insetInlineStart: x(baseline) }} /> : null}
        {typeof target === 'number' ? <div className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rtl:translate-x-1/2 bg-foreground/80" style={{ insetInlineStart: x(target) }} /> : null}
      </div>
      {!compact ? (
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{typeof baseline === 'number' ? `${trs('from')} ${format(baseline)}` : typeof value === 'number' ? format(value) : trs('not measured')}</span>
          <span className={met === false ? 'text-warn' : undefined}>{typeof target === 'number' ? `${trs('target')} ${format(target)}` : ''}</span>
        </div>
      ) : null}
    </div>
  );
}

/** n of m, as segments: deliverables in, steps done. */
export function Segments({ items, className }: { items: { label: string; on: boolean }[]; className?: string }) {
  return (
    <div className={cn('flex gap-0.5', className)} title={items.map((i) => `${i.on ? '✓' : '·'} ${i.label}`).join('\n')}>
      {items.map((i, k) => <div key={k} className={cn('h-1.5 flex-1 rounded-sm', i.on ? 'bg-primary' : 'bg-muted')} />)}
    </div>
  );
}

/** Part of a whole with a few units: the ones that count filled. */
export function Dots({ n, of, tone = 'primary', className }: { n: number; of: number; tone?: Tone; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)} title={`${n} of ${of}`}>
      {Array.from({ length: of }, (_, i) => <span key={i} className={cn('viz-pop is-drawn h-2.5 w-2.5 rounded-full', i < n ? BG[tone] : 'bg-muted')} style={{ transitionDelay: `${i * 40}ms` }} />)}
    </div>
  );
}

/** One ratio against a limit, on a tile. One ring per tile, never a row of them. */
export function Ring({ value, max, size = 56, stroke = 6, tone = 'primary', label, className }: { value: number; max: number; size?: number; stroke?: number; tone?: Tone; label?: ReactNode; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = clamp(max ? value / max : 0);
  const on = useDrawn();
  return (
    <div className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" className={cn(STROKE[tone], 'viz-ring')} strokeDasharray={c} strokeDashoffset={on ? c * (1 - f) : c} />
      </svg>
      {label ? <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">{label}</span> : null}
    </div>
  );
}

/** A series beside its number. Pass `domain` (see sharedDomain) when several sparklines are compared. */
export function Sparkline({ points, domain, tone = 'primary', className }: { points: number[]; domain?: [number, number]; tone?: Tone; className?: string }) {
  const p = points.filter((v) => Number.isFinite(v));
  if (p.length < 2) return null;
  const [lo, hi] = domain ?? [Math.min(...p), Math.max(...p)];
  const w = 100, h = 28;
  const d = p.map((v, i) => `${(i / (p.length - 1)) * w},${h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn('viz-svg h-7 w-24', className)} aria-hidden="true">
      <polyline points={d} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" className={STROKE[tone]} />
    </svg>
  );
}

/** Change over time: columns in one hue, the latest emphasised; they grow once on mount. Pass `max` when several are compared. */
export function Columns({ points, max: maxIn, format = plainNumber, height = 96, className }: { points: { label: string; value: number }[]; max?: number; format?: Format; height?: number; className?: string }) {
  const max = maxIn ?? Math.max(1, ...points.map((p) => p.value));
  return (
    <div className={cn('flex items-end gap-1', className)} style={{ height }}>
      {points.map((p, i) => (
        <div key={p.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${p.label}: ${format(p.value)}`}>
          <div className={cn('viz-grow-y w-full rounded-t-sm', i === points.length - 1 ? 'bg-primary' : 'bg-primary/55')} style={{ height: `${(p.value / max) * (height - 18)}px` }} />
          <span className="truncate text-[9px] text-muted-foreground">{p.label}</span>
        </div>
      ))}
    </div>
  );
}

/** A figure that counts up once, on mount. */
export function CountUp({ value, format, duration = 700 }: { value: number; format?: Format; duration?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setV(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = clamp((now - t0) / duration);
      setV(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format ? format(v) : Math.round(v)}</>;
}

/** A figure with its picture under it. */
export function FigureTile({ label, value, sub, tone, children, action, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: Exclude<Tone, 'muted'>; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl glass-l3 px-4 py-3', className)}>
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className={cn('mt-1.5 font-semibold leading-none tabular-nums', typeof value === 'string' && value.length > 16 ? 'text-[15px] leading-tight' : 'text-xl', tone && TEXT[tone])}>{value}</p>
      {sub ? <p className="mt-1 text-[12px] text-muted-foreground">{sub}</p> : null}
      {children ? <div className="mt-2.5">{children}</div> : null}
      {action ? <div className="mt-2.5 border-t border-border/50 pt-2.5">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------- the time forms */

export type LaneRow = { id: string; label: string; sub?: string; start: string; end: string; tone?: Tone; stopped?: boolean };

/** Every item's period on one time axis, today as a dashed line: which runs out first. */
export function Swimlanes({ rows, today, onOpen, className }: { rows: LaneRow[]; today: string; onOpen?: (id: string) => void; className?: string }) {
  if (!rows.length) return null;
  const t0 = Math.min(...rows.map((r) => t(r.start)));
  const t1 = Math.max(t(today), ...rows.map((r) => t(r.end)));
  const x = (v: number) => `${(clamp((v - t0) / Math.max(1, t1 - t0)) * 100).toFixed(2)}%`;
  const months = monthsBetween(t0, t1);
  return (
    <div className={cn('relative', className)}>
      <div className="relative ms-[40%] h-4 text-[9px] text-muted-foreground">
        {months.map((mo) => <span key={mo} className="absolute -translate-x-1/2 rtl:translate-x-1/2" style={{ insetInlineStart: x(mo) }}>{monthLabel(mo)}</span>)}
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 ms-[40%] w-[60%]">
          {months.map((mo) => <div key={mo} className="absolute inset-y-0 border-s border-border/50" style={{ insetInlineStart: x(mo) }} />)}
          <div className="absolute inset-y-0 border-s-2 border-dashed border-foreground/60" style={{ insetInlineStart: x(t(today)) }} />
        </div>
        {rows.map((r) => {
          const over = t(today) > t(r.end) && !r.stopped;
          const tone = r.stopped ? 'bg-muted-foreground/40' : over ? 'bg-danger' : BG[r.tone ?? 'primary'];
          return (
            <div key={r.id} className={cn('flex items-center py-1', onOpen && 'cursor-pointer hover:bg-primary/5')} onClick={() => onOpen?.(r.id)}>
              <div className="w-[40%] min-w-0 pe-3">
                <p className={cn('truncate text-[13px] font-medium', r.stopped && 'text-muted-foreground')}>{r.label}</p>
                {r.sub ? <p className="truncate text-[11px] text-muted-foreground">{r.sub}</p> : null}
              </div>
              <div className="relative h-3 w-[60%]" title={`${shortDate(r.start)} → ${shortDate(r.end)}`}>
                <div className={cn('viz-grow absolute inset-y-0.5 rounded-full', tone)} style={{ insetInlineStart: x(t(r.start)), width: `calc(${x(t(r.end))} - ${x(t(r.start))})` }} />
                {r.stopped ? <span className="absolute -top-0.5 -translate-x-1/2 rtl:translate-x-1/2 text-[10px] text-danger" style={{ insetInlineStart: x(t(r.end)) }}>×</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type RiverItem = { id: string; label: string; tone?: Tone; stopped?: boolean; detail?: string; path: { stage: string; from: string; to: string | null }[] };

/**
 * Every item's path through ordered stages over time, one ribbon each, on a
 * common time axis with today marked. Moving on climbs a lane, going back
 * drops one, a stop ends the ribbon with a cross.
 */
export function StageRiver({ stages, items, today, focus, height = 190, onOpen, className }: { stages: { id: string; label: string }[]; items: RiverItem[]; today: string; focus?: string | null; height?: number; onOpen?: (id: string) => void; className?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const drawn = useDrawn();
  const all = items.flatMap((i) => i.path);
  if (!all.length) return null;
  const t0 = Math.min(...all.map((p) => t(p.from)));
  const t1 = Math.max(t(today), ...all.map((p) => (p.to ? t(p.to) : t(today))));
  const W = 600, H = height, padL = 74, padR = 16, padT = 12, padB = 22;
  const x = (v: number) => padL + ((v - t0) / Math.max(1, t1 - t0)) * (W - padL - padR);
  const laneH = (H - padT - padB) / stages.length;
  const idx = (s: string) => Math.max(0, stages.findIndex((x) => x.id === s));
  const y = (s: string) => padT + (stages.length - 1 - idx(s)) * laneH + laneH / 2;
  const hovered = hover ? items.find((i) => i.id === hover) : null;
  return (
    <div className={cn('relative min-w-0', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg block h-auto w-full max-w-full" role="img" aria-label="Each item through the stages over time">
        {stages.map((s) => (
          <g key={s.id}>
            <line x1={padL} x2={W - padR} y1={y(s.id)} y2={y(s.id)} className="stroke-border" strokeWidth={1} />
            <text x={padL - 8} y={y(s.id) + 3.5} textAnchor="end" className="fill-muted-foreground text-[9px]">{s.label.length > 12 ? `${s.label.slice(0, 11)}…` : s.label}</text>
          </g>
        ))}
        {monthsBetween(t0, t1).map((mo) => (
          <g key={mo}>
            <line x1={x(mo)} x2={x(mo)} y1={padT} y2={H - padB} className="stroke-border/60" strokeWidth={1} />
            <text x={x(mo)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[8.5px]">{monthLabel(mo)}</text>
          </g>
        ))}
        <line x1={x(t(today))} x2={x(t(today))} y1={padT - 4} y2={H - padB + 2} className="stroke-foreground/70" strokeWidth={1.5} strokeDasharray="3 3" />
        <text x={x(t(today))} y={padT - 1} textAnchor="middle" className="fill-foreground text-[8.5px]">{trs('today')}</text>
        {items.map((it, i) => {
          if (!it.path.length) return null;
          const off = ((i % 5) - 2) * 2.2;
          let d = '';
          let ex = 0, ey = 0;
          it.path.forEach((p, k) => {
            const xa = x(t(p.from));
            const xb = x(p.to ? t(p.to) : t(today));
            const yy = y(p.stage) + off;
            if (k === 0) d += `M${xa},${yy}`;
            else {
              const prev = y(it.path[k - 1].stage) + off;
              d += ` C${xa - 10},${prev} ${xa - 10},${yy} ${xa},${yy}`;
            }
            d += ` L${xb},${yy}`;
            ex = xb;
            ey = yy;
          });
          const active = hover ? hover === it.id : focus ? focus === it.id : true;
          const tone = it.tone ?? 'primary';
          return (
            <g key={it.id} className={cn('transition-opacity duration-300', onOpen && 'cursor-pointer', !active && 'opacity-25')} onMouseEnter={() => setHover(it.id)} onMouseLeave={() => setHover(null)} onClick={() => onOpen?.(it.id)}>
              <path d={d} fill="none" strokeWidth={hover === it.id ? 4 : 2.5} strokeLinecap="round" className={cn(STROKE[tone], 'viz-draw', drawn && 'is-drawn')} pathLength={1} style={{ transitionDelay: `${i * 60}ms` }} />
              {it.stopped ? (
                <g transform={`translate(${ex},${ey})`}>
                  <line x1={-4} y1={-4} x2={4} y2={4} className="stroke-danger" strokeWidth={2} />
                  <line x1={-4} y1={4} x2={4} y2={-4} className="stroke-danger" strokeWidth={2} />
                </g>
              ) : (
                <circle cx={ex} cy={ey} r={hover === it.id ? 5 : 3.5} className={cn(FILL[tone], 'viz-pop', drawn && 'is-drawn')} style={{ transitionDelay: `${600 + i * 60}ms` }} />
              )}
              <title>{`${it.label}: ${it.path.map((p) => `${stages[idx(p.stage)]?.label ?? p.stage} from ${shortDate(p.from)}`).join(', ')}`}</title>
            </g>
          );
        })}
      </svg>
      {hovered ? (
        <div className="pointer-events-none absolute end-2 top-0 rounded-md border border-border/60 bg-card/95 px-2 py-1 text-[11px] shadow">
          <span className="font-medium">{hovered.label}</span>
          {hovered.detail ? ` · ${hovered.detail}` : ''}
        </div>
      ) : null}
    </div>
  );
}

export type FieldItem = { id: string; label: string; lane: string; daysLeft: number; weight?: number; tone?: Tone; detail?: string };

/**
 * Every open item placed by the days it has left (x) in its lane (y), sized
 * by its weight (money, effort). What runs out first sits nearest today's
 * line; what is overdue has crossed it into the shaded band.
 */
export function DeadlineField({ lanes, items, onOpen, legend, className }: { lanes: { id: string; label: string }[]; items: FieldItem[]; onOpen?: (id: string) => void; legend?: ReactNode; className?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 640, H = Math.max(160, lanes.length * 64 + 50), padL = 78, padR = 40, padT = 24, padB = 26;
  const minD = Math.min(-15, ...items.map((i) => i.daysLeft));
  const maxD = Math.max(60, ...items.map((i) => i.daysLeft)) + 10;
  const x = (d: number) => padL + ((d - minD) / (maxD - minD)) * (W - padL - padR);
  const laneH = (H - padT - padB) / Math.max(1, lanes.length);
  const laneIdx = (id: string) => Math.max(0, lanes.findIndex((l) => l.id === id));
  const y = (id: string) => padT + (lanes.length - 1 - laneIdx(id)) * laneH + laneH / 2;
  const maxW = Math.max(1, ...items.map((i) => i.weight ?? 1));
  const r = (i: FieldItem) => 5 + Math.sqrt((i.weight ?? 1) / maxW) * 9;
  // Items sharing a lane and roughly the same day are spread vertically.
  const off = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const i of items) {
    const k = `${i.lane}:${Math.round(i.daysLeft / 24)}`;
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    off.set(i.id, (n % 2 === 0 ? 1 : -1) * Math.ceil(n / 2) * 22);
  }
  const ticks = [-30, 0, 30, 60, 90, 120, 150, 180].filter((d) => d >= minD && d <= maxD);
  // Labels go right, above, below or left of their dot, whichever is free first.
  const boxes: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const sorted = [...items].sort((a, b) => a.daysLeft - b.daysLeft);
  for (const i of sorted) {
    const cx = x(i.daysLeft), cy = y(i.lane) + (off.get(i.id) ?? 0);
    boxes.push({ x1: cx - r(i), y1: cy - r(i), x2: cx + r(i), y2: cy + r(i) });
  }
  const fits = (b: { x1: number; y1: number; x2: number; y2: number }) => b.x1 >= padL - 4 && b.x2 <= W - 2 && !boxes.some((o) => b.x1 < o.x2 && b.x2 > o.x1 && b.y1 < o.y2 && b.y2 > o.y1);
  const labels = new Map<string, { x: number; y: number; anchor: 'start' | 'middle' | 'end'; text: string }>();
  for (const i of sorted) {
    const cx = x(i.daysLeft), cy = y(i.lane) + (off.get(i.id) ?? 0), rr = r(i);
    const text = i.label.length > 22 ? `${i.label.slice(0, 21)}…` : i.label;
    const w = text.length * 5.1 + 4, lh = 11;
    const tries = [
      { x: cx + rr + 4, y: cy + 3.5, anchor: 'start' as const, box: { x1: cx + rr + 3, y1: cy - lh / 2, x2: cx + rr + 3 + w, y2: cy + lh / 2 } },
      { x: cx, y: cy - rr - 5, anchor: 'middle' as const, box: { x1: cx - w / 2, y1: cy - rr - 5 - lh, x2: cx + w / 2, y2: cy - rr - 4 } },
      { x: cx, y: cy + rr + 12, anchor: 'middle' as const, box: { x1: cx - w / 2, y1: cy + rr + 3, x2: cx + w / 2, y2: cy + rr + 3 + lh } },
      { x: cx - rr - 4, y: cy + 3.5, anchor: 'end' as const, box: { x1: cx - rr - 3 - w, y1: cy - lh / 2, x2: cx - rr - 3, y2: cy + lh / 2 } },
    ];
    const pick = tries.find((tr) => fits(tr.box)) ?? tries[0];
    boxes.push(pick.box);
    labels.set(i.id, { x: pick.x, y: pick.y, anchor: pick.anchor, text });
  }
  return (
    <div className={cn('relative min-w-0', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg block h-auto w-full" role="img" aria-label="Every open item by the days it has left">
        <rect x={padL} y={padT - 6} width={Math.max(0, x(0) - padL)} height={H - padT - padB + 12} className="fill-danger/5" />
        {lanes.map((l) => (
          <g key={l.id}>
            <line x1={padL} x2={W - padR} y1={y(l.id)} y2={y(l.id)} className="stroke-border" />
            <text x={padL - 8} y={y(l.id) + 3.5} textAnchor="end" className="fill-muted-foreground text-[9.5px]">{l.label}</text>
          </g>
        ))}
        {ticks.map((d) => (
          <g key={d}>
            <line x1={x(d)} x2={x(d)} y1={padT - 6} y2={H - padB + 4} className={d === 0 ? 'stroke-foreground/70' : 'stroke-border/60'} strokeWidth={d === 0 ? 1.5 : 1} strokeDasharray={d === 0 ? '3 3' : undefined} />
            <text x={x(d)} y={H - 8} textAnchor="middle" className={cn('text-[8.5px]', d === 0 ? 'fill-foreground' : 'fill-muted-foreground')}>{d === 0 ? trs('today') : d < 0 ? `${-d} ${trs('days over')}` : `+${d} ${trs('days')}`}</text>
          </g>
        ))}
        {sorted.map((i, k) => {
          const cx = x(i.daysLeft), cy = y(i.lane) + (off.get(i.id) ?? 0);
          const L = labels.get(i.id)!;
          return (
            <g key={i.id} className={cn('transition-opacity duration-200', onOpen && 'cursor-pointer', hover && hover !== i.id && 'opacity-30')} onMouseEnter={() => setHover(i.id)} onMouseLeave={() => setHover(null)} onClick={() => onOpen?.(i.id)}>
              <circle cx={cx} cy={cy} r={r(i)} className={cn('viz-pop is-drawn', FILL[i.tone ?? 'primary'])} style={{ transitionDelay: `${k * 50}ms` }} />
              <text x={L.x} y={L.y} textAnchor={L.anchor} className={cn('text-[9px] font-medium', hover === i.id ? 'fill-foreground' : 'fill-foreground/80')}>{L.text}</text>
              <title>{`${i.label}: ${i.daysLeft < 0 ? `${-i.daysLeft} days over` : `${i.daysLeft} days left`}${i.detail ? `; ${i.detail}` : ''}`}</title>
            </g>
          );
        })}
      </svg>
      {legend ? <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-muted-foreground">{legend}</div> : null}
    </div>
  );
}

/** A legend swatch for DeadlineField, StageRiver and friends. */
export function Swatch({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span>
      <span className={cn('me-1 inline-block h-2 w-2 rounded-full', BG[tone])} />
      {children}
    </span>
  );
}

/* ------------------------------------------------- part to whole, change */

export type TreemapItem = { id: string; label: string; size: number; used?: number; tone?: Tone; detail?: string };

/** Where a total is held: each item a rectangle sized by its share, filled by how much of it is used (0–1). */
export function Treemap({ items, onOpen, className }: { items: TreemapItem[]; onOpen?: (id: string) => void; className?: string }) {
  const list = items.filter((i) => i.size > 0).sort((a, b) => b.size - a.size);
  const total = list.reduce((s, i) => s + i.size, 0) || 1;
  const rects: { i: TreemapItem; x: number; y: number; w: number; h: number }[] = [];
  // Split the list into two groups of near-equal size, cut the box along its
  // longer side in that ratio, and recurse: rectangles stay close to square.
  // The box is 200 × 100 (the 2:1 frame) and converted to % at the end.
  const lay = (xs: TreemapItem[], x: number, y: number, w: number, h: number) => {
    if (!xs.length) return;
    if (xs.length === 1) {
      rects.push({ i: xs[0], x: (x / 200) * 100, y, w: (w / 200) * 100, h });
      return;
    }
    const sum = xs.reduce((s, i) => s + i.size, 0);
    let acc = 0;
    let k = 0;
    while (k < xs.length - 1 && acc + xs[k].size / 2 < sum / 2) acc += xs[k++].size;
    if (k === 0) acc = xs[k++].size;
    const f = acc / sum;
    if (w >= h * 1) {
      lay(xs.slice(0, k), x, y, w * f, h);
      lay(xs.slice(k), x + w * f, y, w * (1 - f), h);
    } else {
      lay(xs.slice(0, k), x, y, w, h * f);
      lay(xs.slice(k), x, y + h * f, w, h * (1 - f));
    }
  };
  void total;
  lay(list, 0, 0, 200, 100);
  return (
    <div className={cn('relative aspect-[2/1] w-full max-w-full overflow-hidden rounded-lg', className)}>
      {rects.map(({ i, x, y, w, h }) => {
        const used = clamp(i.used ?? 0);
        return (
          <button key={i.id} type="button" onClick={() => onOpen?.(i.id)} className="absolute overflow-hidden rounded-md border-2 border-background text-start transition hover:z-10 hover:shadow-md" style={{ insetInlineStart: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }} title={i.detail ?? `${i.label}: ${Math.round(used * 100)}% used`}>
            <div className="absolute inset-0 bg-muted" />
            <div className={cn('viz-grow absolute inset-y-0 start-0 opacity-60', BG[i.tone ?? 'primary'])} style={{ width: `${used * 100}%` }} />
            <div className="relative p-1.5 leading-tight">
              <p className="truncate text-[11px] font-semibold text-foreground">{i.label}</p>
              <p className="truncate text-[10px] tabular-nums text-foreground/80">{Math.round(used * 100)}% used</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Before → now: a slope from the baseline to the measured value, the target as a dashed line. Dashed slope while only claimed. */
export function Slope({ before, now, target, direction = 'up', state = 'verified', format = plainNumber, className }: { before: number | null; now: number | null; target: number | null; direction?: 'up' | 'down'; state?: 'verified' | 'claimed' | 'none'; format?: Format; className?: string }) {
  const vals = [before, now, target].filter((v): v is number => typeof v === 'number');
  if (!vals.length) return <div className={cn('h-14 w-56 rounded bg-muted/40', className)} />;
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.3;
  const W = 230, H = 60, L = 70, R = 160;
  const yv = (v: number) => H - 10 - ((v - (lo - pad)) / (hi + pad - (lo - pad))) * (H - 20);
  const met = typeof now === 'number' && typeof target === 'number' ? (direction === 'up' ? now >= target : now <= target) : null;
  const tone: Tone = state === 'verified' ? (met ? 'success' : 'primary') : state === 'claimed' ? 'warn' : 'muted';
  const near = (a: number, b: number) => Math.abs(yv(a) - yv(b)) < 9;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn('viz-svg h-[60px] w-[230px] max-w-full shrink-0', className)} role="img" aria-label="Before and now against the target">
      {typeof target === 'number' ? (
        <>
          <line x1={L} x2={R} y1={yv(target)} y2={yv(target)} className="stroke-foreground/50" strokeDasharray="3 3" />
          {typeof now !== 'number' || !near(target, now) ? <text x={R + 6} y={yv(target) + 3} className="fill-muted-foreground text-[8.5px]">{trs('target')} {format(target)}</text> : null}
        </>
      ) : null}
      {typeof before === 'number' && typeof now === 'number' ? <line x1={L} y1={yv(before)} x2={R} y2={yv(now)} className={cn(STROKE[tone], 'viz-draw is-drawn')} strokeWidth={2.5} pathLength={1} strokeDasharray={state === 'verified' ? undefined : '4 3'} /> : null}
      {typeof before === 'number' ? (
        <>
          <circle cx={L} cy={yv(before)} r={3.5} className="fill-background stroke-foreground/60" strokeWidth={2} />
          <text x={L - 7} y={yv(before) + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">{format(before)}</text>
        </>
      ) : null}
      {typeof now === 'number' ? (
        <>
          <circle cx={R} cy={yv(now)} r={4.5} className={cn(FILL[tone], 'viz-pop is-drawn')} />
          <text x={R + 6} y={yv(now) + 3} className="fill-foreground text-[9.5px] font-semibold">{format(now)}</text>
        </>
      ) : null}
      <text x={L} y={H - 1} textAnchor="middle" className="fill-muted-foreground text-[7.5px]">{trs('before')}</text>
      <text x={R} y={H - 1} textAnchor="middle" className="fill-muted-foreground text-[7.5px]">{trs('now')}</text>
    </svg>
  );
}

export type JourneyStep = { label: string; from: string; to: string | null; outcome?: 'passed' | 'stopped' | 'sent back' | null };

/** One item's path through its stages as a strip: dated nodes, today, and how each stage ended. */
export function Journey({ steps, today, end, endLabel = 'due', stoppedOn, holds = [], className }: { steps: JourneyStep[]; today: string; end?: string | null; endLabel?: string; stoppedOn?: string | null; holds?: { at: string; to: string | null }[]; className?: string }) {
  if (!steps.length) return null;
  const last = end ?? today;
  const t0 = t(steps[0].from);
  const t1 = Math.max(t(today), t(last));
  const x = (v: number) => `${(clamp((v - t0) / Math.max(1, t1 - t0)) * 100).toFixed(2)}%`;
  const segs = steps.map((s, i) => ({ ...s, until: s.to ?? last, isLast: i === steps.length - 1 }));
  const over = Boolean(end) && !stoppedOn && t(today) >= t(end!);
  const past = end ? Math.round((t(today) - t(end)) / DAY) : 0;
  return (
    <div className={cn('relative', className)}>
      <div className="relative h-9">
        {segs.map((s, i) => (
          <div key={i} className={cn('viz-grow absolute top-3 h-3 rounded-full', s.outcome === 'stopped' ? 'bg-danger/70' : s.isLast ? 'bg-primary' : 'bg-primary/40')} style={{ insetInlineStart: x(t(s.from)), width: `calc(${x(t(s.until))} - ${x(t(s.from))})`, animationDelay: `${i * 150}ms` }} title={`${s.label}: ${shortDate(s.from)} → ${s.to ? shortDate(s.to) : 'now'}${s.outcome ? ` (${s.outcome})` : ''}`} />
        ))}
        {segs.map((s, i) => (
          <div key={`n${i}`} className="absolute top-0 -translate-x-1/2 rtl:translate-x-1/2 text-center" style={{ insetInlineStart: x(t(s.from)) }}>
            <span className="block text-[9px] tabular-nums text-muted-foreground">{shortDate(s.from)}</span>
            <span className="mx-auto mt-[1px] block h-2 w-2 rounded-full border-2 border-background bg-foreground/70" />
          </div>
        ))}
        <div className="absolute top-2 h-6 -translate-x-1/2 rtl:translate-x-1/2 border-s-2 border-dashed border-foreground/70" style={{ insetInlineStart: x(t(today)) }} />
        <span className={cn('absolute top-8 whitespace-nowrap text-[9px] text-foreground', over ? '-translate-x-full rtl:translate-x-full' : '-translate-x-1/2 rtl:translate-x-1/2')} style={{ insetInlineStart: x(t(today)) }}>
          {trs('today')}{over ? (past > 0 ? ` · ${past} ${trs('days past')} ${trs(endLabel)} ${shortDate(end)}` : ` · ${trs(endLabel)} ${trs('today')}`) : ''}
        </span>
        {holds.filter((h) => h.at && t(h.at) >= t0).map((h, i) => (
          <div key={`h${i}`} className="absolute top-0 -translate-x-1/2 rtl:translate-x-1/2 text-center" style={{ insetInlineStart: x(t(h.at)) }} title={`held on ${shortDate(h.at)}${h.to ? ` to ${shortDate(h.to)}` : ''}`}>
            <span className="block text-[9px] text-warn">{trs('held')} {shortDate(h.at)}</span>
            <span className="mx-auto mt-[1px] block h-2 w-2 rounded-full border-2 border-background bg-warn" />
          </div>
        ))}
        {stoppedOn ? (
          <span className="absolute top-0 -translate-x-1/2 rtl:translate-x-1/2 text-[12px] font-bold text-danger" style={{ insetInlineStart: x(t(stoppedOn)) }}>×</span>
        ) : end && !over ? (
          <span className="absolute top-8 -translate-x-full rtl:translate-x-full whitespace-nowrap text-[9px] text-muted-foreground" style={{ insetInlineStart: '100%' }}>{endLabel} {shortDate(end)}</span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {holds.length ? (
          <span>
            <span className="font-medium text-warn">{trs(holds.length === 1 ? 'held once' : `held ${holds.length} times`)}</span>
            {holds.map((h) => ` · ${shortDate(h.at)}${h.to ? ` → ${shortDate(h.to)}` : ''}`).join('')}
          </span>
        ) : null}
        {segs.map((s, i) => (
          <span key={i}>
            <span className="font-medium text-foreground">{s.label}</span> {shortDate(s.from)}
            {s.to ? ` → ${shortDate(s.to)}${s.outcome ? `, ${s.outcome}` : ''}` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The picture behind a verified benefit: the daily series through the baseline
 * window (grey) and the pilot window (primary), each window's mean as a level,
 * an optional control series as a thin line, the target dashed. The step
 * between the two levels is the benefit; the noise around it is why the
 * windows need to be weeks long.
 */
export function BeforeAfter({ days, control, baseline, measured, liveOn, target, format = plainNumber, className }: { days: { day: string; value: number }[]; control?: { day: string; value: number }[]; baseline: { from: string | null; to: string | null; value: number | null }; measured: { from: string | null; to: string | null; value: number | null }; liveOn?: string | null; target?: number | null; format?: Format; className?: string }) {
  if (!days.length) return <div className={cn('h-14 rounded bg-muted/40', className)} />;
  const W = 480, H = 64, T = 6, B = 14, L = 2, R = 2;
  const t0 = t(days[0].day);
  const t1 = t(days[days.length - 1].day) || t0 + 1;
  const vals = [...days.map((d) => d.value), ...(control ?? []).map((d) => d.value), ...[baseline.value, measured.value, target].filter((v): v is number => typeof v === 'number')];
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.15;
  const x = (d: string) => L + ((t(d) - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - (lo - pad)) / (hi + pad - (lo - pad))) * (H - T - B);
  const live = liveOn ? x(liveOn) : null;
  const path = (pts: { day: string; value: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const before = days.filter((d) => !liveOn || d.day < liveOn);
  const after = days.filter((d) => liveOn && d.day >= liveOn);
  const label = { fontSize: 8, paintOrder: 'stroke' as const, stroke: 'hsl(var(--background))', strokeWidth: 3, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn('viz-svg block h-auto w-full max-w-full', className)} role="img" aria-label="The series before and during the pilot">
      {baseline.from && baseline.to ? <rect x={x(baseline.from)} y={T} width={Math.max(2, x(baseline.to) - x(baseline.from))} height={H - T - B} className="fill-muted/60" /> : null}
      {measured.from && measured.to ? <rect x={x(measured.from)} y={T} width={Math.max(2, x(measured.to) - x(measured.from))} height={H - T - B} className="fill-primary/10" /> : null}
      {typeof target === 'number' ? <line x1={L} x2={W - R} y1={y(target)} y2={y(target)} className="stroke-foreground/40" strokeDasharray="3 3" /> : null}
      {control?.length ? <path d={path(control)} className="fill-none stroke-muted-foreground/50" strokeWidth={1} /> : null}
      {before.length > 1 ? <path d={path(before)} className="viz-draw is-drawn fill-none stroke-muted-foreground" strokeWidth={1.25} pathLength={1} /> : null}
      {after.length > 1 ? <path d={path(after)} className="viz-draw is-drawn fill-none stroke-primary" strokeWidth={1.5} pathLength={1} /> : null}
      {baseline.from && baseline.to && typeof baseline.value === 'number' ? <line x1={x(baseline.from)} x2={x(baseline.to)} y1={y(baseline.value)} y2={y(baseline.value)} className="stroke-foreground/70" strokeWidth={2} /> : null}
      {measured.from && measured.to && typeof measured.value === 'number' ? <line x1={x(measured.from)} x2={x(measured.to)} y1={y(measured.value)} y2={y(measured.value)} className="stroke-primary" strokeWidth={2.5} /> : null}
      {live !== null ? <line x1={live} x2={live} y1={T - 2} y2={H - B + 2} className="stroke-foreground/60" strokeDasharray="2 2" /> : null}
      {baseline.from ? <text x={x(baseline.from) + 2} y={H - 3} className="fill-muted-foreground" {...label}>{trs('baseline')} {shortDate(baseline.from)}</text> : null}
      {live !== null ? <text x={live + 3} y={H - 3} className="fill-foreground" {...label}>{trs('live')} {shortDate(liveOn!)}</text> : null}
      {measured.to ? <text x={W - R} y={H - 3} textAnchor="end" className="fill-primary" {...label}>{shortDate(measured.to)}</text> : null}
      {typeof target === 'number' ? <text x={W - R} y={y(target) - 2} textAnchor="end" className="fill-foreground/70" {...label}>{trs('target')} {format(target)}</text> : null}
    </svg>
  );
}
